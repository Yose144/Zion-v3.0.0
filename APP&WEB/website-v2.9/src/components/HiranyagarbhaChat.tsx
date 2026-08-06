'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Brain, User, Loader2, Sparkles } from 'lucide-react';

const HiranyagarbhaChatCopy = {
  failedToConnectToAiPleaseTryAg: { cs: `Nepodařilo se spojit s AI. Zkuste to znovu.`, en: `Failed to connect to AI. Please try again.` },
  zionAiNativeZionExpertModel: { cs: `ZION AI Native · zion-expert model`, en: `ZION AI Native · zion-expert model` },
  askHiranyagarbhaAnythingAboutZ: { cs: `Zeptejte se Hiranyagarbhy na cokoliv o ZIONu`, en: `Ask Hiranyagarbha anything about ZION` },
  typeAMessage: { cs: `Napište zprávu...`, en: `Type a message...` },
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTED_QUESTIONS = [
  { cs: 'Co je ZION blockchain?', en: 'What is ZION blockchain?' },
  { cs: 'Jak funguje těžba?', en: 'How does mining work?' },
  { cs: 'Co je AI Native?', en: 'What is AI Native?' },
  { cs: 'Jak spustit vlastní nód?', en: 'How to run a node?' },
];

export default function HiranyagarbhaChat({ lang = 'cs' }: { lang?: 'cs' | 'en' }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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
            HiranyagarbhaChatCopy.failedToConnectToAiPleaseTryAg[lang === 'cs' ? 'cs' : 'en'],
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

  return (
    <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-zion-cyan/30 overflow-hidden flex flex-col" style={{ height: '520px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-black/40">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zion-purple to-zion-cyan flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">Hiranyagarbha</h3>
          <p className="text-gray-400 text-xs">
            {HiranyagarbhaChatCopy.zionAiNativeZionExpertModel[lang === 'cs' ? 'cs' : 'en']}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-zion-cyan animate-pulse" />
          <span className="text-xs text-zion-cyan">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-10 h-10 text-zion-gold mx-auto mb-4 opacity-60" />
            <p className="text-gray-400 text-sm mb-6">
              {HiranyagarbhaChatCopy.askHiranyagarbhaAnythingAboutZ[lang === 'cs' ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(lang === 'cs' ? q.cs : q.en)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zion-cyan/30 text-zion-cyan hover:bg-zion-cyan/10 transition-colors"
                >
                  {lang === 'cs' ? q.cs : q.en}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zion-purple to-zion-cyan flex items-center justify-center flex-shrink-0 mt-1">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-zion-purple/20 border border-zion-purple/30 text-gray-200'
                  : 'bg-white/5 border border-white/10 text-gray-300'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-zion-purple/30 border border-zion-purple/40 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-3.5 h-3.5 text-zion-purple" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zion-purple to-zion-cyan flex items-center justify-center flex-shrink-0 mt-1">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-zion-cyan animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/10 bg-black/40">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={HiranyagarbhaChatCopy.typeAMessage[lang === 'cs' ? 'cs' : 'en']}
            disabled={loading}
            maxLength={2000}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-zion-cyan/50 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-zion-purple to-zion-cyan flex items-center justify-center disabled:opacity-30 hover:shadow-lg hover:shadow-zion-purple/30 transition-all"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}
