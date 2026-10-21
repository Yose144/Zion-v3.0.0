# ZION V3.3 "NIRVANA" — Execution Checklist

> **Datum:** 2026-10-21 · **Doplněk k:** [`NIRVANA-V3.3-PLAN.md`](NIRVANA-V3.3-PLAN.md)
> **Značky vlastníka:** 🤖 = autonomní (Devin může udělat end-to-end v kódu/testech/diaci) · 🔀 = autonomní příprava + operátorské schválení/flip · 👤 = potřebuje operátora (rozhodnutí, peníze, klíče, fyzický svět)
> **Pravidlo:** Devin nikdy neflipuje produkční money-pathy, nevydává verze, nevybírá dodavatele — vždy připraví PR/artefakt/důkaz a počká na 👤 sign-off.

---

## N0 · Foundation Closure (precondition)

- [ ] **G8 run #3** — 99.9 % uptime, žádný kritický incident
  - [x] 🤖 RCA critical_incident z run #2 + **live stall 2026-10-21** (~40 min @89952) → [`docs/3.2/REPORTS/REPORT_2026-10-21_G8_STALL_RCA.md`](docs/3.2/REPORTS/REPORT_2026-10-21_G8_STALL_RCA.md)
  - [x] 🤖 Fix root cause: pool RPC timeout 4→12 s (`ZION_L1_RPC_TIMEOUT_MS`), pool-side pre-orphan odstraněn (node rozhoduje), watchdog 15 s/2-fail → 30 s/3-fail — **333/333 testů ✅, čeká edge deploy**
  - [ ] 🤖 Ověřit alert sink firing test + 40d retention před startem okna
  - [ ] 👤 Rozhodnutí: start nového 30d okna (a zda resetovat čítač runu)
- [ ] **Externí audit**
  - [ ] 🤖 Připravit audit package: pinned commit manifest, repro build postup, scope final
  - [ ] 👤 Výběr firmy/auditorů, kontakt, budget, NDA
  - [ ] 👤 Odeslání scope + kickoff
- [ ] **BTC swap hold**
  - [ ] 🤖 Server-side signed quote + operátorské schválení + dedikovaný `WARP_BTC_SWAP_OFFER_KEY` flow (kód)
  - [x] 🤖 bitcoind IBD monitoring → **sync 100 %** (block 972429, pruned 20G) — hold je už jen audit/rozhodnutí, ne sync
  - [ ] 👤 Capped mainnet pilot approval (~100k sats) po auditu
- [ ] **Edge hygiena**
  - [x] 🤖 Disk audit → [`REPORT_2026-10-21_EDGE_DISK_AUDIT.md`](docs/3.2/REPORTS/REPORT_2026-10-21_EDGE_DISK_AUDIT.md) — BTC prune OK (sync 100 %), reclaim ~11–13 G identifikováno (hiran model 5.5 G unused, worktrees ~3 G, backup retention ~3 G)
  - [x] 🤖 fail2ban diagnose + fix — root cause `RestartPreventExitStatus=0 255` (boot crash exit 255 → no auto-restart); service **live** (jails sshd + zion-p2p), drop-in `10-restart.conf` aplikován → self-heals
  - [ ] 🤖 Implementovat retention cleanup dle audit reportu (7d daily, bak-* purge, worktree prune)
  - [ ] 🤖 Full DR restore drill (ne jen extract — boot do sync)
  - [ ] 👤 Případné rozšíření volume u Contabo + rozhodnutí o hiran modelu
- [ ] **v3.2.0 release**
  - [ ] 🤖 Připravit tag, release notes, SHA256SUMS manifest, workflow ověření
  - [ ] 👤 Push tagu + spuštění GH release + publikace

## N1 · Identity & Value Transfer (L2 + ZIS)

- [ ] 🔀 BTC swap re-enable → `WARP_BTC_SWAP_ENABLED=1` capped (po N0)
- [ ] 🤖 ZionDex on-chain settlement — fáze dle `ZionDex-OnChain-Settlement-Plan.md`
  - [ ] Per-user Base deposit adresy → on-chain UniV3 exec → withdraw (kód existuje částečně)
  - [ ] Odstranit in-memory AMM z produkční swap cesty
  - [ ] E2E deposit→swap→withdraw test suite
- [ ] 🤖 Passkey E2E napříč weby — Playwright suite (app/market/dashboard/freeworld)
- [ ] 🤖 ZIS agent sub-accounts — Prisma schema + budget/limity (design + migrace draft)
- [ ] 🤖 QTC integrace per `QUANTUS-INTEGRATION-PLAN.md` (adresy v ZIS, wallet, indexer)
- [ ] 👤 Rozhodnutí o nových chain pilotách (Solana watcher je v kódu)

## N2 · Pool & Revenue Engine

