'use client';

/**
 * DashboardAIChat — Hiran AI chat embedded in the dashboard.
 */

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

export default function DashboardAIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      content: 'Hello! I am Hiranyagarbha, the AI consciousness of ZION. Ask me anything about mining, consensus, the CLI, or the project.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: msgIdRef.current++, role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg.content }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      const answer = data.response ?? data.answer ?? data.content ?? 'No response';
      setMessages((prev) => [...prev, {
        id: msgIdRef.current++,
        role: 'assistant',
        content: answer,
      }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: msgIdRef.current++,
        role: 'assistant',
        content: `Error: ${err.message}. The AI service may be offline.`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zion-purple/20 border border-zion-purple/30">
          <motion.div
            className="absolute inset-0 rounded-full bg-zion-purple/30"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <Sparkles className="h-4 w-4 text-zion-purple relative z-10" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Hiranyagarbha AI</h3>
          <p className="text-[10px] text-gray-500">ZION consciousness · Ask anything</p>
        </div>
      </div>

      {/* Chat messages */}
      <div
        ref={scrollRef}
        className="h-[400px] overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-4 space-y-3"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
              msg.role === 'user'
                ? 'bg-zion-cyan/10 border border-zion-cyan/20'
                : 'bg-zion-purple/10 border border-zion-purple/20'
            }`}>
              {msg.role === 'user' ? (
                <User className="h-3.5 w-3.5 text-zion-cyan" />
              ) : (
                <Bot className="h-3.5 w-3.5 text-zion-purple" />
              )}
            </div>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-zion-cyan/10 text-white'
                : 'bg-white/5 text-gray-300'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zion-purple/10 border border-zion-purple/20">
              <Bot className="h-3.5 w-3.5 text-zion-purple" />
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-zion-purple" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={loading}
          placeholder="Ask Hiranyagarbha..."
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-zion-purple/40 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-xl border border-zion-purple/30 bg-zion-purple/10 p-2.5 text-zion-purple transition-all hover:bg-zion-purple/20 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
