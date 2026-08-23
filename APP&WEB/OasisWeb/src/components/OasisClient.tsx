'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import WarpFlash from './WarpFlash';
import { useAudio } from './AudioEngine';
import MainMenu from './MainMenu';
import type { FlightControlsHandle } from './FlightControls';
import type { MobileInput } from './MobileControls';
import MobileControls from './MobileControls';
import OnboardingHint from './OnboardingHint';
import FruitCounter from './FruitCounter';
import { PilgrimRite } from './PilgrimRite';
import ControlHud from './ControlHud';
import type { CompassData } from './Compass';
import { useGameStore } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';
import { getQuests, getAvatars, getTerritories, getWorlds, scanWorld as apiScanWorld, approachWorld as apiApproachWorld } from '../lib/api';
import type { World, WorldCategory, WorldLayer } from '../domain/types/world';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORY_COLORS } from '../lib/categoryColors';

const BabylonIntro = dynamic(() => import('./BabylonIntro'), { ssr: false });
const WarpIntro = dynamic(() => import('./WarpIntro'), { ssr: false });
const OasisScene = dynamic(() => import('./OasisScene'), { ssr: false });
import WorldPanel from './WorldPanel';

const ALL_CATEGORIES: WorldCategory[] = ['star-system', 'planet', 'sector', 'world', 'dimension'];
const ALL_LAYERS: WorldLayer[] = [1, 2, 3, 4, 5];
const MAX_FLIGHT_SPEED = 18;

