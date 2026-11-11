const paths = new Set([
  "/shop/img/products/book-001_kralovstvi-srdce.webp",
  "/shop/img/products/zion-pass-001_zion-pass.webp",
  "/shop/img/products/lamp-001_lumi-2.webp",
  "/shop/img/products/wood-003_pergola.webp",
  "/shop/img/products/wood-004_domek-na-strome.webp",
  "/shop/img/products/star-001_a-wing.webp",
  "/shop/img/products/star-002_b-wing.webp",
  "/shop/img/products/star-003_x-wing.webp",
  "/shop/img/products/star-004_ikaruga.webp",
  "/shop/img/products/star-005_snowspeeder.webp",
  "/shop/img/products/star-006_tie-fighter.webp",
  "/shop/img/products/star-007_tie-interceptor.webp",
  "/shop/img/products/star-008_millennium-falcon.webp",
  "/shop/img/products/engr-001_gravirovani-loga.webp",
  "/shop/img/products/engr-002_gravirovana-fotografie.webp",
  "/shop/img/products/engr-003_qr-vizitka.webp",
  "/shop/img/products/digi-001_web-konzultace.webp",
  "/shop/img/products/digi-002_onepage-web.webp",
  "/shop/img/products/digi-003_eshop-reseni.webp",
  "/shop/img/products/digi-004_fullstack-aplikace.webp",
  "/shop/img/products/soft-002_dao-pool-license.webp",
  "/shop/img/products/soft-003_rtx-5060-miner-oasis.webp",
  "/shop/img/products/soft-001_miner-pro-desktop.webp"
]);
export function designImage(src: string | undefined): string | undefined {
  if (!src) return src;
  const path = src.split('?')[0].replace(/^https:\/\/market\.zionterranova\.com/, '');
  return paths.has(path) ? `${path}?v=engine-v1` : src;
}
