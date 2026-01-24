# Setup Sentry Secrets for EAS Build
# This script configures Sentry DSN and related secrets for EAS builds

Write-Host "🔐 Setting up Sentry secrets for EAS Build..." -ForegroundColor Cyan
Write-Host ""

# Check if EAS CLI is installed
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue
if (-not $easInstalled) {
    Write-Host "❌ EAS CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g eas-cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ EAS CLI found" -ForegroundColor Green
Write-Host ""

# Prompt for Sentry DSN
Write-Host "📝 Please provide your Sentry DSN" -ForegroundColor Cyan
Write-Host "   You can find this in your Sentry project settings:" -ForegroundColor Gray
Write-Host "   https://sentry.io/settings/[your-org]/projects/[your-project]/keys/" -ForegroundColor Gray
Write-Host ""
$sentryDsn = Read-Host "Sentry DSN"

if ([string]::IsNullOrWhiteSpace($sentryDsn)) {
    Write-Host "❌ Sentry DSN is required" -ForegroundColor Red
    exit 1
}

# Validate DSN format
if ($sentryDsn -notmatch '^https://[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io/[0-9]+$') {
    Write-Host "⚠️  Warning: DSN format doesn't match expected pattern" -ForegroundColor Yellow
    Write-Host "   Expected format: https://[key]@[org].ingest.sentry.io/[project-id]" -ForegroundColor Gray
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}

Write-Host ""
Write-Host "🔧 Setting EAS secrets..." -ForegroundColor Cyan

# Set SENTRY_DSN
Write-Host "Setting EXPO_PUBLIC_SENTRY_DSN..." -ForegroundColor Gray
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value $sentryDsn --force

# Set SENTRY_ENABLED (true for production)
Write-Host "Setting EXPO_PUBLIC_SENTRY_ENABLED..." -ForegroundColor Gray
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_ENABLED --value "true" --force

# Set ENVIRONMENT
Write-Host "Setting EXPO_PUBLIC_ENVIRONMENT..." -ForegroundColor Gray
eas secret:create --scope project --name EXPO_PUBLIC_ENVIRONMENT --value "production" --force

Write-Host ""
Write-Host "✅ Sentry secrets configured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Update your .env file with the Sentry DSN for local development" -ForegroundColor Gray
Write-Host "   2. Run 'eas build' to create a new build with Sentry enabled" -ForegroundColor Gray
Write-Host "   3. Test error tracking by triggering an error in your app" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 To verify secrets:" -ForegroundColor Cyan
Write-Host "   eas secret:list" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   See SENTRY_SETUP.md for more information" -ForegroundColor Gray
Write-Host ""
