'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, X, Rocket, User, Music, Radio, Eye, EyeOff,
  Volume2, VolumeX, Layers, Compass,
} from 'lucide-react';
import { ShipTab, IdentityTab, AudioTab, OasisTab, type Tab } from './GamePanel';
import type { MusicPlayerState } from './AudioEngine';

interface SettingsPanelProps {
  music: MusicPlayerState;
  muted: boolean;
  onToggleMute: () => void;
  onEnterFlight?: () => void;
  uiHidden: boolean;
  onToggleUiHidden: () => void;
}

const TABS: { id: Tab; icon: typeof Rocket; label: string; color: string }[] = [
  { id: 'ship', icon: Rocket, label: 'Ship', color: 'text-oasis-cyan' },
  { id: 'identity', icon: User, label: 'Identity', color: 'text-oasis-purple' },
  { id: 'audio', icon: Music, label: 'Audio', color: 'text-oasis-gold' },
  { id: 'oasis', icon: Radio, label: 'OASIS', color: 'text-oasis-emerald' },
];

export default function SettingsPanel({
  music,
  muted,
  onToggleMute,
  onEnterFlight,
  uiHidden,
  onToggleUiHidden,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('ship');

  return (
    <>
      {/* Floating gear icon — always visible */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setOpen(true)}
        className="pointer-events-auto fixed bottom-3 right-3 z-[80] rounded-full border border-white/15 bg-black/70 p-3 text-gray-300 backdrop-blur-md transition hover:bg-white/10 hover:text-white sm:bottom-5 sm:right-5"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </motion.button>

      {/* Settings overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="pointer-events-auto fixed inset-0 z-[85] bg-black/40 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-auto fixed bottom-3 right-3 top-3 z-[90] flex w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(8,10,20,0.92)] backdrop-blur-xl sm:bottom-5 sm:right-5 sm:top-5 sm:w-[30rem]"
              style={{ boxShadow: '0 20px 80px rgba(0,0,0,0.6)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-oasis-cyan" />
                  <h3 className="text-sm font-bold text-white">Settings</h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Quick actions row */}
              <div className="flex gap-2 border-b border-white/5 px-4 py-2.5">
                <QuickBtn
                  icon={Rocket}
                  label="Flight"
                  color="text-amber-300"
                  onClick={() => { onEnterFlight?.(); setOpen(false); }}
                />
                <QuickBtn
                  icon={muted ? VolumeX : Volume2}
                  label={muted ? 'Muted' : 'Sound'}
                  color={muted ? 'text-gray-400' : 'text-oasis-cyan'}
                  onClick={onToggleMute}
                />
                <QuickBtn
                  icon={uiHidden ? Eye : EyeOff}
                  label={uiHidden ? 'Show UI' : 'Hide UI'}
                  color="text-gray-300"
                  onClick={onToggleUiHidden}
                />
              </div>

              {/* Tab bar */}
              <div className="flex gap-1 border-b border-white/5 px-3 py-2">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-semibold transition ${
                        active ? `${t.color} bg-white/10` : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content — scrollable */}
              <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
                {tab === 'ship' && <ShipTab />}
                {tab === 'identity' && <IdentityTab />}
                {tab === 'audio' && (
                  <AudioTab music={music} muted={muted} onToggleMute={onToggleMute} />
                )}
                {tab === 'oasis' && <OasisTab onEnterFlight={onEnterFlight} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function QuickBtn({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: typeof Rocket;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] py-2 text-[10px] font-semibold transition hover:bg-white/10 ${color}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
