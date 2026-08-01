'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import WarpFlash from './WarpFlash';
import { ChevronRight, Plane, X } from 'lucide-react';
import { useAudio, AudioToggle } from './AudioEngine';
import type { FlightControlsHandle } from './FlightControls';
import type { MobileInput } from './MobileControls';
import MobileControls from './MobileControls';
import PlayerHud from './PlayerHud';
import { useGameStore } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';
import { getQuests, getAvatars, getTerritories } from '../lib/api';
import type { World, WorldCategory } from '../domain/types/world';

const WarpIntro = dynamic(() => import('./WarpIntro'), { ssr: false });
const OasisScene = dynamic(() => import('./OasisScene'), { ssr: false });
const OasisHud = dynamic(() => import('./OasisHud'), { ssr: false });
const WorldPanel = dynamic(() => import('./WorldPanel'), { ssr: false });
const WorldFilter = dynamic(() => import('./WorldFilter'), { ssr: false });

const ALL_CATEGORIES: WorldCategory[] = ['star-system', 'planet', 'sector', 'world', 'dimension'];

const CATEGORY_COLORS: Record<WorldCategory, string> = {
  'star-system': '#f59e0b',
  'planet': '#22d3ee',
  'sector': '#a855f7',
  'world': '#10b981',
  'dimension': '#ec4899',
};

