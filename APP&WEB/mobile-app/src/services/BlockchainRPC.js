/**
 * ZION Blockchain RPC Service v3.0.0
 * Direct communication with ZION V3 blockchain nodes
 * 
 * Features:
 * - JSON-RPC 2.0 client
 * - Transaction broadcasting
 * - Balance queries
 * - Block information
 * - Multi-node failover
 */

import axios from 'axios';
import { CONFIG } from '../constants/config';

// Default RPC endpoints (with failover) — V3 mainnet canonical port 8443
const DEFAULT_RPC_NODES = [
  'https://rpc.zionterranova.com',
  'http://77.42.71.94:8443/jsonrpc',     // Edge (public primary)
];

class BlockchainRPC {
  constructor() {
    this.rpcNodes = DEFAULT_RPC_NODES;
    this.currentNodeIndex = 0;
    this.client = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.healthStatus = new Map();
  }

  /**
   * Get current RPC URL
   */
  get rpcUrl() {
    return this.rpcNodes[this.currentNodeIndex];
  }

  /**
   * Switch to next RPC node (failover)
   */
  nextNode() {
    this.currentNodeIndex = (this.currentNodeIndex + 1) % this.rpcNodes.length;
    console.log(`🔄 Switching to RPC node: ${this.rpcUrl}`);
  }

