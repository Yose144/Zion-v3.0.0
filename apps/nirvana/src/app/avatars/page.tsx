'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useAuth } from '@/core/session/AuthProvider';
import { fill, tx, useI18n } from '@/core/i18n';
import { AVATARS, RAY_COLOR, RARITY_COLOR, type AvatarRay } from '@/core/avatars/catalog';
import { avatarLook, type BodyType } from '@/core/avatars/kit';
import { AvatarModel } from '@/core/avatars/AvatarModel';
import { canvasDpr } from '@/core/design/dpr';
import { AVATARS_COPY, type AvatarsCopyKey } from './copy';

/**
 * VÝBĚR AVATARA — všech 200 z OASIS rosteru.
 *
 * Vlevo seznam (filtr podle paprsku, hledání), vpravo 3D náhled a uložení.
 * Ukládá se do ZIS (`avatar3d.avatarId` + callsign + tělo + barva), takže
 * stejný avatar pak vidí ostatní hráči ve hře.
 *
 * Host si může všechno prohlédnout, ale neuložit — bez přihlášení není
 * komu to uložit.
 */

const RAYS: (AvatarRay | 'all')[] = [
  'all',
  'Blue',
  'Pink',
  'Yellow',
  'Violet',
  'AllRays',
  'White',
  'Green',
  'RubyGold',
  'Obsidian',
];

const BODIES: BodyType[] = ['slim', 'standard', 'heavy'];

const NEON = ['#4a7bff', '#ff6ec7', '#ffd166', '#9333ea', '#10b981', '#e8b23a'];

