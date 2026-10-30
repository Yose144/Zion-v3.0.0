# Hiran Agent — `zion agent` CLI (B2B-3b)

> **Zdroj:** `Zionb2b.md` §B2B-3b · Draft 2026-10-29  
> **Analogie:** Cursor Agent / Claude Code / Devin — autonomní coding loop v CLI.  
> **Závislost:** Hiran API gateway (B2B-3) + ZIS API keys + Stripe (Pro/Team).

## 1. Produkt

Jednotný subcommand v operator CLI:

```bash
zion agent                     # interaktivní REPL
zion agent -p "opravit test X" # one-shot
zion agent --model hiran-mini
```

Stejný povrch později v **public/archive** CLI artefaktech (`zion` community
binary) — feature `agent`, default OFF v thin builds, ON v full release.

## 2. Architektura (MVP)

```
zion agent (local)
  ├─ tools: read/write/edit, shell (allowlist), git status/diff, cargo/npm test
  ├─ policy: sandbox cwd, deny secrets paths, confirm destructive
  └─ LLM: Hiran API  https://market.zionterranova.com/v1/chat/completions
            X-API-Key: zis_…  (ZIS; Pro/Team = Stripe)
```

- **Model default:** `hiran-mini` (EU, free/pro quotas z gateway).
- **System prompt:** ZION/V31 konstituční kontext (fee split, flowers, L1–L6) —
  reuse ai-native constitution; coding tools prompt odděleně.
- **Metering:** beze změny na gateway (usage_records); CLI jen klient.
- **BYOK (později):** `ZION_AGENT_BASE_URL` + key — enterprise; default = Hiran.

## 3. Monetizace

| Tier | CLI agent | Model |
|---|---|---|
| Free | omezený tool loop / den | hiran-mini |
| Pro (€29) | plný agent | hiran-mini + coder |
| Team (€99) | multi-key + priority | + vast tier |

Stripe = stejné `HIRAN_PRICE_*` jako `/ai` page (B2B-3).

## 4. Distribuce

| Artefakt | Cesta | Pozn. |
|---|---|---|
| V31 operator | `V31/cli` → `zion` | primární vývoj |
| Public release | `public/` / GitHub `v3-Mainnet` CLI | opt-in feature |
| Archive | `archive/` CLI balíčky | backport subcommand stub → Hiran |
| Desktop | později embed do desktop-agent | po CLI MVP |

## 5. MVP checklist

1. ✅ `zion agent` clap (+ `-p` / `--model` / `--cwd` / `--yes` / `--max-turns`) + config (`~/.zion/agent.toml`, `ZION_HIRAN_API_KEY`)
2. ✅ Tool loop (`read_file` / `write_file` / `str_replace` / `run_shell` / `git_status` / `git_diff`) + cwd jail + secret-path deny + confirm on write/shell
3. ✅ Hiran client (`V31/cli/src/agent/`) — OpenAI chat completions (non-stream MVP; reqwest `stream` feature ready for SSE)
4. ✅ ZIS key via `zion hiran login` (device-code → MarketPlace `/ai/cli` → mint) + env / `~/.zion/agent.toml`
5. ✅ Thin gateway: `zion hiran models|status|ask|whoami|subscribe` — live `GET /v1/models` → `hiran-mini`
6. ✅ Soft-sell na `/ai` (+ MetaMask USDC / Stripe) + CLI link; pool FAQ později
7. ⬜ Public/archive packaging (feature flag)

**Implementace (2026-10-29):** agent loop + **ZIS device-code login** + Stripe upgrade (`X-API-Key`) + Base USDC crypto intent/confirm. Kanon: root [`HIRAN-CLI-AUTH.md`](../plans/HIRAN-CLI-AUTH.md).

**Vast remote (F3):** `zion hiran agent -p "…" --remote vast` (+ `#ai` Coding Agent). Kanon [`VAST_HIRAN_CODING_AGENT_PLAN.md`](VAST_HIRAN_CODING_AGENT_PLAN.md). Ops token `VASTCTL_AGENT_TOKEN`, ne `zis_*`.

## 6. Co nedělat v MVP

- Plný IDE / LSP (to je Cursor) — držíme CLI agent.
- Auto-push na `main` / force-push.
- Posílat celý repo do non-EU modelu bez opt-in.
- Stavět vlastní model train před live paid Hiran API.

## 7. Odhad

- Po paid Hiran API: **3–6 týdnů** k použitelnému MVP v `V31/cli`.
- Archive/public sync: +1 týden packaging.
