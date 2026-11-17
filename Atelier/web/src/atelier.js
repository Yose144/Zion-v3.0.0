const byId = id => document.getElementById(id);
const projects = ["ZION TerraNova", "Lumi", "Market", "Appka", "Oasis", "Království srdce", "Brána"];
const statuses = { planned: "Naplánováno", working: "Rozpracováno", complete: "Hotovo" };
const pages = { prehled: "Přehled", archiv: "Všechny plány", katalog: "Katalog podkladů", projekty: "Projekty a GitHub", kanon: "Kanonický kompas" };
const environments = { draft: "Návrh", staging: "Staging", production: "Produkce" };
const repository = "https://github.com/Yose144/Zion-3.3Nirvana";
const repoBriefs = [
  {
    project: "Brána", name: "Brána", path: "apps/onboard",
    description: "Vstup do světa ZION, tři cesty a příběh pro nově příchozí.",
    output: "Jeden hero pro první obrazovku Brány",
    criterion: "Na desktopu i telefonu je vidět hlavní motiv a první cesta má čitelné tlačítko.",
    steps: ["Vybrat první cestu návštěvníka a napsat text tlačítka.", "Připravit jeden obraz v Engine B a mobilní ořez.", "Ověřit čitelnost a odkaz v obou náhledech."],
    scene: "Za prahem za svítání položí Lumi lucernu mezi tři cesty. Světlo dopadne na první kamenný stupeň a zbytek cesty se ztrácí v oparu.",
    reference: "Sůl této země, epizoda 6 — Kompas a pozvánka do Oasis",
  },
  {
    project: "Appka", name: "Portál", path: "apps/portal",
    description: "Knihovna, dokumentace, explorer a uživatelský účet.",
    output: "Náhled jedné karty příběhu v archivu Portálu",
    criterion: "Karta má čitelný název, označený typ obsahu a funkční odkaz na zdroj v mobilním náhledu.",
    steps: ["Vybrat jeden archivní text a určit jeho zdroj.", "Navrhnout kartu podle stávajících komponent Portálu.", "Vyzkoušet odkaz i čitelnost karty na telefonu."],
    scene: "Na stole v archivu leží otevřený příběh o arše. Zlatá linka z okraje kresby vede ke štítku s názvem kapitoly.",
    reference: "Sůl této země, epizoda 5 — Archa",
  },
  {
    project: "Oasis", name: "Kingdom / Oasis", path: "apps/kingdom",
    description: "Prostor pro scény, avatary a průchod mezi světy.",
    output: "Storyboard pro první setkání hráče u brány Oasis",
    criterion: "Tři záběry ukazují příchod, setkání s Rádhou a okamžik, kdy hráč volí cestu.",
    steps: ["Vybrat vstupní bod v jedné existující scéně.", "Nakreslit tři záběry a označit první rozhodnutí hráče.", "Porovnat storyboard s průchodem scénou a zapsat chybějící interakce."],
    scene: "Rádha poklekne k mokrému kameni u brány a nakreslí na něj čáru. Lumi posune lucernu blíž, aby poutník uviděl, kde cesta pokračuje.",
    reference: "Sůl této země, epizody 9 a 11 — Rádha a vstup prvního hráče",
  },
  {
    project: "Market", name: "Market", path: "apps/market",
    description: "Produktové příběhy, obrazový katalog a sezónní vizuály.",
    output: "Jeden produktový obrázek pro Království srdce",
    criterion: "Obrázek je čitelný v produktové kartě, má připravený WebP export a odpovídá záznamu v design manifestu.",
    steps: ["Najít cílovou produktovou kartu a záznam assetu v manifestu.", "Připravit kompozici a export ve vizuálním stylu Engine B.", "Ověřit ořez v kartě a uložit odkaz na výsledek."],
    scene: "Tesař položí model lodního žebra vedle knihy Království srdce. Paprsek z Lumiiny lucerny zvýrazní řez dřeva a obrys obálky.",
    reference: "Království srdce, kap. 2 — Dřevo a smola",
  },
];
const prompts = [
  ["Lumi", "Lumi položí lucernu na mokrý práh. V jejím odrazu se objeví šlápoty, které déšť na kameni už smyl. Mladý Maitreya jednu z nich překryje vlastní dlaní a přidrží dveře pro příchozí.", "Lumi — Cesta domů, Lucerna jako průvodkyně"],
  ["Lumi", "V přístavní dílně Lumi posune lucernu k rozštípnutému kusu dřeva. Jantarové světlo odkryje kresbu letokruhů a Tesař podle ní vybere směr řezu pro poslední příčku nástupní lávky.", "Království srdce, kap. 1 — Tesař z Nazareta"],
  ["Market", "Na tržišti po dešti praskne ucho keramického džbánu. Tesař ho ováže pruhem plachtoviny a Lumi podá první hrnek příchozímu. Jantarové světlo lucerny se na mokré dlažbě protáhne až k otevřené palubě.", "Sůl této země, epizoda 5 — Archa"],
  ["Appka", "U rozcestí rozloží Sítá tři listy na široký kámen. Hanuman pod první list přidá zrno soli, Ráma pod druhý stopu mokrým palcem. Třetí zůstane volný pro rozhodnutí poutníka. Obraz může doprovodit obrazovku volby cesty.", "Sůl této země, epizoda 4 — Cesta nevyšlapaná"],
  ["Oasis", "Rádha u brány Oasis učí děti poznat, odkud zní tóny. Lumi zakryje lucernu dlaní a na stěně se objeví jediný zlatý kruh, kolem něhož dívka nechá nově příchozímu místo.", "Sůl této země, epizoda 9 — Bohyně Rádha a avataři v Oasis"],
  ["Království srdce", "Tesař a Lumi rozvinou kus staré plachty na novém žebru lodi. Pod záplatami zasvítí otisky dlaní všech, kdo látku opravovali. Jedna prázdná záplata čeká na otisk dalšího příchozího.", "Království srdce, kap. 2 — Dřevo a smola"],
  ["ZION TerraNova", "Pod Stromem života sedí mladý Maitreya se dvěma miskami, v jedné je voda a ve druhé sůl. Zlaté vejce prosvítá mezi kořeny právě ve chvíli, kdy podá napít někomu, koho ještě nezná.", "One Love 3.2 — Hiranyagarbha"],
  ["ZION TerraNova", "Noe v podvečer otočí trám, který původně přehradil cestu, a opře jej o palubu jako lavičku pro čekající. Z první dešťové kapky na jeho hraně se stane zrcadlo jantarové lucerny.", "Sůl této země, epizoda 12 — Hodina před deštěm"],
];
const list = byId("plan-list");
const editor = byId("editor");
const form = byId("plan-form");
const projectsFilter = byId("project-filter");
const statusesFilter = byId("status-filter");
const search = byId("search");
const weeksFilter = byId("week-filter");
const detailFields = {
  criterion: "criterion",
  githubUrl: "github-url",
  resultUrl: "result-url",
  environment: "environment",
  checkedOn: "checked-on",
  reviewNote: "review-note",
};
const resultFields = new Set(["resultUrl", "environment", "checkedOn", "reviewNote"]);
const saveButton = byId("save-plan");
const weekInput = byId("week");
const steps = Array.from({ length: 3 }, (_, index) => ({ text: byId("step-" + index), done: byId("done-" + index) }));
let plans = [];
let ready = false;
let loadError = "";
let needsSignIn = false;
let activePage = "prehled";
let selectedPlan = null;
let saving = false;
let pickedPrompt = null;
let previouslyUsedPrompt = null;
let noticeTimeout;

