# REPORT 2026-11-11 — Engine B: obnova vizuální vrstvy Marketu/Appky + Lumi hero a časová osa ZION

> **Datum:** 2026-11-11 · **Režim:** kód + assety + deploy (market.zionterranova.com) + dokumentace
> **Zadání 👤:** „`heros/shop/heros/ZION_Market_Hero_Timeline_pro_AI` doladime market" → následně **„pockej! proc si nezachoval engine B! viz `heros/shop/Lumi`"**
> **Výsledek:** Engine B obnoven v `main` (`60376ddfd`), nová práce postavená na něm (`fa9ad526d`), nasazeno a ověřeno živě.
> **Commity:** `60376ddfd`, `fa9ad526d`, `cb5a82041` · **Pushnuto:** `main` = `cb5a82041`

---

## 1. Co je Engine B

**`ZION_Design_Engine_v1.0` — „ZION B / Manga"**: balíček `heros/engine/ZION_Design_Engine_v1.0_KOMPLET/` (190 souborů, 85,7 MB, 117 WebP) = **obrazová vrstva Marketu a Appky**.

| Vrstva | Co obsahuje |
|---|---|
| Assety | 23 katalogových produktů, 19 míst produktových detailů a galerií, 21 hero obrazů Appky, mobilní deriváty (`-m`), hero Marketu `carpenter-workshop.webp` + `-m.webp` (960×540), dvě znakové vrstvy (`evoluzion-2008.jpeg`, `keporkak-original.png`) |
| Kód Marketu | `sections/HeroSection.module.css` (rám karty — zlaté boky, červený horní a zelený dolní okraj, `max-width: 70rem`, akce s `h1 "ZION Market"` a podpisem) + `sections/HeroSection.tsx` (art se `srcSet` 960w/1672w, `sizes`) + `lib/design-image.ts` (23 cest → `?v=engine-v1`) |
| Kód Appky | `website-v2.9/src/components/Hero.module.css`, `Hero.tsx`, `HeroSlider.tsx` + 93 souborů |
| Balíček | `README.md`, `QUICK_UPGRADE.md` (postup aplikace), `MAPOVANI.csv` (přesné cíle), `code.patch`, `source/apps/…`, `AI/START_HERE.md`, `SHA256SUMS.txt` |

Konzumenti `designImage()`: `cart/page.tsx`, `sections/ChristmasEdition.tsx`, `shop/ShopProductCard.tsx`, `shop/ShopProductModal.tsx`, `xmas/XmasProductPage.tsx` a data `shopProducts.ts` / `christmasProducts.ts` / `shopNews.ts`.

## 2. Incident — proč Engine B zmizel

`3e82f7499 „chore: sync stromu — engine B vizuální upgrade…"` vznikl **11. 11. 07:40 na paralelní linii, která není v `main`** (`git merge-base --is-ancestor 3e82f7499 HEAD` → 1), ale **běžel na produkci**.

Deploy Marketu z `main` (můj first-pass) ho proto přepsal:

- zmizel `apps/MarketPlace/src/components/sections/HeroSection.module.css` a `src/lib/design-image.ts`,
- zmizely `apps/MarketPlace/public/images/design-v1/*` (carpenter-workshop ± m, evoluzion, keporkak),
- ~100 upgradovaných WebP (produkty, vánoční galerie, hero Appky) se vrátilo na starší verze,
- `apps/website-v2.9` Engine B **na produkci pořád měl**, ale repo `main` ne → jeho příští deploy by ho smazal taky.

Signál v produkci: `next start` běžel, stránky 200, ale hero neměl rám ani `h1` a produkty neměly `?v=engine-v1`.

## 3. Oprava

`60376ddfd` = **přesná obnova obsahu `3e82f7499`** pro tři stromy, bez mazání a bez force:

```bash
git checkout 3e82f7499 -- apps/MarketPlace apps/website-v2.9 heros/engine
# 347 souborů: MarketPlace 64, website-v2.9 93, heros/engine 190
```

## 4. Nová práce postavená NA Engine B (`fa9ad526d`)

**Hero** — Engine B struktura zůstala, změnil se jen art:

