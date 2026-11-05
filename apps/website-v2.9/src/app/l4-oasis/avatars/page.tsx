'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronRight, Filter, Gamepad2, Gem,
  KeyRound, MapPin, Search, Shield, Sparkles, Star, Swords, Users, X, Zap,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import MarkdownDoc from '@/components/docs/MarkdownDoc';
import {
  AVATAR_CIRCLES, OASIS_AVATARS,
  type LocalizedText, type OasisAvatar, type OasisAvatarCircle, type OasisAvatarRay, type OasisAvatarRarity,
} from '@/lib/oasis/avatars';
import GAME_PORTRAITS from '@/lib/oasis/game-portraits.json';
import CHARACTER_SHEET_IMAGES from '@/lib/oasis/character-sheet-images.json';

/**
 * Herní náhled: postava vyrenderovaná z **téhož modelu, jaký běží ve hře**
 * (`apps/nirvana/src/core/avatars`). Generuje `scripts/ops/oasis-avatar-render`.
 * Turnaround (`character-sheet-images.json`) je tentýž model ze čtyř pohledů —
 * podklad pro modeláře i pro generování finálních portrétů.
 */
const PORTRAITS = GAME_PORTRAITS as Record<string, string>;
const SHEETS = CHARACTER_SHEET_IMAGES as Record<string, string>;
const portraitOf = (a: OasisAvatar): string | null => PORTRAITS[String(a.id)] ?? null;
const sheetOf = (a: OasisAvatar): string | null => SHEETS[String(a.id)] ?? null;

const OASIS_URL = 'https://oasis.zionterranova.com';

/**
 * Dvojjazyčné pole → text pro aktuální jazyk. Když český překlad chybí,
 * spadne na angličtinu (radši anglický text než prázdný blok).
 */
const tx = (t: LocalizedText | undefined, cs: boolean): string =>
  t ? (cs ? t.cs || t.en : t.en || t.cs) : '';

