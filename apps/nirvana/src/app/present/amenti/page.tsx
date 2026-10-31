'use client';

import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { AmentiScene, AmentiLighting, AMENTI_CAMERA, AMENTI_CONTROLS } from '../../../../../shared/scenes/Amenti';

export default function AmentiPresentPage() {
  return (
    <ProjectPresentation
      title="AMENTI · GIZA"
      subtitle={{ cs: 'Síň záznamů · Egypt — kde civilizace psala příběh', en: 'Hall of records · Egypt — where civilisation wrote its story' }}
      missionPath="/terranova/amenti"
      camera={AMENTI_CAMERA}
      controls={AMENTI_CONTROLS}
      sound="amenti"
    >
      {(lang) => (
        <>
          <AmentiLighting />
          <AmentiScene lang={lang} />
        </>
      )}
    </ProjectPresentation>
  );
}
