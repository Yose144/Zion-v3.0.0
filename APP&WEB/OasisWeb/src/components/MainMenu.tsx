'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Rocket, User, Music, Radio, Settings, Globe, Map as MapIcon,
  Compass, Volume2, VolumeX, Eye, EyeOff, Plane, LogIn,
} from 'lucide-react';
import { ShipTab, IdentityTab, AudioTab, OasisTab, type Tab } from './GamePanel';
import MiniMap from './MiniMap';
import type { World, WorldCategory, WorldLayer } from '../domain/types/world';
import type { MusicPlayerState } from './AudioEngine';
import { useGameStore, getLevel, getLevelProgress } from '../store/gameStore';
import { WORLDS } from '../domain/config/worlds';
import { CATEGORY_COLORS, CATEGORY_LABELS } from './WorldPanel';

const WORLD_CATEGORIES: WorldCategory[] = ['star-system', 'planet', 'sector', 'world', 'dimension'];
const LAYERS = [1, 2, 3, 4, 5] as const;

interface MainMenuProps {
  activeCategories: WorldCategory[];
  onCategoriesChange: (cats: WorldCategory[]) => void;
  activeLayers: WorldLayer[];
  onLayersChange: (layers: WorldLayer[]) => void;
  selectedWorld: World | null;
  onWorldSelect: (world: World) => void;
  music: MusicPlayerState;
  muted: boolean;
  onToggleMute: () => void;
  onEnterFlight: () => void;
  uiHidden: boolean;
  onToggleUiHidden: () => void;
  onCloseWorld: () => void;
  isMobile: boolean;
}

