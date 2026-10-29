# Vast + Hiran — sjednocený Coding Agent

> Draft 2026-10-29 · sjednocuje `/vast-rigs/#ai`, fleet agent (2.B11) a Hiran Agent CLI (B2B-3b).  
> Auth/platby Hiran: [`HIRAN-CLI-AUTH.md`](../../HIRAN-CLI-AUTH.md) · Mining/inference ops: [`VASTAI-MINING.md`](../../VASTAI-MINING.md) §5.

## 1. Problém

Tři stopy běží odděleně — **neslučovat binárky**, skládat vrstvy:

| Stopa | Povrch | Dnes | Mezera |
|---|---|---|---|
| **vast-rigs `#ai`** | `Dashboard.tsx` + `vastctl` `/api/inference/*` + `/api/ai/status` | katalog, vLLM deploy/stop/tunnel, single-turn chat, GPU status | coding loop, task queue, durable public OpenAI URL |
| **Fleet agent 2.B11** | `/api/agent/*`, `agent.py` | heartbeat, **jen** `op=exec` + úzký ops allowlist, sheets = miners | LLM, repo tools, coding job |
| **Hiran Agent CLI** | `V31/cli/src/agent/`, `zion hiran login` | local tool loop + ZIS + Stripe/MetaMask | remote vast cwd, model routing na GPU |

Cíl produktu: **ZION Vast Coding Agent** — jeden UX na `#ai`, runtime na rigu (hybrid), LLM přes sjednocený router.

**Inventura UX (29.10.):** `#ai` = opt-in inference pilot, **ne** autonomní coding runtime. Fleet agents karta je na **mining** tabu (jen když `status.json.agents` ≠ ∅). Nearest path dnes: deploy coder modelu → SSH tunnel → lokální `zion agent` na `LLM_BASE_URL=http://127.0.0.1:<port>/v1`.

## 2. Inventura online LLM (2026-10-29)

### Live wire (ops, ověřeno)

| Alias / zdroj | Host | Wire | Stav |
|---|---|---|---|
| `hiran-mini` | gateway `market…/v1` → EDGE2 `:8007` → `:8004` (PC tunnel) / `:8002` (CPU) | OpenAI `/v1` | **live** public |
| PC CUDA Hiran | ops PC `:8071` (`--alias zion-l3,hiran-v2.3mini`) přes proxy `:1235` | OpenAI | primary upstream |
| PC coder | `:8072` (`qwen2.5-coder…`) přes `:1235` | OpenAI | ops only |
| EDGE2 CPU | `zion-hiran-inference` `:8002` | OpenAI | degraded fallback ~2.4 tok/s |
| ai-native | EDGE2 `:8001` → LLM `:8004`/`:8002` | Maestro/RAG | web `/api/ai-chat` |
| Vast vLLM | rig `127.0.0.1:8000` (`VASTCTL_AI_PORT`) | OpenAI, loopback+SSH | opt-in; fleet=0 → idle |
| Fleet → LLM | — | — | **neexistuje** |

> Doc drift: starší B2B MVP může ukazovat Vega `:8070` / ai-native-in-path; live = gateway → OpenAI backends přímo.

### Katalog z `#ai` / `MODEL_CATALOG` (relevantní pro coding)

| Id / HF | Role | Poznámka |
|---|---|---|
| `Qwen3-Coder-30B`, `Devstral-Small-2-24B` | public vLLM coder weights | chat weights, **ne** agent framework |
| UI default typed | `Qwen/Qwen2.5-Coder-3B-Instruct` | custom HF id povolen i mimo katalog |
| `issobella` (internal) | tag code/agentic | mockup — není deployable vLLM |
| `hiran-v2.3mini` | internal llama.cpp | live chat, ne coding agent |
| Pin image | `vllm/vllm-openai:v0.8.5` | Docker required; mnoho Vast image bez Docker → llama.cpp path manuálně |

```
UI #ai ──chat/catalog──► Hiran gateway ──► PC :8004 / EDGE2 :8002
UI #ai ──deploy/status──► vast vLLM (loopback :8000)
CLI agent ─────────────► Hiran gateway (hiran-mini)
vast agent.py ─────────► exec only (bez LLM)
```

