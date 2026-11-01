'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { MariaDelCaminoScene, MariaLighting, MARIA_CAMERA, MARIA_CONTROLS } from '../../../../../shared/scenes/MariaDelCamino';

export default function MariaDelCaminoPresentPage() {
  return (
    <ProjectPresentation
      title="MARÍA DEL CAMINO"
      subtitle={{ cs: 'Galicie · Tres Marias — tři lodě, tři oceány — plující uzel', en: 'Galicia · Tres Marias — three ships, three oceans — sailing node' }}
      missionPath="/terranova/maria-del-camino"
      camera={MARIA_CAMERA}
      controls={MARIA_CONTROLS}
      sound="maria-del-camino"
      ambience="surf"
    >
      {(lang) => (
        <>
          <MariaLighting />
          <MariaDelCaminoScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
