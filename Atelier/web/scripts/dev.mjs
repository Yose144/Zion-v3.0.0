import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
await import("./build.mjs");
const { default: worker } = await import("../dist/server/index.js");

const sqlite = new DatabaseSync(":memory:");
for (const file of ["0000_plans.sql", "0001_sources.sql", "0002_agent_jobs.sql"]) {
  sqlite.exec(await readFile("drizzle/" + file, "utf8"));
}
const DB = { prepare(sql) { return { bind(...args) {
  const stmt = sqlite.prepare(sql);
  return { all: () => ({ results: stmt.all(...args) }), first: () => stmt.get(...args) ?? null, run: () => ({ meta: stmt.run(...args) }) };
} }; } };
const flag = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
createServer(async (req, res) => {
  const url = new URL(req.url, "http://" + req.headers.host);
  const headers = new Headers(req.headers);
  headers.set("oai-authenticated-user-id", "local-preview");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const response = await worker.fetch(new Request(url, { method: req.method, headers, body }), { DB });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(Number(flag("--port", process.env.PORT ?? 3000)), flag("--host", "0.0.0.0"));
