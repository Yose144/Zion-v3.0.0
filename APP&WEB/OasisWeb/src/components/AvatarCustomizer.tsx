'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Brain, Zap, Heart, Wrench, Ghost, Check } from 'lucide-react';
import { useGameStore, type AvatarConfig, type BodyType, type Augmentation } from '@/store/gameStore';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/lib/zis';
import ZisAvatar from './ZisAvatar';

const BODY_TYPES: { id: BodyType; label: string; desc: string }[] = [
  { id: 'slim', label: 'Slim', desc: 'Agile — faster reflexes' },
  { id: 'standard', label: 'Standard', desc: 'Balanced — versatile' },
  { id: 'heavy', label: 'Heavy', desc: 'Resilient — more capacity' },
];

const NEON_COLORS: { hex: string; label: string }[] = [
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#9333ea', label: 'Violet' },
  { hex: '#fcd116', label: 'Gold' },
  { hex: '#078930', label: 'Emerald' },
  { hex: '#e41e2b', label: 'Crimson' },
  { hex: '#ec4899', label: 'Magenta' },
];

const AUGMENTS: { id: Augmentation; label: string; icon: LucideIcon; desc: string }[] = [
  { id: 'reflexes', label: 'Reflexes', icon: Zap, desc: 'Faster reaction time' },
  { id: 'neural', label: 'Neural', icon: Brain, desc: 'Enhanced cognition' },
  { id: 'tech', label: 'Tech', icon: Wrench, desc: 'Gadget mastery' },
  { id: 'bio', label: 'Bio', icon: Heart, desc: 'Regenerative implants' },
  { id: 'stealth', label: 'Stealth', icon: Ghost, desc: 'Optical camouflage' },
];

interface AvatarCustomizerProps {
  /** ZIS seed for the identity sigil shown as the chest emblem. */
  seed?: string;
  /** Explicit avatar image URL (ZIS avatar) for the emblem. */
  avatarSrc?: string | null;
  onDone?: (config: AvatarConfig) => void;
  doneLabel?: string;
}

/**
 * 3D-avatar configuration editor — callsign, body type, neon accent and
 * augmentation. Renders a live stylized preview (the full rigged mesh is
 * rendered in-world by the dashboard hologram; this panel is the
 * configuration surface used by the Pilgrim Rite and the Identity tab).
 */
export default function AvatarCustomizer({ seed, avatarSrc, onDone, doneLabel = 'Confirm Avatar' }: AvatarCustomizerProps) {
  const current = useGameStore((s) => s.avatarConfig);
  const setAvatarConfig = useGameStore((s) => s.setAvatarConfig);
  const { authenticated } = useAuth();

  const [callsign, setCallsign] = useState(current.callsign);
  const [bodyType, setBodyType] = useState<BodyType>(current.bodyType);
  const [neonColor, setNeonColor] = useState(current.neonColor);
  const [augmentation, setAugmentation] = useState<Augmentation>(current.augmentation);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    const config: AvatarConfig = { callsign: callsign.trim(), bodyType, neonColor, augmentation };
    setAvatarConfig(config);
    if (authenticated) {
      setSaving(true);
      try {
        await updateProfile({ avatar3d: config });
      } catch {
        // Local state is already applied — ZIS persistence is best-effort.
      } finally {
        setSaving(false);
      }
    }
    onDone?.(config);
  };

  const bodyScale = { slim: 'scale-x-[0.82]', standard: 'scale-x-100', heavy: 'scale-x-[1.22]' }[bodyType];

  return (
    <div className="flex flex-col gap-5">
      {/* Live preview — stylized hologram silhouette with neon trim and the
          ZIS sigil as the chest emblem. */}
      <div className="relative mx-auto flex h-44 w-40 items-end justify-center">
        <div
          className="absolute inset-0 rounded-full opacity-30 blur-2xl"
          style={{ background: `radial-gradient(circle, ${neonColor}55, transparent 70%)` }}
        />
        <div className={`relative flex flex-col items-center transition-transform ${bodyScale}`}>
          {/* head */}
          <div
            className="h-9 w-9 rounded-full border-2"
            style={{ borderColor: neonColor, background: `linear-gradient(180deg, ${neonColor}33, #0a0a14)`, boxShadow: `0 0 18px ${neonColor}66` }}
          />
          {/* torso with sigil emblem */}
          <div
            className="mt-1 flex h-16 w-16 items-center justify-center rounded-t-2xl border-2"
            style={{ borderColor: neonColor, background: `linear-gradient(180deg, ${neonColor}22, #0a0a14)`, boxShadow: `0 0 14px ${neonColor}44` }}
          >
            {seed ? (
              <ZisAvatar seed={seed} src={avatarSrc} size={30} alt="sigil" animated />
            ) : (
              <div className="h-7 w-7 rounded-full" style={{ background: `${neonColor}55` }} />
            )}
          </div>
          {/* legs */}
          <div className="flex gap-1">
            {[0, 1].map((i) => (
              <div key={i} className="h-10 w-4 rounded-b-lg border-2 border-t-0" style={{ borderColor: `${neonColor}cc`, background: `linear-gradient(180deg, ${neonColor}18, #0a0a14)` }} />
            ))}
          </div>
        </div>
        {/* hologram base ring */}
        <div className="absolute bottom-0 h-2 w-32 rounded-full border" style={{ borderColor: `${neonColor}88`, boxShadow: `0 0 12px ${neonColor}55` }} />
      </div>

      {/* Callsign */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/60">Callsign</label>
        <input
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
          placeholder="e.g. Neo-Pilgrim"
          maxLength={24}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
        />
      </div>

      {/* Body type */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/60">Body</label>
        <div className="grid grid-cols-3 gap-2">
          {BODY_TYPES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBodyType(b.id)}
              className={`rounded-xl border p-2.5 text-left transition-colors ${bodyType === b.id ? 'border-white/40 bg-white/10' : 'border-white/10 bg-black/30 hover:border-white/20'}`}
            >
              <p className="text-xs font-bold text-white">{b.label}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/50">{b.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Neon color */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/60">Neon Trim</label>
        <div className="flex flex-wrap gap-2">
          {NEON_COLORS.map((c) => (
            <button
              key={c.hex + c.label}
              type="button"
              onClick={() => setNeonColor(c.hex)}
              title={c.label}
              className="relative h-9 w-9 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: c.hex, borderColor: neonColor === c.hex ? '#fff' : 'transparent', boxShadow: `0 0 12px ${c.hex}88` }}
            >
              {neonColor === c.hex && <Check size={14} className="absolute inset-0 m-auto text-black" />}
            </button>
          ))}
        </div>
      </div>

      {/* Augmentation */}
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/60">Augmentation</label>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-5">
          {AUGMENTS.map((a) => {
            const Icon = a.icon;
            const active = augmentation === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAugmentation(a.id)}
                title={a.desc}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors ${active ? 'border-white/40 bg-white/10' : 'border-white/10 bg-black/30 hover:border-white/20'}`}
              >
                <Icon size={16} style={{ color: active ? neonColor : 'rgba(255,255,255,0.5)' }} />
                <span className="text-[9px] font-semibold text-white/80">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={confirm}
        disabled={saving}
        className="zion-button-primary w-full py-3 text-sm font-bold disabled:opacity-50"
      >
        {saving ? 'Saving…' : doneLabel}
      </motion.button>
    </div>
  );
}
