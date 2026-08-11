$ErrorActionPreference = 'Stop'
$base = 'https://api.app-joanis-backend.com'
$appId = 'e28208b8-89b4-4682-80dc-925059424b1f'

$body = @{ email = 'admin@example.com'; password = 'Hola4321' } | ConvertTo-Json
$headers = @{ 'X-App-Id' = $appId; 'Content-Type' = 'application/json' }

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $body -Headers $headers
$token = $login.accessToken
Write-Host "Login OK - user: $($login.user.email) - id: $($login.user.id)"

$global:H = @{
  'Authorization' = "Bearer $token"
  'X-App-Id' = $appId
  'X-User-Id' = $login.user.id
  'Content-Type' = 'application/json'
}

$login | ConvertTo-Json -Depth 8 | Out-File auth.json -Encoding utf8
Write-Host "Companies:" 
$login.user.companies | ForEach-Object { Write-Host "  $($_.id) - $($_.name)" }
