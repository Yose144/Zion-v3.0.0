/**
 * TransactionBuilder unit tests — v3.0.0
 * Validates UTXO selection, fee estimation, build + sign + verify flow.
 */

const {
  selectUTXOs,
  estimateTransactionFee,
  buildTransaction,
  transactionHash,
  signTransaction,
  verifyTransaction,
  serializeTransaction,
  createSignedTransaction,
} = require('../TransactionBuilder');

const { zionToAtomic } = require('../../constants/blockchain');

describe('TransactionBuilder', () => {
  const sampleUtxos = [
    { txid: 'aa'.repeat(32), vout: 0, amount: zionToAtomic(1000) },
    { txid: 'bb'.repeat(32), vout: 1, amount: zionToAtomic(500) },
    { txid: 'cc'.repeat(32), vout: 0, amount: zionToAtomic(200) },
  ];

  describe('selectUTXOs', () => {
    it('selects sufficient UTXOs for amount + fee', () => {
      const target = zionToAtomic(600);
      const fee = zionToAtomic(0.001);
      const { selected, totalIn, change } = selectUTXOs(sampleUtxos, target, fee);
      expect(selected.length).toBe(2); // 1000 + 500 covers 600
      expect(totalIn).toBeGreaterThanOrEqual(target + fee);
      expect(change).toBe(totalIn - target - fee);
    });

    it('throws on insufficient funds', () => {
      expect(() =>
        selectUTXOs(sampleUtxos, zionToAtomic(9999), zionToAtomic(0.001)),
      ).toThrow('Insufficient funds');
    });

    it('throws on empty UTXO list', () => {
      expect(() => selectUTXOs([], zionToAtomic(1), 0)).toThrow('No UTXOs available');
    });
  });

  describe('estimateTransactionFee', () => {
    it('estimates fee for 1 input / 2 outputs', () => {
      const fee = estimateTransactionFee(1, 2);
      expect(fee.bytes).toBe(1 * 250 + 2 * 34 + 10);
      expect(fee.feeAtomic).toBe(fee.bytes);
      expect(fee.feeZion).toBe(fee.bytes / 1_000_000);
    });
  });

  describe('buildTransaction', () => {
    it('builds unsigned transaction with change output', () => {
      const { tx, feeUsed } = buildTransaction({
        from: 'zion1sender0000000000000000000000000000000',
        to: 'zion1receiver000000000000000000000000000000',
        amountZion: 100,
        utxos: sampleUtxos,
      });
      expect(tx.version).toBe(1);
      expect(tx.inputs.length).toBeGreaterThanOrEqual(1);
      expect(tx.outputs.length).toBe(2); // recipient + change
      expect(feeUsed).toBeGreaterThan(0);
    });

    it('builds transaction without change when exact amount', () => {
      const exactUtxos = [{ txid: 'dd'.repeat(32), vout: 0, amount: zionToAtomic(10.001) }];
      const { tx } = buildTransaction({
        from: 'zion1sender0000000000000000000000000000000',
        to: 'zion1receiver000000000000000000000000000000',
        amountZion: 10,
        feeZion: 0.001,
        utxos: exactUtxos,
      });
      expect(tx.outputs.length).toBe(1);
    });

    it('throws for invalid amount', () => {
      expect(() =>
        buildTransaction({ from: 'zion1sender', to: 'zion1recv', amountZion: 0, utxos: sampleUtxos }),
      ).toThrow('Amount must be positive');
    });
  });

  describe('sign and verify', () => {
    it('produces a verifiable signed transaction', async () => {
      const { tx } = buildTransaction({
        from: 'zion1sender0000000000000000000000000000000',
        to: 'zion1receiver000000000000000000000000000000',
        amountZion: 100,
        utxos: sampleUtxos,
      });

      // Dummy Ed25519 private key (32 zero bytes — NOT for production!)
      const dummyPrivateKey = Buffer.alloc(32, 0x42);
      const signedTx = await signTransaction(tx, dummyPrivateKey);

      expect(signedTx.inputs[0].signature).toBeTruthy();
      expect(signedTx.inputs[0].public_key).toBeTruthy();

      const valid = await verifyTransaction(signedTx);
      expect(valid).toBe(true);
    });

    it('rejects tampered signed transaction', async () => {
      const { tx } = buildTransaction({
        from: 'zion1sender0000000000000000000000000000000',
        to: 'zion1receiver000000000000000000000000000000',
        amountZion: 100,
        utxos: sampleUtxos,
      });

      const dummyPrivateKey = Buffer.alloc(32, 0x42);
      const signedTx = await signTransaction(tx, dummyPrivateKey);

      // Tamper an output amount
      signedTx.outputs[0].amount += 1;
      const valid = await verifyTransaction(signedTx);
      expect(valid).toBe(false);
    });
  });

  describe('createSignedTransaction', () => {
    it('returns hex, txHash and feeUsed', async () => {
      const dummyPrivateKey = Buffer.alloc(32, 0x42);
      const result = await createSignedTransaction({
        from: 'zion1sender0000000000000000000000000000000',
        to: 'zion1receiver000000000000000000000000000000',
        amountZion: 50,
        utxos: sampleUtxos,
        privateKey: dummyPrivateKey,
      });

      expect(result.hex).toBeTruthy();
      expect(result.txHash).toHaveLength(64);
      expect(result.feeUsed).toBeGreaterThan(0);
      expect(result.tx).toBeDefined();
    });
  });
});
