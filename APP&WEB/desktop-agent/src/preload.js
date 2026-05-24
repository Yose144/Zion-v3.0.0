// ZION Ekam Deeksha v3.0.0 - Preload Script
// IPC bridge between main process and renderer (security layer)

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // First-run / quick setup
  isFirstRun: () => ipcRenderer.invoke('is-first-run'),
  quickSetup: (data) => ipcRenderer.invoke('quick-setup', data),

  // Config management
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Mining control
  startMining: (config) => ipcRenderer.invoke('start-mining', config),
  stopMining: () => ipcRenderer.invoke('stop-mining'),


  
  // Stats
  getStats: () => ipcRenderer.invoke('get-stats'),
  
  // Logs
  openLogs: () => ipcRenderer.invoke('open-logs'),

  // Wallet management
  generateWallet: () => ipcRenderer.invoke('generate-wallet'),
  saveWallet: (data) => ipcRenderer.invoke('save-wallet', data),
  listWallets: () => ipcRenderer.invoke('list-wallets'),
  importWallet: (data) => ipcRenderer.invoke('import-wallet', data),
  exportWallet: (data) => ipcRenderer.invoke('export-wallet', data),
  validateAddress: (address) => ipcRenderer.invoke('validate-address', address),

  // Wallet RPC
  walletGetBalance: (data) => ipcRenderer.invoke('wallet-get-balance', data),
  walletSendTransaction: (data) => ipcRenderer.invoke('wallet-send-transaction', data),
  walletGetTransaction: (data) => ipcRenderer.invoke('wallet-get-transaction', data),
  walletGenerateQr: (data) => ipcRenderer.invoke('wallet-generate-qr', data),

  // CH3 Architecture / Network Monitoring
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  getNetworkMetrics: () => ipcRenderer.invoke('get-network-metrics'),
  autoSelectPool: () => ipcRenderer.invoke('auto-select-pool'),
  getPeerList: () => ipcRenderer.invoke('get-peer-list'),



  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateSettings: () => ipcRenderer.invoke('get-update-settings'),
  setUpdateAutoCheck: (enabled) => ipcRenderer.invoke('set-update-auto-check', enabled),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
  },

  // Event listeners
  onMinerStarted: (callback) => {
    ipcRenderer.on('miner-started', (event, data) => callback(data));
  },
  onMinerStarting: (callback) => {
    ipcRenderer.on('miner-starting', (event, data) => callback(data));
  },
  onMinerStopped: (callback) => {
    ipcRenderer.on('miner-stopped', (event, data) => callback(data));
  },
  onMinerError: (callback) => {
    ipcRenderer.on('miner-error', (event, data) => callback(data));
  },
  onMinerOutput: (callback) => {
    ipcRenderer.on('miner-output', (event, data) => callback(data));
  },
  onBlockFound: (callback) => {
    ipcRenderer.on('block-found', (event, data) => callback(data));
  },
  onStatsUpdate: (callback) => {
    ipcRenderer.on('stats-update', (event, data) => callback(data));
  },
  onMinerBackend: (callback) => {
    ipcRenderer.on('miner-backend', (event, data) => callback(data));
  },
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config-updated', (event) => callback());
  },



  // ── L1 Tree Node (local zion-core process) ──────────────────────────────
  nodeGetStatus: () => ipcRenderer.invoke('node-get-status'),
  nodeGetPeers: () => ipcRenderer.invoke('node-get-peers'),
  nodeStart: (options) => ipcRenderer.invoke('node-start', options),
  nodeStop: () => ipcRenderer.invoke('node-stop'),
  nodeGetCheckpoints: () => ipcRenderer.invoke('node-get-checkpoints'),
  onNodeOutput: (callback) => ipcRenderer.on('node-output', (event, data) => callback(data)),
  onNodeStopped: (callback) => ipcRenderer.on('node-stopped', (event, data) => callback(data)),

  // ── Security / AV Troubleshooting ────────────────────────────────────────
  getSecurityStatus: () => ipcRenderer.invoke('get-security-status'),
  fixSecurityBlocks: () => ipcRenderer.invoke('fix-security-blocks'),
  openDefenderSettings: () => ipcRenderer.invoke('open-defender-settings'),

  // ── Hiran AI Chat ───────────────────────────────────────────────────────
  aiChatAsk: (data) => ipcRenderer.invoke('ai-chat-ask', data),
  aiChatStatus: () => ipcRenderer.invoke('ai-chat-status'),

  // ── Ekam Deeksha v3.0.0 GPU + Dual Mining ──────────────────────────────
  runGpuBenchmark: (options) => ipcRenderer.invoke('run-gpu-benchmark', options),
  getGpuDevices: () => ipcRenderer.invoke('get-gpu-devices'),

  // Cleanup listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('Preload script loaded - electronAPI available');
