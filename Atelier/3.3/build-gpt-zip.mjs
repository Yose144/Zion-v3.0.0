#!/usr/bin/env node
/**
 * build-gpt-zip.mjs — zabalí GPT zprávy do jednoho ZIPu pro ChatGPT.
 *
 * Zdroj: `Atelier/3.3/gpt/*.md` (generuje `engine-b/build-briefs.mjs`).
 * Výstup: `Atelier/3.3/ZION-33-Engine-B-GPT.zip` + rozbalená složka stejného jména.
 *
 * Použití:
 *   node Atelier/3.3/build-gpt-zip.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "gpt");
const NAME = "ZION-33-Engine-B-GPT";
const PKG = path.join(HERE, NAME);
const ZIP = path.join(HERE, `${NAME}.zip`);

const BATCHES = [
  { file: "BATCH-6-ONBOARD-GPT.md", out: "1-ONBOARD-GPT.md", label: "Onboard — 5 hero" },
  { file: "BATCH-7-NEWS-GPT.md", out: "2-NEWS-GPT.md", label: "Novinky — 4 hero" },
  { file: "BATCH-8-MINE-GPT.md", out: "3-MINE-GPT.md", label: "Těžba — 6 pásů" },
  { file: "00-CELY-PAKET-GPT.md", out: "9-CELY-PAKET-GPT.md", label: "všech 15 najednou" },
];

const spec = JSON.parse(fs.readFileSync(path.join(HERE, "engine-b/assets.json"), "utf8"));

const readme = `# Co s tímhle ZIPem

Tohle není web ani kód. Jsou to **zprávy pro ChatGPT** — jedna zpráva = jedna dávka obrázků.

## Postup (5 kroků)

1. Nahraj tenhle ZIP do ChatGPT (nebo si jen otevři soubory lokálně).
2. Otevři **\`1-ONBOARD-GPT.md\`**, zkopíruj **celý** obsah a vlož jako jednu zprávu.
3. ChatGPT vygeneruje 5 obrázků. Když se ptá nebo dělá jeden po druhém, piš „pokračuj“.
4. Každý obrázek stáhni a pojmenuj **přesně** podle seznamu na konci zprávy
   (např. \`onboard-roadmap-hero__master.png\`).
5. Všechny hoď do jedné složky, zabal do ZIPu a pošli mi cestu.

Já to pak převezmu (kopírování do webu, manifest, napojení, nasazení).

## Které soubory kdy

| Soubor | Co udělá | Kolik |
|---|---|---|
| \`1-ONBOARD-GPT.md\` | hero pro /roadmap, /team, /ai-native, /status, /contact | 5 |
| \`2-NEWS-GPT.md\` | hero pro 4 články novinek | 4 |
| \`3-MINE-GPT.md\` | pásy 3:1 do /mine/* | 6 |
| \`9-CELY-PAKET-GPT.md\` | všech 15 najednou (nedoporučuju, klesá kvalita) | 15 |

**Začni jen souborem 1.** Až budou hotové, řekni a pošlu další — nemusíš to dělat najednou.

## Na co si dát pozor

- **Žádný text v obrázku.** Když tam ChatGPT napíše písmena, čísla nebo logo, nech to přegenerovat.
- **Levá třetina tmavá.** Na ni přijde titulek stránky. Když je světlá nebo plná detailů, přegeneruj.
- **Poměr stran.** 16:9 u hero, 3:1 u pásů. Když dá jiný, nech ho předělat.
- **Velikost:** klidně menší než 2048 px — doostřím to. Horší je špatný poměr.

## Co potřebuju zpět

Jen PNGéčka pojmenovaná podle id ve složce (\`images/\`) a k nim ideálně \`manifest\` — ale stačí i holé PNG, jména souborů jsou hlavní.
`;

fs.rmSync(PKG, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(path.join(PKG, "images"), { recursive: true });

fs.writeFileSync(path.join(PKG, "00-CTI-MNE.md"), readme);

for (const batch of BATCHES) {
  const src = path.join(SRC, batch.file);
  if (!fs.existsSync(src)) {
    console.error(`chybí ${path.relative(HERE, src)} — spusť build-briefs.mjs`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(PKG, batch.out));
}

const checklist = spec.assets
  .map(
    (a) =>
      `${a.id}  |  ${a.aspect}  |  master ${a.master.width}×${a.master.height}  |  ${a.id}__master.png`,
  )
  .join("\n");
fs.writeFileSync(
  path.join(PKG, "pozadavky.txt"),
  `Seznam všech 15 obrázků (kontrolní lístek)\n\nid | poměr | master | název souboru\n${"-".repeat(90)}\n${checklist}\n`,
);

execFileSync("zip", ["-qr", ZIP, NAME], { cwd: HERE });
const size = (fs.statSync(ZIP).size / 1024).toFixed(1);
console.log(`→ ${path.relative(process.cwd(), ZIP)} (${size} kB)`);
console.log(`   obsah: ${fs.readdirSync(PKG).join(", ")}`);
