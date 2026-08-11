$ErrorActionPreference = 'Stop'
$auth = Get-Content auth.json -Raw | ConvertFrom-Json
$token = $auth.accessToken
$base = 'https://api.app-joanis-backend.com'
$PRODUCT_ID = 'e62ec851-f40b-4adf-8905-5b89ead87488'
$DEST_WH   = '2b65c2d7-c71d-4622-954c-f375658c464b'
$ORIGIN_WH = '1d4e4c9b-cf65-40f6-a3dd-20060eaf93c7'

$H = @{
  'Authorization' = "Bearer $token"
  'X-App-Id' = 'e28208b8-89b4-4682-80dc-925059424b1f'
  'X-User-Id' = $auth.user.id
  'X-Company-Id' = 'cf894123-13ae-4a14-9efe-c480622f841c'
  'X-Site-Id' = 'd56d265c-490f-4ac5-a4fa-d224fe4abdc8'
  'X-Warehouse-Id' = $ORIGIN_WH
  'Content-Type' = 'application/json'
}

Write-Host '=== ORIGIN stock ===' -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "$base/inventory/stock/product/$PRODUCT_ID" -Headers $H
"origin qty: $($r.quantityBase)"
"origin available: $($r.availableQuantityBase)"

# Now try lots at destination
Write-Host "`n=== Try lot endpoints for cost verification ===" -ForegroundColor Yellow

# Try stock/lots endpoints
foreach ($path in @(
  "/stock/product/$PRODUCT_ID",
  "/inventory/stock/product/$PRODUCT_ID",
  "/stock-lots/product/$PRODUCT_ID",
  "/inventory/lots/product/$PRODUCT_ID",
  "/inventory/product/$PRODUCT_ID/lots",
  "/products/$PRODUCT_ID/stock"
)) {
  try {
    Write-Host "=== $path ===" -ForegroundColor Yellow
    $r = Invoke-RestMethod -Uri "$base$path" -Headers $H
    $r | ConvertTo-Json -Depth 6 | Out-String | Write-Host
    Write-Host ""
    break
  } catch { Write-Host "  404/err: $($_.Exception.Message)" -ForegroundColor DarkYellow }
}
