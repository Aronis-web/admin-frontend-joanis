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

$PURCHASE_ID = $state.purchaseId
$PP_ID       = $state.purchaseProductId
$PRODUCT_ID  = $state.productId
Write-Host "Resuming state: purchase=$PURCHASE_ID product=$PRODUCT_ID" -ForegroundColor Cyan

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
  try {
    return Invoke-RestMethod @params
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $stream = $resp.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream)
      $txt = $reader.ReadToEnd()
      Write-Host "!!! ERROR $($resp.StatusCode.value__): $txt" -ForegroundColor Red
    } else { Write-Host "!!! ERROR $($_.Exception.Message)" -ForegroundColor Red }
    throw
  }
}

# ============================================
# STEP 5: Close validation for the product line
# ============================================
Write-Host "`n===== STEP 5: Close validation =====" -ForegroundColor Yellow
try {
  $closed = Call 'POST' "/admin/purchases/$PURCHASE_ID/products/$PP_ID/close-validation"
  Write-Host "Product closed. status=$($closed.status)" -ForegroundColor Green
} catch { Write-Host "close-validation failed (maybe already closed)" -ForegroundColor DarkYellow }

# ============================================
# STEP 6: Verify stock in origin BEFORE any transfer
# ============================================
Write-Host "`n===== STEP 6: Verify stock in origin (pre-transfer) =====" -ForegroundColor Yellow
try {
  $movs = Call 'GET' "/stock-movements/product/$PRODUCT_ID"
  Write-Host "Stock movements count: $($movs.Count)" -ForegroundColor Green
  $movs | Select-Object movementType,quantity,warehouseId,createdAt | ConvertTo-Json -Depth 4
} catch { Write-Host "err movements" -ForegroundColor Yellow }

# ============================================
# STEP 7: Create administrative-only campaign
# ============================================
Write-Host "`n===== STEP 7: Create/Reuse campaign =====" -ForegroundColor Yellow
if ($state.campaignId) {
  $CAMPAIGN_ID = $state.campaignId
  Write-Host "Reusing campaign: $CAMPAIGN_ID" -ForegroundColor Green
} else {
  $stamp = (Get-Date).ToString('yyyyMMddHHmmss')
  $campaign = Call 'POST' '/admin/campaigns' @{
    name        = "E2E Campaign Admin $stamp"
    description = 'E2E test - administrative only transfer flow validation'
    startDate   = (Get-Date).ToString('yyyy-MM-dd')
    endDate     = (Get-Date).AddDays(30).ToString('yyyy-MM-dd')
  }
  $CAMPAIGN_ID = $campaign.id
  Write-Host "Campaign created: $CAMPAIGN_ID  status=$($campaign.status)" -ForegroundColor Green
}

# ============================================
# STEP 8: Add ONLY administrative site as participant
# ============================================
Write-Host "`n===== STEP 8: Add administrative participant =====" -ForegroundColor Yellow
$participant = Call 'POST' "/admin/campaigns/$CAMPAIGN_ID/participants" @{
  participantType = 'INTERNAL_SITE'
  siteId          = $DEST_SITE
  assignedAmount  = 15000
  currency        = 'PEN'
}
$PARTICIPANT_ID = $participant.id
Write-Host "Participant added: $PARTICIPANT_ID" -ForegroundColor Green

# ============================================
# STEP 9: Add validated product to campaign
# ============================================
Write-Host "`n===== STEP 9: Add product to campaign =====" -ForegroundColor Yellow
try {
  $campProduct = Call 'POST' "/admin/campaigns/$CAMPAIGN_ID/products" @{
    productId        = $PRODUCT_ID
    sourceType       = 'PURCHASE'
    totalQuantity    = 10
    productStatus    = 'ACTIVE'
    distributionType = 'INTERNAL_ONLY'
    purchaseId       = $PURCHASE_ID
  }
  Write-Host "Product added to campaign: $($campProduct.id)" -ForegroundColor Green
} catch { Write-Host "add product err" -ForegroundColor Red }

@{
  campaignId    = $CAMPAIGN_ID
  participantId = $PARTICIPANT_ID
  purchaseId    = $PURCHASE_ID
  productId     = $PRODUCT_ID
  purchaseProductId = $PP_ID
} | ConvertTo-Json -Depth 6 | Out-File 'e2e-state.json' -Encoding utf8
Write-Host "`n===== State updated (campaign) =====" -ForegroundColor Green
