import { readFile } from "fs/promises";
import path from "path";
import Script from "next/script";
import VzestupNav from "./VzestupNav";

function transformRelative(url: string) {
  if (!url) return url;
  return url
    .replace(/^\.\.\/\.\.\//, "/legacy/")
    .replace(/^\.\.\//, "/legacy/")
    .replace(/^\.\//, "/legacy/Vzestup/");
}

export default async function VzestupPage() {
  const filePath = path.join(
    process.cwd(),
    "public",
    "legacy",
    "Vzestup",
    "index.html"
  );
  const html = await readFile(filePath, "utf-8");

  // Extract inline style from <head>
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
  const inlineCss = styleMatch ? styleMatch[1] : "";

  // Extract body innerHTML
  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
  let bodyHtml = bodyMatch ? bodyMatch[1] : "";

  // Remove the fixed back link
  bodyHtml = bodyHtml.replace(/<a[^>]*class="vz-back"[^>]*>[\s\S]*?<\/a>/i, "");

  // Remove the bottom toggle script (we provide our own)
  bodyHtml = bodyHtml.replace(/<script>[\s\S]*?<\/script>/gi, "");

  // Add id="hero" to hero section
  bodyHtml = bodyHtml.replace(
    /<section class="vz-hero">/i,
    '<section class="vz-hero" id="hero">'
  );

  // Transform all relative src/href in the body
  bodyHtml = bodyHtml
    .replace(/(href|src)="\.\.\//g, '$1="/legacy/')
    .replace(/(href|src)="\.\//g, '$1="/legacy/Vzestup/');

  // For CSS background image in style attribute / inline CSS
  const heroBg = "/legacy/Vzestup/vzestup.webpark.cz/violetmarble.jpg";
  const pageStyle = inlineCss.replace(
    /url\('\.\/vzestup\.webpark\.cz\/violetmarble\.jpg'\)/g,
    `url('${heroBg}')`
  );

  return (
    <div className="relative min-h-screen bg-[#0a0a14]">
      <VzestupNav />
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />
      <div
        className="relative z-0"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
      <Script
        src="https://kit.fontawesome.com/16464afad1.js"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <Script id="vzestup-toggle" strategy="afterInteractive">
        {`
          const chevron = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:6px"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          function toggleExpand(id, btn) {
            const el = document.getElementById(id);
            if (!el || !btn) return;
            el.classList.toggle('open');
            btn.classList.toggle('active');
            if (el.classList.contains('open')) {
              btn.innerHTML = chevron + 'Skrýt články';
            } else {
              btn.innerHTML = chevron + 'Zobrazit všechny články';
            }
          }
        `}
      </Script>
    </div>
  );
}
