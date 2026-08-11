$ErrorActionPreference = "Stop"

$PROJECT   = "C:/Users/aaron/IdeaProjects/admin-frontend-joanis"
$BUILD_DIR = "C:\erp"
$OUTPUT_DIR = "C:\Users\aaron\OneDrive\Desktop\apps Erp aio"

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle_cache"
$env:GRADLE_OPTS = "-Xmx4g -XX:MaxMetaspaceSize=1g"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

$VERSION = (Get-Content "$PROJECT\app.json" | ConvertFrom-Json).expo.version

"sdk.dir=$($env:ANDROID_HOME -replace '\\', '/')" | Out-File -FilePath "$BUILD_DIR\android\local.properties" -Encoding UTF8

Set-Location "$BUILD_DIR\android"
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease fallo (exit $LASTEXITCODE)" }

$APK_SOURCE = "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $APK_SOURCE)) {
  $alt = Get-ChildItem "$BUILD_DIR\android\app\build\outputs\apk\release\" -Filter *.apk -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($alt) { $APK_SOURCE = $alt.FullName } else { throw "No se encontro ningun APK" }
}

if (-not (Test-Path $OUTPUT_DIR)) { $OUTPUT_DIR = $PROJECT }
$DEST = "$OUTPUT_DIR\ERP-aio-v$VERSION.apk"
Copy-Item $APK_SOURCE $DEST -Force
Copy-Item $APK_SOURCE "$PROJECT\app-release.apk" -Force

$size = [math]::Round((Get-Item $DEST).Length/1MB,1)
Write-Host "APK_LISTO -> $DEST ($size MB)"
Set-Location $PROJECT
