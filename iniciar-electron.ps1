# Script para iniciar Panel Admin Grit (Version de Escritorio)
# Electron ahora incluye su propio servidor web embebido

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Panel Admin Grit - Version Escritorio" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si el ejecutable existe
$exePath = "$PSScriptRoot\dist\win-unpacked\Panel Admin Grit.exe"
if (-not (Test-Path $exePath)) {
    Write-Host "ERROR: No se encontro el ejecutable." -ForegroundColor Red
    Write-Host "Por favor, ejecuta primero: npm run build:electron:win" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit
}

Write-Host "Abriendo Panel Admin Grit..." -ForegroundColor Cyan
Write-Host ""

# Abrir la aplicacion Electron (ahora con servidor embebido)
Start-Process $exePath

Write-Host "Aplicacion iniciada exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Nota: La aplicacion ahora incluye su propio servidor web." -ForegroundColor Green
Write-Host "No necesitas mantener ninguna ventana adicional abierta." -ForegroundColor Green
Write-Host ""
