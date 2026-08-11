$files = @(
  'src/screens/Sales/SalesScreen.tsx',
  'src/screens/Sales/SaleDetailScreen.tsx',
  'src/screens/Sales/CreateSaleScreen.tsx',
  'src/screens/Sales/RegisterSalePaymentScreen.tsx',
  'src/screens/Sales/SessionsManagementScreen.tsx',
  'src/screens/CashReconciliation/CashReconciliationMenuScreen.tsx',
  'src/screens/CashReconciliation/CuadreScreen.tsx',
  'src/screens/CashReconciliation/RecaudoEfectivoScreen.tsx',
  'src/screens/CashReconciliation/ReviewDocumentsMenuScreen.tsx',
  'src/screens/CashReconciliation/ReviewIzipayScreen.tsx',
  'src/screens/CashReconciliation/ReviewProsegurScreen.tsx',
  'src/screens/CashReconciliation/ReviewSalesScreen.tsx',
  'src/screens/CashReconciliation/SeriesConfigScreen.tsx',
  'src/screens/CashReconciliation/UploadCashReconciliationFilesScreen.tsx',
  'src/screens/CashReconciliation/UploadedFilesListScreen.tsx',
  'src/screens/CashRegisters/CashRegistersScreen.tsx',
  'src/screens/CashRegisters/CreateCashRegisterScreen.tsx',
  'src/screens/CashRegisters/EditCashRegisterScreen.tsx'
)
foreach ($f in $files) {
  if (!(Test-Path $f)) { Write-Host ('MISSING ' + $f); continue }
  $legacy = (Select-String -Path $f -Pattern 'colors\.|spacing\[|borderRadius\.|shadows\.|fontSizes\.|fontWeights\.|fontSizes\[|fontWeights\[' | Measure-Object).Count
  $hex    = (Select-String -Path $f -Pattern "'#[0-9a-fA-F]" | Measure-Object).Count
  $rgba   = (Select-String -Path $f -Pattern 'rgba\(' | Measure-Object).Count
  $themed = (Select-String -Path $f -Pattern 'useThemedStyles' | Measure-Object).Count
  $name   = Split-Path $f -Leaf
  "{0,-50} legacy={1,-3} hex={2,-3} rgba={3,-3} themed={4}" -f $name, $legacy, $hex, $rgba, $themed
}
