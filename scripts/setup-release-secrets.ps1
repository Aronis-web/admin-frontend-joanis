<#
  setup-release-secrets.ps1
  Crea los secretos locales del Release Tool en %USERPROFILE%\.erp-release.
  Nada de esto va al repo. Las claves se guardan cifradas con DPAPI: solo este
  usuario de Windows, en esta PC, puede leerlas.

    -Part keystore  Genera la keystore fija para firmar los APK
                    (erp-release.keystore + android-signing.json).
                    GUARDA UNA COPIA de la keystore y su clave en un lugar
                    seguro: si se pierde, los APK nuevos no se instalan encima.
    -Part upload    Guarda el usuario con permiso para subir versiones
                    (app_releases.upload) y la URL del API (upload.json).

  Uso:
    powershell -ExecutionPolicy Bypass -File scripts\setup-release-secrets.ps1 -Part keystore
    powershell -ExecutionPolicy Bypass -File scripts\setup-release-secrets.ps1 -Part upload
#>
param(
  [Parameter(Mandatory = $true)] [ValidateSet('keystore', 'upload')] [string]$Part
)

$ErrorActionPreference = "Stop"
$SecretsDir = Join-Path $env:USERPROFILE ".erp-release"
New-Item -ItemType Directory -Path $SecretsDir -Force | Out-Null

function Write-TextUtf8NoBom($p, $c) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($p, $c, $enc)
}
function Read-Plain($secure) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
function Read-NewPassword($label) {
  while ($true) {
    $a = Read-Host "$label" -AsSecureString
    $b = Read-Host "Repite $label" -AsSecureString
    $pa = Read-Plain $a
    if ($pa -ne (Read-Plain $b)) { Write-Host "No coinciden, intenta otra vez."; continue }
    if ($pa.Length -lt 8) { Write-Host "Minimo 8 caracteres."; continue }
    if ($pa -match '\\') { Write-Host "Sin barra invertida (\), Gradle no la lee bien."; continue }
    return $a
  }
}

if ($Part -eq 'keystore') {
  $storeFile = Join-Path $SecretsDir "erp-release.keystore"
  $jsonFile = Join-Path $SecretsDir "android-signing.json"
  if (Test-Path $storeFile) {
    throw "Ya existe $storeFile. No se sobreescribe: cambiar la keystore obliga a desinstalar las apps otra vez."
  }

  $keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
  if (-not $env:JAVA_HOME -or -not (Test-Path $keytool)) {
    $jdk = Get-ChildItem "C:\Program Files\Microsoft" -Directory -Filter "jdk-17*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
    if (-not $jdk) { throw "No se encontro keytool (instala el JDK 17)" }
    $keytool = Join-Path $jdk.FullName "bin\keytool.exe"
  }

  $alias = "erp-release"
  $secure = Read-NewPassword "Clave de la keystore"
  $plain = Read-Plain $secure
  # PKCS12: la clave del alias es la misma que la del almacen.
  & $keytool -genkeypair -v -storetype PKCS12 -keystore $storeFile -alias $alias `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -dname "CN=ERP-aio, O=Grit, C=PE" -storepass $plain -keypass $plain
  if ($LASTEXITCODE -ne 0) { throw "keytool fallo" }

  $encrypted = ConvertFrom-SecureString $secure
  $json = @{
    storeFile     = $storeFile
    storePassword = $encrypted
    keyAlias      = $alias
    keyPassword   = $encrypted
  } | ConvertTo-Json
  Write-TextUtf8NoBom $jsonFile $json
  Write-Host ""
  Write-Host "Keystore creada: $storeFile"
  Write-Host "IMPORTANTE: copia ese archivo y su clave a un lugar seguro (fuera de esta PC)."
  Write-Host "El primer APK firmado con ella obliga a desinstalar la app una ultima vez."
}

if ($Part -eq 'upload') {
  $jsonFile = Join-Path $SecretsDir "upload.json"
  $defaultApi = ""
  $defaultAppId = ""
  $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
  if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
      if ($line -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)$') { $defaultApi = $Matches[1].Trim() }
      if ($line -match '^\s*EXPO_PUBLIC_APP_ID\s*=\s*(.+)$') { $defaultAppId = $Matches[1].Trim() }
    }
  }
  $apiUrl = Read-Host "URL del API [$defaultApi]"
  if ([string]::IsNullOrWhiteSpace($apiUrl)) { $apiUrl = $defaultApi }
  $appId = Read-Host "X-App-Id del admin [$defaultAppId]"
  if ([string]::IsNullOrWhiteSpace($appId)) { $appId = $defaultAppId }
  if ([string]::IsNullOrWhiteSpace($apiUrl) -or [string]::IsNullOrWhiteSpace($appId)) {
    throw "Faltan la URL del API o el X-App-Id"
  }
  $email = Read-Host "Email del usuario con permiso app_releases.upload"
  $password = Read-Host "Clave de ese usuario" -AsSecureString

  $json = @{
    apiUrl   = $apiUrl.TrimEnd('/')
    appId    = $appId
    email    = $email
    password = (ConvertFrom-SecureString $password)
  } | ConvertTo-Json
  Write-TextUtf8NoBom $jsonFile $json
  Write-Host "Guardado en $jsonFile (clave cifrada para este usuario de Windows)."
}
