$ErrorActionPreference = 'Stop'
$auth  = Get-Content auth.json      -Raw | ConvertFrom-Json
$state = Get-Content e2e-state.json -Raw | ConvertFrom-Json
$token = $auth.accessToken
$userId = $auth.user.id
$base = 'https://api.app-joanis-backend.com'

$COMPANY_ID    = 'cf894123-13ae-4a14-9efe-c480622f841c'
$ORIGIN_SITE   = 'd56d265c-490f-4ac5-a4fa-d224fe4abdc8'
$ORIGIN_WH     = '1d4e4c9b-cf65-40f6-a3dd-20060eaf93c7'
$DEST_SITE     = 'e1a57f3d-0ed2-4087-ad5c-1c1d0c8452e3'
$DEST_WH       = '2b65c2d7-c71d-4622-954c-f375658c464b'
$ORIGIN_AREA   = '30e76e79-4c0c-44cf-968c-8775d19de202'
$DEST_AREA     = 'c7daecd7-821c-4c80-a9e5-fefea84b5619'

$PRODUCT_ID = $state.productId
Write-Host "Product: $PRODUCT_ID" -ForegroundColor Cyan

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
  $params = @{ Uri = $url; Method = $method; Headers = (MkHeaders $extraHeaders) }
  if ($body -ne $null) {
    $json = $body | ConvertTo-Json -Depth 10 -Compress
    $params['Body'] = $json
    Write-Host "    body: $json" -ForegroundColor DarkGray
  }
  try { return Invoke-RestMethod @params }
  catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $stream = $resp.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream)
      Write-Host "!!! ERROR $($resp.StatusCode.value__): $($reader.ReadToEnd())" -ForegroundColor Red
    } else { Write-Host "!!! ERROR $($_.Exception.Message)" -ForegroundColor Red }
    throw
  }
}

function GetMovements() {
  try {
    $r = Call 'GET' "/transfers/stock-movements/product/$PRODUCT_ID?limit=100"
    return $r
  } catch { return @() }
}

function DumpMovs($movs, $label) {
  Write-Host "`n--- Stock movements: $label ---" -ForegroundColor Magenta
  if ($movs.Count -eq 0) { Write-Host "  (none)"; return }
  $movs | Sort-Object createdAt | ForEach-Object {
    $wh = if ($_.warehouseId -eq $ORIGIN_WH) { 'ORIGIN' } elseif ($_.warehouseId -eq $DEST_WH) { 'DEST' } else { $_.warehouseId }
    $cost = $_.unitCostCents
    Write-Host ("  {0,-22} qty={1,4}  cost={2,-6}  wh={3}  {4}" -f $_.movementType, $_.quantity, $cost, $wh, $_.createdAt)
  }
}

# ============================================
# STEP 10: Baseline stock movements
# ============================================
Write-Host "`n===== STEP 10: Baseline movements (should have 1 PURCHASE) =====" -ForegroundColor Yellow
$baseline = GetMovements
DumpMovs $baseline 'BASELINE (after purchase validate)'

# ============================================
# STEP 11: Create external transfer (ALMACEN -> ADMINISTRATIVOS)
# ============================================
Write-Host "`n===== STEP 11: Create external transfer =====" -ForegroundColor Yellow
$transfer = Call 'POST' '/transfers/external' @{
  originWarehouseId      = $ORIGIN_WH
  originAreaId           = $ORIGIN_AREA
  destinationWarehouseId = $DEST_WH
  destinationAreaId      = $DEST_AREA
  requestedBy            = $userId
  expectedArrivalDate    = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
  items                  = @( @{ productId = $PRODUCT_ID; quantity = 6 } )
  notes                  = 'E2E test - external transfer with new ship semantics'
}
$TRANSFER_ID = $transfer.id
Write-Host "Transfer created: $TRANSFER_ID  status=$($transfer.status) transferNumber=$($transfer.transferNumber)" -ForegroundColor Green
Write-Host "Items:" -ForegroundColor Green
$transfer.items | ConvertTo-Json -Depth 5

$firstItem = $transfer.items[0]
$TRANSFER_ITEM_ID = $firstItem.id

# ============================================
# STEP 12: Approve transfer
# ============================================
Write-Host "`n===== STEP 12: Approve transfer =====" -ForegroundColor Yellow
$approved = Call 'POST' "/transfers/$TRANSFER_ID/approve" @{ approvedBy = $userId }
Write-Host "Approved. status=$($approved.status)" -ForegroundColor Green

# ============================================
# STEP 13: Stock BEFORE ship
# ============================================
Write-Host "`n===== STEP 13: Movements BEFORE ship =====" -ForegroundColor Yellow
$preShip = GetMovements
DumpMovs $preShip 'BEFORE SHIP (should only have PURCHASE)'

