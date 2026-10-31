'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { BoaEsperancaScene, BoaEsperancaLighting, BOA_CAMERA, BOA_CONTROLS } from '../../../../../shared/scenes/BoaEsperanca';

export default function BoaEsperancaPresentPage() {
  return (
    <ProjectPresentation
      title="BOA ESPERANÇA"
      subtitle={{ cs: 'Mys Dobré naděje · šev dvou oceánů', en: 'Cape of Good Hope · seam of two oceans' }}
      missionPath="/terranova/boa-esperanca"
      camera={BOA_CAMERA}
      controls={BOA_CONTROLS}
      sound="boa-esperanca"
    >
      {(lang) => (
        <>
          <BoaEsperancaLighting />
          <BoaEsperancaScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
