# Hiran Complete Plan — kanonická next mapa

> Stav: **2026-10-29** · root kanon nad dílčími plány.  
> Implementace P0–P4 / FT = samostatné práce; tento soubor = priorita + checklist.

## Související dokumenty (detail)

| Dokument | Role |
|---|---|
| [`docs/3.2/VAST_HIRAN_CODING_AGENT_PLAN.md`](../3.2/VAST_HIRAN_CODING_AGENT_PLAN.md) | F0–F3 scaffold (gateway fabric, `code.run`, `#ai`, CLI remote) |
| [`HIRAN-MARKETPLACE-PLAN.md`](HIRAN-MARKETPLACE-PLAN.md) | Rodina modelů, Market F3 listing / F4 provoz |
| [`HIRAN-CLI-AUTH.md`](HIRAN-CLI-AUTH.md) | ZIS device-code, Stripe, MetaMask → plány |
| [`docs/3.2/B2B_HIRAN_AGENT_CLI.md`](../3.2/B2B_HIRAN_AGENT_CLI.md) | Local `zion agent` + B2B surface |
| [`VASTAI-MINING.md`](VASTAI-MINING.md) §5 | Vast inference / mining ops |
| [`docs/3.2/B2B_HIRAN_SECRETS.md`](../3.2/B2B_HIRAN_SECRETS.md) | Secrets / env (bez hodnot v gitu) |

---

## 1. Cíl produktu

**ZION Hiran + Vast Coding Agent** — hybrid *compose* (neslučovat binárky):

1. **Model fabric** — Hiran gateway (`market…/v1`): aliasy `hiran-mini`, `hiran-coder`, Trinity mockupy → live po FT.
2. **Coding worker** — fleet `agent.py` op `code.run` (tool jail) na rigu; UI `#ai` + CLI `zion hiran agent --remote vast`.
3. **Market surface** — veřejný `/ai` (plány, CLI login, soft-sell); později per-alias listing.

**Auth oddělení (pevné):**

| Klíč | Účel |
|---|---|
| `zis_*` | User LLM metering / gateway turns |
| `VASTCTL_AGENT_TOKEN` / enroll | Fleet control plane (enqueue, heartbeat) — **nikdy** = user API key |

---

## 2. Architektura (cíl)

```mermaid
flowchart LR
  subgraph clients [Clients]
    MarketAI["Market /ai"]
    VastAI["vast-rigs #ai"]
    CLI["zion hiran / agent"]
  end
  subgraph edge [EDGE2 / Edge]
    GW["hiran-gateway /v1"]
    Vastctl["vastctl serve"]
  end
  subgraph rig [Vast rig]
    Agent["agent.py code.run"]
    LLM["local :8000 vLLM or llama.cpp"]
  end
  MarketAI --> GW
  CLI --> GW
  VastAI --> Vastctl
  CLI -->|remote vast| Vastctl
  Vastctl -->|enqueue| Agent
  Agent --> LLM
  Agent -->|optional| GW
  GW -->|hiran-mini| PC["PC CUDA / EDGE2 CPU"]
  GW -->|hiran-coder P0| Coder["PC :8072 or Vast tunnel :8005"]
```

```
UI / CLI ──enqueue code.run──► vastctl ──heartbeat──► agent.py
agent.py ──tools jail────────► /root/work
agent.py ──chat──────────────► local :8000 | gateway hiran-coder
User chat ──zis_*────────────► gateway ──► mini / coder upstreams
```

---

## 3. Stav snapshot (2026-10-29) — hotovo

### Market / auth

- [x] Market Navbar odkaz **AI** → `/ai` (desktop + mobil)
- [x] Homepage karta **Hiran AI** (`AiSection`)
- [x] `/ai` soft-sell: plány Free/Pro/Team, CLI login, odkaz Vast Coding Agent
- [x] `/ai/cli` device-code approve → mint `zis_*`
- [x] Stripe `hiran-subscribe` + webhook `set_plan`
- [x] MetaMask Base USDC intent/confirm → admin plan
- [x] CLI: `zion hiran login|logout|whoami|subscribe`

### Gateway + local agent

- [x] Gateway MVP `market…/v1` — `hiran-mini` **live**
- [x] Trinity aliasy mockup (`503` / `x-mockup`)
- [x] Slot `hiran-coder` (health zatím `live:false` — viz P0)
- [x] Local `zion agent` tool jail + Hiran client (B2B-3b MVP)

### Vast coding scaffold (F0–F3)

- [x] F0 docs + křížové odkazy
- [x] F1 fabric scaffold (aliasy / models matrix)
- [x] F2 `op=code.run` + `code_run.py` jail + bootstrap scp + unit testy
- [x] F3 `#ai` Coding Agent UI + `zion hiran agent --remote vast`
- [x] Deploy 29.10.: Intro `#ai`, Market soft-sell, vastctl `code-run` endpoints
- [x] E2E **smoke** rig `58077390`: enroll + `code.run` → tool turn + `SMOKE_OK`  
      (LLM = OpenAI **stub** `:8000`; image bez Docker → vLLM skip)

