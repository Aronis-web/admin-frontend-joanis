$paths = @(
    'src/screens/Users/UsersScreen.tsx',
    'src/screens/Sites/SitesScreen.tsx',
    'src/screens/Companies/CompaniesScreen.tsx',
    'src/screens/Companies/CompanyDetailScreen.tsx',
    'src/screens/Warehouses/WarehousesScreen.tsx',
    'src/screens/Warehouses/WarehouseAreasScreen.tsx',
    'src/screens/Organization/OrganizationChartScreen.tsx',
    'src/screens/AppVersions/AppVersionsScreen.tsx',
    'src/screens/Customers/CustomersScreen.tsx',
    'src/screens/Customers/CustomerDetailScreen.tsx'
)
foreach ($p in $paths) {
    if (-not (Test-Path $p)) { Write-Output ("MISSING: " + $p); continue }
    $c = Get-Content $p -Raw
    $colors = ([regex]::Matches($c,'colors\.')).Count
    $shadows = ([regex]::Matches($c,'shadows\.')).Count
    $hex = ([regex]::Matches($c,'#[0-9A-Fa-f]{3,8}')).Count
    $useT = ([regex]::Matches($c,'useTheme')).Count
    $useTS = ([regex]::Matches($c,'useThemedStyles')).Count
    $ss = ([regex]::Matches($c,'StyleSheet\.create')).Count
    $size = [math]::Round((Get-Item $p).Length/1KB, 1)
    Write-Output ("{0,6} KB  colors={1,4}  shadows={2,3}  hex={3,4}  useTheme={4}  useTS={5}  SS={6}  {7}" -f $size, $colors, $shadows, $hex, $useT, $useTS, $ss, $p)
}