export default function MainMenu({
  activeCategories,
  onCategoriesChange,
  activeLayers,
  onLayersChange,
  selectedWorld,
  onWorldSelect,
  music,
  muted,
  onToggleMute,
  onEnterFlight,
  uiHidden,
  onToggleUiHidden,
  onCloseWorld,
  isMobile,
}: MainMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab | 'worlds'>('worlds');
  const { xp, credits, discoveredWorlds, scannedWorlds, collectedEggs, completedQuests, address, shipLoadout } = useGameStore();
  const level = getLevel(xp);
  const progress = getLevelProgress(xp);

  const onClose = () => setOpen(false);

  const toggleCategory = (cat: WorldCategory) => {
    onCategoriesChange(
      activeCategories.includes(cat)
        ? activeCategories.filter((c) => c !== cat)
        : [...activeCategories, cat]
    );
  };

  const toggleLayer = (layer: WorldLayer) => {
    onLayersChange(
      activeLayers.includes(layer)
        ? activeLayers.filter((l) => l !== layer)
        : [...activeLayers, layer]
    );
  };

  return (
    <>
      {/* Floating main menu button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setOpen(true)}
        className="pointer-events-auto fixed left-2 top-2 z-[75] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/70 text-gray-300 backdrop-blur-md transition hover:bg-white/10 hover:text-white sm:left-5 sm:top-5"
        title="Main menu (M)"
      >
        <Menu className="h-5 w-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="pointer-events-auto fixed inset-0 z-[78] bg-black/30 backdrop-blur-sm"
            />

            {/* Main menu panel */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-auto fixed left-0 top-0 z-[80] flex h-[100dvh] w-[90vw] max-w-[26rem] flex-col border-r border-white/10 bg-[rgba(8,10,20,0.95)] backdrop-blur-2xl sm:w-[26rem]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-oasis-gold to-oasis-purple text-sm font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.35)]">
                    {level}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Pilgrim Menu</h2>
                    <p className="text-[10px] text-gray-400">{credits} Z · Lv {level} · {Math.round(progress * 100)}%</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tab bar */}
              <div className="grid grid-cols-5 gap-1 border-b border-white/10 p-2">
                {TAB_ITEMS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] font-semibold transition ${
                        active ? 'bg-white/10 text-oasis-cyan' : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
                {tab === 'worlds' && (
                  <WorldsTab
                    activeCategories={activeCategories}
                    onToggleCategory={toggleCategory}
                    activeLayers={activeLayers}
                    onToggleLayer={toggleLayer}
                    selectedWorld={selectedWorld}
                    onWorldSelect={(w) => { onWorldSelect(w); onClose(); }}
                    onCloseWorld={onCloseWorld}
                    isMobile={isMobile}
                  />
                )}
                {tab === 'ship' && <ShipTab />}
                {tab === 'identity' && <IdentityTab />}
                {tab === 'audio' && <AudioTab music={music} muted={muted} onToggleMute={onToggleMute} />}
                {tab === 'oasis' && <OasisTab onEnterFlight={onEnterFlight} />}
              </div>

              {/* Footer quick actions */}
              <div className="grid grid-cols-4 gap-2 border-t border-white/10 p-3">
                <QuickAction
                  icon={Plane}
                  label="Flight"
                  color="text-amber-300"
                  onClick={() => { onEnterFlight(); onClose(); }}
                />
                <QuickAction
                  icon={muted ? VolumeX : Volume2}
                  label={muted ? 'Unmute' : 'Mute'}
                  color={muted ? 'text-gray-400' : 'text-oasis-cyan'}
                  onClick={onToggleMute}
                />
                <QuickAction
                  icon={uiHidden ? Eye : EyeOff}
                  label={uiHidden ? 'Show UI' : 'Hide UI'}
                  color="text-gray-300"
                  onClick={onToggleUiHidden}
                />
                <QuickAction
                  icon={LogIn}
                  label="Game"
                  color="text-oasis-emerald"
                  onClick={() => { onClose(); router.push('/dashboard'); }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

const TAB_ITEMS: { id: Tab | 'worlds'; icon: typeof MapIcon; label: string }[] = [
  { id: 'worlds', icon: Globe, label: 'Worlds' },
  { id: 'ship', icon: Rocket, label: 'Ship' },
  { id: 'identity', icon: User, label: 'Identity' },
  { id: 'audio', icon: Music, label: 'Audio' },
  { id: 'oasis', icon: Radio, label: 'OASIS' },
];

function QuickAction({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: typeof Plane;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg border border-white/5 bg-white/[0.03] py-2 text-[9px] font-semibold transition hover:bg-white/10 ${color}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function WorldsTab({
  activeCategories,
  onToggleCategory,
  activeLayers,
  onToggleLayer,
  selectedWorld,
  onWorldSelect,
  onCloseWorld,
  isMobile,
}: {
  activeCategories: WorldCategory[];
  onToggleCategory: (cat: WorldCategory) => void;
  activeLayers: WorldLayer[];
  onToggleLayer: (layer: WorldLayer) => void;
  selectedWorld: World | null;
  onWorldSelect: (world: World) => void;
  onCloseWorld: () => void;
  isMobile: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Minimap */}
      <div className="zion-hud-panel !relative p-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          <Compass className="h-3 w-3" /> Galaxy Map
        </p>
        <MiniMap
          activeCategories={activeCategories}
          selectedWorldId={selectedWorld?.id}
          onWorldSelect={onWorldSelect}
        />
        {selectedWorld && (
          <button
            onClick={onCloseWorld}
            className="mt-2 w-full rounded-lg border border-white/5 bg-white/[0.03] py-1.5 text-[10px] text-gray-400 transition hover:text-white"
          >
            Clear selected world
          </button>
        )}
      </div>

      {/* Category filters */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Filter categories</p>
        <div className="grid grid-cols-2 gap-2">
          {WORLD_CATEGORIES.map((cat) => {
            const active = activeCategories.includes(cat);
            const color = CATEGORY_COLORS[cat] || '#ffffff';
            const label = CATEGORY_LABELS[cat];
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[10px] transition"
                style={{
                  borderColor: active ? `${color}60` : 'rgba(255,255,255,0.05)',
                  background: active ? `${color}15` : 'rgba(255,255,255,0.03)',
                  color: active ? color : '#9ca3af',
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: active ? `0 0 8px ${color}` : 'none' }} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Layer filters */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Filter layers</p>
        <div className="flex flex-wrap gap-1.5">
          {LAYERS.map((layer) => {
            const active = activeLayers.includes(layer);
            return (
              <button
                key={layer}
                onClick={() => onToggleLayer(layer)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold transition ${
                  active
                    ? 'bg-oasis-cyan text-black'
                    : 'border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
                }`}
              >
                {layer}
              </button>
            );
          })}
        </div>
      </div>

      {/* Discovery stats */}
      <DiscoveryStats />
    </div>
  );
}

function DiscoveryStats() {
  const { discoveredWorlds, scannedWorlds, collectedEggs, completedQuests } = useGameStore();
  const total = WORLDS.length;
  return (
    <div className="zion-hud-panel !relative p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Discovery</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat value={discoveredWorlds.length} total={total} label="Worlds" color="#06b6d4" />
        <Stat value={scannedWorlds.length} total={total} label="Scanned" color="#10b981" />
        <Stat value={collectedEggs.length} label="Eggs" color="#fbbf24" />
        <Stat value={completedQuests.length} label="Quests" color="#a855f7" />
      </div>
    </div>
  );
}

function Stat({ value, total, label, color }: { value: number; total?: number; label: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 text-center">
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[9px] text-gray-500">{total !== undefined ? `${value}/${total} ${label}` : label}</p>
    </div>
  );
}
