import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, RefreshCw, Radio, Search } from 'lucide-react';
import { fetchLogFiles, streamLog, tailLog, type LogFileInfo } from '../lib/api';

interface Props {
  className?: string;
}

export default function LogViewer({ className = '' }: Props) {
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [selectedSvc, setSelectedSvc] = useState('pool');
  const [selectedFile, setSelectedFile] = useState('pool.log');
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeStreamRef = useRef<(() => void) | null>(null);
  const linesRef = useRef<string[]>([]);

  const loadLogFiles = useCallback(async () => {
    const data = await fetchLogFiles();
    if (data?.files?.length) {
      setLogFiles(data.files);
      // auto-select first file with content, or first file
      const withContent = data.files.find((f) => f.size_kb > 0);
      const first = withContent || data.files[0];
      setSelectedSvc(first.svc_id);
      setSelectedFile(first.name);
    }
  }, []);

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const l = await tailLog(`logs/${selectedFile}`, 200);
      linesRef.current = l;
      setLines(l);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedFile]);

  useEffect(() => {
    loadLogFiles();
  }, [loadLogFiles]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  // SSE live streaming
  useEffect(() => {
    if (closeStreamRef.current) {
      closeStreamRef.current();
      closeStreamRef.current = null;
    }
    if (live) {
      closeStreamRef.current = streamLog(selectedSvc, 200, (line) => {
        linesRef.current = [...linesRef.current, line].slice(-500);
        setLines([...linesRef.current]);
      });
    }
    return () => {
      if (closeStreamRef.current) {
        closeStreamRef.current();
        closeStreamRef.current = null;
      }
    };
  }, [live, selectedSvc]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const selectSvc = (f: LogFileInfo) => {
    setSelectedSvc(f.svc_id);
    setSelectedFile(f.name);
  };

  // Group log files by category for the selector
  const grouped = logFiles.reduce<Record<string, LogFileInfo[]>>((acc, f) => {
    const cat = f.svc_id.split('-')[0];
    (acc[cat] ||= []).push(f);
    return acc;
  }, {});

  const filteredLines = search
    ? lines.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : lines;

  return (
    <div className={`zion-card ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-gray-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Log Viewer</h3>
          <span className="text-[9px] text-gray-500 font-mono">{selectedFile}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLive((v) => !v)}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition ${
              live
                ? 'bg-emerald-700/30 border-emerald-500/30 text-emerald-300'
                : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
            <Radio size={10} className={live ? 'animate-pulse' : ''} />
            {live ? 'LIVE' : 'Live OFF'}
          </button>
          <button
            onClick={loadLog}
            disabled={loading || live}
            className="p-1 rounded bg-white/5 hover:bg-white/10 transition disabled:opacity-40"
          >
            <RefreshCw size={12} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Service selector — scrollable chip list */}
      <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
        {Object.entries(grouped).map(([cat, files]) => (
          <div key={cat} className="flex items-center gap-0.5">
            {files.map((f) => (
              <button
                key={f.svc_id}
                onClick={() => selectSvc(f)}
                title={`${f.name} · ${f.size_kb}KB · ${f.modified}`}
                className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
                  selectedSvc === f.svc_id
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {f.svc_id}
              </button>
            ))}
          </div>
        ))}
        {logFiles.length === 0 && (
          <span className="text-[10px] text-gray-500">No log files found</span>
        )}
      </div>

      {/* Search filter */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter lines…"
            className="w-full text-[10px] bg-black/30 border border-white/10 rounded pl-7 pr-2 py-1 text-gray-300 focus:outline-none focus:border-white/30"
          />
        </div>
        <span className="text-[9px] text-gray-500 font-mono">{filteredLines.length}/{lines.length}</span>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        className="font-mono text-[10px] leading-4 h-72 overflow-y-auto bg-black/40 rounded border border-white/5 p-2 space-y-0.5"
      >
        {filteredLines.length === 0 && (
          <div className="text-gray-500 italic">
            {loading ? 'Loading…' : live ? 'Waiting for log output…' : 'No log lines (file may not exist)'}
          </div>
        )}
        {filteredLines.map((line, i) => (
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
  if (lower.includes('debug') || lower.includes('trace')) return 'text-gray-500';
  return 'text-gray-300';
}

function highlightLine(line: string): React.ReactNode {
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