export default function OasisClient() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'intro' | 'stargate' | 'arrival' | 'rite' | 'scene'>('intro');
  const [activeCategories, setActiveCategories] = useState<WorldCategory[]>(ALL_CATEGORIES);
  const [activeLayers, setActiveLayers] = useState<WorldLayer[]>(ALL_LAYERS);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [view, setView] = useState<'galaxy' | 'world'>('galaxy');
  const [warping, setWarping] = useState(false);
  const [flightMode, setFlightMode] = useState(false);
  const [flightSpeed, setFlightSpeed] = useState(0);
  const [throttle, setThrottle] = useState(0.5);
  const [landTarget, setLandTarget] = useState<World | null>(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isNarrow = window.innerWidth < 768;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    return isNarrow || (hasTouch && coarsePointer && window.innerWidth < 1024);
  });
  const [uiHidden, setUiHidden] = useState(false);
  const [panelsMinimized, setPanelsMinimized] = useState(false);
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flightControlsRef = useRef<FlightControlsHandle | null>(null);
  const mobileInputRef = useRef<MobileInput | null>(null);
  const compassRef = useRef<CompassData | null>(null);
  const { muted, toggle, start, playWarp, playBoost, playScanComplete, playApproach, startEngine, stopEngine, setEngine, music } = useAudio();
  // Granular zustand selectors — prevents full re-render on every state change
  const discoverWorld = useGameStore(s => s.discoverWorld);
  const scanWorld = useGameStore(s => s.scanWorld);
  const addXp = useGameStore(s => s.addXp);
  const setRealQuests = useGameStore(s => s.setRealQuests);
  const setAvatars = useGameStore(s => s.setAvatars);
  const setTerritories = useGameStore(s => s.setTerritories);
  const setAddress = useGameStore(s => s.setAddress);
  const setWorlds = useGameStore(s => s.setWorlds);
  const worlds = useGameStore(s => s.worlds);
  const address = useGameStore(s => s.address);
  const shipLoadout = useGameStore(s => s.shipLoadout);
  const syncPlayer = useGameStore(s => s.syncPlayer);
  const scannedWorlds = useGameStore(s => s.scannedWorlds);
  const discoveredWorlds = useGameStore(s => s.discoveredWorlds);
  const addToast = useToastStore((s) => s.add);
  const { user, authenticated } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) {
      // Prefer the authenticated ZION address, fall back to a generic pilgrim.
      setAddress(authenticated && user?.address ? user.address : 'pilgrim-0001');
    }
  }, [address, setAddress, authenticated, user]);

  useEffect(() => {
    let mounted = true;
    async function loadWorlds() {
      try {
        const apiWorlds = await getWorlds();
        if (mounted && apiWorlds && apiWorlds.length > 0) {
          setWorlds(apiWorlds);
        }
      } catch (e) {
        console.warn('[OasisClient] failed to load worlds from API:', e);
      }
    }
    loadWorlds();
    return () => {
      mounted = false;
    };
  }, [setWorlds]);

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
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isNarrow = window.innerWidth < 768;
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const mobile = isNarrow || (hasTouch && coarsePointer && window.innerWidth < 1024);
      setIsMobile(mobile);
      if (mobile && !mobileInputRef.current) {
        mobileInputRef.current = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, up: false, down: false, boost: false };
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-hide panels when user interacts with 3D scene (scroll/drag/touch)
  // Panels return after 2.5s of inactivity. Doesn't affect flight mode, intro, or stargate.
  useEffect(() => {
    if (phase === 'intro' || phase === 'stargate' || flightMode) return;
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const triggerHide = () => {
      setPanelsMinimized(true);
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
      autoHideTimer.current = setTimeout(() => setPanelsMinimized(false), 2500);
    };

    const events = ['wheel', 'pointerdown', 'touchstart'] as const;
    events.forEach((evt) => canvas.addEventListener(evt, triggerHide, { passive: true }));
    return () => {
      events.forEach((evt) => canvas.removeEventListener(evt, triggerHide));
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, [phase, flightMode]);

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
    return { pos: { x: 0, y: 0, z: 0 }, name: 'Galactic Core', color: '#06b6d4' };
  }, [flightMode, landTarget, selectedWorld, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'intro' || phase === 'stargate') return;
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
      <div className="flex h-full w-full items-center justify-center text-white/60">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-oasis-cyan border-t-transparent mx-auto" />
          <p className="text-sm">Loading OASIS universe…</p>
        </div>
      </div>
    );
  }

  const handleEnter = () => {
    // WarpIntro done → go to Babylon stargate
    setPhase('stargate');
  };

  const handleStargateEnter = () => {
    // Babylon stargate done → warp to arrival
    start();
    playWarp();
    setPhase('arrival');
  };

  const handleArrived = () => {
    // On mobile, skip PilgrimRite (avatar config) — go straight to scene for preview.
    setPhase(isMobile ? 'scene' : 'rite');
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
      if (address) {
        await apiScanWorld(address, selectedWorld.id, xp);
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
    const xp = 25;
    addXp(xp);
    if (address) {
      await apiApproachWorld(address, world.id, xp);
      await syncPlayer();
    }
  };

  return (
    <>
      <div className="fixed inset-0 overflow-hidden bg-oasis-black">
        <OasisScene
          started={phase !== 'intro'}
          onArrived={handleArrived}
          activeCategories={activeCategories}
          activeLayers={activeLayers}
          selectedWorld={selectedWorld}
          worlds={worlds}
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
        {phase !== 'intro' && (
          <MainMenu
            activeCategories={activeCategories}
            onCategoriesChange={setActiveCategories}
            activeLayers={activeLayers}
            onLayersChange={setActiveLayers}
            selectedWorld={selectedWorld}
            onWorldSelect={handleWorldSelect}
            music={music}
            muted={muted}
            onToggleMute={toggle}
            onEnterFlight={() => {
              if (!flightMode && view === 'galaxy') {
                setFlightMode(true);
                setTimeout(() => flightControlsRef.current?.lock(), 0);
              }
            }}
            uiHidden={uiHidden}
            onToggleUiHidden={() => setUiHidden((h) => !h)}
            onCloseWorld={handleCloseWorld}
            isMobile={isMobile}
          />
        )}
        {phase === 'scene' && view === 'galaxy' && !flightMode && !uiHidden && !isMobile && !panelsMinimized && <OnboardingHint />}
        {phase !== 'intro' && view === 'galaxy' && !flightMode && !uiHidden && !isMobile && !panelsMinimized && <FruitCounter />}

        <AnimatePresence>
          {selectedWorld && view === 'galaxy' && !flightMode && !uiHidden && !panelsMinimized && (
            <WorldPanel
              world={selectedWorld}
              onClose={handleCloseWorld}
              onEnter={handleEnterWorld}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase !== 'intro' && !flightMode && view === 'galaxy' && !uiHidden && !panelsMinimized && (
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
              className="pointer-events-auto absolute bottom-6 left-1/2 z-30 -translate-x-1/2 sm:bottom-8"
            >
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCloseWorld}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/80 px-4 py-2.5 text-xs font-bold text-white shadow-2xl backdrop-blur-md transition hover:bg-white/10 sm:px-8 sm:py-4 sm:text-sm"
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

      <AnimatePresence mode="wait">
        {phase === 'intro' && <WarpIntro onEnter={handleEnter} />}
        {phase === 'stargate' && <BabylonIntro onEnter={handleStargateEnter} />}
      </AnimatePresence>

      <WarpFlash active={warping} worldName={selectedWorld?.name} />

      <AnimatePresence>
        {phase === 'rite' && (
          <PilgrimRite onEnter={handleRiteEnter} />
        )}
      </AnimatePresence>
    </>
  );
}