- [ ] 🔀 PRL payout `DRY_RUN=0` — 🤖 připravit dry-batch review report, 👤 flip
- [ ] 🤖 Revenue→oyster wiring: sweep path z BIP86 `m/86'/808276'/0'/0/0` (kód v `payout.rs`/oyster)
  - [ ] 👤 Rozhodnout: sweep vs. přesměrování upstream wallet na oyster adresu (klíčové rozhodnutí)
- [ ] 🤖 PRL miner enablement: public miner docs (SM75+/RDNA+), `gpu=PRL` pref fix pro nepodporované karty
- [ ] 🤖 QTU native payout path dovyšet (batch z quantus wallet)
- [ ] 🤖 Standby pool: `provision-standby.sh` ověřit/dokumentovat
- [ ] 👤 Cíl ≥1 externí PRL miner (HW závislost — SM75+/RDNA+ GPU)

## N3 · Hiranyagarbha 2.4/2.5 (L3, sandboxed)

- [ ] 🤖 Maestro první read-only E2E task (intent→plan→health_poller→report) + audit log
- [ ] 🤖 `zion-ncl` service: binárka + systemd unit + Edge deploy (crate existuje, chybí bin)
- [ ] 🤖 Miner↔NCL spike: `ZION_NCL_*` opt-in pull-job loop v `L1/miner` (off default)
- [ ] 🤖 Dharma engine: keyword filter → policy manifest (allowed action types + human-approval gate)
- [ ] 🤖 Amitabha draft-only intent UI (plán s náklady/příjemci/riziky/zrušením, bez exekuce)
- [ ] 👤 HW upgrade rozhodnutí (RTX 3090+/48 GB → větší model) — bez něj zůstává Qwen3-4B + RAG

## N4 · OASIS (L4)

- [ ] 🤖 Perf budget + a11y/security/privacy review (`OasisChecklist.md` jako gate)
- [ ] 🤖 Marketplace↔OASIS reverse-sync edge cases
- [ ] 🤖 On-chain parcel/artefakt anchoring design + regtest pilot
- [ ] 👤 UE5.7 research rozhodnutí — default = HORIZONT, žádný commitment

## N5 · Free World (L5)

- [ ] 🤖 Planetary map + projektový katalog UI na `freeworld.zionterranova.com`
- [ ] 🤖 QV voting UI nad hotovým backendem (`quadratic.rs`, 30 testů)
- [ ] 🤖 Proof-of-impact workflow (backend + form)
- [ ] 👤 Výběr 1 reálného pilotního projektu + nezávislé ověření (fyzický svět)
- [ ] 🔀 První end-to-end grant advisory → DAO → guardian multisig (👤 schválení disbursement)

## N6 · Issobella (L6)

- [ ] 🤖 DeSci repozitář: `/l6-issobella/papers` nebo `issobella.zionterranova.com` + L1 hash anchor
- [ ] 🤖 Alcubierre-Ekam draft struktura (publikovatelný matematický dokument)
- [ ] 👤 Nezávislé review publikace
- [ ] 🔀 NCL vědecký pilot (po N3 miner↔NCL spike)

## N7 · Launch Readiness

- [ ] 🤖 Public subtree sync + docs update k realitě
- [ ] 🤖 CoinGecko re-apply package per roadmap
- [ ] 👤 Bug bounty program + community kanály (rozhodnutí, budget)
- [ ] 👤 "v3.3 Nirvana" publikace — jen po DoD

---

## Rychlá autonomní fronta (co můžu dělat hned, bez čekání)

1. ~~🤖 **G8 RCA** — proč run #2 failed~~ ✅ hotovo 2026-10-21 (live stall RCA + 3 fixy v kódu, čeká deploy)
2. ~~🤖 **Disk audit**~~ ✅ `REPORT_2026-10-21_EDGE_DISK_AUDIT.md` — BTC prune+sync 100 %; ~11–13 G reclaim identifikováno
3. ~~🤖 **fail2ban fix**~~ ✅ live (sshd+zion-p2p jails); drop-in fixuje `RestartPreventExitStatus=255` boot-crash bug
4. 🤖 **NCL bin/service** — crate → běžitelná služba
5. 🤖 **PRL dry-batch review tooling** — report co dry-run udělal/udělá
6. 🤖 **QV voting UI** — backend hotový, chybí web povrch
7. 🤖 **BTC signed-quote kód** — odemyká hlavní audit blocker
8. 🤖 **Planetary map UI** — L5 katalog frontend
9. 🤖 **Passkey Playwright E2E**
10. 🤖 **OasisChecklist perf/security gate**

## Operátor-only fronta (čeká na 👤)

- Audit firma výběr+budget+KYC · BTC pilot approval · PRL dry→live flip · upstream wallet přesměrování (klíče) · v3.2.0 tag/release · L5 pilot reálný svět · HW upgrade · Contabo volume · bug bounty budget · CoinGecko účet
