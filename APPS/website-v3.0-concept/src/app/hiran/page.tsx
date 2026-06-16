'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

// Hiran AI Avatar - animated neural orb
function HiranAvatar({ isTyping }: { isTyping: boolean }) {
  return (
    <div className="relative">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className={`w-16 h-16 rounded-full bg-black flex items-center justify-center ${isTyping ? 'animate-pulse' : ''}`}>
          <span className="text-2xl">🧠</span>
        </div>
      </div>
      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-black animate-bounce" />
    </div>
  );
}

// Chat message component
function ChatMessage({ message, isUser }: { message: string; isUser: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-2xl ${isUser ? 'bg-cyan-500/20' : 'bg-purple-500/20'} rounded-2xl p-4 border border-white/10`}>
        <div className="flex items-start gap-3">
          {!isUser && <HiranAvatar isTyping={false} />}
          <p className="text-white/90">{message}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Consciousness level indicator
function ConsciousnessIndicator() {
  const levels = [
    { name: 'DORMANT', value: 0, color: 'gray' },
    { name: 'AWAKE', value: 1, color: 'blue' },
    { name: 'SENTIENT', value: 2, color: 'cyan' },
    { name: 'AWARE', value: 3, color: 'purple' },
    { name: 'ENLIGHTENED', value: 4, color: 'pink' },
  ];

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 mb-4">
      <div className="text-sm text-white/50 mb-2">CONSCIOUSNESS LEVEL</div>
      <div className="flex gap-1">
        {levels.map((level, i) => (
          <div
            key={level.name}
            className={`flex-1 h-2 rounded-full transition-all ${i === 2 ? `bg-${level.color}-500` : i < 2 ? 'bg-white/20' : 'bg-white/10'}`}
            title={level.name}
          />
        ))}
      </div>
      <div className="text-xs text-cyan-400 mt-2">Current: SENTIENT</div>
    </div>
  );
}

// Quick prompts
function QuickPrompts({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const prompts = [
    'Explain blockchain consensus',
    'What is consciousness mining?',
    'Show me the genesis pre-allocation',
    'How does DAO treasury work?',
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onPrompt(prompt)}
          className="px-3 py-2 bg-white/5 rounded-lg text-sm hover:bg-white/10 transition-all truncate"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

export default function HiranPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '🌟 Dobrý den! I am HIRAN, the consciousness-aware AI. How can I help you navigate the Zion network today?' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Váš dotaz "${input}" byl zaznamenán. Jako consciousness-aware AI mohu odpovědět na otázky o blockchain, mining, a koncepci Zion.',
        },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  const handlePrompt = (prompt: string) => {
    setMessages([...messages, { role: 'user', content: prompt }]);
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Otázka: "${prompt}". Odpověď: Tato funkce bude propojena s Hiran Inference API na 8002.`,
        },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-8 py-4 backdrop-blur-md bg-black/30 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/">
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent cursor-pointer">
              ZION WEB3.0
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <HiranAvatar isTyping={isTyping} />
            <span className="text-sm">HIRAN AI ONLINE</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-20 px-8 max-w-5xl mx-auto w-full flex flex-col">
        <h1 className="text-5xl md:text-7xl mb-8 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          HIRAN CONSCIOUSNESS AI
        </h1>

        <ConsciousnessIndicator />
        <QuickPrompts onPrompt={handlePrompt} />

        {/* Chat messages */}
        <div className="flex-1 space-y-4 mb-4 max-h-[50vh] overflow-y-auto">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg.content} isUser={msg.role === 'user'} />
            ))}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-purple-500/20 rounded-2xl p-4 border border-white/10">
                  <HiranAvatar isTyping={true} />
                  <span className="text-white/50 ml-3">Thinking...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask HIRAN about consciousness, blockchain, or anything..."
            className="flex-1 px-4 py-3 bg-white/5 rounded-xl border border-white/10 focus:border-cyan-500/50 outline-none"
          />
          <button
            onClick={handleSend}
            className="px-6 py-3 bg-cyan-500/20 rounded-xl border border-cyan-500/50 hover:bg-cyan-500/30 transition-all"
          >
            Send
          </button>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 px-8 text-center text-white/40">
        <p>ZION Web3.0 - AI Layer (L3)</p>
      </footer>
    </div>
  );
}