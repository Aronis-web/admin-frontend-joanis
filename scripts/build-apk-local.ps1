$ErrorActionPreference = 'Stop'

$PROJECT = 'C:/Users/aaron/IdeaProjects/admin-frontend-joanis'
$BUILD_DIR = 'C:\erp'
$OUTPUT_DIR = 'C:\Users\Aaron\OneDrive\Desktop\apps Erp aio'

$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = 'C:\gradle_cache'
$env:GRADLE_OPTS = '-Xmx4g -XX:MaxMetaspaceSize=1g'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

$VERSION = (Get-Content "$PROJECT\app.json" | ConvertFrom-Json).expo.version
Write-Host "==> Version: $VERSION"

Write-Host '==> Limpiando build dir y gradle cache...'
Remove-Item -Recurse -Force $BUILD_DIR -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force 'C:\gradle_cache' -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path 'C:\gradle_cache' -Force | Out-Null

Write-Host '==> Copiando proyecto con robocopy...'
robocopy $PROJECT $BUILD_DIR /E /XD node_modules android .git /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with $LASTEXITCODE" }
$global:LASTEXITCODE = 0

Set-Location $BUILD_DIR
Write-Host '==> npm install...'
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }

Write-Host '==> expo prebuild --platform android --clean...'
npx expo prebuild --platform android --clean
if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed' }

$sdkPath = $env:ANDROID_HOME -replace '\\','/'
"sdk.dir=$sdkPath" | Out-File -FilePath "$BUILD_DIR\android\local.properties" -Encoding ASCII

Set-Location "$BUILD_DIR\android"
Write-Host '==> gradlew assembleRelease...'
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
if ($LASTEXITCODE -ne 0) { throw 'gradlew assembleRelease failed' }

$APK_SOURCE = "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $OUTPUT_DIR)) { New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null }
$DEST = Join-Path $OUTPUT_DIR "ERP-aio-v$VERSION.apk"
Copy-Item $APK_SOURCE $DEST -Force
Write-Host "==> APK generado en: $DEST"

Set-Location $PROJECT
