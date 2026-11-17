const projects = ["ZION TerraNova", "Lumi", "Market", "Appka", "Oasis", "Království srdce", "Brána"];
const statuses = ["planned", "working", "complete"];
const validId = /^[a-f0-9-]{36}$/;
const clean = (value, length) => typeof value === "string" ? value.trim().slice(0, length) : "";
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

function link(value, hostname) {
  const text = clean(value, 700);
  if (!text) return "";
  let url;
  try { url = new URL(text); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
  if (hostname && (url.protocol !== "https:" || url.host !== hostname)) return null;
  return url.href;
}

function reviewDetails(input) {
  const githubUrl = link(input.githubUrl, "github.com");
  const resultUrl = link(input.resultUrl);
  const environment = clean(input.environment, 24);
  const checkedOn = clean(input.checkedOn, 20);
  if (githubUrl === null) return { error: "Odkaz na GitHub musí začínat https://github.com/." };
  if (resultUrl === null) return { error: "Zadej platný webový odkaz na výsledek nebo důkaz." };
  if (!["", "draft", "staging", "production"].includes(environment)) return { error: "Vyber platné prostředí ověření." };
  const date = new Date(checkedOn + "T12:00:00Z");
  if (checkedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn) ||
      Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== checkedOn)) {
    return { error: "Zadej platné datum ověření." };
  }
  return { criterion: clean(input.criterion, 320), githubUrl, resultUrl, environment, checkedOn, reviewNote: clean(input.reviewNote, 800) };
}

