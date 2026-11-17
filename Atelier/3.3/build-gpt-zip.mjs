#!/usr/bin/env node
/**
 * build-gpt-zip.mjs — ZIP pro ChatGPT: PROMPT.txt + pozadavky.txt + logo/.
 *
 * Zdroj:
 *   - PROMPT: `Atelier/3.3/gpt/00-CELY-PAKET-GPT.md` (generuje engine-b/build-briefs.mjs)
 *   - logo:   `3.3.0/design/brand/{logo,current}` + originál `docs/LogoNew.jpg`
 *
 * Proč logo v ZIPu: GPT musí vidět **přesný tvar značky**. Bez předlohy si
 * vymyslí vlastní erb nebo iniciály, a to je nejčastější vada ilustrací.
 *
 * Použití: node Atelier/3.3/build-gpt-zip.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../.."); // workspace root (Zion-v3.0.0)
const THREE = path.join(ROOT, "3.3.0");
const sharp = require(path.join(ROOT, "node_modules/sharp"));

const NAME = "ZION-33-Engine-B-GPT";
const PKG = path.join(HERE, NAME);
const ZIP = path.join(HERE, `${NAME}.zip`);

const BRAND = path.join(HERE, "brand-mark.md");

/* ---------- zdroje značky ---------- */

const ORIGINAL = path.join(ROOT, "docs/LogoNew.jpg"); // zlatý medailon Z-stromu (originál)
const RASTA = path.join(ROOT, "canon/brand/ZionLogo.png"); // rasta varianta (má "AI" odznak v rohu)
const ENGINE_B = path.join(THREE, "design/brand/logo"); // Engine B značka (flat/seal/lockup)
const Z_TREE = path.join(THREE, "design/brand/current"); // koncept v1 (zlatý glyph + wordmark)

/* ---------- příprava ---------- */

const source = fs.readFileSync(path.join(HERE, "gpt/00-CELY-PAKET-GPT.md"), "utf8");
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "engine-b/assets.json"), "utf8"));

const BRAND_SECTION = `
# ZNAČKA (brand mark) — povinné pravidlo

Oficiální znak ZIONu je **Z vyrostlé ze stromu**: písmeno Z, jehož horní břevno
se rozpadá do koruny listů a spodní břevno do kořenů. Uvnitř zlatého kruhu
(medailon) je to hlavní podoba značky; jednobarevný tvar je její zjednodušení.

- **Předlohy máš přiložené** ve složce \`logo/\`. Drž se jich. Nekresli vlastní
  verzi, nepiš iniciály, nevytvářej erby, pečeti ani vlajky s písmeny.
- Když má být v obraze symbol (vyražená pečeť, prapor, desky knihy, dno lucerny,
  štítek), použij **přesně tento tvar** — Z s korunou a kořeny. Pro malé plochy
  použij jednobarevnou variantu (\`logo/engine-b-glyph.svg\`).
- Značku **nepřidávej tam, kde o ni zadání nemluví**. Ilustrace není plakát
  s logem; značka patří jen na předměty, které ji v příběhu nesou.
- Nikdy ji nedávej doprostřed text-safe zóny (levá třetina) a nikdy přes tvář.
- Barvy značky: zlato (${"`#D9B44A`"} / ${"`#E7AA4B`"}) na tmavém, inkoust
  (${"`#101C2B`"}) na světlém. Nikdy neon, nikdy duha přes celý znak.
`;

const prompt = [
  "Vygeneruj všech 15 obrázků podle zadání níže.",
  "Když to v jednom běhu nejde, udělej to po dávkách 6, 7, 8 — nic nevynechávej.",
  BRAND_SECTION.trim(),
  "",
  source.trim(),
  "",
].join("\n");

const checklist = spec.assets
  .map((a) => `${a.id} | ${a.aspect} | ${a.master.width}x${a.master.height} | ${a.id}__master.png`)
  .join("\n");

const BRAND_RULES = `# Značka ZION — pravidla pro ilustrátora

## Co je oficiální znak

**Z vyrostlé ze stromu.** Písmeno Z, jehož horní břevno se rozpadá do koruny
listů, spodní břevno do kořenů. Dvě podoby:

