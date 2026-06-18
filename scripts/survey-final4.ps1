$files = @(
  'src/screens/CashReconciliation/ReviewIzipayScreen.tsx',
  'src/screens/CashReconciliation/ReviewProsegurScreen.tsx',
  'src/screens/CashReconciliation/ReviewSalesScreen.tsx',
  'src/screens/CashReconciliation/UploadedFilesListScreen.tsx'
)
foreach ($f in $files) {
  if (Test-Path $f) {
    $lines  = (Get-Content $f).Length
    $tokens = (Select-String -Path $f -Pattern 'colors\.|spacing\[|borderRadius\.|shadows\.|fontSizes\.|fontWeights\.' | Measure-Object).Count
    $hex    = (Select-String -Path $f -Pattern "'#[0-9a-fA-F]" | Measure-Object).Count
    $rgba   = (Select-String -Path $f -Pattern 'rgba\(' | Measure-Object).Count
    Write-Host ("{0} LOC={1} tokens={2} hex={3} rgba={4}" -f $f, $lines, $tokens, $hex, $rgba)
  } else {
    Write-Host "$f NOT FOUND"
  }
}
