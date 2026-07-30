'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const WarpIntro = dynamic(() => import('./WarpIntro'), { ssr: false });
const OasisScene = dynamic(() => import('./OasisScene'), { ssr: false });
const OasisHud = dynamic(() => import('./OasisHud'), { ssr: false });

export default function OasisClient() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'intro' | 'arrival' | 'scene'>('intro');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-oasis-cyan border-t-transparent mx-auto" />
          <p className="text-sm">Loading OASIS universe…</p>
        </div>
      </div>
    );
  }

  const handleEnter = () => {
    setPhase('arrival');
  };

  return (
    <>
      <div className="relative h-full w-full">
        <OasisScene started={phase !== 'intro'} />
        {phase !== 'intro' && <OasisHud />}

        <AnimatePresence>
          {phase !== 'intro' && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 3.5 }}
              className="pointer-events-auto absolute top-6 left-6 z-10 max-w-sm"
            >
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple">
                ZION OASIS
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Klikni na svět pro detail. Tahni myší, scrolluj pro zoom.
              </p>
              <Link href="/dashboard">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-oasis-gold via-oasis-purple to-oasis-cyan px-6 py-2.5 text-sm font-bold text-white shadow-lg"
                >
                  Enter the Game
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === 'intro' && <WarpIntro onEnter={handleEnter} />}
      </AnimatePresence>
    </>
  );
}