**vast-rigs nav:** záměrně **bez** veřejné AI karty v Intro nav (interní tab `#ai` zůstává).

---

## 4. Zbývající fáze (priorita)

### P0 — `hiran-coder` live (veřejný alias)

**Proč:** Market/CLI routing na coder; slot existuje, upstream ne.

- [x] Gateway katalog: `hiran-coder` v `/v1/models` (offline→live)
- [x] Stabilní upstream: PC `zion-coder-cuda` `:8072` + reverse tunnel EDGE2 `:8005` (`zion-coder-tunnel.service`)
- [x] Gateway health `live:true` (29.10. 18:45) — public `/v1/models` + Market badge `coder: live`
- [x] Local smoke `POST :8072/v1/chat/completions` OK (`Pong!…`)
- [x] Public metered smoke `POST market…/v1` model=`hiran-coder` → `WORKFLOW_OK` (29.10. E2E, free plan)

**Done when:** `GET …/v1/models` ukáže `hiran-coder` live; jeden chat turn OK s `zis_*`. ✅

### GPU duty (1070 Ti)

Produkční default = **mini na GPU**. Coder je on-demand (sdílená VRAM, jeden model).

| Režim | Příkaz (ops PC, `~/zion-hiran/`) | Gateway |
|---|---|---|
| Mini (default) | `bash use-hiran.sh` — stop `zion-coder-cuda` + `zion-coder-tunnel` | `hiran-mini` live, `hiran-coder` offline |
| Coder | `bash use-coder.sh` — start `:8072` + `zion-coder-tunnel` (`-R 8005`) | `hiran-coder` live, mini na CPU fallback |

Šablona tunelu: [`V31/deploy/local/zion-coder-tunnel.service`](../../V31/deploy/local/zion-coder-tunnel.service).  
**29.10. večer:** provoz vrácen na mini (`hiran-cuda` active, coder+tunnel inactive, public mini live / coder false).

Sync agenta na rig (bez nového enrollu): `bash infra/tools/vast/bootstrap-agent.sh <id> --sync-only`.

### P1 — Reálný weight na rigu (ne stub)

**Proč:** Lokální stub na rigu není produkt. Kanon `code.run` = lease → gateway (hotovo). GGUF/vLLM na rigu je volitelný offline fallback.

- [x] Fleet ≥1 enrolled — `58077390` live (age_s < 10, 29.10.)
- [ ] Image s **Dockerem** → vLLM pin **nebo** manuální llama.cpp GGUF (ne OpenAI stub)
- [x] LLM na rigu `:8000` — zatím **smoke-coder stub** (E2E rc=0, `SMOKE_OK`, task `19ae464767e2`)
- [ ] E2E `code.run` s **reálným** weightem
- [ ] Mining vs infer duty sheet

**Done when:** E2E checklist z Vast plánu §7 splněn **bez** stub serveru.

### P2 — Remote metering přes gateway

**Proč:** Remote dnes jede na fleet token + local `:8000`; user billing musí jít přes `zis_*`.

- [x] `POST /v1/agent/lease` — short TTL `hiran_lease_*` vázaný na key_hash (deployed)
- [x] Chat path přijme lease Bearer; turn budget fail-closed
- [x] `code_run` / vastctl: `lease_token` + `llm_base` + `model` OK; `llm_key` strip
- [x] CLI `zion hiran agent --remote vast` mint lease → enqueue; po runu `/v1/usage`
- [x] E2E metered remote 29.10.: lease → enqueue `58077390` → `REMOTE_METER_OK` (rc=0); `/v1/usage` 1→2 req, 42→575 tok (rig `code_run.py` reload)

**Done when:** remote `code.run` odečte turns na ZIS/Hiran plánu, ne jen ops token. ✅

### P3 — Market F3 listing

**Proč:** `/ai` je pricing + soft-sell; chybí katalog aliasů jako produkt.

- [x] Karty per alias (ctx, $/1M, live/offline/mockup) — `/api/hiran/models` + `/ai`
- [x] Zdroj: public `/v1/models` + loopback `/health` (`HIRAN_GATEWAY_INTERNAL`)
- [x] Trial chat — `/api/hiran/trial-chat` (session, rate-limit 8/min)
- [x] Settlement copy dry-run
- [ ] Rozhodnutí copy: přímý prodej vs „Hiran inside“ (product)

**Done when:** `/ai` ukáže live karty mini (+ coder když P0) s cenou a CTA. ✅ (coder offline badge OK)

### P4 — Provoz / observabilita

- [x] Market uptime badge mini/coder z `/api/hiran/models`
- [x] Metriky/alerts v repo: `V31/deploy/monitoring/zion-writepath-probe.py` (`zion_hiran_*`) + `zion-hiran-alerts.yml`
- [ ] Prometheus scrape + alert rules **live** na EDGE (ověřit timer)
- [ ] `inference_live` jméno do G8 JSON (nice-to-have; writepath gauge stačí)
- [ ] SMOS 518837 retire/repair

**Done when:** ops má gauge + alert; veřejný badge sedí s realitou. (badge ✅; EDGE Prom partial)