export default function OasisClient() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'intro' | 'arrival' | 'scene'>('intro');
  const [activeCategories, setActiveCategories] = useState<WorldCategory[]>(ALL_CATEGORIES);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [view, setView] = useState<'galaxy' | 'world'>('galaxy');
  const [warping, setWarping] = useState(false);
  const [flightMode, setFlightMode] = useState(false);
  const [flightSpeed, setFlightSpeed] = useState(0);
  const [landTarget, setLandTarget] = useState<World | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const flightControlsRef = useRef<FlightControlsHandle | null>(null);
  const mobileInputRef = useRef<MobileInput | null>(null);
  const { muted, toggle, start, playWarp, playBoost, playScanComplete, playApproach, startEngine, stopEngine, setEngine } = useAudio();
  const { discoverWorld, scanWorld, addXp, setRealQuests, setAvatars, setTerritories, setAddress, address, shipLoadout } = useGameStore();
  const addToast = useToastStore((s) => s.add);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) setAddress('pilgrim-0001');
  }, [address, setAddress]);

  useEffect(() => {
    if (!address) return;
    let mounted = true;
    async function load() {
      const [quests, avatars, territories] = await Promise.all([
        getQuests(),
        getAvatars(),
        getTerritories().then((map) => (map ? Object.values(map.territories) : null)),
      ]);
      if (!mounted) return;
      if (quests) setRealQuests(quests);
      if (avatars) setAvatars(avatars);
      if (territories) setTerritories(territories);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [address, setRealQuests, setAvatars, setTerritories]);

  useEffect(() => {
    const check = () => {
      const mobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
      setIsMobile(mobile);
      if (mobile && !mobileInputRef.current) {
        mobileInputRef.current = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, up: false, down: false, boost: false };
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (flightMode) {
      startEngine();
    } else {
      stopEngine();
    }
  }, [flightMode, startEngine, stopEngine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'intro') return;
      if (e.key.toLowerCase() === 'f' && !flightMode && view === 'galaxy') {
        setFlightMode(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, flightMode, view]);

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
    start();
    playWarp();
    setPhase('arrival');
  };

  const handleArrived = () => {
    setPhase('scene');
  };

  const handleWorldSelect = (world: World) => {
    if (flightMode) setFlightMode(false);
    setSelectedWorld(world);
    setView('galaxy');
    discoverWorld(world.id);
  };

  const handleCloseWorld = () => {
    setSelectedWorld(null);
    setView('galaxy');
    setWarping(false);
  };

  const handleEnterWorld = () => {
    if (selectedWorld) {
      playWarp();
      playScanComplete();
      setWarping(true);
      setView('world');
      scanWorld(selectedWorld.id);
      addXp(75 + shipLoadout.scanner * 25);
      addToast(`Entering ${selectedWorld.name}: +${75 + shipLoadout.scanner * 25} XP`, 'info', 3000);
      setTimeout(() => setWarping(false), 1500);
    }
  };

  const handleExitFlight = () => {
    setFlightMode(false);
    setLandTarget(null);
  };

  const handleFlightSpeedChange = (speed: number) => {
    setFlightSpeed(speed);
    setEngine(speed);
  };

  const handleCanLand = (world: World | null) => {
    setLandTarget(world);
  };

  const handleApproachWorld = (world: World) => {
    playApproach();
    playWarp();
    setFlightMode(false);
    setLandTarget(null);
    setSelectedWorld(world);
    setView('galaxy');
    discoverWorld(world.id);
    addToast(`Approaching ${world.name}`, 'info', 3000);
    addXp(25);
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
          flightMode={flightMode}
          onExitFlight={handleExitFlight}
          flightControlsRef={flightControlsRef}
          onFlightSpeedChange={handleFlightSpeedChange}
          flightSpeed={flightSpeed}
          onCanLand={handleCanLand}
          onApproach={handleApproachWorld}
          onBoost={playBoost}
          mobileInputRef={isMobile ? mobileInputRef : undefined}
          isMobile={isMobile}
        />
        {phase !== 'intro' && <PlayerHud />}
        {phase !== 'intro' && view === 'galaxy' && !flightMode && <OasisHud />}

        <AnimatePresence>
          {phase !== 'intro' && view === 'galaxy' && !flightMode && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 1.2, delay: 3.5 }}
              className="pointer-events-auto absolute left-4 right-4 top-4 z-10 max-w-full sm:left-6 sm:right-auto sm:top-6 sm:max-w-sm"
            >
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple sm:text-3xl">
                ZION OASIS
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                55 worlds across one living galaxy. Click any world to focus, or press <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px]">F</kbd> for free flight.
              </p>
              {selectedWorld && (
                <p className="mt-2 text-xs font-medium" style={{ color: CATEGORY_COLORS[selectedWorld.category] }}>
                  Selected: {selectedWorld.name}
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href="/dashboard">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-oasis-gold via-oasis-purple to-oasis-cyan px-6 py-2.5 text-sm font-bold text-white shadow-lg"
                  >
                    Enter the Game
                    <ChevronRight className="h-4 w-4" />
                  </motion.div>
                </Link>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setFlightMode(true);
                    setTimeout(() => flightControlsRef.current?.lock(), 0);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-oasis-cyan/30 bg-oasis-cyan/10 px-4 py-2.5 text-sm font-bold text-oasis-cyan shadow-lg backdrop-blur-sm transition hover:bg-oasis-cyan/20"
                >
                  <Plane className="h-4 w-4" />
                  Flight Mode
                </motion.button>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Play as a pilgrim, claim territories, join a guild, and decode 108 sacred clues.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== 'intro' && view === 'galaxy' && !flightMode && (
            <WorldFilter active={activeCategories} onChange={setActiveCategories} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedWorld && view === 'galaxy' && !flightMode && (
            <WorldPanel
              world={selectedWorld}
              onClose={handleCloseWorld}
              onEnter={handleEnterWorld}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== 'intro' && !flightMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 4, duration: 0.6 }}
              className="pointer-events-auto absolute bottom-4 left-4 z-30"
            >
              <AudioToggle muted={muted} onToggle={toggle} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {view === 'world' && !flightMode && (
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
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/80 px-6 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-md transition hover:bg-white/10 sm:px-8 sm:py-4"
              >
                Return to Galaxy
                <ChevronRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {flightMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed inset-0 z-40"
            >
              {/* Crosshair */}
              <div className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
                <div className="h-4 w-4 rounded-full border border-white/40" />
                <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
              </div>

              {/* Flight HUD */}
              <div className="pointer-events-auto absolute right-5 top-5 z-50 flex flex-col items-end gap-2">
                <div className="rounded-xl border border-oasis-cyan/30 bg-black/70 p-3 text-right shadow-xl backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-wider text-oasis-cyan">Flight Mode</p>
                  <p className="mt-1 text-2xl font-bold text-white tabular-nums">{flightSpeed.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">units / s</p>
                  <div className="my-2 h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-oasis-cyan to-oasis-purple transition-all"
                      style={{ width: `${Math.min(100, (flightSpeed / 12) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-300">WASD / Arrows — move</p>
                  <p className="text-xs text-gray-300">Q / E — up / down</p>
                  <p className="text-xs text-gray-300">Space — boost</p>
                  <p className="text-xs text-gray-300">Shift — slow</p>
                  <p className="text-xs text-gray-300">Mouse — look</p>
                  <p className="text-xs text-gray-300">ESC or F — exit</p>
                </div>

                {landTarget && (
                  <button
                    onClick={() => handleApproachWorld(landTarget)}
                    className="rounded-xl border border-oasis-gold/30 bg-oasis-gold/10 px-4 py-2 text-right shadow-lg backdrop-blur-md transition hover:bg-oasis-gold/20"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-oasis-gold">Approach</p>
                    <p className="text-sm font-bold text-white">{landTarget.name}</p>
                    <p className="text-[10px] text-gray-400">Press L or click</p>
                  </button>
                )}

                <button
                  onClick={handleExitFlight}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/10"
                >
                  <X className="h-3 w-3" />
                  Exit Flight
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {flightMode && isMobile && <MobileControls inputRef={mobileInputRef} onExit={handleExitFlight} />}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === 'intro' && <WarpIntro onEnter={handleEnter} />}
      </AnimatePresence>

      <WarpFlash active={warping} />
    </>
  );
}
