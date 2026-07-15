$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = 'C:\gradle_cache5'
$env:GRADLE_OPTS = '-Xmx4g -XX:MaxMetaspaceSize=1g'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location C:\erp\android
cmd /c "gradlew.bat :react-native-worklets:configureCMakeRelWithDebInfo -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain --stacktrace 2>&1"
