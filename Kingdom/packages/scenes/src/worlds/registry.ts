import type { ComponentType } from 'react';
import { AmentiLighting, AmentiScene, AMENTI_CAMERA, AMENTI_CONTROLS } from './Amenti';
import { BoaEsperancaLighting, BoaEsperancaScene, BOA_CAMERA, BOA_CONTROLS } from './BoaEsperanca';
import { BodhiLankaScene, LankaLighting, LANKA_CAMERA, LANKA_CONTROLS } from './BodhiLanka';
import { DharmaLighting, DharmaTempleScene, DHARMA_CAMERA, DHARMA_CONTROLS } from './DharmaTemple';
import { EkamLighting, EkamScene, EKAM_CAMERA, EKAM_CONTROLS } from './Ekam';
import { GenesisGardenLighting, GenesisGardenScene, GENESIS_CAMERA, GENESIS_CONTROLS } from './GenesisGarden';
import { BohemiaLighting, GoldenRepublicBohemiaScene, BOHEMIA_CAMERA, BOHEMIA_CONTROLS } from './GoldenRepublicBohemia';
import { KailashLighting, KailashScene, KAILASH_CAMERA, KAILASH_CONTROLS } from './Kailash';
import { LumiLighting, LumiStationScene, LUMI_CAMERA, LUMI_CONTROLS } from './LumiStation';
import { MariaDelCaminoScene, MariaLighting, MARIA_CAMERA, MARIA_CONTROLS } from './MariaDelCamino';
import { MatrixLighting, MatrixScene, MATRIX_CAMERA, MATRIX_CONTROLS } from './Matrix';
import { PikoLighting, TePikoOraScene, PIKO_CAMERA, PIKO_CONTROLS } from './TePikoOra';
import { UluruLighting, UluruScene, ULURU_CAMERA, ULURU_CONTROLS } from './Uluru';
import type { WorldControls } from './OrbitRig';

export type Lang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

export interface SceneCamera {
  position: [number, number, number];
  fov: number;
  far?: number;
}

export interface WorldEntry {
  id: string;
  scene: ComponentType<{ lang: Lang }>;
  lighting?: ComponentType;
  camera: SceneCamera;
  controls: WorldControls;
}

/**
 * Vazba katalogu (`@zion/world`) na komponenty. Katalog drží jen texty,
 * tenhle soubor drží renderer — serverové komponenty tak three nenačtou.
 */
export const WORLDS: WorldEntry[] = [
  { id: 'amenti', scene: AmentiScene, lighting: AmentiLighting, camera: AMENTI_CAMERA, controls: AMENTI_CONTROLS },
  { id: 'boa-esperanca', scene: BoaEsperancaScene, lighting: BoaEsperancaLighting, camera: BOA_CAMERA, controls: BOA_CONTROLS },
  { id: 'bodhi-lanka', scene: BodhiLankaScene, lighting: LankaLighting, camera: LANKA_CAMERA, controls: LANKA_CONTROLS },
  { id: 'dharma-temple', scene: DharmaTempleScene, lighting: DharmaLighting, camera: DHARMA_CAMERA, controls: DHARMA_CONTROLS },
  { id: 'ekam', scene: EkamScene, lighting: EkamLighting, camera: EKAM_CAMERA, controls: EKAM_CONTROLS },
  { id: 'genesis-garden', scene: GenesisGardenScene, lighting: GenesisGardenLighting, camera: GENESIS_CAMERA, controls: GENESIS_CONTROLS },
  { id: 'golden-republic-bohemia', scene: GoldenRepublicBohemiaScene, lighting: BohemiaLighting, camera: BOHEMIA_CAMERA, controls: BOHEMIA_CONTROLS },
  { id: 'kailash', scene: KailashScene, lighting: KailashLighting, camera: KAILASH_CAMERA, controls: KAILASH_CONTROLS },
  { id: 'lumi', scene: LumiStationScene as unknown as ComponentType<{ lang: Lang }>, lighting: LumiLighting, camera: LUMI_CAMERA, controls: LUMI_CONTROLS },
  { id: 'maria-del-camino', scene: MariaDelCaminoScene, lighting: MariaLighting, camera: MARIA_CAMERA, controls: MARIA_CONTROLS },
  { id: 'matrix', scene: MatrixScene as unknown as ComponentType<{ lang: Lang }>, lighting: MatrixLighting, camera: MATRIX_CAMERA, controls: MATRIX_CONTROLS },
  { id: 'te-piko-ora', scene: TePikoOraScene, lighting: PikoLighting, camera: PIKO_CAMERA, controls: PIKO_CONTROLS },
  { id: 'uluru', scene: UluruScene, lighting: UluruLighting, camera: ULURU_CAMERA, controls: ULURU_CONTROLS },
];

const byId = new Map(WORLDS.map((world) => [world.id, world]));

export function worldById(id: string): WorldEntry | undefined {
  return byId.get(id);
}
