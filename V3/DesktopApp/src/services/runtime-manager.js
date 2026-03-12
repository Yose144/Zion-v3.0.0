const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { IPC_CHANNELS } = require('../shared/ipc-channels');

const STACK_ORDER = ['node', 'pool', 'miner'];
const LOG_LIMIT = 180;
const UPDATE_DEBOUNCE_MS = 60;

class RuntimeManager {
  constructor(app, getWindow) {
    this.app = app;
    this.getWindow = getWindow;
    this.v3Root = path.resolve(__dirname, '..', '..', '..');
    this.targetDir = path.join(this.v3Root, 'target', 'debug');
    this.stateDir = path.join(this.app.getPath('userData'), 'runtime');
    this.configPath = path.join(this.stateDir, 'runtime-config.json');
    this.broadcastTimer = null;
    this.serviceState = new Map();
    this.config = this.loadConfig();
  }

  async initialize() {
    fs.mkdirSync(this.stateDir, { recursive: true });
    for (const serviceId of STACK_ORDER) {
      this.ensureService(serviceId);
    }
    this.scheduleBroadcast();
  }

  loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  persistConfig() {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  executableName(base) {
    return process.platform === 'win32' ? `${base}.exe` : base;
  }

  serviceSpec(serviceId) {
    const nodeDefaults = () => ({
      ZION_NODE_ID: 'desktop-v3-node',
      ZION_P2P_BIND: '127.0.0.1:26334',
      ZION_RPC_BIND: '127.0.0.1:26332',
      ZION_NODE_STATE_PATH: path.join(this.stateDir, 'node-state.json')
    });
    const poolDefaults = () => ({
      ZION_POOL_BIND: '127.0.0.1:26444',
      ZION_NODE_RPC_ADDR: this.getResolvedEnv('node').ZION_RPC_BIND || '127.0.0.1:26332',
      ZION_POOL_LOOP_COUNT: '1000000',
      ZION_REVENUE_SOURCE: 'zion',
      ZION_REVENUE_USD: '1.25'
    });
    const minerDefaults = () => ({
      ZION_MINER_ID: 'desktop-miner',
      ZION_WORKER_NAME: 'desktop-worker',
      ZION_POOL_ADDR: this.getResolvedEnv('pool').ZION_POOL_BIND || '127.0.0.1:26444',
      ZION_LOOP_COUNT: '1000000',
      ZION_NONCE_COUNT: '4096',
      ZION_NONCE_STRIDE: '4096',
      ZION_REVENUE_SOURCE: 'zion',
      ZION_REVENUE_USD: '1.25'
    });

    const specs = {
      node: {
        label: 'L1 Node',
        binaryName: 'node',
        description: 'Canonical V3 node runtime and RPC surface.',
        defaultEnv: nodeDefaults
      },
      pool: {
        label: 'Pool Server',
        binaryName: 'server',
        description: 'Thin stratum bridge over the V3 node template flow.',
        defaultEnv: poolDefaults
      },
      miner: {
        label: 'Miner Client',
        binaryName: 'zion-miner',
        description: 'Remote miner session against the local V3 pool.',
        defaultEnv: minerDefaults
      }
    };

    return specs[serviceId];
  }

  binaryPath(serviceId) {
    const spec = this.serviceSpec(serviceId);
    return path.join(this.targetDir, this.executableName(spec.binaryName));
  }

  ensureService(serviceId) {
    if (!this.serviceState.has(serviceId)) {
      const spec = this.serviceSpec(serviceId);
      this.serviceState.set(serviceId, {
        id: serviceId,
        label: spec.label,
        description: spec.description,
        process: null,
        status: 'stopped',
        pid: null,
        startedAt: null,
        exitCode: null,
        signal: null,
        lastError: null,
        metrics: {},
        logs: [],
        stdoutBuffer: '',
        stderrBuffer: '',
        activeEnv: this.getResolvedEnv(serviceId)
      });
    }

    return this.serviceState.get(serviceId);
  }

  normalizeEnv(env) {
    const normalized = {};
    for (const [key, value] of Object.entries(env || {})) {
      if (!key) {
        continue;
      }
      const nextValue = String(value == null ? '' : value).trim();
      if (nextValue) {
        normalized[key] = nextValue;
      }
    }
    return normalized;
  }

  getResolvedEnv(serviceId) {
    const spec = this.serviceSpec(serviceId);
    const defaults = spec.defaultEnv();
    const overrides = this.normalizeEnv(this.config[serviceId] || {});
    return {
      ...defaults,
      ...overrides
    };
  }

  configureService(serviceId, env) {
    this.ensureKnownService(serviceId);
    this.config[serviceId] = this.normalizeEnv(env);
    this.persistConfig();
    this.ensureService(serviceId).activeEnv = this.getResolvedEnv(serviceId);
    this.scheduleBroadcast();
    return this.getSnapshot();
  }

  ensureKnownService(serviceId) {
    if (!STACK_ORDER.includes(serviceId)) {
      throw new Error(`Unknown runtime service: ${serviceId}`);
    }
  }

  appendLog(serviceId, stream, line) {
    const service = this.ensureService(serviceId);
    const message = String(line || '').trim();
    if (!message) {
      return;
    }

    service.logs.push({
      ts: new Date().toISOString(),
      stream,
      message
    });
    if (service.logs.length > LOG_LIMIT) {
      service.logs.splice(0, service.logs.length - LOG_LIMIT);
    }

    const metricMatch = /^([a-z0-9_]+)=(.+)$/i.exec(message);
    if (metricMatch) {
      service.metrics[metricMatch[1]] = metricMatch[2];
    }

    if (stream === 'stderr') {
      service.lastError = message;
    }

    this.scheduleBroadcast();
  }

  flushBufferedLogs(serviceId) {
    const service = this.ensureService(serviceId);
    for (const stream of ['stdoutBuffer', 'stderrBuffer']) {
      const pending = service[stream];
      if (pending && pending.trim()) {
        this.appendLog(serviceId, stream === 'stdoutBuffer' ? 'stdout' : 'stderr', pending.trim());
      }
      service[stream] = '';
    }
  }

  consumeChunk(serviceId, stream, chunk) {
    const service = this.ensureService(serviceId);
    const bufferKey = stream === 'stdout' ? 'stdoutBuffer' : 'stderrBuffer';
    const aggregate = `${service[bufferKey]}${String(chunk)}`;
    const parts = aggregate.split(/\r?\n/);
    service[bufferKey] = parts.pop() || '';
    for (const line of parts) {
      this.appendLog(serviceId, stream, line);
    }
  }

  async startService(serviceId) {
    this.ensureKnownService(serviceId);
    const service = this.ensureService(serviceId);
    if (service.process) {
      return this.getSnapshot();
    }

    const binaryPath = this.binaryPath(serviceId);
    if (!fs.existsSync(binaryPath)) {
      service.status = 'error';
      service.lastError = `Missing binary: ${binaryPath}`;
      this.scheduleBroadcast();
      throw new Error(service.lastError);
    }

    const env = this.getResolvedEnv(serviceId);
    service.status = 'starting';
    service.exitCode = null;
    service.signal = null;
    service.lastError = null;
    service.metrics = {};
    service.logs = [];
    service.stdoutBuffer = '';
    service.stderrBuffer = '';
    service.activeEnv = env;
    this.scheduleBroadcast();

    const child = spawn(binaryPath, [], {
      cwd: this.v3Root,
      env: {
        ...process.env,
        ...env
      },
      windowsHide: true
    });

    service.process = child;

    child.once('spawn', () => {
      service.status = 'running';
      service.pid = child.pid;
      service.startedAt = new Date().toISOString();
      this.appendLog(serviceId, 'stdout', `[spawn] ${path.basename(binaryPath)} started`);
      this.scheduleBroadcast();
    });

    child.stdout.on('data', (chunk) => this.consumeChunk(serviceId, 'stdout', chunk));
    child.stderr.on('data', (chunk) => this.consumeChunk(serviceId, 'stderr', chunk));

    child.once('error', (error) => {
      this.flushBufferedLogs(serviceId);
      service.process = null;
      service.pid = null;
      service.status = 'error';
      service.lastError = String(error.message || error);
      this.scheduleBroadcast();
    });

    child.once('exit', (code, signal) => {
      this.flushBufferedLogs(serviceId);
      service.process = null;
      service.pid = null;
      service.exitCode = code;
      service.signal = signal;
      if (service.status === 'stopping') {
        service.status = 'stopped';
      } else if (code === 0) {
        service.status = 'stopped';
      } else {
        service.status = 'error';
        service.lastError = `Exited with code ${code == null ? 'unknown' : code}`;
      }
      this.scheduleBroadcast();
    });

    return this.getSnapshot();
  }

  async stopService(serviceId) {
    this.ensureKnownService(serviceId);
    const service = this.ensureService(serviceId);
    if (!service.process) {
      service.status = 'stopped';
      this.scheduleBroadcast();
      return this.getSnapshot();
    }

    const child = service.process;
    service.status = 'stopping';
    this.scheduleBroadcast();

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
        }
      }, 3000);

      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });

      try {
        child.kill('SIGTERM');
      } catch (error) {
        clearTimeout(timer);
        service.status = 'error';
        service.lastError = String(error.message || error);
        resolve();
      }
    });

    return this.getSnapshot();
  }

  async restartService(serviceId) {
    await this.stopService(serviceId);
    return this.startService(serviceId);
  }

  async startStack() {
    for (const serviceId of STACK_ORDER) {
      await this.startService(serviceId);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return this.getSnapshot();
  }

  async stopStack() {
    for (const serviceId of [...STACK_ORDER].reverse()) {
      await this.stopService(serviceId);
    }
    return this.getSnapshot();
  }

  stackStatus() {
    const services = STACK_ORDER.map((serviceId) => this.ensureService(serviceId));
    const runningCount = services.filter((service) => service.status === 'running').length;
    const hasError = services.some((service) => service.status === 'error');
    return {
      runningCount,
      total: services.length,
      state: hasError
        ? 'degraded'
        : runningCount === services.length
          ? 'online'
          : runningCount > 0
            ? 'partial'
            : 'offline'
    };
  }

  serializeService(serviceId) {
    const service = this.ensureService(serviceId);
    const binaryPath = this.binaryPath(serviceId);
    return {
      id: service.id,
      label: service.label,
      description: service.description,
      binaryPath,
      exists: fs.existsSync(binaryPath),
      status: service.status,
      pid: service.pid,
      startedAt: service.startedAt,
      exitCode: service.exitCode,
      signal: service.signal,
      lastError: service.lastError,
      metrics: service.metrics,
      logs: service.logs.slice(-80),
      env: this.getResolvedEnv(serviceId)
    };
  }

  getSnapshot() {
    return {
      stack: this.stackStatus(),
      services: STACK_ORDER.map((serviceId) => this.serializeService(serviceId))
    };
  }

  scheduleBroadcast() {
    if (this.broadcastTimer) {
      return;
    }
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      const window = this.getWindow();
      if (window && !window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.RUNTIME_STATE_CHANGED, this.getSnapshot());
      }
    }, UPDATE_DEBOUNCE_MS);
  }
}

module.exports = { RuntimeManager, STACK_ORDER, LOG_LIMIT };