/**
 * Které avatary mají skutečný 3D model.
 *
 * Procedurální model (`body.ts`) zůstává **výchozí a záložní** cesta: když tu
 * ID není, nebo se GLB nepodaří načíst, hra kreslí proceduralní postavu a nic
 * se nerozbije. Proto se sem přidává jen model, který prošel revizí.
 *
 * Soubory leží v `public/models/avatars/<id>.glb` — prefix `/models` je
 * v `proxy.ts` veřejný (jinak loader dostane redirect na bránu a načte HTML).
 *
 * Generuje se ručně po schválení; `node scripts/ops/avatar-3d/…` zapisuje
 * modely do `.artifacts/avatar-3d/stage/` a sem se dostane jen vybraný kus.
 */
export const AVATAR_MODELS: Record<number, string> = {
  // 2026-11-07: pilot z výtvarného listu (dávka 01), 15k tris, 17 kloubů, idle.
  0: '/models/avatars/0.glb',
};

/** URL modelu pro dané ID, nebo `null` (→ proceduralní model). */
export function avatarModelUrl(id: number): string | null {
  return AVATAR_MODELS[id] ?? null;
}