const Copy = {
  backToOasis: { cs: 'L4 Oasis', en: 'L4 Oasis' },
  badge: { cs: 'L4 · ZION Oasis · Avatar Roster', en: 'L4 · ZION Oasis · Avatar Roster' },
  title: { cs: 'Avatáři ZION Oasis', en: 'ZION Oasis Avatars' },
  tagline: {
    cs: 'Posvátné postavy OASIS — každá s vlastním příběhem, výukou a schopností, česky i anglicky.',
    en: 'The sacred figures of OASIS — each with its own story, teaching and ability, in Czech and English.',
  },
  desc: {
    cs: 'Kompletní roster z OASIS canonu: hinduistické božské trojky a ascendovaní mistři, křesťanští svatí a buddhističtí učitelé, historické legendy, hrdinové Matrixu, ZION originals a šestnáct dalších kruhů — od prvních národů přes Tibet, Pacifiku a Afriku po Atlantidu, Lemurii, seversko-keltský kruh, starověký Egypt a Mayu. Jména uvádíme v původním znění.',
    en: 'The complete roster from the OASIS canon: Hindu deities and ascended masters, Christian saints and Buddhist teachers, historical legends, Matrix heroes, ZION originals, and sixteen further circles — from First Nations through Tibet, the Pacific and Africa to Atlantis, Lemuria, the Norse–Celtic circle, Ancient Egypt and Maya. All names are shown in their original form.',
  },
  avatarsCount: { cs: 'avatarů', en: 'avatars' },
  circlesCount: { cs: 'kruhů', en: 'circles' },
  raysCount: { cs: 'paprků', en: 'rays' },
  searchPlaceholder: { cs: 'Hledat avatara, roli, místo…', en: 'Search avatar, role, place…' },
  allRays: { cs: 'Všechny paprsky', en: 'All rays' },
  allRarity: { cs: 'Všechny rarity', en: 'All rarities' },
  shownOf: { cs: 'zobrazeno', en: 'shown' },
  of: { cs: 'z', en: 'of' },
  resetFilters: { cs: 'Zrušit filtry', en: 'Reset filters' },
  noResults: { cs: 'Žádný avatar neodpovídá filtrům.', en: 'No avatar matches the filters.' },
  roster: { cs: 'Roster', en: 'Roster' },
  circlesTitle: { cs: 'Kruhy rosteru', en: 'Roster Circles' },
  quests: { cs: 'questů', en: 'quests' },
  roleLabel: { cs: 'Role', en: 'Role' },
  locationLabel: { cs: 'Místo', en: 'Location' },
  questLineLabel: { cs: 'Quest linie', en: 'Quest line' },
  detailLabel: { cs: 'Detail', en: 'Details' },
  keyLabel: { cs: 'Klíč', en: 'Key' },
  abilityLabel: { cs: 'Schopnost', en: 'Ability' },
  teachingLabel: { cs: 'Výuka', en: 'Teaching' },
  clLabel: { cs: 'Vyžaduje', en: 'Requires' },
  circleLabel: { cs: 'Kruh', en: 'Circle' },
  nftLabel: { cs: 'NFT vzácnost', en: 'NFT rarity' },
  artConcept: { cs: 'Konceptový portrét · OASIS Collection', en: 'Concept portrait · OASIS Collection' },
  artFinal: { cs: 'Detailní portrét · OASIS Collection', en: 'Detailed portrait · OASIS Collection' },
  artGame: { cs: 'Herní 3D náhled · procedurální model', en: 'In-game 3D preview · procedural model' },
  sheetLabel: { cs: 'Character sheet · front / 3-4 / bok / záda', en: 'Character sheet · front / 3-4 / side / back' },
  symbolsLabel: { cs: 'Atributy z kánonu', en: 'Canon attributes' },
  promptLabel: { cs: 'Prompt pro finální portrét', en: 'Final portrait prompt' },
  promptHint: {
    cs: 'Zkopíruj do generátoru obrázků spolu s referenčním turnaroundem.',
    en: 'Paste into an image generator together with the turnaround reference.',
  },
  copyPrompt: { cs: 'Kopírovat prompt', en: 'Copy prompt' },
  copied: { cs: 'Zkopírováno', en: 'Copied' },
  heroAlt: { cs: 'Brána ZION OASIS — úvodní ilustrace', en: 'ZION OASIS gateway — cover illustration' },
  close: { cs: 'Zavřít', en: 'Close' },
  idLabel: { cs: 'č.', en: 'no.' },
  profileLabel: { cs: 'Profil ze SACRED TRINITY', en: 'SACRED TRINITY profile' },
  profileLoading: { cs: 'Načítám profil…', en: 'Loading profile…' },
  noteAtlantis: { cs: 'Literární mýtus podle Platóna (Critias/Timaeus) — ne historie.', en: 'Literary myth after Plato (Critias/Timaeus) — not history.' },
  noteLemuria: { cs: 'Syntetická pedagogika — bez rasových hierarchií theosofie.', en: 'Synthetic pedagogy — no theosophist race hierarchies.' },
  noteCosmic: { cs: 'Metafory vědomí — ne medicínská ani aktivační tvrzení.', en: 'Metaphors of consciousness — no medical or activation claims.' },
  noteEgypt: { cs: 'Faraonské archetypy — žádná glorifikace muzejního loupežení.', en: 'Pharaonic archetypes — no museum-loot glorification.' },
  noteNorse: { cs: 'Severské a keltské prameny — bez extremistické symboliky.', en: 'Norse and Celtic sources — no extremist symbolism.' },
  noteMaya: { cs: 'Cykklický přechod — ne doomsday.', en: 'Cyclic transition — not doomsday.' },
  enterOasis: { cs: 'Vstoupit do OASIS', en: 'Enter OASIS' },
  moreAbout: { cs: 'Více o L4 Oasis', en: 'More about L4 Oasis' },
};

