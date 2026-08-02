<#
  release-tool.ps1
  Orquesta el flujo de release multi-proyecto (admin-frontend-joanis / caja-frontend-joanis):
    1. Sube la version (patch/minor/major) en los archivos configurados del proyecto
    2. Genera el APK Android (Gradle) y/o la version de escritorio (.exe Electron)
    3. Guarda los artefactos en carpetas ordenadas y SEPARADAS:
         <Desktop>\Releases\<Producto>\apk\
         <Desktop>\Releases\<Producto>\exe\
    4. (Opcional) git add + commit + push

  La configuracion de cada proyecto vive en build-tool\projects.json.

  Marcadores para la UI:
    @@STEP@@ texto   @@OK@@ texto   @@ERR@@ texto   @@RESULT@@ k=v
#>
param(
  [string]$ProjectKey = 'admin',
  [ValidateSet('none', 'patch', 'minor', 'major')] [string]$BumpType = 'patch',
  [switch]$BuildApk,
  [switch]$BuildElectron,
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

# ---------------------------------------------------------------------------
# Entorno de build (Android)
# ---------------------------------------------------------------------------
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle_cache"
$env:GRADLE_OPTS = "-Xmx4g -XX:MaxMetaspaceSize=1g"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

$Desktop = if (Test-Path "$env:USERPROFILE\OneDrive\Desktop") { "$env:USERPROFILE\OneDrive\Desktop" } else { "$env:USERPROFILE\Desktop" }

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
  if ($BuildApk) {
    if (-not $proj.apk.supported) { throw "El proyecto $ProductName no soporta build de APK" }
    Step "Generando APK Android v$newVersion ($ProductName)"
    New-Item -ItemType Directory -Path $ApkOut -Force | Out-Null

    Write-Host "Sincronizando codigo fuente a $BUILD_DIR"
    robocopy $Project $BUILD_DIR /E /XD node_modules android .git web-build dist .expo build-tool /XF app-release.apk build-apk*.log build-apk*.err build-apk*.pid /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy fallo con codigo $LASTEXITCODE" }
    $global:LASTEXITCODE = 0

    Set-Location $BUILD_DIR
    Write-Host "npm install"
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install fallo" }

    Write-Host "expo prebuild android (--clean)"
    npx expo prebuild --platform android --clean
    if ($LASTEXITCODE -ne 0) { throw "expo prebuild fallo" }

    "sdk.dir=$($env:ANDROID_HOME -replace '\\', '/')" | Out-File -FilePath "$BUILD_DIR\android\local.properties" -Encoding UTF8

    $arch = if ($proj.apk.arch) { $proj.apk.arch } else { "arm64-v8a" }
    Write-Host "gradlew assembleRelease ($arch)"
    Set-Location "$BUILD_DIR\android"
    ./gradlew assembleRelease -PreactNativeArchitectures=$arch --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease fallo" }

    $apkSrc = "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk"
    if (-not (Test-Path $apkSrc)) { throw "No se encontro el APK en $apkSrc" }

    $apkDest = Join-Path $ApkOut "$ProductName-v$newVersion.apk"
    Copy-Item $apkSrc $apkDest -Force
    $apkMb = [math]::Round((Get-Item $apkDest).Length / 1MB, 1)
    Res "apk" $apkDest
    Res "apkMb" $apkMb
    Ok "APK generado ($apkMb MB) -> $apkDest"
    Set-Location $Project
  }

  # -------------------------------------------------------------------------
  # 2b. BUILD ELECTRON (.exe)
  # -------------------------------------------------------------------------
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
  # 3. COMMIT + PUSH
  # -------------------------------------------------------------------------
  if ($CommitPush) {
    Step "git add + commit + push (release v$newVersion)"
    Set-Location $Project
    git add -A
    $pending = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($pending)) {
      Write-Host "No hay cambios para commitear."
    }
    else {
      git --no-pager commit -m "chore: release v$newVersion"
      if ($LASTEXITCODE -ne 0) { throw "git commit fallo" }
    }
    git push
    if ($LASTEXITCODE -ne 0) { throw "git push fallo" }
    Ok "Cambios enviados al remoto (v$newVersion)"
  }

  if ($BuildApk -or $BuildElectron) { Res "outputDir" $ProjectOut }
  Ok "Proceso completado ($ProductName v$newVersion)"
  Res "status" "success"
}
catch {
  Err $_.Exception.Message
  Res "status" "error"
  exit 1
}
