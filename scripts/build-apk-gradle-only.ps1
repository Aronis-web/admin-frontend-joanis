$ErrorActionPreference = 'Stop'

$PROJECT = 'C:/Users/aaron/IdeaProjects/admin-frontend-joanis'
$BUILD_DIR = 'C:\erp'
$OUTPUT_DIR = 'C:\Users\Aaron\OneDrive\Desktop\apps Erp aio'

$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = 'C:\gradle_cache'
$env:GRADLE_OPTS = '-Xmx4g -XX:MaxMetaspaceSize=1g'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

$VERSION = (Get-Content "$PROJECT\app.json" | ConvertFrom-Json).expo.version
Write-Host "==> Version: $VERSION"
Write-Host "==> JAVA_HOME: $env:JAVA_HOME"

$sdkPath = $env:ANDROID_HOME -replace '\\','/'
"sdk.dir=$sdkPath" | Out-File -FilePath "$BUILD_DIR\android\local.properties" -Encoding ASCII

Set-Location "$BUILD_DIR\android"
& .\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a" --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { throw "gradlew assembleRelease failed ($LASTEXITCODE)" }

$APK_SOURCE = "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $OUTPUT_DIR)) { New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null }
$DEST = Join-Path $OUTPUT_DIR "ERP-aio-v$VERSION.apk"
Copy-Item $APK_SOURCE $DEST -Force
Write-Host "==> APK generado en: $DEST"

Set-Location $PROJECT
