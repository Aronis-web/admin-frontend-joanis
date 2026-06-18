$p = 'src/screens/CashReconciliation/ReviewProsegurScreen.tsx'
$c = Get-Content -Raw $p

# Skip first occurrence of each (the module-level constant declaration)
$first = $true
$c = [regex]::Replace($c, "'#8B5CF6'", {
  param($m)
  if ($script:first) { $script:first = $false; return "'#8B5CF6'" }
  return 'PROSEGUR_BRAND'
})

$firstSoft = $true
$c = [regex]::Replace($c, "'#F3E8FF'", {
  param($m)
  if ($script:firstSoft) { $script:firstSoft = $false; return "'#F3E8FF'" }
  return 'PROSEGUR_BRAND_SOFT'
})

$c = $c -replace "'rgba\(0, 0, 0, 0\.5\)'", 'theme.color.overlay.medium'
$c = $c -replace 'const styles = StyleSheet\.create\(\{', 'const createStyles = (theme: Theme) => StyleSheet.create({'

Set-Content -Path $p -Value $c -NoNewline
Write-Host 'Done'
