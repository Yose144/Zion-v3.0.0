/**
 * Odvozené velikosti obrázků. Exporty v `public/images/lumi-b` mají
 * varianty `-200` (náhledy), `-640` (4:3 karty), `-700` (produkty)
 * a `-1280` (široké hero). Helper nikdy nepřidá druhou příponu.
 */
export type ImageWidth = 200 | 640 | 700 | 1280;

export function imageVariant(src: string, width: ImageWidth): string {
  if (!/\.webp$/i.test(src)) return src;
  if (/-\d+\.webp$/i.test(src)) return src;
  return src.replace(/\.webp$/i, `-${width}.webp`);
}
