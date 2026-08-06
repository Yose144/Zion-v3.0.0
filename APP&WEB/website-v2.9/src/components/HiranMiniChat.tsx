'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Brain, User, Loader2, Sparkles, MessageCircle } from 'lucide-react';

const HiranMiniChatCopy = {
  failedToConnectToAiPleaseTryAg: { cs: `Nepodařilo se spojit s AI. Zkuste to znovu.`, en: `Failed to connect to AI. Please try again.` },
  askAiAnythingAboutZion: { cs: `Zeptejte se AI na cokoliv o ZIONu`, en: `Ask AI anything about ZION` },
  zionAiNativeZionExpertModel: { cs: `ZION AI Native · zion-expert model`, en: `ZION AI Native · zion-expert model` },
  askHiranyagarbhaAnythingAboutZ: { cs: `Zeptejte se Hiranyagarbhy na cokoliv o ZIONu`, en: `Ask Hiranyagarbha anything about ZION` },
  typeAMessage: { cs: `Napište zprávu...`, en: `Type a message...` },
};

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
            HiranMiniChatCopy.failedToConnectToAiPleaseTryAg[lang === 'cs' ? 'cs' : 'en'],
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
        className="group flex items-center gap-3 w-full rounded-2xl border border-zion-purple/20 bg-gradient-to-br from-zion-purple/8 via-zion-cyan/4 to-transparent p-4 backdrop-blur-sm transition-all duration-300 hover:border-zion-purple/40 hover:shadow-[0_0_32px_rgba(228, 30, 43,0.12)]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zion-purple/25 bg-zion-purple/12 ring-1 ring-zion-purple/15 transition-transform duration-300 group-hover:scale-110">
          <Brain className="h-5 w-5 text-zion-purple" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-bold text-zion-purple tracking-wide">Hiran v2.2</span>
          <p className="text-[11px] text-gray-400 group-hover:text-gray-300 transition-colors">
            {HiranMiniChatCopy.askAiAnythingAboutZion[lang === 'cs' ? 'cs' : 'en']}
          </p>
        </div>
        <MessageCircle className="h-4 w-4 text-gray-500 transition-colors group-hover:text-zion-purple" />
      </button>
    );
  }

  return (
    <div className="bg-black/70 backdrop-blur-xl rounded-2xl border border-zion-purple/25 overflow-hidden flex flex-col" style={{ height: '320px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/40">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zion-purple to-zion-cyan flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">Hiranyagarbha v2.2</h3>
          <p className="text-gray-400 text-[10px]">
            {HiranMiniChatCopy.zionAiNativeZionExpertModel[lang === 'cs' ? 'cs' : 'en']}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-zion-cyan animate-pulse" />
          <span className="text-[10px] text-zion-cyan">Online</span>
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
              {HiranMiniChatCopy.askHiranyagarbhaAnythingAboutZ[lang === 'cs' ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(lang === 'cs' ? q.cs : q.en)}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-zion-cyan/30 text-zion-cyan hover:bg-zion-cyan/10 transition-colors"
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
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-white/10 bg-black/40">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={HiranMiniChatCopy.typeAMessage[lang === 'cs' ? 'cs' : 'en']}
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
  );
}
