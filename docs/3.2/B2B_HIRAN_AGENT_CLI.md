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

1. `zion agent` clap subcommand + config (`~/.zion/agent.toml`)
2. Tool loop (read/edit/shell) + confirm hooks
3. Hiran client (reuse reqwest; stream SSE)
4. ZIS key from env / keychain (`ZION_HIRAN_API_KEY`)
5. Smoke: one-shot edit + `cargo test` v sandbox repo
6. Docs + soft-sell na `/ai` a pool FAQ
7. Public/archive packaging (feature flag)

## 6. Co nedělat v MVP

- Plný IDE / LSP (to je Cursor) — držíme CLI agent.
- Auto-push na `main` / force-push.
- Posílat celý repo do non-EU modelu bez opt-in.
- Stavět vlastní model train před live paid Hiran API.

## 7. Odhad

- Po paid Hiran API: **3–6 týdnů** k použitelnému MVP v `V31/cli`.
- Archive/public sync: +1 týden packaging.
