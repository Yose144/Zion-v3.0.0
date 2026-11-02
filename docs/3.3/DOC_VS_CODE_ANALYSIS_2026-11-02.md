# DOC vs CODE ANALYSIS — 2026-11-02

> Kanonizace: co dokumentace tvrdí vs. co kód skutečně obsahuje.
> Metoda: porovnání root/plan docs s V31 workspace, apps/, infra/ a git historií.

## 1. V31 Workspace (kód) — co skutečně existuje

```
V31/Cargo.toml workspace members (18):
  L1/types, L1/cosmic-harmony, L1/archive/cosmic-harmony-v3,
  L1/core, L1/miner, L1/native-ffi, L1/pool,
  L2/multichain, L2/dao,
  L3/ncl, L3/ai-native, L3/hiran-gateway,
  L4/oasis, L5/free-world, L6/issobella,
  smoke, sdk, cli
```

**Verze:** workspace.package.version = `3.2.0`, edition 2021, lic MIT.
**Protocol handshake:** `zion-v3-node/3.1.0-alpha` (záměrně, wire ID).

### Co docs tvrdí vs. realita

| Doc claim | Kód | Status |
|---|---|---|
| V31 je aktivní mainnet track | `V31/Cargo.toml` existuje, V3 archivován | ✅ sedí |
| 18 workspace members | 18 members v Cargo.toml | ✅ sedí |
| `zion-node`, `zion-pool`, `warpd` binárky | V31/deploy/systemd je referuje | ✅ sedí |
| `zion-bridge` jako samostatný bin | NENÍ v build listu (je součástí multichain jako `warpd`) | ⚠️ stale reference v deploy skriptu (opraveno 2.11.) |
| `cli` + `smoke` members | Existují v workspace, ale nejsou na Edge build tree | ⚠️ deploy skript je musí odstranit (opraveno 2.11.) |
| Pool schema v13 (height/inclusion_height) | docs tvrdí v13 | ⚠️ nutno ověřit v kódu (pool store.rs) |
| PROTO_VERSION | docs tvrdí 4 (Mars Q3) / 3 (Mercury) / 2 (chat) | nutno ověřit v `core/net/protocol.ts` |

## 2. Apps (kód) — co skutečně existuje

```
apps/ (16 složek):
  IntroPage, MarketPlace, OasisWeb, desktop-agent, identity, mobile-app,
  nirvana, nirvana-net, node_modules, pool-ui, public-miner, shared,
  update-server, website-v2.9, zion-wallet-sdk, Stripe.md
```

| Doc claim | Kód | Status |
|---|---|---|
| Nirvana multiplayer (M0–M2) | `apps/nirvana-net/` existuje (Node 22, ws) | ✅ sedí |
| 3D avatary z OASIS rosteru | `apps/nirvana/src/core/avatars/` existuje | ✅ sedí |
| Chat pro ZIS uživatele (M1) | NetProvider v layout, ChatDock | ✅ sedí |
| Ops konzole F1–F2.3 | `ZION_OS/dashboard/` + `ops_console.py` | ✅ sedí |
| DeSci papers (6.B4) | `issobella` crate + anchor.rs | ✅ sedí (kód existuje) |
| update-server source v repu | `apps/update-server/` existuje (kanonizace 1.11.) | ✅ sedí |

## 3. Infra (kód) — co skutečně existuje

| Doc claim | Kód | Status |
|---|---|---|
| EDGE1 legacy (infra/edge-deploy/) deprecated | DEPRECATED.md přidán 2.11. | ✅ opraveno |
| EDGE2 primární (V31/deploy/) | 29 systemd unitů, aktivní | ✅ sedí |
| Pool HA fencing (pool-promote-guard.sh) | `infra/tools/pool-ha/` existuje | ✅ sedí |
| vastctl agent ingress na EDGE | `infra/tools/vast/deploy-agent-ingress.sh` | ✅ sedí |
| nginx edge2 (14 vhostů) | `infra/nginx/edge2/` má 14 confů | ✅ sedí |
| nginx edge-current (14 vhostů) | `infra/nginx/edge-current/` má 14 confů | ✅ sedí |

## 4. Root MD soubory — přesunuto do docs/3.3/

21 plánovacích/analytických MD souborů přesunuto z rootu do `docs/3.3/`:
- NIRVANA-V3.3-* (MAP, PLAN, CHECKLIST, KAPITOLA, KRALOVSTVI-SRDCE-PLAN, UNIFICATION)
- Render/AAA dokumenty (NIRVANA-RENDER-AAA, NIRVANA-SHELL, OASIS-RENDER-CANON, 3D-SCENY-PLAN)
- Plánovací dokumenty (DESKTOP-AGENT-COMPLETE-PLAN, POOL-HEROMINERS-PARITY-PLAN, VAST-OPS, VAST-HIRAN-TRAINING-PLAN, AIhiran, HIRAN-FULL-TRAINING-PREP, ARCHA-NOEMOVA, MATRIX)
- Denní poznámky (Nedele, nedele1, Oasis Render)

