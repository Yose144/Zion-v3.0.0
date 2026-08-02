'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import WarpFlash from './WarpFlash';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useAudio } from './AudioEngine';
import type { FlightControlsHandle } from './FlightControls';
import type { MobileInput } from './MobileControls';
import MobileControls from './MobileControls';
import GamePanel from './GamePanel';
import OnboardingHint from './OnboardingHint';
import { PilgrimRite } from './PilgrimRite';
import ControlHud from './ControlHud';
import type { CompassData } from './Compass';
import { useGameStore } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';
import { getQuests, getAvatars, getTerritories, awardPlayerXp } from '../lib/api';
import type { World, WorldCategory, WorldLayer } from '../domain/types/world';

const WarpIntro = dynamic(() => import('./WarpIntro'), { ssr: false });
const OasisScene = dynamic(() => import('./OasisScene'), { ssr: false });
import WorldPanel from './WorldPanel';
import WorldFilter from './WorldFilter';

const ALL_CATEGORIES: WorldCategory[] = ['star-system', 'planet', 'sector', 'world', 'dimension'];
const ALL_LAYERS: WorldLayer[] = [1, 2, 3, 4, 5];
const MAX_FLIGHT_SPEED = 18;

const CATEGORY_COLORS: Record<WorldCategory, string> = {
  'star-system': '#f59e0b',
  'planet': '#22d3ee',
  'sector': '#a855f7',
  'world': '#10b981',
  'dimension': '#ec4899',
};

export default function OasisClient() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'intro' | 'arrival' | 'rite' | 'scene'>('intro');
  const [activeCategories, setActiveCategories] = useState<WorldCategory[]>(ALL_CATEGORIES);
  const [activeLayers, setActiveLayers] = useState<WorldLayer[]>(ALL_LAYERS);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [view, setView] = useState<'galaxy' | 'world'>('galaxy');
  const [warping, setWarping] = useState(false);
  const [flightMode, setFlightMode] = useState(false);
  const [flightSpeed, setFlightSpeed] = useState(0);
  const [throttle, setThrottle] = useState(0.5);
  const [landTarget, setLandTarget] = useState<World | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
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
      if (e.key.toLowerCase() === 'h') {
        setUiHidden((h) => !h);
        return;
      }
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
    setPhase('rite');
  };

  const handleRiteEnter = () => {
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
          activeLayers={activeLayers}
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
        {phase !== 'intro' && view === 'galaxy' && !flightMode && !uiHidden && (
          <GamePanel
            activeCategories={activeCategories}
            selectedWorldId={selectedWorld?.id}
            onWorldSelect={handleWorldSelect}
            music={music}
            muted={muted}
            onToggleMute={toggle}
            onEnterFlight={() => {
              setFlightMode(true);
              setTimeout(() => flightControlsRef.current?.lock(), 0);
            }}
          />
        )}
        {phase === 'scene' && view === 'galaxy' && !flightMode && !uiHidden && <OnboardingHint />}

        <AnimatePresence>
          {phase !== 'intro' && view === 'galaxy' && !flightMode && !uiHidden && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="pointer-events-auto absolute right-4 top-4 z-40 flex items-center gap-1.5 sm:right-6 sm:top-5"
            >
              <Link href="/dashboard">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-gradient-to-r from-oasis-gold via-oasis-purple to-oasis-cyan px-2.5 py-1 text-[9px] font-bold text-white shadow-lg"
                >
                  Enter the Game
                  <ChevronRight className="h-2.5 w-2.5" />
                </motion.div>
              </Link>
              <button
                onClick={() => setUiHidden(true)}
                className="zion-button-ghost !p-2"
                title="Hide all UI (H)"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show UI button when hidden */}
        <AnimatePresence>
          {phase !== 'intro' && uiHidden && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setUiHidden(false)}
              className="pointer-events-auto absolute right-4 top-4 z-50 rounded-full border border-white/15 bg-black/80 p-2.5 text-gray-300 backdrop-blur-md transition hover:bg-white/10 hover:text-white sm:right-6 sm:top-5"
              title="Show UI (H)"
            >
              <Eye className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== 'intro' && view === 'galaxy' && !flightMode && !uiHidden && (
            <WorldFilter
              active={activeCategories}
              onChange={setActiveCategories}
              activeLayers={activeLayers}
              onLayersChange={setActiveLayers}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedWorld && view === 'galaxy' && !flightMode && !uiHidden && (
            <WorldPanel
              world={selectedWorld}
              onClose={handleCloseWorld}
              onEnter={handleEnterWorld}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== 'intro' && !flightMode && view === 'galaxy' && !uiHidden && (
            <ControlHud
              compassRef={compassRef}
              target={compassTarget.pos}
              targetName={compassTarget.name}
              targetColor={compassTarget.color}
              flightMode={false}
              flightSpeed={0}
              maxSpeed={flightMaxSpeed}
              throttle={throttle}
              onThrottleChange={setThrottle}
              landTarget={null}
              onApproach={handleApproachWorld}
              onExitFlight={handleExitFlight}
              onEnterFlight={() => {
                setFlightMode(true);
                setTimeout(() => flightControlsRef.current?.lock(), 0);
              }}
              onWarp={handleEnterWorld}
              warping={warping}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {view === 'world' && !flightMode && !uiHidden && (
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
          {flightMode && !uiHidden && (
            <ControlHud
              compassRef={compassRef}
              target={compassTarget.pos}
              targetName={compassTarget.name}
              targetColor={compassTarget.color}
              flightMode={true}
              flightSpeed={flightSpeed}
              maxSpeed={flightMaxSpeed}
              throttle={throttle}
              onThrottleChange={setThrottle}
              landTarget={landTarget}
              onApproach={handleApproachWorld}
              onExitFlight={handleExitFlight}
              onWarp={() => {
                if (selectedWorld) handleEnterWorld();
              }}
              warping={warping}
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

      <AnimatePresence>
        {phase === 'rite' && (
          <PilgrimRite onEnter={handleRiteEnter} />
        )}
      </AnimatePresence>
    </>
  );
}
