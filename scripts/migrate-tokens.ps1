param([Parameter(Mandatory=$true)][string]$Path)

if (-not (Test-Path $Path)) { Write-Error "File not found: $Path"; exit 1 }

$c = Get-Content -Raw -Path $Path

# ---------- fontSizes ----------
$c = $c -replace "fontSizes\['2xs'\]", '10'
$c = $c -replace "fontSizes\['2xl'\]", '24'
$c = $c -replace "fontSizes\['3xl'\]", '28'
$c = $c -replace "fontSizes\['4xl'\]", '32'
$c = $c -replace "fontSizes\['5xl'\]", '40'
$c = $c -replace 'fontSizes\.xs\b',   '12'
$c = $c -replace 'fontSizes\.sm\b',   '14'
$c = $c -replace 'fontSizes\.base\b', '16'
$c = $c -replace 'fontSizes\.lg\b',   '18'
$c = $c -replace 'fontSizes\.xl\b',   '20'

# ---------- fontWeights ----------
$c = $c -replace 'fontWeights\.regular\b',    "'400'"
$c = $c -replace 'fontWeights\.medium\b',     "'500'"
$c = $c -replace 'fontWeights\.semibold\b',   "'600'"
$c = $c -replace 'fontWeights\.bold\b',       "'700'"
$c = $c -replace 'fontWeights\.extrabold\b',  "'800'"

# ---------- spacing ----------
$c = $c -replace 'spacing\[(\d+)\]', 'theme.space[$1]'

# ---------- borderRadius ----------
$c = $c -replace "borderRadius\['2xl'\]", "theme.radii['2xl']"
$c = $c -replace "borderRadius\['3xl'\]", "theme.radii['3xl']"
$c = $c -replace 'borderRadius\.(none|sm|md|lg|xl|full)\b', 'theme.radii.$1'

# ---------- shadows ----------
$c = $c -replace 'shadows\.(none|xs|sm|md|lg|xl)\b', 'theme.shadow.$1'

# ---------- colors.neutral ----------
$c = $c -replace 'colors\.neutral\[0\]',   'theme.color.surface.base'
$c = $c -replace 'colors\.neutral\[50\]',  'theme.color.background.subtle'
$c = $c -replace 'colors\.neutral\[100\]', 'theme.color.background.muted'
$c = $c -replace 'colors\.neutral\[200\]', 'theme.color.border.subtle'
$c = $c -replace 'colors\.neutral\[300\]', 'theme.color.border.default'
$c = $c -replace 'colors\.neutral\[400\]', 'theme.color.text.placeholder'
$c = $c -replace 'colors\.neutral\[500\]', 'theme.color.text.subtle'
$c = $c -replace 'colors\.neutral\[600\]', 'theme.color.text.muted'
$c = $c -replace 'colors\.neutral\[700\]', 'theme.color.text.body'
$c = $c -replace 'colors\.neutral\[800\]', 'theme.color.text.heading'
$c = $c -replace 'colors\.neutral\[900\]', 'theme.color.text.heading'

# ---------- colors.primary ----------
$c = $c -replace 'colors\.primary\[(50|100|200)\]',     'theme.color.brand.primarySoft'
$c = $c -replace 'colors\.primary\[(300|400|500|600|700|800|900)\]', 'theme.color.brand.primary'

# ---------- colors.accent ----------
$c = $c -replace 'colors\.accent\[(50|100|200|300)\]',  'theme.color.brand.accentSoft'
$c = $c -replace 'colors\.accent\[(400|500|600|700|800|900)\]',      'theme.color.brand.accent'

# ---------- colors.success ----------
$c = $c -replace 'colors\.success\[(50|100)\]',                       'theme.color.state.success.background'
$c = $c -replace 'colors\.success\[(200|300|400|500|600)\]',          'theme.color.state.success.border'
$c = $c -replace 'colors\.success\[(700|800|900)\]',                  'theme.color.state.success.text'

# ---------- colors.warning ----------
$c = $c -replace 'colors\.warning\[(50|100)\]',                       'theme.color.state.warning.background'
$c = $c -replace 'colors\.warning\[(200|300|400|500|600)\]',          'theme.color.state.warning.border'
$c = $c -replace 'colors\.warning\[(700|800|900)\]',                  'theme.color.state.warning.text'

# ---------- colors.danger ----------
$c = $c -replace 'colors\.danger\[(50|100)\]',                        'theme.color.state.danger.background'
$c = $c -replace 'colors\.danger\[(200|300|400|500|600)\]',           'theme.color.state.danger.border'
$c = $c -replace 'colors\.danger\[(700|800|900)\]',                   'theme.color.state.danger.text'

# ---------- colors.info ----------
$c = $c -replace 'colors\.info\[(50|100)\]',                          'theme.color.state.info.background'
$c = $c -replace 'colors\.info\[(200|300|400|500|600)\]',             'theme.color.state.info.border'
$c = $c -replace 'colors\.info\[(700|800|900)\]',                     'theme.color.state.info.text'

Set-Content -Path $Path -Value $c -NoNewline
Write-Host "Migrated: $Path"
