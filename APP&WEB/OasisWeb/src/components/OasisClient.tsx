'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { World, WorldCategory } from '../domain/types/world';

const WarpIntro = dynamic(() => import('./WarpIntro'), { ssr: false });
const OasisScene = dynamic(() => import('./OasisScene'), { ssr: false });
const OasisHud = dynamic(() => import('./OasisHud'), { ssr: false });
const WorldPanel = dynamic(() => import('./WorldPanel'), { ssr: false });
const WorldFilter = dynamic(() => import('./WorldFilter'), { ssr: false });

const ALL_CATEGORIES: WorldCategory[] = ['star-system', 'planet', 'sector', 'world', 'dimension'];

export default function OasisClient() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'intro' | 'arrival' | 'scene'>('intro');
  const [activeCategories, setActiveCategories] = useState<WorldCategory[]>(ALL_CATEGORIES);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [view, setView] = useState<'galaxy' | 'world'>('galaxy');

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

  const handleArrived = () => {
    setPhase('scene');
  };

  const handleWorldSelect = (world: World) => {
    setSelectedWorld(world);
    setView('galaxy');
  };

  const handleCloseWorld = () => {
    setSelectedWorld(null);
    setView('galaxy');
  };

  const handleEnterWorld = () => {
    if (selectedWorld) setView('world');
  };

  return (
    <>
      <div className="relative h-full w-full">
        <OasisScene
          started={phase !== 'intro'}
          onArrived={handleArrived}
          activeCategories={activeCategories}
          selectedWorld={selectedWorld}
          onWorldSelect={handleWorldSelect}
          view={view}
        />
        {phase !== 'intro' && view === 'galaxy' && <OasisHud />}

        <AnimatePresence>
          {phase !== 'intro' && view === 'galaxy' && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 1.2, delay: 3.5 }}
              className="pointer-events-auto absolute top-6 left-6 z-10 max-w-sm"
            >
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple">
                ZION OASIS
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                55 worlds, one galaxy. Click any node to focus. Filter by category below.
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
              <p className="mt-3 text-xs text-gray-500">
                Play as a pilgrim, claim territories, join a guild, and decode 108 sacred clues.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== 'intro' && view === 'galaxy' && (
            <WorldFilter active={activeCategories} onChange={setActiveCategories} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedWorld && view === 'galaxy' && (
            <WorldPanel
              world={selectedWorld}
              onClose={handleCloseWorld}
              onEnter={handleEnterWorld}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {view === 'world' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="pointer-events-auto absolute bottom-8 left-1/2 z-30 -translate-x-1/2"
            >
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCloseWorld}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/80 px-8 py-4 text-sm font-bold text-white shadow-2xl backdrop-blur-md transition hover:bg-white/10"
              >
                Return to Galaxy
                <ChevronRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
              </motion.div>
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
