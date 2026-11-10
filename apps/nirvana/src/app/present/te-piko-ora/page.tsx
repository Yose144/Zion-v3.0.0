'use client';

import Link from 'next/link';
import { useI18n } from '@/core/i18n';
import { ProjectPresentation } from '@/core/scene/ProjectPresentation';
import { TePikoOraScene, PikoLighting, PIKO_CAMERA, PIKO_CONTROLS } from '../../../../../shared/scenes/TePikoOra';

export default function TePikoOraPresentPage() {
  const { lang } = useI18n();
  return (
    <ProjectPresentation
      title="TE PĪKO ORA"
      subtitle={{ cs: 'Raiatea · Francouzská Polynésie — koncept, ne stavba', en: 'Raiatea · French Polynesia — concept, not built' }}
      missionPath="/terranova/te-piko-ora"
      camera={PIKO_CAMERA}
      controls={PIKO_CONTROLS}
      sound="te-piko-ora"
      ambience="surf"
      overlay={
        // Koncept vede do hratelné verze: stejná laguna, ale s kánoí a surfem.
        <Link href="/piko" className="present-game-cta">
          <span aria-hidden>🛶</span>
          {lang === 'cs' ? 'Zahrát si lagunu' : 'Play the lagoon'}
        </Link>
      }
    >
      {(sceneLang) => (
        <>
          <PikoLighting />
          <TePikoOraScene lang={sceneLang} />
        </>
      )}
    </ProjectPresentation>
  );
}
