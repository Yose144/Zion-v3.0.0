'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Send, ChevronRight, Cpu, Activity, Wifi, Wallet, Sparkles, X } from 'lucide-react';

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
}

const QUICK_COMMANDS = [
  { label: 'node info', icon: Cpu, desc: 'Node info' },
  { label: 'node chain', icon: Activity, desc: 'Chain info' },
  { label: 'node peers', icon: Wifi, desc: 'Peers' },
  { label: 'node supply', icon: Sparkles, desc: 'Supply' },
  { label: 'status', icon: Activity, desc: 'Health check' },
  { label: 'ai status', icon: Sparkles, desc: 'AI health' },
] as const;

const COMMAND_HISTORY_KEY = 'zion-cli-history';

export default function WebTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 0,
      type: 'system',
      text: 'ZION Web CLI v1.0.0 — community edition\nConnected to: ZION V3 Mainnet\nType "help" for available commands.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lineIdRef = useRef(1);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COMMAND_HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    const id = lineIdRef.current++;
    setLines((prev) => [...prev, { id, type, text }]);
  }, []);

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim()) return;

    // Add input line
    addLine('input', cmd);

    // Save to history
    const newHistory = [cmd, ...history.filter((h) => h !== cmd)].slice(0, 50);
    setHistory(newHistory);
    setHistoryIdx(-1);
    try {
      localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(newHistory));
    } catch {}

    setLoading(true);
    try {
      const res = await fetch('/api/cli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      if (data.ok) {
        addLine('output', data.output);
      } else {
        addLine('error', data.error ?? 'Unknown error');
      }
    } catch (e: any) {
      addLine('error', `Request failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [history, addLine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    runCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const newIdx = historyIdx === -1 ? 0 : Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(newIdx);
      setInput(history[newIdx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      setInput(newIdx === -1 ? '' : history[newIdx] ?? '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple autocomplete
      const commands = ['node info', 'node chain', 'node peers', 'node supply', 'node mempool', 'status', 'ai ask', 'ai status', 'wallet balance', 'help', 'version'];
      const match = commands.find((c) => c.startsWith(input));
      if (match) setInput(match);
    }
  };

  const clearTerminal = () => {
    setLines([{ id: lineIdRef.current++, type: 'system', text: 'Terminal cleared.' }]);
  };

  // Collapsed view — just a button
  if (!expanded) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
       whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-2xl border border-zion-cyan/20 bg-gradient-to-br from-black/80 to-zion-purple/5"
      >
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-zion-cyan/10 blur-3xl" />
        <button
          onClick={() => setExpanded(true)}
          className="relative flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-zion-cyan/5"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-zion-cyan/20 border border-zion-cyan/30">
              <motion.div
                className="absolute inset-0 rounded-full bg-zion-cyan/40"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
              <Terminal className="h-5 w-5 text-zion-cyan relative z-10" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                ZION Terminal
                <span className="inline-flex items-center gap-1 rounded-full bg-zion-cyan/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-zion-cyan">
                  <Activity className="h-2.5 w-2.5" /> Interactive
                </span>
              </p>
              <p className="text-[10px] text-gray-500">
                Try: node info · status · ai ask · wallet balance
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>
      </motion.section>
    );
  }

  // Expanded terminal
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-zion-cyan/30 bg-black/90 shadow-[0_20px_60px_rgba(6,182,212,0.1)]"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-zion-purple/10 to-zion-cyan/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/70" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <div className="h-3 w-3 rounded-full bg-green-500/70" />
          </div>
          <span className="ml-3 text-xs font-mono text-gray-400">zion@terranova:~</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearTerminal}
            className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider"
          >
            Clear
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick command buttons */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 bg-black/40 px-4 py-2.5">
        {QUICK_COMMANDS.map((q) => (
          <button
            key={q.label}
            onClick={() => runCommand(q.label)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono text-gray-300 transition-all hover:border-zion-cyan/30 hover:bg-zion-cyan/10 hover:text-zion-cyan disabled:opacity-40"
          >
            <q.icon className="h-3 w-3" />
            {q.label}
          </button>
        ))}
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="h-[300px] overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed cursor-text"
      >
        {lines.map((line) => (
          <div key={line.id} className="mb-1 whitespace-pre-wrap break-all">
            {line.type === 'input' && (
              <div className="flex items-start gap-2">
                <span className="text-zion-gold shrink-0">zion@terranova:~$</span>
                <span className="text-white">{line.text}</span>
              </div>
            )}
            {line.type === 'output' && (
              <div className="text-gray-300 pl-0">{line.text}</div>
            )}
            {line.type === 'error' && (
              <div className="text-red-400">✗ {line.text}</div>
            )}
            {line.type === 'system' && (
              <div className="text-zion-cyan/70">{line.text}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-zion-cyan/60">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="h-3 w-3 rounded-full border border-zion-cyan/30 border-t-zion-cyan"
            />
            <span>Executing...</span>
          </div>
        )}
      </div>

      {/* Input line */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/10 bg-black/60 px-4 py-3">
        <span className="font-mono text-xs text-zion-gold shrink-0">zion@terranova:~$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          placeholder="type a command... (try 'help')"
          className="flex-1 bg-transparent font-mono text-xs text-white placeholder:text-gray-600 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-lg border border-zion-cyan/30 bg-zion-cyan/10 p-1.5 text-zion-cyan transition-all hover:bg-zion-cyan/20 disabled:opacity-30"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </motion.section>
  );
}