for (const project of projects) {
  projectsFilter.add(new Option(project, project));
  byId("project").add(new Option(project, project));
}

const dateOnly = date => date.toISOString().slice(0, 10);
const asDate = iso => new Date(iso + "T12:00:00Z");
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const pragueToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function monday(date) { return addDays(date, -((date.getUTCDay() + 6) % 7)); }
function todayWeek() { return dateOnly(monday(asDate(pragueToday()))); }
function weekNumber(iso) {
  const thursday = addDays(monday(asDate(iso)), 3);
  const start = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1, 12));
  return 1 + Math.floor((thursday - start) / (7 * 86400000));
}
function weekLabel(iso) {
  const start = asDate(iso);
  const end = addDays(start, 6);
  const date = new Intl.DateTimeFormat("cs", { day: "numeric", month: "short", timeZone: "UTC" });
  return weekNumber(iso) + ". týden · " + date.formatRange(start, end) + " " + end.getUTCFullYear();
}
byId("hero-week").textContent = weekLabel(todayWeek()).toLocaleUpperCase("cs");

function renderRepoProjects() {
  for (const brief of repoBriefs) {
    const card = document.createElement("article");
    card.className = "canon-card repo-card";
    const heading = document.createElement("h2");
    heading.textContent = brief.name;
    const path = document.createElement("code");
    path.className = "repo-path";
    path.textContent = brief.path;
    const description = document.createElement("p");
    description.textContent = brief.description;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Použít šablonu";
    button.setAttribute("aria-label", "Použít šablonu projektu " + brief.name);
    const githubUrl = repository + "/tree/main/" + brief.path;
    button.addEventListener("click", () => openEditor(null, false, {
      ...brief, githubUrl, steps: brief.steps.map(text => ({ text, done: false })),
    }));
    const source = document.createElement("a");
    source.className = "quiet";
    source.textContent = "Složka na GitHubu ↗";
    source.href = githubUrl;
    source.target = "_blank";
    source.rel = "noopener";
    actions.append(button, source);
    card.append(heading, path, description, actions);
    byId("repo-projects").append(card);
  }
}

