$ErrorActionPreference = "Stop"

$PROJECT   = "C:/Users/aaron/IdeaProjects/admin-frontend-joanis"
$BUILD_DIR = "C:\erp"
$OUTPUT_DIR = "C:\Users\aaron\OneDrive\Desktop\apps Erp aio"

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle_cache"
$env:GRADLE_OPTS = "-Xmx4g -XX:MaxMetaspaceSize=1g"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

function Step($msg) { Write-Host "`n===== $msg =====" -ForegroundColor Cyan }

$VERSION = (Get-Content "$PROJECT\app.json" | ConvertFrom-Json).expo.version
Step "Version detectada: $VERSION"
Step "JAVA_HOME: $env:JAVA_HOME"
& "$env:JAVA_HOME\bin\java.exe" -version

Step "Sincronizando codigo fuente a $BUILD_DIR (excluye node_modules, android, .git)"
robocopy $PROJECT $BUILD_DIR /E /XD node_modules android .git web-build dist .expo /XF app-release.apk build-apk*.log build-apk*.err build-apk*.pid /NFL /NDL /NJH /NJS /NC /NS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy fallo con codigo $LASTEXITCODE" }
$global:LASTEXITCODE = 0

Set-Location $BUILD_DIR

Step "npm install"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install fallo" }

Step "expo prebuild android (--clean)"
npx expo prebuild --platform android --clean
if ($LASTEXITCODE -ne 0) { throw "expo prebuild fallo" }

Step "Escribiendo local.properties"
"sdk.dir=$($env:ANDROID_HOME -replace '\\', '/')" | Out-File -FilePath "$BUILD_DIR\android\local.properties" -Encoding UTF8

Step "gradlew assembleRelease (arm64-v8a)"
Set-Location "$BUILD_DIR\android"
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease fallo" }

$APK_SOURCE = "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $APK_SOURCE)) { throw "No se encontro el APK en $APK_SOURCE" }

if (-not (Test-Path $OUTPUT_DIR)) { $OUTPUT_DIR = $PROJECT }
$DEST = "$OUTPUT_DIR\ERP-aio-v$VERSION.apk"
Copy-Item $APK_SOURCE $DEST -Force
Copy-Item $APK_SOURCE "$PROJECT\app-release.apk" -Force

$size = [math]::Round((Get-Item $DEST).Length/1MB,1)
Step "APK LISTO: $DEST ($size MB)"
Set-Location $PROJECT
