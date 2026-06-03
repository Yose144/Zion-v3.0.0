import axios from 'axios';
import {CONFIG} from '../constants/config';

/**
 * Bridge API Service
 * - Rainbow Bridge proxy endpoints under main API gateway
 * - WARP engine proxy endpoints under main API gateway
 */

class BridgeAPI {
  constructor() {
    this.baseURL = CONFIG.API_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getRainbowStatus() {
    const response = await this.client.get('/api/rainbow-bridge/status');
    return response.data;
  }

  async activateRainbow() {
    const response = await this.client.post('/api/rainbow-bridge/activate');
    return response.data;
  }

  async getRainbowChains() {
    const response = await this.client.get('/api/rainbow-bridge/chains');
    return response.data;
  }

  async createRainbowBridge(payload) {
    const response = await this.client.post('/api/rainbow-bridge/bridge/create', payload);
    return response.data;
  }

  async getRainbowBridge(bridgeId) {
    const response = await this.client.get(`/api/rainbow-bridge/bridge/${bridgeId}`);
    return response.data;
  }

  async getRainbowBridgeStatus(bridgeId) {
    const response = await this.client.get(`/api/rainbow-bridge/bridge/status/${bridgeId}`);
    return response.data;
  }

  async confirmRainbowBridge(bridgeId, payload = {}) {
    const response = await this.client.post(`/api/rainbow-bridge/bridge/confirm/${bridgeId}`,
      payload,
    );
    return response.data;
  }

  async getWarpHealth() {
    const response = await this.client.get('/api/warp/health');
    return response.data;
  }

  async getWarpStatus() {
    const response = await this.client.get('/api/warp/status');
    return response.data;
  }

  async getWarpStats() {
    const response = await this.client.get('/api/warp/stats');
    return response.data;
  }
}

export default new BridgeAPI();
