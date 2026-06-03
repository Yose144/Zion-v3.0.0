import { WalletManager } from '../src/wallet/wallet-manager';
import type { StorageInterface } from '../src/storage/storage-interface';

class MockStorage implements StorageInterface {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('WalletManager', () => {
  let manager: WalletManager;

  beforeEach(async () => {
    manager = new WalletManager(new MockStorage(), { nodes: [] });
    await manager.initialize();
  });

  it('creates a wallet', async () => {
    const wallet = await manager.createWallet({ name: 'Test', password: 'Password123!' });
    expect(wallet.id).toBeDefined();
    expect(wallet.address).toBeDefined();
    expect(wallet.address.startsWith('zion1')).toBe(true);
    expect(wallet.name).toBe('Test');
  });

  it('creates a wallet whose mnemonic matches the derived keypair (no double generation)', async () => {
    const wallet = await manager.createWallet({ name: 'BugCheck', password: 'Password123!' });
    // Export the mnemonic and re-derive the keypair — must match the wallet address
    const exportedMnemonic = await manager.exportMnemonic(wallet.id, 'Password123!');
    const { deriveKeypairFromMnemonic } = await import('../src/core/keypair');
    const { publicKeyToAddress } = await import('../src/core/address');
    const { publicKey } = await deriveKeypairFromMnemonic(exportedMnemonic);
    const derivedAddress = publicKeyToAddress(publicKey);
    expect(derivedAddress).toBe(wallet.address);
  });

  it('imports from mnemonic', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const wallet = await manager.importFromMnemonic({ mnemonic, password: 'Password123!' });
    expect(wallet.address.startsWith('zion1')).toBe(true);
  });

  it('imports from private key', async () => {
    const hex = 'a'.repeat(64);
    const wallet = await manager.importFromPrivateKey({
      privateKeyHex: hex,
      password: 'Password123!',
    });
    expect(wallet.address.startsWith('zion1')).toBe(true);
  });

  it('lists wallets', async () => {
    await manager.createWallet({ name: 'A', password: 'Password123!' });
    await manager.createWallet({ name: 'B', password: 'Password123!' });
    expect(manager.listWallets()).toHaveLength(2);
  });

  it('sets active wallet', async () => {
    const w = await manager.createWallet({ name: 'A', password: 'Password123!' });
    await manager.setActiveWallet(w.id);
    expect(manager.getActiveWallet()?.id).toBe(w.id);
  });

  it('deletes wallet', async () => {
    const w = await manager.createWallet({ name: 'A', password: 'Password123!' });
    await manager.deleteWallet(w.id);
    expect(manager.getWallet(w.id)).toBeNull();
  });

  it('exports mnemonic', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const w = await manager.importFromMnemonic({ mnemonic, password: 'Password123!' });
    const exported = await manager.exportMnemonic(w.id, 'Password123!');
    expect(exported).toBe(mnemonic);
  });

  it('exports private key', async () => {
    const w = await manager.createWallet({ name: 'A', password: 'Password123!' });
    const pk = await manager.exportPrivateKey(w.id, 'Password123!');
    expect(pk).toHaveLength(64); // 32 bytes hex
  });

  it('stores encrypted payload with current PBKDF2 iterations', async () => {
    const w = await manager.createWallet({ name: 'IterCheck', password: 'Password123!' });
    const raw = await (manager as any).storage.getItem(`zion_wallet_${w.id}`);
    const wallet = JSON.parse(raw!);
    const privateKeyPayload = JSON.parse(wallet.privateKey);
    expect(privateKeyPayload.iterations).toBeGreaterThanOrEqual(600_000);
  });
});
