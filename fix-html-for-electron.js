const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'web-build', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Replace all <script src="..." defer> with <script type="module" src="...">
html = html.replace(/<script src="([^"]+)" defer><\/script>/g, '<script type="module" src="$1"></script>');

// Add polyfills if not already present
if (!html.includes('window.process')) {
  const polyfill = `  <script>
    // Polyfill for process.env
    window.process = {
      env: {
        NODE_ENV: 'production'
      }
    };

    // Polyfill for Metro bundler global prefix
    window.__METRO_GLOBAL_PREFIX__ = '';
  </script>
`;
  html = html.replace('<div id="root"></div>', '<div id="root"></div>\n' + polyfill);
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML fixed for Electron - scripts now load as ES modules with process polyfill');
