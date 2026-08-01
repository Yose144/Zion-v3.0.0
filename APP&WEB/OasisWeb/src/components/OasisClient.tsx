'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import WarpFlash from './WarpFlash';
import { ChevronRight, Plane } from 'lucide-react';
import { useAudio, AudioToggle } from './AudioEngine';
import type { FlightControlsHandle } from './FlightControls';
import type { MobileInput } from './MobileControls';
import MobileControls from './MobileControls';
import PlayerHud from './PlayerHud';
import OnboardingHint from './OnboardingHint';
import MusicPlayer from './MusicPlayer';
import Compass from './Compass';
import type { CompassData } from './Compass';
import ShipHud from './ShipHud';
import { useGameStore } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';
import { getQuests, getAvatars, getTerritories, awardPlayerXp } from '../lib/api';
import type { World, WorldCategory } from '../domain/types/world';

const WarpIntro = dynamic(() => import('./WarpIntro'), { ssr: false });
const OasisScene = dynamic(() => import('./OasisScene'), { ssr: false });
const OasisHud = dynamic(() => import('./OasisHud'), { ssr: false });
const WorldPanel = dynamic(() => import('./WorldPanel'), { ssr: false });
const WorldFilter = dynamic(() => import('./WorldFilter'), { ssr: false });

const ALL_CATEGORIES: WorldCategory[] = ['star-system', 'planet', 'sector', 'world', 'dimension'];
const MAX_FLIGHT_SPEED = 8;

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
  const [throttle, setThrottle] = useState(0.5);
  const [landTarget, setLandTarget] = useState<World | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const flightControlsRef = useRef<FlightControlsHandle | null>(null);
  const mobileInputRef = useRef<MobileInput | null>(null);
  const compassRef = useRef<CompassData | null>(null);
  const { muted, toggle, start, playWarp, playBoost, playScanComplete, playApproach, startEngine, stopEngine, setEngine, music } = useAudio();
  const { discoverWorld, scanWorld, addXp, setRealQuests, setAvatars, setTerritories, setAddress, address, shipLoadout, syncPlayer, scannedWorlds, discoveredWorlds } = useGameStore();
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
      await syncPlayer();
    }
    load();
    return () => {
      mounted = false;
    };
  }, [address, setRealQuests, setAvatars, setTerritories, syncPlayer]);

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

  const flightBaseSpeed = MAX_FLIGHT_SPEED * throttle;
  const flightMaxSpeed = useMemo(() => {
    return MAX_FLIGHT_SPEED * (1.25 + shipLoadout.boost * 0.07);
  }, [shipLoadout.boost]);

  const compassTarget = useMemo(() => {
    if (flightMode && landTarget) {
      return {
        pos: landTarget.galaxyPosition ?? { x: 0, y: 0, z: 0 },
        name: landTarget.name,
        color: CATEGORY_COLORS[landTarget.category],
      };
    }
    if (selectedWorld) {
      if (view === 'world') {
        return { pos: { x: 0, y: 0, z: 0 }, name: selectedWorld.name, color: CATEGORY_COLORS[selectedWorld.category] };
      }
      return {
        pos: selectedWorld.galaxyPosition ?? { x: 0, y: 0, z: 0 },
        name: selectedWorld.name,
        color: CATEGORY_COLORS[selectedWorld.category],
      };
    }
    return { pos: { x: 0, y: 0, z: 0 }, name: 'Galactic Core', color: '#a855f7' };
  }, [flightMode, landTarget, selectedWorld, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'intro') return;
      if (e.key.toLowerCase() === 'f' && !flightMode && view === 'galaxy') {
        setFlightMode(true);
        return;
      }
      if (flightMode) {
        if (e.key === '1') {
          setThrottle(0);
        } else if (e.key === '2') {
          setThrottle(0.5);
        } else if (e.key === '3') {
          setThrottle(1);
        }
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

  const handleEnterWorld = async () => {
    if (selectedWorld) {
      playWarp();
      playScanComplete();
      setWarping(true);
      setView('world');
      const xp = 75 + shipLoadout.scanner * 25;
      const firstScan = !scannedWorlds.includes(selectedWorld.id);
      scanWorld(selectedWorld.id);
      addXp(xp);
      addToast(`Entering ${selectedWorld.name}: +${xp} XP`, 'info', 3000);
      if (address && firstScan) {
        const shares = Math.min(100, Math.max(1, Math.round(xp / 10)));
        await awardPlayerXp(address, shares, 'scan', { world: selectedWorld.name });
        await syncPlayer();
      }
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

  const handleApproachWorld = async (world: World) => {
    playApproach();
    playWarp();
    setFlightMode(false);
    setLandTarget(null);
    setSelectedWorld(world);
    setView('galaxy');
    const firstDiscovery = !discoveredWorlds.includes(world.id);
    discoverWorld(world.id);
    addToast(`Approaching ${world.name}`, 'info', 3000);
    addXp(25);
    if (address && firstDiscovery) {
      await awardPlayerXp(address, 3, 'exploration', { world: world.name });
      await syncPlayer();
    }
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
          baseSpeed={flightBaseSpeed}
          mobileInputRef={isMobile ? mobileInputRef : undefined}
          isMobile={isMobile}
          compassRef={compassRef}
        />
        {phase !== 'intro' && <PlayerHud />}
        {phase !== 'intro' && view === 'galaxy' && !flightMode && <OasisHud />}
        {phase !== 'intro' && view === 'galaxy' && !flightMode && <OnboardingHint />}

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
              className="pointer-events-auto absolute bottom-4 left-4 z-30 flex flex-col items-start gap-2 sm:flex-row sm:items-end"
            >
              <MusicPlayer music={music} />
              <AudioToggle muted={muted} onToggle={toggle} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== 'intro' && !flightMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 4.2, duration: 0.6 }}
              className="pointer-events-auto absolute bottom-4 right-4 z-30"
            >
              <Compass
                target={compassTarget.pos}
                targetName={compassTarget.name}
                targetColor={compassTarget.color}
                compassRef={compassRef}
              />
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
            <ShipHud
              compassRef={compassRef}
              target={compassTarget.pos}
              targetName={compassTarget.name}
              targetColor={compassTarget.color}
              flightSpeed={flightSpeed}
              maxSpeed={flightMaxSpeed}
              throttle={throttle}
              onThrottleChange={setThrottle}
              landTarget={landTarget}
              onApproach={handleApproachWorld}
              onExit={handleExitFlight}
            />
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
