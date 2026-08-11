$dirs = @('Expenses','BankAccounts','Balances','Transfers','Treasury','AccountsPayable','AccountsReceivable')
foreach ($d in $dirs) {
  Get-ChildItem "src/screens/$d/*.tsx" -ErrorAction SilentlyContinue | ForEach-Object {
    $c = Get-Content $_.FullName -Raw
    $hex = ([regex]::Matches($c, '#[0-9A-Fa-f]{3,8}')).Count
    $tk = ([regex]::Matches($c, 'colors\.|typography\.|spacing\.|radius\.|shadows\.')).Count
    if ($hex + $tk -gt 0) {
      Write-Host ('{0,-60} hex={1,3}  tokens={2,3}' -f ($d + '/' + $_.Name), $hex, $tk)
    }
  }
}
