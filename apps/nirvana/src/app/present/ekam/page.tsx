'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { EkamScene, EkamLighting, EKAM_CAMERA, EKAM_CONTROLS } from '../../../../../shared/scenes/Ekam';

export default function EkamPresentPage() {
  return (
    <ProjectPresentation
      title="EKAM"
      subtitle={{ cs: 'Oneness Temple · Andhra Pradesh — postaveno 2008', en: 'Oneness Temple · Andhra Pradesh — built 2008' }}
      missionPath="/terranova/ekam"
      camera={EKAM_CAMERA}
      controls={EKAM_CONTROLS}
      sound="ekam"
    >
      {(lang) => (
        <>
          <EkamLighting />
          <EkamScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
