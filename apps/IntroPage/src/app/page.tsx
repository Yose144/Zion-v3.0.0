import fs from "fs";
import path from "path";
import NirvanaUniverseEmbed from "./components/NirvanaUniverseEmbed";

export default function Home() {
  const html = fs.readFileSync(
    path.join(process.cwd(), "src/app/maintenance.html"),
    "utf-8"
  );

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1].trim() : "";

  return (
    <>
      <main
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: body }}
        suppressHydrationWarning
      />
      {/* portals into #nirvana-embed inside maintenance.html (under the header links).
          intro-tabs.js se loaduje raw <script defer> v body HTML — sem nedávat
          next/script, jinak by se IIFE provedl dvakrát (double event bind). */}
      <NirvanaUniverseEmbed />
    </>
  );
}
