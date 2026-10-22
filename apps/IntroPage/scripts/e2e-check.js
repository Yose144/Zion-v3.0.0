import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const baseUrl = "https://zionterranova.com";
const shouldCheckExternal = process.argv.includes("--external");

// Legacy / server-only paths that are not part of the Next.js app and not migrated.
const IGNORED_PREFIXES = [
  "/awstatsicons/",
  "/error_docs/",
  "/legacy/awstats/",
  "/legacy/email-templates/",
  "/legacy/Vzestup/counter.",
  "/legacy/Vzestup/vzestup.webpark.cz/wm/wm_fs_cz.exe",
  "/legacy/Start.mp4",
  "/legacy/w9g.mp4",
  "/legacy/$2",
  "/legacy/wp/",
  "/legacy/js/slider.js",
];

const seen = new Set();
const broken = [];
const checked = { ok: 0, external: 0, skipped: 0 };

function listHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtml(full, out);
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function fileForUrl(url) {
  const u = new URL(url, baseUrl);
  if (u.host !== new URL(baseUrl).host) return null;
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  else if (!path.extname(p)) p += "/index.html";
  return path.join(distDir, p);
}

function resolveUrl(raw, fromFile) {
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("//")) {
    return raw.startsWith("//") ? "https:" + raw : raw;
  }
  const rel = raw.split("?")[0].split("#")[0];
  if (!rel) return null;
  const fromUrl = baseUrl + fromFile.slice(distDir.length).replace(/index\.html$/, "");
  return new URL(rel, fromUrl).href;
}

function extractLinks(html) {
  const links = [];
  const re = /(?:href|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) links.push(m[1]);
  return links;
}

function isInternal(url) {
  try {
    return new URL(url, baseUrl).host === new URL(baseUrl).host;
  } catch {
    return false;
  }
}

function checkFile(file, originalUrl) {
  if (seen.has(originalUrl)) return;
  seen.add(originalUrl);
  if (fs.existsSync(file)) {
    checked.ok++;
    return;
  }
  broken.push({ url: originalUrl, file, reason: "missing" });
}

async function checkExternal(url) {
  if (seen.has(url)) return;
  seen.add(url);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    if (res.ok || res.status === 405) {
      checked.ok++;
    } else {
      broken.push({ url, reason: `HTTP ${res.status}` });
    }
  } catch (e) {
    broken.push({ url, reason: e.name === "AbortError" ? "timeout" : String(e.message).split("\n")[0] });
  }
}

const htmlFiles = listHtml(distDir);

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf-8");
  for (const raw of extractLinks(html)) {
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("data:")) {
      checked.skipped++;
      continue;
    }
    if (raw.startsWith("#")) {
      checked.skipped++;
      continue;
    }
    const url = resolveUrl(raw, file);
    if (url && IGNORED_PREFIXES.some((p) => url.includes(p))) {
      checked.skipped++;
      continue;
    }
    if (!url) {
      checked.skipped++;
      continue;
    }
    if (isInternal(url)) {
      const localFile = fileForUrl(url);
      if (localFile) checkFile(localFile, url);
      else checked.skipped++;
    } else if (shouldCheckExternal) {
      checked.external++;
      await checkExternal(url);
    } else {
      checked.skipped++;
    }
  }
}

console.log(`Checked internal OK: ${checked.ok}, external: ${checked.external}, skipped: ${checked.skipped}`);
if (broken.length) {
  console.log(`\nBroken links (${broken.length}):`);
  for (const b of broken) console.log(`  ${b.url} — ${b.reason}`);
  process.exit(1);
} else {
  console.log("\nAll reachable links OK.");
}
