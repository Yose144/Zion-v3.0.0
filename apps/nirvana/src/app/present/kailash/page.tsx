'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { KailashScene, KailashLighting, KAILASH_CAMERA, KAILASH_CONTROLS } from '../../../../../shared/scenes/Kailash';

export default function KailashPresentPage() {
  return (
    <ProjectPresentation
      title="KAILASH"
      subtitle={{ cs: 'Posvátná hora · L5 spiritual center · Himálaje', en: 'Sacred mountain · L5 spiritual center · Himalaya' }}
      missionPath="/terranova/kailash"
      camera={KAILASH_CAMERA}
      controls={KAILASH_CONTROLS}
      sound="kailash"
      ambience="wind"
    >
      {(lang) => (
        <>
          <KailashLighting />
          <KailashScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
