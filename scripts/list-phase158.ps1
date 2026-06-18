$dirs = @(
  'src/screens/Transfers',
  'src/screens/Treasury',
  'src/screens/BankAccounts',
  'src/screens/Balances',
  'src/screens/AccountsPayable',
  'src/screens/AccountsReceivable'
)
foreach ($d in $dirs) {
  if (Test-Path $d) {
    Get-ChildItem -Path $d -Filter *.tsx -Recurse | Sort-Object Length | ForEach-Object {
      $rel = $_.FullName.Replace((Get-Location).Path + '\', '').Replace('\', '/')
      $c = Get-Content $_.FullName -Raw
      $hex = ([regex]::Matches($c, '#[0-9A-Fa-f]{6}')).Count
      $tok = ([regex]::Matches($c, '(colors|typography|spacing|radius|shadows)\.')).Count
      $usesTheme = $c -match 'useThemedStyles|useTheme\('
      $flag = if ($usesTheme) { 'OK ' } else { 'TODO' }
      '{0} {1,7} hex={2,4} tok={3,4} {4}' -f $flag, $_.Length, $hex, $tok, $rel
    }
  }
}
