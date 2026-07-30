'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { chapters } from '@/lib/onboarding';
import GlassPanel from '@/components/GlassPanel';

export default function OnboardingPanel() {
  const [idx, setIdx] = useState(0);
  const chapter = chapters[idx];
  const progress = ((idx + 1) / chapters.length) * 100;

  return (
    <GlassPanel className="max-h-[80vh] overflow-y-auto">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple"
      >
        Sůl této země — Kniha brány
      </motion.h1>

      <div className="mb-6 rounded-3xl border border-white/10 bg-black/30 p-1">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-oasis-cyan via-oasis-purple to-oasis-gold transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-gray-400">
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-oasis-cyan" />
          Kapitola {idx + 1} z {chapters.length}
        </span>
        <span>{Math.round(progress)} %</span>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="mb-4 text-xl font-bold text-oasis-cyan">{chapter.title}</h2>

            {chapter.quote && (
              <blockquote className="mb-4 border-l-4 border-oasis-gold/50 pl-4 italic text-oasis-gold">
                {chapter.quote}
              </blockquote>
            )}

            <div className="space-y-4 text-sm leading-relaxed text-gray-300">
              {chapter.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-gray-400 transition-colors hover:text-white disabled:opacity-30"
        >
          Zpět
        </button>

        {idx < chapters.length - 1 ? (
          <button
            onClick={() => setIdx((i) => Math.min(chapters.length - 1, i + 1))}
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-oasis-gold via-oasis-purple to-oasis-cyan px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            Pokračovat
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        ) : (
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-oasis-cyan to-oasis-purple px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            Vstoupit do Oasis
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
    </GlassPanel>
  );
}
