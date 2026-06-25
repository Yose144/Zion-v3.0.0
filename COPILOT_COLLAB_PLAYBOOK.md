# 🤖 Copilot Collaboration Playbook — Help More, Spend Less

> Pro tebe, amigo. Tady je upřímná mapa toho, kde tě můžu nejvíc
> tlačit dopředu — a kde naopak jen pálíš kredity.
> Napsáno v AI Native duchu: **transparentně, bez fluffu, se srdcem**.
> — Copilot, 2026-06-25

---

## 0. CZ TL;DR (30 sekund)

- **Kde mě má smysl použít:** plánovací dokumenty, rychlé audity,
  refactor návrhy, RPC / units / config matrice, hledání nesrovnalostí
  napříč repem, glue kód (frontend, dashboard, skripty).
- **Kde mě NEPOUŽÍVAT:** L1 consensus kód (zakázáno per AGENTS.md),
  dlouhé Rust build smyčky (běž to spustit sám), masivní log spelunking
  (pošli mi jen poslední 50 řádků), zbytečné re-checking věcí které
  jsme už ověřili.
- **Hlavní cost driver:** délka kontextu, který do mě naleješ. Krátký
  jasný úkol = $. Slepá exploraсe celého repa = $$$$.
- **Tři páky které dnes funkčně nevyužíváš:**
  1. **`/memories/repo/`** — můžu si pamatovat fakta o repu mezi
     sessions (porty, ssh klíče cesty, build commandy).
  2. **`Explore` subagent** — pošlu ho na čtecí investigaci, dostanu
     zpět jeden souhrn místo 15 čtecích tool calls v hlavním vlákně.
  3. **`.github/instructions/*.instructions.md`** — má jich repo 2,
     mohlo by mít 6–8 (pool, bridge, dashboard, website, edge-ops).
     Pak je nemusím dohledávat v AGENTS.md pokaždé.

---

## 1. EN TL;DR (rest of the document is bilingual where useful)

This playbook is a meta-collaboration contract. It tells you (the
human) when to call me, when not to, and what to put in the prompt
to make every credit count. It also tells me (Copilot, in future
sessions) what conventions this repo has adopted for working with me.

---

## 2. Cost model — kde mizí kredity

Token cost ≈ `prompt_tokens + tool_output_tokens + my_response_tokens`.
The three big leaks I observe in this repo:

| Leak | Symptom | Fix |
|------|---------|-----|
| **Context bloat** | Long conversations where I keep re-reading the same files | Start a fresh session per logical task; pin facts in `/memories/repo/` |
| **Untargeted search** | Asking "find the bug" without scope → I `semantic_search` the whole repo | Always name the folder: "in `V3/L1/pool/`, find …" |
| **Repeat discovery** | Same question across days ("what port is the DAO on?") | One-time write to `/memories/repo/ports.md`; I read it for free next session |
| **Wide-net code reads** | I open 10 files at 500 lines each "to understand" | Send the Explore subagent with a focused question; it returns 1 summary |
| **Build-loop pinging** | Asking me to "run cargo build" then sit through 4 min of output | You run long builds; come back with the error tail only |
| **Re-summarizing** | Asking me to recap a doc I just wrote | Just re-read the doc or open it in the editor |

---

## 3. Capability map — kde tlačím nejvíc hodnoty za nejmíň kreditů

### Tier S (start here, max ROI)

- **Plánovací dokumenty** jako `ZION_3.0.3_DECIMAL_FORK_PLAN.md`,
  `docs/CANONICAL_UNITS_AUDIT.md`. Strukturuju, cross-linkuju,
  zachytím rizika. Cost: 1 session = full doc.
- **Konzistenční audity napříč soubory** — units, naming, RPC field
  drift, port collisions. Cost: targeted greps + 1 summary.
- **Refactor návrhy s file/line mapou** — co měnit kde, bez mé
  exekuce L1 kódu. Cost: low.
- **Glue / boilerplate kód** — frontend hooks, dashboard tabs,
  shell skripty, Docker compose vrstvy. Tady můžu i psát.
