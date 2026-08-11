/**
 * Surgical codemod: replace `theme.color.text.inverse` with
 * `theme.color.brand.onHeader` ONLY in lines that belong to:
 *   - JSX inside a `<LinearGradient ...>...</LinearGradient>` block.
 *   - A style property whose key starts with `header` or `statHeader`.
 * Preserves UTF-8 (no BOM, no line-ending rewrite).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'src', 'screens');
const FROM = /theme\.color\.text\.inverse/g;
const TO = 'theme.color.brand.onHeader';

let totalFiles = 0;
let totalReplacements = 0;

function processFile(full) {
  const original = fs.readFileSync(full, 'utf8');
  if (!original.includes('brand.headerFrom') || !original.includes('text.inverse')) {
    return;
  }
  const lines = original.split(/\r?\n/);
  const eol = original.includes('\r\n') ? '\r\n' : '\n';

  let insideGradient = 0;
  let insideHeaderStyleDepth = 0;
  let fileReplacements = 0;

  const out = lines.map((line) => {
    const openMatches = line.match(/<LinearGradient\b/g);
    if (openMatches) insideGradient += openMatches.length;

    const styleKeyMatch = line.match(/^\s*(header[A-Za-z]*|statHeader[A-Za-z]*)\s*:\s*\{/);
    if (styleKeyMatch) insideHeaderStyleDepth += 1;

    const eligible = insideGradient > 0 || insideHeaderStyleDepth > 0;

    let nextLine = line;
    if (eligible && FROM.test(line)) {
      const count = (line.match(FROM) || []).length;
      nextLine = line.replace(FROM, TO);
      fileReplacements += count;
    }
    FROM.lastIndex = 0;

    if (insideHeaderStyleDepth > 0 && /^\s*\},?\s*$/.test(line)) {
      insideHeaderStyleDepth -= 1;
    }

    const closeMatches = line.match(/<\/LinearGradient>/g);
    if (closeMatches) insideGradient = Math.max(0, insideGradient - closeMatches.length);

    return nextLine;
  });

  if (fileReplacements > 0) {
    fs.writeFileSync(full, out.join(eol), { encoding: 'utf8' });
    totalFiles += 1;
    totalReplacements += fileReplacements;
    console.log(`  ${path.relative(process.cwd(), full)}: ${fileReplacements}`);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.tsx')) processFile(full);
  }
}

walk(root);
console.log(`Files: ${totalFiles}  Replacements: ${totalReplacements}`);
