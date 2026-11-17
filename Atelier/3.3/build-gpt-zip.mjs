#!/usr/bin/env node
/**
 * build-gpt-zip.mjs — jeden ZIP pro ChatGPT: PROMPT.txt + pozadavky.txt.
 *
 * Zdroj: `Atelier/3.3/gpt/00-CELY-PAKET-GPT.md` (generuje engine-b/build-briefs.mjs).
 * Cíl: minimální tření — jeden soubor zkopírovat, výstupy hodit do ZIPu zpět.
 *
 * Použití: node Atelier/3.3/build-gpt-zip.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NAME = "ZION-33-Engine-B-GPT";
const PKG = path.join(HERE, NAME);
const ZIP = path.join(HERE, `${NAME}.zip`);

const source = fs.readFileSync(path.join(HERE, "gpt/00-CELY-PAKET-GPT.md"), "utf8");
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "engine-b/assets.json"), "utf8"));

const prompt = [
  "Vygeneruj všech 15 obrázků podle zadání níže.",
  "Když to v jednom běhu nejde, udělej to po dávkách 6, 7, 8 — nic nevynechávej.",
  "",
  source.trim(),
  "",
].join("\n");

const checklist = spec.assets
  .map((a) => `${a.id} | ${a.aspect} | ${a.master.width}x${a.master.height} | ${a.id}__master.png`)
  .join("\n");

fs.rmSync(PKG, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(PKG, { recursive: true });
fs.writeFileSync(path.join(PKG, "PROMPT.txt"), prompt);
fs.writeFileSync(
  path.join(PKG, "pozadavky.txt"),
  `Co má přijít zpět — 15 PNG, název souboru = id\n\n${checklist}\n\nStačí holé PNG ve složce; jména souborů jsou hlavní.\n`,
);
execFileSync("zip", ["-qr", ZIP, NAME], { cwd: HERE });
console.log(`→ ${path.relative(process.cwd(), ZIP)} (${(fs.statSync(ZIP).size / 1024).toFixed(1)} kB)`);
console.log(`   obsah: ${fs.readdirSync(PKG).join(", ")}`);
