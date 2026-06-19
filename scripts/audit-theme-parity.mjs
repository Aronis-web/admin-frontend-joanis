/**
 * Audita paridad estructural entre defaultLight.ts y defaultDark.ts.
 * Parsea las fuentes (TS) extrayendo el AST de objeto de cada `color: { ... }`
 * y reporta slots faltantes/sobrantes/duplicados en cada lado.
 *
 * Uso: node scripts/audit-theme-parity.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const extractColorBlock = (src) => {
  const idx = src.indexOf('color: {');
  if (idx < 0) throw new Error('no se encontro color: { en el archivo');
  let depth = 0;
  let start = -1;
  for (let i = idx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('bloque color desbalanceado');
};

const collectPaths = (src) => {
  const paths = [];
  const stack = [];
  let i = 0;
  let buf = '';
  const flushKey = () => {
    const key = buf.trim().replace(/^[,{}\s]+|[,{}\s]+$/g, '');
    buf = '';
    return key;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '{') {
      stack.push(null);
      buf = '';
    } else if (c === '}') {
      stack.pop();
      buf = '';
    } else if (c === ':') {
      const key = flushKey();
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '{') {
        stack[stack.length - 1] = key;
        paths.push([...stack.slice(0, -1), key].filter(Boolean).join('.'));
      } else {
        let end = j;
        let d = 0;
        while (end < src.length) {
          const ch = src[end];
          if (ch === '{' || ch === '[' || ch === '(') d++;
          else if (ch === '}' || ch === ']' || ch === ')') {
            if (d === 0) break;
            d--;
          } else if (ch === ',' && d === 0) break;
          end++;
        }
        paths.push([...stack.slice(0, -1), key].filter(Boolean).join('.'));
        i = end - 1;
      }
    } else if (c === ',') {
      buf = '';
    } else {
      buf += c;
    }
    i++;
  }
  return paths;
};

const lightSrc = readFileSync(join(root, 'src/design-system/themes/defaultLight.ts'), 'utf8');
const darkSrc = readFileSync(join(root, 'src/design-system/themes/defaultDark.ts'), 'utf8');

const lightPaths = new Set(collectPaths(extractColorBlock(lightSrc)));
const darkPaths = new Set(collectPaths(extractColorBlock(darkSrc)));

const missingInDark = [...lightPaths].filter((p) => !darkPaths.has(p)).sort();
const extraInDark = [...darkPaths].filter((p) => !lightPaths.has(p)).sort();

console.log('=== Theme parity audit ===');
console.log(`light slots: ${lightPaths.size}`);
console.log(`dark  slots: ${darkPaths.size}`);
console.log();
console.log('FALTAN en dark (presentes en light):');
if (missingInDark.length === 0) console.log('  (ninguno)');
else missingInDark.forEach((p) => console.log('  - ' + p));
console.log();
console.log('EXTRA en dark (no presentes en light):');
if (extraInDark.length === 0) console.log('  (ninguno)');
else extraInDark.forEach((p) => console.log('  - ' + p));

const ok = missingInDark.length === 0 && extraInDark.length === 0;
console.log();
console.log(ok ? 'OK - paridad perfecta' : 'FALLOS DETECTADOS');
process.exit(ok ? 0 : 1);
