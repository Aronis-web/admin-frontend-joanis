#!/usr/bin/env bash

# EAS Build Post-Install Hook
# This script runs after dependencies are installed

set -e

echo "🔧 Running post-install hook..."

# Verify TypeScript configuration
echo "📝 TypeScript configuration:"
cat tsconfig.json

# Clear Metro bundler cache
echo "🧹 Clearing Metro bundler cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-* 2>/dev/null || true

# Verify critical files exist
echo "✅ Verifying critical files..."
if [ ! -f "package.json" ]; then
  echo "❌ package.json not found!"
  exit 1
fi

if [ ! -f "app.json" ]; then
  echo "❌ app.json not found!"
  exit 1
fi

echo "✅ Post-install hook completed successfully"