### FT — Trinity train-first (paralelní / odložené)

> Neblokuje P0–P2 scaffold. Zvedá *kvalitu* ZION znalosti a Issobella jako default coder.

Pořadí: shared constitution → **Maitreya** → **Amitábha** → **Issobella**.

- [ ] Dataset pack: `docs/` + canon allowlist + ops FAQ (**licence** — blokuje veřejný GGUF)
- [ ] Eval suite „ZION komplexně“ (20–50 Q) ≥ baseline `hiran-mini`
- [ ] QLoRA smoke per persona na Vast (reuse HiranDev / v2.3 recept)
- [ ] Export GGUF Q4/Q5 → mockup→`live` v `#ai` + gateway
- [ ] Po Issobella live: `hiran-coder` default = Issobella; Trinity picker v `#ai`

**Done when:** aspoň jedna persona mockup→live + eval pass nad mini baseline.

---

## 5. Ops prerekvizity (checklist)

| Položka | Poznámka |
|---|---|
| `VASTCTL_ENROLL_TOKEN` | Musí být v env `vastctl serve` (jinak enroll 403) |
| `VASTCTL_AGENT_TOKEN` | Enqueue / fleet mutations |
| Rent GPU | Fleet=0 → žádný remote coding |
| Docker na rigu | Jinak vLLM skip → llama.cpp manuálně |
| PC tunnel chain | mini primary; coder P0 přes `:8072` / `:8005` |
| Gateway deploy | `scripts/ops/deploy-hiran-gateway.sh` + systemd `zion-hiran-gateway` |

---

## 6. Success criteria (produkt „complete“ pro tuto mapu)

- [x] P0: `hiran-coder` live + metered public chat `WORKFLOW_OK`
- [ ] P1: E2E `code.run` s reálným weightem na rigu *(remote teď metruje přes gateway coder; local stub residual)*
- [x] P2: remote turns metered `zis_*` (`REMOTE_METER_OK` + usage delta)
- [x] P3: Market listing karty + trial
- [x] P4: Market badge + monitoring files in repo *(EDGE Prom wiring residual)*
- [ ] FT (aspoň 1 persona): mockup→live (může doběhnout po P0–P2)

### Autonomní průchod 2026-10-29 (bez FT)

| Položka | Výsledek |
|---|---|
| Gateway lease + offline aliases | deployed EDGE2 `:8007` |
| Market `/ai` models + trial + badge | deployed |
| P0 coder upstream | ✅ live `:8072`→`:8005` + metered `WORKFLOW_OK` |
| P2 metered remote | ✅ lease + `REMOTE_METER_OK` on `58077390` (usage 575) |
| Ops note | EDGE2 ZIS `DATABASE_URL` synced to shared `.env` (stale 8-char pw broke verify) |
| P1 fleet `code.run` | ✅ stub `SMOKE_OK` on `58077390` |
| FT Trinity | skipped (delší sezení) |

---

## 7. Out of scope

- Auto-rent Vast nabídek pro coding
- Multi-GPU / tensor parallel napříč rigy
- Merge `agent.py` ↔ `zion agent` do jednoho binárního produktu
- Aider / OpenHands jako default workload
- Public/archive CLI packaging jako samostatný release (zatím V31 operator CLI)
- Nahrazení Maestro / ai-native
- L1 consensus změny

---

## 8. Rizika

- VRAM contention mining ↔ inference (duty / sheet nutný při P1)
- Image bez Docker = jen stub nebo ruční llama.cpp
- Floating `latest` vLLM — po smoke pinnout tag
- Gated HF váhy bez tokenu = deploy 401
- Licence korpusu blokuje FT Maitreya / veřejný GGUF
- Edge sshd / fail2ban — ops enroll citlivý na rychlé SSH

---

## 9. Soubory implementace

| Vrstva | Cesty |
|---|---|
| Market UI | `apps/MarketPlace/src/app/ai/`, `components/Navbar.tsx`, `components/sections/AiSection.tsx` |
| Intro `#ai` | `apps/IntroPage/src/app/vast-rigs/Dashboard.tsx` |
| Gateway | `V31/L3/hiran-gateway/` (`models.rs`, `proxy.rs`, `routes.rs`) |
| CLI | `V31/cli/src/agent/`, `commands/hiran.rs`, `commands/agent.rs` |
| Fleet | `infra/tools/vast/{vastctl.py,agent.py,code_run.py,bootstrap-agent.sh,zion-coder-job.sh}` |
| Deploy | `apps/MarketPlace/deploy/deploy-marketplace.sh`, `scripts/ops/deploy-hiran-gateway.sh` |

---

## 10. Doporučené pořadí práce

1. **P0** coder upstream (nejrychlejší user-visible win na Market/CLI)  
2. **P1** reálný rig weight + E2E  
3. **P2** metering (billing integrity)  
4. **P3** Market listing  
5. **P4** monitoring  
6. **FT** Trinity paralelně, jakmile je licence/dataset ready  

*Konec kanonické mapy — detaily fází zůstávají v dílčích plánech výše.*