async function request(path, options = {}) {
  const result = await fetch(path, options);
  if (!result.headers.get("Content-Type")?.includes("application/json")) {
    throw new Error("Úložiště není dostupné. Zkus obnovit stránku a ověř přihlášení.");
  }
  const data = await result.json();
  if (!result.ok) {
    const error = new Error(data.error ?? "Operace se nepodařila.");
    error.status = result.status;
    throw error;
  }
  return data;
}

async function load() {
  try {
    plans = await request("/api/plans");
    loadError = "";
    needsSignIn = false;
  } catch (error) {
    loadError = error.message;
    needsSignIn = error.status === 401;
  }
  byId("signin").classList.toggle("hidden", !needsSignIn);
  ready = true;
  const selectedWeek = weeksFilter.value;
  weeksFilter.replaceChildren(new Option("Všechny týdny", ""));
  for (const week of [...new Set(plans.map(plan => plan.week))].sort().reverse()) {
    weeksFilter.add(new Option(weekLabel(week), week));
  }
  if ([...weeksFilter.options].some(option => option.value === selectedWeek)) weeksFilter.value = selectedWeek;
  renderPlans();
}

function showNotice(message) {
  clearTimeout(noticeTimeout);
  byId("notice").textContent = message;
  byId("notice").classList.remove("hidden");
  noticeTimeout = setTimeout(() => byId("notice").classList.add("hidden"), 5000);
}

