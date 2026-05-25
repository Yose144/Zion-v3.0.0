// ─── ZION Dashboard v2 — Hiran AI Tab ───────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import api from '../../api/client';
import type { HiranChatMessage, HiranStatus, NclJob, NclWorker, NclEntry } from '../../types/api';

// ── Sub-tab types ─────────────────────────────────────────────────────────────

type SubTab = 'chat' | 'ncl-jobs' | 'ncl-workers' | 'leaderboard';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'chat',        label: 'Chat' },
  { id: 'ncl-jobs',    label: 'NCL Jobs' },
  { id: 'ncl-workers', label: 'NCL Workers' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex gap-1 py-4 justify-center">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 bg-(--color-text-muted) rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function AgeBadge({ ts }: { ts: number }) {
  const age = Math.floor((Date.now() / 1000 - ts) / 60);
  const label = age < 60 ? `${age}m` : `${Math.floor(age / 60)}h ${age % 60}m`;
  return <span className="text-xs font-mono text-(--color-text-muted)">{label}</span>;
}

// ── Chat panel ────────────────────────────────────────────────────────────────

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
      {/* Status card */}
      <Card title="Hiran v2.2 Inference" accent="purple" actions={
        <Button variant="ghost" size="sm" onClick={onReloadStatus}><RefreshCw size={12} /></Button>
      }>
        {status ? (
          <div className="flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-(--color-text-muted)">Model: </span>
              <span className="font-mono text-(--color-text)">{status.model}</span>
            </div>
            <div>
              <span className="text-(--color-text-muted)">Backend: </span>
              <Badge variant="cyan">{status.backend}</Badge>
            </div>
            <div>
              <span className="text-(--color-text-muted)">URL: </span>
              <span className="font-mono text-(--color-text)">{status.inference_url}</span>
            </div>
            <div>
              <span className="text-(--color-text-muted)">Context: </span>
              <span className="font-mono text-(--color-text)">{status.context_length}</span>
            </div>
            <Badge variant={status.running ? 'green' : 'red'}>{status.running ? 'running' : 'stopped'}</Badge>
          </div>
        ) : (
          <p className="text-xs text-(--color-text-muted)">Hiran inference not available — start it from Controls or via scripts/start-hiran-inference.ps1</p>
        )}
      </Card>

      {/* Chat */}
      <Card title="Chat with Hiran" accent="gold">
        <div className="h-96 overflow-y-auto space-y-3 mb-3 pr-1">
          {visible.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap
                ${msg.role === 'user'
                  ? 'bg-(--color-zion-purple)/20 border border-(--color-zion-purple)/40 text-(--color-text)'
                  : 'bg-(--color-bg-card) border border-(--color-border) text-(--color-text-dim)'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain size={11} className="text-(--color-zion-purple)" />
                    <span className="text-[10px] text-(--color-text-muted) font-medium">Hiran</span>
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-(--color-bg-card) border border-(--color-border) rounded-xl px-4 py-2.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 bg-(--color-text-muted) rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
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
            placeholder="Ask Hiran something… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={loading}
            className="flex-1 bg-(--color-bg-base) border border-(--color-border) rounded-lg px-3 py-2 text-sm text-(--color-text) placeholder:text-(--color-text-muted) resize-none focus:outline-none focus:border-(--color-zion-purple)/60"
          />
          <Button variant="primary" onClick={send} loading={loading} disabled={!input.trim()}>
            <Send size={14} />
          </Button>
        </div>

        <div className="mt-2 flex gap-2 flex-wrap">
          {['Node status?', 'Any errors?', 'Optimize miner settings', 'Explain block structure'].map(q => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="text-[10px] px-2 py-0.5 rounded border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text) hover:border-(--color-border)/80 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── NCL Jobs panel ────────────────────────────────────────────────────────────

function NclJobsPanel() {
  const [jobs,    setJobs]    = useState<NclJob[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.nclJobs();
      setJobs(res.jobs);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusVariant = (s: NclJob['status']) =>
    s === 'done'    ? 'green' :
    s === 'running' ? 'cyan'  :
    s === 'failed'  ? 'red'   : 'gray';

  return (
    <Card title="NCL Jobs" accent="purple" actions={
      <Button variant="ghost" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
    }>
      {loading && <LoadingDots />}
      {err && (
        <p className="text-xs text-(--color-zion-red) py-2">{err}</p>
      )}
      {!loading && jobs !== null && jobs.length === 0 && (
        <p className="text-xs text-(--color-text-muted) py-4 text-center">No NCL jobs found.</p>
      )}
      {!loading && jobs !== null && jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-(--color-border)">
                <th className="text-left py-2 pr-3 font-medium text-(--color-text-muted)">ID</th>
                <th className="text-left py-2 pr-3 font-medium text-(--color-text-muted)">Type</th>
                <th className="text-left py-2 pr-3 font-medium text-(--color-text-muted)">Status</th>
                <th className="text-left py-2 font-medium text-(--color-text-muted)">Age</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className="border-b border-(--color-border-dim) hover:bg-(--color-bg-hover) transition-colors last:border-0">
                  <td className="py-2 pr-3 font-mono text-(--color-text)">{job.id.slice(0, 12)}…</td>
                  <td className="py-2 pr-3 text-(--color-text-muted)">{job.type}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  </td>
                  <td className="py-2"><AgeBadge ts={job.created_ts} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── NCL Workers panel ─────────────────────────────────────────────────────────

function NclWorkersPanel() {
  const [workers, setWorkers] = useState<NclWorker[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.nclWorkers();
      setWorkers(res.workers);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Card title="NCL Workers" accent="cyan" actions={
      <Button variant="ghost" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
    }>
      {loading && <LoadingDots />}
      {err && (
        <p className="text-xs text-(--color-zion-red) py-2">{err}</p>
      )}
      {!loading && workers !== null && workers.length === 0 && (
        <p className="text-xs text-(--color-text-muted) py-4 text-center">No NCL workers registered.</p>
      )}
      {!loading && workers !== null && workers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-(--color-border)">
                <th className="text-left py-2 pr-3 font-medium text-(--color-text-muted)">ID</th>
                <th className="text-left py-2 pr-3 font-medium text-(--color-text-muted)">Name</th>
                <th className="text-left py-2 pr-3 font-medium text-(--color-text-muted)">Status</th>
                <th className="text-left py-2 pr-3 font-medium text-(--color-text-muted)">Jobs Done</th>
                <th className="text-left py-2 font-medium text-(--color-text-muted)">Score</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id} className="border-b border-(--color-border-dim) hover:bg-(--color-bg-hover) transition-colors last:border-0">
                  <td className="py-2 pr-3 font-mono text-(--color-text)">{w.id.slice(0, 10)}…</td>
                  <td className="py-2 pr-3 text-(--color-text)">{w.name}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={w.status === 'online' ? 'green' : 'gray'}>{w.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 font-mono text-(--color-text)">{w.jobs_completed.toLocaleString()}</td>
                  <td className="py-2 font-mono text-(--color-zion-gold)">{w.score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Leaderboard panel ─────────────────────────────────────────────────────────

function LeaderboardPanel() {
  const [entries, setEntries] = useState<NclEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.nclLeaderboard();
      setEntries(res.entries);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rankStyle = (rank: number) =>
    rank === 1 ? 'text-(--color-zion-gold) font-bold' :
    rank === 2 ? 'text-gray-300 font-semibold' :
    rank === 3 ? 'text-amber-600 font-semibold' :
    'text-(--color-text-muted)';

  return (
    <Card title="NCL Leaderboard" accent="gold" actions={
      <Button variant="ghost" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
    }>
      {loading && <LoadingDots />}
      {err && (
        <p className="text-xs text-(--color-zion-red) py-2">{err}</p>
      )}
      {!loading && entries !== null && entries.length === 0 && (
        <p className="text-xs text-(--color-text-muted) py-4 text-center">No leaderboard entries yet.</p>
      )}
      {!loading && entries !== null && entries.length > 0 && (
        <div className="space-y-1">
          {entries.map(e => (
            <div key={e.worker_id} className="flex items-center gap-3 py-2 border-b border-(--color-border-dim) last:border-0 hover:bg-(--color-bg-hover) rounded px-1 transition-colors">
              <span className={`w-6 text-center text-sm shrink-0 ${rankStyle(e.rank)}`}>
                {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : `#${e.rank}`}
              </span>
              <span className="flex-1 font-mono text-xs text-(--color-text) truncate">{e.worker_id}</span>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span className="text-(--color-text-muted)">{e.jobs} jobs</span>
                <span className="font-mono font-bold text-(--color-zion-gold)">{e.score.toLocaleString()} pts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HiranTab() {
  const [hiranStatus, setHiranStatus] = useState<HiranStatus | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('chat');

  const loadStatus = () =>
    api.hiranStatus().then(setHiranStatus).catch(() => setHiranStatus(null));

  useEffect(() => { loadStatus(); }, []);

  return (
    <div className="p-6 space-y-4">

      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-(--color-bg-panel) border border-(--color-border) rounded-lg p-1 w-fit">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              subTab === tab.id
                ? 'bg-(--color-zion-purple)/20 text-(--color-zion-purple) border border-(--color-zion-purple)/30'
                : 'text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-hover)'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      {subTab === 'chat' && (
        <ChatPanel status={hiranStatus} onReloadStatus={loadStatus} />
      )}
      {subTab === 'ncl-jobs' && <NclJobsPanel />}
      {subTab === 'ncl-workers' && <NclWorkersPanel />}
      {subTab === 'leaderboard' && <LeaderboardPanel />}

    </div>
  );
}
