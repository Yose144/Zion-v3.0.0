'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { BodhiLankaScene, LankaLighting, LANKA_CAMERA, LANKA_CONTROLS } from '../../../../../shared/scenes/BodhiLanka';

export default function BodhiLankaPresentPage() {
  return (
    <ProjectPresentation
      title="BODHI LANKA"
      subtitle={{ cs: 'Akáša · Srí Lanka — živý strom, ne stavba', en: 'Akasha · Sri Lanka — a living tree, not a building' }}
      missionPath="/terranova/bodhi-lanka"
      camera={LANKA_CAMERA}
      controls={LANKA_CONTROLS}
      sound="bodhi-lanka"
    >
      {(lang) => (
        <>
          <LankaLighting />
          <BodhiLankaScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