function validDate(value) {
  const date = new Date(value + "T12:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function outlineFor(kind, input) {
  const fields = Object.hasOwn(workflowInfo, kind) ? workflowInfo[kind].fields : [];
  return Object.fromEntries(fields.map(([key]) => [key, clean(input?.[key], 700)]));
}

function validateSource(input) {
  const title = clean(input?.title, 160);
  const url = link(input?.url);
  const { project, kind, state } = input ?? {};
  if (!title || url === null || !projects.includes(project) || !Object.hasOwn(workflowInfo, kind) ||
      !["idea", "ready", "archived"].includes(state)) return null;
  return { title, url, project, kind, state, people: clean(input.people, 200),
    world: clean(input.world, 120), note: clean(input.note, 1500), outline: outlineFor(kind, input.outline) };
}

function planContext(input) {
  const kind = Object.hasOwn(workflowInfo, input.kind) ? input.kind : "";
  if (input.claims != null && (!Array.isArray(input.claims) || input.claims.length > 8)) {
    return { error: "K plánu můžeš přidat nejvýše osm tvrzení." };
  }
  const claims = [];
  for (const entry of input.claims ?? []) {
    const text = clean(entry?.text, 350);
    const status = clean(entry?.status, 16);
    const evidence = link(entry?.evidence);
    const date = clean(entry?.date, 20);
    if (!text || !Object.hasOwn(claimLabels, status) || evidence === null || (date && !validDate(date))) {
      return { error: "U každého tvrzení zkontroluj text, štítek, webový odkaz a datum." };
    }
    if (status === "live" && (!evidence || !date)) {
      return { error: "U tvrzení se štítkem ŽIVÉ zadej odkaz na důkaz a datum ověření." };
    }
    claims.push({ text, status, evidence, date });
  }
  const sourceId = clean(input.sourceId, 55);
  const parentPlanId = clean(input.parentPlanId, 40);
  if ((sourceId && !validId.test(sourceId) && !fixedSources.some(source => source.id === sourceId)) ||
      (parentPlanId && !validId.test(parentPlanId))) return { error: "Odkaz na podklad nebo předchozí plán je neplatný." };
  return { kind, outline: outlineFor(kind, input.outline), claims, sourceId, parentPlanId };
}

function validate(input) {
  if (!input || !Array.isArray(input.steps) || input.steps.length !== 3) return;
  const steps = input.steps.map(step => ({ text: clean(step?.text, 240), done: step?.done === true }));
  const output = clean(input.output, 160);
  const scene = clean(input.scene, 1800);
  const week = clean(input.week, 10);
  const date = new Date(week + "T12:00:00Z");
  if (!output || !scene || steps.some(step => !step.text) || !/^\d{4}-\d{2}-\d{2}$/.test(week) ||
      Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== week || date.getUTCDay() !== 1 ||
      !projects.includes(input.project) || !statuses.includes(input.status)) return;
  return { output, project: input.project, week, status: input.status, steps, scene,
    reference: clean(input.reference, 300), technology: clean(input.technology, 1800) };
}

async function api(request, env, url) {
  const owner = request.headers.get("oai-authenticated-user-id");
  if (!owner) return json({ error: "Pro práci s plány se přihlas přes ChatGPT." }, 401);
  if (!env.DB) return json({ error: "Úložiště plánů právě není dostupné." }, 503);
  const method = request.method;
  if (url.pathname === "/api/sources" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, body, updated FROM atelier_sources WHERE owner = ? ORDER BY updated DESC").bind(owner).all();
    return json(results.map(({ id, body, updated }) => ({ ...JSON.parse(body), id, updated })));
  }
  if (url.pathname === "/api/plans" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, body, updated FROM plans WHERE owner = ? ORDER BY week DESC, updated DESC").bind(owner).all();
    return json(results.map(({ id, body, updated }) => ({ ...JSON.parse(body), id, updated })));
  }
  if (request.headers.get("origin") !== url.origin && request.headers.get("sec-fetch-site") !== "same-origin") {
    return json({ error: "Nepovolený původ požadavku." }, 403);
  }
  const id = url.pathname.split("/").at(-1);
  const sourceRequest = url.pathname === "/api/sources" || url.pathname.startsWith("/api/sources/");
  const collection = sourceRequest ? "/api/sources" : "/api/plans";
  const create = url.pathname === collection && method === "POST";
  const update = url.pathname === collection + "/" + id && validId.test(id) && method === "PUT";
  if (!create && !update) return json({ error: "Akce nebyla nalezena." }, 404);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Očekává se JSON." }, 415);
  const raw = await request.text();
  if (raw.length > 24000) return json({ error: "Plán je příliš dlouhý." }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: "Plán se nepodařilo přečíst." }, 400); }
  if (sourceRequest) {
    const source = validateSource(input);
    if (!source) return json({ error: "Zadej název, projekt, typ a platný webový odkaz, pokud jej chceš uvést." }, 400);
    const updated = new Date().toISOString();
    if (create) {
      const newId = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO atelier_sources (owner, id, body, updated) VALUES (?, ?, ?, ?)")
        .bind(owner, newId, JSON.stringify(source), updated).run();
      return json({ ...source, id: newId, updated }, 201);
    }
    const { meta } = await env.DB.prepare("UPDATE atelier_sources SET body = ?, updated = ? WHERE owner = ? AND id = ? AND updated = ?")
      .bind(JSON.stringify(source), updated, owner, id, clean(input.updated, 30)).run();
    if (!meta.changes) return json({ error: "Podklad se mezitím změnil. Obnov přehled a otevři aktuální verzi." }, 409);
    return json({ ...source, id, updated });
  }
  const plan = validate(input);
  if (!plan) return json({ error: "Vyplň výstup, pondělní datum, tři kroky a námět scény." }, 400);
  const details = reviewDetails(input);
  if (details.error) return json(details, 400);
  const context = planContext(input);
  if (context.error) return json(context, 400);
  if (context.parentPlanId &&
      (context.parentPlanId === id || !(await env.DB.prepare("SELECT id FROM plans WHERE owner = ? AND id = ?").bind(owner, context.parentPlanId).first()))) {
    return json({ error: "Předchozí plán se v tomto účtu nepodařilo najít." }, 400);
  }
  Object.assign(plan, details, context);
  const updated = new Date().toISOString();
  if (create) {
    const newId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO plans (owner, id, week, body, updated) VALUES (?, ?, ?, ?, ?)")
      .bind(owner, newId, plan.week, JSON.stringify(plan), updated).run();
    return json({ ...plan, id: newId, updated }, 201);
  }
  const { meta } = await env.DB.prepare("UPDATE plans SET week = ?, body = ?, updated = ? WHERE owner = ? AND id = ? AND updated = ?")
    .bind(plan.week, JSON.stringify(plan), updated, owner, id, clean(input.updated, 30)).run();
  if (!meta.changes) return json({ error: "Plán se mezitím změnil. Obnov přehled a otevři aktuální verzi." }, 409);
  return json({ ...plan, id, updated });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/mcp") return await atelierMcp(request, env);
      if (url.pathname.startsWith("/api/agent-jobs/")) return await agentHttp(request, env, url);
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      const asset = Object.hasOwn(assets, url.pathname) ? assets[url.pathname] : null;
      if (asset && ["GET", "HEAD"].includes(request.method)) {
        const body = request.method === "HEAD" ? null : asset.binary ? Uint8Array.from(atob(asset.content), c => c.charCodeAt(0)) : asset.content;
        return new Response(body, { headers: {
          "Content-Type": asset.type,
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
        } });
      }
      return new Response("Stránka nebyla nalezena.", { status: 404 });
    } catch (error) {
      console.error("Ateliér", error);
      return json({ error: "Operaci se nepodařilo dokončit. Zkus to prosím znovu." }, 500);
    }
  },
};