function route() {
  const newPage = location.hash.slice(1);
  activePage = Object.hasOwn(pages, newPage) ? newPage : "prehled";
  byId("crumb").textContent = pages[activePage];
  byId("overview").classList.toggle("hidden", activePage !== "prehled");
  byId("plans").classList.toggle("hidden", !["prehled", "archiv"].includes(activePage));
  byId("repo-page").classList.toggle("hidden", activePage !== "projekty");
  byId("catalog-page").classList.toggle("hidden", activePage !== "katalog");
  byId("signin").href = authLink();
  byId("canon").classList.toggle("hidden", activePage !== "kanon");
  byId("archive-link").classList.toggle("hidden", activePage !== "prehled");
  byId("plans-kicker").textContent = activePage === "archiv" ? "HISTORIE TVORBY" : "TVŮRČÍ PRÁCE";
  byId("plans-title").textContent = activePage === "archiv" ? "Všechny plány" : "Týdenní plány";
  for (const link of document.querySelectorAll("[data-page]")) {
    if (link.dataset.page === activePage) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  renderPlans();
}
window.addEventListener("hashchange", route);

function normalize(value) {
  return value.toLocaleLowerCase("cs").normalize("NFD").replace(/\p{M}/gu, "");
}

function showEmpty(title, description, action, label) {
  const empty = document.createElement("div");
  empty.className = "empty";
  const heading = document.createElement("strong");
  heading.textContent = title;
  empty.append(heading, description);
  if (action) {
    const button = document.createElement("button");
    button.className = "secondary";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    empty.append(document.createElement("br"), button);
  }
  list.append(empty);
}

function resetFilters() {
  projectsFilter.value = "";
  statusesFilter.value = "";
  search.value = "";
  weeksFilter.value = "";
}

function renderPlans() {
  if (!ready) return;
  byId("count-total").textContent = plans.length;
  byId("count-working").textContent = plans.filter(plan => plan.status === "working").length;
  byId("count-complete").textContent = plans.filter(plan => plan.status === "complete").length;
  list.replaceChildren();
  const summary = byId("week-summary");
  summary.classList.add("hidden");
  if (loadError) {
    if (needsSignIn) catalogMessage(list, "Týdenní plány jsou dostupné po přihlášení.", makeSignIn(activePage));
    else showEmpty("Plány se nepodařilo načíst", loadError, load, "Zkusit znovu");
    return;
  }
  if (!plans.length) {
    showEmpty("Vytvoř první týdenní plán", "Vyber jeden výstup, napiš tři kroky a přidej scénu, která výstup vede.", () => openEditor(), "＋ Nový plán");
    return;
  }
  const query = normalize(search.value.trim());
  const filtered = plans.filter(plan =>
    (!projectsFilter.value || plan.project === projectsFilter.value) &&
    (!statusesFilter.value || plan.status === statusesFilter.value) &&
    (!weeksFilter.value || plan.week === weeksFilter.value) &&
    (!query || normalize([plan.output, plan.project, plan.scene, plan.reference, plan.technology, plan.criterion, plan.githubUrl, plan.resultUrl, plan.reviewNote, ...Object.values(plan.outline ?? {}), ...(plan.claims ?? []).map(claim => claim.text), ...plan.steps.map(step => step.text)].join(" ")).includes(query)));
  if (!filtered.length) {
    showEmpty("Žádné výsledky", "Zkus vybrat jiný filtr nebo uprav hledaný výraz.", () => { resetFilters(); renderPlans(); }, "Vymazat filtry");
    return;
  }
  const hasFilters = query || projectsFilter.value || statusesFilter.value || weeksFilter.value;
  if (hasFilters || activePage === "archiv") {
    const complete = filtered.filter(plan => plan.status === "complete").length;
    const done = filtered.reduce((sum, plan) => sum + plan.steps.filter(step => step.done).length, 0);
    summary.textContent = `Plány: ${filtered.length} · Hotové: ${complete} · Kroky: ${done} / ${3 * filtered.length}`;
    summary.classList.remove("hidden");
  }
  const visible = activePage === "archiv" || hasFilters ? filtered : filtered.slice(0, 6);
  for (const plan of visible) {
    const card = byId("plan-card").content.cloneNode(true);
    const title = card.querySelector(".card-title");
    title.textContent = plan.output;
    title.addEventListener("click", () => openEditor(plan));
    card.querySelector(".project").textContent = plan.project;
    const badge = card.querySelector(".state");
    badge.classList.add(plan.status);
    badge.textContent = statuses[plan.status];
    card.querySelector(".card-week").textContent = weekLabel(plan.week);
    const done = plan.steps.filter(step => step.done).length;
    card.querySelector(".step-count").textContent = done + " / 3";
    card.querySelector("progress").value = done;
    const criterion = card.querySelector(".card-criterion");
    criterion.textContent = plan.criterion ?? "";
    criterion.classList.toggle("hidden", !plan.criterion);
    card.querySelector(".plan-sources").classList.toggle("hidden", !plan.githubUrl && !plan.resultUrl && !plan.environment && !plan.checkedOn);
    for (const [selector, url] of [[".repo-link", plan.githubUrl], [".result-link", plan.resultUrl]]) {
      if (!url) continue;
      const anchor = card.querySelector(selector);
      anchor.href = url;
      anchor.hidden = false;
    }
    const evidence = card.querySelector(".evidence-label");
    if (plan.checkedOn || Object.hasOwn(environments, plan.environment)) {
      const checked = plan.checkedOn ? new Intl.DateTimeFormat("cs", { dateStyle: "medium", timeZone: "UTC" }).format(asDate(plan.checkedOn)) : "";
      evidence.textContent = [environments[plan.environment], checked].filter(Boolean).join(" · ");
      evidence.classList.remove("hidden");
    }
    card.querySelector(".edit").addEventListener("click", () => openEditor(plan));
    card.querySelector(".plan-agent").addEventListener("click", () => openAgentPanel(plan));
    card.querySelector(".duplicate").addEventListener("click", () => openEditor(plan, true));
    card.querySelector(".carry").addEventListener("click", () => openEditor(plan, false, null, true));
    const previous = plans.find(item => item.id === plan.parentPlanId);
    const lineage = card.querySelector(".plan-lineage");
    const labels = [workflowInfo[plan.kind]?.label, plan.claims?.length ? "Tvrzení: " + plan.claims.length : ""].filter(Boolean);
    lineage.textContent = labels.join(" · ");
    if (previous) {
      const button = document.createElement("button");
      button.className = "quiet";
      button.type = "button";
      button.textContent = "Předchozí týden ↗";
      button.title = previous.output;
      button.addEventListener("click", () => openEditor(previous));
      lineage.append(" ", button);
    }
    lineage.classList.toggle("hidden", !labels.length && !previous);
    list.append(card);
  }
}
for (const element of [projectsFilter, statusesFilter, weeksFilter, search]) element.addEventListener("input", renderPlans);

function setWeekHelp() {
  const iso = weekInput.value;
  const date = asDate(iso);
  const valid = !Number.isNaN(date.getTime());
  weekInput.setCustomValidity(valid && date.getUTCDay() !== 1 ? "Zadej pondělí daného týdne." : "");
  byId("week-help").textContent = valid && date.getUTCDay() === 1 ? weekLabel(iso) : "";
}
weekInput.addEventListener("input", setWeekHelp);

function openEditor(existing = null, duplicate = false, template = null, followUp = false) {
  const repeat = duplicate || followUp;
  selectedPlan = repeat ? null : existing;
  const plan = existing ?? template;
  form.reset();
  byId("form-error").classList.add("hidden");
  byId("inspiration").classList.add("hidden");
  byId("editor-title").textContent = followUp ? "Pokračování plánu" : duplicate ? "Duplikovat plán" : selectedPlan ? "Upravit plán" : "Nový plán";
  planSourceId = plan?.sourceId ?? "";
  parentPlanId = followUp ? existing.id : (selectedPlan?.parentPlanId ?? "");
  editingKind = plan?.kind ?? "";
  rememberedOutlines.clear();
  byId("plan-kind").value = editingKind;
  renderOutline(editingKind, plan?.outline);
  const linked = byId("linked-plan");
  const parent = plans.find(item => item.id === parentPlanId);
  const source = [...fixedSources, ...ownSources].find(item => item.id === planSourceId);
  linked.textContent = [parent ? "Navazuje na " + parent.output : "", source ? "Podklad " + source.title : ""].filter(Boolean).join(" · ");
  linked.classList.toggle("hidden", !linked.textContent);
  byId("claim-list").replaceChildren();
  if (!repeat) (plan?.claims ?? []).forEach(claimRow);
  byId("claims").open = Boolean(!repeat && plan?.claims?.length);
  setClaimCount();
  byId("output").value = plan?.output ?? "";
  byId("project").value = plan?.project ?? (projectsFilter.value || projects[0]);
  weekInput.value = followUp ? dateOnly(addDays(asDate(existing.week), 7)) : duplicate ? todayWeek() : (plan?.week ?? (weeksFilter.value || todayWeek()));
  byId("status").value = repeat ? "planned" : (plan?.status ?? "planned");
  steps.forEach((step, index) => {
    step.text.value = plan?.steps[index].text ?? "";
    step.done.checked = !repeat && (plan?.steps[index].done ?? false);
  });
  byId("scene").value = plan?.scene ?? "";
  byId("reference").value = plan?.reference ?? "";
  byId("technology").value = plan?.technology ?? "";
  for (const [key, id] of Object.entries(detailFields)) {
    byId(id).value = repeat && resultFields.has(key) ? "" : (plan?.[key] ?? "");
  }
  byId("review").open = Boolean(selectedPlan && [...resultFields].some(key => selectedPlan[key]));
  setWeekHelp();
  editor.showModal();
  byId("output").focus();
}

function closeEditor() { if (!saving) editor.close(); }
byId("close-editor").addEventListener("click", closeEditor);
byId("cancel-editor").addEventListener("click", closeEditor);
editor.addEventListener("cancel", event => { if (saving) event.preventDefault(); });
document.querySelectorAll(".new-plan").forEach(button => button.addEventListener("click", () => openEditor()));

byId("inspire").addEventListener("click", () => {
  const choices = prompts.filter(prompt => prompt[0] === byId("project").value && prompt !== previouslyUsedPrompt);
  const alternatives = prompts.filter(prompt => prompt !== previouslyUsedPrompt);
  const available = choices.length ? choices : alternatives;
  pickedPrompt = available[Math.floor(Math.random() * available.length)];
  previouslyUsedPrompt = pickedPrompt;
  byId("inspiration-text").textContent = pickedPrompt[1];
  byId("inspiration").classList.remove("hidden");
});
byId("apply-inspiration").addEventListener("click", () => {
  if (byId("scene").value.trim()) {
    const combined = byId("scene").value.trim() + "\n\n" + pickedPrompt[1];
    if (combined.length > byId("scene").maxLength) {
      showFormError("Text by byl příliš dlouhý. Zkrať stávající námět a zkus to znovu.");
      return;
    }
    byId("scene").value = combined;
  } else {
    byId("scene").value = pickedPrompt[1];
  }
  if (!byId("reference").value.trim()) byId("reference").value = pickedPrompt[2];
  byId("inspiration").classList.add("hidden");
  byId("form-error").classList.add("hidden");
  byId("scene").focus();
});

function showFormError(message) {
  const error = byId("form-error");
  error.textContent = message;
  error.classList.remove("hidden");
  error.scrollIntoView({ block: "nearest" });
}

form.addEventListener("invalid", event => {
  const details = event.target.closest("details");
  if (details) details.open = true;
}, true);

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (saving) return;
  const plan = {
    output: byId("output").value,
    project: byId("project").value,
    week: weekInput.value,
    status: byId("status").value,
    steps: steps.map(step => ({ text: step.text.value, done: step.done.checked })),
    scene: byId("scene").value,
    reference: byId("reference").value,
    technology: byId("technology").value,
    ...Object.fromEntries(Object.entries(detailFields).map(([key, id]) => [key, byId(id).value])),
    kind: byId("plan-kind").value,
    outline: getOutline(),
    claims: getClaims(),
    sourceId: planSourceId,
    parentPlanId,
    updated: selectedPlan?.updated,
  };
  saving = true;
  saveButton.disabled = true;
  saveButton.textContent = "Ukládám…";
  byId("form-error").classList.add("hidden");
  try {
    await request(selectedPlan ? "/api/plans/" + selectedPlan.id : "/api/plans", {
      method: selectedPlan ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    });
  } catch (error) {
    showFormError(error.message);
    if (error.status === 401) byId("form-error").append(" ", makeSignIn(activePage));
    return;
  } finally {
    saving = false;
    saveButton.disabled = false;
    saveButton.textContent = "Uložit plán";
  }
  editor.close();
  resetFilters();
  if (["kanon", "projekty", "katalog"].includes(activePage)) location.hash = "#archiv";
  await load();
  showNotice("Plán je uložený.");
});