| Soubor | Co to je | Kdy použít |
|---|---|---|
| \`logo/original-medallion-1024.jpg\` | zlatý medailon: Z-strom v kruhu, reliéf | hlavní značka v obraze — pečeť, mince, desky knihy, prapor |
| \`logo/original-medallion-512.jpg\` | totéž menší | drobné předměty |
| \`logo/original-rasta-1024.jpg\` | rasta varianta (zelená/žlutá/červená) | jen když má být znak barevně „rasta“; nepoužívat jako dekoraci všude |
| \`logo/engine-b-glyph.svg\` | jednobarevný tvar Z-stromu (pergamen/inkoust) | malé plochy, gravírování, řez do dřeva, razítko |
| \`logo/engine-b-seal.svg\` | stejný tvar v prstenci | pečetidlo, štítek |
| \`logo/engine-b-lockup.png\` | znak + „ZION TERRA NOVA“ | nepoužívej v ilustracích (je to pro web/tisk) |

Náhled všech podob: \`logo/prehled.png\`.

## Pravidla

1. **Nekresli vlastní verzi.** Vždy vyjdi z přiloženého tvaru (Z + koruna + kořeny).
2. **Žádná písmena navíc.** Není „ZION“ v obraze, nejsou iniciály, nejsou nápisy
   na praporech, deskách ani pečetích.
3. **Žádné nové erby.** Když má být symbol, je to tenhle znak — ne vymyšlený.
4. **Umístění:** jen na předměty, které ho v příběhu nesou (pečeť, mince, kniha,
   prapor, lucerna). Nikdy doprostřed levé třetiny, nikdy přes tvář.
5. **Barva:** zlato #D9B44A nebo #E7AA4B na tmavém, inkoust #101C2B na světlém.
   Žádný neon, žádné duhové přelivy přes celý znak.
6. **Kresba:** může být vyražená, vyřezaná, vyšitá nebo malovaná — ale silueta
   musí zůstat čitelná. Když se znak v obraze ztrácí, zvětši ho, neupravuj tvar.

## Co dělat, když si nejsi jistý

Když zadání symbol nezmiňuje, **žádný tam nedávej**. Prázdná plachta nebo hladká
deska je správně; vymyšlený erb je vada.
`;

/* ---------- zápis ---------- */

fs.rmSync(PKG, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(path.join(PKG, "logo"), { recursive: true });

fs.writeFileSync(path.join(PKG, "PROMPT.txt"), prompt);
fs.writeFileSync(
  path.join(PKG, "pozadavky.txt"),
  `Co má přijít zpět — 15 PNG, název souboru = id\n\n${checklist}\n\nStačí holé PNG ve složce; jména souborů jsou hlavní.\n`,
);
fs.writeFileSync(path.join(PKG, "PRAVIDLA-ZNACKY.md"), BRAND_RULES);

/* originál: zlatý medailon */
for (const size of [1024, 512]) {
  // JPEG q92 — pro referenci stačí a ZIP zůstane malý (PNG měl 2 MB/ks).
  await sharp(ORIGINAL)
    .resize(size, size, { fit: "cover" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(path.join(PKG, "logo", `original-medallion-${size}.jpg`));
}

/* rasta varianta — odříznout „AI" odznak v levém horním rohu */
{
  const meta = await sharp(RASTA).metadata();
  const cut = Math.round((meta.width ?? 1024) * 0.11);
  await sharp(RASTA)
    .extract({ left: cut, top: cut, width: (meta.width ?? 1024) - cut, height: (meta.height ?? 1024) - cut })
    .resize(1024, 1024, { fit: "cover" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(path.join(PKG, "logo", "original-rasta-1024.jpg"));
}

/* Engine B značka */
fs.copyFileSync(path.join(ENGINE_B, "glyph-on-dark.svg"), path.join(PKG, "logo", "engine-b-glyph.svg"));
fs.copyFileSync(path.join(ENGINE_B, "seal.svg"), path.join(PKG, "logo", "engine-b-seal.svg"));
fs.copyFileSync(path.join(ENGINE_B, "lockup-on-dark.png"), path.join(PKG, "logo", "engine-b-lockup.png"));
fs.copyFileSync(path.join(Z_TREE, "icon-on-dark-256.png"), path.join(PKG, "logo", "z-tree-icon-256.png"));

/* náhledová mřížka 3×2 pro rychlou kontrolu tvaru */
{
  const tiles = [
    path.join(PKG, "logo", "original-medallion-512.jpg"),
    path.join(PKG, "logo", "original-rasta-1024.jpg"),
    path.join(PKG, "logo", "z-tree-icon-256.png"),
  ];
  const size = 340;
  const buffers = [];
  for (const tile of tiles) buffers.push(await sharp(tile).resize(size, size, { fit: "contain", background: "#101C2B" }).png().toBuffer());
  const glyphSvg = fs.readFileSync(path.join(PKG, "logo", "engine-b-glyph.svg"));
  buffers.push(await sharp(glyphSvg, { density: 300 }).resize(size, size, { fit: "contain", background: "#101C2B" }).png().toBuffer());
  await sharp({ create: { width: size * 2, height: size * 2, channels: 3, background: { r: 16, g: 28, b: 43 } } })
    .composite(buffers.map((input, index) => ({ input, left: (index % 2) * size, top: Math.floor(index / 2) * size })))
    .png()
    .toFile(path.join(PKG, "logo", "prehled.png"));
}

execFileSync("zip", ["-qr", ZIP, NAME], { cwd: HERE });
console.log(`→ ${path.relative(process.cwd(), ZIP)} (${(fs.statSync(ZIP).size / 1024).toFixed(1)} kB)`);
console.log(`   obsah: ${fs.readdirSync(PKG).join(", ")}`);
console.log(`   logo:  ${fs.readdirSync(path.join(PKG, "logo")).join(", ")}`);
