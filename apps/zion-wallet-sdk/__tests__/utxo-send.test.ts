import { randomBytes } from 'node:crypto';
import { buildUtxoTransaction, maxTxInputs } from '../src/core/transaction';
import { UtxoCollector } from '../src/core/utxo-paging';
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

function utxo(i: number, amount: string, address: string) {
  return {
    tx_hash: (i + 1).toString(16).padStart(64, '0'),
    output_index: 0,
    amount,
    address,
  };
}

describe('UTXO send budget', () => {
  it('caps a 2-output transaction at 177 inputs', () => {
    expect(maxTxInputs(2, 0)).toBe(177);
    expect(maxTxInputs(2, 200)).toBeLessThan(177);
  });

  it('builds a normal payment from one UTXO', async () => {
    const from = 'zion1sender';
    const result = await buildUtxoTransaction({
      fromAddress: from,
      toAddress: 'zion1recipient',
      amountZion: 1,
      utxos: [utxo(1, '5000000', from)],
      privateKey: randomBytes(32),
    });
    expect(result.transaction.inputs).toHaveLength(1);
    expect(result.transaction.outputs.length).toBeGreaterThanOrEqual(1);
    expect(result.tx_id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a fragmented set instead of building an oversized transaction', async () => {
    const from = 'zion1sender';
    const dust = Array.from({ length: 200 }, (_, i) => utxo(i, '1', from));
    await expect(
      buildUtxoTransaction({
        fromAddress: from,
        toAddress: 'zion1recipient',
        amountZion: 1,
        utxos: dust,
        privateKey: randomBytes(32),
      }),
    ).rejects.toThrow(/UTXO set too fragmented: the largest 177 inputs/);
  });

  it('stops paging once the largest inputs cover the amount', () => {
    const collector = new UtxoCollector('zion1sender', 1_000_000n, 177, 2);
    const first = collector.addPage(
      [utxo(1, '1', 'zion1sender'), utxo(2, '1', 'zion1sender')],
      3,
    );
    expect(first.covered).toBe(false);
    expect(first.exhausted).toBe(false);

    const second = collector.addPage([utxo(3, '3000000', 'zion1sender')], 3);
    expect(second.covered).toBe(true);
    expect(collector.list()).toHaveLength(3);
  });
});

describe('WalletManager.send', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('surfaces a fragmented UTXO error instead of an account-model zero balance', async () => {
    const manager = new WalletManager(new MockStorage(), { nodes: ['https://rpc.test'] });
    await manager.initialize();
    const wallet = await manager.createWallet({ name: 'Frag', password: 'Password123!' });

    const dust = Array.from({ length: 200 }, (_, i) => utxo(i, '1', wallet.address));
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      if (body.method === 'getUtxos') {
        return {
          ok: true,
          json: async () => ({
            result: { utxos: dust, total_count: dust.length, total_amount: String(dust.length) },
          }),
        } as Response;
      }
      if (body.method === 'getBalance') {
        return {
          ok: true,
          json: async () => ({
            result: {
              account_balance_flowers: '0',
              utxo_balance_flowers: String(dust.length),
              utxo_count: dust.length,
            },
          }),
        } as Response;
      }
      throw new Error(`unexpected rpc ${body.method}`);
    }) as typeof fetch;

    await expect(
      manager.send({
        walletId: wallet.id,
        toAddress: wallet.address,
        amountZion: 1,
        password: 'Password123!',
      }),
    ).rejects.toThrow(/UTXO set too fragmented/);
  });
});
