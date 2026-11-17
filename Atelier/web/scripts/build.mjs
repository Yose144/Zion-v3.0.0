import { mkdir, readFile, writeFile } from "node:fs/promises";

const files = {
  "/betlem/laser-v2": ["src/betlem/laser-v2/index.html", "text/html; charset=utf-8"],
  "/betlem/laser-v2/Vizualizace.webp": ["src/betlem/laser-v2/Vizualizace.webp", "image/webp"],
  "/betlem/laser-v2/Navrh.md": ["src/betlem/laser-v2/Navrh.md", "text/plain; charset=utf-8"],
  "/betlem/laser-v2/Materialovy-plan.svg": ["src/betlem/laser-v2/Materialovy-plan.svg", "image/svg+xml"],
  "/": ["src/index.html", "text/html; charset=utf-8"],
  "/atelier.css": ["src/atelier.css", "text/css; charset=utf-8"],
  "/catalog.js": ["src/catalog.js", "text/javascript; charset=utf-8"],
  "/agent-ui.js": ["src/agent-ui.js", "text/javascript; charset=utf-8"],
  "/atelier.js": ["src/atelier.js", "text/javascript; charset=utf-8"],
  "/lumi.webp": ["src/lumi.webp", "image/webp"],
  "/betlem": ["src/betlem/index.html", "text/html; charset=utf-8"],
  "/betlem/scene.js": ["src/betlem/scene.js", "text/javascript; charset=utf-8"],
  "/betlem/scene.css": ["src/betlem/scene.css", "text/css; charset=utf-8"],
  "/betlem/roster.json": ["src/betlem/roster.json", "application/json; charset=utf-8"],
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url, [file, type]]) => {
  const content = await readFile(file);
  const binary = type === "image/webp";
  return [url, { type, content: content.toString(binary ? "base64" : "utf8"), binary }];
})));
await mkdir("dist/server", { recursive: true });
await writeFile("dist/server/index.js", `const assets = ${JSON.stringify(assets)};\n${assets["/catalog.js"].content}\n${await readFile("src/agent-worker.js", "utf8")}\n${await readFile("src/worker.js", "utf8")}`);
