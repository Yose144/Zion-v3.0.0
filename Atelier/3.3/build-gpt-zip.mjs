#!/usr/bin/env node
/**
 * build-gpt-zip.mjs — ZIP pro ChatGPT: PROMPT.txt + pozadavky.txt + logo/.
 *
 * Zdroj:
 *   - PROMPT:  `Atelier/3.3/gpt/00-CELY-PAKET-GPT.md` (generuje engine-b/build-briefs.mjs)
 *   - logo:    **jen oficiální balíček** `canon/brand/org/` (ZionLogo → symbol, cosmic,
 *              wordmark, banner). Žádné jiné verze se do zadání nedávají — 👤
 *              neschválil nic jiného (medailon z docs/ ani Engine B glyph ne).
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
const ROOT = path.resolve(HERE, "../..");
const sharp = require(path.join(ROOT, "node_modules/sharp"));

const NAME = "ZION-33-Engine-B-GPT";
const PKG = path.join(HERE, NAME);
const ZIP = path.join(HERE, `${NAME}.zip`);

const ORG = path.join(ROOT, "canon/brand/org");

const source = fs.readFileSync(path.join(HERE, "gpt/00-CELY-PAKET-GPT.md"), "utf8");
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "engine-b/assets.json"), "utf8"));

const BRAND_SECTION = `
# ZNAČKA (brand mark) — povinné pravidlo

Oficiální znak ZIONu je **Z vyrostlé ze stromu**: písmeno Z z prken v rasta
barvách (zelená / zlatá / červená), jehož horní břevno se rozpadá do koruny
listů a spodní břevno do kořenů, celé v **zlatém kruhu**. To je dnes jediná značka
v repu (canon/brand/org) — finální výběr loga je ale stále na 👤, takže se drž
tohoto tvaru a nic jiného si nevymýšlej.

- **Přesné předlohy máš přiložené** ve složce \`logo/\` (PNG, transparentní).
  Drž se jich: stejný tvar, stejné barvy, stejný kruh.
- Když má být v obraze symbol (vyřezaná pečeť, vypálená značka na dřevě, vyšitý
  prapor, ražba na minci, desky knihy), použij **tento znak** — čitelně, ale
  přirozeně v materiálu (dřevo, vosk, kov, látka).
- Značku **nepřidávej tam, kde o ni zadání nemluví**. Ilustrace není plakát
  s logem; znak patří jen na předměty, které ho v příběhu nesou.
- Nikdy ji nedávej do levé třetiny (text-safe zóna) a nikdy přes tvář.
- Nikdy nepřekresluj znak „podle sebe“, nepiš iniciály, nevytvářej erby ani
  vlajky s písmeny.
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

const BRAND_RULES = `# Značka ZION — oficiální podklady

Jediná schválená značka je **Z-strom v rasta barvách, v zlatém kruhu**
(\`symbol-transparent-1024.png\`). Všechno ostatní v této složce je tatáž značka
v jiné velikosti nebo na jiném podkladu — nic nového.

| Soubor | Co to je | Kde se používá |
|---|---|---|
| \`logo/symbol-transparent-512.png\` | totéž 512 px | běžné použití |
| \`logo/symbol-transparent-256.png\` | totéž 256 px | malé plochy, ikony |
| \`logo/symbol-transparent-200.png\` | totéž 200 px | burzovní listing (CMC/CoinGecko) |
| \`logo/cosmic-1024.jpg\` | značka na tmavém kosmickém podkladu | app ikona, tmavé plochy |
| \`logo/wordmark-light.png\` | znak + „ZION TERRA NOVA“ na světlém | web, tisk — **ne do ilustrací** |
| \`logo/social-banner.png\` | hotový banner 1200×630 | sociální sítě — **ne do ilustrací** |
| \`logo/prehled.png\` | náhled všech podob v mřížce | jen pro tvůj přehled |

## Pravidla pro ilustrace

1. **Nekresli vlastní verzi.** Vždy z přiloženého tvaru: Z z prken, koruna
   listů nahoře, kořeny dole, zlatý kruh kolem.
2. **Žádná písmena navíc.** Žádné „ZION“ v obraze, žádné iniciály, žádné nápisy
   na praporech, deskách ani pečetích.
3. **Žádné nové erby.** Když má být symbol, je to tenhle znak — ne vymyšlený.
4. **Umístění:** jen na předměty, které ho v příběhu nesou (pečeť, mince, kniha,
   prapor, vypálená značka na dřevě). Nikdy do levé třetiny, nikdy přes tvář.
5. **Materiál může být jiný** (vyřezané do dřeva, ražené do kovu, šité zlatou
   nití), ale **silueta a barvy musí zůstat čitelné**. Když se znak ztrácí,
   zvětši ho, neupravuj tvar.
6. **Wordmark a banner** jsou pro web a sociální sítě — do malovaných scén
   nepatří.

## Když si nejsi jistý

Když zadání symbol nezmiňuje, **žádný tam nedávej**. Hladká deska nebo prázdný
prapor je správně; vymyšlený erb je vada.
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

/* oficiální značka — jen soubory z canon/brand/org, zmenšené, ať ZIP není 8 MB */
// 512 je pro referenci dost (master 1024 měl 2 MB a nic nového nepřinese).
const LOGO_FILES = [
  ["symbol-512x512.png", "symbol-transparent-512.png", 512],
  ["symbol-256x256.png", "symbol-transparent-256.png", 256],
  ["symbol-200x200.png", "symbol-transparent-200.png", 200],
];
for (const [src, out, size] of LOGO_FILES) {
  await sharp(path.join(ORG, src))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(PKG, "logo", out));
}
// Kosmická varianta má plné pozadí → JPEG (1,1 MB PNG vs ~180 kB).
await sharp(path.join(ORG, "zion-primary-cosmic.png"))
  .resize(1024, 1024)
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
  .toFile(path.join(PKG, "logo", "cosmic-1024.jpg"));
