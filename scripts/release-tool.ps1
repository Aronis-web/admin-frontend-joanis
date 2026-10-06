<#
  release-tool.ps1
  Orquesta el flujo de release multi-proyecto (admin-frontend-joanis / caja-frontend-joanis):
    1. Sube la version (patch/minor/major) en los archivos configurados del proyecto
    2. Genera el APK Android (Gradle) y/o la version de escritorio (.exe Electron)
    3. Guarda los artefactos en carpetas ordenadas y SEPARADAS:
         <Desktop>\Releases\<Producto>\apk\
         <Desktop>\Releases\<Producto>\exe\
    4. (Opcional) Sube los artefactos al servidor (Versiones de App), de donde
       las apps se actualizan solas (CajaGrit escritorio, admin Android).
    5. (Opcional) commit de los archivos de version + push a GitHub

  La configuracion de cada proyecto vive en build-tool\projects.json.
  Los secretos (keystore de firma y usuario para subir) viven fuera del repo,
  en %USERPROFILE%\.erp-release, y se crean con scripts\setup-release-secrets.ps1.

  Marcadores para la UI:
    @@STEP@@ texto   @@OK@@ texto   @@WARN@@ texto   @@ERR@@ texto   @@RESULT@@ k=v
#>
param(
  [string]$ProjectKey = 'admin',
  [ValidateSet('none', 'patch', 'minor', 'major')] [string]$BumpType = 'patch',
  [switch]$BuildApk,
  [switch]$BuildElectron,
  [switch]$Upload,
  [string]$Changelog = '',
  [switch]$CommitPush,
  [string]$ConfigPath = ''
)

$ErrorActionPreference = "Stop"

# Emitir la salida en UTF-8 para que caracteres como "·" o tildes no se
# muestren como "�" en el log de la app (que lee stdout como UTF-8).
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

function Step($m) { Write-Host "@@STEP@@ $m" }
function Ok($m) { Write-Host "@@OK@@ $m" }
function Warn($m) { Write-Host "@@WARN@@ $m" }
function Err($m) { Write-Host "@@ERR@@ $m" }
function Res($k, $v) { Write-Host "@@RESULT@@ $k=$v" }

# Lectura/escritura en UTF-8 SIN BOM (evita que Expo/JSON fallen al parsear).
function Read-TextUtf8($p) { return [System.IO.File]::ReadAllText($p) }
function Write-TextUtf8NoBom($p, $c) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($p, $c, $enc)
}
function Set-JsonVersion($path, $new) {
  if (-not (Test-Path $path)) { return }
  $txt = Read-TextUtf8 $path
  # Reemplaza SOLO la primera clave "version": "..." (la del encabezado del JSON).
  $rx = [regex]'("version"\s*:\s*")[^"]*(")'
  $out = $rx.Replace($txt, ('${1}' + $new + '${2}'), 1)
  Write-TextUtf8NoBom $path $out
}
function Get-JsonValue($obj, $dottedPath) {
  $cur = $obj
  foreach ($seg in $dottedPath.Split('.')) { $cur = $cur.$seg }
  return $cur
}

