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
 * Generováno z dávek 01–03 (74 modelů, TripoSR MC 320 + textura 2048, rig).
 */
export const AVATAR_MODELS: Record<number, string> = {
  0: '/models/avatars/0.glb',
  1: '/models/avatars/1.glb',
  2: '/models/avatars/2.glb',
  3: '/models/avatars/3.glb',
  4: '/models/avatars/4.glb',
  5: '/models/avatars/5.glb',
  6: '/models/avatars/6.glb',
  8: '/models/avatars/8.glb',
  9: '/models/avatars/9.glb',
  10: '/models/avatars/10.glb',
  11: '/models/avatars/11.glb',
  12: '/models/avatars/12.glb',
  13: '/models/avatars/13.glb',
  14: '/models/avatars/14.glb',
  15: '/models/avatars/15.glb',
  16: '/models/avatars/16.glb',
  17: '/models/avatars/17.glb',
  18: '/models/avatars/18.glb',
  19: '/models/avatars/19.glb',
  20: '/models/avatars/20.glb',
  21: '/models/avatars/21.glb',
  22: '/models/avatars/22.glb',
  23: '/models/avatars/23.glb',
  24: '/models/avatars/24.glb',
  25: '/models/avatars/25.glb',
  26: '/models/avatars/26.glb',
  27: '/models/avatars/27.glb',
  28: '/models/avatars/28.glb',
  29: '/models/avatars/29.glb',
  30: '/models/avatars/30.glb',
  31: '/models/avatars/31.glb',
  32: '/models/avatars/32.glb',
  33: '/models/avatars/33.glb',
  35: '/models/avatars/35.glb',
  36: '/models/avatars/36.glb',
  38: '/models/avatars/38.glb',
  39: '/models/avatars/39.glb',
  40: '/models/avatars/40.glb',
  41: '/models/avatars/41.glb',
  42: '/models/avatars/42.glb',
  43: '/models/avatars/43.glb',
  44: '/models/avatars/44.glb',
  45: '/models/avatars/45.glb',
  46: '/models/avatars/46.glb',
  47: '/models/avatars/47.glb',
  48: '/models/avatars/48.glb',
  50: '/models/avatars/50.glb',
  51: '/models/avatars/51.glb',
  52: '/models/avatars/52.glb',
  53: '/models/avatars/53.glb',
  54: '/models/avatars/54.glb',
  55: '/models/avatars/55.glb',
  56: '/models/avatars/56.glb',
  57: '/models/avatars/57.glb',
  58: '/models/avatars/58.glb',
  59: '/models/avatars/59.glb',
  60: '/models/avatars/60.glb',
  61: '/models/avatars/61.glb',
  62: '/models/avatars/62.glb',
  63: '/models/avatars/63.glb',
  64: '/models/avatars/64.glb',
  65: '/models/avatars/65.glb',
  66: '/models/avatars/66.glb',
  67: '/models/avatars/67.glb',
  68: '/models/avatars/68.glb',
  69: '/models/avatars/69.glb',
  70: '/models/avatars/70.glb',
  71: '/models/avatars/71.glb',
  72: '/models/avatars/72.glb',
  73: '/models/avatars/73.glb',
  74: '/models/avatars/74.glb',
  75: '/models/avatars/75.glb',
  76: '/models/avatars/76.glb',
  77: '/models/avatars/77.glb',
};

/** URL modelu pro dané ID, nebo `null` (→ proceduralní model). */
export function avatarModelUrl(id: number): string | null {
  return AVATAR_MODELS[id] ?? null;
}