const RAY_META: Record<OasisAvatarRay, { cs: string; en: string; hex: string; orb: string }> = {
  Blue:     { cs: 'Modrý',            en: 'Blue',        hex: '#38bdf8', orb: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
  Pink:     { cs: 'Růžový',           en: 'Pink',        hex: '#f472b6', orb: 'linear-gradient(135deg,#ec4899,#f9a8d4)' },
  Yellow:   { cs: 'Žlutý',            en: 'Yellow',      hex: '#fbbf24', orb: 'linear-gradient(135deg,#d97706,#fde68a)' },
  Violet:   { cs: 'Fialový',          en: 'Violet',      hex: '#a78bfa', orb: 'linear-gradient(135deg,#7c3aed,#c4b5fd)' },
  AllRays:  { cs: 'Všechny paprsky',  en: 'All Rays',    hex: '#f5d76e', orb: 'conic-gradient(from 210deg,#fbbf24,#38bdf8,#a78bfa,#f472b6,#fbbf24)' },
  White:    { cs: 'Bílý',             en: 'White',       hex: '#e2e8f0', orb: 'linear-gradient(135deg,#cbd5e1,#f8fafc)' },
  Green:    { cs: 'Zelený',           en: 'Green',       hex: '#34d399', orb: 'linear-gradient(135deg,#059669,#6ee7b7)' },
  RubyGold: { cs: 'Rubínovo-zlatý',   en: 'Ruby-Gold',   hex: '#fb923c', orb: 'linear-gradient(135deg,#e11d48,#fbbf24)' },
  Obsidian: { cs: 'Obsidián',         en: 'Obsidian',    hex: '#94a3b8', orb: 'linear-gradient(135deg,#1e293b,#64748b)' },
};

const RARITY_META: Record<OasisAvatarRarity, { cs: string; en: string; badge: string }> = {
  Rare:      { cs: 'Rare',            en: 'Rare',        badge: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' },
  Epic:      { cs: 'Epic',            en: 'Epic',        badge: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple' },
  Legendary: { cs: 'Legendary',       en: 'Legendary',   badge: 'border-zion-gold/40 bg-zion-gold/10 text-zion-gold' },
  OneOfOne:  { cs: 'Jediný 1/1',      en: 'One of One',  badge: 'border-white/40 bg-white/10 text-white' },
};

const CIRCLE_NOTES: Partial<Record<OasisAvatarCircle, { cs: string; en: string }>> = {
  atlantis: { cs: Copy.noteAtlantis.cs, en: Copy.noteAtlantis.en },
  lemuria: { cs: Copy.noteLemuria.cs, en: Copy.noteLemuria.en },
  cosmic: { cs: Copy.noteCosmic.cs, en: Copy.noteCosmic.en },
  egypt: { cs: Copy.noteEgypt.cs, en: Copy.noteEgypt.en },
  'norse-celtic': { cs: Copy.noteNorse.cs, en: Copy.noteNorse.en },
  maya: { cs: Copy.noteMaya.cs, en: Copy.noteMaya.en },
};

const RAY_ORDER: OasisAvatarRay[] = ['AllRays', 'Blue', 'Pink', 'Yellow', 'Violet', 'White', 'Green', 'RubyGold', 'Obsidian'];
const RARITY_ORDER: OasisAvatarRarity[] = ['Rare', 'Epic', 'Legendary', 'OneOfOne'];

/** Kanonický spec (atributy, paleta, prompt) — tahá se lazy, jen když je detail otevřený. */
interface SheetSpec {
  id: number;
  symbols: string[];
  palette: string[];
  skin: string | null;
  headwear: string | null;
  companions: string[];
  culture: string;
  prompt: string;
}

let specsPromise: Promise<SheetSpec[]> | null = null;
function loadSpecs(): Promise<SheetSpec[]> {
  if (!specsPromise) {
    specsPromise = fetch('/oasis-assets/character-sheets/specs.json')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { entries: SheetSpec[] }) => data.entries)
      .catch(() => {
        specsPromise = null;
        return [];
      });
  }
  return specsPromise;
}

function AvatarVisual({ a, size, cs }: { a: OasisAvatar; size: 'card' | 'modal'; cs: boolean }) {
  const ray = RAY_META[a.ray] ?? RAY_META.Blue;
  const portrait = portraitOf(a);
  // Herní 3D náhled má přednost; koncept z OASIS Collection je fallback.
  const src = portrait ?? (size === 'modal' ? (a.art.full || a.art.card) : a.art.card);
  const initial = (a.name.trim()[0] ?? '?').toUpperCase();
  const box = size === 'modal' ? 'h-56 w-44 text-3xl md:h-64 md:w-52' : 'h-16 w-16 text-xl';
  if (src) {
    return (
      <img
        src={src}
        alt={cs ? `Portrét avatara: ${a.name}` : `Avatar portrait: ${a.name}`}
        loading="lazy"
        decoding="async"
        className={`${box} shrink-0 rounded-2xl border border-white/15 bg-black/40 object-cover shadow-lg`}
      />
    );
  }
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-2xl font-bold text-black/80 shadow-lg`}
      style={{ background: ray.orb }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function AvatarCard({ a, cs, onOpen }: { a: OasisAvatar; cs: boolean; onOpen: () => void }) {
  const ray = RAY_META[a.ray] ?? RAY_META.Blue;
  const rarity = RARITY_META[a.rarity] ?? RARITY_META.Rare;
  const src = portraitOf(a) ?? a.art.card;
  const initial = (a.name.trim()[0] ?? '?').toUpperCase();
  const detail = Copy.detailLabel[cs ? 'cs' : 'en'];
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
      aria-label={`${a.name} — ${detail}`}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#08050f] text-left transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] focus:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
    >
      {/* portrét — poměr 4:5 jako v herním rosteru */}
      <div className="relative aspect-[4/5] w-full overflow-hidden" style={{ background: ray.orb }}>
        {src ? (
          <img
            src={src}
            alt={cs ? `Portrét avatara: ${a.name}` : `Avatar portrait: ${a.name}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 will-change-transform group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-black/70" aria-hidden>
            {initial}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${rarity.badge}`}>
            <Gem className="h-2.5 w-2.5" /> {rarity[cs ? 'cs' : 'en']}
          </span>
          <span className="rounded-full border border-zion-gold/40 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-zion-gold backdrop-blur">
            CL{a.cl}
          </span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-2.5 pt-10">
          <h3 className="truncate text-sm font-semibold text-white">{a.name}</h3>
          <p className="truncate text-[11px] text-zion-gold/85">{tx(a.subtitle, cs)}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ray.hex }} />
            {ray[cs ? 'cs' : 'en']}
          </span>
          {a.quests.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Swords className="h-2.5 w-2.5" /> {a.quests.length} {Copy.quests[cs ? 'cs' : 'en']}
            </span>
          )}
          {a.key && (
            <span className="inline-flex items-center gap-1 text-amber-300/90">
              <KeyRound className="h-2.5 w-2.5" /> {a.key}
            </span>
          )}
        </div>
        {(a.essence.cs || a.essence.en) && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-gray-300">
            {a.essence[cs ? 'cs' : 'en'] || a.essence.en}
          </p>
        )}
        <p className="mt-auto flex items-center justify-between gap-2 pt-1 text-[10px] uppercase tracking-wider text-gray-500">
          <span className="truncate">{tx(a.role, cs) || tx(a.location, cs)}</span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-zion-gold/70 transition-colors group-hover:text-zion-gold">
            {detail} <ChevronRight className="h-3 w-3" />
          </span>
        </p>
      </div>
    </button>
  );
}

function AvatarModal({ a, cs, onClose }: { a: OasisAvatar; cs: boolean; onClose: () => void }) {
  const ray = RAY_META[a.ray] ?? RAY_META.Blue;
  const rarity = RARITY_META[a.rarity] ?? RARITY_META.Rare;
  const [profile, setProfile] = useState<string | null>(null);
  const [profileFailed, setProfileFailed] = useState(false);
  const [spec, setSpec] = useState<SheetSpec | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let dead = false;
    void loadSpecs().then((entries) => {
      if (!dead) setSpec(entries.find((entry) => entry.id === a.id) ?? null);
    });
    return () => {
      dead = true;
    };
  }, [a.id]);

  useEffect(() => {
    if (!a.hasProfile) return;
    let dead = false;
    // Profil je dvojjazyčný: <id>.<lang>.md; když překlad chybí, spadne na druhý jazyk.
    const lang = cs ? 'cs' : 'en';
    const other = cs ? 'en' : 'cs';
    const load = (l: string) =>
      fetch(`/data/oasis/profiles/${a.id}.${l}.md`).then((r) =>
        r.ok ? r.text() : Promise.reject(new Error(String(r.status))),
      );
    load(lang)
      .catch(() => load(other))
      .then((t) => { if (!dead) setProfile(t); })
      .catch(() => { if (!dead) setProfileFailed(true); });
    return () => { dead = true; };
  }, [a.id, a.hasProfile, cs]);

  const circle = AVATAR_CIRCLES.find((c) => c.key === a.circle);
  const circleLabel = circle ? `${circle.emoji} ${circle[cs ? 'cs' : 'en']}` : a.circle;
  const infoRows: { icon: typeof Star; label: string; value: string }[] = [
    { icon: Shield, label: Copy.roleLabel[cs ? 'cs' : 'en'], value: tx(a.role, cs) },
    { icon: MapPin, label: Copy.locationLabel[cs ? 'cs' : 'en'], value: tx(a.location, cs) },
    { icon: KeyRound, label: Copy.keyLabel[cs ? 'cs' : 'en'], value: a.key },
    { icon: Swords, label: Copy.questLineLabel[cs ? 'cs' : 'en'], value: tx(a.questLine, cs) },
  ].filter((r) => r.value);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 pb-6 pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={a.name}
        className="zion-rainbow-card relative flex max-h-full w-full max-w-3xl flex-col"
        style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60 text-gray-300 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
          aria-label={Copy.close[cs ? 'cs' : 'en']}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="nav-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 md:p-8">

        <div className="flex items-start gap-4">
          <AvatarVisual a={a} size="modal" cs={cs} />
          <div className="min-w-0 pr-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
              {Copy.idLabel[cs ? 'cs' : 'en']} {a.id} · {circleLabel}
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">{a.name}</h3>
            <p className="text-sm text-zion-gold/90">{tx(a.subtitle, cs)}</p>
            {tx(a.quote, cs) && (
              <p className="mt-2 text-xs italic leading-relaxed text-gray-400">„{tx(a.quote, cs)}“</p>
            )}
            {a.art.card && (
              <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-gray-400">
                {(portraitOf(a) ? Copy.artGame : a.art.final ? Copy.artFinal : Copy.artConcept)[
                  cs ? 'cs' : 'en'
                ]}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${rarity.badge}`}>
            <Gem className="h-3 w-3" /> {rarity[cs ? 'cs' : 'en']}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-200">
            <span className="h-2 w-2 rounded-full" style={{ background: ray.hex }} />
            {ray[cs ? 'cs' : 'en']}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-3 py-1 text-zion-gold">
            {Copy.clLabel[cs ? 'cs' : 'en']} CL{a.cl}{tx(a.clName, cs) ? ` · ${tx(a.clName, cs)}` : ''}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-400">
            {Copy.nftLabel[cs ? 'cs' : 'en']}: {a.rarity}
          </span>
        </div>

        {sheetOf(a) && (
          <figure className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <img
              src={sheetOf(a)!}
              alt={cs ? `${a.name} — character sheet` : `${a.name} — character sheet`}
              loading="lazy"
              decoding="async"
              className="w-full"
            />
            <figcaption className="border-t border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500">
              {Copy.sheetLabel[cs ? 'cs' : 'en']}
            </figcaption>
          </figure>
        )}

        {spec && (spec.symbols.length > 0 || spec.palette.length > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              {Copy.symbolsLabel[cs ? 'cs' : 'en']}
            </span>
            {spec.symbols.map((symbol) => (
              <span key={symbol} className="rounded-full border border-zion-cyan/25 bg-zion-cyan/10 px-2 py-0.5 text-cyan-200">
                {symbol}
              </span>
            ))}
            {spec.palette.map((hex) => (
              <span
                key={hex}
                title={hex}
                className="inline-block h-4 w-4 rounded-full border border-white/25"
                style={{ background: hex }}
              />
            ))}
          </div>
        )}

        {spec?.prompt && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zion-gold">
                <Sparkles className="h-3.5 w-3.5" /> {Copy.promptLabel[cs ? 'cs' : 'en']}
              </p>
              <button
                type="button"
                onClick={() => {
                  const text = spec.prompt;
                  void navigator.clipboard?.writeText(text).then(
                    () => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    },
                    () => setCopied(false),
                  );
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-gray-200 transition-colors hover:bg-white/10"
              >
                {copied ? Copy.copied[cs ? 'cs' : 'en'] : Copy.copyPrompt[cs ? 'cs' : 'en']}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{Copy.promptHint[cs ? 'cs' : 'en']}</p>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-gray-300">
              {spec.prompt}
            </pre>
          </div>
        )}

        {infoRows.length > 0 && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {infoRows.map((r) => (
              <div key={r.label} className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-zion-cyan" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{r.label}</p>
                  <p className="text-sm leading-snug text-gray-200">{r.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tx(a.ability, cs) && (
          <div className="mt-5">
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zion-gold">
              <Zap className="h-3.5 w-3.5" /> {Copy.abilityLabel[cs ? 'cs' : 'en']}
            </p>
            <p className="text-sm leading-relaxed text-gray-300">{tx(a.ability, cs)}</p>
          </div>
        )}

        {tx(a.teaching, cs) && (
          <div className="mt-5">
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zion-purple">
              <BookOpen className="h-3.5 w-3.5" /> {Copy.teachingLabel[cs ? 'cs' : 'en']}
            </p>
            <p className="border-l-2 border-zion-purple/40 pl-3 text-sm italic leading-relaxed text-gray-300">
              {tx(a.teaching, cs)}
            </p>
          </div>
        )}

        {a.quests.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zion-cyan">
              <Swords className="h-3.5 w-3.5" /> {Copy.questLineLabel[cs ? 'cs' : 'en']} · {a.quests.length} {Copy.quests[cs ? 'cs' : 'en']}
            </p>
            <ol className="space-y-2">
              {a.quests.map((q, i) => (
                <li key={`${a.id}-q${i}`} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zion-cyan/40 text-[10px] font-bold text-zion-cyan">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{tx(q.title, cs)}</p>
                    <p className="text-xs leading-relaxed text-gray-400">{tx(q.description, cs)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {a.hasProfile && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zion-cyan">
              <BookOpen className="h-3.5 w-3.5" /> {Copy.profileLabel[cs ? 'cs' : 'en']}
            </p>
            {profile ? (
              <div className="zion-docs-prose text-sm leading-relaxed text-gray-300">
                <MarkdownDoc content={profile} />
              </div>
            ) : (
              <p className="text-xs text-gray-500">{profileFailed ? '—' : Copy.profileLoading[cs ? 'cs' : 'en']}</p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default function OasisAvatarsPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [query, setQuery] = useState('');
  const [rayFilter, setRayFilter] = useState<OasisAvatarRay | 'all'>('all');
  const [rarityFilter, setRarityFilter] = useState<OasisAvatarRarity | 'all'>('all');
  const [selected, setSelected] = useState<OasisAvatar | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [selected]);

  const rarityCounts = useMemo(() => {
    const m = new Map<OasisAvatarRarity, number>();
    for (const a of OASIS_AVATARS) m.set(a.rarity, (m.get(a.rarity) ?? 0) + 1);
    return m;
  }, []);
  const rayCounts = useMemo(() => {
    const m = new Map<OasisAvatarRay, number>();
    for (const a of OASIS_AVATARS) m.set(a.ray, (m.get(a.ray) ?? 0) + 1);
    return m;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OASIS_AVATARS.filter((a) => {
      if (rayFilter !== 'all' && a.ray !== rayFilter) return false;
      if (rarityFilter !== 'all' && a.rarity !== rarityFilter) return false;
      if (!q) return true;
      return [
        a.name,
        tx(a.subtitle, cs),
        tx(a.role, cs),
        tx(a.location, cs),
        tx(a.teaching, cs),
        tx(a.ability, cs),
        tx(a.questLine, cs),
      ].some((f) => f.toLowerCase().includes(q));
    });
  }, [query, rayFilter, rarityFilter]);

  const byCircle = useMemo(() => {
    const m = new Map<OasisAvatarCircle, OasisAvatar[]>();
    for (const a of filtered) {
      const list = m.get(a.circle) ?? [];
      list.push(a);
      m.set(a.circle, list);
    }
    return m;
  }, [filtered]);

  const filtering = query.trim() !== '' || rayFilter !== 'all' || rarityFilter !== 'all';
  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? 'border-zion-gold/50 bg-zion-gold/15 text-zion-gold'
        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
    }`;

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-12">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/l4-oasis"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> {Copy.backToOasis[cs ? 'cs' : 'en']}
              </Link>
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Users className="h-4 w-4" />
                {Copy.badge[cs ? 'cs' : 'en']}
              </div>
            </div>
            <div className="max-w-3xl">
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {Copy.title[cs ? 'cs' : 'en']}
              </h1>
              <p className="mt-2 text-lg font-medium text-zion-gold/90">
                {Copy.tagline[cs ? 'cs' : 'en']}
              </p>
            </div>
            <p className="text-base text-gray-300 max-w-3xl">
              {Copy.desc[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-orange-200">
                <Star className="h-3 w-3" /> {OASIS_AVATARS.length} {Copy.avatarsCount[cs ? 'cs' : 'en']}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-cyan-200">
                <Users className="h-3 w-3" /> {AVATAR_CIRCLES.length} {Copy.circlesCount[cs ? 'cs' : 'en']}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-purple/30 bg-zion-purple/10 px-4 py-2 text-purple-200">
                <Sparkles className="h-3 w-3" /> {rayCounts.size} {Copy.raysCount[cs ? 'cs' : 'en']}
              </span>
              {RARITY_ORDER.map((r) => (
                <span key={r} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 ${RARITY_META[r].badge}`}>
                  <Gem className="h-3 w-3" /> {RARITY_META[r][cs ? 'cs' : 'en']} {rarityCounts.get(r) ?? 0}
                </span>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <img
                src="/oasis-assets/oasis-gateway-1920x1080.webp"
                alt={Copy.heroAlt[cs ? 'cs' : 'en']}
                width={1920}
                height={1080}
                className="w-full object-cover"
                decoding="async"
              />
            </div>
          </div>
        </motion.section>

        {/* ── FILTRY ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card sticky top-24 z-30 p-5"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={Copy.searchPlaceholder[cs ? 'cs' : 'en']}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-zion-gold/40 focus:outline-none"
                />
              </div>
              <span className="text-xs text-gray-400">
                <Filter className="mr-1 inline h-3 w-3" />
                {filtered.length} {Copy.shownOf[cs ? 'cs' : 'en']} {Copy.of[cs ? 'cs' : 'en']} {OASIS_AVATARS.length}
              </span>
              {filtering && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setRayFilter('all'); setRarityFilter('all'); }}
                  className="rounded-full border border-zion-purple/40 bg-zion-purple/10 px-3 py-1.5 text-xs font-semibold text-zion-purple hover:bg-zion-purple/15 transition-colors"
                >
                  {Copy.resetFilters[cs ? 'cs' : 'en']}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setRayFilter('all')} className={pill(rayFilter === 'all')}>
                {Copy.allRays[cs ? 'cs' : 'en']}
              </button>
              {RAY_ORDER.filter((r) => rayCounts.has(r)).map((r) => (
                <button key={r} type="button" onClick={() => setRayFilter(rayFilter === r ? 'all' : r)} className={pill(rayFilter === r)}>
                  <span className="h-2 w-2 rounded-full" style={{ background: RAY_META[r].hex }} />
                  {RAY_META[r][cs ? 'cs' : 'en']} <span className="text-gray-500">{rayCounts.get(r)}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setRarityFilter('all')} className={pill(rarityFilter === 'all')}>
                {Copy.allRarity[cs ? 'cs' : 'en']}
              </button>
              {RARITY_ORDER.map((r) => (
                <button key={r} type="button" onClick={() => setRarityFilter(rarityFilter === r ? 'all' : r)} className={pill(rarityFilter === r)}>
                  {RARITY_META[r][cs ? 'cs' : 'en']} <span className="text-gray-500">{rarityCounts.get(r)}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── KRUHY ── */}
        <section className="space-y-10">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.roster[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BookOpen className="h-7 w-7 text-zion-gold" />
              {Copy.circlesTitle[cs ? 'cs' : 'en']}
            </h2>
          </div>

          {filtered.length === 0 && (
            <div className="zion-rainbow-card p-10 text-center text-gray-400" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              {Copy.noResults[cs ? 'cs' : 'en']}
            </div>
          )}

          {AVATAR_CIRCLES.map((circle) => {
            const list = byCircle.get(circle.key) ?? [];
            if (list.length === 0) return null;
            const note = CIRCLE_NOTES[circle.key];
            return (
              <motion.div
                key={circle.key}
                id={`circle-${circle.key}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                className="scroll-mt-32"
              >
                <div className="mb-4 flex flex-wrap items-baseline gap-3">
                  <h3 className="text-xl font-semibold text-white">
                    <span className="mr-2" aria-hidden>{circle.emoji}</span>
                    {circle[cs ? 'cs' : 'en']}
                  </h3>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-gray-400">
                    {list.length}
                  </span>
                  {note && <span className="text-xs italic text-gray-500">{note[cs ? 'cs' : 'en']}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {list.map((a) => <AvatarCard key={a.id} a={a} cs={cs} onOpen={() => setSelected(a)} />)}
                </div>
              </motion.div>
            );
          })}
        </section>

        {/* ── LINKS ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="zion-cta-banner"
        >
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={OASIS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
            >
              <Gamepad2 className="h-4 w-4" /> {Copy.enterOasis[cs ? 'cs' : 'en']}
            </a>
            <Link href="/l4-oasis" className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/30 bg-zion-gold/5 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-zion-gold/10 transition-colors">
              {Copy.moreAbout[cs ? 'cs' : 'en']} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/terranova" className="inline-flex items-center gap-2 rounded-2xl border border-zion-cyan/30 bg-zion-cyan/5 px-6 py-3 text-sm font-semibold text-cyan-200 hover:bg-zion-cyan/10 transition-colors">
              <BookOpen className="h-4 w-4" /> TerraNova Book
            </Link>
          </div>
        </motion.section>

      </div>

      {selected && <AvatarModal a={selected} cs={cs} onClose={() => setSelected(null)} />}
    </div>
  );
}
