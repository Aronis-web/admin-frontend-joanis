#!/usr/bin/env bash

# EAS Build Post-Install Hook
# This script runs after dependencies are installed

set -e

echo "🔧 Running post-install hook..."

# Fix memoize-one package by changing main field
echo "🔧 Fixing memoize-one package..."
MEMOIZE_PKG="node_modules/memoize-one/package.json"
if [ -f "$MEMOIZE_PKG" ]; then
  echo "📦 Found memoize-one package.json"
  # Use sed to replace the main field
  sed -i 's/"main": "dist\/memoize-one\.cjs\.js"/"main": "dist\/memoize-one.js"/g' "$MEMOIZE_PKG"
  echo "✅ Updated memoize-one main field"
  cat "$MEMOIZE_PKG" | grep "main"
else
  echo "⚠️ memoize-one package.json not found"
fi

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
