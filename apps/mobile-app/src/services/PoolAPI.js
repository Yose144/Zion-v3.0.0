import axios from 'axios';
import {CONFIG} from '../constants/config';

/**
 * Pool API Service v3.0.0
 * Komunikace s ZION mining pool (port 8080)
 *
 * Endpoints match Rust pool server:
 *   GET /api/pool/stats        — Pool-wide statistics
 *   GET /api/miner/:addr       — Miner overview
 *   GET /api/miner/:addr/payments — Payout history
 *   GET /api/pool/blocks       — Recent pool blocks
 *   GET /api/network/info      — Chain info forwarded from core
 *
 * Uzly (aktualizováno 2026-05-24, Core+Edge topologie):
 *   Edge      62.171.141.136:8080    (primární, Hetzner VPS)
 */

// Pool server URLs with failover (Core+Edge topology, 2026-05-24)
const POOL_NODES = [
  'http://62.171.141.136:8080',       // Edge (Hetzner VPS, primární)
];

class PoolAPI {
  constructor() {
    this.nodeIndex = 0;
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  get baseURL() {
    return POOL_NODES[this.nodeIndex];
  }

  nextNode() {
    this.nodeIndex = (this.nodeIndex + 1) % POOL_NODES.length;
  }

  async get(path, params) {
    const maxRetries = POOL_NODES.length;
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await this.client.get(`${this.baseURL}${path}`, { params });
        return response.data;
      } catch (error) {
        lastError = error;
        this.nextNode();
      }
    }
    throw lastError;
  }

  /**
   * Pool statistiky
   */
  async getPoolStats() {
    try {
      return await this.get('/api/pool/stats');
    } catch (error) {
      console.error('Failed to fetch pool stats:', error.message);
      return null;
    }
  }

  /**
   * Statistiky minera (hashrate, shares, pending, consciousness)
   */
  async getMinerStats(address) {
    try {
      return await this.get(`/api/miner/${address}`);
    } catch (error) {
      console.error('Failed to fetch miner stats:', error.message);
      return null;
    }
  }

  /**
   * Consciousness level minera
   */
  async getMinerConsciousness(address) {
    try {
      return await this.get(`/api/miner/${address}/consciousness`);
    } catch (error) {
      console.error('Failed to fetch consciousness:', error.message);
      return null;
    }
  }

  /**
   * Payout historie minera
   */
  async getMinerPayments(address, limit = 20) {
    try {
      return await this.get(`/api/miner/${address}/payments`, {limit});
    } catch (error) {
      console.error('Failed to fetch payments:', error.message);
      return [];
    }
  }

  /**
   * Poslední bloky nalezené poolem
   */
  async getRecentBlocks(limit = 10) {
    try {
      return await this.get('/api/pool/blocks', {limit});
    } catch (error) {
      console.error('Failed to fetch blocks:', error.message);
      return [];
    }
  }

  /**
   * Network info (height, difficulty, peers)
   */
  async getNetworkInfo() {
    try {
      return await this.get('/api/network/info');
    } catch (error) {
      console.error('Failed to fetch network info:', error.message);
      return null;
    }
  }

  /**
   * Wallet balance (via pool → core RPC proxy)
   */
  async getBalance(address) {
    try {
      const data = await this.get(`/api/wallet/${address}/balance`);
      return data?.balance || 0;
    } catch (error) {
      console.error('Failed to fetch balance:', error.message);
      return 0;
    }
  }

  /**
   * Transaction history (via pool → core RPC proxy)
   */
  async getTransactions(address, limit = 20) {
    try {
      return await this.get(`/api/wallet/${address}/transactions`, {limit});
    } catch (error) {
      console.error('Failed to fetch transactions:', error.message);
      return [];
    }
  }
}

export default new PoolAPI();
