'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import {
  NebeskaFlotilaLighting,
  NebeskaFlotilaScene,
  NEBESKA_CAMERA,
  NEBESKA_CONTROLS,
} from '../../../../../shared/scenes/NebeskaFlotila';

export default function NebeskaFlotilaPresentPage() {
  return (
    <ProjectPresentation
      title="NABUKANO · NEBESKÁ FLOTILA"
      subtitle={{
        cs: 'Čtyři trupy · jeden dok · jedna osa — mezi LUMI a Issobellou',
        en: 'Four hulls · one dock · one axis — between LUMI and Issobella',
      }}
      missionPath="/terranova/nabukano"
      camera={NEBESKA_CAMERA}
      controls={NEBESKA_CONTROLS}
      ambience="space"
    >
      {(lang) => (
        <>
          <NebeskaFlotilaLighting />
          <NebeskaFlotilaScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
