$files = @(
    'src/screens/Sales/SalesScreen.tsx',
    'src/screens/Sales/SaleDetailScreen.tsx',
    'src/screens/Sales/CreateSaleScreen.tsx',
    'src/screens/CashReconciliation/CuadreScreen.tsx',
    'src/screens/CashReconciliation/ReviewIzipayScreen.tsx',
    'src/screens/CashReconciliation/ReviewProsegurScreen.tsx',
    'src/screens/CashReconciliation/ReviewSalesScreen.tsx',
    'src/screens/CashReconciliation/UploadedFilesListScreen.tsx'
)
foreach ($f in $files) {
    $legacy = (Select-String -Path $f -Pattern 'colors\.|spacing\[|borderRadius\.|shadows\.|fontSizes|fontWeights' | Measure-Object).Count
    $hex    = (Select-String -Path $f -Pattern "'#[0-9a-fA-F]" | Measure-Object).Count
    $rgba   = (Select-String -Path $f -Pattern 'rgba\(' | Measure-Object).Count
    Write-Host "$f  legacy=$legacy  hex=$hex  rgba=$rgba"
}
