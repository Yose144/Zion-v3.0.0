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
