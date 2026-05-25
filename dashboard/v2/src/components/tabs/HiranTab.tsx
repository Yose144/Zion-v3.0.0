// ─── ZION Dashboard v2 — Hiran AI Tab ───────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import api from '../../api/client';
import type { HiranChatMessage, HiranStatus } from '../../types/api';

export default function HiranTab() {
  const [status, setStatus] = useState<HiranStatus | null>(null);
  const [messages, setMessages] = useState<HiranChatMessage[]>([
    { role: 'system', content: 'You are Hiran, the ZION AI assistant. Help the operator with node operations, troubleshooting, and blockchain queries.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadStatus = () =>
    api.hiranStatus().then(setStatus).catch(() => setStatus(null));

  useEffect(() => { loadStatus(); }, []);

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
    <div className="p-6 space-y-4">

      {/* Status card */}
      <Card title="Hiran v2.2 Inference" accent="purple" actions={
        <Button variant="ghost" size="sm" onClick={loadStatus}><RefreshCw size={12} /></Button>
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
                  {[0,1,2].map(i => (
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
