import axios from 'axios';
import {CONFIG} from '../constants/config';

/**
 * AI Service v3.0.0
 * Bridges the ZION mobile app to the two-tier local AI layer:
 *
 *   Hiran Inference   http://localhost:8002  — llama-server.exe (OpenAI-compat)
 *   Hiranyagarbha     http://localhost:8001  — Rust/Axum orchestrator + NCL
 */

class AIService {
  constructor() {
    this._hiranClient = axios.create({
      baseURL: CONFIG.AI.HIRAN_INFERENCE_URL,
      timeout: CONFIG.AI.TIMEOUT,
      headers: {'Content-Type': 'application/json'},
    });

    this._hiranyagarbhaClient = axios.create({
      baseURL: CONFIG.AI.HIRANYAGARBHA_URL,
      timeout: CONFIG.AI.TIMEOUT,
      headers: {'Content-Type': 'application/json'},
    });

    this._nclClient = axios.create({
      baseURL: CONFIG.AI.HIRANYAGARBHA_URL,
      timeout: CONFIG.NCL.JOB_TIMEOUT,
      headers: {'Content-Type': 'application/json'},
    });
  }

  // ==================== HEALTH CHECKS ====================

  async checkHiranHealth() {
    const start = Date.now();
    try {
      const response = await this._hiranClient.get('/health');
      return {ok: true, latencyMs: Date.now() - start, data: response.data};
    } catch (error) {
      return {ok: false, latencyMs: Date.now() - start, error: error.message};
    }
  }

  async checkHiranyagarbhaHealth() {
    const start = Date.now();
    try {
      const response = await this._hiranyagarbhaClient.get('/health');
      return {ok: true, latencyMs: Date.now() - start, data: response.data};
    } catch (error) {
      return {ok: false, latencyMs: Date.now() - start, error: error.message};
    }
  }

  // ==================== HIRAN LLM CHAT ====================

  async askHiran(message, temperature = 0.7, history = []) {
    const messages = [
      {
        role: 'system',
        content:
          'You are Hiran, the ZION network AI assistant. You help users with ZION blockchain, mining, wallet management, and the Neural Compute Layer (NCL). Be concise and helpful.',
      },
      ...history,
      {role: 'user', content: message},
    ];

    try {
      const response = await this._hiranClient.post('/v1/chat/completions', {
        model: CONFIG.AI.HIRAN_MODEL,
        messages,
        temperature,
        max_tokens: 1024,
        stream: false,
      });

      const reply =
        response.data?.choices?.[0]?.message?.content ||
        response.data?.choices?.[0]?.text ||
        '';

      if (!reply) {
        throw new Error('Empty response from Hiran inference server');
      }

      return reply.trim();
    } catch (error) {
      console.error('askHiran error:', error.message);
      throw error;
    }
  }

  // ==================== NCL — NEURAL COMPUTE LAYER ====================

  async getNCLWorkers() {
    try {
      const response = await this._hiranyagarbhaClient.get('/ncl/workers');
      return response.data;
    } catch (error) {
      console.error('getNCLWorkers error:', error.message);
      return null;
    }
  }

  async getNCLLeaderboard() {
    try {
      const response = await this._hiranyagarbhaClient.get('/ncl/leaderboard');
      return response.data;
    } catch (error) {
      console.error('getNCLLeaderboard error:', error.message);
      return null;
    }
  }

  async submitNCLJob(jobType, params = {}) {
    try {
      const payload = {
        job_type: jobType,
        model_id: 'hiran-v2.2',
        backend: 'Custom',
        params,
        priority: 5,
        submitter: 'mobile-app',
        input_hash: Date.now().toString(16),
        reward_flowers: 20000000000,
        max_duration_secs: 60,
      };
      const response = await this._nclClient.post('/ncl/jobs', payload);
      return response.data;
    } catch (error) {
      console.error('submitNCLJob error:', error.message);
      return null;
    }
  }

  async getNCLPrice() {
    try {
      const response = await this._hiranyagarbhaClient.get('/ncl/price');
      return response.data;
    } catch (error) {
      console.error('getNCLPrice error:', error.message);
      return null;
    }
  }
}

export default new AIService();
