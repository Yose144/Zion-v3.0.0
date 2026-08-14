import fs from "fs";
import path from "path";
import { parse } from "node-html-parser";

const LEGACY_ROOT = path.join(process.cwd(), "public/legacy");

// Skip URLs that are already absolute or protocol-relative.
function isAbsoluteUrl(url: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url);
}

function shouldSkipUrl(url: string): boolean {
  if (!url) return true;
  if (isAbsoluteUrl(url)) return true;
  if (url.startsWith("#") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("data:") || url.startsWith("javascript:")) {
    return true;
  }
  return false;
}

// Resolve a legacy-relative URL to an absolute /legacy/... path.
function resolveLegacyUrl(url: string, fileDir: string): string {
  if (shouldSkipUrl(url)) return url;

  let rel = url;
  let up = 0;
  while (rel.startsWith("../")) {
    up++;
    rel = rel.slice(3);
  }
  if (rel.startsWith("./")) {
    rel = rel.slice(2);
  }

  const parts = fileDir.split("/").filter(Boolean);
  const baseParts = parts.slice(0, Math.max(0, parts.length - up));
  const prefix = baseParts.length > 0 ? `${baseParts.join("/")}/` : "";

  return `/legacy/${prefix}${rel}`;
}

function rewriteLegacyUrls(html: string, fileDir: string): string {
  return html.replace(
    /\b(src|href|srcset|data-src)=(["'])([^"']+)\2/gi,
    (match, attr, quote, url) => {
      const resolved = resolveLegacyUrl(url, fileDir);
      if (resolved === url) return match;
      return `${attr}=${quote}${resolved}${quote}`;
    }
  );
}

function trimTrivial(html: string): string {
  // Remove leading/trailing whitespace, <br>, empty paragraphs with &nbsp;, and clear-both divs.
  const trivial = /(?:\s|<br\s*\/?>|<p[^>]*>\s*(?:&nbsp;|&#160;|\s)*\s*<\/p>|<div[^>]*style=["'][^"']*clear:\s*both;[^"']*["'][^>]*>\s*<\/div>)+/gi;
  return html.replace(new RegExp("^" + trivial.source, "i"), "").replace(new RegExp(trivial.source + "$", "i"), "").trim();
}

export function extractFullPostContent(file: string): string | null {
  if (!file.startsWith("blog/full/")) return null;

  const filePath = path.join(LEGACY_ROOT, file);
  if (!fs.existsSync(filePath)) return null;

  const html = fs.readFileSync(filePath, "utf8");
  const root = parse(html);
  const article = root.querySelector("div.article");
  if (!article) return null;

  // Some legacy full-HTML posts contain a nested full HTML document (e.g. a banner).
  // Those are not regular article content, so fall back to the JSON content.
  if (article.querySelector("html")) return null;

  let content = article.innerHTML;
  content = trimTrivial(content);
  if (content.length < 200) return null;

  const fileDir = path.dirname(file);
  content = rewriteLegacyUrls(content, fileDir);

  return content;
}
