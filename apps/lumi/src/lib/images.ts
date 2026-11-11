/**
 * Odvozené velikosti obrázků. Exporty v `public/images/lumi-b` mají
 * varianty `-200` (náhledy), `-640` (4:3 karty), `-700` (produkty)
 * a `-1280` (široké hero). Helper nikdy nepřidá druhou příponu.
 *
 * Motivy v `public/images/motifs/<slug>/` mají `-200`, `-400` a `-700`.
 */
export type ImageWidth = 200 | 400 | 640 | 700 | 1280;

export function imageVariant(src: string, width: ImageWidth): string {
  if (!/\.webp$/i.test(src)) return src;
  if (/-\d+\.webp$/i.test(src)) return src;
  return src.replace(/\.webp$/i, `-${width}.webp`);
}

/**
 * Jako `imageVariant`, ale **přepíše i existující** `-700` suffix.
 * Používá se tam, kde katalog odkazuje na plnou variantu (motivy stěn),
 * ale v kartě se má stáhnout jen malý náhled.
 */
export function imageVariantExact(src: string, width: ImageWidth): string {
  if (!/\.webp$/i.test(src)) return src;
  return src.replace(/-\d+\.webp$/i, '.webp').replace(/\.webp$/i, `-${width}.webp`);
}

/**
 * Má se obrázek oříznout (`cover`), nebo se vejít celý (`contain`)?
 *
 * Produktové rendery jsou čtvercové (1:1) a v 4:3 rámu by je `cover`
 * uřízl shora i zdola — přesně to schová horní otvor i podstavec.
 * Fotky scén jsou naopak širší, tam je `cover` správně.
 */
export function imageFit(width?: number, height?: number): 'cover' | 'contain' {
  if (!width || !height) return 'cover';
  const ratio = width / height;
  return ratio > 0.9 && ratio < 1.12 ? 'contain' : 'cover';
}
