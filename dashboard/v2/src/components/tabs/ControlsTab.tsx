// ─── ZION Dashboard v2 — Controls Tab ───────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, RotateCcw, Terminal } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../api/client';

interface ServiceControl {
  id: string;
  label: string;
  accent: 'gold' | 'cyan' | 'purple' | 'green';
  start: () => Promise<{ ok: boolean }>;
  stop:  () => Promise<{ ok: boolean }>;
}

const SERVICES: ServiceControl[] = [
  { id: 'node',  label: 'Node',  accent: 'gold',   start: api.nodeStart,  stop: api.nodeStop },
  { id: 'pool',  label: 'Pool',  accent: 'cyan',   start: api.poolStart,  stop: api.poolStop },
  { id: 'miner', label: 'Miner', accent: 'purple', start: api.minerStart, stop: api.minerStop },
];

interface CliLine { type: 'input' | 'output' | 'error'; text: string }

// ── Service control card ──────────────────────────────────────────────────────

function ServiceCard({ svc }: { svc: ServiceControl }) {
  const [loading, setLoading] = useState<'start' | 'stop' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (action: 'start' | 'stop') => {
    setLoading(action);
    setMsg(null);
    try {
      const fn = action === 'start' ? svc.start : svc.stop;
      const res = await fn();
      setMsg(res.ok ? `${action} OK` : `${action} failed`);
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card title={svc.label} accent={svc.accent}>
      <div className="flex gap-2 flex-wrap">
        <Button variant="primary" size="sm" loading={loading === 'start'} onClick={() => run('start')}>
          <Play size={12} /> Start
        </Button>
        <Button variant="danger" size="sm" loading={loading === 'stop'} onClick={() => run('stop')}>
          <Square size={12} /> Stop
        </Button>
        <Button variant="secondary" size="sm" onClick={async () => {
          await run('stop');
          setTimeout(() => run('start'), 1000);
        }}>
          <RotateCcw size={12} /> Restart
        </Button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs font-mono ${msg.includes('OK') ? 'text-(--color-zion-green)' : 'text-(--color-zion-red)'}`}>
          {msg}
        </p>
      )}
    </Card>
  );
}

// ── CLI Console ───────────────────────────────────────────────────────────────

function CliConsole() {
  const [history, setHistory] = useState<CliLine[]>([
    { type: 'output', text: 'ZION CLI Console — type a zion command and press Enter' },
    { type: 'output', text: 'Example: status, node-status, help' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setHistory(h => [...h, { type: 'input', text: `> ${cmd}` }]);
    setInput('');
    setCmdHistory(h => [cmd, ...h].slice(0, 50));
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
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx] ?? '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : (cmdHistory[idx] ?? ''));
    }
  };

  return (
    <Card title="CLI Console" accent="purple" actions={
      <Button variant="ghost" size="sm" onClick={() => setHistory([])}>Clear</Button>
    }>
      <div
        className="h-64 overflow-y-auto bg-(--color-bg-base) rounded p-3 font-mono text-xs space-y-0.5 mb-2 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {history.map((line, i) => (
          <div key={i} className={
            line.type === 'input'  ? 'text-(--color-zion-cyan)' :
            line.type === 'error'  ? 'text-(--color-zion-red)' :
            'text-(--color-text-dim)'
          }>
            <pre className="whitespace-pre-wrap break-all">{line.text}</pre>
          </div>
        ))}
        {loading && <div className="text-(--color-text-muted) animate-pulse">Running…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 bg-(--color-bg-base) rounded px-3 py-2 border border-(--color-border) focus-within:border-(--color-zion-purple)/60">
        <Terminal size={13} className="text-(--color-zion-purple) shrink-0" />
        <span className="text-xs text-(--color-zion-cyan) font-mono mr-1">zion</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="status"
          disabled={loading}
          className="flex-1 bg-transparent outline-none text-xs font-mono text-(--color-text) placeholder:text-(--color-text-muted)"
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