# ============================================
# STEP 14: Ship transfer  ==> NEW FLOW: stock moves origin->dest with real cost NOW
# ============================================
Write-Host "`n===== STEP 14: Ship transfer (NEW: stock moves NOW) =====" -ForegroundColor Yellow
$shipped = Call 'POST' "/transfers/$TRANSFER_ID/ship" @{
  items = @(@{ transferItemId = $TRANSFER_ITEM_ID; quantityShipped = 6 })
  shippingNotes = 'E2E ship'
}
Write-Host "Shipped. status=$($shipped.status)" -ForegroundColor Green

# ============================================
# STEP 15: Stock RIGHT AFTER ship (should show TRANSFER_OUT + TRANSFER_IN with real cost)
# ============================================
Write-Host "`n===== STEP 15: Movements AFTER ship (KEY TEST) =====" -ForegroundColor Yellow
$postShip = GetMovements
DumpMovs $postShip 'AFTER SHIP'
$outMov = $postShip | Where-Object { $_.movementType -like '*TRANSFER_OUT*' -and $_.warehouseId -eq $ORIGIN_WH }
$inMov  = $postShip | Where-Object { $_.movementType -like '*TRANSFER_IN*'  -and $_.warehouseId -eq $DEST_WH }
Write-Host "`n>>> ASSERTION 1: TRANSFER_OUT in ORIGIN exists = $($outMov -ne $null)" -ForegroundColor $(if ($outMov) { 'Green' } else { 'Red' })
Write-Host ">>> ASSERTION 2: TRANSFER_IN in DEST exists   = $($inMov -ne $null)" -ForegroundColor $(if ($inMov) { 'Green' } else { 'Red' })
if ($inMov) {
  $c = $inMov.unitCostCents
  Write-Host ">>> ASSERTION 3: TRANSFER_IN cost = $c cents (expected 1500, NOT 0)" -ForegroundColor $(if ($c -eq 1500) { 'Green' } else { 'Red' })
}

# Save
@{ transferId = $TRANSFER_ID; transferItemId = $TRANSFER_ITEM_ID } | ConvertTo-Json | Out-File 'e2e-transfer.json' -Encoding utf8

# ============================================
# STEP 16: Receive transfer (should NOT move stock)
# ============================================
Write-Host "`n===== STEP 16: Receive transfer (tracking-only) =====" -ForegroundColor Yellow
$received = Call 'POST' "/transfers/$TRANSFER_ID/receive" @{ receivedBy = $userId; notes = 'E2E receive' } @{ 'X-Site-Id' = $DEST_SITE; 'X-Warehouse-Id' = $DEST_WH }
Write-Host "Received. status=$($received.status)" -ForegroundColor Green

# Snapshot movements after receive-open
$postReceive = GetMovements
DumpMovs $postReceive 'AFTER RECEIVE (open)'
$countAfterReceive = $postReceive.Count
$countAfterShip = $postShip.Count
Write-Host ">>> ASSERTION 4: receive did NOT add movements ($countAfterShip -> $countAfterReceive)" -ForegroundColor $(if ($countAfterReceive -eq $countAfterShip) { 'Green' } else { 'Red' })

# ============================================
# STEP 17: Validate items received (still tracking only)
# ============================================
Write-Host "`n===== STEP 17: Validate item received =====" -ForegroundColor Yellow
try {
  $vi = Call 'POST' "/transfers/$TRANSFER_ID/validate-item" @{
    transferItemId    = $TRANSFER_ITEM_ID
    quantityReceived  = 6
    quantityDamaged   = 0
    validatedBy       = $userId
  } @{ 'X-Site-Id' = $DEST_SITE; 'X-Warehouse-Id' = $DEST_WH }
  Write-Host "Item validated. discrepancies:" -ForegroundColor Green
  $vi | ConvertTo-Json -Depth 5
} catch { Write-Host "validate-item err: continuing" -ForegroundColor Yellow }

# ============================================
# STEP 18: Complete reception
# ============================================
Write-Host "`n===== STEP 18: Complete reception =====" -ForegroundColor Yellow
try {
  $done = Call 'POST' "/transfers/$TRANSFER_ID/complete-reception" @{
    receivedBy = $userId
    notes      = 'E2E complete'
  } @{ 'X-Site-Id' = $DEST_SITE; 'X-Warehouse-Id' = $DEST_WH }
  Write-Host "Completed. status=$($done.status)" -ForegroundColor Green
} catch { Write-Host "complete err" -ForegroundColor Yellow }

# Final movements
$final = GetMovements
DumpMovs $final 'FINAL (after complete reception)'
Write-Host "`n>>> ASSERTION 5: no new movements after full reception ($countAfterShip vs $($final.Count))" -ForegroundColor $(if ($final.Count -eq $countAfterShip) { 'Green' } else { 'Red' })

Write-Host "`n========== END E2E ==========" -ForegroundColor Cyan
Write-Host "Purchase:  $($state.purchaseId)"
Write-Host "Campaign:  $($state.campaignId)"
Write-Host "Transfer:  $TRANSFER_ID"
