// ─── ZION Dashboard v2 — Controls Tab (v2.9 glass aesthetic) ────────────────
import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, RotateCcw, Terminal, Zap } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../api/client';

interface ServiceControl {
  id: string;
  label: string;
  accent: 'gold' | 'cyan' | 'purple' | 'green';
  gradient: string;
  start: () => Promise<{ ok: boolean }>;
  stop:  () => Promise<{ ok: boolean }>;
}

const SERVICES: ServiceControl[] = [
  {
    id: 'node',  label: 'Node',  accent: 'gold',
    gradient: 'linear-gradient(135deg, rgb(255,215,0), rgb(251,191,36))',
    start: api.nodeStart,  stop: api.nodeStop,
  },
  {
    id: 'pool',  label: 'Pool',  accent: 'cyan',
    gradient: 'linear-gradient(135deg, rgb(6,182,212), rgb(34,211,238))',
    start: api.poolStart,  stop: api.poolStop,
  },
  {
    id: 'miner', label: 'Miner', accent: 'purple',
    gradient: 'linear-gradient(135deg, rgb(147,51,234), rgb(168,85,247))',
    start: api.minerStart, stop: api.minerStop,
  },
];

interface CliLine { type: 'input' | 'output' | 'error'; text: string }

// ── Service control card ──────────────────────────────────────────────────────

function ServiceCard({ svc }: { svc: ServiceControl }) {
  const [loading, setLoading] = useState<'start' | 'stop' | null>(null);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (action: 'start' | 'stop') => {
    setLoading(action);
    setMsg(null);
    try {
      const fn = action === 'start' ? svc.start : svc.stop;
      const res = await fn();
      setMsg({ ok: res.ok, text: res.ok ? `${action} OK` : `${action} failed` });
    } catch (e) {
      setMsg({ ok: false, text: `Error: ${String(e)}` });
    } finally {
      setLoading(null);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  return (
    <div className="zion-panel p-5 flex flex-col gap-4">
      {/* Service name + accent dot */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: svc.gradient, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
        >
          <Zap size={15} className="text-white" />
        </div>
        <div>
          <p
            className="text-sm font-bold"
            style={{
              backgroundImage: svc.gradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {svc.label}
          </p>
          <p className="text-[11px] text-slate-600">ZION service</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="primary" size="sm" loading={loading === 'start'} onClick={() => run('start')}>
          <Play size={11} /> Start
        </Button>
        <Button variant="danger" size="sm" loading={loading === 'stop'} onClick={() => run('stop')}>
          <Square size={11} /> Stop
        </Button>
        <Button variant="secondary" size="sm" onClick={async () => {
          await run('stop');
          setTimeout(() => run('start'), 1000);
        }}>
          <RotateCcw size={11} /> Restart
        </Button>
      </div>

      {/* Status message */}
      {msg && (
        <p
          className="text-xs font-mono font-medium"
          style={{ color: msg.ok ? 'rgb(74,222,128)' : 'rgb(248,113,113)' }}
        >
          {msg.ok ? '✓' : '✗'} {msg.text}
        </p>
      )}
    </div>
  );
}

// ── CLI Console ───────────────────────────────────────────────────────────────

function CliConsole() {
  const [history, setHistory] = useState<CliLine[]>([
    { type: 'output', text: '╔══ ZION CLI Console ══╗' },
    { type: 'output', text: 'Type a zion command and press Enter.' },
    { type: 'output', text: 'Examples: status, node-status, help, pool-stats' },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [cmdHist, setCmdHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setHistory(h => [...h, { type: 'input', text: `❯ ${cmd}` }]);
    setInput('');
    setCmdHist(h => [cmd, ...h].slice(0, 50));
    setHistIdx(-1);
    setLoading(true);
    try {
      const res = await api.cliRun({ command: cmd });
      if (res.stdout) setHistory(h => [...h, { type: 'output', text: res.stdout }]);
      if (res.stderr) setHistory(h => [...h, { type: 'error',  text: res.stderr }]);
    } catch (e) {
      setHistory(h => [...h, { type: 'error', text: String(e) }]);
    } finally {
      setLoading(false);
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
    <Card
      title="CLI Console"
      accent="purple"
      actions={
        <button
          onClick={() => setHistory([])}
          className="text-[10px] text-slate-600 hover:text-slate-300 font-medium uppercase tracking-wider transition-colors"
        >
          Clear
        </button>
      }
    >
      {/* Output area */}
      <div
        className="h-64 overflow-y-auto rounded-xl p-3.5 font-mono text-xs space-y-0.5 mb-3 cursor-text"
        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
        onClick={() => inputRef.current?.focus()}
      >
        {history.map((line, i) => (
          <div key={i}>
            <pre
              className="whitespace-pre-wrap break-all"
              style={{
                color: line.type === 'input'  ? 'rgb(34,211,238)' :
                       line.type === 'error'  ? 'rgb(248,113,113)' :
                       'rgb(100,116,139)',
              }}
            >
              {line.text}
            </pre>
          </div>
        ))}
        {loading && (
          <div className="text-slate-600 animate-pulse flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Running…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(147,51,234,0.25)',
        }}
      >
        <Terminal size={13} className="text-violet-500 shrink-0" />
        <span className="text-xs text-cyan-600 font-mono mr-1">zion</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="status"
          disabled={loading}
          className="flex-1 bg-transparent outline-none text-xs font-mono text-slate-200 placeholder:text-slate-700"
        />
      </div>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ControlsTab() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SERVICES.map(svc => <ServiceCard key={svc.id} svc={svc} />)}
      </div>
      <CliConsole />
    </div>
  );
}
