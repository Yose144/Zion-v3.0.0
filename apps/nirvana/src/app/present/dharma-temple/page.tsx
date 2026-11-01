'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { DharmaTempleScene, DharmaLighting, DHARMA_CAMERA, DHARMA_CONTROLS } from '../../../../../shared/scenes/DharmaTemple';

export default function DharmaTemplePresentPage() {
  return (
    <ProjectPresentation
      title="DHARMA TEMPLE"
      subtitle={{ cs: 'La Palma · Kanárské ostrovy — koncept, ne stavba', en: 'La Palma · Canary Islands — concept, not built' }}
      missionPath="/terranova/dharma-temple"
      camera={DHARMA_CAMERA}
      controls={DHARMA_CONTROLS}
      sound="dharma-temple"
      ambience="surf"
    >
      {(lang) => (
        <>
          <DharmaLighting />
          <DharmaTempleScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
