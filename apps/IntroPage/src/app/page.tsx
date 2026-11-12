import fs from "fs";
import path from "path";
import Script from "next/script";
import NirvanaUniverseEmbed from "./components/NirvanaUniverseEmbed";

/** Bump when the hand-authored JS in public/assets/js changes. */
const ASSET_V = "20261112";

export default function Home() {
  const html = fs.readFileSync(
    path.join(process.cwd(), "src/app/maintenance.html"),
    "utf-8"
  );

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1].trim() : "";

  // The stargate ring is the largest paint in the hero — start it with the HTML.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://zionterranova.com/#org",
        name: "ZION TerraNova",
        url: "https://zionterranova.com",
        logo: "https://zionterranova.com/symbol-200x200.webp",
        sameAs: [
          "https://github.com/Zion-TerraNova/",
          "https://discord.gg/wvxJ7DhZ8",
          "https://www.facebook.com/ZionTerraNova/",
          "https://www.instagram.com/terranova_project/",
        ],
      },
      {
        "@type": "WebSite",
        "@id": "https://zionterranova.com/#site",
        url: "https://zionterranova.com",
        name: "ZION TerraNova",
        inLanguage: "cs",
        publisher: { "@id": "https://zionterranova.com/#org" },
      },
    ],
  };

  return (
    <>
      <link rel="preload" as="image" href="/stargate/2.png" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: body }}
        suppressHydrationWarning
      />
      {/* portals into #nirvana-embed inside the page markup */}
      <NirvanaUniverseEmbed />

      {/* Page-local behaviour. Kept out of the HTML body on purpose: raw
          <script> tags injected through dangerouslySetInnerHTML never run
          again on a client-side navigation back to "/". next/script does. */}
      <Script src={`/assets/js/starfield-bg.js?v=${ASSET_V}`} strategy="afterInteractive" />
      <Script src={`/assets/js/intro-tabs.js?v=${ASSET_V}`} strategy="afterInteractive" />
      <Script src={`/assets/js/main.js?v=${ASSET_V}`} strategy="afterInteractive" />
    </>
  );
}
