// Preload pro Kingdom SSR okno — jediný most mezi Kingdom UI (renderer)
// a privilegovaným main procesem desktop klienta.
//
// window.zion je tenká fasáda na existující IPC kanály agenta — peněženka,
// mining a config žijí v main.js (stejně jako agentí UI přes electronAPI).
// Renderer nikdy nevidí seed/klíč; dostává jen serializovatelné výsledky.
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('zion', {
  app: {
    info: () => invoke('zion:app:info'),
    openMiner: () => invoke('zion:app:open-miner'),
  },
  wallet: {
    // Stav: existují-li wallets + primární adresa (config.wallet || první).
    // Agent model nemá lock/unlock — heslo se ptá při každém podpisu.
    status: async () => {
      const [wallets, config] = await Promise.all([
        invoke('list-wallets'),
        invoke('get-config'),
      ]);
      const list = wallets?.success ? wallets.wallets || [] : [];
      const primary = config?.wallet || list[0]?.address || null;
      return {
        ok: true,
        data: {
          exists: list.length > 0,
          unlocked: list.length > 0,
          address: primary,
          count: list.length,
        },
      };
    },
    balance: async (address) => {
      const r = await invoke('wallet-get-balance', { rpcUrl: null, address });
      if (!r?.success) return { ok: false, error: r?.error || 'balance failed' };
      return {
        ok: true,
        data: {
          address,
          total: r.balance ?? 0,
          spendable: r.balance ?? 0,
          utxoCount: r.utxo_count ?? (Array.isArray(r.utxos) ? r.utxos.length : 0),
          unlocked: true,
        },
      };
    },
    create: async (password) => {
      const gen = await invoke('generate-wallet');
      if (!gen?.success) return { ok: false, error: gen?.error || 'generate failed' };
      const save = await invoke('save-wallet', { wallet: gen.wallet, password, name: 'Kingdom' });
      if (!save?.success) return { ok: false, error: save?.error || 'save failed' };
      return { ok: true, data: { address: gen.wallet.address, mnemonic: gen.wallet.mnemonic } };
    },
    importMnemonic: async ({ mnemonic, password }) => {
      const r = await invoke('import-wallet', { mnemonic, password, name: 'Kingdom' });
      if (!r?.success) return { ok: false, error: r?.error || 'import failed' };
      return { ok: true, data: { address: r.address } };
    },
    // Heslo je povinné při každém podpisu (agent model — klíč leží zašifrovaný).
    send: async ({ from, to, amountZion, memo, password }) => {
      const r = await invoke('wallet-send-transaction', {
        rpcUrl: null,
        from,
        to,
        amount: amountZion,
        memo,
        password,
      });
      if (!r?.success) return { ok: false, error: r?.error || 'send failed' };
      return { ok: true, data: { tx_id: r.txId || r.tx_id || '', status: 'submitted' } };
    },
    // Lock/unlock neexistuje v agent modelu — panel je nevolá.
    unlock: async () => ({ ok: true, data: { unlocked: true } }),
    lock: async () => ({ ok: true, data: { unlocked: true } }),
  },
});
