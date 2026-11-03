// Kingdom desktop client — Electron main process.
// Kingdom = herní klient, ne web: okno bez prohlížeče, tray, autostart,
// a lokální ZION peněženka. Peněženka žije jen tady — renderer dostává
// adresu/zůstatek/výsledky přes IPC, nikdy seed ani klíč.
//
// UI je SSR Kingdom: dev → KINGDOM_URL (běžící dev server),
// bundle → embedded standalone server přes ELECTRON_RUN_AS_NODE.

const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const { WalletCore } = require('@zion/wallet');

const isDev = !!process.env.KINGDOM_URL;
const BG = '#0b0f0c'; // rasta-tmavé pozadí okna

let win = null;
let tray = null;
let serverProc = null;
let serverUrl = null;
const wallet = new WalletCore(path.join(app.getPath('userData'), 'wallet'));

// ── nastavení (autostart) ────────────────────────────────────────────────
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { return {}; }
}
function writeSettings(patch) {
  const s = { ...readSettings(), ...patch };
  fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2));
  return s;
}
function applyAutostart(openAtLogin) {
  app.setLoginItemSettings({ openAtLogin });
  writeSettings({ openAtLogin });
}

// ── embedded Kingdom server (standalone) ─────────────────────────────────
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function resolveServerDir() {
  const candidates = [
    process.env.KINGDOM_SERVER_DIR,
    path.join(__dirname, 'bundle'),               // dev: scripts/prepare-bundle.mjs
    path.join(process.resourcesPath || '', 'kingdom-server'), // packaged
  ].filter(Boolean);
  return candidates.find((d) => fs.existsSync(path.join(d, 'server.js'))) || null;
}

function waitForServer(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() > deadline) reject(new Error('Kingdom server did not start in time'));
      else setTimeout(probe, 250);
    };
    probe();
  });
}

async function startKingdomServer() {
  if (isDev) return process.env.KINGDOM_URL;
  const dir = resolveServerDir();
  if (!dir) {
    throw new Error(
      'Embedded Kingdom server chybí — spusť `npm run bundle -w @zion/desktop` nebo nastav KINGDOM_URL',
    );
  }
  const port = await findFreePort();
  serverProc = spawn(process.execPath, [path.join(dir, 'server.js')], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProc.stderr.on('data', (d) => process.stderr.write(`[kingdom] ${d}`));
  serverProc.on('exit', (code) => {
    if (code) process.stderr.write(`[kingdom] server exited ${code}\n`);
  });
  await waitForServer(port);
  return `http://127.0.0.1:${port}`;
}

// ── okno ─────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: BG,
    title: 'Kingdom',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  // Jen náš origin — cizí odkazy ven do systémového prohlížeče.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(serverUrl)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(serverUrl)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  win.on('close', (e) => {
    // macOS klient: zavření okna schová, quit jen přes ⌘Q / tray.
    if (process.platform === 'darwin' && !app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });
  win.loadURL(serverUrl);
}

// ── tray ─────────────────────────────────────────────────────────────────
function walletLine() {
  const s = wallet.status();
  if (!s.exists) return 'Peněženka: není';
  return `Peněženka: ${s.unlocked ? 'odemčená' : 'zamčená'} ${s.address.slice(0, 14)}…`;
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) image = image.resize({ width: 18 });
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Kingdom');
  tray.on('click', () => {
    if (!win) return createWindow();
    win.isVisible() ? win.hide() : win.show();
  });
}

function refreshTrayMenu() {
  if (!tray) return;
  const { openAtLogin } = readSettings();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Otevřít Kingdom', click: () => (win ? win.show() : createWindow()) },
    { type: 'separator' },
    { label: walletLine(), enabled: false },
    { type: 'separator' },
    {
      label: 'Spouštět po přihlášení',
      type: 'checkbox',
      checked: !!openAtLogin,
      click: (item) => applyAutostart(item.checked),
    },
    { label: 'Ukončit', click: () => { app.isQuiting = true; app.quit(); } },
  ]));
}

// ── IPC — peněženka (seed nikdy neopustí main proces; mnemonic jen 1× při create) ──
function reply(fn) {
  return async (_e, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  };
}

function registerIpc() {
  ipcMain.handle('zion:app:info', () => ({
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    serverUrl,
    dev: isDev,
  }));
  ipcMain.handle('zion:app:autostart', reply((on) => applyAutostart(!!on) || { openAtLogin: !!on }));
  ipcMain.handle('zion:wallet:status', reply(() => wallet.status()));
  ipcMain.handle('zion:wallet:create', reply((password) => {
    const r = wallet.create(password);
    refreshTrayMenu();
    return r;
  }));
  ipcMain.handle('zion:wallet:import', reply(({ mnemonic, password }) => {
    const r = wallet.importMnemonic(mnemonic, password);
    refreshTrayMenu();
    return r;
  }));
  ipcMain.handle('zion:wallet:unlock', reply((password) => {
    const r = wallet.unlock(password);
    refreshTrayMenu();
    return r;
  }));
  ipcMain.handle('zion:wallet:lock', reply(() => {
    const r = wallet.lock();
    refreshTrayMenu();
    return r;
  }));
  ipcMain.handle('zion:wallet:balance', reply(() => wallet.balance()));
  ipcMain.handle('zion:wallet:send', reply((tx) => wallet.send(tx)));
}

// ── lifecycle ────────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

  app.whenReady().then(async () => {
    // Menu rolí — bez Edit menu by ve formulářích nešlo ⌘C/⌘V (seed, hesla).
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate([
        { role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' },
      ]));
    }
    try {
      serverUrl = await startKingdomServer();
    } catch (err) {
      process.stderr.write(`[kingdom] ${err.message}\n`);
      serverUrl = null;
    }
    registerIpc();
    createTray();
    refreshTrayMenu();
    if (serverUrl) createWindow();
  });

  app.on('activate', () => { if (!win && serverUrl) createWindow(); else if (win) win.show(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('will-quit', () => { if (serverProc) serverProc.kill(); });
}
