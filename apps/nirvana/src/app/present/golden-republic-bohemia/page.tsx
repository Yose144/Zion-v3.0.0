'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { GoldenRepublicBohemiaScene, BohemiaLighting, BOHEMIA_CAMERA, BOHEMIA_CONTROLS } from '../../../../../shared/scenes/GoldenRepublicBohemia';

export default function GoldenRepublicBohemiaPresentPage() {
  return (
    <ProjectPresentation
      title="GOLDEN REPUBLIC BOHEMIA"
      subtitle={{ cs: 'Čechy · osa Říp — živý střed, ne stavba', en: 'Bohemia · Říp axis — living center, not built' }}
      missionPath="/terranova/golden-republic-bohemia"
      camera={BOHEMIA_CAMERA}
      controls={BOHEMIA_CONTROLS}
      sound="golden-republic-bohemia"
      ambience="wind"
    >
      {(lang) => (
        <>
          <BohemiaLighting />
          <GoldenRepublicBohemiaScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
