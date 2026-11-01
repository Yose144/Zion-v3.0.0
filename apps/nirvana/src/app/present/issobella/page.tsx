'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import {
  IssobellaScene,
  IssobellaLighting,
  ISSOBELLA_CAMERA,
  ISSOBELLA_CONTROLS,
  type IssobellaAvatar,
} from '@/core/scene/projects/Issobella';
import { AVATARS, RAY_COLOR } from '@/core/avatars/catalog';
import { useAuth } from '@/core/session/AuthProvider';
import { useI18n } from '@/core/i18n';

/**
 * ISSOBELLA — orbitální observatoř se šatníkem.
 *
 * Scéna je sdílená (`apps/shared/scenes/Issobella.tsx`), takže sem nepatří
 * geometrie — jen UI: výběr avatara, uložení do ZIS a odkaz na plný roster.
 * Vybrat jde z dvanácti výklenků; kdo chce všech 200, jde na `/avatars`.
 */

const CURATED = AVATARS.slice(0, 12);

export default function IssobellaPresentPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const cs = lang === 'cs';

  const stored = user?.avatar3d?.avatarId;
  const [selected, setSelected] = useState<number>(() =>
    typeof stored === 'number' ? stored : CURATED[0]!.id,
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const urns = useMemo<IssobellaAvatar[]>(
    () =>
      CURATED.map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        color: RAY_COLOR[avatar.ray],
      })),
    [],
  );

  const entry = AVATARS.find((avatar) => avatar.id === selected) ?? CURATED[0]!;

  const save = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatar3d: { avatarId: selected } }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setNotice(cs ? 'Uloženo — tenhle avatar uvidíš ve hře.' : 'Saved — this avatar shows up in game.');
    } catch (error) {
      setNotice(cs ? `Uložení selhalo (${String(error)}).` : `Save failed (${String(error)}).`);
    } finally {
      setSaving(false);
    }
  }, [user, selected, cs]);

  return (
    <ProjectPresentation
      title="ISSOBELLA"
      subtitle={{
        cs: 'Orbitální observatoř · L6 · šatník OASIS',
        en: 'Orbital observatory · L6 · OASIS wardrobe',
      }}
      missionPath="/l6-issobella"
      camera={ISSOBELLA_CAMERA}
      controls={ISSOBELLA_CONTROLS}
      ambience="space"
      overlay={
        <aside className="isso-panel">
          <header>
            <strong>{cs ? 'ŠATNÍK' : 'WARDROBE'}</strong>
            <span>
              {entry.name} · {entry.ray}
            </span>
          </header>
          <p>
            {cs
              ? 'Klikni na kouli u výklenku. Uloží se to do ZIS a ve hře tě tak uvidí ostatní.'
              : 'Click an orb at a niche. It saves to ZIS and other players see you like that.'}
          </p>
          {user ? (
            <div className="isso-actions">
              <button type="button" className="park-btn" onClick={() => void save()} disabled={saving}>
                {saving ? (cs ? 'Ukládám…' : 'Saving…') : cs ? 'Uložit avatara' : 'Save avatar'}
              </button>
              <Link href="/avatars" className="arena-link">
                {cs ? `všech ${AVATARS.length} →` : `all ${AVATARS.length} →`}
              </Link>
            </div>
          ) : (
            <p className="isso-guest">
              {cs ? 'Uložit jde jen přihlášenému — ' : 'Saving needs a signed-in account — '}
              <a href="/#portal=account">{cs ? 'přihlásit' : 'sign in'}</a>
            </p>
          )}
          {notice && <p className="arena-notice">{notice}</p>}
        </aside>
      }
    >
      {(sceneLang) => (
        <>
          <IssobellaLighting />
          <IssobellaScene
            lang={sceneLang}
            avatars={urns}
            selectedId={selected}
            onSelectAvatar={setSelected}
          />
        </>
      )}
    </ProjectPresentation>
  );
}