Zůstává v rootu (core/operational):
- AGENTS.md, README.md, SECURITY.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, LICENSE, CHANGELOG.md, ROADMAP.md, REPO-MAP.md

## 5. Klíčové rozpory (docs vs code)

### 5.1 Počty testů
- Docs uvádějí různé počty (smoke 36/34, arena 22/21, race 19/18) — závisí na datum měření. Invariant je jen to, co drží kód (typy, konstanty v protocol.ts).

### 5.2 Numerické ID světů
- "NIRVANA world #411" — numerické id 411 v worlds.json neexistuje; svět má string id "NIRVANA" + requiredPass "archive". (Kanonizace 1.11.)

### 5.3 Počty bran Chrám
- "14 bran" → dnes 15 (Nabukano, Matrix přidány). Číslo je dynamické (gates.length).

### 5.4 AGENTS.md workspace verze
- Psalo "3.1.0-beta" → opraveno na "3.2.0" (kanonizace 1.11.).

### 5.5 AppPay update-server
- Tvrdil, že source není v repu → `apps/update-server/` JE tracked (kanonizace 1.11.).

### 5.6 Commit 374548faf
- Mrtvý SHA — není v repu ani v SHA-REMAP tabulce (kanonizace 1.11.).

### 5.7 REPO-MAP.md chybějící entries
- Kingdom/ a apps/nirvana+nirvana-net chyběly → doplněno (kanonizace 1.11.).

## 6. Co je hotové vs. co zbývá (z checklistu)

### Hotové (✅) — výběr klíčových
- Pool schema v13, payout superseded, M3 sharding
- Explorer: čistá částka, supply mint 99% subsidy
- Marketplace B2B checkout + statusHistory
- Fleet: ops konzole, flight sheets, agent MVP
- Maestro read-only E2E 6/6
- Release builder 3/4 (chybí OpenCL/GPU host)
- Passkey E2E na 3 webech
- ZIS threat model + privacy review
- Legacy HS256 removal
- QtU/PRL attestation gate
- Custody disclosure UI
- ZIS agent sub-accounts design
- Mobile app audit + preview marking
- HTLC refund/claim claim-before-send
- IA-06 P2P rollback verify
- GPU KAT parity (9 defect classes opraveno)
- Bridge smoke + validator monitoring
- ZionDex QuoterV2/SwapRouter + solvency
- QTC adapter F1 gated live testy
- DeSci 6.B4 (papers repo + L1 anchor)
- ZION payout backlog recovery (defdcd84a)
- Stale-block RCA uzavřena
- PRL dry-batch review tooling
- Pearl FWD_MAX fix
- Wave 7 pool security (P-01…P-06)
- W1 A1.1–A1.5 pool metrics
- L5 QV voting UI + planetary map + 3D presentations
- L5 proof-of-impact workflow
- L5 public copy audit
- L6 DeSci papers repo (částečně)
- N7 truth-sync + public copy sladění

### Zbývá (❌/🔄) — klíčové otevřené
- G8 run #6 (do 28. 11., 99.7976 %)
- G9 externí audit (posunut)
- ZionDex on-chain settlement (funded E2E)
- QTC integrace (F1–F5)
- DAO guardian registry deploy
- QTU native payout path
- PRL payout DRY_RUN=0 flip (čeká 👤)
- QTC treasury deficit (čeká 👤 funding)
- W3–W7 Fleet agent
- HA stratum fencing + staged activation
- N3: citace/eval, NCL worker, miner↔NCL spike, Dharma, Amitabha, red-team
- N4: axe/device matrix, WebGPU parity, E-shop E2E, on-chain anchoring
- N5: reálný pilot + E2E grant
- N6: DeSci papers (částečně), Alcubierre-Ekam draft, review
- N7: Charta R9, CoinGecko, bug bounty
- Release: podepsaný tag, artefakty (3/4), public repo sync

## 7. Doporučení pro další práci

Prioritní autonomní úkoly (z checklistu "Rychlá autonomní fronta"):
1. HA stratum fencing analýza
2. DR drill plán → provedení
3. Release artefakty dokončení (OpenCL/GPU host)
4. NCL 1 worker + 1 job typ
5. DeSci papers repo + L1 hash anchor
6. OASIS a11y/privacy plný scan

Operátor-only (čekají na 👤):
- G9 audit, PRL flip, QTC funding, release tag, pilot selection, HW upgrade