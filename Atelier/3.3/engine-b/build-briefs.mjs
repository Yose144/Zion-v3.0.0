#!/usr/bin/env node
/**
 * build-briefs.mjs — z `new-assets.json` vygeneruje podklady pro Engine B.
 *
 * Výstup (do tohoto adresáře):
 *   00-GPT-MASTER-PROMPT.md   role + styl + kánon + negativy (copy-paste první zpráva)
 *   BATCH-6-ONBOARD.md …      dávky po plochách (copy-paste po jedné)
 *   prompts.csv               tabulka pro rychlý review
 *   assets.json               strojově čitelný seznam pro pipeline
 *
 * Styl, kánon a negativy se **nedědí ručně** — čtou se z kanonického
 * `3.3.0/design/engine-b/prompts/prompts.json`, aby se texty nerozešly.
 *
 * Použití:
 *   node Atelier/3.3/engine-b/build-briefs.mjs
 *   node Atelier/3.3/engine-b/build-briefs.mjs --check   # jen ověří, že sedí
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const CANON = path.join(ROOT, "3.3.0/design/engine-b/prompts/prompts.json");
const SRC = path.join(HERE, "new-assets.json");
const CHECK = process.argv.includes("--check");

const canon = JSON.parse(fs.readFileSync(CANON, "utf8"));
const data = JSON.parse(fs.readFileSync(SRC, "utf8"));
const byBatch = new Map(data.batches.map((b) => [b.id, b]));

const pad = (n) => String(n).padStart(2, "0");
const outputs = new Map();

/* ---------- master prompt ---------- */

outputs.set(
  "00-GPT-MASTER-PROMPT.md",
  `# GPT — Engine B (B · ZION / Manga) · master prompt pro 3.3

> **Zkopíruj celý tento soubor jako první zprávu.** Pak posílej dávky
> (\`BATCH-6-ONBOARD.md\`, \`BATCH-7-NEWS.md\`, \`BATCH-8-MINE.md\`) po jedné.
> **Neposílej všechny obrázky najednou** — kvalita klesá.
>
> Styl, kánon a negativy jsou převzaté z kanonického
> \`3.3.0/design/engine-b/prompts/prompts.json\` (verze ${canon.engine.version}).
> Když se změní kánon, změň ho tam a tenhle soubor vygeneruj znovu.

---

## Role

You are the art director and illustrator of ZION TerraNova. You produce original
painterly fantasy-manga key art in the approved **Engine B (B · ZION / Manga)**
style. You do not copy existing films, artists, characters or frames.

## Mission

Create the remaining ${data.assets.length} visuals for the ZION 3.3 web ecosystem so the new
site stops being text-only on the pages listed below. Each image must feel like
it belongs to the same film: same brushwork, same light logic, same palette, same world.

## Palette

${Object.entries(canon.palette)
  .map(([name, hex]) => `- ${name}: \`${hex}\``)
  .join("\n")}

## Style constants (apply to every image)

${canon.style_block}

## Canon (never alter)

${canon.canon_block}

## Negative (never include)

${canon.negative_block}

## Output rules

- **Jeden obrázek = jeden soubor**, nejvyšší dostupné rozlišení, přesný poměr stran.
- **PNG, neprůhledné, sRGB**, název \`<id>__master.png\`.
- **Žádný text, žádné logo, žádné UI, žádný watermark, žádné rámečky.**
- Mobilní ořezy se **negenerují** — pipeline je odvozuje.
- Ke každé dávce přilož \`manifest.json\` (id, soubor, width, height, model, poznámky).

## Co je hotové (nedělat znovu)

Brána, Amenti, Vzestup, Příběh, Svět, Těžit (hero), Podpora, nové hero Novinek,
Kingdom (room, avatars, games, rings), Portal (explorer, wallet, docs) — viz
\`3.3.0/design/manifest.json\` a \`3.3.0/design/engine-b/prompts/\`.
`,
);

/* ---------- batches ---------- */

