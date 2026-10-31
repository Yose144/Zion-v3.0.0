'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { TePikoOraScene, PikoLighting, PIKO_CAMERA, PIKO_CONTROLS } from '../../../../../shared/scenes/TePikoOra';

export default function TePikoOraPresentPage() {
  return (
    <ProjectPresentation
      title="TE PĪKO ORA"
      subtitle={{ cs: 'Raiatea · Francouzská Polynésie — koncept, ne stavba', en: 'Raiatea · French Polynesia — concept, not built' }}
      missionPath="/terranova/te-piko-ora"
      camera={PIKO_CAMERA}
      controls={PIKO_CONTROLS}
      sound="te-piko-ora"
      ambience="surf"
    >
      {(lang) => (
        <>
          <PikoLighting />
          <TePikoOraScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
