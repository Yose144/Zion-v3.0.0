const { contextBridge, ipcRenderer } = require('electron');

const { IPC_CHANNELS } = require('./shared/ipc-channels');

const api = {
  appInfo: () => ipcRenderer.invoke(IPC_CHANNELS.APP_INFO),
  listWallets: () => ipcRenderer.invoke(IPC_CHANNELS.WALLETS_LIST),
  createWallet: (payload) => ipcRenderer.invoke(IPC_CHANNELS.WALLETS_CREATE, payload),
  importWallet: (payload) => ipcRenderer.invoke(IPC_CHANNELS.WALLETS_IMPORT, payload),
  removeWallet: (walletId) => ipcRenderer.invoke(IPC_CHANNELS.WALLETS_REMOVE, walletId),
  getRuntimeState: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_STATE),
  configureRuntime: (serviceId, env) =>
    ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_CONFIGURE, { serviceId, env }),
  startRuntime: (serviceId) => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_START, serviceId),
  stopRuntime: (serviceId) => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_STOP, serviceId),
  restartRuntime: (serviceId) => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_RESTART, serviceId),
  startRuntimeStack: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_START_STACK),
  stopRuntimeStack: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_STOP_STACK),
  getUpdateStatus: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_STATUS),
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_CHECK),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATES_INSTALL),
  onRuntimeState: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(IPC_CHANNELS.RUNTIME_STATE_CHANGED, wrapped);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.RUNTIME_STATE_CHANGED, wrapped);
  },
  onUpdateStatus: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('updates:status-changed', wrapped);
    return () => ipcRenderer.removeListener('updates:status-changed', wrapped);
  }
};

contextBridge.exposeInMainWorld('zionDesktop', api);
