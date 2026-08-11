const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'release-tool.ps1');
const PROJECTS_CONFIG = path.join(__dirname, 'projects.json');

function loadProjects() {
  try {
    const cfg = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));
    return Array.isArray(cfg.projects) ? cfg.projects : [];
  } catch {
    return [];
  }
}

function getProject(key) {
  const projects = loadProjects();
  return projects.find((p) => p.key === key) || projects[0] || null;
}

// userData propio para evitar errores de caché (Access denied) en el path por defecto.
try {
  const userData = path.join(os.tmpdir(), 'erp-aio-release-tool');
  fs.mkdirSync(userData, { recursive: true });
  app.setPath('userData', userData);
} catch { /* noop */ }
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.disableHardwareAcceleration();

// Necesario en Windows para que la barra de tareas use el icono de la app.
if (process.platform === 'win32') app.setAppUserModelId('com.erpaio.release-tool');

const APP_ICON = path.join(__dirname, 'icon.ico');

let mainWindow = null;
let currentProc = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 800,
    minWidth: 720,
    minHeight: 600,
    title: 'ERP-aio · Release Tool',
    icon: APP_ICON,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function readVersion(projectKey) {
  const proj = getProject(projectKey);
  if (!proj) return '—';
  try {
    const root = proj.root.replace(/\//g, path.sep);
    const file = path.join(root, proj.primaryVersionFile);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    let cur = json;
    for (const seg of proj.primaryVersionPath.split('.')) cur = cur ? cur[seg] : undefined;
    return cur || '—';
  } catch {
    return '—';
  }
}

function computeNextVersion(current, bumpType) {
  if (bumpType === 'none' || !/^\d+\.\d+\.\d+$/.test(current)) return current;
  let [maj, min, pat] = current.split('.').map(Number);
  if (bumpType === 'patch') pat++;
  else if (bumpType === 'minor') { min++; pat = 0; }
  else if (bumpType === 'major') { maj++; min = 0; pat = 0; }
  return `${maj}.${min}.${pat}`;
}

ipcMain.handle('get-projects', () => {
  return loadProjects().map((p) => ({
    key: p.key,
    label: p.label,
    productName: p.productName,
    apk: !!(p.apk && p.apk.supported),
    electron: !!(p.electron && p.electron.supported),
  }));
});

ipcMain.handle('get-info', (_e, projectKey) => {
  const proj = getProject(projectKey);
  return {
    version: readVersion(projectKey),
    project: proj ? proj.root : PROJECT_ROOT,
    productName: proj ? proj.productName : '',
    scriptExists: fs.existsSync(SCRIPT),
  };
});

ipcMain.handle('preview-version', (_e, { projectKey, bumpType }) => {
  return computeNextVersion(readVersion(projectKey), bumpType);
});

ipcMain.handle('run-release', (_e, opts) => {
  if (currentProc) return { started: false, reason: 'Ya hay un proceso en ejecución.' };

  const args = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', SCRIPT,
    '-ProjectKey', opts.projectKey || 'admin',
    '-BumpType', opts.bumpType || 'patch',
  ];
  if (opts.buildApk) args.push('-BuildApk');
  if (opts.buildElectron) args.push('-BuildElectron');
  if (opts.commitPush) args.push('-CommitPush');

  send('release-log', { type: 'sys', text: `> powershell ${args.join(' ')}` });

  currentProc = spawn('powershell.exe', args, { cwd: PROJECT_ROOT });

  let outBuf = '';
  let errBuf = '';

  const flush = (buf, isErr) => {
    const lines = buf.split(/\r?\n/);
    const rest = lines.pop();
    for (const line of lines) emitLine(line, isErr);
    return rest;
  };

  currentProc.stdout.on('data', (d) => { outBuf = flush(outBuf + d.toString(), false); });
  currentProc.stderr.on('data', (d) => { errBuf = flush(errBuf + d.toString(), true); });

  currentProc.on('close', (code) => {
    if (outBuf) emitLine(outBuf, false);
    if (errBuf) emitLine(errBuf, true);
    outBuf = errBuf = '';
    const finishedProc = currentProc;
    currentProc = null;
    send('release-done', { code, newVersion: readVersion(opts.projectKey) });
    if (finishedProc) finishedProc.removeAllListeners();
  });

  currentProc.on('error', (e) => {
    send('release-log', { type: 'err', text: `No se pudo iniciar el proceso: ${e.message}` });
    currentProc = null;
    send('release-done', { code: -1, newVersion: readVersion(opts.projectKey) });
  });

  return { started: true };
});

ipcMain.handle('cancel-release', () => {
  if (currentProc && currentProc.pid) {
    try {
      spawn('taskkill', ['/pid', String(currentProc.pid), '/T', '/F']);
    } catch {
      currentProc.kill();
    }
    return { cancelled: true };
  }
  return { cancelled: false };
});

function emitLine(line, isErr) {
  if (line === undefined || line === null) return;
  const raw = line;
  let type = isErr ? 'err' : 'log';
  let text = raw;
  let result = null;

  if (raw.startsWith('@@STEP@@')) { type = 'step'; text = raw.replace('@@STEP@@', '').trim(); }
  else if (raw.startsWith('@@OK@@')) { type = 'ok'; text = raw.replace('@@OK@@', '').trim(); }
  else if (raw.startsWith('@@ERR@@')) { type = 'err'; text = raw.replace('@@ERR@@', '').trim(); }
  else if (raw.startsWith('@@RESULT@@')) {
    type = 'result';
    const body = raw.replace('@@RESULT@@', '').trim();
    const idx = body.indexOf('=');
    result = { key: body.slice(0, idx), value: body.slice(idx + 1) };
    text = body;
  }

  send('release-log', { type, text, result });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (currentProc && currentProc.pid) {
    try { spawn('taskkill', ['/pid', String(currentProc.pid), '/T', '/F']); } catch { /* noop */ }
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
