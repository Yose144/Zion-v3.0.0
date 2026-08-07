import fs from "fs";
import path from "path";

export default function Home() {
  const html = fs.readFileSync(
    path.join(process.cwd(), "src/app/maintenance.html"),
    "utf-8"
  );

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1].trim() : "";

  return (
    <main
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: body }}
      suppressHydrationWarning
    />
  );
}
