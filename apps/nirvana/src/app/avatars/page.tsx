'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useAuth } from '@/core/session/AuthProvider';
import { useI18n } from '@/core/i18n';
import { AVATARS, RAY_COLOR, RARITY_COLOR, type AvatarRay } from '@/core/avatars/catalog';
import { avatarLook, type BodyType } from '@/core/avatars/kit';
import { AvatarModel } from '@/core/avatars/AvatarModel';

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
      setNotice(cs ? 'Uloženo — ostatní tě uvidí takhle.' : 'Saved — this is what others will see.');
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
          <strong>{cs ? 'VYBER SI AVATARA' : 'CHOOSE YOUR AVATAR'}</strong>
          <span>
            {cs
              ? `· ${AVATARS.length} postav z OASIS rosteru`
              : `· ${AVATARS.length} figures from the OASIS roster`}
          </span>
        </div>
        <div className="avatars-head-actions">
          {user ? (
            <span className="avatars-who">
              {user.displayName ?? `${user.primaryAddress.slice(0, 10)}…`}
            </span>
          ) : (
            <a href="/#portal=account" className="avatars-signin">
              {cs ? 'Přihlásit' : 'Sign in'}
            </a>
          )}
          <Link href="/park" className="arena-link">
            {cs ? '← zpět na pouť' : '← back to the fair'}
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
              placeholder={cs ? 'Hledat jméno…' : 'Search name…'}
              aria-label={cs ? 'Hledat avatara' : 'Search avatar'}
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
                {value === 'all' ? (cs ? 'vše' : 'all') : value}
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
                  <i style={{ background: RAY_COLOR[avatar.ray] }} />
                  <span className="avatars-item-name">{avatar.name}</span>
                  <span className="avatars-item-meta" style={{ color: RARITY_COLOR[avatar.rarity] }}>
                    {avatar.rarity === 'OneOfOne' ? '1/1' : avatar.rarity}
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="avatars-empty">{cs ? 'Nic takového tu není.' : 'Nothing like that here.'}</li>
            )}
          </ul>
        </section>

        <section className="avatars-preview-pane">
          <div className="avatars-stage">
            <Canvas
              dpr={[1, 1.5]}
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
          </div>

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

          <div className="avatars-form">
            <label>
              <span>{cs ? 'Volací jméno' : 'Callsign'}</span>
              <input
                value={callsign}
                maxLength={24}
                onChange={(event) => {
                  setCallsign(event.target.value);
                  setSaved(false);
                }}
                placeholder={cs ? 'jak ti mají říkat' : 'what they call you'}
              />
            </label>

            <div className="avatars-row">
              <span>{cs ? 'Postava' : 'Body'}</span>
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
                    {value === 'slim' ? (cs ? 'hubená' : 'slim') : value === 'heavy' ? (cs ? 'statná' : 'heavy') : cs ? 'střední' : 'standard'}
                  </button>
                ))}
              </div>
            </div>

            <div className="avatars-row">
              <span>{cs ? 'Barva' : 'Colour'}</span>
              <div className="avatars-chips">
                <button
                  type="button"
                  className={`avatars-swatch${neon === '' ? ' is-active' : ''}`}
                  title={cs ? 'barva paprsku' : 'ray colour'}
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
                {saving ? (cs ? 'Ukládám…' : 'Saving…') : saved ? (cs ? 'Uloženo ✓' : 'Saved ✓') : cs ? 'Uložit avatara' : 'Save avatar'}
              </button>
              {notice && <p className={saved ? 'arena-notice' : 'avatars-error'}>{notice}</p>}
            </div>
          ) : (
            <p className="avatars-guest">
              {cs
                ? 'Host si může všechno prohlédnout, ale uložit avatara jde jen přihlášenému (ZIS).'
                : 'Guests can browse everything, but saving an avatar needs a signed-in ZIS account.'}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
