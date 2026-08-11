$files = @(
  'src/screens/Sales/SalesScreen.tsx',
  'src/screens/Sales/SaleDetailScreen.tsx',
  'src/screens/Sales/CreateSaleScreen.tsx',
  'src/screens/CashReconciliation/CuadreScreen.tsx',
  'src/screens/CashReconciliation/ReviewIzipayScreen.tsx',
  'src/screens/CashReconciliation/ReviewProsegurScreen.tsx',
  'src/screens/CashReconciliation/ReviewSalesScreen.tsx',
  'src/screens/CashReconciliation/UploadCashReconciliationFilesScreen.tsx',
  'src/screens/CashReconciliation/UploadedFilesListScreen.tsx'
)
foreach ($f in $files) {
  if (!(Test-Path $f)) { Write-Host ('MISSING ' + $f); continue }
  $lines = (Get-Content $f | Measure-Object -Line).Lines
  $legacy = (Select-String -Path $f -Pattern 'colors\.|spacing\[|borderRadius\.|shadows\.|fontSizes|fontWeights' | Measure-Object).Count
  $hex = (Select-String -Path $f -Pattern "'#[0-9a-fA-F]" | Measure-Object).Count
  $themed = (Select-String -Path $f -Pattern 'useThemedStyles|useTheme' | Measure-Object).Count
  Write-Host ("{0,-58} lines={1,5} legacy={2,4} hex={3,3} themed={4}" -f (Split-Path $f -Leaf), $lines, $legacy, $hex, $themed)
}
