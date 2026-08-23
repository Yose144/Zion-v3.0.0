// ZION Ekam Deeksha v3.0.5 - Preload Script
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



  // Auto-update (license-gated)
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateSettings: () => ipcRenderer.invoke('get-update-settings'),
  setUpdateAutoCheck: (enabled) => ipcRenderer.invoke('set-update-auto-check', enabled),
  // License key management
  getLicenseKey: () => ipcRenderer.invoke('get-license-key'),
  setLicenseKey: (key) => ipcRenderer.invoke('set-license-key', key),
  validateLicense: (key) => ipcRenderer.invoke('validate-license', key),
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
  onShareEvent: (callback) => {
    ipcRenderer.on('share-event', (event, data) => callback(data));
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

  // ── Hiranyagarbha + NCL (Neural Compute Layer) ─────────────────────────
  aiNativeStatus: () => ipcRenderer.invoke('ai-native-status'),
  nclGetStatus: () => ipcRenderer.invoke('ncl-get-status'),
  nclGetWorkers: () => ipcRenderer.invoke('ncl-get-workers'),
  nclGetLeaderboard: () => ipcRenderer.invoke('ncl-get-leaderboard'),
  nclSubmitJob: (data) => ipcRenderer.invoke('ncl-submit-job', data),
  nclGetPrice: () => ipcRenderer.invoke('ncl-get-price'),

  // ── Ekam Deeksha v3.0.5 GPU + Dual Mining ──────────────────────────────
  runGpuBenchmark: (options) => ipcRenderer.invoke('run-gpu-benchmark', options),
  getGpuDevices: () => ipcRenderer.invoke('get-gpu-devices'),

  // ── ZION CLI Integration (v3 unified CLI) ────────────────────────────
  cliGetVersion: () => ipcRenderer.invoke('cli-get-version'),
  cliWalletList: () => ipcRenderer.invoke('cli-wallet-list'),
  cliWalletNew: (data) => ipcRenderer.invoke('cli-wallet-new', data),
  cliWalletBalance: (data) => ipcRenderer.invoke('cli-wallet-balance', data),
  cliWalletSend: (data) => ipcRenderer.invoke('cli-wallet-send', data),
  cliMineStart: (data) => ipcRenderer.invoke('cli-mine-start', data),
  cliMineStop: () => ipcRenderer.invoke('cli-mine-stop'),
  cliMineStatus: () => ipcRenderer.invoke('cli-mine-status'),
  cliNodeStart: (data) => ipcRenderer.invoke('cli-node-start', data),
  cliNodeStop: () => ipcRenderer.invoke('cli-node-stop'),
  cliConfigGet: (data) => ipcRenderer.invoke('cli-config-get', data),
  cliConfigSet: (data) => ipcRenderer.invoke('cli-config-set', data),

  // ── Bridge CLI (lock / burn) ───────────────────────────────────────
  cliBridgeStatus: () => ipcRenderer.invoke('cli-bridge-status'),
  cliBridgePending: () => ipcRenderer.invoke('cli-bridge-pending'),
  cliBridgeHistory: (data) => ipcRenderer.invoke('cli-bridge-history', data),
  cliBridgeChains: () => ipcRenderer.invoke('cli-bridge-chains'),
  cliBridgeLock: (data) => ipcRenderer.invoke('cli-bridge-lock', data),
  cliBridgeBurn: (data) => ipcRenderer.invoke('cli-bridge-burn', data),

  // ── DAO CLI ────────────────────────────────────────────────────────
  cliDaoStatus: () => ipcRenderer.invoke('cli-dao-status'),
  cliDaoProposals: () => ipcRenderer.invoke('cli-dao-proposals'),
  cliDaoTreasury: () => ipcRenderer.invoke('cli-dao-treasury'),
  cliDaoParams: () => ipcRenderer.invoke('cli-dao-params'),
  daoGetProposals: () => ipcRenderer.invoke('dao-get-proposals'),
  daoGetTreasury: () => ipcRenderer.invoke('dao-get-treasury'),
  daoGetStatus: () => ipcRenderer.invoke('dao-get-status'),
  daoGetParams: () => ipcRenderer.invoke('dao-get-params'),
  bridgeGetStatus: () => ipcRenderer.invoke('bridge-get-status'),
  bridgeGetTransactions: (data) => ipcRenderer.invoke('bridge-get-transactions', data),
  warpGetStatus: () => ipcRenderer.invoke('warp-get-status'),

  // ── Pool CLI ─────────────────────────────────────────────────────
  cliPoolStats: (data) => ipcRenderer.invoke('cli-pool-stats', data),
  cliPoolMiners: (data) => ipcRenderer.invoke('cli-pool-miners', data),
  cliPoolConfig: (data) => ipcRenderer.invoke('cli-pool-config', data),
  cliPoolEarnings: (data) => ipcRenderer.invoke('cli-pool-earnings', data),

  // ── Warp CLI ───────────────────────────────────────────────────────
  cliWarpStatus: () => ipcRenderer.invoke('cli-warp-status'),
  cliWarpChains: () => ipcRenderer.invoke('cli-warp-chains'),
  cliWarpPending: () => ipcRenderer.invoke('cli-warp-pending'),
  cliWarpStats: () => ipcRenderer.invoke('cli-warp-stats'),
  cliWarpEstimate: (data) => ipcRenderer.invoke('cli-warp-estimate', data),

  // ── Swap CLI (DEX) ─────────────────────────────────────────────────
  cliSwapQuote: (data) => ipcRenderer.invoke('cli-swap-quote', data),
  cliSwapExecute: (data) => ipcRenderer.invoke('cli-swap-execute', data),

  // ── Atomic Swap CLI (HTLC) ─────────────────────────────────────────
  cliAtomicSwapStatus: () => ipcRenderer.invoke('cli-atomic-swap-status'),
  cliAtomicSwapEscrow: () => ipcRenderer.invoke('cli-atomic-swap-escrow'),
  cliAtomicSwapGet: (data) => ipcRenderer.invoke('cli-atomic-swap-get', data),
  cliAtomicSwapCreate: (data) => ipcRenderer.invoke('cli-atomic-swap-create', data),
  cliAtomicSwapPending: () => ipcRenderer.invoke('cli-atomic-swap-pending'),
  cliAtomicSwapClaim: (data) => ipcRenderer.invoke('cli-atomic-swap-claim', data),
  cliAtomicSwapRefund: (data) => ipcRenderer.invoke('cli-atomic-swap-refund', data),

  // Open URL in system browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Generic invoke (for dynamic handler calls)
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // Cleanup listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('Preload script loaded - electronAPI available');
