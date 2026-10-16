'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Send, Brain, User, Loader2, Sparkles, MessageCircle, X } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const Copy = {
  title: { cs: 'Hiranyagarbha', en: 'Hiranyagarbha' },
  subtitle: { cs: 'ZION AI Native', en: 'ZION AI Native' },
  fabLabel: { cs: 'Zeptat se AI', en: 'Ask AI' },
  askAnything: { cs: 'Zeptejte se na cokoliv o ZIONu', en: 'Ask anything about ZION' },
  typeMessage: { cs: 'Napište zprávu...', en: 'Type a message...' },
  online: { cs: 'Online', en: 'Online' },
  offline: { cs: 'Offline', en: 'Offline' },
  offlineHint: { cs: 'AI uzel je momentálně offline — zkuste to později.', en: 'The AI node is currently offline — please try again later.' },
  failed: { cs: 'Nepodařilo se spojit s AI. Zkuste to znovu.', en: 'Failed to connect to AI. Please try again.' },
};

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTED = [
  { cs: 'Co je ZION?', en: 'What is ZION?' },
  { cs: 'Jak funguje těžba?', en: 'How does mining work?' },
  { cs: 'Co je AI Native?', en: 'What is AI Native?' },
];

// Pages that already embed the full Hiranyagarbha chat — no floating copy there.
const HIDDEN_PATHS = new Set(['/l3-hiran', '/ai-native']);

export default function HiranFloatingChat() {
  const { lang } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = lang === 'cs' ? 'cs' : 'en';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/ai-chat', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setOnline(res.ok && data.available === true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

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
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.ok ? data.response : (data.error ?? Copy.failed[t]) },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: Copy.failed[t] }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, t]);

  if (HIDDEN_PATHS.has(pathname)) return null;

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={Copy.fabLabel[t]}
          className="fixed bottom-5 right-5 z-[70] group flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-zion-purple to-zion-cyan shadow-[0_0_32px_rgba(147,51,234,0.45)] hover:shadow-[0_0_48px_rgba(147,51,234,0.7)] transition-all duration-300 hover:scale-110"
        >
          <Brain className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black bg-zion-cyan animate-pulse" />
          <span className="absolute right-full mr-3 whitespace-nowrap rounded-lg border border-white/10 bg-black/80 px-2.5 py-1.5 text-[11px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {Copy.fabLabel[t]} · {Copy.title[t]}
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-[70] bottom-5 right-5 flex flex-col overflow-hidden rounded-2xl border border-zion-purple/30 bg-black/85 backdrop-blur-xl shadow-[0_0_48px_rgba(0,0,0,0.6)]"
          style={{ width: 'min(380px, calc(100vw - 2.5rem))', height: 'min(540px, calc(100dvh - 6rem))' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/40">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zion-purple to-zion-cyan flex items-center justify-center flex-shrink-0">
              <Brain className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm leading-tight">{Copy.title[t]}</h3>
              <p className="text-gray-400 text-[10px]">{Copy.subtitle[t]}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${online === false ? 'bg-zion-purple' : 'bg-zion-cyan animate-pulse'}`} />
              <span className={`text-[10px] ${online === false ? 'text-zion-purple' : 'text-zion-cyan'}`}>
                {online === null ? '…' : online ? Copy.online[t] : Copy.offline[t]}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="ml-1 text-gray-500 hover:text-white p-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Sparkles className="w-9 h-9 text-zion-gold mx-auto mb-3 opacity-60" />
                <p className="text-gray-400 text-xs mb-4">{Copy.askAnything[t]}</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {SUGGESTED.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(lang === 'cs' ? q.cs : q.en)}
                      className="text-[10px] px-2.5 py-1 rounded-full border border-zion-cyan/30 text-zion-cyan hover:bg-zion-cyan/10 transition-colors"
                    >
                      {lang === 'cs' ? q.cs : q.en}
                    </button>
                  ))}
                </div>
                {online === false && (
                  <p className="mt-4 text-[11px] text-zion-purple/80">{Copy.offlineHint[t]}</p>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-zion-purple to-zion-cyan flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Brain className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-zion-purple/15 border border-zion-purple/25 text-gray-200'
                      : 'bg-white/5 border border-white/10 text-gray-300'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-zion-purple/20 border border-zion-purple/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-zion-purple" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-zion-purple to-zion-cyan flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <Loader2 className="w-3 h-3 text-zion-cyan animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="px-3 py-2.5 border-t border-white/10 bg-black/40"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={Copy.typeMessage[t]}
                disabled={loading}
                maxLength={2000}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-zion-cyan/50 disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg bg-gradient-to-r from-zion-purple to-zion-cyan flex items-center justify-center disabled:opacity-30 hover:shadow-lg hover:shadow-zion-purple/30 transition-all"
              >
                <Send className="w-3 h-3 text-white" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
