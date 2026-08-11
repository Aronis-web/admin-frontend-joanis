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
  $tokens = (Select-String -Path $f -Pattern '(colors|spacing|borderRadius|shadows|typography)' | Measure-Object).Count
  $hex = (Select-String -Path $f -Pattern '#[0-9a-fA-F]{3,8}' | Measure-Object).Count
  $rgba = (Select-String -Path $f -Pattern 'rgba\(' | Measure-Object).Count
  $name = Split-Path $f -Leaf
  "{0,-50}  tokens={1,-5} hex={2,-5} rgba={3}" -f $name, $tokens, $hex, $rgba
}
