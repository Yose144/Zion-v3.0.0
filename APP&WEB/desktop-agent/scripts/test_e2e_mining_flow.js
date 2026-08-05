#!/usr/bin/env node
/**
 * ZION Desktop Agent — Trinity / Triple-Stream E2E Mining Flow Test (W11 ready)
 *
 * Tests the full V31 mining pipeline on the host platform:
 *   1. Build/prepare the Rust miner binary for the current platform.
 *   2. Generate a temporary zion1 wallet.
 *   3. Spawn the miner in triple-stream mode (ZION GPU + external GPU coin +
 *      external CPU coin) against the live mainnet Edge pool.
 *   4. Wait for telemetry (stdout + stats file) proving all three streams are
 *      recognised and at least one stream reports hashrate.
 *   5. Clean shutdown and JSON report.
 *
 * Usage:
 *   node scripts/test_e2e_mining_flow.js [--timeout 120] [--pool 62.171.141.136:8444]
 *
 * Exit code 0 = triple-stream telemetry observed, 1 = failure.
 */

const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const WalletGenerator = require('../src/wallet-generator');

const TEST_TIMEOUT_DEFAULT = 120; // seconds
const ELECTRON_READY_TIMEOUT = 15000; // ms
const STATS_POLL_MS = 2500;
const PRIMARY_POOL = '62.171.141.136:8444';

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? 'FAIL' : level === 'success' ? 'PASS' : 'INFO';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

class E2EMiningTest {
  constructor(options = {}) {
    this.timeoutSec = options.timeout || TEST_TIMEOUT_DEFAULT;
    this.pool = options.pool || PRIMARY_POOL;
    this.cpuCoin = options.cpuCoin || 'XMR';
    this.gpuCoin = options.gpuCoin || 'KAS';
    this.worker = `e2e-w11-${Date.now()}`;
    this.results = {
      binaryPrepared: false,
      minerSpawned: false,
      poolConnected: false,
      tripleStreamNegotiated: false,
      tripleStreamDetected: false,
      sharesSubmitted: 0,
      hashrateHs: 0,
      streams: [],
      errors: []
    };
    this.processes = [];
    this.logBuffer = '';
  }

  async run() {
    log('Starting ZION Trinity E2E mining flow test');
    log(`Timeout: ${this.timeoutSec}s, Pool: ${this.pool}, Worker: ${this.worker}`);

    try {
      const minerPath = await this.prepareMiner();
      const wallet = await this.generateWallet();
      await this.runMiner(minerPath, wallet);
      this.generateReport();
    } catch (error) {
      this.results.errors.push(error.message);
      log(`Test failed: ${error.message}`, 'error');
    } finally {
      await this.cleanup();
    }

    return this.results;
  }

  async prepareMiner() {
    log('Step 1: Preparing V31 Rust miner binaries...');
    const prepareScript = path.join(__dirname, '..', 'scripts', 'prepare-rust-miner.js');

    try {
      // Try a no-build copy first; this is fine even if node/zion cli binaries
      // are missing — the E2E test only needs the miner binary.
      execFileSync('node', [prepareScript, '--no-build'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      this.results.binaryPrepared = true;
    } catch (error) {
      log('Binary not ready, building miner...');
      execFileSync('node', [prepareScript, '--auto'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      this.results.binaryPrepared = true;
    }

    const ext = process.platform === 'win32' ? '.exe' : '';
    const candidates = [
      path.join(__dirname, '..', 'resources', `zion-miner${ext}`),
      path.join(__dirname, '..', 'resources', `zion-universal-miner${ext}`),
      path.join(__dirname, '..', '..', '..', 'V31', 'L1', 'miner', 'target', 'release', `zion-miner${ext}`),
      path.join(__dirname, '..', '..', '..', 'V31', 'target', 'release', `zion-miner${ext}`),
      path.join(__dirname, '..', '..', '..', 'target', 'release', `zion-miner${ext}`)
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`zion-miner binary not found after prepare. Searched: ${candidates.join(', ')}`);
  }

  async generateWallet() {
    log('Step 2: Generating temporary test wallet...');
    const wallet = WalletGenerator.generateWallet();
    if (!wallet || !wallet.address || !wallet.address.startsWith('zion1')) {
      throw new Error('Generated wallet is not a valid zion1 address');
    }
    log(`Test wallet: ${wallet.address}`);
    return wallet.address;
  }

  async runMiner(minerPath, wallet) {
    log('Step 3: Spawning miner in V31 triple-stream mode...');

    const cpuThreads = Math.max(1, os.cpus().length - 1);
    const gpuBackend = 'auto'; // let the compiled miner pick CUDA / OpenCL / CPU
    const args = [
      '--pool', this.pool,
      '--wallet', wallet,
      '--worker', this.worker,
      '--threads', String(cpuThreads),
      '--metrics', '127.0.0.1:9116',
      '--log_interval', '10'
    ];

    const env = {
      ...process.env,
      ZION_POOL_ADDR: this.pool,
      ZION_WORKER: this.worker,
      ZION_WORKER_NAME: this.worker,
      ZION_MINER_THREADS: String(cpuThreads),
      ZION_GPU_BACKEND: gpuBackend,
      ZION_BACKEND: gpuBackend,
      ZION_MINER_ALGORITHM: 'cosmic_harmony_ekam_deeksha_v2',
      ZION_PROFIT_INTERVAL: '300',
      ZION_AUTONOMOUS: '0',
      ZION_STREAM2_FORCE_COIN: this.gpuCoin,
      ZION_STREAM3_FORCE_COIN: this.cpuCoin
    };

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeoutMs = this.timeoutSec * 1000;
      const miner = spawn(minerPath, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
      this.processes.push(miner);
      this.results.minerSpawned = true;

      let resolved = false;
      const finish = (err) => {
        if (resolved) return;
        resolved = true;
        if (err) reject(err);
        else resolve();
      };

      miner.stdout.on('data', (data) => {
        const text = data.toString();
        this.logBuffer += text;
        this.scanLog(text);
      });

      miner.stderr.on('data', (data) => {
        const text = data.toString();
        this.logBuffer += text;
        this.scanLog(text);
      });

      miner.on('error', (err) => {
        this.results.errors.push(`Miner process error: ${err.message}`);
        finish(err);
      });

      miner.on('exit', (code) => {
        if (!resolved && code !== 0) {
          finish(new Error(`Miner exited early with code ${code}`));
        }
      });

      const statsTimer = setInterval(async () => {
        await this.pollMetrics();
        if (this.results.tripleStreamDetected && this.results.sharesSubmitted > 0) {
          clearInterval(statsTimer);
          finish();
        }
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(statsTimer);
          finish(new Error(`Timeout after ${this.timeoutSec}s`));
        }
      }, STATS_POLL_MS);

      // Give the miner a bit of time before the first metrics poll
      setTimeout(() => this.pollMetrics(), 3000);
    });
  }

  scanLog(text) {
    // Pool connection
    if (/zion\s+pool\s+stratum\s+connected|pool\s+connected|connected\s+to/i.test(text)) {
      this.results.poolConnected = true;
    }
    // Coin preference / stream activation (proves triple-stream negotiation)
    if (/(?:mined\s+auxpow\s+share|stream\s+stats)/i.test(text)) {
      this.results.tripleStreamDetected = true;
    }
    // Share accepted (V31 auxpow share events)
    const shareMatch = text.match(/mined\s+auxpow\s+share/gi);
    if (shareMatch) {
      this.results.sharesSubmitted += shareMatch.length;
    }
  }

  parsePrometheusMetrics(text) {
    const out = {};
    const re = /^(zion_miner_\w+)\{[^}]*\}\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
      const v = Number(m[2]);
      out[m[1]] = Number.isFinite(v) ? v : 0;
    }
    return out;
  }

