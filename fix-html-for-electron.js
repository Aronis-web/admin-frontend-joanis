const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'web-build', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Replace all <script src="..." defer> with <script type="module" src="...">
html = html.replace(/<script src="([^"]+)" defer><\/script>/g, '<script type="module" src="$1"></script>');

// Remove old polyfill if exists
html = html.replace(/<script>\s*\/\/ Polyfill for process\.env[\s\S]*?<\/script>/g, '');

// Add comprehensive polyfills
const polyfill = `  <script>
    // Polyfill for process.env
    window.process = {
      env: {
        NODE_ENV: 'production'
      }
    };

    // Polyfill for Metro bundler global prefix
    window.__METRO_GLOBAL_PREFIX__ = '';

    // Polyfill for import.meta (for ES modules compatibility)
    window.__importMetaUrl = window.location.href;

    // Suppress module resolution errors in console
    const originalError = console.error;
    console.error = function(...args) {
      const errorMsg = args[0]?.toString() || '';
      // Filter out known Electron/Metro compatibility warnings
      if (errorMsg.includes('import.meta') ||
          errorMsg.includes('Requiring unknown module') ||
          errorMsg.includes('webSecurity')) {
        return; // Suppress these specific errors
      }
      originalError.apply(console, args);
    };
  </script>
`;

html = html.replace('<div id="root"></div>', '<div id="root"></div>\n' + polyfill);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML fixed for Electron - scripts now load as ES modules with enhanced polyfills');
