<#
  release-tool.ps1
  Orquesta el flujo de release del ERP-aio:
    1. Sube la version (patch/minor/major) en app.json, package.json y electron/package.json
    2. Genera el APK Android (Gradle) y/o la version de escritorio (.exe Electron)
    3. Guarda los artefactos en carpetas ordenadas por version
    4. (Opcional) git add + commit + push

  Emite marcadores para que la UI (build-tool) los interprete:
    @@STEP@@ texto     -> inicio de un paso
    @@OK@@ texto       -> paso completado
    @@ERR@@ texto      -> error
    @@RESULT@@ k=v     -> resultado (rutas, tamanos, version)
  El resto de lineas son log crudo.
#>
param(
  [ValidateSet('none', 'patch', 'minor', 'major')] [string]$BumpType = 'patch',
  [switch]$BuildApk,
  [switch]$BuildElectron,
  [switch]$CommitPush,
  [string]$Project = "C:/Users/aaron/IdeaProjects/admin-frontend-joanis"
)

$ErrorActionPreference = "Stop"
$Project = $Project.TrimEnd('/', '\')

function Step($m) { Write-Host "@@STEP@@ $m" }
function Ok($m) { Write-Host "@@OK@@ $m" }
function Err($m) { Write-Host "@@ERR@@ $m" }
function Res($k, $v) { Write-Host "@@RESULT@@ $k=$v" }

# Lectura/escritura JSON en UTF-8 SIN BOM (evita que Expo falle al parsear).
function Read-TextUtf8($p) { return [System.IO.File]::ReadAllText($p) }
function Write-TextUtf8NoBom($p, $c) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($p, $c, $enc)
}
function Set-JsonVersion($path, $new) {
  if (-not (Test-Path $path)) { return }
  $txt = Read-TextUtf8 $path
  $out = [regex]::Replace($txt, '("version"\s*:\s*")[^"]*(")', ('${1}' + $new + '${2}'))
  Write-TextUtf8NoBom $path $out
}

# ---------------------------------------------------------------------------
# Entorno de build
# ---------------------------------------------------------------------------
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle_cache"
$env:GRADLE_OPTS = "-Xmx4g -XX:MaxMetaspaceSize=1g"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

$BUILD_DIR = "C:\erp"

# Carpeta de escritorio (OneDrive o local)
$Desktop = if (Test-Path "$env:USERPROFILE\OneDrive\Desktop") { "$env:USERPROFILE\OneDrive\Desktop" } else { "$env:USERPROFILE\Desktop" }
$ReleasesRoot = Join-Path $Desktop "ERP-aio-releases"

try {
  # -------------------------------------------------------------------------
  # 1. BUMP DE VERSION
  # -------------------------------------------------------------------------
  $appJsonPath = Join-Path $Project "app.json"
  $pkgPath = Join-Path $Project "package.json"
  $electronPkgPath = Join-Path $Project "electron\package.json"

  $currentVersion = (Read-TextUtf8 $appJsonPath | ConvertFrom-Json).expo.version
  Res "previousVersion" $currentVersion

  $newVersion = $currentVersion
  if ($BumpType -ne 'none') {
    Step "Subiendo version ($BumpType) desde $currentVersion"
    $parts = $currentVersion.Split('.')
    if ($parts.Count -ne 3) { throw "Version invalida: $currentVersion" }
    [int]$maj = $parts[0]; [int]$min = $parts[1]; [int]$pat = $parts[2]
    switch ($BumpType) {
      'patch' { $pat++ }
      'minor' { $min++; $pat = 0 }
      'major' { $maj++; $min = 0; $pat = 0 }
    }
    $newVersion = "$maj.$min.$pat"

    # Actualiza la version en los 3 archivos (UTF-8 sin BOM, preservando el resto del contenido).
    Set-JsonVersion $appJsonPath $newVersion
    Set-JsonVersion $pkgPath $newVersion
    Set-JsonVersion $electronPkgPath $newVersion
    Ok "Version actualizada a $newVersion"
  }
  else {
    Step "Sin cambio de version (se mantiene $currentVersion)"
  }
  Res "version" $newVersion

  # Carpeta ordenada de salida para esta version
  $VersionDir = Join-Path $ReleasesRoot "v$newVersion"
  New-Item -ItemType Directory -Path $VersionDir -Force | Out-Null
  Res "outputDir" $VersionDir

  # -------------------------------------------------------------------------
  # 2a. BUILD APK
  # -------------------------------------------------------------------------
  if ($BuildApk) {
    Step "Generando APK Android v$newVersion"

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

    Write-Host "gradlew assembleRelease (arm64-v8a)"
    Set-Location "$BUILD_DIR\android"
    ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease fallo" }

    $apkSrc = "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk"
    if (-not (Test-Path $apkSrc)) { throw "No se encontro el APK en $apkSrc" }

    $apkDest = Join-Path $VersionDir "ERP-aio-v$newVersion.apk"
    Copy-Item $apkSrc $apkDest -Force
    Copy-Item $apkSrc (Join-Path $Project "app-release.apk") -Force
    # Copia legacy en la carpeta historica de APKs
    $legacyApk = Join-Path $Desktop "apps Erp aio"
    if (Test-Path $legacyApk) { Copy-Item $apkSrc (Join-Path $legacyApk "ERP-aio-v$newVersion.apk") -Force }

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
    Step "Generando version de escritorio (.exe) v$newVersion"
    Set-Location $Project
    Write-Host "npm run build:electron:win"
    npm run build:electron:win
    if ($LASTEXITCODE -ne 0) { throw "build:electron:win fallo" }

    $exeSrc = Join-Path $Project "dist\ERP-aio Setup $newVersion.exe"
    if (-not (Test-Path $exeSrc)) {
      $alt = Get-ChildItem (Join-Path $Project "dist") -Filter "*Setup*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($alt) { $exeSrc = $alt.FullName } else { throw "No se encontro el instalador .exe en dist/" }
    }

    $exeDest = Join-Path $VersionDir ("ERP-aio-Setup-$newVersion.exe")
    Copy-Item $exeSrc $exeDest -Force
    $legacyExe = Join-Path $Desktop ".exe Erp aio"
    if (Test-Path $legacyExe) { Copy-Item $exeSrc (Join-Path $legacyExe (Split-Path $exeSrc -Leaf)) -Force }

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

  Ok "Proceso completado (v$newVersion)"
  Res "status" "success"
}
catch {
  Err $_.Exception.Message
  Res "status" "error"
  Set-Location $Project
  exit 1
}