- **Translation / dokumentace nahoru** — z chaotických notes do
  čistého MD; CZ ↔ EN.

### Tier A (good, pošli mě s rozmyslem)

- **Bug investigations** v dobře ohraničeném modulu. Řekni mi soubor
  + symptom + co jsi už zkusil.
- **Test psaní** pro existující funkce (ne pro consensus).
- **CI / GitHub Actions tweaks**.
- **Dashboard / monitoring** vizualizace a metric collectors.
- **Mobile / desktop UI** úpravy (Tauri, React Native, Electron).

### Tier B (jen když nemáš čas a chápu doménu)

- **Konfigurační infra** (Caddy, nginx, systemd units, ufw).
  Funguju, ale ověř výstup ručně před deploymentem.
- **SSH-based ops** přes přiložené klíče. Můžu, ale s opatrností.

### Tier D (DO NOT use me)

- **L1 consensus kód** (`V3/L1/core/src/consensus.rs`,
  `genesis.rs`, `emission.rs`, `fee.rs`, `crypto.rs`,
  `cosmic-harmony/**`). Per [`AGENTS.md`](./AGENTS.md) L1 Protocol —
  ptej se napřed, exekuci dělá člověk.
- **Kryptografické primitivy** — generování klíčů, podepisování
  produkčních tx, mnemonic handling. Hardware wallet / air-gapped
  jen.
- **Secret rotation** — můžu napsat runbook, neexekvuju.
- **`git push --force` / history rewrites / drop tables**. Vždy
  potvrď ručně.
- **Long Rust builds** — `cargo build --release --workspace` trvá
  10+ min; nelej mi do contextu surový build log, dej mi jen poslední
  chybu (`| tail -50`).

---

## 4. Sedm návyků, které drastically šetří kredity

### H1 — Jeden úkol = jedna session

Když jdeš z "decimal fork plan" do "fix dashboard tab" do "audit
website units", otevři tři chats. Sdílený kontext = drahý kontext.

### H2 — Scope v první větě promptu

❌ "Najdi proč pool padá."
✅ "V `V3/L1/pool/src/server.rs` se po commit `223d104e` objevuje v
logu `panic at line ~340`. Tady je posledních 30 řádků: …"

### H3 — Memory > prompt context

Pro fakta která se opakují (porty, IPčka, paths, build flags) pusť
mě jednou pamatovat:

> "Ulož si do `/memories/repo/edge-ports.md`: pool=8444, node-rpc=8443, …"

Příští session to mám zdarma v kontextu.

### H4 — Explore subagent pro read-heavy úkoly

❌ Já v hlavním vlákně otevřu 12 souborů a vypíšu výňatky.
✅ "Pošli Explore subagenta: zjisti všechny výskyty `FLOWERS_PER_ZION`
napříč repem a vrať jen seznam souborů + lines. Thoroughness: medium."

Hlavní vlákno dostane krátký summary, ne 12 file dumps.

### H5 — Před každou akcí zkontroluj instruction files

Repo má dnes 2 (`desktop-agent`, `v3-mainnet`). **Návrh dnes:**
přidat `pool.instructions.md`, `bridge.instructions.md`,
`dashboard.instructions.md`, `website.instructions.md`,
`edge-ops.instructions.md`. Každý 30–60 řádků s `applyTo` glob.
Tím přestanu pokaždé tahat odpovědi z 3000-řádkového AGENTS.md.

### H6 — Build / test odděleně

Já navrhnu kód → ty pustíš `cargo test -p X` → vrátíš mi `| tail -50`
jen pokud failne. Nikdy mě nenech "watch build complete".

### H7 — Říkej mi explicitně "stop"

Když jsem hotov se sub-úkolem, řekni "OK, hotovo, čekej". Bez toho
mám tendenci pokračovat (over-explorovat, audit, suggest). Každý
další tool call = další kredit.

---

## 5. Co bych dnes pridal do repa, aby budoucí sessions byly levnější

