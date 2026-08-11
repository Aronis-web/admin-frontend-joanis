$ErrorActionPreference = 'Stop'
$auth = Get-Content auth.json -Raw | ConvertFrom-Json
$token = $auth.accessToken
$userId = $auth.user.id
$base = 'https://api.app-joanis-backend.com'

# ============== FIXED IDS ==============
$COMPANY_ID    = 'cf894123-13ae-4a14-9efe-c480622f841c'  # Grit Labs (INTERNAL)
$ORIGIN_SITE   = 'd56d265c-490f-4ac5-a4fa-d224fe4abdc8'  # ALMACEN (Almacen principal)
$ORIGIN_WH     = '1d4e4c9b-cf65-40f6-a3dd-20060eaf93c7'  # Almacen Principal CD
$DEST_SITE     = 'e1a57f3d-0ed2-4087-ad5c-1c1d0c8452e3'  # ADMINISTRATIVOS
$DEST_WH       = '2b65c2d7-c71d-4622-954c-f375658c464b'  # Insumos (ADMINISTRATIVOS)
$ORIGIN_AREA   = '30e76e79-4c0c-44cf-968c-8775d19de202'  # JUGUETES (origin)
$DEST_AREA     = 'c7daecd7-821c-4c80-a9e5-fefea84b5619'  # INSUMOS (destination)
$SUPPLIER_ID   = 'b85608ca-a33a-42d9-b906-998b7d6dbf7b'  # YIWU CENTER

function MkHeaders([hashtable]$extra=@{}) {
  $h = @{
    'Authorization' = "Bearer $token"
    'X-App-Id'      = 'e28208b8-89b4-4682-80dc-925059424b1f'
    'X-User-Id'     = $userId
    'X-Company-Id'  = $COMPANY_ID
    'X-Site-Id'     = $ORIGIN_SITE
    'X-Warehouse-Id'= $ORIGIN_WH
    'Content-Type'  = 'application/json'
  }
  foreach ($k in $extra.Keys) { $h[$k] = $extra[$k] }
  return $h
}

function Call($method, $path, $body=$null, $extraHeaders=@{}) {
  $url = "$base$path"
  Write-Host ">>> $method $path" -ForegroundColor Cyan
  $params = @{
    Uri = $url
    Method = $method
    Headers = (MkHeaders $extraHeaders)
  }
  if ($body -ne $null) {
    $json = $body | ConvertTo-Json -Depth 10 -Compress
    $params['Body'] = $json
    Write-Host "    body: $json" -ForegroundColor DarkGray
  }
  try {
    $r = Invoke-RestMethod @params
    return $r
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $txt = $reader.ReadToEnd()
      Write-Host "!!! ERROR $($resp.StatusCode.value__): $txt" -ForegroundColor Red
    } else {
      Write-Host "!!! ERROR $($_.Exception.Message)" -ForegroundColor Red
    }
    throw
  }
}

# ============================================
# STEP 1: Create purchase
# ============================================
Write-Host "`n===== STEP 1: Create test purchase =====" -ForegroundColor Yellow
$today = (Get-Date).ToString('yyyy-MM-dd')
$stamp = (Get-Date).ToString('yyyyMMddHHmmss')
$purchase = Call 'POST' '/admin/purchases' @{
  supplierId  = $SUPPLIER_ID
  guideNumber = "F001-TEST-$stamp"
  guideType   = 'FACTURA'
  guideDate   = $today
  notes       = 'E2E test transfer flow (ship = move stock)'
}
$PURCHASE_ID = $purchase.id
Write-Host "Purchase created: $PURCHASE_ID  status=$($purchase.status)" -ForegroundColor Green

# ============================================
# STEP 2: Add product to purchase
# ============================================
Write-Host "`n===== STEP 2: Add product =====" -ForegroundColor Yellow
$sku = "TEST-TRANSFER-$stamp"
$product = Call 'POST' "/admin/purchases/$PURCHASE_ID/products" @{
  sku              = $sku
  name             = "Producto E2E Traslado $stamp"
  costCents        = 1500        # S/. 15.00
  preliminaryStock = 10
}
$PP_ID = $product.id
Write-Host "Purchase product created: $PP_ID (sku=$sku)" -ForegroundColor Green

# ============================================
# STEP 3: Start validation
# ============================================
Write-Host "`n===== STEP 3: Start validation =====" -ForegroundColor Yellow
$product = Call 'POST' "/admin/purchases/$PURCHASE_ID/products/$PP_ID/start-validation" @{}
Write-Host "Validation started. status=$($product.status)" -ForegroundColor Green

# ============================================
# STEP 4: Validate product (creates real stock in origin warehouse)
# ============================================
Write-Host "`n===== STEP 4: Validate product (creates stock) =====" -ForegroundColor Yellow
$validated = Call 'PATCH' "/admin/purchases/$PURCHASE_ID/products/$PP_ID/validate-v2" @{
  sku              = $sku
  name             = "Producto E2E Traslado $stamp"
  costCents        = 1500
  preliminaryStock = 10
  validatedStock   = 10
  warehouseId      = $ORIGIN_WH
  areaId           = $ORIGIN_AREA
  weightKg         = 0.5
  validationNotes  = 'E2E'
  recurrenceAction = 'CREATE_NEW'
}
Write-Host "Validated. response:" -ForegroundColor Green
$validated | ConvertTo-Json -Depth 4

# Save state
@{
  purchaseId = $PURCHASE_ID
  purchaseProductId = $PP_ID
  sku = $sku
  productId = $validated.productId
  validated = $validated
} | ConvertTo-Json -Depth 8 | Out-File 'e2e-state.json' -Encoding utf8

Write-Host "`n===== State saved to e2e-state.json =====" -ForegroundColor Green
