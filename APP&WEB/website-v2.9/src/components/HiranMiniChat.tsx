'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Brain, User, Loader2, Sparkles, MessageCircle } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTED_QUESTIONS = [
  { cs: 'Co je ZION?', en: 'What is ZION?' },
  { cs: 'Jak funguje těžba?', en: 'How does mining work?' },
  { cs: 'Co je AI Native?', en: 'What is AI Native?' },
];

export default function HiranMiniChat({ lang = 'cs' }: { lang?: 'cs' | 'en' }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const prompt = text.trim();
    if (!prompt || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error ?? 'Something went wrong.' },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            lang === 'cs'
              ? 'Nepodařilo se spojit s AI. Zkuste to znovu.'
              : 'Failed to connect to AI. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, lang]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 w-full rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/8 via-cyan-500/4 to-transparent p-4 backdrop-blur-sm transition-all duration-300 hover:border-purple-400/40 hover:shadow-[0_0_32px_rgba(139,92,246,0.12)]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/25 bg-purple-500/12 ring-1 ring-purple-400/15 transition-transform duration-300 group-hover:scale-110">
          <Brain className="h-5 w-5 text-purple-300" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-bold text-purple-300 tracking-wide">Hiran v2.2</span>
          <p className="text-[11px] text-gray-400 group-hover:text-gray-300 transition-colors">
            {lang === 'cs' ? 'Zeptejte se AI na cokoliv o ZIONu' : 'Ask AI anything about ZION'}
          </p>
        </div>
        <MessageCircle className="h-4 w-4 text-gray-500 transition-colors group-hover:text-purple-300" />
      </button>
    );
  }

  return (
    <div className="bg-black/70 backdrop-blur-xl rounded-2xl border border-purple-500/25 overflow-hidden flex flex-col" style={{ height: '320px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/40">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">Hiranyagarbha v2.2</h3>
          <p className="text-gray-400 text-[10px]">
            {lang === 'cs' ? 'ZION AI Native · zion-expert model' : 'ZION AI Native · zion-expert model'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400">Online</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Sparkles className="w-8 h-8 text-zion-gold mx-auto mb-3 opacity-60" />
            <p className="text-gray-400 text-xs mb-4">
              {lang === 'cs'
                ? 'Zeptejte se Hiranyagarbhy na cokoliv o ZIONu'
                : 'Ask Hiranyagarbha anything about ZION'}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(lang === 'cs' ? q.cs : q.en)}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                >
                  {lang === 'cs' ? q.cs : q.en}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Brain className="w-3 h-3 text-white" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-purple-500/15 border border-purple-500/25 text-gray-200'
                  : 'bg-white/5 border border-white/10 text-gray-300'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3 h-3 text-purple-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Brain className="w-3 h-3 text-white" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Loader2 className="w-3 h-3 text-cyan-300 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-white/10 bg-black/40">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={lang === 'cs' ? 'Napište zprávu...' : 'Type a message...'}
            disabled={loading}
            maxLength={2000}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center disabled:opacity-30 hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}
