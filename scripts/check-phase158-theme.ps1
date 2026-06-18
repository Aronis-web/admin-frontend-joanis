param([string]$Dir)
Get-ChildItem "src/screens/$Dir/*.tsx" | ForEach-Object {
  $c = Get-Content $_.FullName -Raw
  $lines = ($c -split "`n").Count
  $hex = ([regex]::Matches($c, '#[0-9A-Fa-f]{3,8}')).Count
  $tokens = ([regex]::Matches($c, 'colors\.|typography\.|spacing\.|radius\.|shadows\.')).Count
  Write-Host ('{0,-46} {1,5} lines  hex={2,3}  tokens={3,3}' -f $_.Name, $lines, $hex, $tokens)
}