- `public/images/design-v1/lumi-kralovstvi-srdce.webp` (1672×941, byte-identical se schváleným podkladem),
- `…-m.webp` **960×540** (nový derivát) → `srcSet="…-m 960w, … 1672w"` + `sizes` z Engine B zůstaly funkční; na 390 px prohlížeč skutečně vybírá `-m` (ověřeno přes `currentSrc`),
- `alt` dle zadání („Lumi – Království Srdce. Tesař, Lumi a Malý princ…"), `fetchpriority=high`, `width`/`height`, `decoding=async`.

**Časová osa** — nová sekce `TimelineSection` hned pod hero a před novinky:

- `public/images/design-v1/zion-timeline-2008-2040.webp` (2172×724, `loading=lazy`), zarovnaná na **70 rem** jako hero karta,
- devět milníků je vypálených v ilustraci → doplněn jen **textový ekvivalent** (`sr-only <ol>`, `aria-describedby`),
- posuvná oblast `role=region`, `aria-label` „Časová osa ZION TerraNova", `tabIndex=0` (šipky/PageDown), na mobilu `70rem` šířky uvnitř `overflow-x: auto` → stránka jako celek nescrolluje,
- nápověda k posunu jen na mobilu.

**Překlady:** `hero.artAlt` + sekce `timeline` (`cs`, `en`; fallback pro `es/pt/fr`).

**Vedlejší fix:** `FeaturedSection` hlavička neměla `flex-wrap` → na 320 px přetékala o 38 px a stránka se dala vodorovně posunout.

## 5. Ověření

| Krok | Výsledek |
|---|---|
| `npx tsc --noEmit` (MarketPlace) | 0 chyb |
| `npm run build` | OK (38/38 statických stránek) |
| Headless Chromium (desktop 1440 / mobil 390 / EN) — lokálně i **proti produkci** | **81/81 PASS** — Engine B rám/h1/podpis, výběr mobilního derivátu, obě CTA reálně prokliknuté, 9 milníků, klávesová dostupnost, 0 rozbitých obrázků, 0 JS chyb |
| Vodorovný přesah stránky (320/375/768/1024/1920 px) | 0 px |
| Deploy smoke (`deploy-marketplace.sh`) | `:3100=200`, `live=200`, `static=200`, `/api/health healthy`, download 206 |
| Produkce: Engine B assety | `lumi-kralovstvi-srdce{,-m}`, `zion-timeline-2008-2040`, `carpenter-workshop`, `evoluzion-2008`, `keporkak-original`, `lamp-001?lumi-2?v=engine-v1` → **vše 200** |

Skripty a screenshoty: `/tmp/opencode/mp-engb-check.mjs`, `/tmp/opencode/mp-shots-engb-live/`.

## 6. Pravidla, která z toho plynou

1. **Engine B = produkční pravda** pro Market a Appku. Deploy z tree bez `HeroSection.module.css`, `lib/design-image.ts` a `public/images/design-v1/` je regrese.
2. **Paralelní session musí commitovat do `main`.** Commit, který existuje jen na vedlejší linii a přitom je na produkci, je neviditelná past. Při podezření: `git merge-base --is-ancestor <prod-commit> HEAD` a `git log --all -S "<řetězec>"`.
3. **`heros/` je zdroj pravdy pro vizuály.** Nové dílo se ukládá tam a do `apps/*/public/` jde s `?v=` verzí; nasazení na existující názvy cest drží `heros/shop/Lumi/NASAZENI.md`.
4. **Při upgradu enginu** aplikuj `code.patch` / slučuj podle `source/apps/…` — nikdy nepřepisuj celé zdrojáky naslepo (`QUICK_UPGRADE.md`).

## 7. Otevřené body

- Appka (`website-v2.9`) má Engine B v repu i na produkci — **deploy Appky v této session neproběhl** (nebyl potřeba; produkce byla celou dobu správně).
- Nový hero art a časová osa jsou pouze v `market`. Pokud se mají propsat i do Appky (`images/home/christmas-kingdom*.webp`), je to samostatné rozhodnutí 👤 — balíček `heros/shop/Lumi/ZION_Hero_Lumi_2_WebP/NASAZENI.md` mapuje, které soubory na kterých doménách drží stejný obraz.
- `carpenter-workshop.webp` už v hero není, ale zůstává v `public/images/design-v1/` (Engine B asset; může se hodit pro Appku nebo jiné plochy).
