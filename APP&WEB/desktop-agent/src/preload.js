// ZION Desktop Mining Agent v2.9.6 - Preload Script
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
  getCh3Status: () => ipcRenderer.invoke('get-ch3-status'),
  autoSelectPool: () => ipcRenderer.invoke('auto-select-pool'),
  getPeerList: () => ipcRenderer.invoke('get-peer-list'),

  // AI / Chat
  aiChat: (data) => ipcRenderer.invoke('ai-chat', data),

  // AI Afterburner (commands)
  afterburnerCommand: (data) => ipcRenderer.invoke('afterburner-command', data),

  // AI Native (consciousness mining integration)
  aiNativeStart: (config) => ipcRenderer.invoke('ai-native-start', config),
  aiNativeStop: () => ipcRenderer.invoke('ai-native-stop'),
  aiNativeStats: () => ipcRenderer.invoke('ai-native-stats'),
  aiNativeStatus: () => ipcRenderer.invoke('ai-native-status'),
  
  // AI Native - New operations
  aiNativeChat: (messages) => ipcRenderer.invoke('ai-native-chat', messages),
  aiNativeSearchKnowledge: (query, limit) => ipcRenderer.invoke('ai-native-search-knowledge', query, limit),
  aiNativeAsk: (question) => ipcRenderer.invoke('ai-native-ask', question),
  aiNativeDashboard: () => ipcRenderer.invoke('ai-native-dashboard'),
  aiNativeBlockchainStatus: () => ipcRenderer.invoke('ai-native-blockchain-status'),
  aiNativePoolMonitor: () => ipcRenderer.invoke('ai-native-pool-monitor'),
  aiNativeSystemHealth: () => ipcRenderer.invoke('ai-native-system-health'),

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
  onStreamSwitch: (callback) => {
    ipcRenderer.on('stream-switch', (event, data) => callback(data));
  },
  onStatsUpdate: (callback) => {
    ipcRenderer.on('stats-update', (event, data) => callback(data));
  },

  // ── CH3 Multi-Stream (dual/triple mining: ZION + GPU coin + CPU revenue) ──
  getMultiStreamStatus: () => ipcRenderer.invoke('get-multi-stream-status'),
  onMultiStreamStatus: (callback) => {
    ipcRenderer.on('multi-stream-status', (event, data) => callback(data));
  },
  onMinerBackend: (callback) => {
    ipcRenderer.on('miner-backend', (event, data) => callback(data));
  },
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config-updated', (event) => callback());
  },

  // ── L2 Bridge (wZION, Base EVM) ──────────────────────────────────────────
  bridgeGetWzionBalance: (evmAddress) => ipcRenderer.invoke('bridge-get-wzion-balance', evmAddress),
  bridgeGetStats: () => ipcRenderer.invoke('bridge-get-stats'),
  bridgeTxStatus: (txHash) => ipcRenderer.invoke('bridge-tx-status', txHash),
  bridgePrepareLock: (evmRecipient) => ipcRenderer.invoke('bridge-prepare-lock', evmRecipient),

  // ── L2 DAO (Governance, Treasury, Proposals) ─────────────────────────────
  daoGetStats: () => ipcRenderer.invoke('dao-get-stats'),
  daoGetProposals: (params) => ipcRenderer.invoke('dao-get-proposals', params),
  daoGetProposal: (id) => ipcRenderer.invoke('dao-get-proposal', id),
  daoCreateProposal: (data) => ipcRenderer.invoke('dao-create-proposal', data),
  daoGetVotes: (id) => ipcRenderer.invoke('dao-get-votes', id),
  daoCastVote: (data) => ipcRenderer.invoke('dao-cast-vote', data),
  daoGetTreasury: () => ipcRenderer.invoke('dao-get-treasury'),
  daoHealth: () => ipcRenderer.invoke('dao-health'),

  // ── L3 WARP (Cross-chain Bridge Router) ──────────────────────────────────
  warpGetHealth: () => ipcRenderer.invoke('warp-get-health'),
  warpGetChains: () => ipcRenderer.invoke('warp-get-chains'),
  warpGetMetrics: () => ipcRenderer.invoke('warp-get-metrics'),
  warpGetTransfers: () => ipcRenderer.invoke('warp-get-transfers'),
  warpGetPendingTransfers: () => ipcRenderer.invoke('warp-get-pending-transfers'),
  warpGetTransfer: (id) => ipcRenderer.invoke('warp-get-transfer', id),
  warpInitiateOutbound: (data) => ipcRenderer.invoke('warp-initiate-outbound', data),
  warpInitiateInbound: (data) => ipcRenderer.invoke('warp-initiate-inbound', data),
  warpAdvanceTransfer: (data) => ipcRenderer.invoke('warp-advance-transfer', data),

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

  // Cleanup listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('Preload script loaded - electronAPI available');
