'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { HiranChat } from '@/core/hiran/HiranChat';
import { useI18n } from '@/core/i18n';
import { FREE_WORLD_MISSIONS } from '@/lib/freeworld-sites';
import {
  HIRAN_CAMERA,
  HIRAN_CONTROLS,
  HiranLighting,
  HiranScene,
  type HiranGate,
  type HiranSceneState,
} from '../../../../shared/scenes/Hiran';

/**
 * Třináct bran = třináct světů. Seznam je kanonický (`FREE_WORLD_MISSIONS`),
 * ne opsaný do scény — scéna dostává data, ne adresy.
 */
const GATES: HiranGate[] = FREE_WORLD_MISSIONS.filter((mission) => mission.present).map((mission) => ({
  key: mission.key,
  name: mission.name,
  present: mission.present,
}));

export default function HiranPresentPage() {
  const router = useRouter();
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<HiranSceneState>('idle');

  const enter = useCallback(
    (gate: HiranGate) => {
      if (gate.present) router.push(gate.present);
    },
    [router],
  );

  const overlay = (
    <>
      {open ? (
        <section className="present-hiran-panel" aria-label="Hiran">
          <header>
            <strong>Hiran</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label={cs ? 'Zavřít' : 'Close'}>
              ×
            </button>
          </header>
          <HiranChat state={state} onStateChange={setState} autoFocus={false} />
        </section>
      ) : (
        <button type="button" className="present-hiran-open" onClick={() => setOpen(true)}>
          {cs ? 'Zeptat se Hirana' : 'Ask Hiran'}
        </button>
      )}

      <nav
        className="present-hiran-gates"
        aria-label={cs ? 'Světy Království srdce' : 'Worlds of the Kingdom of Hearts'}
      >
        {GATES.map((gate) => (
          <button key={gate.key} type="button" onClick={() => enter(gate)}>
            {gate.name}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <ProjectPresentation
      title="HIRAN"
      subtitle={{
        cs: 'Hiranyagarbha · zlaté vejce a brány do světů',
        en: 'Hiranyagarbha · the golden womb and the gates',
      }}
      missionPath="/l3-hiran"
      camera={HIRAN_CAMERA}
      controls={HIRAN_CONTROLS}
      sound="hiran"
      ambience="temple"
      overlay={overlay}
    >
      {(sceneLang) => (
        <>
          <HiranLighting />
          <HiranScene
            lang={sceneLang}
            gates={GATES}
            state={state}
            onSelectGate={enter}
            onOrbClick={() => setOpen(true)}
          />
        </>
      )}
    </ProjectPresentation>
  );
}
