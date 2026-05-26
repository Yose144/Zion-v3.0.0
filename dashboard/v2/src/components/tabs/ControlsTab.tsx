// ─── ZION Dashboard v2 — Controls Tab (v2.9 glass aesthetic) ────────────────
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Square, RotateCcw, Terminal, Zap, Server, Layers, Pickaxe,
  Rocket, StopCircle, Cpu, Monitor,
} from 'lucide-react';
import api from '../../api/client';
import { useStatusStore } from '../../stores/statusStore';
import { usePolling } from '../../hooks/usePolling';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionResult = { ok: boolean; message?: string };
type LoadKey = string;

// ── Shared action hook ────────────────────────────────────────────────────────

function useAction() {
  const [loading, setLoading] = useState<Record<LoadKey, boolean>>({});
  const [msgs,    setMsgs]    = useState<Record<LoadKey, { ok: boolean; text: string }>>({});

  const run = async (key: LoadKey, fn: () => Promise<ActionResult>) => {
    setLoading(l => ({ ...l, [key]: true }));
    setMsgs(m => { const n = { ...m }; delete n[key]; return n; });
    try {
      const res = await fn();
      const text = res.message ?? (res.ok ? 'OK' : 'Failed');
      setMsgs(m => ({ ...m, [key]: { ok: res.ok, text } }));
      setTimeout(() => setMsgs(m => { const n = { ...m }; delete n[key]; return n; }), 4000);
    } catch (e) {
      setMsgs(m => ({ ...m, [key]: { ok: false, text: String(e).slice(0, 80) } }));
      setTimeout(() => setMsgs(m => { const n = { ...m }; delete n[key]; return n; }), 6000);
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  };

  return { loading, msgs, run };
}

// ── Tiny action button ────────────────────────────────────────────────────────

function Btn({
  label, icon, variant = 'default', busy, onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger' | 'start' | 'gpu' | 'cpu';
  busy?: boolean;
  onClick: () => void;
}) {
  const cls: Record<string, string> = {
    default: 'border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-white/20',
    start:   'border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/20',
    danger:  'border-red-500/20 bg-red-500/10 text-red-400 hover:border-red-500/40 hover:bg-red-500/20',
    gpu:     'border-violet-500/25 bg-violet-500/10 text-violet-400 hover:border-violet-500/50 hover:bg-violet-500/20',
    cpu:     'border-sky-500/20 bg-sky-500/10 text-sky-400 hover:border-sky-500/40 hover:bg-sky-500/20',
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 ${cls[variant]}`}
    >
      {icon}
      {busy ? '…' : label}
    </button>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ running }: { running?: boolean }) {
  if (running === undefined) return <span className="w-2 h-2 rounded-full bg-gray-700" />;
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{
        background: running ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
        boxShadow: running ? '0 0 6px rgba(34,197,94,0.6)' : '0 0 6px rgba(239,68,68,0.4)',
      }}
    />
  );
}

// ── Service row ───────────────────────────────────────────────────────────────

function ServiceRow({
  icon, label, running, gradient, rowKey, loading, msgs, run,
  onStart, onStop, onRestart,
  extraButtons,
}: {
  icon: React.ReactNode;
  label: string;
  running?: boolean;
  gradient: string;
  rowKey: string;
  loading: Record<string, boolean>;
  msgs: Record<string, { ok: boolean; text: string }>;
  run: (key: string, fn: () => Promise<ActionResult>) => Promise<void>;
  onStart:   () => Promise<ActionResult>;
  onStop:    () => Promise<ActionResult>;
  onRestart: () => Promise<ActionResult>;
  extraButtons?: React.ReactNode;
}) {
  const busy = loading[`${rowKey}-start`] || loading[`${rowKey}-stop`] || loading[`${rowKey}-restart`];
  const msg  = msgs[`${rowKey}-start`] ?? msgs[`${rowKey}-stop`] ?? msgs[`${rowKey}-restart`];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3.5 border-b border-white/5 last:border-0">
      {/* Icon + name + status */}
      <div className="flex items-center gap-3 min-w-[160px]">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: gradient, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
        >
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <StatusDot running={running} />
          <span className="text-sm font-semibold text-gray-200">{label}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <Btn label="Start"   icon={<Play size={11} />}     variant="start"  busy={!!loading[`${rowKey}-start`]}   onClick={() => run(`${rowKey}-start`,   onStart)} />
        <Btn label="Stop"    icon={<Square size={11} />}   variant="danger" busy={!!loading[`${rowKey}-stop`]}    onClick={() => run(`${rowKey}-stop`,    onStop)} />
        <Btn label="Restart" icon={<RotateCcw size={11} />}                 busy={!!loading[`${rowKey}-restart`]} onClick={() => run(`${rowKey}-restart`, onRestart)} />
        {extraButtons}
      </div>

      {/* Feedback message */}
      {msg && (
        <span
          className="text-xs font-mono font-medium"
          style={{ color: msg.ok ? 'rgb(74,222,128)' : 'rgb(248,113,113)' }}
        >
          {msg.ok ? '✓' : '✗'} {msg.text}
        </span>
      )}
      {busy && !msg && <span className="text-xs text-gray-600 animate-pulse">running…</span>}
    </div>
  );
}

// ── CLI Console ───────────────────────────────────────────────────────────────

interface CliLine { type: 'input' | 'output' | 'error'; text: string }

function CliConsole() {
  const [history, setHistory] = useState<CliLine[]>([
    { type: 'output', text: '╔══ ZION CLI Console ══╗' },
    { type: 'output', text: 'Type a zion command and press Enter.' },
    { type: 'output', text: 'Examples: status, node-status, help, pool-stats' },
  ]);
  const [input, setInput]     = useState('');
  const [busy,  setBusy]      = useState(false);
  const [cmdHist, setCmdHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd || busy) return;
    setHistory(h => [...h, { type: 'input', text: `❯ ${cmd}` }]);
    setInput('');
    setCmdHist(h => [cmd, ...h].slice(0, 50));
    setHistIdx(-1);
    setBusy(true);
    try {
      const res = await api.cliRun({ command: cmd });
      if (res.stdout) setHistory(h => [...h, { type: 'output', text: res.stdout }]);
      if (res.stderr) setHistory(h => [...h, { type: 'error',  text: res.stderr }]);
      if (!res.stdout && !res.stderr)
        setHistory(h => [...h, { type: 'output', text: '(no output)' }]);
    } catch (e) {
      setHistory(h => [...h, { type: 'error', text: String(e) }]);
    } finally {
      setBusy(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { submit(); return; }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, cmdHist.length - 1);
      setHistIdx(idx);
      setInput(cmdHist[idx] ?? '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : (cmdHist[idx] ?? ''));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
            <Terminal size={15} className="text-zion-cyan" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">CLI Console</h3>
            <p className="text-[11px] text-gray-500">Run zion CLI commands interactively · Arrow↑↓ = history</p>
          </div>
        </div>
        <button
          onClick={() => setHistory([])}
          className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="px-6 py-4 space-y-3">
        <div
          className="h-56 overflow-y-auto rounded-xl p-3.5 font-mono text-xs space-y-0.5 cursor-text"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => inputRef.current?.focus()}
        >
          {history.map((line, i) => (
            <pre
              key={i}
              className="whitespace-pre-wrap break-all"
              style={{
                color: line.type === 'input'  ? 'rgb(34,211,238)'  :
                       line.type === 'error'  ? 'rgb(248,113,113)' :
                       'rgb(100,116,139)',
              }}
            >
              {line.text}
            </pre>
          ))}
          {busy && (
            <div className="text-slate-600 animate-pulse flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              Running…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(147,51,234,0.25)' }}
        >
          <Terminal size={13} className="text-violet-500 shrink-0" />
          <span className="text-xs text-cyan-600 font-mono mr-1">zion</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="status"
            disabled={busy}
            className="flex-1 bg-transparent outline-none text-xs font-mono text-slate-200 placeholder:text-slate-700"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ControlsTab() {
  const { loading, msgs, run } = useAction();
  const status = useStatusStore(s => s.status);
  const fetchStatus = useStatusStore(s => s.fetchStatus);

  useEffect(() => { fetchStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  usePolling(fetchStatus);

  const n1    = status?.node1;
  const n2    = status?.node2;
  const pool  = status?.pool;
  const miner = status?.miner;

  // Stack-level message
  const stackMsg = msgs['stack-launch'] ?? msgs['stack-stop'] ?? msgs['stack-stopall'];

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* ── Stack launch buttons ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-zion-gold/10 flex items-center justify-center">
            <Rocket size={15} className="text-zion-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Full Stack</h3>
            <p className="text-[11px] text-gray-500">Launch or stop the entire ZION node + pool + miner stack</p>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-wrap gap-3 items-center">
          {/* Launch Stack */}
          <button
            onClick={() => run('stack-launch', api.stackLaunch)}
            disabled={!!loading['stack-launch']}
            className="px-5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-sm font-semibold text-emerald-400
              hover:border-emerald-400/60 hover:bg-emerald-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Rocket size={14} />
            {loading['stack-launch'] ? 'Launching…' : 'Launch Full Stack'}
          </button>

          {/* Stop Stack */}
          <button
            onClick={() => run('stack-stop', api.stackStop)}
            disabled={!!loading['stack-stop']}
            className="px-5 py-2.5 rounded-xl border border-orange-500/25 bg-orange-500/10 text-sm font-semibold text-orange-400
              hover:border-orange-400/50 hover:bg-orange-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <StopCircle size={14} />
            {loading['stack-stop'] ? 'Stopping…' : 'Stop Stack'}
          </button>

          {/* Stop ALL */}
          <button
            onClick={() => { if (confirm('Stop ALL services?')) run('stack-stopall', api.stopAll); }}
            disabled={!!loading['stack-stopall']}
            className="px-5 py-2.5 rounded-xl border border-red-500/25 bg-red-500/10 text-sm font-semibold text-red-400
              hover:border-red-400/50 hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Square size={14} />
            {loading['stack-stopall'] ? 'Stopping…' : 'Stop ALL'}
          </button>

          {stackMsg && (
            <span
              className="text-xs font-mono font-medium"
              style={{ color: stackMsg.ok ? 'rgb(74,222,128)' : 'rgb(248,113,113)' }}
            >
              {stackMsg.ok ? '✓' : '✗'} {stackMsg.text}
            </span>
          )}
        </div>
      </motion.div>

      {/* ── Per-service controls ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
            <Zap size={15} className="text-zion-cyan" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Service Controls</h3>
            <p className="text-[11px] text-gray-500">Start, stop and restart individual services</p>
          </div>
        </div>

        <div className="px-6 py-2 divide-y divide-white/0">

          {/* Node 1 */}
          <ServiceRow
            icon={<Server size={14} className="text-white" />}
            label="Node 1 · Core"
            running={n1?.running}
            gradient="linear-gradient(135deg, rgb(255,215,0), rgb(251,191,36))"
            rowKey="node1"
            loading={loading} msgs={msgs} run={run}
            onStart={api.node1Start} onStop={api.node1Stop} onRestart={api.node1Restart}
          />

          {/* Node 2 */}
          <ServiceRow
            icon={<Server size={14} className="text-white" />}
            label="Node 2 · Edge"
            running={n2?.running}
            gradient="linear-gradient(135deg, rgb(147,51,234), rgb(168,85,247))"
            rowKey="node2"
            loading={loading} msgs={msgs} run={run}
            onStart={api.node2Start} onStop={api.node2Stop} onRestart={api.node2Restart}
          />

          {/* Pool */}
          <ServiceRow
            icon={<Layers size={14} className="text-white" />}
            label="Pool · Core"
            running={pool?.running}
            gradient="linear-gradient(135deg, rgb(6,182,212), rgb(34,211,238))"
            rowKey="pool"
            loading={loading} msgs={msgs} run={run}
            onStart={api.poolStart} onStop={api.poolStop} onRestart={api.poolRestart}
          />

          {/* Miner */}
          <ServiceRow
            icon={<Pickaxe size={14} className="text-white" />}
            label="Miner"
            running={miner?.running}
            gradient="linear-gradient(135deg, rgb(34,197,94), rgb(74,222,128))"
            rowKey="miner"
            loading={loading} msgs={msgs} run={run}
            onStart={api.minerStart} onStop={api.minerStop} onRestart={api.minerRestart}
            extraButtons={
              <>
                <Btn
                  label="GPU"
                  icon={<Monitor size={11} />}
                  variant="gpu"
                  busy={!!loading['miner-gpu']}
                  onClick={() => run('miner-gpu', api.minerStartGpu)}
                />
                <Btn
                  label="CPU"
                  icon={<Cpu size={11} />}
                  variant="cpu"
                  busy={!!loading['miner-cpu']}
                  onClick={() => run('miner-cpu', api.minerStartCpu)}
                />
              </>
            }
          />

        </div>
      </motion.div>

      {/* ── CLI Console ── */}
      <CliConsole />
    </div>
  );
}
