'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { GenesisGardenScene, GenesisGardenLighting, GENESIS_CAMERA, GENESIS_CONTROLS } from '../../../../../shared/scenes/GenesisGarden';

export default function GenesisGardenPresentPage() {
  return (
    <ProjectPresentation
      title="GENESIS GARDEN"
      subtitle={{ cs: 'Sabacheira · Tomar · Portugalsko — koncept, ne stavba', en: 'Sabacheira · Tomar · Portugal — concept, not built' }}
      missionPath="/terranova/genesis"
      camera={GENESIS_CAMERA}
      controls={GENESIS_CONTROLS}
      sound="genesis-garden"
    >
      {(lang) => (
        <>
          <GenesisGardenLighting />
          <GenesisGardenScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
