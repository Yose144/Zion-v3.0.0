'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { LumiStationScene, LumiLighting, LUMI_CAMERA, LUMI_CONTROLS } from '../../../../../shared/scenes/LumiStation';

export default function NovaAmerikaPresentPage() {
  return (
    <ProjectPresentation
      title="LUMI · NOVÁ AMERIKA"
      subtitle={{ cs: 'Issobella L6 · Kostarika — výzkum & harmonie', en: 'Issobella L6 · Costa Rica — research & harmony' }}
      missionPath="/terranova/nova-amerika"
      camera={LUMI_CAMERA}
      controls={LUMI_CONTROLS}
      sound="nova-amerika"
    >
      {(lang) => (
        <>
          <LumiLighting />
          <LumiStationScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