  /**
   * Send JSON-RPC request with automatic failover and exponential backoff.
   * Retries across all nodes with a short delay between attempts.
   */
  async rpcCall(method, params = {}, options = {}) {
    const maxRetriesPerNode = options.maxRetriesPerNode ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 500;
    const maxAttempts = this.rpcNodes.length * maxRetriesPerNode;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.client.post(this.rpcUrl, {
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        });

        if (response.data.error) {
          throw new Error(response.data.error.message || 'RPC Error');
        }

        this.healthStatus.set(this.rpcUrl, { ok: true, lastOk: Date.now() });
        return response.data.result;
      } catch (error) {
        lastError = error;
        this.healthStatus.set(this.rpcUrl, { ok: false, lastError: error.message, lastFail: Date.now() });
        console.error(`RPC call failed on ${this.rpcUrl} (attempt ${attempt + 1}/${maxAttempts}):`, error.message);

        // Exponential backoff before next attempt
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));

        this.nextNode();
      }
    }

    throw new Error(`All RPC nodes failed after ${maxAttempts} attempts: ${lastError?.message}`);
  }

  // ==================== BLOCKCHAIN QUERIES ====================

  /**
   * Get current block height
   */
  async getBlockCount() {
    const info = await this.rpcCall('getChainInfo');
    return info?.height ?? info?.chain_height ?? info;
  }

  /**
   * Get block by height or hash
   */
  async getBlock(heightOrHash) {
    return await this.rpcCall('getBlockByHeight', { height: heightOrHash });
  }

  /**
   * Get latest block
   */
  async getLatestBlock() {
    const height = await this.getBlockCount();
    return await this.getBlock(height);
  }

  /**
   * Get network info
   */
  async getNetworkInfo() {
    return await this.rpcCall('getNodeInfo');
  }

  /**
   * Get blockchain info (V3: getChainInfo)
   */
  async getBlockchainInfo() {
    return await this.rpcCall('getChainInfo');
  }

  // ==================== WALLET QUERIES ====================

  /**
   * Get address balance (in ZION human units).
   * @param {string} address - ZION address (zion1...)
   * @returns {Promise<{zion:number, atomic:string, utxoCount:number, chainHeight:number}>}
   */
  async getBalance(address) {
    try {
      const result = await this.rpcCall('getBalance', { address });
      // V3 returns: { balance_flowers: "...", utxo_balance_flowers, chain_height, ... }
      // balance_flowers is a string in atomic flowers (1 ZION = 1e6 flowers)
      const flowers = result?.balance_flowers !== undefined
        ? (typeof result.balance_flowers === 'string'
            ? BigInt(result.balance_flowers)
            : BigInt(result.balance_flowers))
        : 0n;
      const zion = Number(flowers) / 1_000_000;

      return {
        zion,
        atomic: flowers.toString(),
        utxoCount: result?.utxo_count ?? 0,
        chainHeight: result?.chain_height ?? 0,
        raw: result,
      };
    } catch (error) {
      console.error('getBalance error:', error);
      return { zion: 0, atomic: '0', utxoCount: 0, chainHeight: 0, raw: null };
    }
  }

  /**
   * Get spendable UTXOs for an address.
   * Returns V3-compatible format: { tx_hash, output_index, amount, address }.
   * Also includes legacy aliases (txid, vout) for backward compat.
   * @param {string} address - ZION address
   * @returns {Promise<Array<{tx_hash:string, output_index:number, amount:bigint, address:string}>>}
   */
  async getUTXOs(address) {
    try {
      const result = await this.rpcCall('getUtxos', { address });
      const raw = result?.utxos || [];
      return raw.map(u => ({
        // V3 canonical fields
        tx_hash: u.tx_hash || u.txid || '',
        output_index: u.output_index !== undefined ? u.output_index : (u.vout || 0),
        amount: BigInt(u.amount || 0),
        address: u.address || '',
        height: u.height || 0,
        // Legacy aliases (backward compat)
        txid: u.tx_hash || u.txid || '',
        vout: u.output_index !== undefined ? u.output_index : (u.vout || 0),
      }));
    } catch (error) {
      console.error('getUTXOs error:', error);
      return [];
    }
  }

  /**
   * Get transaction history for address
   * @param {string} address - ZION address
   * @param {number} limit - Max transactions to return
   */
  async getTransactionHistory(address, limit = 50) {
    try {
      const result = await this.rpcCall('getAccountTransaction', { 
        address, 
        limit 
      });
      return result?.transactions || result || [];
    } catch (error) {
      console.error('getTransactionHistory error:', error);
      return [];
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash) {
    return await this.rpcCall('getTransaction', { txid: txHash });
  }

  // ==================== TRANSACTION OPERATIONS ====================

  /**
   * Broadcast signed transaction to network.
   * Expects hex-encoded serialized JSON transaction from TransactionBuilder.
   * @param {string} signedTxHex - Hex-encoded signed transaction
   * @returns {Promise<string>} Transaction hash
   */
  async broadcastTransaction(signedTxObj) {
    // V3 expects a transaction JSON object, not hex.
    // submitTransaction accepts both account-model and UTXO-model transactions.
    const txPayload = typeof signedTxObj === 'string'
      ? JSON.parse(signedTxObj)
      : signedTxObj;

    const result = await this.rpcCall('submitTransaction', { 
      transaction: txPayload 
    });
    
    if (!result?.accepted && !result?.tx_id) {
      throw new Error(result?.error || 'Failed to broadcast transaction');
    }

    const txId = result.tx_id || result.txid;
    console.log(`✅ Transaction broadcast: ${txId}`);
    return txId;
  }

  /**
   * Broadcast an Account-model transaction.
   * Uses submitAccountTransaction RPC method.
   * @param {Object} accountTx - Signed AccountTransaction payload
   * @returns {Promise<string>} Transaction hash
   */
  async broadcastAccountTransaction(accountTx) {
    const result = await this.rpcCall('submitAccountTransaction', {
      transaction: accountTx
    });

    if (!result?.accepted && !result?.tx_id) {
      // Fallback: generic submitTransaction also accepts account txs
      const fallbackResult = await this.rpcCall('submitTransaction', {
        transaction: accountTx
      });
      if (fallbackResult?.accepted || fallbackResult?.tx_id) {
        const txId = fallbackResult.tx_id || fallbackResult.txid;
        console.log(`✅ Account tx broadcast (via submitTransaction): ${txId}`);
        return txId;
      }
      throw new Error(result?.error || 'Failed to broadcast account transaction');
    }

    const txId = result.tx_id || result.txid;
    console.log(`✅ Account tx broadcast: ${txId}`);
    return txId;
  }

  /**
   * Create and broadcast a transaction
   * This is a high-level method that:
   * 1. Gets UTXOs
   * 2. Creates transaction
   * 3. Signs it
   * 4. Broadcasts
   * 
   * @param {Object} params
   * @param {string} params.from - Sender address
   * @param {string} params.to - Recipient address  
   * @param {number} params.amount - Amount in ZION
   * @param {number} params.fee - Fee in ZION (optional, auto-calculated)
   * @param {string} params.privateKey - Sender's private key (hex)
   */
  async sendTransaction({ from, to, amount, fee = 0.001, privateKey }) {
    // Validate addresses
    if (!from || !from.startsWith('zion1')) {
      throw new Error('Invalid sender address');
    }
    if (!to || !to.startsWith('zion1')) {
      throw new Error('Invalid recipient address');
    }
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Check balance
    const balance = await this.getBalance(from);
    if (balance < amount + fee) {
      throw new Error(`Insufficient balance. Have: ${balance}, Need: ${amount + fee}`);
    }

    // Create raw transaction
    const rawTx = await this.rpcCall('createrawtransaction', {
      from,
      to,
      amount,
      fee,
    });

    // Sign transaction (done client-side in WalletService)
    // This method expects already-signed tx for broadcast
    
    // For now, return the raw tx to be signed externally
    return {
      rawTx,
      from,
      to,
      amount,
      fee,
    };
  }

  /**
   * Estimate transaction fee
   * @param {number} priority - 1 (low), 2 (normal), 3 (high)
   */
  async estimateFee(priority = 2) {
    try {
      const result = await this.rpcCall('estimatefee', { priority });
      return result?.fee || 0.001; // Default 0.001 ZION
    } catch (error) {
      // Return default fee if estimation fails
      return priority === 1 ? 0.0005 : priority === 3 ? 0.005 : 0.001;
    }
  }

  // ==================== CONSCIOUSNESS / NCL ====================

  /**
   * Get consciousness level for address
   */
  async getConsciousnessLevel(address) {
    try {
      const result = await this.rpcCall('getconsciousness', { address });
      return {
        level: result?.level || 'PHYSICAL',
        xp: result?.xp || 0,
        multiplier: result?.multiplier || 1.0,
      };
    } catch (error) {
      return { level: 'PHYSICAL', xp: 0, multiplier: 1.0 };
    }
  }

  // ==================== POOL INTEGRATION ====================

  /**
   * Get pool stats via Pool REST API (port 8080)
   */
  async getPoolStats() {
    try {
      const poolUrl = CONFIG.POOL_URL || 'https://pool.zionterranova.com';
      const response = await this.client.get(`${poolUrl}/api/pool/stats`);
      return response.data;
    } catch (error) {
      console.error('getPoolStats error:', error);
      return null;
    }
  }

  /**
   * Get miner stats from pool
   */
  async getMinerStats(address) {
    try {
      const poolUrl = CONFIG.POOL_URL || 'https://pool.zionterranova.com';
      const response = await this.client.get(`${poolUrl}/api/miner/${address}`);
      return response.data;
    } catch (error) {
      console.error('getMinerStats error:', error);
      return null;
    }
  }

  // ==================== EMISSION INFO ====================

  /**
   * Get current emission status from node
   */
  async getEmissionInfo() {
    try {
      const height = await this.getBlockCount();
      // Import locally to avoid circular deps
      const {
        BLOCK_REWARD_ZION,
        TOTAL_MINING_BLOCKS,
        GENESIS_PREMINE,
        circulatingSupply,
        remainingMining,
      } = require('../constants/blockchain');

      return {
        height,
        blockReward: BLOCK_REWARD_ZION,
        circulatingSupply: circulatingSupply(height),
        remaining: remainingMining(height),
        emissionComplete: height > TOTAL_MINING_BLOCKS,
      };
    } catch (error) {
      console.error('getEmissionInfo error:', error);
      return null;
    }
  }

  // ==================== UTILITY ====================

  /**
   * Check if connected to network
   */
  async isConnected() {
    try {
      await this.getBlockCount();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    try {
      const info = await this.getBlockchainInfo();
      return {
        synced: info?.synced || true,
        currentBlock: info?.blocks || 0,
        highestBlock: info?.headers || info?.blocks || 0,
        progress: info?.verificationprogress || 1.0,
      };
    } catch (error) {
      return { synced: true, currentBlock: 0, highestBlock: 0, progress: 1.0 };
    }
  }

  /**
   * Alias: broadcast via sendRawTransaction (matches Rust core method name).
   */
  async sendRawTransaction(signedTxObj) {
    return this.broadcastTransaction(signedTxObj);
  }

  /**
   * Health-check all configured RPC nodes.
   * @returns {Promise<Array<{url:string, ok:boolean, height?:number, latencyMs:number, error?:string}>>}
   */
  async healthCheck() {
    const results = [];
    for (const url of this.rpcNodes) {
      const start = Date.now();
      try {
        const response = await this.client.post(url, {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'getChainInfo',
          params: {},
        }, { timeout: 5000 });
        const latency = Date.now() - start;
        if (response.data.error) {
          results.push({ url, ok: false, latencyMs: latency, error: response.data.error.message });
        } else {
          results.push({ url, ok: true, height: response.data.result?.height ?? response.data.result?.chain_height, latencyMs: latency });
        }
      } catch (error) {
        results.push({ url, ok: false, latencyMs: Date.now() - start, error: error.message });
      }
    }
    return results;
  }

  /**
   * Set custom RPC nodes
   */
  setRpcNodes(nodes) {
    if (Array.isArray(nodes) && nodes.length > 0) {
      this.rpcNodes = nodes;
      this.currentNodeIndex = 0;
    }
  }
}

// Export singleton instance
export default new BlockchainRPC();
