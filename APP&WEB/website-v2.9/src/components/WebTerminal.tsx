'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Send, ChevronRight, Cpu, Activity, Wifi, Wallet, Sparkles, X,
  HelpCircle, Boxes, Search, Coins, Pickaxe, Network, GitBranch, Bot,
  Copy, Check, History, Trash2, Server, Blocks, Gauge, Droplets,
} from 'lucide-react';

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
}

type CommandCategory = 'Node' | 'Pool' | 'Explorer' | 'DeFi' | 'Mining' | 'Network' | 'DAO & Bridge' | 'Wallet' | 'AI' | 'Meta';

interface QuickCommand {
  label: string;
  icon: typeof Cpu;
  desc: string;
  category: CommandCategory;
}

const QUICK_COMMANDS: QuickCommand[] = [
  // Node
  { label: 'node info', icon: Cpu, desc: 'Node info', category: 'Node' },
  { label: 'node chain', icon: Activity, desc: 'Chain info', category: 'Node' },
  { label: 'node peers', icon: Wifi, desc: 'Peers', category: 'Node' },
  { label: 'node supply', icon: Sparkles, desc: 'Supply', category: 'Node' },
  { label: 'node mempool', icon: Blocks, desc: 'Mempool', category: 'Node' },
  // Pool
  { label: 'pool stats', icon: Gauge, desc: 'Pool stats', category: 'Pool' },
  { label: 'pool miners', icon: Pickaxe, desc: 'Top miners', category: 'Pool' },
  { label: 'pool blocks', icon: Blocks, desc: 'Recent blocks', category: 'Pool' },
  { label: 'pool servers', icon: Server, desc: 'Pool servers', category: 'Pool' },
  { label: 'pool payouts', icon: Coins, desc: 'Fee split & wallets', category: 'Pool' },
  // Explorer
  { label: 'explorer stats', icon: Activity, desc: 'Chain stats', category: 'Explorer' },
  { label: 'explorer supply', icon: Coins, desc: 'Supply', category: 'Explorer' },
  { label: 'explorer richlist', icon: Coins, desc: 'Rich list', category: 'Explorer' },
  // DeFi
  { label: 'defi price', icon: Coins, desc: 'ZION price', category: 'DeFi' },
  { label: 'defi pools', icon: Droplets, desc: 'Pool stats & TVL', category: 'DeFi' },
  { label: 'defi status', icon: GitBranch, desc: 'DeFi status', category: 'DeFi' },
  // Mining
  { label: 'mine start', icon: Pickaxe, desc: 'Mining guide', category: 'Mining' },
  { label: 'mine calc 100M', icon: Gauge, desc: 'Reward calc', category: 'Mining' },
  { label: 'mine benchmarks', icon: Cpu, desc: 'Hardware benchmarks', category: 'Mining' },
  // Network
  { label: 'network stats', icon: Network, desc: 'Network overview', category: 'Network' },
  { label: 'network peers', icon: Wifi, desc: 'Detailed peers', category: 'Network' },
  // DAO & Bridge
  { label: 'dao proposals', icon: Boxes, desc: 'Governance', category: 'DAO & Bridge' },
  { label: 'bridge status', icon: GitBranch, desc: 'Bridge relay', category: 'DAO & Bridge' },
  // Wallet
  { label: 'wallet balance', icon: Wallet, desc: 'Balance', category: 'Wallet' },
  // AI
  { label: 'ai status', icon: Sparkles, desc: 'AI health', category: 'AI' },
  // Meta
  { label: 'status', icon: Activity, desc: 'Health check', category: 'Meta' },
  { label: 'version', icon: Terminal, desc: 'Versions', category: 'Meta' },
  { label: 'about', icon: HelpCircle, desc: 'About ZION', category: 'Meta' },
  { label: 'clear', icon: Trash2, desc: 'Clear terminal', category: 'Meta' },
];

const CATEGORIES: CommandCategory[] = ['Node', 'Pool', 'Explorer', 'DeFi', 'Mining', 'Network', 'DAO & Bridge', 'Wallet', 'AI', 'Meta'];

