const el = (id) => document.getElementById(id);

const state = { bumpType: 'patch', running: false, currentVersion: '—' };

const logBox = el('log');
const statusChip = el('statusChip');
const runBtn = el('runBtn');
const cancelBtn = el('cancelBtn');
const resultsPanel = el('results');
const resultsList = el('resultsList');

function appendLog(type, text) {
  const line = document.createElement('span');
  line.className = `line l-${type}`;
  const prefix = { step: '▸ ', ok: '✓ ', err: '✗ ', sys: '', result: '  · ' }[type] || '';
  line.textContent = prefix + text;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

function setStatus(kind, label) {
  statusChip.className = `chip ${kind}`;
  statusChip.textContent = label;
}

async function refreshNextVersion() {
  const next = await window.release.previewVersion(state.bumpType);
  el('nextVersion').textContent = next;
}

async function init() {
  const info = await window.release.getInfo();
  state.currentVersion = info.version;
  el('currentVersion').textContent = info.version;
  await refreshNextVersion();
  if (!info.scriptExists) {
    appendLog('err', 'No se encontró scripts/release-tool.ps1');
  }
}

// Selector de tipo de bump
document.querySelectorAll('#bumpGroup .seg').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (state.running) return;
    document.querySelectorAll('#bumpGroup .seg').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.bumpType = btn.dataset.bump;
    await refreshNextVersion();
  });
});

el('clearBtn').addEventListener('click', () => { logBox.innerHTML = ''; });

runBtn.addEventListener('click', async () => {
  if (state.running) return;
  const opts = {
    bumpType: state.bumpType,
    buildApk: el('optApk').checked,
    buildElectron: el('optElectron').checked,
    commitPush: el('optCommit').checked,
  };
  if (!opts.buildApk && !opts.buildElectron && !opts.commitPush && opts.bumpType === 'none') {
    appendLog('err', 'Selecciona al menos una acción.');
    return;
  }

  resultsPanel.classList.add('hidden');
  resultsList.innerHTML = '';
  state.running = true;
  runBtn.disabled = true;
  cancelBtn.disabled = false;
  setStatus('running', 'Ejecutando…');
  appendLog('step', 'Iniciando release…');

  const res = await window.release.run(opts);
  if (!res.started) {
    appendLog('err', res.reason || 'No se pudo iniciar.');
    resetRunning();
  }
});

cancelBtn.addEventListener('click', async () => {
  await window.release.cancel();
  appendLog('err', 'Proceso cancelado por el usuario.');
});

function resetRunning() {
  state.running = false;
  runBtn.disabled = false;
  cancelBtn.disabled = true;
}

const collectedResults = {};

window.release.onLog((payload) => {
  appendLog(payload.type, payload.text);
  if (payload.type === 'result' && payload.result) {
    collectedResults[payload.result.key] = payload.result.value;
  }
});

window.release.onDone(async ({ code, newVersion }) => {
  resetRunning();
  el('currentVersion').textContent = newVersion;
  state.currentVersion = newVersion;
  await refreshNextVersion();

  if (code === 0 && collectedResults.status !== 'error') {
    setStatus('ok', 'Completado');
    renderResults();
  } else {
    setStatus('error', 'Con errores');
    renderResults();
  }
});

function renderResults() {
  const map = [
    ['version', 'Versión'],
    ['apk', 'APK'],
    ['apkMb', 'Tamaño APK (MB)'],
    ['exe', 'Instalador .exe'],
    ['exeMb', 'Tamaño .exe (MB)'],
    ['outputDir', 'Carpeta'],
  ];
  const rows = map.filter(([k]) => collectedResults[k] !== undefined);
  if (!rows.length) return;
  resultsList.innerHTML = '';
  for (const [k, label] of rows) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="k">${label}</span><span class="v">${collectedResults[k]}</span>`;
    resultsList.appendChild(li);
  }
  resultsPanel.classList.remove('hidden');
}

init();