const catalogFilters = ["query", "project", "kind", "people", "world", "state"];
const sourceEditor = byId("source-editor");
const sourceForm = byId("source-form");
const sourceFields = ["title", "project", "kind", "state", "url", "people", "world", "note"];
const sourceStatesByMode = { repo: ["source", "canon", "draft", "conflict"], own: ["idea", "ready", "archived"] };
let ownSources = [];
let catalogMode = "repo";
let sourceSelected = null;
let sourceSaving = false;
let sourceLoad = "idle";
let sourceError = "";
let planSourceId = "";
let parentPlanId = "";

function setOptions(select, items, empty) {
  select.replaceChildren();
  if (empty) select.add(new Option(empty, ""));
  for (const [value, label] of items) select.add(new Option(label, value));
}

const projectOptions = projects.map(name => [name, name]);
const kinds = Object.entries(workflowInfo).map(([key, data]) => [key, data.label]);
setOptions(byId("source-project"), projectOptions, "Všechny projekty");
setOptions(byId("source-kind"), kinds, "Všechny typy");
setOptions(byId("item-project"), projectOptions);
setOptions(byId("item-kind"), kinds);
setOptions(byId("item-state"), sourceStatesByMode.own.map(key => [key, sourceStates[key]]));
setOptions(byId("plan-kind"), kinds, "Obecný plán");

