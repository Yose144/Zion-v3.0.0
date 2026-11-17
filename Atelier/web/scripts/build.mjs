import { mkdir, readFile, writeFile } from "node:fs/promises";

const files = {
  "/betlem/laser-v2/galerie/lumi-a-maly-princ.webp": ["src/betlem/laser-v2/galerie/lumi-a-maly-princ.webp", "image/webp"],
  "/betlem/laser-v2/galerie/vanocni-zion.webp": ["src/betlem/laser-v2/galerie/vanocni-zion.webp", "image/webp"],
  "/betlem/laser-v2/galerie/zimni-betlem.webp": ["src/betlem/laser-v2/galerie/zimni-betlem.webp", "image/webp"],
  "/betlem/laser-v2/galerie/betlem-pod-stromem.webp": ["src/betlem/laser-v2/galerie/betlem-pod-stromem.webp", "image/webp"],
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
  "/betlem/avatar-models.js": ["src/betlem/avatar-models.js", "text/javascript; charset=utf-8"],
  "/betlem/set-design.js": ["src/betlem/set-design.js", "text/javascript; charset=utf-8"],
  "/betlem/scene.js": ["src/betlem/scene.js", "text/javascript; charset=utf-8"],
  "/betlem/scene.css": ["src/betlem/scene.css", "text/css; charset=utf-8"],
  "/betlem/roster.json": ["src/betlem/roster.json", "application/json; charset=utf-8"],
};
// Local copies of the six central avatars, with texture size tuned for the web.
for (const id of [1, 2, 18, 19, 40, 43]) {
  files[`/betlem/model/${id}.glb`] = [`src/betlem/models/${id}.glb`, "model/gltf-binary"];
}
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url, [file, type]]) => {
  const content = await readFile(file);
  const binary = type === "image/webp" || type === "model/gltf-binary";
  return [url, { type, content: content.toString(binary ? "base64" : "utf8"), binary }];
})));
await mkdir("dist/server", { recursive: true });
await writeFile("dist/server/index.js", `const assets = ${JSON.stringify(assets)};\n${assets["/catalog.js"].content}\n${await readFile("src/agent-worker.js", "utf8")}\n${await readFile("src/worker.js", "utf8")}`);