const CATEGORY_ICONS: Record<CommandCategory, typeof Cpu> = {
  'Node': Cpu,
  'Pool': Gauge,
  'Explorer': Search,
  'DeFi': Coins,
  'Mining': Pickaxe,
  'Network': Network,
  'DAO & Bridge': Boxes,
  'Wallet': Wallet,
  'AI': Bot,
  'Meta': HelpCircle,
};

const COMMAND_HISTORY_KEY = 'zion-cli-history';
const CLEAR_MARKER = '__CLEAR__';

const GENESIS_BANNER = String.raw`
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⣀⢂⣁⣧⣖⡖⠠⢠⠀⠀⢤⡀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢼⣶⡭⣛⠫⡞⠡⠀⡤⢦⠆⠨⠀⠀⢸⠋⠬⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠒⢈⠀⢭⣉⠂⡄⢠⠖⣸⠑⣆⡦⠊⢀⠀⡂⢉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠍⠚⣁⣀⡀⣤⣰⢶⢷⢼⣿⠏⡡⢠⢗⡙⣶⣞⠛⣍⣪⣼⡠⠠⢶⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⢄⣎⡠⢠⠉⠋⠓⠉⠋⢨⠘⠚⢉⡄⠁⢾⡌⣗⢿⠛⠲⠛⠋⡝⠑⠀⠌⡤⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠘⠥⠄⡚⣜⢣⣴⡨⢁⡀⣈⡅⠀⣀⠀⠈⣄⣀⢿⣯⡔⢊⢺⣷⠆⣷⠶⠂⠀⠀⠀⢀⡀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠘⢁⣨⡅⠨⣤⣭⣵⣿⢿⢏⠿⠯⡁⠹⣿⡯⡜⠫⢯⢿⡾⣻⡅⣠⣆⣄⣰⡐⠲⠼⢶⠒⠯⠅⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠂⢈⠙⡋⣟⡛⣷⠴⢼⠓⠋⣺⣴⣷⣷⢾⣿⡿⣡⣠⣸⠗⠻⠹⠿⣟⢥⠯⣿⠻⢅⢴⢎⠄⠀⡄⢠⣀⠀⡀⠀⢄⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢘⠳⠋⣤⣶⡿⢜⣳⢦⢶⣌⣩⠶⢠⣤⣯⠷⠈⠬⡉⠎⠎⣀⡌⠟⣝⣿⠇⡚⠒⠔⢀⣴⣍⣾⢲⠋⠟⠈⠙⠑⠉⢀⠄⠀
⠀⠀⠀⡀⣽⠿⠻⡈⠱⢻⣽⡟⣶⣚⡻⢏⢹⡋⠁⣀⣂⣤⣴⠄⢤⣐⣴⡾⣶⠯⣄⣉⢓⡭⢍⡆⡀⣈⣿⣷⡷⠶⠒⢂⣠⣠⢶⣾⣳⣯⣵⡄
⠀⠀⠀⠰⠴⠀⢘⢉⣧⣥⣏⠳⢈⣫⠞⣿⣷⢤⣤⣿⣿⣾⣧⣾⣿⣿⣿⣗⣿⣿⣿⠋⣚⡃⠿⡭⠹⣷⣿⠾⡿⢤⣤⣜⢿⣯⡿⣷⠯⣽⣿⡾
⠀⠀⠀⠀⠀⠐⠞⠻⣿⢟⣿⢿⠷⠥⣼⣷⢷⣯⠟⠻⠙⢉⡿⣿⢻⣹⣿⣿⢉⢳⣿⣿⣯⡶⡄⡶⢦⣷⣶⣿⡬⢥⠨⣭⣹⠏⠁⡘⢫⠉⠈⠀
⠀⠀⠔⣼⢂⠬⢌⠧⢋⡛⢡⣮⡡⠈⠓⣃⢀⣒⣊⣽⠻⣛⠟⢿⢸⣯⣿⣓⣿⡟⣷⣟⣿⣿⣿⣿⣻⣷⣟⣒⡺⠏⢰⡿⠿⣶⣶⡻⠒⡿⠦⡀
⠀⢆⣀⣆⣸⣿⠋⡴⢲⡁⡋⠀⢴⣮⣷⠟⠫⠿⣿⢶⢅⢴⣇⣸⣷⣿⣿⣧⣾⣿⣿⣿⣿⣿⣿⣿⣿⢿⢿⣟⣲⢦⠦⢋⡀⢿⣾⣷⣶⣤⠋⠆
⠈⠘⠛⠼⠿⡝⣻⠛⠻⠀⠀⠐⠛⢹⣱⣟⣽⣯⣿⡟⡊⣿⣷⣖⢽⣿⣿⣿⢿⣿⠀⠀⠘⠋⠃⠁⠀⠀⠨⠟⠿⡷⣥⣉⠁⠘⠉⠊⠚⠚⠓⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠋⠀⠀⠀⠀⠈⠋⠹⣎⢻⣿⠟⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠛⢳⡕⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣾⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣹⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠚⠛⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀

████████╗██╗ ██████╗███╗   ██╗
╚══███╔╝██║██╔═══██╗████╗  ██║
  ███╔╝ ██║██║   ██║██╔██╗ ██║
 ███╔╝  ██║██║   ██║██║╚██╗██║
███████╗██║╚██████╔╝██║ ╚████║
╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝  "Mainnet Launch v3"

Gate, Gate, Paragate, Parasamgate, Bodhi Swaha
The Golden Age begins. Peace & One Love 4ever.
`;