export default function AvatarsPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  /** Texty obrazovky jdou přes `./copy` — žádné `cs ? :` v JSX. */
  const l = useCallback(
    (key: AvatarsCopyKey, values?: Record<string, string | number>) => {
      const text = tx(AVATARS_COPY[key], lang);
      return values ? fill(text, values) : text;
    },
    [lang],
  );
  const cs = lang === 'cs';

  const [selected, setSelected] = useState<number>(1);
  const [callsign, setCallsign] = useState('');
  const [body, setBody] = useState<BodyType>('standard');
  const [neon, setNeon] = useState<string>('');
  const [ray, setRay] = useState<AvatarRay | 'all'>('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // načíst, co má hráč uložené v ZIS
  useEffect(() => {
    const stored = user?.avatar3d;
    if (!stored) return;
    if (typeof stored.avatarId === 'number') setSelected(stored.avatarId);
    if (stored.callsign) setCallsign(stored.callsign);
    if (stored.bodyType) setBody(stored.bodyType);
    if (stored.neonColor) setNeon(stored.neonColor);
  }, [user?.avatar3d]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return AVATARS.filter((avatar) => {
      if (ray !== 'all' && avatar.ray !== ray) return false;
      if (!needle) return true;
      return (
        avatar.name.toLowerCase().includes(needle) ||
        avatar.subtitle.toLowerCase().includes(needle)
      );
    });
  }, [ray, query]);

  const entry = AVATARS.find((avatar) => avatar.id === selected) ?? AVATARS[0]!;
  const look = useMemo(
    () => avatarLook(selected, { bodyType: body, neonColor: neon || undefined }),
    [selected, body, neon],
  );

  async function save() {
    if (!user) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          avatar3d: {
            avatarId: selected,
            callsign: callsign.trim() ? callsign.trim().slice(0, 24) : undefined,
            bodyType: body,
            neonColor: neon || undefined,
          },
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setSaved(true);
      setNotice(l('saved'));
    } catch (error) {
      setNotice(
        cs
          ? `Uložení selhalo (${String(error)}). Zkus to znovu.`
          : `Save failed (${String(error)}). Try again.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="avatars">
      <header className="avatars-head">
        <div>
          <strong>{l('title')}</strong>
          <span>
            {l('roster', { n: AVATARS.length })}
          </span>
        </div>
        <div className="avatars-head-actions">
          {user ? (
            <span className="avatars-who">
              {user.displayName ?? `${user.primaryAddress.slice(0, 10)}…`}
            </span>
          ) : (
            <a href="/#portal=account" className="avatars-signin">
              {l('signIn')}
            </a>
          )}
          <Link href="/park" className="arena-link">
            {l('backToFair')}
          </Link>
        </div>
      </header>

      <div className="avatars-body">
        <section className="avatars-list-pane">
          <div className="avatars-filters">
            <input
              className="avatars-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={l('search')}
              aria-label={l('searchAria')}
            />
          </div>
          <div className="avatars-rays">
            {RAYS.map((value) => (
              <button
                key={value}
                type="button"
                className={`avatars-ray${ray === value ? ' is-active' : ''}`}
                style={value === 'all' ? undefined : { borderColor: RAY_COLOR[value], color: RAY_COLOR[value] }}
                onClick={() => setRay(value)}
              >
                {value === 'all' ? (l('all')) : value}
              </button>
            ))}
          </div>

          <ul className="avatars-items">
            {list.map((avatar) => (
              <li key={avatar.id}>
                <button
                  type="button"
                  className={`avatars-item${avatar.id === selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    setSelected(avatar.id);
                    setSaved(false);
                  }}
                >
                  <span className="avatars-item-portrait" style={{ borderColor: RAY_COLOR[avatar.ray] }}>
                    {avatar.portrait ? (
                      <img src={avatar.portrait} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <i style={{ background: RAY_COLOR[avatar.ray] }} />
                    )}
                  </span>
                  <span className="avatars-item-name">{avatar.name}</span>
                  <span className="avatars-item-meta" style={{ color: RARITY_COLOR[avatar.rarity] }}>
                    {avatar.rarity === 'OneOfOne' ? '1/1' : avatar.rarity}
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="avatars-empty">{l('empty')}</li>
            )}
          </ul>
        </section>

        <section className="avatars-preview-pane">
          <div className="avatars-stage">
            <Canvas
              dpr={canvasDpr(1.5)}
              camera={{ position: [0, 1.15, 3.5], fov: 36, near: 0.1, far: 50 }}
              gl={{ antialias: true, alpha: true }}
              // kamera musí mířit na hrudník, ne na počátek — jinak je hlava z záběru
              onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}
            >
              <ambientLight intensity={1.1} color="#e8dcff" />
              <directionalLight position={[2, 4, 3]} intensity={2.2} color="#ffd9b0" />
              <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#7fe3d4" />
              <AvatarModel look={look} animate />
            </Canvas>
            <span className="avatars-stage-label">{l('stageLabel')}</span>
          </div>

          <div className="avatars-identity">
            {entry.portrait ? (
              <figure className="avatars-portrait">
                <img
                  src={entry.portrait}
                  alt={`${entry.name} — ${l('portraitLabel')}`}
                  loading="eager"
                  decoding="async"
                />
                <figcaption>{l('portraitLabel')}</figcaption>
              </figure>
            ) : null}
            <div className="avatars-meta">
              <h2>{entry.name}</h2>
              <p className="avatars-sub">{entry.subtitle}</p>
              <p className="avatars-tags">
                <span style={{ color: RAY_COLOR[entry.ray] }}>{entry.ray}</span>
                <span style={{ color: RARITY_COLOR[entry.rarity] }}>
                  {entry.rarity === 'OneOfOne' ? '1/1' : entry.rarity}
                </span>
                <span>CL {entry.cl}</span>
              </p>
            </div>
          </div>

          <div className="avatars-form">
            <label>
              <span>{l('callsign')}</span>
              <input
                value={callsign}
                maxLength={24}
                onChange={(event) => {
                  setCallsign(event.target.value);
                  setSaved(false);
                }}
                placeholder={l('callsignHint')}
              />
            </label>

            <div className="avatars-row">
              <span>{l('body')}</span>
              <div className="avatars-chips">
                {BODIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`avatars-chip${body === value ? ' is-active' : ''}`}
                    onClick={() => {
                      setBody(value);
                      setSaved(false);
                    }}
                  >
                    {value === 'slim' ? (l('bodySlim')) : value === 'heavy' ? (l('bodyHeavy')) : l('bodyStandard')}
                  </button>
                ))}
              </div>
            </div>

            <div className="avatars-row">
              <span>{l('colour')}</span>
              <div className="avatars-chips">
                <button
                  type="button"
                  className={`avatars-swatch${neon === '' ? ' is-active' : ''}`}
                  title={l('rayColour')}
                  onClick={() => {
                    setNeon('');
                    setSaved(false);
                  }}
                >
                  ✦
                </button>
                {NEON.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`avatars-swatch${neon === color ? ' is-active' : ''}`}
                    style={{ background: color }}
                    aria-label={color}
                    onClick={() => {
                      setNeon(color);
                      setSaved(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {user ? (
            <div className="avatars-actions">
              <button type="button" className="park-btn" onClick={() => void save()} disabled={saving}>
                {saving ? (l('saving')) : saved ? (l('savedShort')) : l('save')}
              </button>
              {notice && <p className={saved ? 'arena-notice' : 'avatars-error'}>{notice}</p>}
            </div>
          ) : (
            <p className="avatars-guest">
              {l('guestNote')}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
