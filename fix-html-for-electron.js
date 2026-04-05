const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'web-build', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Replace all <script src="..." defer> with <script type="module" src="...">
html = html.replace(/<script src="([^"]+)" defer><\/script>/g, '<script type="module" src="$1"></script>');

// Remove old polyfill if exists (both in head and body)
html = html.replace(/<script>\s*\/\/ Polyfill for process\.env[\s\S]*?<\/script>\s*/g, '');
html = html.replace(/<script>\s*\/\/ Node\.js globals polyfill[\s\S]*?<\/script>\s*/g, '');

// Add comprehensive polyfills in the HEAD - MUST run BEFORE any other scripts
const polyfill = `
    <script>
      // Node.js globals polyfill for Electron compatibility
      // These MUST be defined before any bundled code runs

      // Define globals directly on window (avoid typeof checks that can fail)
      var __dirname = '/';
      var __filename = '/index.js';
      var global = window;
      var module = { exports: {} };
      var exports = module.exports;

      // Process polyfill
      var process = {
        env: { NODE_ENV: 'production' },
        platform: 'browser',
        resourcesPath: '/',
        cwd: function() { return '/'; }
      };

      // Also set on window for module access
      window.__dirname = __dirname;
      window.__filename = __filename;
      window.global = global;
      window.module = module;
      window.exports = exports;
      window.process = process;

      // Polyfill require function
      window.require = function(moduleName) {
        // Return empty objects/functions for electron modules
        if (moduleName === 'electron' || moduleName === 'electron-updater') {
          return {
            app: { isPackaged: false, getVersion: function() { return '1.0.0'; } },
            BrowserWindow: function() {},
            ipcMain: { handle: function() {}, on: function() {} },
            ipcRenderer: { invoke: function() { return Promise.resolve(); }, on: function() {}, send: function() {} },
            Menu: { buildFromTemplate: function() {}, setApplicationMenu: function() {} },
            dialog: { showMessageBox: function() { return Promise.resolve({}); } },
            shell: { openExternal: function() {} },
            autoUpdater: { on: function() {}, checkForUpdates: function() { return Promise.resolve(); } }
          };
        }
        if (moduleName === 'path') {
          return { join: function() { return Array.from(arguments).join('/'); }, dirname: function(p) { return p; } };
        }
        if (moduleName === 'fs') {
          return { existsSync: function() { return false; }, readFileSync: function() { return ''; }, writeFileSync: function() {} };
        }
        if (moduleName === 'express') {
          return function() { return { use: function() {}, listen: function() {}, static: function() {} }; };
        }
        console.warn('[Polyfill] require() called for:', moduleName);
        return {};
      };

      // Polyfill for Metro bundler global prefix
      window.__METRO_GLOBAL_PREFIX__ = '';

      // Polyfill for import.meta (for ES modules compatibility)
      window.__importMetaUrl = window.location.href;

      // Suppress known compatibility warnings
      (function() {
        var originalError = console.error;
        console.error = function() {
          var args = Array.prototype.slice.call(arguments);
          var errorMsg = (args[0] || '').toString();
          if (errorMsg.indexOf('import.meta') !== -1 ||
              errorMsg.indexOf('Requiring unknown module') !== -1 ||
              errorMsg.indexOf('webSecurity') !== -1) {
            return;
          }
          originalError.apply(console, args);
        };
      })();

      console.log('[Polyfill] Node.js globals initialized for Electron');
    </script>
  </head>`;

// Insert polyfills right before </head> so they run first
html = html.replace('</head>', polyfill);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML fixed for Electron - polyfills added to HEAD, scripts load as ES modules');
