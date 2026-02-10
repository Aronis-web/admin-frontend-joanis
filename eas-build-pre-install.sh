#!/usr/bin/env bash

# EAS Build Pre-Install Hook
# This script runs before dependencies are installed

set -e

echo "🔧 Running pre-install hook..."

# Ensure we're using the correct Node version
echo "📦 Node version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

# Clean any previous build artifacts
echo "🧹 Cleaning previous build artifacts..."
rm -rf dist
rm -rf .expo
rm -rf node_modules/.cache

echo "✅ Pre-install hook completed successfully"
