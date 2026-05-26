// ─── ZION Dashboard v2 — Hiran AI Tab (website v2.9 style) ──────────────────
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Brain, RefreshCw, Trophy, Cpu } from 'lucide-react';
import { Badge } from '../ui/Badge';
import api from '../../api/client';
import type { HiranChatMessage, HiranStatus, NclJob, NclWorker, NclEntry } from '../../types/api';

type SubTab = 'chat' | 'ncl-jobs' | 'ncl-workers' | 'leaderboard';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'chat',        label: 'Chat' },
  { id: 'ncl-jobs',    label: 'NCL Jobs' },
  { id: 'ncl-workers', label: 'Workers' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

function LoadingDots() {
  return (
    <div className="flex gap-1 py-6 justify-center">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function AgeBadge({ ts }: { ts: number }) {
  const age = Math.floor((Date.now() / 1000 - ts) / 60);
  const label = age < 60 ? `${age}m` : `${Math.floor(age / 60)}h ${age % 60}m`;
  return <span className="text-xs font-mono text-gray-500">{label}</span>;
}

// ── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({ title, sub, iconColor, icon: Icon, actions, children }: {
  title: string; sub?: string;
  iconColor: string; icon: React.ComponentType<{ size?: number; className?: string }>;
  actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon size={15} className={iconColor.replace('bg-', 'text-').replace('/10', '')} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="px-6 py-4">{children}</div>
    </motion.div>
  );
}

// ── Chat panel ───────────────────────────────────────────────────────────────
function ChatPanel({ status, onReloadStatus }: { status: HiranStatus | null; onReloadStatus: () => void }) {
  const [messages, setMessages] = useState<HiranChatMessage[]>([
    { role: 'system', content: 'You are Hiran, the ZION AI assistant. Help the operator with node operations, troubleshooting, and blockchain queries.' },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const visible = messages.filter(m => m.role !== 'system');

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: HiranChatMessage = { role: 'user', content: text };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput('');
    setLoading(true);
    try {
      const res = await api.hiranChat({ messages: nextMsgs, max_tokens: 512 });
      setMessages(m => [...m, res.message]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Error: ${String(e)}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
              <Brain size={15} className="text-zion-purple" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Hiran v2.2 Inference</h3>
              <p className="text-[11px] text-gray-500">Neural AI model status</p>
            </div>
          </div>
          <button
            onClick={onReloadStatus}
            className="p-2 rounded-xl border border-white/8 bg-white/5 text-gray-500 hover:text-white hover:border-white/20 transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="px-6 py-4">
          {status ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Model:</span>
                <span className="font-mono text-gray-200">{status.model}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Backend:</span>
                <Badge variant="cyan">{status.backend}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">URL:</span>
                <span className="font-mono text-gray-400 text-xs">{status.inference_url}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Context:</span>
                <span className="font-mono text-gray-200">{status.context_length}</span>
              </div>
              <Badge variant={status.running ? 'green' : 'red'}>{status.running ? 'running' : 'stopped'}</Badge>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Hiran inference not available — start via Controls or <code className="text-zion-cyan text-xs bg-white/5 px-1.5 py-0.5 rounded">scripts/start-hiran-inference.ps1</code>
            </p>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-zion-gold/10 flex items-center justify-center">
            <Brain size={15} className="text-zion-gold" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Chat with Hiran</h3>
            <p className="text-[11px] text-gray-500">AI assistant for node operations</p>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="h-80 overflow-y-auto space-y-3 mb-4 pr-1">
            {visible.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-zion-purple/15 border border-zion-purple/25 text-gray-200'
                    : 'bg-white/5 border border-white/8 text-gray-300'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Brain size={11} className="text-zion-purple" />
                      <span className="text-[10px] text-gray-500 font-medium">Hiran</span>
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Hiran something… (Enter to send)"
              rows={2}
              disabled={loading}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-white/20"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 rounded-xl bg-zion-purple/20 border border-zion-purple/30 text-zion-purple hover:bg-zion-purple/30 transition-colors disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            {['Node status?', 'Any errors?', 'Optimize miner settings', 'Explain block structure'].map(q => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-white/8 bg-white/4 text-gray-500 hover:text-gray-200 hover:border-white/16 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NCL Jobs ─────────────────────────────────────────────────────────────────
function NclJobsPanel() {
  const [jobs,    setJobs]    = useState<NclJob[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { const res = await api.nclJobs(); setJobs(res.jobs); }
    catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const statusColor = (s: NclJob['status']) =>
    s === 'done' ? 'text-green-400' : s === 'running' ? 'text-zion-cyan' : s === 'failed' ? 'text-red-400' : 'text-gray-500';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
            <Cpu size={15} className="text-zion-purple" />
          </div>
          <div><h3 className="text-base font-semibold text-white">NCL Jobs</h3></div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl border border-white/8 bg-white/5 text-gray-500 hover:text-white transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="px-6 py-4">
        {loading && <LoadingDots />}
        {err && <p className="text-xs text-red-400 py-2">{err}</p>}
        {!loading && jobs?.length === 0 && <p className="text-sm text-gray-600 py-4 text-center">No NCL jobs found.</p>}
        {!loading && jobs && jobs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/4">
                {['ID', 'Type', 'Status', 'Age'].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 first:pl-0">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b border-white/3 hover:bg-white/3 transition-colors last:border-0">
                    <td className="py-3 pr-3 font-mono text-gray-300 text-xs">{job.id.slice(0, 12)}…</td>
                    <td className="py-3 pr-3 text-gray-400 text-xs">{job.type}</td>
                    <td className="py-3 pr-3"><span className={`text-xs font-semibold ${statusColor(job.status)}`}>{job.status}</span></td>
                    <td className="py-3"><AgeBadge ts={job.created_ts} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── NCL Workers ──────────────────────────────────────────────────────────────
function NclWorkersPanel() {
  const [workers, setWorkers] = useState<NclWorker[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { const res = await api.nclWorkers(); setWorkers(res.workers); }
    catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
            <Cpu size={15} className="text-zion-cyan" />
          </div>
          <div><h3 className="text-base font-semibold text-white">NCL Workers</h3></div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl border border-white/8 bg-white/5 text-gray-500 hover:text-white transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="px-6 py-4">
        {loading && <LoadingDots />}
        {err && <p className="text-xs text-red-400 py-2">{err}</p>}
        {!loading && workers?.length === 0 && <p className="text-sm text-gray-600 py-4 text-center">No NCL workers registered.</p>}
        {!loading && workers && workers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/4">
                {['ID', 'Name', 'Status', 'Jobs Done', 'Score'].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3 first:pl-0">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id} className="border-b border-white/3 hover:bg-white/3 transition-colors last:border-0">
                    <td className="py-3 pr-3 font-mono text-gray-300 text-xs">{w.id.slice(0, 10)}…</td>
                    <td className="py-3 pr-3 text-gray-200 text-sm">{w.name}</td>
                    <td className="py-3 pr-3">
                      <span className={`text-xs font-semibold ${w.status === 'online' ? 'text-green-400' : 'text-gray-500'}`}>{w.status}</span>
                    </td>
                    <td className="py-3 pr-3 font-mono text-gray-300 text-sm">{w.jobs_completed.toLocaleString()}</td>
                    <td className="py-3 font-mono font-bold text-zion-gold text-sm">{w.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────────
function LeaderboardPanel() {
  const [entries, setEntries] = useState<NclEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try { const res = await api.nclLeaderboard(); setEntries(res.entries); }
    catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rankColor = (rank: number) =>
    rank === 1 ? 'text-zion-gold' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-gray-500';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zion-gold/10 flex items-center justify-center">
            <Trophy size={15} className="text-zion-gold" />
          </div>
          <div><h3 className="text-base font-semibold text-white">NCL Leaderboard</h3></div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl border border-white/8 bg-white/5 text-gray-500 hover:text-white transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="px-6 py-4">
        {loading && <LoadingDots />}
        {err && <p className="text-xs text-red-400 py-2">{err}</p>}
        {!loading && entries?.length === 0 && <p className="text-sm text-gray-600 py-4 text-center">No leaderboard entries yet.</p>}
        {!loading && entries && entries.length > 0 && (
          <div className="space-y-1">
            {entries.map(e => (
              <div key={e.worker_id} className="flex items-center gap-3 py-3 border-b border-white/4 last:border-0 hover:bg-white/3 rounded-xl px-2 transition-colors">
                <span className={`w-6 text-center text-sm shrink-0 font-bold ${rankColor(e.rank)}`}>
                  {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : `#${e.rank}`}
                </span>
                <span className="flex-1 font-mono text-xs text-gray-300 truncate">{e.worker_id}</span>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-gray-500">{e.jobs} jobs</span>
                  <span className="font-mono font-bold text-zion-gold">{e.score.toLocaleString()} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function HiranTab() {
  const [hiranStatus, setHiranStatus] = useState<HiranStatus | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('chat');

  const loadStatus = () =>
    api.hiranStatus().then(setHiranStatus).catch(() => setHiranStatus(null));

  useEffect(() => { loadStatus(); }, []);

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">

      {/* Sub-tab nav */}
      <div className="flex gap-1 rounded-2xl border border-white/8 bg-black/60 backdrop-blur p-1 w-fit">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
              subTab === tab.id
                ? 'bg-white/10 border border-white/15 text-white'
                : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'chat'         && <ChatPanel status={hiranStatus} onReloadStatus={loadStatus} />}
      {subTab === 'ncl-jobs'     && <NclJobsPanel />}
      {subTab === 'ncl-workers'  && <NclWorkersPanel />}
      {subTab === 'leaderboard'  && <LeaderboardPanel />}
    </div>
  );
}