# versionCode creciente derivado de la version: 1.0.108 -> 1000108.
# Sin esto todos los APK salian con versionCode 1.
function Get-VersionCode($version) {
  $p = "$version".Split('.')
  return ([int]$p[0]) * 1000000 + ([int]$p[1]) * 1000 + ([int]$p[2])
}
function Set-AndroidVersionCode($appJsonPath, $code) {
  $txt = Read-TextUtf8 $appJsonPath
  $rxExisting = [regex]'("versionCode"\s*:\s*)\d+'
  if ($rxExisting.IsMatch($txt)) {
    $out = $rxExisting.Replace($txt, ('${1}' + $code), 1)
  }
  else {
    $rxAndroid = [regex]'("android"\s*:\s*\{)'
    if (-not $rxAndroid.IsMatch($txt)) { throw "app.json no tiene bloque android" }
    $out = $rxAndroid.Replace($txt, ('${1}' + "`"versionCode`": $code,"), 1)
  }
  Write-TextUtf8NoBom $appJsonPath $out
}

# Secretos locales protegidos con DPAPI (solo este usuario de Windows los lee).
$SecretsDir = Join-Path $env:USERPROFILE ".erp-release"
function Unprotect-Secret($encrypted) {
  $secure = ConvertTo-SecureString $encrypted
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
function Read-SecretsFile($name) {
  $p = Join-Path $SecretsDir $name
  if (-not (Test-Path $p)) { return $null }
  return (Read-TextUtf8 $p | ConvertFrom-Json)
}

# ---------------------------------------------------------------------------
# Entorno de build (Android)
# ---------------------------------------------------------------------------
$javaHome = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
if (-not (Test-Path $javaHome)) {
  $jdk = Get-ChildItem "C:\Program Files\Microsoft" -Directory -Filter "jdk-17*" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | Select-Object -First 1
  if ($jdk) { $javaHome = $jdk.FullName } elseif ($env:JAVA_HOME) { $javaHome = $env:JAVA_HOME }
}
$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle_cache"
$env:GRADLE_OPTS = "-Xmx4g -XX:MaxMetaspaceSize=1g"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

$Desktop = if (Test-Path "$env:USERPROFILE\OneDrive\Desktop") { "$env:USERPROFILE\OneDrive\Desktop" } else { "$env:USERPROFILE\Desktop" }

# Estado para deshacer el bump si algo falla antes de publicar.
$originalVersionFiles = @{}
$bumped = $false
$published = $false
$committed = $false
$signingPropsFile = $null

try {
  # -------------------------------------------------------------------------
  # 0. Cargar configuracion del proyecto
  # -------------------------------------------------------------------------
  if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = Join-Path (Split-Path $PSScriptRoot -Parent) "build-tool\projects.json"
  }
  if (-not (Test-Path $ConfigPath)) { throw "No se encontro projects.json en $ConfigPath" }
  $config = Read-TextUtf8 $ConfigPath | ConvertFrom-Json
  $releasesFolderName = if ($config.releasesFolderName) { $config.releasesFolderName } else { "Releases" }
  $proj = $config.projects | Where-Object { $_.key -eq $ProjectKey } | Select-Object -First 1
  if (-not $proj) { throw "Proyecto '$ProjectKey' no existe en projects.json" }

  $Project = ($proj.root -replace '/', '\').TrimEnd('\')
  $BUILD_DIR = ($proj.buildDir -replace '/', '\').TrimEnd('\')
  $ProductName = $proj.productName
  Res "project" $ProductName
  Res "projectKey" $ProjectKey
  Step "Proyecto: $($proj.label)  ($Project)"

  # Validar ANTES de tocar la version lo que luego haria fallar el proceso.
  $signing = $null
  if ($BuildApk) {
    $signing = Read-SecretsFile "android-signing.json"
    if (-not $signing) {
      Warn "Sin keystore fija: el APK se firma con la clave debug de esta PC y no se instala encima de uno firmado en otra PC. Crea la keystore con scripts\setup-release-secrets.ps1 -Part keystore"
    }
    elseif (-not (Test-Path $signing.storeFile)) {
      throw "No se encontro la keystore $($signing.storeFile)"
    }
  }
  $uploadCfg = $null
  if ($Upload) {
    $uploadCfg = Read-SecretsFile "upload.json"
    if (-not $uploadCfg) { throw "Falta el usuario para subir: ejecuta scripts\setup-release-secrets.ps1 -Part upload" }
    $wantsApkUpload = $BuildApk -and $proj.upload -and $proj.upload.apk
    $wantsExeUpload = $BuildElectron -and $proj.upload -and $proj.upload.exe
    if (-not ($wantsApkUpload -or $wantsExeUpload)) {
      throw "Nada que subir: este proyecto no tiene destino en el servidor para los artefactos elegidos"
    }
  }

  # Carpetas de salida separadas
  $ReleasesRoot = Join-Path $Desktop $releasesFolderName
  $ProjectOut = Join-Path $ReleasesRoot $ProductName
  $ApkOut = Join-Path $ProjectOut "apk"
  $ExeOut = Join-Path $ProjectOut "exe"

  # -------------------------------------------------------------------------
  # 1. BUMP DE VERSION
  # -------------------------------------------------------------------------
  $primaryPath = Join-Path $Project $proj.primaryVersionFile
  $currentVersion = Get-JsonValue (Read-TextUtf8 $primaryPath | ConvertFrom-Json) $proj.primaryVersionPath
  Res "previousVersion" $currentVersion

  $newVersion = "$currentVersion"
  if ($BumpType -ne 'none') {
    Step "Subiendo version ($BumpType) desde $currentVersion"
    $parts = "$currentVersion".Split('.')
    if ($parts.Count -ne 3) { throw "Version invalida: $currentVersion" }
    [int]$maj = $parts[0]; [int]$min = $parts[1]; [int]$pat = $parts[2]
    switch ($BumpType) {
      'patch' { $pat++ }
      'minor' { $min++; $pat = 0 }
      'major' { $maj++; $min = 0; $pat = 0 }
    }
    $newVersion = "$maj.$min.$pat"
    foreach ($vf in $proj.versionFiles) {
      $vfPath = Join-Path $Project $vf
      if (Test-Path $vfPath) { $originalVersionFiles[$vfPath] = Read-TextUtf8 $vfPath }
    }
    $bumped = $true
    foreach ($vf in $proj.versionFiles) {
      Set-JsonVersion (Join-Path $Project $vf) $newVersion
    }
    Ok "Version actualizada a $newVersion"
  }
  else {
    Step "Sin cambio de version (se mantiene $currentVersion)"
  }
  Res "version" $newVersion

  # -------------------------------------------------------------------------
  # 2a. BUILD APK
  # -------------------------------------------------------------------------
  $apkDest = $null
  if ($BuildApk) {
    if (-not $proj.apk.supported) { throw "El proyecto $ProductName no soporta build de APK" }
    Step "Generando APK Android v$newVersion ($ProductName)"
    New-Item -ItemType Directory -Path $ApkOut -Force | Out-Null

    Write-Host "Sincronizando codigo fuente a $BUILD_DIR"
    robocopy $Project $BUILD_DIR /E /XD node_modules android .git web-build dist .expo build-tool /XF app-release.apk build-apk*.log build-apk*.err build-apk*.pid /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy fallo con codigo $LASTEXITCODE" }
    $global:LASTEXITCODE = 0

    # versionCode solo en la copia de build (no se commitea).
    $versionCode = Get-VersionCode $newVersion
    Set-AndroidVersionCode (Join-Path $BUILD_DIR "app.json") $versionCode
    Write-Host "versionCode $versionCode"

    Set-Location $BUILD_DIR
    Write-Host "npm install"
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install fallo" }

    Write-Host "expo prebuild android (--clean)"
    npx expo prebuild --platform android --clean
    if ($LASTEXITCODE -ne 0) { throw "expo prebuild fallo" }

    "sdk.dir=$($env:ANDROID_HOME -replace '\\', '/')" | Out-File -FilePath "$BUILD_DIR\android\local.properties" -Encoding UTF8

    if ($signing) {
      # Firma con la keystore fija. Las claves se escriben solo en la copia de
      # build y se borran al terminar (bloque finally).
      $signingPropsFile = "$BUILD_DIR\android\gradle.properties"
      $storeFile = ($signing.storeFile -replace '\\', '/')
      $lines = @(
        "",
        "android.injected.signing.store.file=$storeFile",
        "android.injected.signing.store.password=$(Unprotect-Secret $signing.storePassword)",
        "android.injected.signing.key.alias=$($signing.keyAlias)",
        "android.injected.signing.key.password=$(Unprotect-Secret $signing.keyPassword)"
      )
      Add-Content -Path $signingPropsFile -Value $lines -Encoding ASCII
      Write-Host "Firma: keystore fija ($($signing.keyAlias))"
    }

    $arch = if ($proj.apk.arch) { [string]$proj.apk.arch } else { "arm64-v8a" }
    if ([string]::IsNullOrWhiteSpace($arch)) { $arch = "arm64-v8a" }
    Write-Host "gradlew assembleRelease ($arch)"
    Set-Location "$BUILD_DIR\android"
    $archProp = "-PreactNativeArchitectures=$arch"
    Write-Host "cmd: gradlew.bat assembleRelease $archProp --no-daemon"
    & cmd /c "gradlew.bat assembleRelease $archProp --no-daemon"
    if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease fallo" }

    $apkSrc = "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk"
    if (-not (Test-Path $apkSrc)) { throw "No se encontro el APK en $apkSrc" }

    $apkDest = Join-Path $ApkOut "$ProductName-v$newVersion.apk"
    Copy-Item $apkSrc $apkDest -Force
    $apkMb = [math]::Round((Get-Item $apkDest).Length / 1MB, 1)
    Res "apk" $apkDest
    Res "apkMb" $apkMb
    Res "apkSigning" $(if ($signing) { "keystore fija" } else { "debug (solo esta PC)" })
    Ok "APK generado ($apkMb MB) -> $apkDest"
    Set-Location $Project
  }

  # -------------------------------------------------------------------------
  # 2b. BUILD ELECTRON (.exe)
  # -------------------------------------------------------------------------
  $exeDest = $null
  if ($BuildElectron) {
    if (-not $proj.electron.supported) { throw "El proyecto $ProductName no soporta build de escritorio" }
    Step "Generando version de escritorio (.exe) v$newVersion ($ProductName)"
    New-Item -ItemType Directory -Path $ExeOut -Force | Out-Null
    Set-Location $Project

    $script = $proj.electron.npmScript
    Write-Host "npm run $script"
    npm run $script
    if ($LASTEXITCODE -ne 0) { throw "npm run $script fallo" }

    $glob = $proj.electron.exeGlob
    $exeItem = Get-ChildItem (Join-Path $Project "dist") -Filter $glob -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $exeItem) { throw "No se encontro el instalador (patron '$glob') en dist/" }

    $exeDest = Join-Path $ExeOut $exeItem.Name
    Copy-Item $exeItem.FullName $exeDest -Force
    $exeMb = [math]::Round((Get-Item $exeDest).Length / 1MB, 1)
    Res "exe" $exeDest
    Res "exeMb" $exeMb
    Ok "Instalador .exe generado ($exeMb MB) -> $exeDest"
  }

  # -------------------------------------------------------------------------
  # 3. SUBIR AL SERVIDOR (Versiones de App)
  # -------------------------------------------------------------------------
  if ($Upload) {
    $apiUrl = "$($uploadCfg.apiUrl)".TrimEnd('/')
    Step "Subiendo al servidor ($apiUrl)"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $baseHeaders = @{ 'X-App-Id' = $uploadCfg.appId }

    $loginBody = @{ email = $uploadCfg.email; password = (Unprotect-Secret $uploadCfg.password) } | ConvertTo-Json
    $login = Invoke-RestMethod -Method Post -Uri "$apiUrl/auth/login" -Headers $baseHeaders -ContentType 'application/json' -Body $loginBody
    if (-not $login.accessToken) { throw "El login no devolvio token" }
    $authHeaders = @{ 'X-App-Id' = $uploadCfg.appId; 'Authorization' = "Bearer $($login.accessToken)" }

    $targets = @()
    if ($wantsApkUpload) { $targets += @{ file = $apkDest; appId = $proj.upload.apk.appId; platform = $proj.upload.apk.platform } }
    if ($wantsExeUpload) { $targets += @{ file = $exeDest; appId = $proj.upload.exe.appId; platform = $proj.upload.exe.platform } }

    foreach ($t in $targets) {
      Write-Host "Version $newVersion -> $($t.appId)/$($t.platform)"
      if (-not [string]::IsNullOrWhiteSpace($Changelog)) {
        $relBody = @{ appId = $t.appId; platform = $t.platform; version = $newVersion; changelog = $Changelog.Trim() } | ConvertTo-Json
        try {
          Invoke-RestMethod -Method Post -Uri "$apiUrl/app-updates/releases" -Headers $authHeaders -ContentType 'application/json' -Body $relBody | Out-Null
        }
        catch {
          # 400: la version ya existia; se sube el archivo igual.
          $status = $_.Exception.Response.StatusCode.value__
          if ($status -ne 400) { throw }
        }
      }

      # Subida multipart con curl.exe (Invoke-RestMethod -Form no existe en
      # PowerShell 5.1). El token va en un archivo de cabeceras temporal para
      # que no quede en la linea de comandos.
      $headerFile = [System.IO.Path]::GetTempFileName()
      $bodyFile = [System.IO.Path]::GetTempFileName()
      try {
        Write-TextUtf8NoBom $headerFile ("Authorization: Bearer $($login.accessToken)`r`nX-App-Id: $($uploadCfg.appId)`r`n")
        $uploadUrl = "$apiUrl/app-updates/releases/$($t.appId)/$($t.platform)/$newVersion/upload"
        $code = & curl.exe -sS -o $bodyFile -w "%{http_code}" -H "@$headerFile" -F "file=@$($t.file)" $uploadUrl
        if ($LASTEXITCODE -ne 0) { throw "curl fallo al subir $($t.file)" }
        if ("$code" -notmatch '^2') {
          throw "El servidor respondio $code al subir: $(Get-Content $bodyFile -Raw)"
        }
      }
      finally {
        Remove-Item $headerFile, $bodyFile -Force -ErrorAction SilentlyContinue
      }
      $published = $true
      Res "uploaded_$($t.platform)" "$($t.appId) v$newVersion"
      Ok "Publicado $($t.appId)/$($t.platform) v$newVersion"
    }
  }

  # -------------------------------------------------------------------------
  # 4. COMMIT + PUSH (solo los archivos de version)
  # -------------------------------------------------------------------------
  if ($CommitPush) {
    Set-Location $Project
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    $remote = if ($proj.gitRemoteUrl) { $proj.gitRemoteUrl } else { 'origin' }
    Step "Commit de la version + push a $remote ($branch)"
    if ($ProjectKey -eq 'admin' -and $branch -eq 'master') {
      Warn "Push a master: el admin web (gritlabs.app) se publica solo"
    }
    $versionPaths = @($proj.versionFiles | Where-Object { Test-Path (Join-Path $Project $_) })
    git add -- $versionPaths
    if ($LASTEXITCODE -ne 0) { throw "git add fallo" }
    git diff --cached --quiet -- $versionPaths
    if ($LASTEXITCODE -eq 0) {
      Write-Host "No hay cambios de version para commitear."
    }
    else {
      git --no-pager commit -m "chore: release v$newVersion" -- $versionPaths
      if ($LASTEXITCODE -ne 0) { throw "git commit fallo" }
      $committed = $true
    }
    git push $remote "HEAD:refs/heads/$branch"
    if ($LASTEXITCODE -ne 0) { throw "git push fallo (el commit quedo local)" }
    Ok "Version v$newVersion enviada a $remote ($branch)"
  }

  if ($BuildApk -or $BuildElectron) { Res "outputDir" $ProjectOut }
  Ok "Proceso completado ($ProductName v$newVersion)"
  Res "status" "success"
}
catch {
  Err $_.Exception.Message
  # Deshacer el bump si nada se publico: asi la siguiente corrida no se salta
  # un numero de version.
  if ($bumped -and -not $published -and -not $committed) {
    foreach ($p in $originalVersionFiles.Keys) {
      try { Write-TextUtf8NoBom $p $originalVersionFiles[$p] } catch { }
    }
    Warn "Se restauro la version anterior ($currentVersion)"
  }
  Res "status" "error"
  exit 1
}
finally {
  if ($signingPropsFile -and (Test-Path $signingPropsFile)) {
    $kept = Get-Content $signingPropsFile | Where-Object { $_ -notmatch '^android\.injected\.signing\.' }
    Set-Content -Path $signingPropsFile -Value $kept -Encoding ASCII
  }
}