for (const batch of data.batches) {
  const assets = data.assets.filter((a) => a.batch === batch.id);
  if (!assets.length) continue;
  const lines = [];
  lines.push(`# Batch ${batch.id} — ${batch.name}`);
  lines.push("");
  lines.push(`> **${assets.length} obrázků.** Zkopíruj celý soubor do GPT jako jednu zprávu.`);
  lines.push("> Styl, kánon a negativy jsou v `00-GPT-MASTER-PROMPT.md` — GPT je už má.");
  lines.push("");
  lines.push(batch.brief);
  lines.push("");
  lines.push("## Přehled");
  lines.push("");
  lines.push("| # | id | poměr | master | cíl |");
  lines.push("|---|---|---|---|---|");
  assets.forEach((a, i) => {
    const target = a.targets[0];
    lines.push(
      `| ${i + 1} | \`${a.id}\` | ${a.aspect} | ${a.master.width}×${a.master.height} | \`${target.app}/public/${target.path.replace(/\.[a-z]+$/, "")}\` |`,
    );
  });
  lines.push("");
  lines.push("## Zadání");
  lines.push("");
  assets.forEach((a, i) => {
    lines.push(`### ${i + 1}. \`${a.id}\``);
    lines.push("");
    lines.push(`- **Poměr:** ${a.aspect} · **Master:** ${a.master.width}×${a.master.height}`);
    lines.push(`- **Text-safe:** ${a.text_safe}`);
    lines.push(`- **Cílové soubory:** ${a.targets.map((t) => `\`${t.app}/public/${t.path}\` (${t.width}×${t.height})`).join(", ")}`);
    lines.push(`- **Alt CS:** ${a.alt_cs}`);
    lines.push(`- **Alt EN:** ${a.alt_en}`);
    lines.push("");
    lines.push("```text");
    lines.push(a.prompt);
    lines.push("```");
    lines.push("");
  });
  outputs.set(`BATCH-${batch.id}-${batch.slug}.md`, lines.join("\n"));
}

/* ---------- GPT zprávy (samostatné, copy-paste) ---------- */
//
// Proč zvlášť: `BATCH-N.md` je interní zadání (odkazy, tabulky cílů).
// GPT potřebuje **jednu zprávu, která obstojí sama** — roli, kánon, negativy,
// výstupní pravidla a zadání. Proto se generují i soubory v `gpt/`.

const GPT_HEAD = `Jsi art director a ilustrátor ZION TerraNova. Tvoříš originální malovanou
fantasy-manga key art v approved stylu **Engine B (B · ZION / Manga)**. Nekopíruj
existující filmy, umělce, postavy ani záběry.

# STYL (platí pro každý obrázek)
${canon.style_block}

# PALETA
inkoust #101C2B · les #344A36 · pergamen #F0E1BE · jantar #E7AA4B · rez #9D493D

# KÁNON (neměň)
${canon.canon_block}

# NEGATIVY (nikdy)
${canon.negative_block}

# VÝSTUP
- Jeden obrázek = jeden soubor, nejvyšší dostupné rozlišení, přesný poměr stran.
- PNG, neprůhledné, sRGB, název přesně \`<id>__master.png\`.
- Žádný text, žádné logo, žádné UI, žádný watermark, žádný rámeček.
- Mobilní ořezy se nedělají — odvodí se v pipeline.
- Ke každé dávce vrať tabulku: id → skutečné rozměry → krátká poznámka k odchylkám.
`;

const checklist = (assets) =>
  assets
    .map(
      (a, i) =>
        `${i + 1}. \`${a.id}__master.png\` — ${a.aspect} (${a.master.width}×${a.master.height}) · text-safe: ${a.text_safe}`,
    )
    .join('\n');

function gptBatch(batch, assets) {
  const parts = [];
  parts.push(GPT_HEAD);
  parts.push(`# ZADÁNÍ — dávka ${batch.id}: ${batch.name}`);
  parts.push(batch.brief);
  parts.push(`Vygeneruj **${assets.length} obrázků** v tomto pořadí:`);
  parts.push('');
  assets.forEach((asset, index) => {
    parts.push(`## ${index + 1}. \`${asset.id}\``);
    parts.push(`- Poměr ${asset.aspect}, master ${asset.master.width}×${asset.master.height} px.`);
    parts.push(`- Text-safe zóna: ${asset.text_safe}. Nech ji tmavou a bez detailů.`);
    parts.push('');
    parts.push(asset.prompt);
    parts.push('');
  });
  parts.push('# CO POTŘEBUJU ZPĚT');
  parts.push('Pro každý obrázek PNG pojmenovaný podle id, plus tabulku s odchylkami:');
  parts.push('');
  parts.push(checklist(assets));
  parts.push('');
  parts.push('Pokud něco nejde splnit (ruce, text-safe zóna, poměr), napiš to do poznámek — nezakrývej to.');
  parts.push('');
  return parts.join('\n');
}

