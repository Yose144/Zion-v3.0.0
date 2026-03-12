const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const { RuntimeManager } = require('./services/runtime-manager');
const { WalletManager } = require('./services/wallet-manager');
const { UpdateService } = require('./services/update-service');
const { IPC_CHANNELS } = require('./shared/ipc-channels');

let mainWindow = null;
let runtimeManager = null;
let walletManager = null;
let updateService = null;

if (process.platform === 'win32' && !app.isPackaged) {
  app.setName('zion-v3-desktop-app-dev');
}

app.setPath('sessionData', path.join(app.getPath('userData'), 'cache'));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#08131a',
    title: 'ZION V3 Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function getAppInfo() {
  return {
    name: 'ZION V3 Desktop',
    version: app.getVersion(),
    runtimeLine: 'V3 pure-code',
    platform: process.platform,
    walletCount: walletManager ? walletManager.listWallets().length : 0
  };
}

function registerIpc() {
  ipcMain.handle(IPC_CHANNELS.APP_INFO, async () => getAppInfo());

  ipcMain.handle(IPC_CHANNELS.WALLETS_LIST, async () => {
    return walletManager.listWallets();
  });

  ipcMain.handle(IPC_CHANNELS.WALLETS_CREATE, async (_event, payload) => {
    return walletManager.createWallet(payload || {});
  });

  ipcMain.handle(IPC_CHANNELS.WALLETS_IMPORT, async (_event, payload) => {
    return walletManager.importWallet(payload || {});
  });

  ipcMain.handle(IPC_CHANNELS.WALLETS_REMOVE, async (_event, walletId) => {
    return walletManager.removeWallet(walletId);
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_STATE, async () => {
    return runtimeManager.getSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_CONFIGURE, async (_event, payload) => {
    return runtimeManager.configureService(payload.serviceId, payload.env || {});
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_START, async (_event, serviceId) => {
    return runtimeManager.startService(serviceId);
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_STOP, async (_event, serviceId) => {
    return runtimeManager.stopService(serviceId);
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_RESTART, async (_event, serviceId) => {
    return runtimeManager.restartService(serviceId);
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_START_STACK, async () => {
    return runtimeManager.startStack();
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_STOP_STACK, async () => {
    return runtimeManager.stopStack();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATES_STATUS, async () => {
    return updateService.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATES_CHECK, async () => {
    return updateService.checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATES_INSTALL, async () => {
    return updateService.quitAndInstall();
  });
}

app.whenReady().then(async () => {
  runtimeManager = new RuntimeManager(app, () => mainWindow);
  walletManager = new WalletManager(app);
  updateService = new UpdateService(app, () => mainWindow);
  await runtimeManager.initialize();
  registerIpc();
  createWindow();
  await updateService.initialize();

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (runtimeManager) {
    await runtimeManager.stopStack();
  }
});
