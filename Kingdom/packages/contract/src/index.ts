/**
 * @zion/contract — Portal Contract v1.
 *
 * Jediný zdroj pravdy pro tvar portálu. Portál deklaruje, co umí otevřít,
 * odkud čte a co (ne)píše. Nic víc. Implementace je v aplikaci, ne tady.
 */

export type Locale = 'cs' | 'en';

export interface LocalizedText {
  cs: string;
  en: string;
}

/** Služby, které Kingdom čte. Backendy zůstávají samostatné. */
export type ServiceId =
  | 'chain'
  | 'pool'
  | 'market'
  | 'oasis'
  | 'freeworld'
  | 'issobella'
  | 'hiran'
  | 'dao'
  | 'auth';

/** Úroveň ZIS, kterou portál vyžaduje. `none` = veřejné čtení. */
export type PortalAuth = 'none' | 'session' | 'sign';

export type WindowSize = 'sm' | 'md' | 'lg';

export interface WindowSpec {
  id: string;
  title: LocalizedText;
  size?: WindowSize;
}

/** Deklarované čtení. Jediná povolená cesta k datům. */
export interface EndpointSpec {
  /** lokální id v rámci manifestu, např. 'stats' */
  id: string;
  service: ServiceId;
  /** cesta na službě, vždy začíná '/' */
  path: string;
  /** TTL server-side cache v sekundách. Default 60. */
  cache?: number;
}

/** Deklarovaná mutace. V první vlně prázdné. */
export interface WriteIntent {
  id: string;
  title: LocalizedText;
  auth: Extract<PortalAuth, 'session' | 'sign'>;
  service: ServiceId;
  path: string;
}

export interface PortalManifest {
  /** stabilní id, zároveň název adresáře v src/portals/<id> */
  id: string;
  title: LocalizedText;
  /** jedna věta pro kartu v Místnosti */
  summary?: LocalizedText;
  /** klíč z registry ikon @zion/ui */
  icon: string;
  /** pořadí v liště a v Místnosti (menší = dřív). Default 999. */
  order?: number;
  /** vrstva ekosystému, čistě popisné (L1, L2, …) */
  layer?: string;
  /** pozice ve scéně světa */
  ring?: { x: number; z: number; hue: number };
  auth: PortalAuth;
  windows: WindowSpec[];
  reads: EndpointSpec[];
  writes?: WriteIntent[];
  /** 'live' = má data, 'placeholder' = jen přizná, že ještě není */
  status: 'live' | 'placeholder';
}

/** Identitní helper — dává portálům typovou kontrolu manifestu. */
export function definePortal(manifest: PortalManifest): PortalManifest {
  return manifest;
}

/** Najde deklarované čtení podle id. Vyhodí, když manifest lže. */
export function readSpec(manifest: PortalManifest, id: string): EndpointSpec {
  const spec = manifest.reads.find((r) => r.id === id);
  if (!spec) {
    throw new Error(`Portal "${manifest.id}" nemá deklarované čtení "${id}"`);
  }
  return spec;
}

/** Lokalizovaný text s fallbackem na cs. */
export function text(value: LocalizedText, locale: Locale): string {
  return value[locale] ?? value.cs;
}