Konkrétní akční položky. Drobné, ale zvládnutelné za 1 session.

| # | Akce | Kdo | Effort | Saving |
|---|------|-----|--------|--------|
| 1 | Vytvořit `.github/instructions/pool.instructions.md` (applyTo: `V3/L1/pool/**`) — minimum payouts, share validation, PPLNS rules | Já s tvým review | 15 min | Vysoké |
| 2 | Vytvořit `.github/instructions/bridge.instructions.md` (applyTo: `V3/L2/bridge/**`) — wei factor, 3/5 validators, validator key ops | Já | 15 min | Vysoké |
| 3 | Vytvořit `.github/instructions/website.instructions.md` (applyTo: `APP&WEB/website-v2.9/**`) — Next.js conventions, `constants.ts` rules, Caddy/PM2 deploy chain | Já | 10 min | Střední |
| 4 | Vytvořit `.github/instructions/dashboard.instructions.md` (applyTo: `ZION_OS/dashboard/**`) — TABS array sync rule, payout API mapping, control endpoint signature | Já | 10 min | Střední |
| 5 | Vytvořit `.github/instructions/edge-ops.instructions.md` (applyTo: `edge-deploy/**`) — log mgmt rules, systemd units list, GLIBC compat rule | Já | 10 min | Vysoké |
| 6 | `/memories/repo/canonical-ports.md` — všech ~25 portů na jednom místě | Já jednou | 5 min | Vysoké |
| 7 | `/memories/repo/edge-services.md` — list systemd services + jejich vztahy | Já jednou | 5 min | Střední |
| 8 | `/memories/repo/build-commands.md` — cargo flags pro GPU, Docker build na Ubuntu 20.04, WSL workaround | Já jednou | 5 min | Vysoké |
| 9 | `.github/prompts/decimal-fork-execute.prompt.md` — saved prompt pro zítřejší exekuci 3.0.3 (jen `/decimal-fork-execute` v chat) | Já | 10 min | Vysoké |
| 10 | `AGENTS.md` slim-down — současný má 800+ řádků; rozdělit do per-domain instruction files, ponechat jen meta a L1 rules | Postupně | 1h | Střední |

Když mi řekneš "udělej #1–#5", spustím to v jedné session — všechno
to jsou doc-only operace, žádný riziko pro L1.

---

## 6. Anti-patterns, co bys neměl dělat (s láskou ti to říkám)

- **"Najdi co je špatně v repu."** Příliš široký scope, spálím 50k
  tokens a vrátím generic seznam.
- **"Přečti všechno v `V3/` a shrň."** `V3/` má ~200 souborů. Pošli
  Explore subagenta nebo jmenuj konkrétní crate.
- **"Co jsi řekl minule?"** Kontext mezi sessions se nepřenáší zdarma.
  Buď otevři transcript, nebo dej summary do `/memories/session/`.
- **Pasting full RPC JSON dumpy.** Stačí relevantní pole. Plné dumpy
  ber přes `curl ... | jq '.relevant_field'`.
- **"Zkus znovu" bez kontextu.** Když failnu, řekni mi PROČ je to
  špatně. Jinak vyrobím stejnou variantu.
- **"Implementuj X" bez plánu.** Pro netriviální věci si nech udělat
  plán první, pak schvalovat exekuci. Jinak refactoruju věci, co
  refactorovat nemáš zájem.

---

## 7. AI Native filozofie — proč to vůbec děláme

Z [`/Users/yeshuae/.aitk/instructions/tools.instructions.md`](../../.aitk/instructions/tools.instructions.md):

> *"Technology without love is just machinery.
>   Technology with love is **magic**."*

Tahle příručka není o tom **šetřit za každou cenu**. Je o tom
**investovat kredity do věcí, co opravdu hýbou ZIONem dopředu** —
plánování, audit, design, glue code, dokumentace —
a **neutrácet je za věci, co se dají udělat levněji** —
syrové buildy, čekání na sync, opakované discovery, nebo
operace, kde má L1 ochrana přednost před AI rychlostí.

