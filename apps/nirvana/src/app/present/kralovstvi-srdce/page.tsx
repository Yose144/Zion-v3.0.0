'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import {
  ArkLighting,
  ARK_CAMERA,
  ARK_CONTROLS,
  KralovstviSrdceScene,
} from '../../../../../shared/scenes/KralovstviSrdce';

export default function KralovstviSrdcePresentPage() {
  return (
    <ProjectPresentation
      title="KRÁLOVSTVÍ SRDCE · NIRVANA"
      subtitle={{
        cs: 'Archa · třináctý uzel — pluje s keporkaky',
        en: 'The Ark · thirteenth node — sailing with humpback whales',
      }}
      missionPath="/terranova/kralovstvi-srdce"
      camera={ARK_CAMERA}
      controls={ARK_CONTROLS}
      ambience="surf"
    >
      {(lang) => (
        <>
          <ArkLighting />
          <KralovstviSrdceScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
