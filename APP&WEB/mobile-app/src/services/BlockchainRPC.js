/**
 * ZION Blockchain RPC Service v2.9.5
 * Direct communication with ZION blockchain nodes
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

// Default RPC endpoints (with failover) — v2.9.5 canonical ports
const DEFAULT_RPC_NODES = [
  'https://rpc.zionterranova.com',
  'http://77.42.31.72:8444',      // Helsinki (seed node)
  'http://5.78.145.234:8444',     // USA
  'http://5.223.56.124:8444',     // Singapore
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
   * Send JSON-RPC request with automatic failover
   */
  async rpcCall(method, params = {}) {
    const maxRetries = this.rpcNodes.length;
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
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

        return response.data.result;
      } catch (error) {
        lastError = error;
        console.error(`RPC call failed on ${this.rpcUrl}:`, error.message);
        this.nextNode();
      }
    }

    throw new Error(`All RPC nodes failed: ${lastError?.message}`);
  }

  // ==================== BLOCKCHAIN QUERIES ====================

  /**
   * Get current block height
   */
  async getBlockCount() {
    return await this.rpcCall('getblockcount');
  }

  /**
   * Get block by height or hash
   */
  async getBlock(heightOrHash) {
    return await this.rpcCall('getblock', { block: heightOrHash });
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
    return await this.rpcCall('getnetworkinfo');
  }

  /**
   * Get blockchain info
   */
  async getBlockchainInfo() {
    return await this.rpcCall('getblockchaininfo');
  }

  // ==================== WALLET QUERIES ====================

  /**
   * Get address balance (in atomic units → convert to ZION)
   * @param {string} address - ZION address (zion1...)
   * @returns {Promise<number>} Balance in ZION
   */
  async getBalance(address) {
    try {
      const result = await this.rpcCall('getbalance', { address });
      const atomic = result?.balance ?? result ?? 0;
      // Core returns atomic units; convert to ZION
      return typeof atomic === 'number' && atomic > 1_000_000
        ? atomic / 1_000_000
        : atomic;
    } catch (error) {
      console.error('getBalance error:', error);
      return 0;
    }
  }

  /**
   * Get address UTXO set.
   * Each UTXO: { txid, vout, amount (atomic), height, coinbase }
   * @param {string} address - ZION address
   * @returns {Promise<Array>} Array of UTXO objects
   */
  async getUTXOs(address) {
    try {
      const result = await this.rpcCall('getutxos', { address });
      return result?.utxos || result || [];
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
      const result = await this.rpcCall('gettransactions', { 
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
    return await this.rpcCall('gettransaction', { hash: txHash });
  }

  // ==================== TRANSACTION OPERATIONS ====================

  /**
   * Broadcast signed transaction to network.
   * Expects hex-encoded serialized JSON transaction from TransactionBuilder.
   * @param {string} signedTxHex - Hex-encoded signed transaction
   * @returns {Promise<string>} Transaction hash
   */
  async broadcastTransaction(signedTxHex) {
    const result = await this.rpcCall('sendrawtransaction', { 
      tx: signedTxHex 
    });
    
    if (!result || !result.txid) {
      throw new Error(result?.error || 'Failed to broadcast transaction');
    }

    console.log(`✅ Transaction broadcast: ${result.txid}`);
    return result.txid;
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
      const poolUrl = CONFIG.POOL_API_URL || 'http://77.42.31.72:8080';
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
      const poolUrl = CONFIG.POOL_API_URL || 'http://77.42.31.72:8080';
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