for (const batch of data.batches) {
  const assets = data.assets.filter((a) => a.batch === batch.id);
  if (!assets.length) continue;
  outputs.set(`../gpt/BATCH-${batch.id}-${batch.slug}-GPT.md`, gptBatch(batch, assets));
}

const all = [];
all.push(GPT_HEAD);
all.push('# ZADÁNÍ — celý paket (15 obrázků)');
all.push('Dělej to **po dávkách** (6, 7, 8), ne najednou — kvalita u 15 obrázků v jednom běhu klesá.');
all.push('Pokud ti to nástroj nedovolí, řekni to a uděláme to po dávkách zvlášť.');
for (const batch of data.batches) {
  const assets = data.assets.filter((a) => a.batch === batch.id);
  if (!assets.length) continue;
  all.push(`\n## Dávka ${batch.id} — ${batch.name} (${assets.length} obrázků)`);
  all.push(batch.brief);
  assets.forEach((asset, index) => {
    all.push(`\n### ${batch.id}.${index + 1} \`${asset.id}\` — ${asset.aspect}, master ${asset.master.width}×${asset.master.height}, text-safe: ${asset.text_safe}`);
    all.push(asset.prompt);
  });
}
all.push('\n# CO POTŘEBUJU ZPĚT');
all.push('PNG pojmenované podle id + tabulku s odchylkami. Nic nezakrývej.');
outputs.set('../gpt/00-CELY-PAKET-GPT.md', all.join('\n') + '\n');

outputs.set(
  '../gpt/README.md',
  `# GPT zprávy — copy-paste

Tohle je to, co se vkládá do GPT. Každý soubor obstojí **sám** (role + kánon +
negativy + zadání + co vrátit), takže se nepřepíná mezi soubory.

| Soubor | Co to je | Kolik obrázků |
|---|---|---|
| \`BATCH-6-ONBOARD-GPT.md\` | hero pro /roadmap, /team, /ai-native, /status, /contact | 5 |
| \`BATCH-7-NEWS-GPT.md\` | hero pro 4 články novinek | 4 |
| \`BATCH-8-MINE-GPT.md\` | pásy 3:1 do /mine/* | 6 |
| \`00-CELY-PAKET-GPT.md\` | všechno v jednom (jen když nástroj dávky neumí) | 15 |

**Postup:** zkopíruj celý soubor → vlož do GPT jako jednu zprávu → nech vygenerovat
→ stáhni PNG a pojmenuj přesně podle id (\`<id>__master.png\`).

**Proč po dávkách:** 15 obrázků v jednom běhu = klesá konzistence i kvalita.
Dávka 6 je první; ideálně začni jedním obrazem (\`onboard-roadmap-hero\`) na
schválení barvy a zrna, pak zbytek.

**Co pak:** PNG hoď do složky/ZIPu a předej — převezme to
\`3.3.0/scripts/ingest-engine-b.mjs\` (viz \`Atelier/3.3/README.md\`).

Generováno z \`new-assets.json\`; needituj tady.
`,
);

/* ---------- csv ---------- */

const csv = [
  "batch,id,aspect,master,target_app,target_path,target_size,text_safe",
  ...data.assets.map((a) =>
    [
      a.batch,
      a.id,
      a.aspect,
      `${a.master.width}x${a.master.height}`,
      a.targets[0].app,
      a.targets[0].path,
      `${a.targets[0].width}x${a.targets[0].height}`,
      a.text_safe,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  ),
].join("\n");
outputs.set("prompts.csv", `${csv}\n`);

/* ---------- assets.json (pro pipeline) ---------- */

outputs.set(
  "assets.json",
  `${JSON.stringify(
    {
      engine: canon.engine.id,
      version: canon.engine.version,
      generatedFrom: "Atelier/3.3/engine-b/new-assets.json",
      batches: data.batches,
      assets: data.assets,
    },
    null,
    2,
  )}\n`,
);

/* ---------- zápis ---------- */

let ok = true;
for (const [name, content] of outputs) {
  const file = path.join(HERE, name);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (current === content) continue;
  if (CHECK) {
    console.error(`změna: ${name}`);
    ok = false;
    continue;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`→ ${name}`);
}

if (CHECK && !ok) {
  console.error("Podklady nejsou synchronní — spusť bez --check.");
  process.exit(1);
}
if (CHECK) console.log("Podklady jsou synchronní.");

const total = data.assets.length;
const perBatch = data.batches.map((b) => `${b.slug}: ${data.assets.filter((a) => a.batch === b.id).length}`).join(", ");
console.log(`hotovo — ${total} assetů (${perBatch})`);