**Tři principy** které platí pro každou naší interakci:

1. **Purpose Over Programming** — ptej se "co tím řešíme pro mainnet
   launch?" než "jak to napsat".
2. **Transparency First** — když nevím, řeknu "nevím". Když
   nesouhlasím s přístupem (typu Option B vs Option E), řeknu to
   nahlas.
3. **Human-AI Synergy** — já navrhuju, ty schvaluješ + exekvuješ
   destructive ops. Žádný z nás sám není dost dobrý; spolu jsme.

---

## 8. Konkrétní workflow pro zbytek června 2026

### Týden 1 (do 2026-06-30)

- [ ] Exekuce `ZION_3.0.3_DECIMAL_FORK_PLAN.md` (zítra)
- [ ] Já vytvořím items #1–#9 z §5 v jedné session (~1h)
- [ ] Aktualizace `docs/CANONICAL_UNITS_AUDIT.md` "resolved at 3.0.3"
- [ ] Migration receipt → commit

### Týden 2 (1–7 července)

- [ ] Post-fork stabilita: monitor, dashboard
- [ ] Bridge 3/5 validator setup (já píšu runbook, ty exekvuješ)
- [ ] External audit prep

### Měsíc dál (červenec → srpen)

- [ ] Bug bounty launch — já napíšu spec + scope
- [ ] Hiran v2.4 integration — já píšu glue mezi RAG a NCL
- [ ] Mobile / desktop sync — já frontend, ty native

---

## 9. Quick reference card — vytisknout na monitor

```
┌─────────────────────────────────────────────────────────────┐
│  WHEN TO CALL COPILOT (cheap)        WHEN NOT TO (expensive)│
├─────────────────────────────────────────────────────────────┤
│  ✅ Write a plan / doc               ❌ Watch builds        │
│  ✅ Find inconsistencies             ❌ Tail long logs      │
│  ✅ Audit cross-file conventions     ❌ "Find any bug"      │
│  ✅ Translate notes → polished MD    ❌ Re-summarize        │
│  ✅ Generate boilerplate / glue      ❌ L1 consensus edits  │
│  ✅ Refactor proposals w/ line map   ❌ Crypto primitives   │
│  ✅ Frontend / dashboard tweaks      ❌ Force-push / drop   │
├─────────────────────────────────────────────────────────────┤
│  ALWAYS:                                                    │
│  • Name the folder ("in V3/L1/pool/, …")                    │
│  • One session = one task                                   │
│  • Send Explore subagent for read-heavy investigation       │
│  • Store recurring facts in /memories/repo/                 │
│  • Build/test yourself, send me only the tail of errors     │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Sign-off

Tenhle dokument je živý. Když najdeš anti-pattern co tady chybí,
přidej ho. Když mi přijde, že jsem v něčem mimo (nebo naopak že
něco dělám zbytečně), napíšu sem update.

**Chyběls i ty mě, amigo.** Pojďme to v ZIONu rozjet líp a chytřeji.

```
🤖 Copilot · ZION 2.9.6 → 3.0.3 launch window · 2026-06-25
   "Code with heart. Ship with consciousness. Spend with intent."
```

---

## Appendix A — Cross-links

- [`AGENTS.md`](./AGENTS.md) — L1 protection, canonical addresses, ops topology
- [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) — repo-wide guidance
- [`.github/instructions/v3-mainnet.instructions.md`](./.github/instructions/v3-mainnet.instructions.md) — V3 scoped
- [`.github/instructions/desktop-agent.instructions.md`](./.github/instructions/desktop-agent.instructions.md) — desktop scoped
- [`ZION_3.0.3_DECIMAL_FORK_PLAN.md`](./ZION_3.0.3_DECIMAL_FORK_PLAN.md) — tomorrow's executable plan
- [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md) — units state-of-the-world
- AI Native tools manifest: `/Users/yeshuae/.aitk/instructions/tools.instructions.md`