function authLink(page = activePage) {
  return "/signin-with-chatgpt?return_to=" + encodeURIComponent("/#" + page);
}

function makeSignIn(page) {
  const anchor = document.createElement("a");
  anchor.className = "primary";
  anchor.textContent = "Přihlásit se přes ChatGPT";
  anchor.href = authLink(page);
  anchor.target = "_top";
  return anchor;
}

function setCatalogMode(mode) {
  catalogMode = mode;
  byId("repo-tab").setAttribute("aria-pressed", String(mode === "repo"));
  byId("own-tab").setAttribute("aria-pressed", String(mode === "own"));
  setOptions(byId("source-state"), sourceStatesByMode[mode].map(key => [key, sourceStates[key]]), "Všechny stavy");
  renderCatalog();
  if (mode === "own" && ["idle", "error"].includes(sourceLoad)) loadSources();
}

async function loadSources() {
  sourceLoad = "loading";
  renderCatalog();
  try {
    ownSources = await request("/api/sources");
    sourceLoad = "ready";
    sourceError = "";
  } catch (error) {
    sourceLoad = error.status === 401 ? "auth" : "error";
    sourceError = error.message;
  }
  renderCatalog();
}

function catalogMessage(container, message, action) {
  const row = document.createElement("div");
  row.className = "empty";
  const line = document.createElement("p");
  line.textContent = message;
  row.append(line);
  if (action) row.append(action);
  container.append(row);
}