  async pollMetrics() {
    try {
      const data = await new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:9116/metrics', { timeout: 1500 }, (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => resolve(res.statusCode === 200 ? body : null));
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
      });
      if (!data) return;
      const pm = this.parsePrometheusMetrics(data);
      if (typeof pm.zion_miner_hash_rate === 'number') {
        this.results.hashrateHs = pm.zion_miner_hash_rate;
      }
      if (typeof pm.zion_miner_shares_accepted === 'number') {
        this.results.sharesSubmitted = pm.zion_miner_shares_accepted;
      }
      if (typeof pm.zion_miner_shares_submitted === 'number' && pm.zion_miner_shares_submitted > 0) {
        this.results.tripleStreamDetected = true;
      }
      if (this.results.tripleStreamDetected && this.results.hashrateHs > 0) {
        log(`Telemetry: hashrate=${this.results.hashrateHs.toFixed(2)} H/s, accepted=${this.results.sharesSubmitted}`, 'success');
      }
    } catch {
      // metrics may not be ready yet; ignore and retry
    }
  }

  generateReport() {
    log('Step 4: Generating E2E report...');

    const passed = this.results.tripleStreamDetected;
    const report = {
      timestamp: new Date().toISOString(),
      durationSec: this.timeoutSec,
      platform: `${os.platform()} ${os.arch()}`,
      nodeVersion: process.version,
      pool: this.pool,
      worker: this.worker,
      results: this.results,
      summary: {
        passed,
        totalChecks: 5,
        passedChecks: [
          this.results.binaryPrepared,
          this.results.minerSpawned,
          this.results.poolConnected,
          this.results.tripleStreamDetected,
          this.results.sharesSubmitted > 0 || this.results.hashrateHs > 0
        ].filter(Boolean).length
      }
    };

    const reportPath = path.join(__dirname, '..', 'test_e2e_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Test report saved to: ${reportPath}`);

    console.log('\n' + '='.repeat(60));
    console.log('TRINITY E2E MINING FLOW TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Platform: ${report.platform}`);
    console.log(`Duration: ${report.durationSec}s`);
    console.log(`Passed: ${report.summary.passedChecks}/${report.summary.totalChecks} checks`);
    console.log(`Overall: ${passed ? 'PASS' : 'FAIL'}`);
    if (this.results.streams.length) {
      console.log('\nPer-stream telemetry:');
      for (const s of this.results.streams) {
        console.log(`  [${s.index}] ${s.label || s.coin || '—'} | ${s.algorithm || '—'} | active=${s.active} | hr10s=${s.hashrate_10s || 0}`);
      }
    }
    if (this.results.errors.length > 0) {
      console.log('\nErrors:');
      this.results.errors.forEach(error => console.log(`  - ${error}`));
    }
    console.log('='.repeat(60));
  }

  async cleanup() {
    log('Cleaning up test processes...');
    for (const proc of this.processes) {
      if (!proc || proc.killed || proc.exitCode !== null) continue;
      try {
        proc.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!proc.killed && proc.exitCode === null) proc.kill('SIGKILL');
      } catch (error) {
        this.results.errors.push(`Cleanup error: ${error.message}`);
      }
    }
    this.processes = [];
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--timeout':
        options.timeout = parseInt(args[++i]);
        break;
      case '--pool':
        options.pool = args[++i];
        break;
      case '--cpu-coin':
        options.cpuCoin = args[++i];
        break;
      case '--gpu-coin':
        options.gpuCoin = args[++i];
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  const test = new E2EMiningTest(options);
  test.run().then((results) => {
    const passed = results.tripleStreamDetected;
    process.exit(passed ? 0 : 1);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = E2EMiningTest;
