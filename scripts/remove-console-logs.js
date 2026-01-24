#!/usr/bin/env node

/**
 * Script to find and report console.log usage in production code
 *
 * This script scans the codebase for direct console.log/warn/error usage
 * and reports files that should be using the logger utility instead.
 *
 * Usage:
 *   node scripts/remove-console-logs.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const EXCLUDED_FILES = ['logger.ts', 'secureStorage.ts'];
const EXCLUDED_DIRS = ['node_modules', '.expo', 'dist', 'build'];

// Patterns to detect
const CONSOLE_PATTERNS = [
  /console\.log\(/g,
  /console\.warn\(/g,
  /console\.error\(/g,
  /console\.info\(/g,
  /console\.debug\(/g,
];

let totalIssues = 0;
const fileIssues = [];

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath) {
  const fileName = path.basename(filePath);
  if (EXCLUDED_FILES.includes(fileName)) return true;

  const parts = filePath.split(path.sep);
  return parts.some(part => EXCLUDED_DIRS.includes(part));
}

/**
 * Scan a file for console usage
 */
function scanFile(filePath) {
  if (shouldExclude(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  CONSOLE_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      issues.push({
        pattern: pattern.source,
        count: matches.length,
      });
    }
  });

  if (issues.length > 0) {
    const totalCount = issues.reduce((sum, issue) => sum + issue.count, 0);
    totalIssues += totalCount;
    fileIssues.push({
      file: path.relative(process.cwd(), filePath),
      issues,
      totalCount,
    });
  }
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name)) {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      scanFile(fullPath);
    }
  }
}

// Run the scan
console.log('🔍 Scanning for console.log usage...\n');
scanDirectory(SRC_DIR);

// Report results
if (totalIssues === 0) {
  console.log('✅ No console.log usage found! All files are using the logger utility.\n');
} else {
  console.log(`⚠️  Found ${totalIssues} console.log usage(s) in ${fileIssues.length} file(s):\n`);

  // Sort by count (most issues first)
  fileIssues.sort((a, b) => b.totalCount - a.totalCount);

  fileIssues.forEach(({ file, issues, totalCount }) => {
    console.log(`📄 ${file} (${totalCount} issue${totalCount > 1 ? 's' : ''})`);
    issues.forEach(({ pattern, count }) => {
      console.log(`   - ${pattern}: ${count} occurrence${count > 1 ? 's' : ''}`);
    });
    console.log('');
  });

  console.log('💡 Recommendation:');
  console.log('   Replace console.log with logger.info()');
  console.log('   Replace console.warn with logger.warn()');
  console.log('   Replace console.error with logger.error()');
  console.log('   Replace console.debug with logger.debug()');
  console.log('\n   Import: import logger from \'@/utils/logger\';\n');
}

process.exit(totalIssues > 0 ? 1 : 0);
