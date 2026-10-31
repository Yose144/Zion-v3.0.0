'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { UluruScene, UluruLighting, ULURU_CAMERA, ULURU_CONTROLS } from '../../../../../shared/scenes/Uluru';

export default function UluruPresentPage() {
  return (
    <ProjectPresentation
      title="ULURU"
      subtitle={{ cs: 'Tjukurpa · Songlines · Austrálie', en: 'Tjukurpa · Songlines · Australia' }}
      missionPath="/terranova/uluru"
      camera={ULURU_CAMERA}
      controls={ULURU_CONTROLS}
      sound="uluru"
    >
      {(lang) => (
        <>
          <UluruLighting />
          <UluruScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