fs.copyFileSync(path.join(ORG, "zion-wordmark-light.png"), path.join(PKG, "logo", "wordmark-light.png"));
fs.copyFileSync(path.join(ORG, "zion-social-banner.png"), path.join(PKG, "logo", "social-banner.png"));

/* náhled 2×2: průhledný symbol, cosmic, wordmark, banner */
{
  const size = 360;
  const tiles = [
    await sharp(path.join(PKG, "logo", "symbol-transparent-512.png"))
      .resize(size, size, { fit: "contain", background: "#F0E1BE" })
      .png()
      .toBuffer(),
    await sharp(path.join(PKG, "logo", "cosmic-1024.jpg"))
      .resize(size, size, { fit: "contain", background: "#101C2B" })
      .png()
      .toBuffer(),
    await sharp(path.join(PKG, "logo", "wordmark-light.png"))
      .resize(size, size, { fit: "contain", background: "#F0E1BE" })
      .png()
      .toBuffer(),
    await sharp(path.join(PKG, "logo", "social-banner.png"))
      .resize(size, size, { fit: "contain", background: "#101C2B" })
      .png()
      .toBuffer(),
  ];
  await sharp({ create: { width: size * 2, height: size * 2, channels: 3, background: { r: 16, g: 28, b: 43 } } })
    .composite(tiles.map((input, index) => ({ input, left: (index % 2) * size, top: Math.floor(index / 2) * size })))
    .png()
    .toFile(path.join(PKG, "logo", "prehled.png"));
}

execFileSync("zip", ["-qr", ZIP, NAME], { cwd: HERE });
console.log(`→ ${path.relative(process.cwd(), ZIP)} (${(fs.statSync(ZIP).size / 1024).toFixed(1)} kB)`);
console.log(`   obsah: ${fs.readdirSync(PKG).join(", ")}`);
console.log(`   logo:  ${fs.readdirSync(path.join(PKG, "logo")).join(", ")}`);
