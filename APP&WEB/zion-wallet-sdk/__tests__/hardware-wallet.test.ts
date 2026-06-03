import { WalletManager } from '../src/wallet/wallet-manager';
import { TrezorWallet } from '../src/hardware/trezor-wallet';
import { LedgerWallet } from '../src/hardware/ledger-wallet';
import { GenericHIDWallet } from '../src/hardware/generic-hid-wallet';
import type { StorageInterface } from '../src/storage/storage-interface';

class MockStorage implements StorageInterface {
  private store = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.store.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.store.set(key, value); }
  async removeItem(key: string): Promise<void> { this.store.delete(key); }
}

// Mock Trezor — bypasses dynamic import by overriding getAddress
class MockTrezor extends TrezorWallet {
  mockAddress = 'zion1testtrezorwalletaddr00000000000000ckzz';
  mockPublicKey = 'aabbccdd00112233445566778899aabbccddeeff00112233445566778899aabb';

  override async connect(): Promise<void> {
    // no-op — no real Trezor needed
  }
  override disconnect(): void {
    // no-op
  }
  override async getAddress(_path?: string, _verify?: boolean) {
    return {
      address: this.mockAddress,
      publicKey: this.mockPublicKey,
      path: _path ?? "m/44'/0'/0'",
    };
  }
}

// Mock Ledger
class MockLedger extends LedgerWallet {
  mockAddress = 'zion1testledgerwalletaddr0000000000000ckzz';
  mockPublicKey = 'deadbeef00112233445566778899aabbccddeeff00112233445566778899aabb';

  override async connect(): Promise<void> {}
  override disconnect(): void {}
  override async getAddress(_path?: string, _verify?: boolean) {
    return {
      address: this.mockAddress,
      publicKey: this.mockPublicKey,
      path: _path ?? "m/1852'/1815'/0'/0/0",
    };
  }
}

// Mock Generic HID
class MockHID extends GenericHIDWallet {
  mockAddress = 'zion1testhidwalletaddr000000000000000ckzz';
  mockPublicKey = 'cafebabe00112233445566778899aabbccddeeff00112233445566778899aabb';

  override async connect(): Promise<void> { this.connected = true; }
  override disconnect(): void { this.connected = false; }
  override async getAddress(_path?: string, _verify?: boolean) {
    return {
      address: this.mockAddress,
      publicKey: this.mockPublicKey,
      path: _path ?? "m/44'/0'/0'",
    };
  }
}

describe('Hardware Wallet Integration', () => {
  let manager: WalletManager;

  beforeEach(async () => {
    manager = new WalletManager(new MockStorage(), { nodes: [] });
    await manager.initialize();
  });

  it('imports from Trezor (watch-only)', async () => {
    const trezor = new MockTrezor();
    const wallet = await manager.importFromTrezor({ name: 'My Trezor', trezorWallet: trezor });
    expect(wallet.address).toBe(trezor.mockAddress);
    expect(wallet.name).toBe('My Trezor');
    expect(wallet.keyType).toBe('trezor');
  });

  it('imports from Ledger (watch-only)', async () => {
    const ledger = new MockLedger();
    const wallet = await manager.importFromLedger({ name: 'My Ledger', ledgerWallet: ledger });
    expect(wallet.address).toBe(ledger.mockAddress);
    expect(wallet.name).toBe('My Ledger');
    expect(wallet.keyType).toBe('ledger');
  });

  it('imports from Generic HID', async () => {
    const hid = new MockHID();
    const wallet = await manager.importFromGenericHID({ name: 'My HID', device: hid });
    expect(wallet.address).toBe(hid.mockAddress);
    expect(wallet.name).toBe('My HID');
    expect(wallet.keyType).toBe('hid');
  });

  it('blocks private key export for Trezor', async () => {
    const trezor = new MockTrezor();
    const wallet = await manager.importFromTrezor({ trezorWallet: trezor });
    await expect(manager.exportPrivateKey(wallet.id, 'any')).rejects.toThrow(
      'Hardware wallet private key never leaves the device'
    );
  });

  it('blocks private key export for Ledger', async () => {
    const ledger = new MockLedger();
    const wallet = await manager.importFromLedger({ ledgerWallet: ledger });
    await expect(manager.exportPrivateKey(wallet.id, 'any')).rejects.toThrow(
      'Hardware wallet private key never leaves the device'
    );
  });

  it('blocks mnemonic export for hardware wallets', async () => {
    const trezor = new MockTrezor();
    const wallet = await manager.importFromTrezor({ trezorWallet: trezor });
    await expect(manager.exportMnemonic(wallet.id, 'any')).rejects.toThrow(
      'Hardware wallet mnemonic never leaves the device'
    );
  });

  it('blocks send for hardware wallets', async () => {
    const trezor = new MockTrezor();
    const wallet = await manager.importFromTrezor({ trezorWallet: trezor });
    await expect(
      manager.send({ walletId: wallet.id, toAddress: trezor.mockAddress, amountZion: 1, password: 'x' })
    ).rejects.toThrow('Transaction signing for hardware wallets is not yet supported');
  });
});