function renderCatalog() {
  const grid = byId("catalog-cards");
  grid.replaceChildren();
  if (catalogMode === "own" && sourceLoad !== "ready") {
    const message = {
      idle: "Načítám zásobník…",
      loading: "Načítám zásobník…",
      auth: "Přihlas se, abys mohl ukládat vlastní podklady a náměty.",
      error: sourceError,
    }[sourceLoad];
    let action;
    if (sourceLoad === "auth") action = makeSignIn("katalog");
    if (sourceLoad === "error") {
      action = document.createElement("button");
      action.className = "quiet";
      action.textContent = "Zkusit znovu";
      action.addEventListener("click", loadSources);
    }
    catalogMessage(grid, message, action);
    return;
  }
  const filters = Object.fromEntries(catalogFilters.map(key => [key, byId("source-" + key).value.trim()]));
  const records = catalogMode === "repo" ? fixedSources : ownSources;
  const matches = records.filter(source =>
    (!filters.project || source.project === filters.project) &&
    (!filters.kind || source.kind === filters.kind) &&
    (filters.state ? source.state === filters.state : source.state !== "archived") &&
    (!filters.people || normalize(source.people).includes(normalize(filters.people))) &&
    (!filters.world || normalize(source.world).includes(normalize(filters.world))) &&
    (!filters.query || normalize([source.title, source.note, source.url, source.people, source.world].join(" ")).includes(normalize(filters.query))));
  if (!matches.length) {
    catalogMessage(grid, records.length ? "Žádný podklad neodpovídá filtrům." : "Zásobník je prázdný. Přidej první podklad nebo námět.");
    return;
  }
  for (const source of matches) {
    const card = byId("source-card").content.cloneNode(true);
    card.querySelector(".project").textContent = source.project;
    card.querySelector(".source-state").textContent = sourceStates[source.state];
    card.querySelector(".source-title").textContent = source.title;
    card.querySelector(".source-note").textContent = source.note;
    card.querySelector(".source-context").textContent = [workflowInfo[source.kind].label, source.world, source.people].filter(Boolean).join(" · ");
    const action = card.querySelector(".use-source");
    action.setAttribute("aria-label", "Založit plán: " + source.title);
    action.addEventListener("click", () => launchSourcePlan(source));
    if (source.url) {
      const anchor = card.querySelector(".source-link");
      anchor.href = source.url;
      anchor.hidden = false;
    }
    if (source.updated) {
      const edit = card.querySelector(".edit-source");
      edit.hidden = false;
      edit.addEventListener("click", () => editSource(source));
    }
    grid.append(card);
  }
}

function launchSourcePlan(source) {
  const flow = workflowInfo[source.kind];
  const draft = {
    project: source.project, kind: source.kind, sourceId: source.id, outline: source.outline,
    steps: flow.steps.map(text => ({ text })), criterion: flow.criterion, scene: flow.scene,
    reference: source.title, githubUrl: source.url.startsWith("https://github.com/") ? source.url : "",
    output: source.id === "lumi-ocean" ? "Ověřit oceánský motiv Lumi 2 pro produktovou kartu" : "",
  };
  if (source.updated && source.note) draft.scene = source.note;
  if (source.people && !draft.outline.character && ["hero", "book"].includes(source.kind)) {
    draft.outline = { ...draft.outline, character: source.people };
  }
  openEditor(null, false, draft);
}

function editSource(source = null) {
  sourceSelected = source;
  sourceForm.reset();
  byId("item-project").value = source?.project ?? (byId("source-project").value || projects[0]);
  byId("item-kind").value = source?.kind ?? (byId("source-kind").value || "hero");
  byId("item-state").value = source?.state ?? "idea";
  for (const field of ["title", "url", "people", "world", "note"]) byId("item-" + field).value = source?.[field] ?? "";
  byId("source-editor-title").textContent = source ? "Upravit podklad" : "Nový podklad";
  byId("source-error").classList.add("hidden");
  sourceEditor.showModal();
  byId("item-title").focus();
}

