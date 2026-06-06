import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, RefreshCw, XCircle, Wifi, WifiOff } from 'lucide-react';
import { tailLog, tailscalePing } from '../lib/api';

interface Props {
  className?: string;
}

const LOG_FILES = [
  { label: 'Node', path: 'C:/Users/yosef/Desktop/Zion/2.9.6-main/logs/node1.log' },
  { label: 'Miner', path: 'C:/Users/yosef/Desktop/Zion/2.9.6-main/logs/miner.log' },
  { label: 'Pool', path: 'C:/Users/yosef/Desktop/Zion/2.9.6-main/logs/pool.log' },
];

export default function LogViewer({ className = '' }: Props) {
  const [selected, setSelected] = useState(LOG_FILES[0]);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tailscale, setTailscale] = useState<{ ok: boolean; latency?: number } | null>(null);
  const [autoTail, setAutoTail] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const l = await tailLog(selected.path, 200);
      setLines(l);
    } catch (e) {
      setLines([String(e)]);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const checkTailscale = useCallback(async () => {
    const st = await tailscalePing();
    setTailscale({ ok: st.ok, latency: st.latency_ms });
  }, []);

  useEffect(() => {
    loadLog();
    checkTailscale();
    const id = setInterval(checkTailscale, 30000);
    return () => clearInterval(id);
  }, [loadLog, checkTailscale]);

  useEffect(() => {
    if (autoTail) {
      intervalRef.current = setInterval(loadLog, 2000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoTail, loadLog]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className={`zion-card ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-gray-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Log Viewer</h3>
        </div>
        <div className="flex items-center gap-2">
          {tailscale && (
            <span
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                tailscale.ok
                  ? 'text-emerald-300 border-emerald-500/20 bg-emerald-900/20'
                  : 'text-red-300 border-red-500/20 bg-red-900/20'
              }`}
            >
              {tailscale.ok ? <Wifi size={10} /> : <WifiOff size={10} />}
              Tailscale {tailscale.ok ? `${tailscale.latency}ms` : 'DOWN'}
            </span>
          )}
          <button
            onClick={() => setAutoTail(v => !v)}
            className={`text-[10px] px-2 py-0.5 rounded border transition ${
              autoTail
                ? 'bg-emerald-700/30 border-emerald-500/30 text-emerald-300'
                : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
            {autoTail ? 'Auto ON' : 'Auto OFF'}
          </button>
          <button
            onClick={loadLog}
            disabled={loading}
            className="p-1 rounded bg-white/5 hover:bg-white/10 transition"
          >
            <RefreshCw size={12} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-2">
        {LOG_FILES.map(f => (
          <button
            key={f.label}
            onClick={() => setSelected(f)}
            className={`text-[10px] px-2 py-1 rounded border transition ${
              selected.label === f.label
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="font-mono text-[10px] leading-4 h-64 overflow-y-auto bg-black/30 rounded border border-white/5 p-2 space-y-0.5"
      >
        {lines.length === 0 && (
          <div className="text-gray-500 italic">No log lines (file may not exist yet)</div>
        )}
        {lines.map((line, i) => (
          <div key={i} className={logLineClass(line)}>
            {highlightLine(line)}
          </div>
        ))}
      </div>
    </div>
  );
}

function logLineClass(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('panic') || lower.includes('failed')) return 'text-red-400';
  if (lower.includes('warn')) return 'text-amber-400';
  if (lower.includes('info') || lower.includes('started') || lower.includes('accepted')) return 'text-cyan-400';
  if (lower.includes('height') || lower.includes('block') || lower.includes('sync')) return 'text-emerald-400';
  return 'text-gray-300';
}

function highlightLine(line: string): React.ReactNode {
  // Highlight timestamps like 2026-01-15T12:34:56
  const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\dZ+-:.]*)/);
  if (tsMatch) {
    const ts = tsMatch[1];
    const rest = line.slice(ts.length);
    return (
      <>
        <span className="text-gray-500">{ts}</span>
        {rest}
      </>
    );
  }
  return line;
}
