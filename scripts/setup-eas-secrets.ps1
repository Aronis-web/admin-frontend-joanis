# Script para configurar EAS Secrets
# Este script configura las variables de entorno sensibles en EAS de forma segura
# Las variables se almacenan encriptadas en los servidores de Expo

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuración de EAS Secrets" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que el usuario está autenticado en EAS
Write-Host "Verificando autenticación en EAS..." -ForegroundColor Yellow
$easWhoami = eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ No estás autenticado en EAS. Por favor ejecuta:" -ForegroundColor Red
    Write-Host "   eas login" -ForegroundColor White
    exit 1
}
Write-Host "✅ Autenticado como: $easWhoami" -ForegroundColor Green
Write-Host ""

# Leer variables del archivo .env
Write-Host "Leyendo variables del archivo .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "❌ No se encontró el archivo .env" -ForegroundColor Red
    Write-Host "   Por favor crea el archivo .env con las variables necesarias" -ForegroundColor White
    exit 1
}

# Función para extraer valor de .env
function Get-EnvValue {
    param($key)
    $content = Get-Content ".env" -Raw
    if ($content -match "$key=`"?([^`"\r\n]+)`"?") {
        return $matches[1]
    }
    return $null
}

# Extraer valores
$googleMapsKey = Get-EnvValue "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
$appId = Get-EnvValue "EXPO_PUBLIC_APP_ID"
$apiUrl = Get-EnvValue "EXPO_PUBLIC_API_URL"
$assetsPrefix = Get-EnvValue "EXPO_PUBLIC_PUBLIC_ASSETS_PREFIX"
$env = Get-EnvValue "EXPO_PUBLIC_ENV"

Write-Host "✅ Variables leídas del .env" -ForegroundColor Green
Write-Host ""

# Confirmar con el usuario
Write-Host "Se configurarán los siguientes secrets en EAS:" -ForegroundColor Cyan
Write-Host "  • EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: $($googleMapsKey.Substring(0, 10))..." -ForegroundColor White
Write-Host "  • EXPO_PUBLIC_APP_ID: $appId" -ForegroundColor White
Write-Host "  • EXPO_PUBLIC_API_URL: $apiUrl" -ForegroundColor White
Write-Host "  • EXPO_PUBLIC_PUBLIC_ASSETS_PREFIX: $assetsPrefix" -ForegroundColor White
Write-Host "  • EXPO_PUBLIC_ENV: $env" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "¿Continuar? (s/n)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host "❌ Operación cancelada" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "Configurando secrets en EAS..." -ForegroundColor Yellow
Write-Host ""

# Función para crear o actualizar secret
function Set-EasSecret {
    param($name, $value)

    if (-not $value) {
        Write-Host "⚠️  Saltando $name (valor vacío)" -ForegroundColor Yellow
        return
    }

    Write-Host "Configurando $name..." -ForegroundColor Cyan

    # Intentar crear el secret
    $output = eas secret:create --scope project --name $name --value $value --type string --force 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $name configurado correctamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Error al configurar $name" -ForegroundColor Red
        Write-Host "   $output" -ForegroundColor Red
    }
}

# Configurar cada secret
Set-EasSecret "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY" $googleMapsKey
Set-EasSecret "EXPO_PUBLIC_APP_ID" $appId
Set-EasSecret "EXPO_PUBLIC_API_URL" $apiUrl
Set-EasSecret "EXPO_PUBLIC_PUBLIC_ASSETS_PREFIX" $assetsPrefix
Set-EasSecret "EXPO_PUBLIC_ENV" $env

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuración completada" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Listar secrets configurados
Write-Host "Secrets configurados en el proyecto:" -ForegroundColor Yellow
eas secret:list

Write-Host ""
Write-Host "✅ Ahora puedes hacer builds con:" -ForegroundColor Green
Write-Host "   eas build --platform android --profile production" -ForegroundColor White
Write-Host "   eas build --platform ios --profile production" -ForegroundColor White
Write-Host ""
Write-Host "💡 Los secrets se inyectarán automáticamente durante el build" -ForegroundColor Cyan
Write-Host ""