const WELCOME_TEXT = `${GENESIS_BANNER}
ZION Web CLI v2.1.0 — v3.0.3 mainnet
6-decimal flowers (1 ZION = 1,000,000 flowers)
Fee split: 89% miner / 5% humanitarian / 5% Issobella / 1% burned
Type "help" or "?" for all commands. Press Tab for autocomplete.`;

export default function WebTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: 'system', text: WELCOME_TEXT },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCmd, setLoadingCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [expanded, setExpanded] = useState(true);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CommandCategory | 'All'>('All');
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [nodeOnline, setNodeOnline] = useState<boolean | null>(null);
  const [autocompleteMatches, setAutocompleteMatches] = useState<string[]>([]);
  const [autocompleteIdx, setAutocompleteIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lineIdRef = useRef(1);

  // All known commands for autocomplete
  const ALL_COMMANDS = useMemo(() => {
    const cmds = new Set<string>();
    QUICK_COMMANDS.forEach((q) => cmds.add(q.label));
    [
      'help', 'version', 'status', 'about', 'docs', 'links', 'clear',
      'node info', 'node chain', 'node peers', 'node supply', 'node mempool',
      'pool stats', 'pool miners', 'pool blocks', 'pool servers', 'pool payouts',
      'explorer block', 'explorer tx', 'explorer address', 'explorer search',
      'explorer richlist', 'explorer supply', 'explorer stats',
      'defi price', 'defi pools', 'defi status',
      'mine start', 'mine calc', 'mine benchmarks',
      'network stats', 'network peers',
      'dao proposals', 'bridge status',
      'wallet balance', 'ai ask', 'ai status',
      'ls', 'h', '?', 'whoami', 'ver', 'clr', 'cls', 'ex', 'net', 'mining',
    ].forEach((c) => cmds.add(c));
    return Array.from(cmds).sort();
  }, []);

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
  }, [lines, loading]);

  // Poll node health every 30s
  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        if (active) setNodeOnline(data.status === 'ok' || data.status === 'degraded');
      } catch {
        if (active) setNodeOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Autocomplete suggestions as user types
  useEffect(() => {
    if (!input.trim() || input.includes(' ')) {
      setAutocompleteMatches([]);
      setAutocompleteIdx(-1);
      return;
    }
    const lower = input.toLowerCase();
    const matches = ALL_COMMANDS.filter((c) => c.toLowerCase().startsWith(lower)).slice(0, 6);
    setAutocompleteMatches(matches);
    setAutocompleteIdx(-1);
  }, [input, ALL_COMMANDS]);

  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    const id = lineIdRef.current++;
    setLines((prev) => [...prev, { id, type, text }]);
  }, []);

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim()) return;

    // Handle clear locally for instant feedback
    const lower = cmd.trim().toLowerCase();
    if (lower === 'clear' || lower === 'clr' || lower === 'cls') {
      addLine('input', cmd);
      setLines([{ id: lineIdRef.current++, type: 'system', text: 'Terminal cleared.' }]);
      // still save to history
      const newHistory = [cmd, ...history.filter((h) => h !== cmd)].slice(0, 50);
      setHistory(newHistory);
      setHistoryIdx(-1);
      try { localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(newHistory)); } catch {}
      return;
    }

    // Add input line
    addLine('input', cmd);

    // Save to history
    const newHistory = [cmd, ...history.filter((h) => h !== cmd)].slice(0, 50);
    setHistory(newHistory);
    setHistoryIdx(-1);
    try { localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(newHistory)); } catch {}

    setLoading(true);
    setLoadingCmd(cmd);
    try {
      const res = await fetch('/api/cli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      if (data.ok) {
        if (typeof data.output === 'string' && data.output.startsWith(CLEAR_MARKER)) {
          setLines([{ id: lineIdRef.current++, type: 'system', text: 'Terminal cleared.' }]);
        } else {
          addLine('output', data.output);
        }
      } else {
        addLine('error', data.error ?? 'Unknown error');
      }
    } catch (e: any) {
      addLine('error', `Request failed: ${e.message}`);
    } finally {
      setLoading(false);
      setLoadingCmd('');
    }
  }, [history, addLine]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    // If autocomplete is open and user has a selection, use it
    if (autocompleteIdx >= 0 && autocompleteMatches[autocompleteIdx]) {
      runCommand(autocompleteMatches[autocompleteIdx]);
      setInput('');
      setAutocompleteMatches([]);
      setAutocompleteIdx(-1);
      return;
    }
    runCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Autocomplete navigation
    if (autocompleteMatches.length > 0 && !input.includes(' ')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIdx((i) => Math.min(i + 1, autocompleteMatches.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Escape') {
        setAutocompleteMatches([]);
        setAutocompleteIdx(-1);
        return;
      }
    }

    if (e.key === 'ArrowUp' && (autocompleteMatches.length === 0 || input.includes(' '))) {
      e.preventDefault();
      if (history.length === 0) return;
      const newIdx = historyIdx === -1 ? 0 : Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(newIdx);
      setInput(history[newIdx] ?? '');
    } else if (e.key === 'ArrowDown' && (autocompleteMatches.length === 0 || input.includes(' '))) {
      e.preventDefault();
      if (historyIdx === -1) return;
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      setInput(newIdx === -1 ? '' : history[newIdx] ?? '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Autocomplete: if matches exist, complete to first match (or selected)
      if (autocompleteMatches.length > 0) {
        const chosen = autocompleteIdx >= 0 ? autocompleteMatches[autocompleteIdx] : autocompleteMatches[0];
        if (chosen && chosen.startsWith(input)) {
          setInput(chosen);
          setAutocompleteMatches([]);
          setAutocompleteIdx(-1);
        }
      } else {
        // Fallback: complete from full command list
        const match = ALL_COMMANDS.find((c) => c.startsWith(input));
        if (match) setInput(match);
      }
    } else if (e.key === 'Enter' && autocompleteIdx >= 0 && autocompleteMatches[autocompleteIdx]) {
      e.preventDefault();
      runCommand(autocompleteMatches[autocompleteIdx]);
      setInput('');
      setAutocompleteMatches([]);
      setAutocompleteIdx(-1);
    }
  };

  const clearTerminal = () => {
    setLines([{ id: lineIdRef.current++, type: 'system', text: 'Terminal cleared.' }]);
  };

  const copyLine = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  };

  const filteredQuickCommands = useMemo(() => {
    if (activeCategory === 'All') return QUICK_COMMANDS;
    return QUICK_COMMANDS.filter((q) => q.category === activeCategory);
  }, [activeCategory]);

  // Collapsed view — just a button
  if (!expanded) {
    return (
      <section className="px-4 py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-zion-cyan/20 bg-gradient-to-br from-black/85 via-[#081019] to-zion-purple/10 shadow-[0_24px_80px_rgba(6,182,212,0.12)]"
        >
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-zion-cyan/10 blur-3xl" />
          <button
            onClick={() => setExpanded(true)}
            className="relative flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-zion-cyan/5 sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zion-cyan/20 border border-zion-cyan/30">
                <motion.div
                  className="absolute inset-0 rounded-full bg-zion-cyan/40"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />
                <Terminal className="h-5 w-5 text-zion-cyan relative z-10" />
              </div>
              <div className="min-w-0 text-left">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                  ZION Terminal
                  <span className="inline-flex items-center gap-1 rounded-full bg-zion-cyan/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-zion-cyan">
                    <Activity className="h-2.5 w-2.5" /> Interactive
                  </span>
                </p>
                <p className="truncate text-[10px] text-gray-500 sm:text-xs">
                  Web CLI v2.1.0 · node · pool · explorer · defi · mine · dao · bridge · ai
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
          </button>
        </motion.div>
      </section>
    );
  }

  // Expanded terminal
  return (
    <section className="px-4 py-6 md:py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-zion-cyan/30 bg-black/92 shadow-[0_24px_80px_rgba(6,182,212,0.14)]"
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
            {/* Status indicator */}
            <div className="ml-2 flex items-center gap-1" title={nodeOnline === null ? 'Checking…' : nodeOnline ? 'Node online' : 'Node offline'}>
              <motion.div
                className={`h-2 w-2 rounded-full ${nodeOnline === null ? 'bg-gray-500' : nodeOnline ? 'bg-green-500' : 'bg-red-500'}`}
                animate={nodeOnline ? { opacity: [1, 0.4, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelpPanel((v) => !v)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-all ${showHelpPanel ? 'bg-zion-cyan/20 text-zion-cyan' : 'text-gray-500 hover:text-white'}`}
              title="Toggle help panel"
            >
              <HelpCircle className="h-3 w-3" /> ?
            </button>
            <button
              onClick={() => setShowHistoryDropdown((v) => !v)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-500 transition-all hover:text-white"
              title="Command history"
            >
              <History className="h-3 w-3" /> History
            </button>
            <button
              onClick={clearTerminal}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-500 transition-all hover:text-white"
              title="Clear terminal"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* History dropdown */}
        <AnimatePresence>
          {showHistoryDropdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/10 bg-black/60"
            >
              <div className="max-h-48 overflow-y-auto px-4 py-2">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-gray-500">Command History ({history.length})</p>
                {history.length === 0 ? (
                  <p className="text-xs text-gray-600">No commands yet.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {history.map((h, i) => (
                      <button
                        key={`${h}-${i}`}
                        onClick={() => {
                          runCommand(h);
                          setShowHistoryDropdown(false);
                        }}
                        className="flex items-center gap-2 rounded px-2 py-1 text-left font-mono text-xs text-gray-300 transition-colors hover:bg-zion-cyan/10 hover:text-zion-cyan"
                      >
                        <ChevronRight className="h-3 w-3 shrink-0 text-gray-600" />
                        <span className="truncate">{h}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category filter + Quick command buttons */}
        <div className="border-b border-white/5 bg-black/40 px-4 py-2.5">
          {/* Category filter */}
          <div className="mb-2 flex flex-wrap gap-1">
            <button
              onClick={() => setActiveCategory('All')}
              className={`rounded-md px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider transition-all ${activeCategory === 'All' ? 'bg-zion-cyan/20 text-zion-cyan' : 'text-gray-500 hover:text-gray-300'}`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider transition-all ${activeCategory === cat ? 'bg-zion-cyan/20 text-zion-cyan' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {cat}
                </button>
              );
            })}
          </div>
          {/* Quick commands */}
          <div className="flex flex-wrap gap-2">
            {filteredQuickCommands.map((q) => (
              <button
                key={q.label}
                onClick={() => runCommand(q.label)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-mono text-gray-300 transition-all hover:border-zion-cyan/30 hover:bg-zion-cyan/10 hover:text-zion-cyan disabled:opacity-40"
                title={q.desc}
              >
                <q.icon className="h-3 w-3" />
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal body: output + help panel */}
        <div className="flex">
          {/* Terminal output */}
          <div className="relative flex-1">
            <div
              ref={scrollRef}
              onClick={() => inputRef.current?.focus()}
              className="h-[420px] overflow-y-auto px-3 py-3 font-mono text-xs leading-relaxed cursor-text sm:px-4 md:h-[520px] lg:h-[600px]"
            >
              {lines.map((line) => (
                <div key={line.id} className="group mb-1">
                  {line.type === 'input' && (
                    <div className="flex items-start gap-2">
                      <span className="text-zion-gold shrink-0">zion@terranova:~$</span>
                      <span className="break-words text-white">{line.text}</span>
                    </div>
                  )}
                  {line.type === 'output' && (
                    <div className="relative">
                      <div className="whitespace-pre-wrap break-words pl-0 text-gray-300">{line.text}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyLine(line.id, line.text); }}
                        className="absolute right-0 top-0 hidden rounded bg-white/5 p-1 text-gray-500 opacity-0 transition-opacity hover:text-zion-cyan group-hover:opacity-100 sm:block"
                        title="Copy output"
                      >
                        {copiedId === line.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                  {line.type === 'error' && (
                    <div className="relative">
                      <div className="flex items-start gap-1.5 whitespace-pre-wrap break-words text-red-400">
                        <span className="shrink-0 text-red-500">✗</span>
                        <span>{line.text}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyLine(line.id, line.text); }}
                        className="absolute right-0 top-0 hidden rounded bg-white/5 p-1 text-gray-500 opacity-0 transition-opacity hover:text-zion-cyan group-hover:opacity-100 sm:block"
                        title="Copy error"
                      >
                        {copiedId === line.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                  {line.type === 'system' && (
                    <pre className="overflow-x-auto whitespace-pre text-[9px] leading-snug text-zion-cyan/70 sm:text-[10px] md:text-xs">{line.text}</pre>
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
                  <span>Executing "{loadingCmd}"...</span>
                </div>
              )}
            </div>
          </div>

          {/* Help panel */}
          <AnimatePresence>
            {showHelpPanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="hidden shrink-0 overflow-hidden border-l border-white/10 bg-black/60 lg:block"
              >
                <div className="h-[600px] w-72 overflow-y-auto px-4 py-3">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zion-cyan">Command Reference</p>
                  {CATEGORIES.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat];
                    const cmds = QUICK_COMMANDS.filter((q) => q.category === cat);
                    if (cmds.length === 0) return null;
                    return (
                      <div key={cat} className="mb-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zion-purple">
                          <Icon className="h-3 w-3" />
                          {cat}
                        </div>
                        <div className="flex flex-col gap-1">
                          {cmds.map((q) => (
                            <button
                              key={q.label}
                              onClick={() => runCommand(q.label)}
                              disabled={loading}
                              className="flex items-start gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-zion-cyan/10 disabled:opacity-40"
                            >
                              <q.icon className="mt-0.5 h-3 w-3 shrink-0 text-zion-cyan/70" />
                              <div className="min-w-0">
                                <p className="font-mono text-[11px] text-gray-200">{q.label}</p>
                                <p className="text-[9px] text-gray-500">{q.desc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-2 border-t border-white/10 pt-2">
                    <p className="text-[9px] text-gray-600">
                      Aliases: ls/h/? = help · v/whoami = version · clr/cls = clear · ex = explorer · net = network
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Autocomplete dropdown */}
        {autocompleteMatches.length > 0 && !input.includes(' ') && (
          <div className="border-t border-white/5 bg-black/80 px-4 py-1.5">
            {autocompleteMatches.map((m, i) => (
              <button
                key={m}
                onMouseDown={(e) => { e.preventDefault(); runCommand(m); setInput(''); setAutocompleteMatches([]); }}
                onMouseEnter={() => setAutocompleteIdx(i)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left font-mono text-xs transition-colors ${i === autocompleteIdx ? 'bg-zion-cyan/20 text-zion-cyan' : 'text-gray-400 hover:bg-white/5'}`}
              >
                <ChevronRight className="h-3 w-3 shrink-0 text-gray-600" />
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Input line */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/10 bg-black/60 px-4 py-3">
          <span className="hidden font-mono text-xs text-zion-gold shrink-0 sm:inline">zion@terranova:~$</span>
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
            placeholder="type a command... (try 'help' or press Tab)"
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
      </motion.div>
    </section>
  );
}