## 3. Cílová architektura (rozhodnutí: hybrid + compose)

**Compose, not merge:** fleet = host lifecycle + duty sheet; inference = GPU weights; coding = headless tool loop. CP **nikdy** nedostane unrestricted shell (Origin ≠ auth — jen `VASTCTL_AGENT_TOKEN`).

1. **Model fabric (gateway)** — aliasy:
   - `hiran-mini` — chat (beze změny)
   - `hiran-coder` — priorita: (1) healthy vast vLLM coder (2) PC `:8072` (3) EDGE2
2. **Coding worker na rigu** — dvě implementační cesty (F2 vybere jednu):
   - **A (prefer):** `agent.py` op `code.run` s tool jail (mirror CLI policy) + LLM local `:8000` nebo gateway
   - **B (fast path):** allowlistovaný `bash /root/zion-coder-job.sh` + headless `zion agent -p … --yes` v `/root/work` (reuse Rust tools; sheet `miner: none` / light mine)
3. **Control plane** — enqueue + result + TTL/diff caps; UI `#ai` karta; CLI `zion hiran agent --remote vast [--rig ID]`
4. **Duty / economics** — sheet nebo profit-switch: mine vs infer (B2B-3) vs code burst (GPU contention — žádný 80/20 scheduler dnes)
5. **Auth oddělení**
   - User LLM metering: ZIS `zis_*` (Hiran)
   - Fleet control: Bearer `VASTCTL_AGENT_TOKEN` / per-rig `rig_id:secret` (nikdy = user key)

```
UI / CLI ──enqueue code.run | coder-job──► vastctl ──heartbeat──► agent.py
agent.py ──tools jail | zion agent──► /workspace|/root/work
agent.py ──chat─────────────────────► local vLLM | gateway hiran-coder
agent.py ──result───────────────────► vastctl ──► UI
```

## 4. Security bounds (MVP)

- Žádný auto `git push` / force-push / amend shared history
- Shell bez pipes/redirects/chaining (stejně jako CLI MVP); **ne** rozšiřovat `exec` allowlist o `python`/`sh -c`/git/npm/cargo obecně
- Cwd default `/workspace` nebo `/root/work` — escape = deny
- Secret path deny list
- Coding = **samostatný op** nebo **pojedný** allowlistovaný skript (`/root/zion-coder-*.sh`) — ne open `exec`
- Ops mutations jen token (same-origin nestačí)
- Veřejný internet: inference zůstává loopback+SSH; gateway zůstává klíčovaný

## 5. Fáze

### F0 — Plány + model matrix (docs) — **tento dokument**

- [x] Kanon tento soubor
- [x] Křížové odkazy: Zionb2b §5 #4c, 3.2.1 → 2.B11, VASTAI §5, HIRAN-CLI-AUTH, B2B_HIRAN_AGENT_CLI
- [x] Trinity mockupy mapované (Amitábha / Issobella / Maitreya) → FT níže + [`HIRAN-MARKETPLACE-PLAN.md`](../../HIRAN-MARKETPLACE-PLAN.md)

### FT — Hiran Trinity train-first (ZION knowledge) — **před kvalitním coding agentem**

> Ano: dřív než „autonomní programátor na vastu“ má smysl **naučit rodinu ZIONu**.  
> Runtime F1–F3 mezitím může jet na `hiran-mini` + generic coder + RAG — FT zvedá *kvalitu*, ne blokuje *skafold*.

Trojice z katalogu (`mockup: true` dnes):

| Alias | Role | Base (plán) | Co se učí |
|---|---|---|---|
| **`hiran-amitabha`** | Hlas — deep reasoning | Qwen3-14B | protokol, ekonomika, L1–L6 rozhodování, dlouhé odpovědi |
| **`hiran-issobella`** | Code + agentic | Qwen3-Coder-30B-A3B | V31 API, pool/CLI, tool-use formát, agent turns |
| **`hiran-maitreya`** | Teacher / oracle | gemma-4 / Qwen ~27B | knižní korpus (Maitreya/Nirvana/Ekam…), lore, FAQ |