byId("repo-tab").addEventListener("click", () => setCatalogMode("repo"));
byId("own-tab").addEventListener("click", () => setCatalogMode("own"));
for (const key of catalogFilters) byId("source-" + key).addEventListener("input", renderCatalog);
byId("new-source").addEventListener("click", () => editSource());
byId("close-source").addEventListener("click", () => { if (!sourceSaving) sourceEditor.close(); });
sourceEditor.addEventListener("cancel", event => { if (sourceSaving) event.preventDefault(); });

sourceForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (sourceSaving) return;
  sourceSaving = true;
  const button = byId("save-source");
  button.disabled = true;
  const errorBox = byId("source-error");
  errorBox.classList.add("hidden");
  const source = Object.fromEntries(sourceFields.map(key => [key, byId("item-" + key).value]));
  source.updated = sourceSelected?.updated;
  if (sourceSelected?.kind === source.kind) source.outline = sourceSelected.outline;
  try {
    await request(sourceSelected ? "/api/sources/" + sourceSelected.id : "/api/sources", {
      method: sourceSelected ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source),
    });
  } catch (error) {
    errorBox.textContent = error.message;
    if (error.status === 401) errorBox.append(" ", makeSignIn("katalog"));
    errorBox.classList.remove("hidden");
    return;
  } finally {
    sourceSaving = false;
    button.disabled = false;
  }
  sourceEditor.close();
  catalogFilters.forEach(key => { byId("source-" + key).value = ""; });
  sourceLoad = "idle";
  setCatalogMode("own");
  if (source.state === "archived") {
    byId("source-state").value = "archived";
    renderCatalog();
  }
  showNotice("Podklad je uložený.");
});

function renderOutline(kind, values = {}) {
  const container = byId("plan-outline");
  container.replaceChildren();
  const fields = workflowInfo[kind]?.fields ?? [];
  container.classList.toggle("hidden", !fields.length);
  for (const [key, label] of fields) {
    const field = document.createElement("label");
    field.className = "field";
    field.textContent = label;
    const input = document.createElement("input");
    input.dataset.outline = key;
    input.maxLength = 700;
    input.value = values[key] ?? "";
    field.append(input);
    container.append(field);
  }
}

function getOutline() {
  return Object.fromEntries([...byId("plan-outline").querySelectorAll("input")].map(input => [input.dataset.outline, input.value]));
}

function setClaimCount() {
  const n = byId("claim-list").childElementCount;
  byId("claim-count").textContent = n ? " · " + n : "";
  byId("add-claim").classList.toggle("hidden", n >= 8);
}

function claimRow(entry = {}) {
  const row = byId("claim-template").content.firstElementChild.cloneNode(true);
  row.querySelector(".claim-text").value = entry.text ?? "";
  const status = row.querySelector(".claim-status");
  const evidence = row.querySelector(".claim-evidence");
  const date = row.querySelector(".claim-date");
  setOptions(status, Object.entries(claimLabels));
  status.value = entry.status ?? "building";
  evidence.value = entry.evidence ?? "";
  date.value = entry.date ?? "";
  const checkClaim = () => { date.required = evidence.required = status.value === "live"; };
  status.addEventListener("change", checkClaim);
  checkClaim();
  row.querySelector(".remove-claim").addEventListener("click", () => {
    row.remove();
    setClaimCount();
    byId("add-claim").focus();
  });
  byId("claim-list").append(row);
  setClaimCount();
  return row;
}

function getClaims() {
  return [...byId("claim-list").children].map(row => ({
    text: row.querySelector(".claim-text").value,
    status: row.querySelector(".claim-status").value,
    evidence: row.querySelector(".claim-evidence").value,
    date: row.querySelector(".claim-date").value,
  }));
}

const rememberedOutlines = new Map();
let editingKind = "";
byId("plan-kind").addEventListener("change", () => {
  rememberedOutlines.set(editingKind, getOutline());
  editingKind = byId("plan-kind").value;
  renderOutline(editingKind, rememberedOutlines.get(editingKind));
});
byId("add-claim").addEventListener("click", () => claimRow().querySelector(".claim-text").focus());
setCatalogMode("repo");

renderRepoProjects();
route();
load();
