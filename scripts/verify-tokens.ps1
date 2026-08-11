param([string[]]$Files)
foreach ($f in $Files) {
  $hex = (Select-String -Path $f -Pattern "'#[0-9a-fA-F]{3,8}'" | Measure-Object).Count
  $rgba = (Select-String -Path $f -Pattern 'rgba\(' | Measure-Object).Count
  $oldtok = (Select-String -Path $f -Pattern 'colors\.|spacing\[|borderRadius\.|shadows\.' | Measure-Object).Count
  $name = Split-Path $f -Leaf
  "{0,-55} hex={1,-3} rgba={2,-3} oldtokens={3}" -f $name, $hex, $rgba, $oldtok
}
