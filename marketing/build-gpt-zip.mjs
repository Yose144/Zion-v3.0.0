#!/usr/bin/env node
/**
 * build-gpt-zip.mjs — jeden ZIP pro ChatGPT: PROMPT.txt + pozadavky.txt.
 *
 * Zdroj: marketing/gpt/
 * Cíl: marketing/ZION-Vanoce-FB-IG-GPT.zip
 *
 * Použití: node marketing/build-gpt-zip.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GPT = path.join(HERE, "gpt");
const ZIP = path.join(HERE, "ZION-Vanoce-FB-IG-GPT.zip");
const EXPECTED = ["PROMPT.txt", "pozadavky.txt"];

for (const name of EXPECTED) {
  const file = path.join(GPT, name);
  if (!fs.existsSync(file)) {
    console.error(`chybí ${file}`);
    process.exit(1);
  }
}

fs.rmSync(ZIP, { force: true });
execFileSync("zip", ["-q", ZIP, ...EXPECTED], { cwd: GPT });

const listing = execFileSync("unzip", ["-Z1", ZIP], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .sort();
const expected = [...EXPECTED].sort();
if (listing.join("\n") !== expected.join("\n")) {
  console.error(`ZIP nemá jen ${expected.join(", ")}:\n${listing.join("\n")}`);
  process.exit(1);
}

const kb = (fs.statSync(ZIP).size / 1024).toFixed(1);
console.log(`→ ${path.relative(process.cwd(), ZIP)} (${kb} kB)`);
console.log(`   obsah: ${listing.join(", ")}`);