**Pořadí curriculum (doporučené):**

1. **Shared ZION constitution** — jeden system/RAG balík (fee 89/5/5/1, flowers, topologie, L1 lock) → už teď v ai-native; rozšířit dataset  
2. **Maitreya** — SFT/QLoRA nad legálním korpusem + FAQ (teacher, který drží „co je ZION“)  
3. **Amitábha** — reasoning SFT (rozhodovací stopy, runbooky, incident→fix)  
4. **Issobella** — coder SFT + tool traces z `zion agent` (read/edit/test) → teprve pak nahradí generic `hiran-coder`  
5. Export GGUF Q4/Q5 → `#ai` mockup→`live`; gateway aliasy

Checklist:

- [ ] Dataset pack: `docs/` + `canon/` allowlist + ops FAQ (licence — viz Marketplace §5)
- [ ] Eval suite „ZION komplexně“ (20–50 Q: emission, ports, WARP, pool, DAO…) — pass rate ≥ baseline mini
- [ ] QLoRA pipeline na vast (reuse `HiranDev.md` / v2.3 recept) — 1× smoke per persona
- [ ] `#ai` + gateway: mockup → live badge; `hiran-coder` default = Issobella když live
- [ ] Constitutční prompt sdílený všemi (anti-halucinace L1)

### F1 — Model fabric (paralelně s FT datasetem)

- [x] Gateway: probe + alias `hiran-coder` (vast tunnel / PC / EDGE2) — dočasně generic coder (`HIRAN_CODER_PRIMARY` default `:8005`)
- [x] Alias placeholder `hiran-amitabha|issobella|maitreya` → 503/`x-mockup` dokud FT nedodá váhy
- [x] `#ai`: badge „coder-ready“ / „trinity“ u katalogu + live endpoint chips
- [x] Smoke: trinity mockupy live na `market…/v1/models` (29.10.); `hiran-coder` se objeví až po coder tunnel `:8005` / live upstream (`health` teď `hiran-coder live:false`)

### F2 — Rig coding worker

- [x] Rozhodnutí: **A primary** (`op=code.run` v `agent.py` + `code_run.py`) · **B** allowlist `bash /root/zion-coder-job.sh` (stejný jail)
- [x] Tool jail: read/write/str_replace/run_shell/git_* — cwd `/root/work`, secret deny, shell allowlist, force writes
- [x] `vastctl.agent_enqueue`: `code.run` + `validate_code_run_args` (prompt cap 12k, max_turns ≤8, **no** llm_key from CP)
- [x] Result cap 24k pro code.run; unit testy `CodeRunPolicyTests` + enqueue
- [x] Bootstrap scp `code_run.py` + `zion-coder-job.sh` + `/root/work`
- [ ] Prerekvizita: enrolled rig (2.B11) — fleet=0 → 👤 rent + vLLM/coder na `:8000`
- [ ] Preferovaný model na rigu: Issobella GGUF / coder vLLM (po FT); dnes local `:8000` nebo `VAST_AGENT_LLM_URL`

**Enqueue (ops token):**
```bash
curl -sS -X POST https://zionterranova.com/api/agent/enqueue \
  -H "Authorization: Bearer $VASTCTL_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rig_id":"<id>","op":"code.run","args":{"prompt":"List files in workspace","max_turns":3}}'
```

### F3 — UX sjednocení

- [x] `#ai` karta **Coding Agent** (prompt, rig picker, log, cancel) — `POST /vast-ops/api/inference/code-run`
- [ ] Trinity picker: Amitábha (think) / Issobella (code) / Maitreya (ask lore) — až FT live
- [x] Fleet agents stav na `#ai` Coding Agent kartě (i při 0 agents = CTA enroll)
- [x] `zion hiran agent -p "…" --remote vast [--rig ID]` → enqueue + poll (`VASTCTL_AGENT_TOKEN`)
- [ ] Metering remote turns přes gateway (`zis_*`), ne přes fleet token — worker dnes local `:8000`
- [x] Soft-sell odkaz z Market `/ai` → vast-rigs `#ai` + CLI remote (deployed 29.10.)

