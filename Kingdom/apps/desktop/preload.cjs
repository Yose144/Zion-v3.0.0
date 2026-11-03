// Preload — jediný most mezi Kingdom UI (renderer) a privilegovaným mainem.
// Renderer nikdy nevidí seed/klíč; dostává jen serializovatelné výsledky.
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('zion', {
  app: {
    info: () => ipcRenderer.invoke('zion:app:info'),
    setAutostart: invoke('zion:app:autostart'),
  },
  wallet: {
    status: invoke('zion:wallet:status'),
    create: invoke('zion:wallet:create'),
    importMnemonic: invoke('zion:wallet:import'),
    unlock: invoke('zion:wallet:unlock'),
    lock: invoke('zion:wallet:lock'),
    balance: invoke('zion:wallet:balance'),
    send: invoke('zion:wallet:send'),
  },
});