**UI enqueue (ops basic + same-origin):**
```bash
# browser: /vast-rigs/#ai → Coding Agent
# CLI:
export VASTCTL_AGENT_TOKEN=…
zion hiran agent -p "Summarize /root/work" --remote vast
```

## 6. Mapování na existující ID

| ID | Vztah |
|---|---|
| **2.B11** Fleet W3 | F2 staví na heartbeat/enqueue; coding = nový op, ne náhrada `exec` |
| **B2B-3b** Hiran Agent CLI | F3 remote = stejný UX/prompt; local tools zůstávají |
| **B2B-3** Hiran API | F1 aliasy + metering |
| **HIRAN Marketplace** | FT = F4 fine-tune pipeline; trinity = §1 interní rodina |
| **VASTAI §5** | F1/F3 UI; deploy vLLM zůstává opt-in; train běží na vast GPU |

## 7. Success criteria

- FT: aspoň jedna persona (doporučeno Maitreya nebo Issobella) mockup→live + eval „ZION komplexně“ > mini baseline
- [x] F1: `/v1/models` = mini + trinity mockupy (live 29.10.)
- [x] F2: `code.run` enqueue + tool jail unit tests; bootstrap scp
- [x] F3: `#ai` Coding Agent + `zion hiran agent --remote vast` (kód 29.10.)
- [x] Deploy 29.10.: IntroPage `#ai` live (chunk obsahuje Coding Agent); Market `/ai` soft-sell; `vastctl serve` F3 endpoints (`code-run` same-origin 200)
- [x] E2E smoke 29.10. rig `58077390`: enroll + `code.run` → `read_file` + `SMOKE_OK` (rc=0). LLM = local OpenAI stub na `:8000` (image **bez Docker** → vLLM skip); mining zůstalo běžet.
- [ ] E2E s reálným coder weightem (vLLM/llama.cpp GGUF) na rigu s Dockerem
- [ ] `hiran-coder` v public listu po `:8005` tunnel
- Docs: tento plán + Marketplace + Zionb2b #4c/#4d + VASTAI §5 F1–F3

### E2E checklist

1. ~~Rent / reuse vast GPU~~ ✅ `58077390` RTX 3060  
2. ~~`bootstrap-agent.sh`~~ ✅ (serve musí mít `VASTCTL_ENROLL_TOKEN` v env)  
3. LLM na rigu `:8000` — stub smoke ✅ / vLLM až Docker image  
4. `#ai` Coding Agent nebo `POST …/code-run` ✅  
5. Result obsahuje tool turn + text; jail `/root/work` ✅

## 8. Known gaps (inventura → backlog)

1. Žádný coding-agent workload (Aider/OpenHands/…) — jen chat + vLLM
2. `exec` allowlist příliš úzký pro repo tooling (záměrně — F2 nesmí otevřít arbitrary shell)
3. Žádný durable public OpenAI base URL z rigu (loopback + tunnel)
4. Inference = single-turn; žádný tools/workspace/PR loop
5. Mining ↔ vLLM GPU contention; žádný duty scheduler
6. Docker required pro `vast_inference`; bez Docker = manuální llama.cpp
7. Catalog „coder“ = weights / roadmap tagy, ne wired agent framework

## 9. Out of scope

- Auto-rent vast nabídek pro coding
- Multi-GPU / tensor parallel napříč rigy
- Nahrazení Maestro / ai-native
- Public/archive CLI packaging
- Sloučení `agent.py` a `zion agent` do jednoho binárního produktu

## 10. Související soubory (implementace)

- UI: `apps/IntroPage/src/app/vast-rigs/{page,Dashboard}.tsx`
- CP: `infra/tools/vast/{vastctl.py,agent.py,vast_inference.py,bootstrap-agent.sh}`
- Gateway: `V31/L3/hiran-gateway/`
- CLI: `V31/cli/src/agent/`, `commands/hiran.rs`, `commands/agent.rs`
- Status export: `status.json` → EDGE2 webroot (`zion-vastrigs-sync`)
