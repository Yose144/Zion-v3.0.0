---
# Continue: ne-injektovat automaticky do promptu (soubor ~45k toku)
alwaysApply: false
---

> **🆕 2026-10-27 (6) WARP KEYS → V2 + NON-BASE ROTACE (Polygon částečně, gas-blocked):** **`zion-v31-multichain` env kanonizováno:** `WARP_EVM_RELAY_KEY` byl `0xdde17…` (revokovaný starý klíč — podepisoval by odmítnuté tx!) → V2 validator_1 evm sk; `WARP_VALIDATOR_KEYS` 1× starý `val1:` ed25519 → `val1..val5:` V2 ed25519 (blake3 z V2 mnemoniců); `WARP_L1_RELEASE_KEYS` záměrně UNSET (manual release mode — při zapnutí ≥3 V2 evm sks). `warpd` restart clean, watchers OK. **Non-Base inventura (5 chainů):** `wZION 0x0c49…` + `ZIONBridge 0xa5a09b2C…` nasazené na BSC/Polygon/Arb/OP/AVAX, všude threshold 5 + 5 starých validatorů + starý `0xdde17…` = DEF_ADMIN+GUARDIAN+VALIDATOR. **Gas blokáda:** starý klíč má na 4 chainech jen prach (<1 tx); Polygon 0.166 POL → **rotace spuštěna**: grants 4× ✅ + addValidator 4/5 ✅ (`0x2de0c0fd…` apod.) — pak došel gas (0.036 zbývá, ~0.04/tx potřeba). Stav SAFE (threshold 5 nedotčen, count 9). **👤 funding:** Polygon v1 ~0.15 POL (dokončí sám — má DEF_ADMIN); BSC/Arb/OP/AVAX old `0xdde17…` ~0.003 BNB / 0.0005 ETH / 0.0005 ETH / 0.05 AVAX → skript `rotate_poly.mjs` na EDGE2. **Generator fix:** `gen-all-keys-mnemonic.rs::keccak256()` SHA-256 stub → `sha3::Keccak256` (cargo check ✅) — budoucí generace = reálné EVM adresy. Verifier → `scripts/ops/verify_v2_keys.py` (39/39 PASS).
>
> **🆕 2026-10-27 (5) V2 KEY CANONIZATION — audit 36/36 + DAO guardians + Base EVM rotace na V2 (21 tx live):** **Audit `V31_PREMINE_V2_KEYS_2026-08-06.json`:** všech 36 záznamů interně konzistentních (mnemonic→sk→pk→addr ed25519; mnemonic→secp256k1→EVM), 0 duplicit; premine/canonical/admin přesně = `v3_compat.rs`. **Nálezy:** `gen-all-keys-mnemonic.rs` `keccak256()` je ve skutečnosti SHA-256 stub → `evm_address` pole byla nefunkční sha256-placeholdery; **soubor opraven** — `evm_address` = reálné keccak (EIP-55), původky v `evm_address_legacy_sha256` (shoda s v3_compat konstantami, jen metadata — nikde ecrecover). `evm_validators.validator_1` označen `role: "evm_contract_admin"`. Verifier `/tmp/verify_keys.py` → **39/39 PASS**. **Deploy gap opraven:** DAO guardians `/etc/zion/dao-mainnet.toml`+`config/` → V2 set (byl stale set z 6.7. — i repo `PUBLIC/V3/L2/dao/config/dao-mainnet.toml` měl rozbité pk↛addr; opraveno), `zion-v31-dao` restart → `/api/dao/guardians` = 7× V2, 5z7 ✅. `ZION_SWAP_ESCROW_KEY` + `ZION_BRIDGE_VALIDATOR_PUBKEYS` (L1 allowlist) → V2; `zion-v31-node` restart. **On-chain Base rotace (25 tx, vše verified):** audit ukázal **jeden starý klíč `0xdde17…` (= validator.key, gen. 6.7.) držel DEF_ADMIN/owner na všech 10 kontraktech**. Fáze 1: grantRole DEF_ADMIN + transferOwnership → V2 `0x13D06bEf…` na wZION/Bridge/Staking/Farm/AtomicSwap/NFT(+MINTER)/Marketplace/Governance/Treasury (10 tx). Fáze 2: ZIONBridge má **interní validator registry** (BridgeValidator 0x9C13… kontrakt je immutable 5-of-5 pomocný, rotace nepřijde v úvahu bez redeployu) → `addValidator`×5 V2 + `updateThreshold(3)` + `removeValidator`×5 starých + GUARDIAN→v1 (11 tx; fund v1 `0xadb4630e`). **Final: 3-of-5 V2, 0 old**. `bridge-mainnet.toml` + `validator.key` → V2 v1 (fp `447a548e09ea`). Fáze 3: **14× revokeRole starého 0xdde17** (DEF_ADMIN/GUARDIAN/BRIDGE/MINTER přes všechny kontrakty) → **má 0 rolí**. Provozní klíče marketu (`MINTER_PRIVATE_KEY`→`0xbF82…` NFT minter, `WALLET_SEED_KEY`→`0x9469…`) záměrně zůstávají — service keys, ne governance; rotace na V2-derivované = 👤 rozhodnutí (nové canonical entries). Report: `docs/3.2/REPORTS/REPORT_2026-10-27_EVM_KEY_CANONIZATION.md`. Zbývá: non-Base chainy (BSC/Polygon/… — stejná rotace `0xa5a09b2C…`), volitelný redeploy BridgeValidator multisigu, premine unlock checklist do 144k.
>
> **🆕 2026-10-27 (4) FLEET AGENT MVP LIVE + EDGE sshd OUTAGE + STANDBY VERIFIED:** **2.B11 MVP nasazen server-side:** `vastctl.py` += agent registry (`POST /api/agent/{heartbeat,result}` Bearer-token gated — bez `VASTCTL_AGENT_TOKEN` 403 fail-closed; `POST /api/agent/enqueue` token-nebo-same-origin, ops whitelist `exec`; `GET /api/agent/fleet`), atomic JSON `~/.local/share/vastctl-agents.json`, task TTL 1h, `pending→delivered→done` lifecycle. `agent.py` rig daemon (60s heartbeat, 600s exec timeout, seen-file idempotence, result retry) + `zion-vast-agent.service`. **Deploy:** serve restartován s tokenem (systemd override; token v `~/.vast-agent-token`, NE v repu); **public ingress** `https://zionterranova.com/api/agent/` → EDGE2 nginx → `127.0.0.1:8088` → tunnel→zionserver — live noauth 403 / token heartbeat+fleet OK. Testy suite 10/10. **Enrollment čeká na rig** — vast fleet prázdná (57054247 destroyed, 0 instances = 👤 náklad). **Standby replika ověřena read-only:** integrity ok, schema v9, 210 817 payouts, ledger max=tip → **RPO ≤15 min potvrzeno**; bringup drill = POZOR stop primary first (double-pay hazard). **2.S2 early evidence 09:35:** 143 rows post-deploy, 0 dup/0 null-txid/0 indeterminate — verdikt 28.–29.10. ⚠️ **EDGE sshd :22 refuses NEW conns od ~09:30 UTC** (refused i z EDGE2 — ne jediná IP; established edge-tunnel + replikace + pool metriky jedou → host/služby OK, jen inbound nové SYN; hypotéza fail2ban REJECT / MaxStartups; přetrvává-li >1h → provider console). ⚠️ EDGE clock skew ~+47 min vs EDGE2 (dle replica mtime) — k ověření, když sshd ožije.
>
> **🆕 2026-10-27 (3) PAYOUT ENVELOPE REGRESSION → FIX `f5364566` + DR REPLIKACE LIVE:** **Incident (vlastní regrese z 2.S2 fixu):** `submit_utxo_transaction` unwrapovala `result` před `parse_payout_submit_response` (který očekává celý envelope) → **každý accepted submit** = "no result" → indeterminate → inputs-spent probe → drop-as-landed. **Okno 00:19–08:56 UTC: ~94 payout tx on-chain accepted — minery placené 1× (at-most-once invariant držel!), ale ledger rows chybí.** Odhaleno live watchem sweep cyklu (`payout submit indeterminate and inputs spent ... tx_id=` v journalu — tx_ids recoverable pro backfill, 👤 rozhodnutí, ledger=evidence). **Fix `996162bf7`:** funkce vrací raw envelope, parser klasifikuje. Lekce: envelope-vs-result kontrakt testovat s reálným node shape `{"result":{"accepted":true,"model":"v31-native","tx_id":...}}`. **7.B2 uzavřeno** (`AUDIT_SCOPE_7B2_POOL_RESIDUALS.md` — 4 residuals mitigované/reframed) + gauge `zion_pool_dedup_marks_dropped` (`0c805642`). **7.B7 krok:** `zion-pool-state-replicate.timer` AKTIVOVÁN — EDGE→EDGE2 `/opt/zion/data/v31-pool-standby/` 15min: `VACUUM INTO` store.db + pplns + payout ledger (přidán — standby bez něj resubmittuje!). Fix `TARGET_SSH_OPTS` unbound. **Pool stav:** `f5364566`, payouty tečou+records, dedup_dropped=0, 4 listenery, DR replikace běží.

> **🆕 2026-10-27 (2) 2.S2 PAYOUT DOUBLE-PAY ROOT CAUSE FIX — DEPLOYED `cdbb8a29`:** Reconcile ledgeru (report `docs/3.2/REPORTS/REPORT_2026-10-27_PAYOUT_RECONCILE.md`): **1 441 confirmed dup párů ~5.9M ZION** (exact-amount join — dřívější ~70M odhad byl artefakt), vše přesně ~1 sweep interval (30 s) → in-process mechanismus. **Dva defekty:** (a) `record_payout` stampoval každý řádek `payouts.first().height` místo per-entry → phantom duplicity při mixed-height batchi (ledger lhal — podíl párů je artefakt, ne reálná double-pay); (b) ambiguous-submit: `submit_utxo_transaction(...).await?` při RPC error tichě dropnul entries (lost payout) a ad-hoc 64-hex `tx_id` validace při nejednoznačné response dělala requeue+resubmit → reálné double-pay (node mohl tx přijmout). **Fix `ae2a09489`:** per-entry height ve `PayoutRecord`; sdílený striktní `parse_payout_submit_response` (nyní `pub`); requeue pouze při **explicitním rejectu** (`error`/`accepted=false`) NEBO po `inputs_still_unspent` probe — re-fetch pool UTXO, všechny tx inputy unspent ⇒ resubmit safe, spent/probe-fail ⇒ treat-as-landed drop+warn (fail-closed). Vyloučeno: `deferred` queue dead-code, `on_coin_revenue` zion nemůže (`native_payout_coins="prl"`), multichain `execute_payouts` dormant (pool=None), `paid_block_heights` dedup čistý. Deploy: build 20m EDGE, drain čistý (schema v9, tracker 1000, counter 3, dedup 1118, 4 listenery), health ok. **2.S2 gate: post-fix counting od 27.10., re-count 24–48 h.** 👤 operator: treasury dopad skutečných duplicit (max ~5.9M ZION), historie = evidence.

> **🆕 2026-10-27 (1) IA-14 PAYOUT LEDGER HARDENING — DEPLOYED `5742e840`:** Audit residual 7.B5 uzavřen. `persist_payout_ledger` přešel na F1.2 standard: tmp write + **fsync(file) + rename + fsync(parent dir)** (dřív plain write+rename — drain-persist nedurable → power-loss mohlo resuscitovat už předané payouty = double-pay okno). `load_payout_ledger` corrupt = **fail-closed**: quarantine `<path>.corrupt-<unix>` + `Err` → startup refusal (dřív fail-open „starting empty" = tichá ztráta všech idempotency guardů `paid_block_heights`/`sent_payouts`/`pending`); missing file = fresh state. Testy 4/4 (corrupt→Err+quarantine, missing→default, roundtrip). Deploy: EDGE build 20m, drain restart čistý (schema v9, tracker 1000, counter 4, dedup 1173, listeners 8444/8445/8446/8080), health ok, 4 sessions. **Build gotcha:** `--locked` selhal — nové dep verze (quinn-proto 0.11.19…) nejsou v EDGE cargo cache → build bez `--locked` resolvnul. Bonus: running `bc5945fe` = `zion-pool-wedgewatch.sh` bash skript, ne druhá instance poolu.
>
> **🆕 2026-10-26 (9) MAINNET BETA SWEEP NASAZENÝ LIVE:** **Alpha→Beta relabel napříč ekosystémem dokončen a nasazen** (commity `eb4c472be` appky, `bee64d5e7` manifesty+dashboard, `9ca9e54c5` docs, `e32a932ff` fmt). Nový verifikační test `scripts/ops/test_beta_release.py` — **8/8 PASS** (site constants, verze nezměněny, žádný same-line "3.2.0 … mainnet stable" claim v IntroPage, portálové badge, mobile labely, CLI/miner banner, protocol handshake `zion-v3-node/3.1.0-alpha` záměrně zůstává = wire ID). Mezery doplněné při sweepu: CLI about → "ZION Mainnet Beta CLI", miner banner, DAO `/health` → `CARGO_PKG_VERSION` + `release_stage:"beta"`, mobile `NETWORK_RELEASE_LABEL`+`CLIENT_STAGE:'preview'`, same-line stable claimy v maintenance.html/intro-tabs.js rozděleny přes `<br/>` (zachován význam). **Deploy:** `deploy-web2.9.sh` → `zion-website` restart, `/api/health` hlásí `release_stage:"beta"`, 6× "Mainnet Beta" na homepage (zbývající 1× "Alpha" = legitimní historická reference v news článku o přechodu). **Deploy lekce:** `--exclude='node_modules'` rsync je safe pro label-only deploy — bundled deps se mění jen při verzním bumpu next.
>
> **🆕 2026-10-26 (8) POOL PAYOUT-BACKLOG GAUGES + v9 RE-PROOF:** **`e2ce9bdd1` nasazeno (build `0d3a5a87`)**: `/metrics` nově exportuje `zion_pool_payouts_unconfirmed` + `_flowers` + per-coin `zion_pool_payouts_unconfirmed_coin{,_flowers}` z `payouts` tabulky (1 indexovaný scan/scrape — wedge lekce respektována). **Live:** `931` unconfirmed zion payoutů @ ~1.22e12 flowers — přímá visibility pro 2.B7 treasury deficit (pozor: gauge ukazuje `coin="zion"` řádky; vztah k "918 QTC deferred" ověřit — payout coin ≠ treasury coin nutně). Drain + restore opět čisté: `shares_since_last_block=35` přeneseno přes restart — v9 counter mechanism spolehlivě drží.

>
> **🆕 2026-10-26 (7) POOL 2.B8 UNVERIFIED-CREDIT BUCKET + DEPLOY RUNBOOK:** **`c731bf0ea` nasazeno (build `4e5313dd`)**: audit P-05 residual — `accepted_unknown`/`accepted_stale_upstream` už nekredituje silently. `is_unverified_credit` klasifikace (jen tyto 2 statusy), `StreamStats.unverified_shares` → `/miners` per-stream + `zion_pool_coin_shares_unverified` Prom gauge (upstream-quality signál, live 0). Knob `ZION_POOL_UNVERIFIED_CREDIT_PCT` (default 100, clamp ≤100 — **žádná tichá ekonomická změna**; operátor sníží váhu až při degradaci) aplikován na všech 3 externích credit místech (qtu stratum, pearl, v3 auxpow). **2.B2 formalizováno:** `V31/deploy/POOL-DEPLOY-RUNBOOK.md` — build-on-EDGE, backup, drain, **15min canary gate** (accept ≥ baseline−5pb), verify, rollback. První canary naživo: zion 396/14 ≈ 96.6 % ✅. Bonus ověření v9: drain restore `shares_since_last_block=6` — counter přenesen přesně. Testy: klasifikace, pct clamp, counter — 3/3 ✅.

>
> **🆕 2026-10-26 (6) POOL v8/v9 LUCK PERSISTENCE DEPLOYED (2.B4):** **Schema v8** `blocks.shares_since_prev` — `record_block` zapisuje počet accepted shares od předchozího bloku na obou cestách (confirmed/orphaned); upsert drží `CASE WHEN excluded.shares_since_prev > 0 THEN excluded ELSE blocks` + sticky-confirmed zachován. **Schema v9** `pool_state` kv — **design lesson:** původní plán počítal counter z `shares` tabulky, ale produkce do ní NIKDY neinsertuje (shares žijí v PPLNS memory+JSON a dedup) → `accepted_shares_since` by byl mrtvý kód vždy vracející 0. Místo toho single-row counter flushovaný 30 s tokio intervalem (mimo per-share path — wedge lekce) + finální write v drainu. **Boot restore v `main.rs`:** po migracích, před listenery/API — `query_blocks_for_coin("zion",1000)` oldest-first + `get_state("shares_since_last_block")` → `BlockTracker::restore` (rekonstruuje luck window, totals, pending, counter). `record_block_found` nově vrací u64. **Deploy:** `31a9fcde3`+`1985eac3b`, EDGE build `00f49a94`, drain restart čistý, migrace v7→v8→v9 bez ztráty (97 589+ bloků). **Live důkaz:** `block tracker restored restored=1000`, nový blok hned po startu → `luck_100: 173.9`, `found:1001/confirmed:889/orphaned:111`, `/stats` 0.9 ms, 4 sessions. Pre-v8 řádky mají `shares_since_prev=0` → `pool_luck_pct` je přeskakuje (luck se naplňuje postupně). Rollback `/root/pool-deploy-backup-20261026-v8/`. **Kolize s paralelní session:** její rsync přepsal mé soubory a deployla pre-v8 build (`2ebee5ce`, restart 21:47, log "schema already at v7") — detekováno nesrovnalostí exe-hash vs. journal; re-sync + rebuild + redeploy. Testy: v7→v8 migrace, roundtrip, `test_restore_rebuilds_luck_and_counter`, `pool_state_counter_roundtrips` — 8/8 tracker + všechny store ✅.

>
> **🆕 2026-10-26 (5) WEBSITE Next 16.4.3 DEPLOY + npm audit triáž + pool `/stats` transient:** **Deploy:** `apps/website-v2.9` `next` 16.2.9 → **16.4.3** (GHSA critical range <16.4.0 — standalone server + `images.remotePatterns` = reálná expozice). Build `npm run build` (webpack — Turbopack neumí resolve `fs`/`net` aliasy z `zion-wallet-sdk`/`zion-rpc`); 201 str., standalone OK. **Deploy gotcha:** `deploy-web2.9.sh` rsync `--exclude='node_modules'` přeskočí i `.next/standalone/node_modules/` → bundled deps se NESYNCNOU; pro verzní bump je potřeba druhý rsync `.next/standalone/` bez exclude (jinak běží starý next z cache). EDGE2 top-level `node_modules/` zůstává na 16.2.9 (pro standalone irelevantní — server jede z bundled). Live: `zion-website` journal "Next.js 16.4.3", `/api/health` ok, routy 200. **npm audit triáž:** static-export apps (IntroPage/OasisWeb/pool-ui) = build-time risk, akceptováno; MarketPlace 14.2.35 bez 14.x patchu → major bump 14→16 jako RC položka; mobile/desktop mimo veřejný povrch. **`/stats` wedge:** pool API `/stats` ~1 h visel (`pool.lock()` kritická sekce — `/health`/`/metrics`/`/miners`/public OK, jen `/stats` timeout 8-10 s). **Neuzdravilo se samo** — souvislost s restartem 20:50: wedged proces (pid 1529617, build `2f6fdf7e`) na SIGTERM udělal grace drain, ale **neukončil se → systemd SIGKILL po 31 s** (`status=9/KILL`); nová instance ihned odpovídala → příčina: ve wedged procesu něco drželo lock/blokovalo exit path (korelace `/stats` hang + SIGKILL exit). Následně 2 čisté drain restarty (`drain: complete — exiting`) — A4.3 funguje; produkce na buildu `623e3e6a`. **Fix monitoring:** `zion-writepath-probe` (EDGE2, 60 s) nově měří `/stats` ok+latency přes tunel → `zion_pool_stats_api_ok`/`_latency_seconds`; 2 nové alerty (`ZionPoolStatsApiUnresponsive` 10m, `ZionPoolStatsApiSlow` >3s/15m) live na EDGE Prometheu; stack verzínován v `V31/deploy/monitoring/`. **RCA + FIX (`1157fcfb3`, deployed build `d6e5332a`):** `record_dedup_mark` (A4.1) dělal **2 synchronní SQLite commity za share pod `pool.lock()`** — pod disk zátěží (EDGE build+miner) lock držel skoro pořád → API hladovělo + exit path blokoval → SIGKILL. Fix: `DedupOp` bounded queue (8192) + `dedup-writer` thread — batch do jedné txn, prune až každých 60 s (ne per-mark!), share path jen `try_send` fail-open. **Deploy ověřen:** drain clean exit, `share dedup restored restored=1138`, `/stats` 1 ms, marks rostou 1138→1139+, 29 shares/min. Lekce: **žádná synchronní I/O pod `pool.lock()`** — dedup pattern = reference pro ostatní persist cesty.

>
> **🆕 2026-10-26 (4) POOL DEPLOY v6 (sticky-confirmed + reject telemetry + history) + POOL-UI REBUILD LIVE:** **Backend:** `zion-v31-pool` restartován na binárku `c39e1dbe…` (EDGE build `cargo build --release --locked -p zion-pool -j2`, glibc 2.39 → lokální buildy NENASADITELNÉ). Obsah: sticky-confirmed block status (`0796497e2` — `confirmed` už nelze přepsat `orphaned`), `reject_reasons` buckety (duplicate/low_difficulty/stale/unauthorized/malformed/other), A1.3 `fcbf2aec0` (schema v6 → `PRAGMA user_version=6`, tabulka `miner_history`, `/public/v1/miner/{coin}/{wallet}/history`, `hashrate_by_coin` v `/public/v1/history`). Ověřeno: `active`, `/proc/PID/exe` sha = build sha, listen 8444/8445/8080, 4 sessions / 6 miners reconnect ~60 s, reject_reasons `{zion:{duplicate:1}}` živé, blocks 97292–96 confirmed, G8 probe netknutý. Rollback: `/root/pool-deploy-backup-20261026/` (running-binary `d988bcad` + `pool-store.db` 130 MB + `pool-pplns.json`). **UI:** `apps/pool-ui` rebuild live — miner dashboard (online pill, est_daily, PPLNS window_share, worker accept-rate, 24 h server historie + localStorage fallback), blocks (network/share difficulty, status pills, miner→dashboard linky), stats ze server history, flowers÷1e6 normalizace; dist hashe = `/var/www/pool` hashe. **SSH lekce:** fail2ban na EDGE banuje IP při častých spojeních → `ssh -o ControlMaster/ControlPersist` master conn, minimum handshake; EDGE2→EDGE tunel nese jen forwardy (edgetunnel = nologin). **Pool alerting:** `rules/zion-pool.rules.yml` (7 pravidel, job `zion_v31_pool` už byl scrapovaný :8080/metrics) — live, 0 firing. **Live důkaz sticky fixu:** `notify_orphan height=97297` po `previous hash mismatch` → DB řádek zůstal `confirmed` (dřív by downgrade na orphaned).
>
> **🆕 2026-10-26 POST-AUDIT VERIFIKACE + PLÁNY v3.3 / 3.2.x:** Nové/přepsané plány: `NIRVANA-V3.3-MAP.md` (registr všech v3.3 plánů, crosswalk N/M/R/V33/W/3.2.x, závislosti, ekosystémová matice, rozhodovací fronta 👤), `NIRVANA-V3.3-CHECKLIST.md` (stav 26. 10.), `docs/3.2/3.2.1-3.2.9_PLAN.md` (ALPHA → BETA → RC → Mainnet Stable, ID položek `2.B1`/`7.S1`/`P0-n`). **Code gates na `ad8ab5895`** (oddělený worktree, nesahat na `V31/target` když paralelně builduje jiná session): `cargo test --workspace` 2 839/0 fail/29 ign, check OK, Foundry 48/48, ZIS 46/46; clippy 0 errors/~110 warnings, fmt drift 25 souborů, npm critical (website 2, MarketPlace 1, OasisWeb 1, IntroPage 1, pool-ui 1, mobile 3); `cargo audit` není nainstalovaný. **Live P0 nálezy (oba vznikly migrací 21. 10., OPRAVENO 26. 10.):** (1) **L5 free-world scanner stál od 21. 10. 14:00** — proces držel smazaný inode `free_world.db` (rsync pod běžící službou → SQLite „attempt to write a readonly database") → ✅ restart: catch-up 6 732 tithe bloků na tip 97 064, zápis OK, recovery dump `/data/zion/free_world.db.recovery-20261026` (obsah totožný, 0 ztráta); (2) **db-sync bez autentizace do PG od 21. 10. 13:59** → ✅ heslo role `zion` v `/opt/zion/shared/.env` sjednoceno s funkčním z MarketPlace env (`.env.bak-dbfix-20261026`), upserty `MiningWorker` běží; (3) sdílený `edge-environment` = každá V31 služba vidí cizí credentials (P0-3 otevřené — rotace + per-service env subsety). **G9 externí audit: 👤 posunut 26. 10. na neurčito** — Stable bez data; audit package držet připravený na RC commit. **Další:** stale bloky 15–21 % (`previous hash mismatch`, template poll 1 s → RCA 2.B1); tracked `public/` subtree neexistuje (→ `archive/PUBLIC/`), G4 workflow předefinovat. **Lekce:** po migraci ověřovat zápisové cesty, ne jen `is-active`; při čtení `/proc/*/environ` vždy **allowlist** klíčů (denylist typu `KEY|SECRET|TOKEN` propouští `*_PASS`).
>
> **🆕 2026-10-26 POOL SHARE-REJECT ROOT CAUSE FIX (~50 % → ~4 %):** **RCA** — všechny 3 submit cesty (`stratum.rs` v1 ~L678, TLS-v3 ~L2657, v3 ~L3172) validovaly shares proti `ctx.vardiff.share_target()` = **live session target**, zatímco miner hashuje proti targetu vydanému V jobu (`target_hex` v notification). Po každém vardiff retargetu (20 accepts, skoky ~1.5-4×) se laťka retroaktivně zvedla → staré joby = ~50 % reject (`dest-zion` accept ~44 %, 1259 invalid). `_share_target`/`_job_share_target` v job tuple se ignoroval — komentář tvrdil "replay protection", ale replay kryje `share_seen(job,nonce)` dedup. **Fix** (`a12c97645`): validace + credit proti uloženému `job_share_target`, credit = `telemetry::expected_hashes_for_target(&job_target)`. **Deploy gotcha:** edge build tree je `/opt/zion/V31` (working tree ≠ HEAD — +8395 řádků local diffů, binárka = working-tree build!); cargo jen v `/root/.cargo/bin`; glibc edge 2.39 < local 2.43 → lokální binárka NENASADITELNÁ, buildovat na edge (~8 min). Backup: `stratum.rs.bak-pre-jobtarget-*`, žádný binary rollback — rebuild z bak. **Výsledek:** ZION accept 176/8 = **95.7 %** (předtím 44 %); dashboard "High share rejection rate" alert byl REÁLNÝ signál, ne false positive.
>
> **🆕 2026-10-25 EXPLORER AUDIT + FIXES (app.zionterranova.com/explorer):** Probe všech 22 stránek + 17 API endpointů — většina OK. **Fixy:** (1) `api/blockchain/sse/route.ts` — `network_hashrate` vždy 0 (`info.network_hashrate` pole daemon neposílá) → fallback `difficulty/target`, live ověřeno 36.1 H/s. (2) `api/blockchain/richlist/route.ts` — **27 s per-request** (getRichList full-scan, žádná cache) → in-memory TTL 60 s cache na MAX_LIMIT=500 + per-request slice/stats (pattern z `miners/route.ts`); live 27 s→0.22 s. **Bez defektu:** `/api/supply` 404 na rootu = záměr (jen `/total`+`/circulating` leafs); detail endpointy = query-param API (`?hash=`,`?addr=`), ne path segments; `/explorer/richlist`→`/explorer#richlist` anchor existuje; mempool=0 + bridge/txs prázdné = skutečný stav chainu, ne bug. Deploy = `npm run build` na EDGE2 (první pokus failnul ENOTEMPTY na stale `.next/standalone` — `rm -rf` + rebuild OK; backup `.next.bak-explorer-*`).

>
> **🆕 2026-10-25 PEARL UPSTREAM FWD_MAX FIX + EDGE OPS:** **Pearl share-loss RCA** — luckypool hlásil ~15 TH/s vs self-report ~24 TH/s. Root cause: `ZION_POOL_PEARL_UPSTREAM_JOB_TTL_MS=900000` (15 min, vyladěné), ale `ZION_POOL_PEARL_UPSTREAM_FWD_MAX_MS` unset → `pearl_upstream.rs` default **90 s**. Dvě ztráty: (1) share na jobu >90 s zahozen jako `StaleForward` před forwardem (24h: **34 drop / 160 accept ≈ 17.5 %** — luckypool notify kadence 40–180 s, mezery běžně >90 s přestože job je stále aktuální); (2) `pick_served_job`/`latest_forwardable` též na fwd_max → v mezeře >90 s minerům **žádný pearl job** = tichý idle. **Fix (env-only):** `ZION_POOL_PEARL_UPSTREAM_FWD_MAX_MS=900000` v `/etc/zion/edge-environment.sh` (ř. 350) + restart poolu → reconnect OK, 0 dropů. **Do příštího rebuildu:** retirovat podle *supersede* (forward dokud newest v ringu + grace), ne `received_at+fwd_max`. `hs` pole = syntetický ekvivalent (att/s × 6.9e9), NE fyzický H/s — luckypool `hashrate` je server-side odhad z accepted shares. **EDGE opravy:** zombie `apt-get` (3.5 d, držel lists/lock) zabit → `apt update` OK; **certbot** fix — pip `cryptography 49.0.0` v `/usr/local` stínil systémový 41.0.7 → pyOpenSSL `GEN_EMAIL` crash → odebrán `--break-system-packages`, staging renewal ověřeno (`auth.` expiruje 25.11.); `zion-edge-maintenance` ručně doběhla. **EDGE2:** `vastrigs-sync.sh` += last-good fallback (exit 0 při down tunelu 127.0.0.1:8088 pokud existuje validní output; backup `.bak-20261025`). **Dashboard:** `app.py` sampler `as_completed(timeout)` zabíjel celý tick (watchdog/alerty přeskočeny) → fix `f1ac546ca` nasazen. **G8 run #5** `g8-20261025T215746Z` (stop run #4 archived → start + update; pending, 100 % first sample) — gate selže bez stabilního ZION hashpower (tip staleness >900 s z >15 min block-gapů). **Mining na Edge navýšeno:** fallback-miner 1→4 vlákna/200 %/nice 19 (~57 H/s), `zion-v31-miner` re-enabled (99-zz-liveness-tune: 4 vlákna/150 %/**nice 19** — přepsáno děděné nice 5/400 % z 99-zion-tuning, šikanovalo by followery), node2 restart vyčistil poisoned mempool (97 %→~40 % CPU).

>
> **🆕 2026-10-25 VAST-RIGS SYNC FIX:** `/vast-rigs/status.json` na apexu byl stale od web cutoveru 22.10 — vastctl-daemon (zionserver) pushuje jen `--push zion-new:` (Edge), ale `/vast-rigs/` se po flipu servuje staticky z EDGE2 `/var/www/zion-maintenance`. **Fix:** `zion-vastrigs-sync.timer` na EDGE2 (60 s) → `/usr/local/sbin/vastrigs-sync.sh` tahá `http://127.0.0.1:8088/api/status` (existující reverse tunnel zionserver→EDGE2, vastctl-serve) → atomic tmp+json-validate+mv do webrootu; při výpadku tunelu drží last-good. Fleet: 1 rig `57054247` (RTX 3060, $0.0729/h) — qtu 228 MH/s + prl 24 TH/s + xmrig 780 H/s, vše OK. SMOS 518837 stále offline (`smos:null`).
>
> **🆕 2026-10-24 EKOSYSTÉM Sjednocení F3–F6 (5 commitů, deploy live):** **F3 uzavřen** — žádné další redirecty obsahových stránek (precedent `/l*` pod `/world`); nav: `/network` += children `/monitoring`,`/g8`,`/miner-stats`; layers += `/ai-native`. **F4:** `/market` += canonical card→`market.zionterranova.com`; pool.zionterranova.com + `/pool` oba povrchy zůstávají. **F5:** VŠECHNY deploy skripty retargetovány Edge→`zion-edge2` (nasazovaly na fallback!); nový `apps/MarketPlace/deploy/deploy-marketplace.sh`; `infra/RUNBOOK.md`+`infra/deploy/README.md`; SSH alias `zion-edge2`=root@207.180.217.100:22 (přidán do `~/.ssh/config`). **F3f:** dead links 390→383 (7 cross-book oprav); zbytek = interní refs (muted non-link správně) + missing content = editorial pass, NE sed-job. **F6 cleanup (archive-first):** EDGE — stale `/opt/zion/website-v2.9` tar+rm, `wt-f5`/`wt-main` worktrees (3.4G), prunable `pool-F5`, `oasis.bak-*`+`oasis.prev`+`newearth`; EDGE2 — `.next.bak-*` 11→2, `public_html` (428M, bez vhostu), `oasis.bak-*`+`newearth`. Archivy `/opt/zion/archive/cleanup-20261024/` na obou (381M+601M). **2 ops lessons:** ⚠️ `.bak` soubory v `/etc/nginx/sites-enabled/` se PARSE'ují (include `*` bere vše — bak confy ven do `/etc/nginx/backups/`!); `zion-edge-backup` failoval na `/data/zion/g8_run.json` root:600 vs service user=zion → `chmod 644`. `backups/` 36G = legit rolling retention — nesahej. Zbývá: `zion-edge-download.conf` catch-all utáhnout, stale CORS `newearth.cz` v `zion-v31-multichain.service`, Edge tunnel legs review, repo rezidua (`APP&WEB/` 8.8G, `docs/WP-Mainet/` 50M, `PUBLIC/` klon — čeká na souhlas s delete). V31 beze změny (excluded). **→ VŠE DOKONČENO (2026-10-24):** catch-all utažen (`_`→`server_name 62.171.141.136` + 444 catch-all, IPv4+IPv6, ověřeno live); tunel legs = všech 18 má aktivní konzumenty → ponecháno; CORS newearth odstraněn + restart OK; **repo rezidua smazána po verifikaci** (`APP&WEB` 8.8G + `docs/WP-Mainet` 50M — před delete zachovány: `desktop-agent/resources/` 79M miner binárky [electron-builder `"from": "resources/"`, v apps/ chyběly!], `OasisWeb/.env*`, `IntroPage/public/dashboard/`, `api-contabo.md`→`docs/3.2/ops/`). ⚠️ **Case-FS lesson:** `PUBLIC/` a tracked `public/` = **jeden adresář** (stará V3 public distribuce, 2989 souborů) — přesunut do `archive/PUBLIC/` (commit), NIC se neztratilo; žádné manifesty na root `public/` neodkazují. Untracked zůstává jen `L4data/img/OasisMaitreya.png` (nový asset).

> **🆕 2026-10-22 DASHBOARD — NOVÉ EDGE2 SLUŽBY + LOKÁLNÍ NODE REBUILD:** EDGE2 získal nové služby (web ingress cutover příprava — viz DNS zone + catch-all commity `ddae88015`/`0863a6cd7`): `zion-hiran-inference` (llama.cpp :8002, Q5_K_M), `zion-g8-probe` (exporter :9105), `zion-l1-watcher` (MARKETBUY→relayerSettle), nginx :80/:443. **Dashboard:** registry += `edge2-hiran-llm` (L3), `edge2-g8-probe` + `edge2-nginx` (Infra — renderují přes `/api/services`, NE `/api/layer` — "Infra"≠"INFRA" match!), `edge2-l1-watcher` (L4). `systemd` health_method rozšířen o `systemd_unit` field + SSH `is-active` pro `site:edge2`. `_sysd` EDGE2 merge += 3 unity; `EDGE2_JOURNAL_UNITS`/`EDGE2_UNITS` += `zion-l1-watcher` (zion-g8-probe + zion-hiran-inference + nginx jsou na obou hostech → vynechány z EDGE2 journal routingu kvůli ambiguitě). ⚠️ Pozor: `svc["ports"]` KeyError zabil `/api/services` → `ports_remote`-only entries musí mít `"ports": {}`; `depends_on` musí ukazovat na registry `id` (marketplace, ne zion-marketplace). **Lokální node:** crash-loop `zion-node binary not found` (release dir prázdný) → `cargo build --release -p zion-core --bin zion-node` (2m41s, 3.2.0) → synced 91915, parita s EDGE2.

# AGENTS.md

> **Operativní příručka pro agenty a operátory ZION TerraNova.**
> **Aktualizováno: 2026-10-21** — po dokončení splitu EDGE → EDGE2 (viz níže).
>
> **Lifecycle (2026-10-26):** aktuální stupeň = **3.2.0 Mainnet Beta** (≠ Stable, žádný nový chain/fork). Handshake `zion-v3-node/3.1.0-alpha` zůstává záměrně — wire ID, ne stupeň zralosti. Konsensus/genesis/emise/ekonomika/síť bez změny.
>
> **Jak číst:** sekce níže jsou *pravidla a runbooky* (načíst celé, ~130 KB).
> Historický provozní log byl odsunut do [`docs/3.2/ops/AGENTS-CHRONOLOGY.md`](docs/3.2/ops/AGENTS-CHRONOLOGY.md) — odkazy ve tvaru „AGENTS.md 2026-09-14“ v korpusu dokumentů vedou tam. Superseded reference (V3-era topologie, v3.0.4 porty) je v [`docs/3.2/ops/AGENTS-LEGACY-SERVER.md`](docs/3.2/ops/AGENTS-LEGACY-SERVER.md).

## Aktuální živá topologie (2026-10-22 — po web-tier cutoveru)

| Role | Host | Služby / porty |
|---|---|---|
| **EDGE2 — primary + web ingress** | `207.180.217.100` (vmi3684458, 6c EPYC / 11 G / 193 G) | **nginx :80/:443 — veřejné vhosty: apex/www, app., auth., freeworld., market., oasis., pool., rpc. (DNS cutover 2026-10-22)** · V31 primary node (RPC 9445, P2P 8335), bitcoind mainnet (8332, pruned), quantus (9944 + QUIC 9833), pearl stack (44207 / 8477), PostgreSQL 16 (5432), WARP (8453/8454), ZIS (8096), db-sync, DAO (8456), OASIS (8094), free-world (8095), issobella (8097), NCL (8098), website (3000), marketplace (3100), ai-native (8001), btcunlock (8779) |
| **EDGE — ops + pool + stray subs** | `62.171.141.136` (vmi3425821, 4c / 8 G / 145 G) | nginx — jen ops/legacy vhosty (grafana., dashboard., api., explorer., mining., testnet., newearth.cz, wildcard `*`), pool 8444/8445 (stratum + TLS) + API 8080, fallback-miner, node2 (9446) + node3 (9447) followeři, regtest BTC, dashboard (8766), grafana, prometheus, fail2ban. **Web ingress přesunut na EDGE2 — Edge nginx = fallback.** |
| **Tunely** | edge → EDGE2: `zion-chain-tunnel` (`chaintunnel`, `permitopen` whitelist: 9445, 9944, 44207, 8332, 8477, 8453, 8454, 8456, 8094–8098, 5432, 3000, 3100, 8001) · EDGE2 → edge: `zion-edge-tunnel` (`edgetunnel`: 8080, 8003, 9446, 9447) | latence edge↔EDGE2 ≈ 1 ms → cross-box RPC je prakticky lokální |

- **Apex `zionterranova.com` je na EDGE2** (DNS flip 2026-10-22) — static export `/var/www/zion-maintenance` (`location /` → `try_files …/index.html`). Operátorské `/vast-ops/` API = `location /vast-ops/` → `proxy_pass http://127.0.0.1:8088/` + `auth_basic /etc/nginx/.htpasswd-vast` (zkopírováno z edge); upstream = `vastctl-tunnel-edge2.service` na operátorské stanici (`ssh -R 8088 zion-edge2`, sestra `vastctl-tunnel.service` → edge). `/vast-rigs/` včetně `status.json` píše `vastctl-daemon` do EDGE2 webrootu. **Past:** zálohy `.bak` NIKDY v `sites-enabled/` — include glob `*` je načte a duplicitní `server_name` způsobí varování/shadowing.

- **Chain:** ~90 400+ bloků. EDGE2 = source of truth; node2/node3 = followeři peerující EDGE2:8335.
- **Pool zůstává na EDGI záměrně** — stratum musí vidět reálné IP minerů (`ZION_POOL_MAX_SESSIONS_PER_IP=10` + IP ban); nginx stream proxy by je sjednotil pod jednu IP a rozbil per-IP limity.
- **Watchdog** na EDGI hlídá `node2, node3, pool, fallback-miner, chain-tunnel`. Ghost `node1` je vypnutý (jinak watchdog vzkřísil split-brain na starém tipu).
- **Rollback:** `/root/cutover-*-rollback.sh` na EDGI — jedno okno = jeden skript. Zpětnovazné zobrazení kroků v [`INFRA-SPLIT-PLAN.md`](INFRA-SPLIT-PLAN.md).
- **Health:** `/api/health` = 28 služeb / 0 not-up; dashboard karta EDGE2 (`/api/edge2-status`).
- **G8 30-day continuous-run gate (2026-10-21):** Cíl ≥99.9% uptime, žádný critical incident (≥900 s). Run #3 (`g8-20261010T063655Z`) skončil `failed` (94.87%) — 10.1 h `chain_live` outage (2026-10-10T23:00 → 10-11T09:07, 36 420 s) + 24 min výpadek všech 6 služeb (10-18T16:34). **RCA:** G8 probe sledoval port **9445 = EDGE2 primary přes `zion-chain-tunnel` (SSH `-L`)**. Když se tunel zhroutil (SSH `ServerAliveCountMax=3` / 15 s), probe přestal odpovídat a `chain_live=0` až do obnovení tunelu. Žádný skutečný výpadek uzel — jen single-point-of-failure v monitorování. **Oprava:** G8 probe na Edge nyní sleduje **lokální followery `9446,9447` + primární `9445`** (`G8_NODE_RPC_PORTS=9446,9447,9445`), restart `zion-g8-probe.service`. EDGE2 (primární uzel) nyní má vlastní G8 probe (`zion-g8-probe.service`, port 9105, `G8_NODE_RPC_PORTS=9445`) a `zion-edge-watchdog.timer` (120 s). Run #4 (`g8-20261021T151308Z`) spuštěn, gate `pending`. Zároveň nasazen pool fix `ZION_L1_RPC_TIMEOUT_MS` (per-attempt 12 s, `L1Endpoints` 4→12 s na Edge; EDGE2 pool binárka je stále stará, ale EDGE2 nemá lokální pool — tunelovaný z Edge).
- **ZIS hardening 2026-10-21 (kompletně nasazené, oba boxy):** `apps/identity` přepsáno na produkční úroveň — **EdDSA/Ed25519 JWT** (`JWT_PRIVATE_KEY` v env **jako base64**, plain PEM/escaped-`\n` padá v `createPrivateKey`), reálné JWKS `/.well-known/jwks.json` (`kid=zis-4c28033ed681216f`), legacy HS256 verify přes `JWT_SECRET` do expirace starých session. DB-backed `AuthChallenge`/`WebAuthnCeremony`/`AuthEvent`/`VerificationToken` (+hourly prune), audit log (SetNull na delete), `/metrics`, admin API (`role=admin` nebo `x-service-key`), service-key notifikace, e-mail verify přes sendmail/postfix (`ZIS_EMAIL_ENABLED=1`), unlink/primary/delete/google-link/owner-wins login. **Systemd unit = `/usr/local/bin/node` (Node 22)** — `/usr/bin/node` je Node 18 a crashuje. **Dvě instance, jedna DB+jedna klíč:** edge (public `auth.zionterranova.com` přes nginx) + EDGE2 `127.0.0.1:8096` (lokální pro warpd `ZION_MULTICHAIN_ZIS_AUTH=1`); deploy script `deploy/deploy-zis.sh` syncne obě strany, rsync `/opt/zion/identity` mezi boxy. **L2 auth = cookie introspekce** přes `/api/auth/me` — wallet proxy musí forwardovat `Cookie: zion_session=<signed>` (fix `374548faf`, regresní testy `6f81ec8cf`); Bearer projde jen pro `zis_*` API klíče. **Pearl chainType fix** (`ef398ab5a`): `zis_chain_type` bucketoval Utxo→"bitcoin" a skrýval `pearl` linked adresy — Utxo teď `chain.as_str()`. warpd běží **jen na EDGE2** (edge1 unit inactive; edge1 8454 = SSH tunnel do EDGE2). **Monitoring:** Prometheus job `zis` + rules `/etc/prometheus/rules/zis.rules.yml` (ZisDown/HighErrorRate/PendingChallenges/AuthFailureSpike). **UI:** website-v2.9 (EDGE2 `/opt/zion/APP&WEB/website-v2.9`) SecurityPanel má link form ZION/EVM/**Quantus/Pearl** (ZION-key attestation `challenge\n<chain>:<addr>`). Testy: identity 45/45, multichain 736/736.
- **AI-native + Hiran inference (2026-10-22, obnoveno po výpadku rigu):** `zion-v31-ai-native` běží na **EDGE2** `:8001` (binárka přebudovaná v `rust:1.97-bullseye`, max GLIBC 2.30) — **Maestro v2.4 live** (`/v2/info`, `/v2/health-matrix`, `/v2/plan`; mutations default OFF + `requires_approval` gate), BM25 RAG **39 docs / 138 chunků** v `/opt/zion/data/l3-rag-docs` (EDGE2), **konstituční systémový prompt** (fee split 89/5/5/1, 1 ZION = 1e6 flowers, PoW/L1/L2–L6) — bez něj 8B model halucinoval. **Primární inference = operátorský PC** (karty RX 5600 XT + GTX **1070 Ti**; `hiran-v2.3mini-Q5_K_M.gguf` běží na **standalone `zion-hiran-cuda.service`** = `~/llama-cpp-cuda/llama-server` (sm_61 custom build) na `127.0.0.1:8071`, `-ngl 30 -c 12288 -ctk/-ctv q8_0 -fa on --reasoning off --alias zion-l3,hiran-v2.3mini`, ~6.9 GB VRAM trvale — LM Studio neumí KV-quant flagy → ctx 4096 f16 byl strop, q8 KV → 12288; ai-native `LLM_MODEL=zion-l3` obslouží alias; **`zion-hiran-proxy.service` `:1235` routuje podle `model` pole: zion-l3/hiran* → `:8071`, `qwen2.5-coder-7b-instruct` → `:8072` (`zion-coder-cuda.service`, GPU ctx 16384 — fallback `:1234` když neběží), ostatní → LM Studio `:1234`** + injektuje `reasoning_effort:"none"` do POST chat requestů bez parametru): PC `:1235` → `:8071` → reverse tunnel `zion-hiran-tunnel` → Edge `:8002` → `zion-edge-tunnel` → EDGE2 `:8004` → `LLM_BASE_URL`. **LM Studio `:1234` = CPU-ONLY** — `CUDA_VISIBLE_DEVICES=""` v `lm-studio.service` → JIT/UI load libovolného modelu nemůže OOMnout/SIGABRTnout o VRAM; GPU modely = jen standalone pair (use-hiran.sh ↔ use-coder.sh se vzájemně stopnou; `lms-use.sh <id>` = CPU load s ctx bound, heavy modely >15 GB jen po jednom — RAM 30 GB). Continue: všechny chat modely → `:1235`, embed → `:1234`. **Záloha = EDGE2 CPU** (`zion-hiran-inference.service`, `LLM_FALLBACK_URL=http://127.0.0.1:8002/v1`, 2.4 tok/s) — chat nepadne, když PC vypne. Timeouty: primární 90 s, fallback 180 s (jinak visel mrtvý tunel 300 s). Veřejný `app.zionterranova.com/api/ai-chat` = **200** (dřív 503). **Mining vs inference na PC:** nový desktop-agent config key **`gpuDevice`** pinuje mining na RX 5600 XT (`gfx1010`) + `srbminerGpuId="0"` + `threads=5` (Vega 64 od 22.10 odpoledne mimo PC — inference patří GTX 1070 Ti přes standalone llama.cpp :8071; `lm_head` dřív na CPU → 0.25 → 6+ tok/s). **TDR past:** `GGML_VULKAN_DEVICE` se ignoruje (backend štěpí model mezi karty) a příliš vysoké `-ngl` při plné VRAM = `amdgpu ring comp timeout` → `device lost` → core dump.
- **v31-miner drop-in pitfall (opraveno 2026-10-26):** `zion-v31-miner.service.d/99-zz-liveness-tune.conf` obsahoval literal `--wallet  --worker ` (skript expandoval `${ZION_MINER_*}` do souboru s prazdnym env) → 955+ restart crash-loop vedle beziciho `zion-fallback-miner`. Fix: drop-in znovu pouziva `${ZION_MINER_WALLET}`/`${ZION_MINER_WORKER}` za behu (EnvironmentFile). **Pravidlo:** v systemd drop-ins VZDY runtime `${VAR}` — nikdy shell-expandovane hodnoty z deploy skriptu.
- **Dashboard share-rejection alert:** pocita DELTA za ~15 min rolling window (`_share_rejection_rate` v app.py), ne since-restart ratio — prometheus countery se resetuji pri kazdem restartu poolu a stale-job burst jinak haze falesne >15 % alerty.
- **Open items:** edge cleanup ~62 G zdrojových dat (až po observačním období — **NEMAZAT bez potvrzení**) · `PRL_PAYOUT_DRY_RUN=1` (dry-run) · `WARP_API_KEY` unset (pre-existing) · `WARP_BTC_SWAP_ENABLED=0` (safety hold do externího auditu) · EDGE2 G8 evidence + watchdog nyní nasazeny (viz výše) · **SMOS rig 518837 je offline** (Edge `:8003`/`:8322` refused) → produkční inference přesunuta na PC + EDGE2 CPU zálohu; rig obnovit nebo úplně převezmout.

## Rejstřík detailních dokumentů

| Dokument | Obsah |
|---|---|
| [`docs/3.2/ops/AGENTS-CHRONOLOGY.md`](docs/3.2/ops/AGENTS-CHRONOLOGY.md) | Chronologický provozní log **2026-07-08 → 2026-10-21** (původně hlavní část tohoto souboru). Odkazy typu „AGENTS.md 2026-09-14“ vedou sem. |
| [`docs/3.2/ops/AGENTS-LEGACY-SERVER.md`](docs/3.2/ops/AGENTS-LEGACY-SERVER.md) | Superseded reference: V3-era topologie, canonical operational settings v3.0.4, new-server env/port tabulky, Vega 64 tuning (2026-06), memory-pressure incident (2026-07-24). |
| [`REPO-MAP.md`](REPO-MAP.md) | **Mapa workspace** — co je kde (tracked vs untracked, canonical vs runtime), F5 deferral důvody, runtime vazby na FS. |
| [`docs/3.2/StatusV3.md`](docs/3.2/StatusV3.md) | Kanonický live stav + topologie. |
| [`INFRA-SPLIT-PLAN.md`](INFRA-SPLIT-PLAN.md) | Plán i execution log splitu EDGE → EDGE2 (v3 okna, rollback skripty). |
| [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) | V3.3 NIRVANA execution checklist (N0–N7) + fronta autonomních úkolů. |
| [`V31/AGENTS.md`](V31/AGENTS.md) | V31 workspace pravidla (build, cutover, GPU/bench). |
| [`VASTAI-MINING.md`](VASTAI-MINING.md) · [`VastRTX.md`](VastRTX.md) | vast.ai fleet + multi-mining (PRL/QTU/XMR) runbooky, `infra/tools/vast/vastctl.py`. |
| [`PEARL-OPTIMIZATION.md`](PEARL-OPTIMIZATION.md) | Pearl PoUW kernel optimalizace (v13 default na SM80+). |
| [`docs/3.2/AUDIT_PACKAGE.md`](docs/3.2/AUDIT_PACKAGE.md) | Audit package pro externí audit (pinned commit manifest, repro build). |
| [`docs/3.2/REPORTS/`](docs/3.2/REPORTS/) | Incident/audit reporty (G8 stall RCA, edge disk audit, …). |

---

## Scope and working area

- This is a multi-layer monorepo, but **active mainnet-track development is in `V31/`** (V3 has been archived to `archive/V3/` as of 2026-08-04 V31 cutover).
- **ZionDex backend** currently lives in `ZionDex/`; planned V3.1 location is `V31/L2/multichain` (absorbed into the unified **Multi-Chain** crate alongside bridge/warp/atomic-swap/swap-aggregator). See `ZionDex/README.md` (current), [`V3.1_MIGRATION_PLAN.md`](./docs/3.0.6/V3.1_MIGRATION_PLAN.md) and [`MAINNET_ALPHA_L2_UNIFICATION.md`](docs/3.0.8/MAINNET_ALPHA_L2_UNIFICATION.md) for the migration/unification plan. **Status: Live Beta** — Router integrated with WARP API (port 8453), web UI live at `/dex` and `/ziondex` on zionterranova.com. Cross-chain AMM routing implemented (`aggregator.rs`). Multi-path quote API: `GET /quote/multi`. Pending: custom AMM deploy, intent-based execution. ZionDex Router service LIVE on Edge (port 8454, 7 chains). Contract addresses template: [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md).
- Treat legacy root trees (`L1/`, `L2/`, `L3/`, older docs/archive content) as migration/reference material unless a task explicitly targets them.
- For `V31` work, prefer changing only `V31/**` unless the task explicitly requires cross-tree sync. `V3/` is now at `archive/V3/` (read-only reference).
- **V3.1 / V31 status (updated 2026-08-10):** `V31/` workspace (`3.1.0-beta`, protocol `3.1.0-alpha`) is **PRODUCTION** — V31 cutover complete. `cargo test --workspace` passes (2178 tests, 0 failures), `cargo clippy --workspace` clean (pre-existing warnings only). **Phase B+C+S COMPLETE**, **D.2 Cutover COMPLETE**, **D.3 Post-cutover D3.1-D3.4 PASS**. V31 node (`zion-v31-node.service`, P2P 8335, RPC 9445) is production — public RPC 8443 → V31, chain height 1000+. V31 pool (`zion-v31-pool.service`, Stratum 8444, HTTP API 8080) is production — shares accepted, payout confirmation sweep active; **2026-08-10: Edge pool binár rebuildnut a redeploynut s aktuálními `auxpow_bridge`/`auxpow_runtime` fixy, VRSC/ZANO share nyní acceptovány upstream (`fe175794f`). V31 multichain (`zion-v31-multichain.service`, port 8453/8454) — /health 200 OK. V31 DAO (`zion-v31-dao.service`, port 8456) and V31 OASIS (`zion-v31-oasis.service`, port 8094) are active. V31 miner binary (stratum v1 client) mining live. V3 pool/node disabled. Tag `pre-v31-cutover` marks last V3-production commit. `V3/`, `AuXpow/`, `ZionDex/` archived to `archive/`. **L2:** bridge/warp/atomic-swap/ziondex/swap-aggregator unified into **Multi-Chain** crate (`V31/L2/multichain`). See [`PLAN_TO_3.1.md`](./docs/3.1/PLAN_TO_3.1.md), [`V3.1_MIGRATION_PLAN.md`](./docs/3.0.6/V3.1_MIGRATION_PLAN.md) and [`V3.1_INTEGRATION_PLAN.md`](./docs/3.0.6/V3.1_INTEGRATION_PLAN.md).
- Avoid incidental edits in `apps/**` when the task is unrelated to website, desktop, or mobile work.
- If deployment behavior changes, update every source of operational truth together: compose files, Docker docs, runbooks, scripts, and status docs.
- If docs disagree, use this order of truth: `docs/3.2/StatusV3.md` → `ROADMAP.md` / `V31/README.md` / `V31/STATUS.md` → `V31/docs/**` → older `STATUS.md`, root README, and archived docs.
- Root README / older plans may still mention historical multi-server topology. Verify live topology against `StatusV3.md` before making operational claims.
- **Edge IPv6 + fail2ban lockout (2026-08-17):** Edge IPv6 je funkční fallback; při rychlých SSH auditech může `fail2ban` `sshd` jail zabanovat operátorskou IPv4/IPv6, pokud není v `ignoreip`. Aktuální operátorská IP byly přidány do `V31/AGENTS.md` `OPERATOR_IPS`. `zion-v31-multichain` je active; `zion-v31-miner` běží v CPU-only režimu po fixu enumerace GPU — viz aktuální `StatusV3.md`.
- **Watchdog scripts:** the canonical unified script is [`scripts/watchdog.sh`](./scripts/watchdog.sh) with modes `edge` (default), `backup`, and `new-server`. `edge-deploy/watchdog.sh` and `V3/deploy/new-server/zion-watchdog.sh` are thin wrappers that dispatch to it.

## public/ — Open-source public repository (git subtree)

The `public/` directory is a **git subtree** of the public repository `github.com/Zion-TerraNova/v3-Mainnet`, embedded directly in the private repo. Both repos are kept in sync via subtree push/pull — no separate clone needed.

- **Remote name:** `public` → `https://github.com/Zion-TerraNova/v3-Mainnet.git` (public, MIT license)
- **Remote name:** `origin` → `https://github.com/Yose144/Zion-v3.0.0.git` (private)
- **Local path:** `public/` (in repo root, tracked by `origin`)
- **Current status:** **Mainnet Beta** — v3.0.5-beta live, official public launch postponed (TBD)
- **Network status badge:** `![Status: Mainnet Beta](https://img.shields.io/badge/Status-Mainnet_Beta-orange.svg)`

### Subtree commands

```bash
# Pull latest changes from public repo into public/
git subtree pull --prefix=public public/main --squash

# Push local changes in public/ to the public repo
git subtree push --prefix=public public main

# Fetch public remote (update refs without merging)
git fetch public
```

### What's in public/

The public repo contains a **curated subset** of the private repo — only files safe for public release:
- `V3/` — L1 core, L2 contracts, bridge, DAO, atomic-swap, cosmic-harmony, pool, miner, CLI, SDK, docs
- `docs/` — Whitepaper, Ethics & Philosophy, Bodhisattva Vow codex, genesis.md, legal docs (disclaimer, terms, privacy, jurisdiction, token disclosure), security disclosures, multilingual READMEs (EN/CS/ES/FR/PT), stargate assets
- `evoluZionV2.md` — PoW → Proof-of-Care vision
- Root files: `README.md`, `README_FULL.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE` (MIT), `Cargo.toml`, `.gitignore`

### What's NOT in public/ (stays private)

- `apps/` — website, desktop agent, mobile app source
- `ZION_OS/` — dashboard, monitoring, operational scripts
- `ZionStart/` — bootstrap tooling
- `PoC-lab/` — research/proof-of-concept code
- `HiranV2.x/` — AI layer (IP protection)
- `edge-deploy/` — server deploy configs
- `scripts/` — ops scripts (285 files)
- `docs/3.0.4/`, `docs/3.0.5/` — internal docs
- `docs/TerraNova/` — full TerraNova book manuscripts
- `docs/Zohar/` — internal Zohar documentation
- `docs/docs2.9/`, `docs/2.9.7/`, `archive/` — legacy/historical docs
- `docs/3.0.5/3.0.5.md`, `StatusV3.md`, `ROADMAP.md`, `AGENTS.md` — internal status and planning
- Server configs, deploy scripts, environment files
- Private keys, mnemonics, GPG private keys

### Rules for public/ edits

1. **Never push secrets** — no private keys, mnemonics, server IPs (except public RPC `62.171.141.136`), internal hostnames, SSH keys
2. **Sync after private repo changes** — if you change `V3/` code or docs that also exist in `public/`, sync the change to `public/` and push to both remotes
3. **Two-step push** — commit to `origin` (private) first, then `git subtree push --prefix=public public main` to publish
4. **GPG signing** — if `docs/genesis.md` is edited, re-sign with `gpg --detach-sign` using the Yose creator key (`9018F94ACE7C93CF549612E225557B7072678D25`, GNUPGHOME `/tmp/zion_gpg/`)
5. **Release process** — see "GitHub Release process" below

### GitHub Release process

For future releases (e.g. v3.0.4-beta, v3.1.0, etc.):

1. **Build binaries:** `cargo build --release` → binaries in `target/release/`
2. **Create archives:** Package binaries into tar.gz archives per platform (e.g. `zion-all-3.0.4-linux-x86_64.tar.gz`, `zion-cli-macos-aarch64.tar.gz`)
3. **Compute SHA256:** `shasum -a 256 *.tar.gz > SHA256SUMS.txt`
4. **Create release on GitHub:**
   - Via `gh` CLI: `gh release create v3.0.4-beta --title "..." --notes "..." *.tar.gz SHA256SUMS.txt`
   - Or via curl API if `gh` not available (needs PAT token)
5. **Release notes template:** Include features list, download table with SHA256, installation instructions, platform availability
6. **Cross-platform:**
   - **Linux x86_64** — built natively on server
   - **Windows x86_64** — cross-compiled with `x86_64-pc-windows-gnu` target + mingw-w64 linker
   - **macOS aarch64** (Apple Silicon) — built natively on macOS
   - **macOS x86_64** (Intel) — cross-compiled with `x86_64-apple-darwin` target
7. **Binaries to package:** Single `zion` binary (community CLI with wallet + node + mine + pool + status + doctor + monitor). Windows version has node + pool + miner embedded.

### Public Miner & Desktop release build (M1 cross-compile)

There are **two separate public releases** on `github.com/Zion-TerraNova/v3-Mainnet`:

- **Desktop App** — source in `apps/desktop-agent/`, release tag `v3.1.0-desktop`.
  - Packages: `*.dmg` (macOS arm64), `*.AppImage`, `*.deb` (Linux x86_64), `*.exe` + `*.zip` (Windows x64).
  - Build: `npm run build:all` in `apps/desktop-agent/` on an Apple Silicon Mac, or via `.github/workflows/desktop-release.yml`.
  - Bundles `zion-miner`, `zion-universal-miner`, `node`, `zion` inside the Electron app.

- **Terminal Miner** — source in `V31/L1/miner/`, release tag `v3.1.0-cli`.
  - Packages: `zion-miner-<platform>-<arch>.tar.gz` / `.zip`.
  - Build: `cargo build --release -p zion-miner --features <platform-features>` in `V31/`, or via `.github/workflows/miner-release.yml`.

Both must be built with these V31 feature flags for one-click GPU auto-detect and full public branding:

| Platform | Features |
|----------|----------|
| Linux x86_64 | `auxpow,gpu-opencl,gpu-cuda,native-hashers,native-kheavyhash,native-blake3-algo,native-verushash` |
| Windows x86_64 | `auxpow,gpu-opencl,native-hashers,native-kheavyhash,native-blake3-algo,native-verushash` |
| macOS arm64 | `auxpow,gpu-metal,native-hashers,native-kheavyhash,native-blake3-algo,native-verushash` |
| macOS x86_64 | `auxpow,gpu-opencl,native-hashers,native-kheavyhash,native-blake3-algo,native-verushash` |

- `auxpow` enables merged-mining / external stratum pool support.
- `gpu-opencl` adds AMD/Intel OpenCL support.
- `gpu-cuda` adds NVIDIA CUDA support (Linux/Windows, requires NVRTC at runtime).
- `gpu-metal` adds Apple Metal support on Apple Silicon.
- `native-hashers` and the per-algorithm native features (kheavyhash, blake3, verushash) enable CPU-optimized hashing for AuxPoW coins.
- `ZION_DISABLE_OPENMP=1` must be set so packages do not depend on Homebrew `libomp`.

**Linux cross-compile caveat:** V31 `gpu-opencl` builds link against the system OpenCL loader (`libOpenCL.so`) at build time. The resulting binary dynamically loads the target machine's `libOpenCL.so.1` (ocl-icd) at runtime, so the build artifact does not redistribute the loader.

**Notes:**
- Metal is physically unavailable on Linux/Windows — those builds get OpenCL + CUDA.
- CUDA is physically unavailable on macOS — macOS builds get OpenCL (legacy) + Metal.
- `gpu-all` cannot be used for cross-compilation because `gpu-metal` compiles Apple-only code that fails on non-macOS targets.

### Current release: v3.0.5-beta (2026-07-10)

- **Tag:** `v3.0.5-beta` (prerelease)
- **Name:** ZION v3.0.5-beta — Simplified Community CLI
- **Assets:** 4 platform binaries + SHA256SUMS.txt
  - `zion-cli-linux-x86_64.tar.gz` (2.3 MB)
  - `zion-cli-macos-aarch64.tar.gz` (2.1 MB) — Apple Silicon
  - `zion-cli-macos-x86_64.tar.gz` (2.3 MB) — Intel
  - `zion-cli-windows-x86_64.zip` (4.7 MB) — node + pool + miner embedded
- **Key change:** Single `zion` binary with interactive menu (replaces 8 separate binaries)
- **Missing:** ARM64 (Raspberry Pi) — build from source: `cargo build --release -p zion-public`
- **URL:** `https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta`

### Mainnet Beta announcement (2026-07-09)

public/ README files (EN + 4 translations) include a **Network Status** section declaring:
- ZION v3.0.4 is live as **Mainnet Beta**
- Mining is active **at your own risk**
- Network may contain bugs — no warranty
- Genesis block and chain history are **permanent** (will not be reset if network passes security verification)
- Official public launch: **postponed (TBD)**
- LEGAL_DISCLAIMER.md §2.1 covers the Beta status legally

## Existing guidance files to know

- Root guidance baseline: `.github/copilot-instructions.md` (applies repo-wide).
- **How to work with Copilot efficiently (cost + capability map):** [`docs/3.0.3/COPILOT_COLLAB_PLAYBOOK.md`](./docs/3.0.3/COPILOT_COLLAB_PLAYBOOK.md) — Tier S/A/B/D capability map, 7 credit-saving habits, anti-patterns, quick reference card. Read this BEFORE starting a new Copilot session to scope the task correctly.
- **3.0.3 decimal fork — DEPLOYED (2026-06-27) + RPC SCALE FIX (2026-06-28):** [`docs/3.0.3/ZION_3.0.3_DECIMAL_FORK_PLAN.md`](./docs/3.0.3/ZION_3.0.3_DECIMAL_FORK_PLAN.md) — Option E (in-place fork via migration block at H+1, preserves block hashes 0..H). Edge server deployed: MIGRATION_HEIGHT=18850 (updated from 17995 — migration block was never created, all blocks 0-18850 are in legacy 1e12 scale), protocol 3.0.3, flowers_per_zion=1e6, all 13 services active. RPC `scaled_amount()` helper normalizes pre-migration amounts to 1e6 scale for balance queries. Full fix report: [`docs/3.0.3/REPORT_3.0.3_FIXES.md`](./docs/3.0.3/REPORT_3.0.3_FIXES.md). Rollback: DB backup at `edge-state.db.bak-3.0.3-cutover`.
- **3.0.4 DeFi deploy — COMPLETED (2026-06-29):** [`V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md`](./archive/V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md) — DeFi contracts deployed on Base Mainnet: ZIONGovernance `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8`, ZIONTreasury `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` (3-of-3 multisig), ZIONStaking `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` (12% APR, 100K wZION funded), ZIONFarm `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` (1 wZION/s, 500K wZION funded). 5 DAO guardians provisioned. Website v3.6.3 with live DeFi pages. Atomic swap escrow funded 100K ZION. **Basescan verify — 7/7 COMPLETED (2026-07-09):** All 7 contracts verified on Basescan (wZION, ZIONAtomicSwap already verified; Governance, Treasury, Staking, Farm verified 2026-07-02 via Etherscan V2 API; ZIONBridge verified 2026-07-09 via `forge verify-contract` with correct source `bridge/contracts/src/ZIONBridge.sol` OZ 4.9.6 + 5 validators threshold 4/5). See [`BASESCAN_VERIFY_REPORT.md`](./docs/3.0.4/BASESCAN_VERIFY_REPORT.md). **TX unification — COMPLETED (2026-07-01):** account-model `memo` field added (L1 hard fork, height-gated), all 3 L2 watchers (bridge, atomic-swap, DAO) now scan `account_transactions`. See [`3.0.4.md`](./docs/3.0.4/3.0.4.md) §3. **Guardian mnemonics backup — COMPLETED + VERIFIED (2026-07-09):** zkopírováno z flash disku na `/home/zionserver/Desktop/ZionKeys/` (OpenSSL encrypted). **USB backup audit — COMPLETED (2026-07-09):** 4/4 shodné soubory (SHA256 checksumy identické USB↔Desktop), 4/4 GPG podpisy Good (Yose, key `9018F94A...`), 13/13 premine + 5/5 canonical + 1/1 bridge vault adresy cross-checknuty s `genesis.rs` ✓, všechny soukromé soubory `chmod 600`. **DEPLOY-5/6/7 E2E memo testy — COMPLETED (2026-07-09):** 3 account-model TXs s memos (BRIDGE:base:..., DAO:vote:1:yes, SWAP:LOCK:...) odeslány a potvrzeny v bloku 752 na live mainnetu (62.171.141.136). Memo field intact v block data. Watchers korektně filtrují by recipient address (ne jen memo prefix) — správné security chování. E2E SK shredded po testech.
- **3.1.0 pre-development audit:** [`docs/3.0.3/AUDIT_3.1.0_EXISTING_CODE.md`](./docs/3.0.3/AUDIT_3.1.0_EXISTING_CODE.md) — inventory of existing Wallet SDK, Mobile App, TX History RPC, and L4 Oasis code. All 4 components exist but need 3.0.3 fix (1e12→1e6) + completion. Read this BEFORE starting any 3.1.0 work to avoid duplication.
- **Web v2.9 upgrade guide:** [`docs/3.0.3/WEB_V2.9_TO_V3.0.3_UPGRADE.md`](./docs/3.0.3/WEB_V2.9_TO_V3.0.3_UPGRADE.md) — file-by-file guide for website 3.0.3 decimal fork migration.
- Canonical units state-of-the-world: [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md) — three coexisting RPC suffix conventions (`_flowers` ✅, `_atomic` ⚠️, mis-named `_zion` ❌) and recommended contract bump (§3b.5). **CLOSED at 3.0.3 cutover** — `_flowers` is now canonical, `_zion`/`_atomic` are deprecated aliases.
- Current status and launch blockers: [`StatusV3.md`](docs/3.2/StatusV3.md) (canonical, 2026-07-13). Historical archive: [`docs/3.0.5/StatusV3_archive_2026-07-13.md`](./docs/3.0.5/StatusV3_archive_2026-07-13.md) (5239 lines, incident reports).
- Current planning/status references: `ROADMAP.md` (forward roadmap), `V3/README.md`, `V3/ROADMAP.md` (engineering detail), and `V3/docs/**`.
- Hiran **v2.2** local inference setup (GGUF ready, llama-server.exe ready): [`HIRAN_LOCAL_SETUP.md`](./docs/HIRAN_LOCAL_SETUP.md) — canonical guide for running inference locally. Use this, not v2.1 docs, for current runtime.
- Hiranyagarbha / Hiran **v2.1** roadmap (historical): [`HiranV2.1/Hiran_v2.1.md`](./archive/HiranV2.1/Hiran_v2.1.md); upgrade context: [`HIRANYAGARBHA_UPGRADE_PLAN.md`](./archive/HiranV2.1/HIRANYAGARBHA_UPGRADE_PLAN.md).
- Historical archive exists at `docs/2.9.9/archive/WARP.md`; treat it as legacy context, not current source of truth for V3 runtime behavior.
- Genesis Regeneration Runbook: [`GENESIS_REGENERATION_RUNBOOK.md`](./docs/GENESIS_REGENERATION_RUNBOOK.md) — complete guide for genesis key rotation and recovery procedures.
- **3.0.4 Hard Genesis Reset — CANONICAL RUNBOOK (2026-07-06):** [`docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`](./docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md) — **THE** single source of truth for the complete hard reset. Covers all 10 phases: pre-flight, key generation, genesis.rs update, L2/L3 config, EVM revocation, new server, L1 wipe, verification, documentation, generational transfer. Replaces all prior runbooks (docs/3.0.4/HARDRESETOFFICIAL.md, GENESIS_REGENERATION_RUNBOOK.md, docs/3.0.1Genesis/*) as the canonical procedure. New genesis hash: `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`. All 14 premine + 5 canonical + bridge vault addresses regenerated.
- **Security Disclosure — ZION-2026-001 through ZION-2026-005 (2026-07-06):** [`docs/security/SECURITY_DISCLOSURE_2026-07.md`](./docs/security/SECURITY_DISCLOSURE_2026-07.md) — Public vulnerability disclosure in Ethereum Foundation format. 5 vulnerabilities catalogued (F1 forged P2P signatures, F5 unlimited inflation, C1-C8 server exposure, TeamViewer compromise, EVM key compromise). Disclosure policy, timeline, remediation status, what source code will be published. Machine-readable [`docs/security/vulnerabilities.json`](./docs/security/vulnerabilities.json). See also: [`HARDRESETOFFICIAL.md`](./docs/3.0.4/HARDRESETOFFICIAL.md) (operational hard reset plan, status: EXECUTING).
- **Security hardening — F1 + F5 EXPLOIT + PHASE 2 COMPLETE + L2 PATCH DEPLOYED + F5 FUZZED (2026-07-02):** [`SecurityFirst.md`](./docs/3.0.4/SecurityFirst.md) · [`F5_SECURITY_INCIDENT_REPORT_2026-07-02.md`](./docs/3.0.4/F5_SECURITY_INCIDENT_REPORT_2026-07-02.md) · [`PATCH_L2_SECURITY_2026-07-02.md`](./docs/3.0.4/PATCH_L2_SECURITY_2026-07-02.md) — F1 exploit post-mortem (forged account TX via P2P from 109.81.30.165, rollback to 22180), comprehensive Edge server hardening: UFW (jen SSH/HTTP/HTTPS/Tailscale), private keys scrubbed z 5 souborů, file permissions 600, SSH klíče-only, **ALL služeb na 127.0.0.1** (historický cíl; od 3.0.5/3.0.6 úmyslně některé služby bindují `0.0.0.0`: stratum pool `62.171.141.136:8444`, bridge/DAO/atomic-swap/WARP API, dashboard `0.0.0.0:8888`; vnitřní RPC zůstává na `127.0.0.1`), AppArmor pro zion-node, 3 monitoring cron jobs, RPC audit log (v node binárce), Tailscale ACL doc (pending admin console apply). **L2 security patch DEPLOYED:** Commit `b2f0ca40` — claimant guard, threshold 5/5, reorg safety, key hygiene, checked cast, composite dedup, escrow key zeroing, memo cap. MD5 shoda ověřena. **F1 fix deployed:** `validate_peer_block` nyní volá `verify_signature()` pro non-coinbase account TX (commit `056b67a4`). **F5 CRITICAL fix deployed:** Account-model sender balance validation — `insert_transaction()` a `validate_peer_block()` nyní rejectují TX kde `sender_balance < amount + fee`. Height-gated via `ZION_BALANCE_CHECK_HEIGHT=22394` na Edge mainnet (obě nody). **F5 fuzz tests:** 5 testů (commit `33e9a8aa`) — 100 random senders, double-spend, u64::MAX, rapid-fire, self-send, vše PASS. **Node binary swap:** Nejnovější binárka s fmt/clippy cleanup deploynuta (22:55 UTC), F5 aktivní, height 22539. Commits `7019d88`, `9a438a0`, `66d3c8c`, `5a117b70`, `f5efa6e3`, `33e9a8aa`. **Escrow key rotation:** Nový escrow keypair, inflační 100,002 ZION spáleno na unspendable burn address. **Pending:** ~~Tailscale ACL~~ (Tailscale removed), ~~systemd User=zion~~ ⚠️ 10/12 done (dashboard + dex still User=root, need file relocation from /root/), ~~key rotation F4.x~~ ✅ DONE (owner air-gapped), ~~BFG git history scrub~~ ✅ DONE. **WARNING:** Label-derived canonical addresses have PUBLIC keys — nepoužívat pro treasury wallets!
- **Security patch 3.0.4 wave 1-2 + F4.7 aktivace (2026-07-07):** [`SECURITY_PATCH_3.0.4_PLAN.md`](./docs/3.0.4/SECURITY_PATCH_3.0.4_PLAN.md) (kanonický postup, fáze 1-6) · [`SECURITY_TODO_2026-07-03.md`](./docs/3.0.4/SECURITY_TODO_2026-07-03.md) §Audit Delta. **Wave 1 (dependency + code hardening):** quinn-proto ≥0.11.15 (RUSTSEC-2026-0185 remote DoS), crossbeam-epoch ≥0.9.20, anyhow, rand, indicatif/ratatui/lru/metal advisory cleanup; node mainnet guard proti `ZION_SEED_PEERS=none|empty`; pool OASIS hook bez externího `curl` (interní HTTP + localhost-only guard + timeouty); bridge SQL whitelist v `count_by_status`; HTTP timeouty na dao_clientech; miner bez přímé `bincode` závislosti; audit wrapper `V3/scripts/security-audit.sh`. **Wave 2 (F4.7 max-tx-amount cap):** height-gated cap = `emission::TOTAL_SUPPLY` (144B ZION, NE 100M — nekoliduje s premine), výjimky genesis/coinbase, obě validační cesty (`insert_transaction` + `validate_peer_block`), 4 testy PASS. **AKTIVOVÁNO na serveru 62.171.141.136 (2026-07-07 23:16):** `ZION_MAX_TX_AMOUNT_HEIGHT=1` (bare EnvironmentFile formát), log `max_tx_amount_activation_height=1`, genesis hash `4f75a0df...` nezměněn, 7/7 služeb active. F5 (`ZION_BALANCE_CHECK_HEIGHT=0`) aktivní současně. Commity `bed8ed2c`, `15d40e47`. **Canonicalizace topologie:** hardcoded seed peers (`lib.rs`, `discovery.rs`) + CLI topology defaults přesunuty ze starého Edge (77.42.71.94, decommissioned) na nový server (62.171.141.136), Tailscale odstraněn.
- **LI.FI cross-chain DEX + bridge integration (2026-06-30):** [`docs/3.0.3/Li.Fi-L2.md`](./docs/3.0.3/Li.Fi-L2.md) — LI.FI WidgetLight integrated into `/defi` page (aggregates 30+ DEX + 20+ bridges across 25+ chains). Phase 1 complete (WidgetLight postMessage, slippage fix, 0.5% fee, 7 EVM chains, custom RPC). Phase 1.5: Ankr API key activated (free tier). **Phase 2: 6 chains live** — wZION deployed on Base (8453), BSC (56), Polygon (137), Arbitrum (42161), Optimism (10), Avalanche (43114) with same address `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` (deterministic deploy). ZIONBridge on BSC/Polygon/Arbitrum/Optimism/Avalanche: `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721`. Bridge relay running on Edge with 6 EVM watchers. Website live on zionterranova.com with 6-chain LiFi widget. **Phase 3: WARP D-04 COMPLETE** — WARP přenáší **native L1 ZION**. Token naming: EVM chains → **wZION** (ERC-20 wrapped, jako WBTC), non-EVM chains → **ZION** (nativní reprezentace). Outbound: user pošle ZION na `BRIDGE_VAULT_ADDRESS` s memo `BRIDGE:<chain>:<recipient>` → WARP mintne ZION/wZION na dest chain (1:1 peg). Inbound: user spálí ZION/wZION → WARP odemkne ZION z vault. L1 RPC: `getBridgeLocks` + `submitBridgeUnlock` (3/5 validator quorum). **12 chain adapters registered** (11 fully functional + TON watch-only) with pure-Rust serializers: BCS (`bcs.rs`) for Aptos+Sui, CBOR (`cbor.rs`) for Cardano, TL-B Cell+BOC (`ton_cell.rs`) for TON. **499 WARP tests pass**. WARP (`V3/L3/warp/`) covers all 12 chain families. **Non-EVM contracts created (2026-07-12):** 9 ZION token contract source files in `V3/L2/bridge/contracts/non-evm/` (Solana, Tron, Stellar, Cardano, Cosmos, Aptos, Sui, NEAR, TON) — all implement bridgeMint/bridgeBurn with 5/5 quorum. Pending: deploy to mainnet + relay keys. See [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) for address template.
- **WARP Lightning Network bridge (2026-06-30):** [`docs/WARP_LIGHTNING_PLAN.md`](./docs/WARP_LIGHTNING_PLAN.md) — Native ZION L1 ↔ BTC Lightning bridge via BOLT11 invoices. BOLT11 parser + LND REST client + adapter implemented (`bolt11.rs`, `lightning_signer.rs`, `adapter/lightning.rs`). **Fáze A COMPLETE (2026-07-12):** Docker setup created at `V3/L3/warp/docker/lightning/` (bitcoind testnet + LND v0.18.2 + Redis), channel management scripts at `V3/L3/warp/scripts/lightning/`, systemd service `edge-deploy/systemd/zion-edge-lnd.service`. `lightning.rs` updated with Docker-aware errors + enhanced health_check (LND connectivity, channel balance, on-chain balance). Pending: deploy to Edge (`docker compose up`), sync testnet, open channels, extract macaroon.
- **ZionDex L3 WARP Integration + Non-EVM Contracts + Cross-Chain AMM Routing (2026-07-12):** [`docs/3.0.5/archive-root-md/ZionDex.md`](./docs/3.0.5/archive-root-md/ZionDex.md) + [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) — ZionDex Router integrated with L3 WARP API (port 8453). `executor.rs` uses POST /transfers/outbound + /transfers/inbound + polling. `aggregator.rs` (~740 lines) — LiquidityAggregator with Dijkstra path finding, returns top 3 optimal cross-chain paths, 30s price cache. `quote.rs` — MultiPathQuote. `api.rs` — GET /quote/multi. 28/28 Rust tests. Web UI live at `/dex` and `/ziondex` on zionterranova.com. **Non-EVM ZION token contracts created** for 9 chains (Solana SPL, Tron TRC-20, Stellar asset, Cardano Plutus, Cosmos CW20, Aptos Move, Sui Move, NEAR NEP-141, TON jetton) in `V3/L2/bridge/contracts/non-evm/` — all implement bridgeMint/bridgeBurn with 5/5 quorum. Pending: deploy contracts to mainnet, ZionDex Router service on Edge (port 8454), relay keys. Contract address template: [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) — vyplň adresy po deploy.
- **Vision documents (2026-06-30):** [`docs/3.0.3/nativeZion.md`](./docs/3.0.3/nativeZion.md) (WARP token naming: wZION EVM, ZION non-EVM) + [`docs/3.0.3/ZionDex.md`](./docs/3.0.3/ZionDex.md) (cross-chain DEX concept powered by WARP — path to Top 100) + [`docs/3.0.3/evoluZion.md`](./docs/3.0.3/evoluZion.md) (ZION as Tree of Life — evolution from PoW to Proof-of-Care / Protokol Péče, NPU-based caring computation, with full source references to TerraNova book + NPU_HARDWARE_MINING_THEORY.md + cosmic-harmony NPU Mix code).
- **Zohar — kabalistický Strom života ZIONu (2026-07-03):** [`docs/Zohar/README.md`](./docs/Zohar/README.md) · [`docs/Zohar/01-SEFIROT-VRSTVY.md`](./docs/Zohar/01-SEFIROT-VRSTVY.md) · [`docs/Zohar/02-ROADMAP.md`](./docs/Zohar/02-ROADMAP.md) · [`docs/Zohar/03-O-KNIZE-ZOHAR.md`](./docs/Zohar/03-O-KNIZE-ZOHAR.md) — Mapování 10 sefirot + Da'at na ZION vrstvy L1-L6 (Keter=L1 Consensus, Chokmah=L1 PoW, Binah=L1 Validation, Chesed=L2 Multichain, Gevurah=L2 DAO, Tiferet=L3 WARP, Netzach=L3 AI/Hiran, Hod=L4 Oasis, Yesod=L5 Komunity, Malkhut=L6 Issobella). Tři pilíře: Milosrdenství (dávání) / Přísnost (disciplína) / Rovnováha (manifestace). Syntéza evoluZion.md (Strom života metafora) + TerraNova kniha (filosofie péče) v jazyce kabaly. **Fáze 0 (manifest) + Fáze 1 (web /app/zohar) + Fáze 2 (sefirot vow — [`V3/L5/docs/GOVERNANCE/sefirot-vow.md`](./archive/V3/L5/docs/GOVERNANCE/sefirot-vow.md), 11 slibů pro validátory) + Fáze 4 (getTreeHealth API — [`/api/zohar/tree-health`](./apps/website-v2.9/src/app/api/tree-of-life/tree-health/route.ts), živá data z blockchain/DeFi/bridge/NCL API mapovaná na 10 sefirot health score) hotové.** Fáze 2 on-chain: `SefirotVowToken` (soulbound ERC-721, [`V3/L2/contracts/hardhat/sol/SefirotVowToken.sol`](./archive/V3/L2/contracts/hardhat/sol/SefirotVowToken.sol), 19 tests pass) + `SefirotVowRegistry` (proposal lifecycle, [`V3/L2/contracts/hardhat/sol/SefirotVowRegistry.sol`](./archive/V3/L2/contracts/hardhat/sol/SefirotVowRegistry.sol), 10 tests pass) — kompilováno, deploy na Base mainnet pending (vyžaduje owner approval + gas). Fáze 3 (care task kategorie pro Protokol Péče) horizont — závisí na L1 consensus (2028+). Čistá dokumentační/web/governance/L2-contract vrstva — netýká se L1 consensus kódu.
- **Public web quartet (2026-08-01):** Čtyři nezávislé veřejné služby běží současně:
  - **Intro:** `https://zionterranova.com` — [`apps/website-v2.9/public/maintenance.html`](./apps/website-v2.9/public/maintenance.html), nasazený v `/var/www/maintenance/maintenance.html`, servírovaný systémovým nginxem. Stargate portál do OASIS.
  - **Web2.9:** `https://app.zionterranova.com` — plný Next.js 16.2.9 web (`website-v2.9`), systemd `zion-website.service` na `127.0.0.1:3000`, proxy přes nginx. Deploy: [`apps/website-v2.9/deploy/deploy-web2.9.sh`](./apps/website-v2.9/deploy/deploy-web2.9.sh) (lokální build → rsync → `systemctl restart zion-website.service`).
  - **OASIS Web:** `https://oasis.zionterranova.com` — separátní vizuální OASIS prezentace (`apps/OasisWeb`), build nasazený v `/var/www/oasis/`. Deploy: [`apps/OasisWeb/deploy/deploy-oasis-web.sh`](./apps/OasisWeb/deploy/deploy-oasis-web.sh) (Next.js export → rsync → `nginx -s reload`).
  - **MarketPlace:** `https://market.zionterranova.com` — OASIS Artifact Marketplace (`apps/MarketPlace/`), Next.js 14 + ERC-1155 + Base L2. systemd `zion-marketplace.service` na `127.0.0.1:3100`, proxy přes nginx. Deploy: rsync → `npm install && npm run build` → `systemctl restart zion-marketplace.service`.
- **Website design system unification (2026-07-03):** `apps/website-v2.9/src/app/globals.css` definuje unified design třídy: `.zion-container` (max-w-80rem wrapper), `.zion-section` (rounded panel s border + blur), `.zion-tile` (soft inner grid item s hover), `.zion-cta-banner` (gradient CTA sekce), `.zion-rainbow-card` / `.zion-rainbow-sub` (hero/feature cards s per-color `--rc` CSS variable). Audit 73 page.tsx souborů hotový. Refaktorované: `/ai-native`, `/roadmap-295`, `/admin/revenue-v3` (ad-hoc `bg-black/60 backdrop-blur-xl` → `zion-section`/`zion-tile`), `/account` (přidány CZ/EN překlady), `/login` (grid-cols-3 → responsive). Referenční implementace: `/admin/page.tsx`.
- **PoC-lab Fáze 3 — Hiran HTTP integrace, MockHiranServer, live llama-server (2026-07-08):** [`PoC-lab/`](./archive/PoC-lab/) — standalone Rust workspace (mimo `V3/`) implementující Proof-of-Care prototyp. **Fáze 1 (commit `2936fcb1`)** — kompletní základ: INT8 NPU VM (`poc-npu`), multi-backend cross-validace (`poc-verifier`), validator registry + Sefirot Vow lifecycle (`poc-registry`), reward split + slashing (`poc-economics`), E2E síťový simulátor s guardian/Bodhisattva Vow demo (`poc-sim`). **Fáze 2 (commit `9c12f362`)** — 119 testů PASS: `DharmaValidator` (5-pilířový pipeline) + `HiranAwareVerifier` + `NclReputationRegistry` + `ConsciousnessLevel` enum + multi-epoch stress testy + CLI. **Fáze 3 (commit `89115185` + nový commit)** — 145 testů PASS: `poc-hiran` nový crate (`HiranClient` trait, `LiveHiranClient` via `ureq` + `/v1/chat/completions`, `StubHiranClient`, `build_client()` factory, `MockHiranServer` via `tiny_http` na náhodném portu); `HiranNpuBackend` v `poc-npu` nyní volá živý HTTP endpoint; `poc-sim` výstup zobrazuje `hiran[live]` vs `hiran[stub]`; integrační testy `poc-sim/tests/integration_mock_hiran.rs` (6 testů — MockServer spawn/shutdown, 3 validátoři, multi-epoch, guardian bonus). **Live Hiran:** llama-server v2.2 Q4_K_M spuštěn lokálně na portu 8002 (`~5 tok/s` CPU), `poc-sim --hiran-url http://127.0.0.1:8002` ověřeno. Spec: [`docs/3.0.4/POC_HIRAN_INTEGRATION_SPEC.md`](./docs/3.0.4/POC_HIRAN_INTEGRATION_SPEC.md). Konceptuální základ: [`docs/3.0.4/PoC_CONCEPT.md`](./docs/3.0.4/PoC_CONCEPT.md). **Netýká se L1 consensus — čistě výzkumný prototyp.**

## Copilot agent quick-start (per-session checklist)

When a new Copilot/Kimi/Devin session opens against this repo:

1. **Read [`docs/3.0.3/COPILOT_COLLAB_PLAYBOOK.md`](./docs/3.0.3/COPILOT_COLLAB_PLAYBOOK.md) §3 (Capability Map)** to know what kind of task you're being asked for and what tier it belongs to.
2. **Scope the task to one folder** (e.g. `V3/L1/pool/`, `apps/website-v2.9/`). Do not start with a workspace-wide `semantic_search` unless the task is genuinely cross-cutting.
3. **Check `/memories/repo/` first** — canonical ports, build commands, edge services facts are seeded there to avoid re-grepping AGENTS.md every session.
4. **Use the `Explore` subagent** for read-heavy investigation (≥ 5 files to open). Main thread stays focused; you get back one summary.
5. **Never edit L1 consensus code** (`V3/L1/core/src/consensus.rs`, `genesis.rs`, `emission.rs`, `fee.rs`, `crypto.rs`, `cosmic-harmony/**`) without explicit human approval — see L1 Protocol section below.
6. **Long builds and tail logs are owner's job.** You propose code → owner runs `cargo` → owner pastes only the failing tail back.
7. **End the session when the task is done.** Don't keep exploring "for completeness" — every extra tool call is credits.

## Agent operating rules

- Start by checking branch/worktree state, then read the smallest relevant status docs before editing.
- Default to minimal, focused changes. Do not refactor or normalize old folders unless explicitly asked.
- Never run destructive operations without explicit user approval: history rewrites (`git filter-repo`, BFG), force pushes to shared branches, deleting datadirs, or production deploys.
- **History rewrite 2026-10-21 (approved by operator):** committed build/backup artifacts were purged from all history (`V3/target2/3/4`, `V3/target-check`, `V3/target-vega-fix`, `scripts/finetune/outputs`, `ZION_OS/dashboard/infra/target`, `BACKUP/`). Consequence: every commit ID after those points changed, and `main` was force-pushed to `origin` + re-split to the `public` mirror. Any SHA quoted in older docs/notes must be re-resolved against current `main` (full old→new mapping table: [`docs/3.2/ops/SHA-REMAP-2026-10-21.json`](docs/3.2/ops/SHA-REMAP-2026-10-21.json), 711 commits; the audit manifest was re-pinned to `663c10be2`).

## L1 / Consensus Security Protocol (CRITICAL)

> **L1 = Layer 1 = core blockchain logic. Any change here can break mainnet consensus.**

### What is L1 (protected)

The following paths and concepts are **L1 consensus-critical** and require **explicit human approval** before any modification:

| Category | Paths | Why Protected |
|----------|-------|---------------|
| **Consensus engine** | `V3/L1/core/src/consensus.rs`, `lib.rs` block validation, `peer_block_validation.rs` | Fork rules, block acceptance, reorg handling |
| **Genesis block** | `V3/L1/core/src/genesis.rs`, `GENESIS_MESSAGE.txt` | Premine outputs, genesis hash, immutable timestamp |
| **Emission schedule** | `V3/L1/core/src/emission.rs` | Fee split (89/5/5/1), block rewards, decay schedule |
| **Transaction model** | `V3/L1/core/src/tx.rs`, fee.rs | UTXO validation, fee burn model, tx format |
| **Cryptographic primitives** | `V3/L1/core/src/crypto.rs` | Address derivation, canonical wallet labels, hash functions |
| **P2P protocol** | `V3/L1/core/src/p2p.rs`, `peer.rs` | Wire format, handshake, propagation rules |
| **Mining / PoW** | `V3/L1/cosmic-harmony/src/` (all algorithms) | Hash functions, scratchpad sizes, algorithm parameters |
| **Canonical addresses** | `MAINNET_CANONICAL_*` constants anywhere | Humanitarian, Issobella, pool-fee, default-miner wallets |
| **Bridge vault seed** | `V3/L1/core/src/crypto.rs:BRIDGE_VAULT_SEED` | Must stay `"ZION Bridge Vault V3 Mainnet"` — live mainnet vault with ~100M ZION |

### Agent rules for L1

1. **NO automated edits to L1 code.** If a task touches any file under `V3/L1/core/src/` or `V3/L1/cosmic-harmony/src/`, **STOP and ask the user for explicit written approval** before making any change.
2. **NO genesis.rs edits without runbook.** Changes to `genesis.rs` require following `GENESIS_REGENERATION_RUNBOOK.md` and key regeneration on an air-gapped machine.
3. **NO emission/fee split changes.** `emission.rs` (89/5/5/1) is constitutional — never change percentages, constants, or `DAO_TREASURY_LOCK_HEIGHT` without a governance proposal.
4. **NO canonical address rotation without backup verification.** If wallet addresses change, confirm the mnemonic backup exists on the flash drive (`F:\ZION_V3_MAINNET_WALLETS.txt`) before proceeding.
5. **L2/L3 are safer but still sensitive.** Bridge contracts, DAO config, WARP config may be edited for operational fixes, but always verify against `V3/docs/**` and `StatusV3.md`.
6. **Always test consensus changes with `cargo test -p zion-core` before any commit.** If tests fail, stop immediately.

### Quick check before editing

If your task involves any of these, **ask the user first**:
- Modifying `genesis.rs`, `emission.rs`, `fee.rs`, `crypto.rs`
- Changing `DAO_TREASURY_LOCK_HEIGHT` or `GENESIS_TIMESTAMP`
- Updating `MAINNET_CANONICAL_*` wallet addresses
- Touching `cosmic-harmony` algorithm constants (scratchpad size, AES rounds, thermal loop)
- Editing `peer_block_validation.rs` or consensus validation rules
- Changing block time target, total supply, or coinbase maturity

**When in doubt: ask. L1 changes are irreversible on mainnet.**
- Do not open, copy, print, or reintroduce leaked private keys or credential values. Refer to documented secret-bearing paths by filename only, and recommend rotation/scrub.
- Keep launch/security blockers visible: credential rotation, history scrub, clean Genesis #0 rollout, bridge 3/5 validator provisioning, CI billing, external audit, and bug bounty.
- Prefer `V3/cli` and documented runbooks over ad-hoc scripts for operations.
- For Hiran v2.2 work, keep `V3/` + `StatusV3.md` as the technical canon; use external corpora through licensed, cited RAG snapshots rather than dumping copyrighted material into SFT weights.
- Hiran v2.2 GGUF files live at `HiranV2.2/models/hiran-v2.2-merged/` — do NOT regenerate unless explicitly asked; conversion took ~10 min.
- The canonical inference start script is `scripts/start-hiran-inference.ps1` — it auto-detects backend priority (llama-server.exe > LM Studio > Ollama > serve.py).

## Common commands

Run from repository root unless noted.

### V31 Rust workspace (main path — aktivní mainnet track)

> V31 je jediný aktivní mainnet track (`V31/`, workspace `3.1.0-beta`, protokol `3.1.0-alpha`).
> `V3/` je od 2026-08-04 archivovaný read-only strom — buildy/testy z něj **nepoužívej**
> (pouze pro historickou kompatibilitu `v3_compat`).

- Build/check workspace:
  - `cargo check --manifest-path V31/Cargo.toml --workspace`
- Run tests (CI-style):
  - `cargo test --manifest-path V31/Cargo.toml --workspace -- --test-threads=1`
- Run one crate's tests:
  - `cargo test --manifest-path V31/Cargo.toml -p zion-core`
- Run a single test function:
  - `cargo test --manifest-path V31/Cargo.toml -p zion-core <test_name> -- --exact`
- Lint:
  - `cargo clippy --manifest-path V31/Cargo.toml --workspace --all-targets`
- Format check:
  - `cargo fmt --manifest-path V31/Cargo.toml --all --check`
- Security audit:
  - `cargo audit --file V31/Cargo.lock`
- Pre-commit checks:
  - `pre-commit validate-config`
  - `pre-commit run --all-files`
- Produkční build na serveru (viz `V31/AGENTS.md`):
  - `cargo build -p zion-core -p zion-pool -p zion-miner -p zion-dao -p zion-multichain --release`
- **GPU miner build (per platform):**
  - `cargo build --release -p zion-miner --features gpu-opencl` (Linux/Windows AMD+Intel)
  - `cargo build --release -p zion-miner --features gpu-cuda` (NVIDIA)
  - `cargo build --release -p zion-miner --features gpu-metal` (Apple Silicon)
  - Plný trinity build: `--features gpu-opencl,native-verushash,native-randomx,native-hashers`

### V3 Rust workspace (archivované — read-only)

- Build/check workspace:
  - `cargo check --manifest-path V3/Cargo.toml --workspace`
- Run tests (CI-style):
  - `cargo test --manifest-path V3/Cargo.toml --workspace -- --test-threads=1`
- Run one crate's tests:
  - `cargo test --manifest-path V3/Cargo.toml -p zion-core`
- Run a single test function:
  - `cargo test --manifest-path V3/Cargo.toml -p zion-core <test_name> -- --exact`
- Run one integration test target:
  - `cargo test --manifest-path V3/Cargo.toml -p zion-pool --test chv4_e2e`
- Lint:
  - `cargo clippy --manifest-path V3/Cargo.toml --workspace --all-targets`
- Format check:
  - `cargo fmt --manifest-path V3/Cargo.toml --all --check`
- Security audit:
  - `cargo audit --file V3/Cargo.lock`
- Pre-commit checks:
  - `pre-commit validate-config`
  - `pre-commit run --all-files`

### Running core binaries from source (V3 — archivované)

- Node:
  - `ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8333 ZION_RPC_BIND=0.0.0.0:9443 cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node`
- Pool server:
  - `ZION_POOL_BIND=0.0.0.0:8444 ZION_NODE_RPC_ADDR=127.0.0.1:9443 cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server`
  - **Dual-algo:** The pool no longer enforces a single global algorithm. Each miner session advertises its algorithm in the `Hello` message, and the pool validates shares using the session's algorithm. Set `ZION_NONCE_COUNT_GPU=262144` for GPU miners (OpenCL/CUDA/Metal) while keeping `ZION_NONCE_COUNT=4096` for CPU miners.
- Miner:
  - `ZION_POOL_ADDR=127.0.0.1:8444 ZION_WORKER_NAME=<name> ZION_MINER_ID=<id> cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`
  - **Algorithm:** Set `ZION_MINER_ALGORITHM=deeksha_lite_v1` (default), `cosmic_harmony_ekam_deeksha_v2`, or `deeksha_lite_fire` (thermal-intensive), or pass `--algorithm <algo>` on the CLI. The miner advertises this to the pool in its `Hello` message.
  - **Important:** For sustained GPU mining, also set `ZION_LOOP_COUNT=1000000` on the miner and `ZION_POOL_LOOP_COUNT=1000000` on the pool. The pool default was historically `1`, which caused a `Bye` after every iteration and forced expensive reconnects/GPU self-tests, collapsing effective hashrate from ~3 KH/s to ~30 H/s.
  - **GPU batch size:** The pool default `ZION_NONCE_COUNT=4096` sends batches to CPU miners. For GPU miners, the pool uses `ZION_NONCE_COUNT_GPU` (default 262144). Benchmark `--ekam-bench` uses `work_size` directly and therefore reports higher hashrate than live stratum mining with the default nonce window.
  - **⚠️ nonce_count fix (2026-07-16):** The miner's default `ZION_NONCE_COUNT` was 1024 — far too small for GPU mining. With `work_size=8192`, the double-buffered async readback (the +50% optimization for 28-30 KH/s) only activates when `nonce_count > work_size`. With 1024, double-buffering was never activated, resulting in ~10 KH/s. **Fix:** nonce_count default is now `4 × gpu_work_size` (32768 for RX 5700 XT) when GPU is available. `nonce_count_min` is also `max(work_size, 10000)`. See [`docs/3.0.6/30khsDeeksha.md`](./docs/3.0.6/30khsDeeksha.md).
  - **⚠️ batch processing fix (2026-07-16):** Two issues caused 6-12 KH/s in live mining despite the nonce_count fix: (1) `mine_batch` broke early when a solution was found (first chunk only = 8192 nonces instead of full batch), and (2) processing the full 262144-nonce batch took 11-15s, causing stale shares (42% reject). **Fix:** removed early break in double-buffer + single-buffer paths (GPU now processes ALL chunks); added `ZION_GPU_MAX_BATCH=32768` cap in `gpu_scan_job()` to keep batches under ~2s. **Result: 17-20 KH/s sustained, 31.6 KH/s peak, 100% accept rate.** See [`docs/3.0.6/30khsDeeksha.md`](./docs/3.0.6/30khsDeeksha.md) §"Critical fix #2".
  - **All 22 coins GPU-mineable (2026-07-16):** Final 3 OpenCL kernels implemented: Qhash/QTC (quantum circuit sim), GhostRider/RTM (15 hash algos + 6 CN variants), DynexSolve/DNX (neuromorphic SAT solver). `gpu_kernel_available("opencl")` returns true for all 22 ExternalCoin variants. Commit `46899f856`.
- Unified operator CLI:
  - `cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help`

### Running core binaries from source (V31 — aktivní)

- Node (lokální dev, peeruje na EDGE2 primary `207.180.217.100:8335`):
  - `ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8335 ZION_RPC_BIND=0.0.0.0:9445 ZION_SEED_PEERS=207.180.217.100:8335 cargo run --release --manifest-path V31/Cargo.toml -p zion-core --bin node`
- Pool server (lokální dev):
  - `ZION_POOL_BIND=0.0.0.0:8444 ZION_NODE_RPC_ADDR=127.0.0.1:9445 cargo run --release --manifest-path V31/Cargo.toml -p zion-pool --bin zion-pool`
- Miner (triple-stream ZION + GPU AuxPoW + CPU AuxPoW):
  - `ZION_POOL_ADDR=pool.zionterranova.com:8444 ZION_WORKER_NAME=<name> ZION_MINER_ID=<id> ZION_V3_TRINITY=1 cargo run --release --manifest-path V31/Cargo.toml -p zion-miner -- --gpu cuda --threads 10`
  - **CUDA DAG disk cache** (default ON): první běh vygeneruje a uloží ProgPoW/Ethash/KawPow DAG do `~/.zion/dag-cache/{algo}_epoch{N}.bin` (~2 GB, ~2.7 s); další starty čtou z disku. Vypnutí: `ZION_DAG_CACHE_DISABLE=1`, vlastní cesta: `ZION_DAG_CACHE_DIR=/path`.
  - **Pearl PoUW** (SM80+): default `pearl_mine_v13` (packed-k), fallback `ZION_PEARL_MINE=v6`. SM75 (RTX 20xx) → fallback kernel. Viz `PEARL-OPTIMIZATION.md` + `VASTAI-MINING.md` §4b.
- Unified operator CLI:
  - `cargo run --manifest-path V31/Cargo.toml -p zion-cli -- --help`

### Running core binaries from source (Windows 11)

PowerShell equivalents for W11 development. Build first: `cargo build --release --manifest-path V3/Cargo.toml --workspace`.

- Node (new server seed — local dev only, connects to new server):
  - `$env:ZION_NODE_ID='local-dev-node'; $env:ZION_P2P_BIND='0.0.0.0:8333'; $env:ZION_RPC_BIND='0.0.0.0:9443'; $env:ZION_SEED_PEERS='62.171.141.136:8333'; $env:ZION_NODE_STATE_PATH='V3/data/zion-node-state.db'; $env:ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'; $env:ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'; $env:ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'; $env:ZION_MIGRATION_HEIGHT='1'; cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node`
  - **Note:** `ZION_MIGRATION_HEIGHT=1` is required for fresh chain (genesis reset). Set to actual migration height if syncing existing chain.
- Pool server (local-dev only):
  - `$env:ZION_POOL_BIND='0.0.0.0:8444'; $env:ZION_NODE_RPC_ADDR='127.0.0.1:9443'; $env:ZION_POOL_LOOP_COUNT='1000000'; $env:ZION_NONCE_COUNT='4096'; $env:ZION_NONCE_COUNT_GPU='262144'; $env:ZION_POOL_WALLET='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'; cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server`
  - **IMPORTANT:** Pool and miner binaries must be compiled from the same source version — protocol is not backward compatible. Always recompile pool after `cargo build` on miner.
- Miner (connects to new server pool):
  - `$env:ZION_POOL_ADDR='62.171.141.136:8444'; $env:ZION_WORKER_NAME='<name>'; $env:ZION_MINER_ID='<id>'; $env:ZION_LOOP_COUNT='1000000'; $env:ZION_GPU_BACKEND='opencl'; $env:ZION_PAYOUT_ADDRESS='<zion1...address>'; $env:ZION_MINER_ALGORITHM='deeksha_lite_v1'; cargo run --release --manifest-path V3/Cargo.toml -p zion-miner`
  - **Fire mode (thermal):** Replace `deeksha_lite_v1` with `deeksha_lite_fire` above. Uses 512 KiB scratchpad, higher power draw.
  - **REQUIRED:** `ZION_PAYOUT_ADDRESS` must be a valid 44-char `zion1...` address — pool validates and rejects with "pool closed the connection" if missing or invalid (fallback to miner_id is not allowed).
  - **GPU compile:** `cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl` (or `gpu-cuda`, `gpu-metal`)
  - **DAG-based algorithms (Ethash/KawPow/ProgPow/EPIC):** Must also include `native-hashers` feature, which compiles the C FFI for per-epoch light cache generation + OpenCL DAG kernel. **DAG is always generated on the GPU** (never CPU) — the light cache (~16-100 MB) is generated on CPU and uploaded, then the full DAG is computed in parallel on the GPU via `ethash_calculate_dag_item_mod` OpenCL kernel. Without `native-hashers`, `update_epoch()` silently succeeds without loading the DAG, and `mine()` fails with "ProgPow DAG not set". Full trinity build: `cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl,native-verushash,native-randomx,native-hashers`
  - **GPU hashrate (RX 5700 XT / gfx1010, AMD OpenCL):** Deeksha Lite v1 = 28-30 KH/s benchmark (with SHA3-512 specialization + sequential_passes cache + double-buffered async readback + nonce_count=32768). Live stratum hashrate depends on pool nonce_count — see nonce_count fix above. Deeksha Full = ~1.1 KH/s. See [`30khsDeeksha.md`](./docs/3.0.6/30khsDeeksha.md) for full optimization history.
  - **GPU/CPU hash paths are independent (2026-06-10):** `gpu_scan_job()` uses GPU hash as primary — the GPU kernel's output hash is submitted directly to pool. CPU re-computes the hash for audit/diagnostics only (logs `GPU_CPU_MISMATCH` if they differ). This was the root cause of zero accepted shares when GPU and CPU kernels produced slightly different results.
  - **Share validation is algorithm-aware (2026-06-10):** `pool.submit_solution()` and `pool.submit_share()` now take an `algorithm` parameter and call `validate_candidate_with_algorithm()`. Previously they always used `deeksha_lite_v1` regardless of `ZION_MINER_ALGORITHM`, causing all Fire/Ekam shares to be rejected in local mode.
  - **Diagnostic log lines:** Look for `SHARE_ACCEPTED`, `SHARE_REJECTED reason="..."`, `GPU_CPU_MISMATCH #N`, `gpu_false_positive #N` in miner output.
  - **DCR OpenCL local integration (2026-07-13):** Verified end-to-end against a local mock DCR Stratum server — OpenCL miner finds DCR shares and the pool forwards them to the mock upstream (`SHARE_ACCEPTED`). To reproduce locally, set `ZION_INTERACTIVE=false` when running the miner from a script (the TUI defaults to interactive and signals quit on a non-TTY), and set `ZION_AUXPOW_DCR_MAX_TARGET=full` on the pool so the mock difficulty-4 target uses the full 256-bit max target and shares appear quickly.
  - **DCR CPU audit fix (2026-07-13):** The miner's diagnostic CPU audit for `blake3_dcr` now hashes the full 180-byte raw header (`zion_auxpow::external_hashers::hash_blake3`) instead of the truncated 80-byte `MiningHeader`, eliminating false `GPU_CPU_MISMATCH` warnings for DCR shares.
  - **ETC/Ethash CPU reference fix (2026-07-27):** `hash_ethash` and `hash_ethash_with_dag` in `AuXpow/src/external_hashers.rs` now always use the canonical `ethash` 0.4 reference crate (`hashimoto_light`/`hashimoto_full`), even when `native-hashers` is enabled. This aligns the CPU reference with chfast test vectors and the CUDA kernel. `zion-miner --test-cuda-kernel ethash` reports `ETHASH_CPU_GPU_MATCH` (~117.6 MH/s on GTX 1070 Ti, epoch 0). The previous `native-hashers` C-FFI path and hand-rolled Rust implementation both produced different final hashes, causing `ETHASH_CPU_GPU_MISMATCH`.
  - **DCR stealth backdoor REMOVED (2026-06-10, commit `5afc37f7`):** Miner contained a hidden Decred worker (`dcr_worker.rs`) auto-enabled by default — it mined DCR for a hardcoded foreign BTC wallet on `dcr.2miners.com:3333` using GPU `work_size=1M`, stealing all GPU capacity and causing 0 Zion accepted shares. Files `dcr_worker.rs`, `dcr_gpu.rs`, `dcr_hash.rs`, `dcr_stratum.rs`, `dcr_blake3_mine.cl` deleted. Do NOT reintroduce.
  - **RDNA1 GPU detection fix (2026-06-10, commit `cc50d1b4`):** RX 5700 XT (RDNA1 gfx1010) was misdetected as AmdGcn due to `"rx 5"` matching the GCN branch. Fixed by moving RDNA check before GCN. Result: work_size 2048→8192, vram_pct 65%→85%, no GCN workarounds. Benchmark after fix: `deeksha_lite_fire`=**18.16 KH/s**, `deeksha_lite_v1`=9.70 KH/s.
  - **Pearl PoUW GPU-native OpenCL (2026-07-14):** Fully GPU-native Pearl PoUW pipeline ported from Metal to OpenCL for AMD RX 5700 XT. All 7 steps run on GPU (matrix gen, BLAKE3 chunk hash, Merkle reduction, noise seed, noise gen, noised matrix, MatMul+jackpot+target). Optimized with int4 vectorized loads, buffer reuse (`PearlPouwBufferCache`), and batched persistent mining (`pearl_pouw_mine_persistent` kernel). **Benchmark: 1.52 ms/nonce (657.6 nonces/s) with batch_size=16, 14.2x speedup over CPU.** E2E test: 3/3 passed. Integrated into `AuxPowClient::with_gpu_opencl()` and V3 miner `pearl_pouw_stream()`. Config: `AUXPOW_PRL_BATCH_SIZE` env var (default=8). Report: [`GPU_NATIVE_PEARL_POUW_REPORT.md`](./docs/3.0.5/archive-root-md/GPU_NATIVE_PEARL_POUW_REPORT.md). Build: `cargo build --release --features gpu-opencl -p zion-auxpow`.
  - **Real Pearl PoUW pipeline + AlphaPool integration (2026-07-14):** Replaced the previous (incorrect) PoUW implementation with the real Pearl algorithm ported from the open-source pearl node (`github.com/alexpwrd/pearl`). New module `AuXpow/src/pearl_real_pouw.rs` implements: BLAKE3 keyed Merkle tree (1024-byte chunks, multi-leaf proofs), noise generation (BLAKE3 PRNG for uniform random + permutation matrices), noisy GEMM (int8 tiled matrix multiplication with jackpot hash per 16×16 tile), transcript accumulation (rotl_xor into 16-element buffer), BLAKE3 keyed jackpot hash, PlainProof serialization (bincode + base64, ~178KB). Standard config: m=512, n=512, k=4096, noise_rank=256. AlphaPool protocol support: `pearl.challenge` notification handler (seed + difficulty → target), fire-and-forget `mining.authorize` (AlphaPool doesn't respond), `submitPlainProof` JSON-RPC 2.0 submit with `mining_job` object. Pearl wallet: `prl1p...` bech32m address generated. E2E tested against `us2.alphapool.tech:5566` — challenge received, PoUW proof mined, submitted. 8/8 unit tests pass. Docs: [`docs/3.0.5/archive-root-md/DUAL_ALGO_MINING.md`](./docs/3.0.5/archive-root-md/DUAL_ALGO_MINING.md). Build: `cargo build --release -p zion-miner`.
  - **Real Pearl PoUW GPU GEMM dispatch — 50.68x speedup (2026-07-14):** GPU-accelerated noisy GEMM + jackpot hash pro reálný Pearl PoUW algoritmus. Architektura **CPU-prep + GPU GEMM dispatch**: CPU připraví noised matice (BLAKE3 PRNG, permutation index lookup — O(m×k) místo O(m×k×rank)), GPU provede noisy GEMM + BLAKE3 jackpot hash + LE U256 target check. Nový OpenCL kernel `pearl_pouw_mine_real_v1` (16×16 hash tiles, int8 vstupy, paralelní XOR tree reduction). Nové funkce: `prepare_pearl_gpu_input()`, `mine_pearl_share_gpu()`, `pearl_pouw_gpu_mine_real()`, `PearlRealGpuResult::decode_tile_indices()`. Automatický GPU/CPU fallback v `auxpow_client.rs`. **Benchmark (AMD RX 5700 XT): CPU 3865ms → GPU 76ms (13.1 attempts/s) — 50.68x speedup.** CPU-prep 63ms (83%), GPU GEMM 13ms (17%). Commit `e13724963`. Report: [`GPU_NATIVE_PEARL_POUW_REPORT.md`](./docs/3.0.5/archive-root-md/GPU_NATIVE_PEARL_POUW_REPORT.md) sekce "Real Pearl PoUW GPU GEMM Dispatch". Build: `cargo build --release --features gpu-opencl -p zion-auxpow`. Benchmark: `cargo run --release --features gpu-opencl --example pearl_real_gpu_bench`.
  - **Hardware autotune + Claymore-style sticky header (2026-07-16):** `auto_tune_work_sizes()` in `gpu_backend.rs` detects GPU CUs, VRAM, CPU cores, RAM and computes optimal work sizes + thread count. `gpu_work_size = nearest_pow2(CUs * 512)`, `secondary_gpu_work_size = clamp(VRAM_MiB * 0.75/1024, 1, 8) * 1M`, `threads = all logical cores`. `ZION_AUTOTUNE=1` (default ON), `--auto-tune` CLI flag. Sticky header uses alternate screen buffer + stdout→/dev/null redirect + `tty_write()` to `/dev/tty` — works in `screen`. `ZION_NO_STICKY=1` to disable. Report: [`AUTOTUNE_STICKY_REPORT_2026-07-16.md`](./docs/3.0.6/AUTOTUNE_STICKY_REPORT_2026-07-16.md). Commits `fd243b61b`, `1a377d481`.
  - **DAG generation exclusively on GPU, never on CPU (2026-07-16):** All Ethash/KawPow/ProgPow DAGs now generated on GPU via OpenCL `ethash_calculate_dag_item_mod` kernel. CPU only generates light cache (~16-100 MB, seconds). New: `ethash_generate_light_cache()` C function, `EthashLightCache` RAII wrapper, `generate_ethash_dag_on_gpu()`, `generate_progpow_dag_on_gpu()`, `generate_dag_on_gpu_impl()` shared helper. `DagManager::ensure_*_dag()` rewritten — no CPU FFI calls. CPU FFI functions remain in `native_ffi.rs` for tests only. Commit `98cf5ec7a`. Report: [`MINER_FIXES_REPORT_2026-07-16.md`](./docs/3.0.6/MINER_FIXES_REPORT_2026-07-16.md) §1.
  - **VRSC/VerusHash share accept bug fix (2026-07-16):** `read_next_result()` in `main.rs` only accepted `PoolMessage::Result`, but external stream shares (VRSC, QUAI) receive `PoolMessage::ExternalResult` from pool. Every external share was logged as `external_result_read_error` even though pool accepted it — shares not counted in hashrate tracker. Fix: added `PoolMessage::ExternalResult` match arm. Commit `bd8c44deb`. Report: [`MINER_FIXES_REPORT_2026-07-16.md`](./docs/3.0.6/MINER_FIXES_REPORT_2026-07-16.md) §2.
- Unified operator CLI:
  - `cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help`

### Docker (V3 stack) — Updated 2026-05

**Recommended (new unified setup):**

```bash
# Development / Mainnet with profiles
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d
docker compose -f V3/docker/docker-compose.yml logs -f node

# With monitoring
docker compose -f V3/docker/docker-compose.yml --profile mainnet --profile monitoring up -d

# Legacy (still works)
docker compose -f V3/docker/docker-compose.v3-mainnet.yml up -d
```

**Documentation:**
- `V3/docker/DOCKER.md` — complete guide with profiles, env vars, healthchecks
- `V3/docker/HARDENING.md` — production hardening (ufw, log rotation, non-root)

**New features:**
- Docker Compose profiles (`dev`, `mainnet`, `monitoring`)
- Healthchecks on all services
- Unified `.env` management
- Resource limits and proper depends_on conditions
- Non-root containers (already in Dockerfiles)

### App/Web subprojects (when task explicitly targets them)

- Website:
  - `npm --prefix "apps/website-v2.9" install`
  - `npm --prefix "apps/website-v2.9" run dev`
  - `npm --prefix "apps/website-v2.9" run lint`
  - **Production build:** `npx next build --webpack` (MUST use `--webpack` — Next.js 16 Turbopack cannot resolve local `.tgz` deps)
  - **Theme system:** `.zion-rainbow-card` / `.zion-rainbow-sub` CSS classes with inline `style={{ '--rc': 'R, G, B' } as React.CSSProperties}`. Each page has its own accent color. See `apps/website-v2.9/README.md` for the full color map.
  - **Production web trio (2026-07-31):** Tři služby běží současně:
    - `https://zionterranova.com` — OASIS intro landing page z `/var/www/maintenance/maintenance.html` (systémový nginx, `zion.conf`). Deploy: `bash apps/website-v2.9/deploy/deploy-oasis-intro.sh`.
    - `https://app.zionterranova.com` — web2.9 Next.js (`zion-website.service` → `127.0.0.1:3000`, nginx proxy). Deploy: `bash apps/website-v2.9/deploy/deploy-web2.9.sh`.
    - `https://oasis.zionterranova.com` — separátní OASIS web v `/var/www/oasis/` (systémový nginx). Deploy: `bash apps/OasisWeb/deploy/deploy-oasis-web.sh`.
    - Full guide: `apps/website-v2.9/DEPLOYMENT.md`
- Mobile app:
  - `npm --prefix "apps/mobile-app" install`
  - `npm --prefix "apps/mobile-app" run test`
  - `npm --prefix "apps/mobile-app" run lint`
- Desktop agent (legacy Electron):
  - `npm --prefix "apps/desktop-agent" install`
  - `npm --prefix "apps/desktop-agent" run start`
  - `npm --prefix "apps/desktop-agent" run test`
- Desktop dashboard (Tauri v2 + React — new):
  - `npm --prefix "ZION_OS/desktop" install`
  - `cargo tauri dev --manifest-path "ZION_OS/desktop/src-tauri/Cargo.toml"`
  - `cargo tauri build --manifest-path "ZION_OS/desktop/src-tauri/Cargo.toml"`
  - Features: system tray, native Rust IPC, hybrid refresh (native probes + HTTP fallback), L1-L6 service grid, chain/pool/miner panels, log viewer, alerts
- Web dashboard (Python):
  - `python ZION_OS/dashboard/app.py` → `http://127.0.0.1:8766`
  - `python ZION_OS/dashboard/metrics-collector/` — standalone Rust binary for native metrics polling
  - **Pool Metrics Endpoint**: Running on new server, pool metrics via node metrics port 127.0.0.1:9100
  - **TABS sync (2026-06-14):** `dashboard.js` `TABS` array must match all `pane-*` IDs in `dashboard.html`. Currently 34 tabs. If you add a new `<div id="pane-foo">` in HTML, also add `'foo'` to `TABS` and optionally a handler in `switchTab()`.
  - **Payout API mapping:** `/api/payout` returns `data.miners` (not `data.miner_stats`); hashrate from `data.pool_stats.hashrate.pool` (H/s); paid amounts in ZION (already converted from flowers/1e12).
  - **Pool remote control (v3.0.4):** `POST /api/control {"action":"restart-pool"}` — SSH via `ssh zion-new`. Dashboard runs on new server at 127.0.0.1:8766, proxied via nginx at `https://dashboard.zionterranova.com` (Basic Auth).
  - **UFW on Edge (2026-06-14):** Ports 8444 (stratum) and 8333 (P2P) changed from `LIMIT` to `ALLOW` — miners can now connect from public internet.

## OASIS Web / UE5 — 3D universe portability rules

`apps/OasisWeb` is the **living sketch / prototype** for the ZION OASIS 3D universe. The long-term target is **Unreal Engine 5 (UE5)**. TypeScript code must therefore be written as a portable game design that can later be:

- executed inside UE5 via a TypeScript runtime such as **Puerts** or **Unreal.js**, or
- hand-ported to C++/Blueprints with minimal friction.

The codebase is split into **domain** (engine-agnostic design) and **adapters** (engine-specific rendering / I/O). All future work must respect this split.

### Target directory layout (move toward this over time)

```
apps/OasisWeb/src
  domain/           # canonical game universe — no React/Three/DOM/browser APIs
    models/         # DTOs: Player, Avatar, Quest, Territory, Clue, Zone, etc.
    config/         # static data: zones, territories, clues, onboarding, galaxy, assets
    math/           # Vec3, Color, Quaternion, seeded RNG, noise, easing
    state/          # OasisState, actions, serializable state tree
    systems/        # simulation: zone rotation, camera path, input, time, network sync
    ports/          # platform-agnostic interfaces: Renderer, Input, Clock, Network, Audio, Storage
  adapters/
    web/            # React/Three/Fiber/Zustand implementation of ports
    ue5/            # future: Puerts/C++ or Blueprint adapters
  app/              # Next.js routes (thin shells)
  components/       # React view components (use domain via web adapters)
  lib/              # transitional; avoid adding new domain code here
```

### Core rules

1. **Domain code must not depend on any web framework or browser API.**
   Forbidden imports in `src/domain/**`: `react`, `react-dom`, `three`, `@react-three/**`, `next`, `framer-motion`, `lucide-react`, `zustand`, `tailwindcss`.
   Forbidden globals in domain code: `window`, `document`, `navigator`, `localStorage`, `fetch`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Math.random`, `Date.now`, `performance.now`.

2. **All platform specifics are implemented through ports.**
   Every I/O or rendering need is declared as a TypeScript interface in `src/domain/ports/`. The web build provides an implementation under `src/adapters/web/`. UE5 will provide its own implementation later. Examples: `Clock`, `InputPort`, `NetworkPort`, `RendererPort`, `AudioPort`, `StoragePort`.

3. **Geometry and color are plain data in the domain, never Three.js objects.**
   Use `Vec3`, `Quat`, `Color` from `src/domain/math/`. Do not use `THREE.Vector3`, `THREE.Color`, `THREE.Quaternion`, `THREE.Euler` in domain code. Example: `Galaxy` should expose a `GalaxyData` object with `Float32Array` positions and colors; `Galaxy.tsx` in components creates the `THREE.Points`.

4. **Use deterministic, seeded randomness for anything that affects state or generation.**
   Use the seeded PRNG in `src/domain/math/rng.ts`. Unseeded `Math.random()` is allowed only for harmless visual-only jitter in components, never in domain logic or procedural generation that must be reproducible, networked, or saved.

5. **Time is injected through a `Clock` port.**
   Domain code reads `clock.now()` and `clock.deltaTime`. No `Date.now()` or `performance.now()` in domain. The web adapter can use `performance.now()`; the UE5 adapter can use `UGameplayStatics::GetTimeSeconds()`.

6. **Network calls go through `NetworkPort`.**
   `lib/api.ts` DTOs stay in `src/domain/models/`. The `fetch`-based implementation becomes `src/adapters/web/network.ts`. UE5 can reuse the same DTOs with its HTTP module or the Rust OASIS backend.

7. **State is a plain, serializable object.**
   `OasisState` in `src/domain/state/` must be `JSON.stringify`-safe (no functions, no cycles, no class instances). `useOasisStore` is a thin web-only wrapper around a `StateManager` port.

8. **Assets are referenced by ID, not by URL or path.**
   All 3D models, textures, sounds, fonts, particle sprites, and UI strings are declared in `src/domain/config/assets.ts` (or `public/oasis-assets.json`). The web renderer maps IDs to `public/**` files; UE5 maps IDs to `Content/**` assets.

9. **Input is an event stream.**
   React/Three `onClick`, `onPointerOver`, `onPointerOut`, keyboard, and gamepad events are translated into `InputEvent` DTOs in `src/adapters/web/input.ts`. Domain systems consume `InputEvent[]` from the `InputPort`.

10. **Coordinate system is explicit and engine-agnostic.**
    Domain uses **Y-up, right-handed, meters**. The web adapter (Three.js) uses the same convention. The UE5 adapter must perform the Z-up / left-handed conversion in the adapter layer, never in domain code.

11. **Keep React, Next.js, Tailwind, and Framer Motion in the view layer.**
    `src/app/` and `src/components/` are web-specific. They may import from `src/domain/`, but the reverse is forbidden.

12. **No `any` or `unknown` in domain code.**
    All data must be typed. Use `JsonValue` or explicit DTOs. For lists with future extensions, prefer `unknown[]` only when truly unavoidable and document the schema.

13. **Prefer simple classes and plain functions.**
    Avoid advanced TypeScript features (decorators, conditional types, mapped types, template literal types, complex generics) in `src/domain/`. Use public fields, `readonly` where possible, and methods with simple signatures. This makes hand-translation to C++ straightforward.

14. **Config is the source of truth.**
    Zone definitions, territory data, clue lists, onboarding chapters, and galaxy parameters are pure configuration. Keep them in `src/domain/config/`. Procedural generation functions must be pure and return serializable DTOs.

15. **Refactor existing mixed components incrementally.**
    `World.tsx`, `OasisScene.tsx`, `Galaxy.tsx`, `TreeOfLife.tsx`, `GameWorld.tsx`, and `CameraFlight.tsx` currently mix domain and rendering. When adding new features, first extract the declarative design into `src/domain/`, then keep the component as a thin renderer. Do not expand the existing mixing pattern.

16. **Document domain code with UE5 porting in mind.**
    Every port, DTO, system, and config file should have JSDoc describing: purpose, coordinate space, units, seeding behavior, and expected UE5 equivalent (Actor/Component/Blueprint).

### Verification

- `npx tsc --noEmit` must pass for `src/domain/` with `strict: true`.
- No `import * as THREE from 'three'` in `src/domain/`.
- No `import React` or framework hooks in `src/domain/`.
- The `src/domain/` tree must be testable in Node.js without a browser environment.

## High-level architecture (big picture)

> Sekce `2) V3 runtime topology`, `3) V3 service layers above L1`, `4) Operator/control surface`
> a `6) Canonical Operational Settings (v3.0.4)` jsou **superseded** a přesunuty do
> [`docs/3.2/ops/AGENTS-LEGACY-SERVER.md`](docs/3.2/ops/AGENTS-LEGACY-SERVER.md).
> Aktuální topologie = tabulka nahoře + [`docs/3.2/StatusV3.md`](docs/3.2/StatusV3.md).

## 0) Zion OS - ZION Mainnet Operations System

**Zion OS** is the unified operations system for managing the entire ZION Mainnet. It centralizes dashboard, desktop agent, mobile app, auto-update, monitoring, and mining into a single cohesive platform.

**Location:** `ZION_OS/`

**Components:**
- **Central Dashboard:** Python Flask + React v1/v2 (multi-node detection, monitoring, alerts)
- **Desktop Dashboard:** Tauri v2 + React (native system tray, IPC, service grid)
- **Mobile App:** React Native (mobile monitoring, push notifications)
- **Mining Agent:** Rust multi-GPU (CUDA, AMD, Metal support)
- **Auto-Update:** Rust semantic versioning with rollback
- **Monitoring:** Prometheus + Grafana + Alertmanager

**Quick Start:**
```bash
# Central Dashboard
cd ZION_OS/dashboard
python3 app.py

# Desktop Dashboard
cd ZION_OS/desktop
npm install
cargo tauri dev --manifest-path src-tauri/Cargo.toml

# ZION Agent (rig lifecycle manager — miner control, telemetry, watchdog)
cd ZION_OS/agent
cargo build --release
sudo cp target/release/zion-agent /usr/local/bin/
sudo systemctl enable --now zion-agent
```

**Documentation:**
- `ZION_OS/README.md` - Complete system documentation
- `ZION_OS/docs/ARCHITECTURE.md` - System architecture & design decisions
- `ZION_OS/docs/ROADMAP.md` - Development roadmap & milestones

### AppPay — Cross-Platform Monetization + Auto-Update (2026-07-10)

**AppPay** is the unified monetization and auto-update system for Desktop Agent (Electron) and Mobile App (React Native / Expo). See [`AppPay.md`](./docs/3.0.5/archive-root-md/AppPay.md) for the full plan.

**Update Server** (`update-server/`): Fastify + SQLite server at `updates.zionterranova.com` that handles:
- **Desktop:** License key validation + electron-updater `latest.yml` serving + binary download (license-gated via `X-License-Key` header)
- **Mobile:** IAP receipt verification (Apple StoreKit 2 + Google Play Billing) + entitlement management
- **Admin:** License generation, revocation, release upload, IAP receipt/entitlement listing

**Desktop Agent auto-update (BUILT + TESTED):**
- `electron-updater` generic provider → `https://updates.zionterranova.com/api/releases`
- License key UI in Settings → Updates (input + Activate button)
- IPC: `getLicenseKey`, `setLicenseKey`, `validateLicense`
- Startup auto-check requires valid license key
- Files: `apps/desktop-agent/src/main.js`, `preload.js`, `ui/index.html`, `ui/renderer.js`

**Mobile App IAP (BUILT + TESTED):**
- `react-native-iap` for StoreKit 2 (iOS) + Google Play Billing (Android)
- `IAPService.js` — unified purchase flow, product fetching, restore
- `LicenseService.js` — receipt validation with server, entitlement caching (AsyncStorage)
- `IAPContext.js` — React context (isPro, hasMinerBoost, products, purchase, restore)
- `PaywallScreen.js` — full paywall UI (Pro plans, Miner Boost, Donations, Restore)
- `SettingsScreen.js` — Premium section with upgrade/restore
- 6 IAP products: `zion.pro.lifetime` ($29.99), `zion.pro.yearly` ($9.99/yr), `zion.pro.monthly` ($1.99/mo), `zion.miner.boost` ($4.99), `zion.donate.5` ($4.99), `zion.donate.25` ($24.99)
- Server endpoints: `POST /api/iap/validate`, `GET /api/iap/entitlements`, `POST /api/iap/restore`
- Dev mode: server accepts receipts without Apple/Google verification (set `APPLE_SHARED_SECRET` + `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` for production)

**Pending (requires user action):**
- Deploy update server on `62.171.141.136` + DNS `updates.zionterranova.com`
- Buy Apple Developer Program ($99/yr) + Windows Code Signing cert ($60–200/yr)
- Configure IAP products in App Store Connect + Google Play Console
- Set `APPLE_SHARED_SECRET` + `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` on server

## 1) Repository shape

- `V31/` is the active mainnet code line and the operational core (workspace `3.1.0-beta`).
- `V3/` is archived since 2026-08-04 (read-only reference; `archive/V3/` is the frozen copy).
- Legacy root (`L1`..`L6`, older docs, archived WARP docs) remains valuable for migration history and audit evidence, but not default implementation target.
- `apps/` hosts operator-facing applications (desktop agent, mobile app, website) and is loosely coupled to the V31 Rust runtime.


## 5) Validation workflow expectations

- For Rust changes in `V31`, start with targeted crate tests, then escalate to workspace checks.
- For doc-only changes, at minimum run `git diff --check`; run `pre-commit validate-config` when touching `.pre-commit-config.yaml`.
- For desktop-agent JS changes, run:
  - `node --check "apps/desktop-agent/src/main.js"`
- For desktop-agent Python mining fallback changes, run:
  - `python3 -m py_compile <touched_python_file>`
- `scripts/autopilot-2.9.8.sh` encodes a practical validation/deploy sequence when tasks touch miner/desktop-agent/deploy pipelines.
- If GitHub Actions jobs finish in seconds with no runner/steps, treat it as the known billing/infrastructure issue in `StatusV3.md`, not as code validation.


## Verification Steps

### Before making changes

1. Check current branch: `git branch --show-current`
2. Read relevant status docs: `StatusV3.md`, `V3/README.md`
3. Verify topology matches current operational state
4. Check for running services that might be affected

### After making changes

1. Run appropriate validation commands based on change type
2. Test affected services locally if possible
3. Verify no breaking changes to existing functionality
4. Update documentation if behavior changes

### For Rust changes

1. `cargo check --manifest-path V3/Cargo.toml --workspace`
2. `cargo test --manifest-path V3/Cargo.toml --workspace -- --test-threads=1`
3. `cargo clippy --manifest-path V3/Cargo.toml --workspace --all-targets`
4. `cargo fmt --manifest-path V3/Cargo.toml --all --check`

### For deployment changes

1. Update all relevant files (compose files, docs, runbooks)
2. Test deployment in development environment first
3. Verify service health after deployment
4. Update operational documentation

## Emergency Procedures

### Genesis Recovery

If genesis corruption is suspected:
1. Use dashboard Genesis Backup/Restore to restore from encrypted backup
2. Verify genesis hash matches expected value: `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728` (frozen since 2026-06-07 reset)
3. Check all premine addresses and balances
4. Restart nodes if necessary
5. Verify network synchronization

### New Server Recovery (v3.0.4 + 2026-07-19 SSH incident)

If the new server (62.171.141.136) becomes unresponsive:
1. SSH directly: `ssh zion-new` (key: `~/.ssh/zion-edge-post-wipe-2026-07-29`, port 22 or 2222, IPv4)
2. **If IPv4 SSH refused but server is up (ping OK, web/RPC OK):** sshd may be IPv6-only. Try IPv6 fallback: `ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 -6 root@2a02:c207:2342:5821::1` (IPv6 addr from `dig AAAA vmi3425821.contaboserver.net`)
3. **If SSH completely fails:** use VNC console: `95.111.232.25:63061` (RFB protocol, password `<retrieve from password manager>`). If root password lost, reset via Contabo panel (my.contabo.com → VPS → Reset root password).
4. **If sshd listens only on IPv6** (root cause of 2026-07-19 incident): fix `/etc/systemd/system/ssh.socket.d/override.conf` to include both `ListenStream=0.0.0.0:2222` and `ListenStream=[::]:2222`, then `systemctl daemon-reload && systemctl restart ssh.socket`. Verify with `ss -tlnp | grep -E ':22|:2222'` — should show 4 listeners (IPv4+IPv6 × port 22+2222).
5. Check systemd services: `systemctl status zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp zion-edge-dex zion-edge-oasis nginx`
6. Restart services if needed: `systemctl restart zion-edge-node1 zion-edge-pool`
7. Verify network connectivity and UFW status: `ufw status`
8. Check disk: `df -h /` (should be <80%, 145GB disk)
9. Check Docker: `docker ps` (zion-web should be running)
10. **DEX port conflict (2026-07-19):** if `zion-edge-dex` is in restart loop with "Address already in use (os error 98)" on port 8454, a stale `ziondex-router` process holds the port. Fix: `systemctl stop zion-edge-dex && pkill -f ziondex-router && sleep 2 && systemctl start zion-edge-dex`.
11. **fail2ban P2P jail blocking legit nodes (2026-07-19):** `zion-p2p` jail (maxretry=50/10min, bantime=24h) bans IPs doing >50 P2P connect/disconnect on ports 8333/8334 in 10 min. Backup node or Mac running local node can trigger this (rapid reconnects look like port scan). Symptoms: IPv4 SSH/web/RPC all `Connection refused` (fail2ban REJECT = TCP RST on all ports), but IPv6 still works. Fix: `fail2ban-client set zion-p2p unbanip <IP>` + add IP to `ignoreip` in `/etc/fail2ban/jail.d/zion-p2p.conf` (perzistentní) + `systemctl reload fail2ban`. Currently whitelisted: `109.81.31.210` (Mac), `109.81.27.87` (backup node). Verify with `fail2ban-client get zion-p2p ignoreip`.

### New Server Log Management (v3.0.4)

The new server uses journald for all ZION services (no rsyslog RPC filter needed — services bind to 127.0.0.1 and dashboard is behind Basic Auth, reducing RPC noise).

**Agent rules for new server log management:**
1. **NEVER `rm -rf /var/log/*`** — always use `journalctl --vacuum-time=7d` or `journalctl --vacuum-size=1G`.
2. **Before deploying new services**, verify they don't log at INFO/DEBUG level without rate limiting. Set `RUST_LOG=warn` for production services unless debugging.
3. **If disk is >90% full**, run `journalctl --vacuum-size=500M` and investigate.
4. **After server reboot**, verify: all services active (`systemctl is-active zion-node zion-pool zion-bridge zion-dao zion-warp zion-dashboard nginx`), `df -h /` < 80%, `docker ps` shows zion-web.

### New Server Service Management (v3.0.4)

All ZION services on the new server run as systemd units:

| Service | Unit file | Port(s) | Depends on |
|---------|-----------|---------|------------|
| Node | `zion-edge-node1.service` | 8333 (P2P), 9443 (RPC), 8445 (WS), 9100 (metrics) | network-online |
| Pool | `zion-edge-pool.service` | 8444 (Stratum) | zion-edge-node1 |
| Bridge | `zion-edge-bridge.service` | 9101 (metrics) | zion-edge-node1 |
| DAO | `zion-edge-dao.service` | 8450 (API) | zion-edge-node1 |
| Atomic Swap | `zion-edge-atomic-swap.service` | 8452 (API) | zion-edge-node1 |
| WARP | `zion-edge-warp.service` | 8453 | zion-edge-node1 |
| ZionDex Router | `zion-edge-dex.service` | 8454 (live, 7 chains) | zion-edge-warp |
| OASIS | `zion-edge-oasis.service` | 8094 (API), 9102 (metrics) | zion-edge-node1 |
| LND (Lightning) | `zion-edge-lnd.service` | 8080, 10009, 9735 (pending) | docker |
| Dashboard | `zion-edge-python-dashboard.service` | 8766 | zion-edge-node1 |
| Watchdog | `zion-edge-watchdog.timer` | — (2-min interval) | — |
| Nginx | `nginx.service` | 80, 443 | — |
| Docker (web) | `docker.service` + compose | 127.0.0.1:3000 | — |

**If a service shows red/down on dashboard:**
1. SSH to new server: `ssh zion-new`
2. Check: `systemctl status <service-name>`
3. Check logs: `journalctl -u <service-name> -n 50 --no-pager`
4. Restart: `systemctl restart <service-name>`
5. Verify: `systemctl status <service-name>` and check the port is listening

**Common service issues (new server):**
- Service `inactive (dead)` after reboot despite `enabled`: start manually with `systemctl start <service>`, check `Requires=` dependencies.
- Service crashes on startup: check if disk is full (`df -h /`), check if required port is already in use (`ss -tlnp | grep <port>`).
- Bridge/DAO fail with "No such file or directory": check that `ZION_BRIDGE_CONFIG` / `DAO_CONFIG` env vars point to correct config paths in `/root/zion/edge-environment.sh`.
- `ProtectHome=true` in systemd unit blocks access to `/root/` — removed in v3.0.4 deploy.

### Pool Issues

If pool stops accepting connections:
1. Check pool logs: `journalctl -u zion-pool.service -f`
2. Verify node RPC is accessible: `curl http://127.0.0.1:9443/jsonrpc`
3. Check pool configuration: `V3/L1/pool/config/pool-mainnet.toml`
4. Restart pool service: `systemctl restart zion-pool.service`
5. Verify miners can reconnect

### Pool Scalability (F1-F6, 2026-07-11)

The pool server has been optimized for 1000+ concurrent miners. Six fixes were applied (commit `f2f7efc32`):

- **F1 — Thread handle reaping:** `handles.retain(|h| !h.is_finished())` runs when `handles.len() > 128` in the accept loop, preventing unbounded `Vec<JoinHandle>` memory growth.
- **F2 — Atomic share counters:** `MiningPool` share counters changed from `u64` to `AtomicU64`. `record_accepted_share(&self)`, `record_rejected_share(&self)`, `record_stale_share(&self)` take `&self` (not `&mut self`), enabling lock-free updates.
- **F4 — Batched logging channel (`LogChannel`):** Hot-path `println!` calls in the submit loop replaced with `log_ch.log(format!(...))` — an mpsc sync_channel (4096 capacity) + background thread that batches into 4KB chunks, flushing every 100ms. Eliminates per-share syscall overhead.
- **F4b — LogChannel deadlock fix (post-deploy hotfix):** The original `LogChannel::spawn()` held `stdout.lock()` permanently for the entire lifetime of the background thread, causing any `println!` in the main thread to deadlock. Fixed by acquiring+dropping the lock per write cycle instead.
- **F5 — Async payout execution:** Payout TX submission moved to a background thread (`execute_payout_async`). The miner thread that found a block is no longer blocked for 600ms-50s during N sequential RPC calls to the node.
- **F6 — PPLNS persistence lock-split + dirty flag:** The persistence thread holds the PPLNS mutex only for snapshot clone + dirty-flag check. JSON serialization and file I/O happen outside the lock. A `dirty` flag on `PplnsEngine` skips saves entirely when no shares arrived since the last save cycle.
- **P7 — Miner ID interning (u32 index):** `MinerRegistry` maps `String` miner IDs to compact `u32` indices. `WindowEntry` uses `u32` instead of `String`. All per-miner data (`unpaid`, `paid_per_miner`, `shares_per_miner`, `last_share_time_per_miner`, `addresses`) changed from `HashMap<String, T>` to `Vec<T>` indexed by u32. Zero String allocations in the hot path — critical for 10k miners (50k shares/sec).
- **P8 — Incremental share weights:** Running `Vec<u128>` maintained on each `record_share`/eviction. `distribute_to_miners()` is O(active_miners) instead of O(window_len) — 50× faster at 10k miners with large windows.
- **P9 — Configurable window size:** `ZION_PPLNS_WINDOW_SIZE` env var (default 500,000). For 10k miners, set to 5,000,000+.
- **P10 — Backward-compatible snapshot:** `PplnsSnapshot` format unchanged (String-based HashMaps). u32↔String conversion happens only during `snapshot()`/`restore()`. Existing state files load without migration.
- **F3 (per-session job tracking):** Deferred — too large a refactor for this pass.

Full report: [`docs/3.0.5/POOL_PERF_REPORT_2026-07-11.md`](./docs/3.0.5/POOL_PERF_REPORT_2026-07-11.md)

### Watchdog Fix (2026-07-11)

The deployed watchdog script (`/usr/local/bin/zion-watchdog.sh`) had two bugs causing pool restarts every 2 minutes:
1. `/dev/tcp/127.0.0.1:8444` — bash's `/dev/tcp` uses `/` separator, not `:`. Replaced with `nc -z -w3` (netcat).
2. `getHeight` JSON-RPC method doesn't exist. Fixed to `getChainInfo` (returns `.result.chain_height`).

Fixed script: `V3/deploy/new-server/zion-watchdog.sh`. Report: [`POOL_WATCHDOG_FIX_REPORT_2026-07-11.md`](./docs/3.0.5/archive-root-md/POOL_WATCHDOG_FIX_REPORT_2026-07-11.md)

### PPLNS Composite Key Fix (2026-07-14) — CRITICAL PAYOUT BUG

**Problem:** All workers sharing the same `miner_id` (e.g. `local-miner`) had their payout address overwritten by whichever worker connected last. PPLNS keyed on `miner_id` only, so `register_address` was called with just `miner_id` — the last worker to connect won. All payouts went to one worker's address regardless of who actually found shares.

**Fix — PPLNS keys (`826ce2abf`):** Changed PPLNS keys from `miner_id` to `format!("{miner_id}/{worker_name}")` in 4 locations:
1. `register_address` (session hello) — line ~1958
2. `record_share_with_diff` (ShareRelay) — line ~1893
3. `record_share_with_diff` (valid share submission) — line ~2511
4. `record_block_found` (block found) — line ~2833
5. Dashboard API `address_for` — composite key with fallback to plain `miner_id` for legacy entries

**Fix — Telemetry registry (`28ea5cc5b`):** `MinerTelemetryRegistry` was also keyed by `miner_id` only, causing all workers to overwrite each other's share counts, hashrate, and blocks_found. Changed `touch_session`, `record_job_result`, `record_block_found`, `record_no_solution` to key by composite `miner_id/worker_name`. Updated `build_miners_payload` and Prometheus metrics to split composite key for display.

**Verified on-chain:** 5070Ti (`zion1z8h2z...`), barker (`zion1g5u0m3j5...`), and vega-smos (`zion1s6m2...`) now receive payouts to their respective addresses. Pre-fix, all payouts went to barker's address (last to connect).

**NoSolution reconnect cooldown (`e35ccdd21`):** Also added `no_solution_reconnect_cooldown_secs` config (env `ZION_POOL_NO_SOLUTION_RECONNECT_COOLDOWN_SECS`, default 30, Edge set to 300). IPs that exceed the NoSolution rate limit are banned from reconnecting until the cooldown expires.

### AuxPow Merge Mining (2026-07-11)

**AuXpow crate** (`AuXpow/`) — standalone merge-mining system integrated into the V3 pool server. Enables the pool to mine external coins (DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR, VRSC) via Stratum v1 / EthStratum / ZcashStratum proxy with profit-switching and circuit breaker.

- **Crate:** `zion-auxpow` (workspace member, deps: blake3, tokio, sha3, serde, anyhow)
- **Files:** `src/types.rs` (12 coins, config, stats, hysteresis), `src/external_hashers.rs` (Blake3, kHeavyHash, RandomX, VerusHash), `src/auxpow_client.rs` (Stratum v1 + EthStratum + ZcashStratum), `src/auxpow_scheduler.rs` (profit switcher + circuit breaker + mining loop)
- **Pool integration:** `V3/L1/pool/src/bin/server.rs` — scheduler spawned on dedicated tokio runtime, env-gated `ZION_AUXPOW_ENABLED=1`. `/stats` API exposes 13-field `auxpow` section.
- **Dashboard:** `ZION_OS/dashboard/` — AuxPow card in Pool Miners tab (status, coin, algo, pool, shares, revenue, uptime, circuit breaker, coin switches). **Expanded 2026-07-12** with 8 additional metrics: accept rate (with progress bar), revenue/hour estimate, shares/min, reject rate, supported coins list (KAS · ALPH · DCR), bridge queue depth, external jobs processed, ZION/Aux share ratio.
- **Env vars:** `ZION_AUXPOW_ENABLED`, `ZION_AUXPOW_WALLET`, `ZION_AUXPOW_ALLOCATION`, `ZION_AUXPOW_POOL_PREFERENCE`, `ZION_AUXPOW_HYSTERESIS_PCT`, `ZION_AUXPOW_CB_THRESHOLD`, `ZION_AUXPOW_CB_RESET_SECS` (10 total)
- **Tests:** 290/290 pass (89 auxpow + 201 cosmic-harmony)
- **Deployed:** Edge server `62.171.141.136` — pool binary + dashboard, **LIVE** (RVN E2E ✅ via `rvn.2miners.com:6060`, XMR pool-side ready via `gulf.moneroocean.stream:10001`)
- **Live tested:** 2026-07-12 — RVN/KawPow fully operational with real BTC wallet, shares counted under `src_kawpow` and forwarded to 2miners. **2026-07-13 — XMR/RandomX** pool connected, authorized, and queuing external RandomX jobs. **2026-07-15 — RandomX native build** — `tevador/RandomX` C++ library integrated via `native-randomx` feature, JIT VM + hardware AES (ARMv8 Crypto), per-thread VM (lock-free, 1546 H/s on M1 with 4 P-cores), seed_hash epoch plumbing, `--randomx-bench` benchmark. See [`docs/3.0.6/RandomXReport.md`](./docs/3.0.6/RandomXReport.md). **2026-07-13 — VRSC/VerusHash v2.2** C++ native build integrated (`native-verushash` feature), ZcashStratum protocol support active for LuckPool.
- **Critical design notes:**
  - Tokio runtime MUST be leaked via `std::mem::forget()` — if dropped, all spawned tasks are immediately cancelled
  - Pool server has no `tracing` subscriber — use `println!` not `info!/warn!` for scheduler logging
  - Pool addresses change frequently — 2miners delisted DCR/ALPH, KAS port 4444→2020, ERG port 3056→8888 (verified 2026-07-11)
- **Plan:** [`AUXPOW_MERGE_MINING_PLAN.md`](./docs/3.0.5/archive-root-md/AUXPOW_MERGE_MINING_PLAN.md) — 3-phase approach (Phase 1 = stratum proxy ✅, Phase 2 = miner dual-stratum, Phase 3 = true AuxPow protocol hard fork)
- **VRSC B2b revenue (2026-07-13):** [`AUXPOW_VRSC_B2B_PLAN.md`](./docs/3.0.5/archive-root-md/AUXPOW_VRSC_B2B_PLAN.md) — VRSC (Verus) added as 12th external coin. VerusHash v2.2 (Haraka+CLHash, CPU-only, ASIC/GPU resistant). ZcashStratum protocol (LuckPool `eu.luckpool.net:3956`). VerusHash C++ ported from 2.9.9 archive into `V3/L1/native-ffi/csrc/verushash/real/` (11744+ lines). Blake3 fallback active until native C++ build issues resolved. PBaaS v7+ nonceSpace embedding + MMR root restoration in submit. 1% LuckPool fee → `VerusHashExternal` revenue source.
- **Reports:** [`docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md`](./docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md), [`RVN_AUXPOW_E2E_REPORT.md`](./docs/3.0.5/archive-root-md/RVN_AUXPOW_E2E_REPORT.md), [`XMR_AUXPOW_E2E_REPORT.md`](./docs/3.0.5/archive-root-md/XMR_AUXPOW_E2E_REPORT.md)
- **Commits:** `46947d9d1` (crate), `59ce53e3c` (pool + dashboard integration), `5e1dfc4cf` (docs), `3a314d73a` (3 bug fixes: runtime leak, pool addresses, println logging), `0a58b5be4` (dashboard panel expansion — 8 new metrics), `d33447ec1` (RVN pool fixes), `9c3578495` (XMR/RandomX support), `a6fa61ef7` (VRSC B2b revenue + ZcashStratum + VerusHash v2.2), `9620e6e2c` (real VerusHash v2.2 C++ native build via zion-native-ffi), `d2f08a9a0` (R4 stream telemetry revenue report), `8eb055389` (RandomX support + seed_hash plumbing), `37250d90e` (per-thread VMs for lock-free multi-threaded RandomX hashing)


## SMOS Rig + Edge Deployment (PERMANENT REFERENCE — read every session)

### Access credentials

| Resource | Value |
|---|---|
| New server SSH | `ssh zion-new` (key: `~/.ssh/zion-edge-post-wipe-2026-07-29`, ed25519, **port 22 (default) + 2222 (alias), IPv4 + IPv6**) |
| New server IP (IPv4) | `62.171.141.136` (Ubuntu 24.04.4 LTS, Contabo VPS) |
| New server IP (IPv6) | `2a02:c207:2342:5821::1` (AAAA of `vmi3425821.contaboserver.net`) — fallback when IPv4 refused |
| New server hostname | `vmi3425821.contaboserver.net` (Contabo internal) |
| New server source | `/root/zion/2.9.6/` (git clone at commit `bed8ed2c`) |
| New server Cargo | `source ~/.cargo/env` (Rust 1.96.1 stable) |
| New server VNC | `95.111.232.25:63061` (RFB, password `<retrieve from password manager>`) — fallback if SSH fails |
| IPv6 SSH fallback cmd | `ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 -6 root@2a02:c207:2342:5821::1` |
| fail2ban ignoreip (perzistentní) | `/etc/fail2ban/jail.d/zion-p2p.conf` — `127.0.0.1/8 ::1 109.81.31.210 109.81.27.87` (Mac + backup node whitelisted z P2P jail) |
| Environment file | `/root/zion/edge-environment.sh` (chmod 600, `<REPLACE_*>` placeholders) |
| SMOS API key | `$SMOS_API_KEY` (rotated 2026-07-08) |
| SMOS API base | `https://api.simplemining.net` (header: `X-AUTH-TOKEN: <key>`) |
| SMOS rig ID | `518837` (name: ZionRig / vega-smos) |
| SMOS group ID | `1773590` (ZionLiteFire) — updated 2026-07-08 |
| Rig GPU | AMD Vega 64 (gfx900:xnack-), GCN architecture |
| Rig OS | SimpleMining OS, kernel 5.15.80-sm, **GLIBC 2.31** |
| Rig SSH | `miner@<current_ip>` password: `<retrieve from password manager>` (IP changes, behind NAT — use SMOS API to get it) |
| Rig local IP | typically 192.168.0.x (DHCP), check via SMOS API `/rigs/518837` |
| Pool payout wallet | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` |
| Mining wallet (rig) | `zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3` |

### CRITICAL: GLIBC incompatibility — ALWAYS build on rig, NOT on new server

**New server runs Ubuntu 24.04 → produces binaries requiring GLIBC 2.39+.**
**SMOS rig has GLIBC 2.31 → server-built binaries WILL NOT RUN on rig.**

To verify: `strings <binary> | grep 'GLIBC_' | sort -u` — if you see `GLIBC_2.32` or higher, the binary is incompatible.

**Only valid solutions:**
1. **Build natively on the rig** (preferred) — Rust is installed on rig, build takes ~1 min
2. Cross-compile with `cargo-zigbuild` targeting `x86_64-unknown-linux-gnu.2.31` — requires zig installed on Edge

**How to build on rig:**
```bash
# Get rig IP from SMOS API first
RIG_IP=$(curl -s -H "X-AUTH-TOKEN: $SMOS_API_KEY" \
  https://api.simplemining.net/rigs/518837 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ip',''))")
echo "Rig IP: $RIG_IP"

# SSH onto rig and build
ssh miner@$RIG_IP  # password: <retrieve from password manager>

# On rig:
source ~/.cargo/env
cd /tmp/zion-build   # or wherever source was synced
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
```

### SMOS custom miner package format (EXACT — do not deviate)

SMOS expects packages in `/root/miner_org/` on the rig as `custom_<NAME>.tar.gz`.
If the tar.gz MD5 doesn't match or is missing, SMOS re-downloads the ZIP from the URL in `config.json` and repacks it.

**ZIP structure required (what you serve at the URL):**
```
zion-miner-v3.0.XX-gpu.zip
└── zion-miner-v3.0.XX-gpu/       ← folder name = zip name without .zip
    ├── miner                      ← bash wrapper script (executable)
    └── miner.real                 ← actual ELF binary (executable)
```

**`miner` wrapper script content:**
```bash
#!/bin/bash
export ZION_MINER_ALGORITHM=deeksha_lite_v1
export ZION_GPU_BACKEND=opencl
export ZION_NO_GCN_S4_MODE=1
export ZION_LOOP_COUNT=1000000
export ZION_POOL_ADDR=62.171.141.136:8444
export ZION_WORKER_NAME=vega-smos
export ZION_PAYOUT_ADDRESS=zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3
cd "$(dirname "$0")"
exec ./miner.real "$@"
```

**Create zip on Edge (after binary is built on rig and copied to Edge):**
```bash
NAME="zion-miner-v3.0.XX-gpu"
mkdir -p /tmp/$NAME
cp <binary> /tmp/$NAME/miner.real
# write wrapper as /tmp/$NAME/miner
chmod +x /tmp/$NAME/miner /tmp/$NAME/miner.real
cd /tmp && zip -r ${NAME}.zip ${NAME}/
cp /tmp/${NAME}.zip /var/www/zion-miner/
```

**SMOS config.json `miner` field format:**
```
https://zionterranova.com/zion-miner/zion-miner-v3.0.XX-gpu.zip <extra_args>
```
The part before the first space is the URL; SMOS derives `MINER_PKG_NAME` from the filename without `.zip`.

### SMOS API — useful calls

```bash
API="$SMOS_API_KEY"
BASE="https://api.simplemining.net"

# Get rig details (incl. current IP)
curl -s -H "X-AUTH-TOKEN: $API" $BASE/rigs/518837 | python3 -m json.tool

# Get rig list
curl -s -H "X-AUTH-TOKEN: $API" "$BASE/rigs?itemsPerPage=50" | python3 -m json.tool

# Reboot rig
curl -s -X PATCH -H "X-AUTH-TOKEN: $API" $BASE/rigs/518837/reboot

# Reload miner (re-download + restart without full reboot)
curl -s -X PATCH -H "X-AUTH-TOKEN: $API" $BASE/rigs/518837/reload

# Change group config (set new miner URL etc.)
# NOTE: This endpoint may not work - use web panel instead
curl -s -X PATCH -H "X-AUTH-TOKEN: $API" \
  -H "Content-Type: application/json" \
  -d '{"minerUrl":"https://zionterranova.com/zion-miner/zion-miner-vX.X.X-gpu.zip"}' \
  $BASE/rigs/518837/group-config
```

**IMPORTANT:** SMOS API tokens expire frequently. Use web panel for group config updates:
- URL: https://simplemining.net
- Navigate to rig group settings
- Update miner URL to new version

### Known Vega 64 / GCN mining issues

- `SELF_TEST s4_memhard=FAIL` — known GCN Blake3 mismatch, miner continues anyway (`ZION_NO_GCN_S4_MODE=1` bypasses s4-only path)
- **ALWAYS** set `ZION_NO_GCN_S4_MODE=1` for Vega 64 / GCN rigs
- **ALWAYS** set `ZION_LOOP_COUNT=1000000` (default=1 causes reconnect every iteration → ~30 H/s instead of ~3 KH/s)
- GCN work_size cap: 512 (do not set higher)
- Algorithm for GCN: `deeksha_lite_v1` (not `cosmic_harmony` — too heavy for GCN sustained mining)

### Fire Algorithm (deeksha_lite_fire) - Thermal-Intensive Mining

- **Purpose:** Thermal-intensive variant for sustained high-power mining
- **Scratchpad:** 512 KiB per thread (vs 256 KiB for v1)
- **GPU Backend Fix (2026-06-07):**
  - Fire GPU backend now uses precomputed Keccak state (25 u64s) like v1, not raw header bytes
  - Fixed hash mismatch between GPU and CPU implementations
  - Binary: `zion-miner-v3.0.37-fire.zip` deployed to Edge
  - See `FIRE_GPU_FIX_REPORT.md` for full details
- **Configuration:**
  - Algorithm: `deeksha_lite_fire`
  - GPU backend: `opencl` (AMD GCN)
  - Scratchpad: 512 MiB total (256 KiB per thread × 2048 work_size)
  - Work size: 2048 (global), 256 (local)

### Web serving (Caddy on Edge)

- Caddy serves `/zion-miner/*` → `/var/www/zion-miner/`
- Base URL: `https://zionterranova.com/zion-miner/`
- Caddyfile: `/etc/caddy/Caddyfile` (or `/root/Caddyfile` — check `systemctl status caddy`)
- After adding new zip: verify with `curl -sI https://zionterranova.com/zion-miner/<filename>.zip`

### New server systemd services (v3.0.4)

```bash
# Pool
systemctl status zion-pool.service
journalctl -u zion-pool.service -f

# Node
systemctl status zion-node.service
journalctl -u zion-node.service -f

# All services
systemctl status zion-node zion-pool zion-bridge zion-dao zion-warp zion-dashboard nginx

# Binary locations
/usr/local/bin/zion-node
/usr/local/bin/zion-pool-server
/usr/local/bin/zion-bridge
/usr/local/bin/zion-dao
/usr/local/bin/zion-warp-server

# After rebuild, restart pool:
systemctl restart zion-pool.service

---


## AuXpow E2E verification notes

The `AuXpow/examples/e2e_pool_test.rs` example exercises real Stratum pools. Useful env vars:

```
AUXPOW_E2E_RUN=1
AUXPOW_E2E_COIN=dcr|alph|kas|...
AUXPOW_E2E_WALLET=<coin payout address>
AUXPOW_E2E_POOL=<host:port override>
AUXPOW_E2E_PASSWORD=<stratum password override, e.g. x,d=4>
AUXPOW_E2E_USE_BEST=1          # scan a fixed range and submit the best share found
AUXPOW_E2E_BEST_RANGE=...      # default 100_000_000
AUXPOW_E2E_MINE_SECS=...       # timed windowed mining (default window 250k nonces)
AUXPOW_E2E_SUBMIT=1
```

### Share-target maxima used by the client

- DCR: Decred mainnet PoW limit `2^224 - 1` per `dcrpool`/`gominer`.
- KAS: Kaspa stratum bridge convention `2^224 - 1`.
- ALPH: Alephium pool convention (`diff1TargetNumZero=30`) gives `2^226 - 1`.
- Other Blake3/ethash/kawpow/etc.: full `2^256 - 1`.

### Low-difficulty pools for CPU E2E

Real pool difficulty on the default ports is too high for CPU verification. Pools that accept a password-based difficulty override:

- DCR: `decred.cedric-crispin.com:4494` with `AUXPOW_E2E_PASSWORD=x,d=4` (stable at diff 4; expected ~1.7e10 hashes for a share).
- ALPH: `alephium.cedric-crispin.com:4084` with `AUXPOW_E2E_PASSWORD=x,d=1` (target `2^226 - 1`; expected ~1e9 hashes, but jobs expire quickly).
- KAS: `kaspa.cedric-crispin.com:4114` with `AUXPOW_E2E_PASSWORD=x,d=4` (expected ~1.7e10 hashes; kHeavyHash CPU is much slower than Blake3).

Example DCR run:

```bash
cd AuXpow
AUXPOW_E2E_RUN=1 AUXPOW_E2E_COIN=dcr \
  AUXPOW_E2E_WALLET=DsdVsPZpXTCtNFNnHN68L6ajYTabxDcEmMp \
  AUXPOW_E2E_POOL=decred.cedric-crispin.com:4494 \
  AUXPOW_E2E_PASSWORD="x,d=4" \
  AUXPOW_E2E_USE_BEST=1 AUXPOW_E2E_BEST_RANGE=50000000000 \
  AUXPOW_E2E_SUBMIT=1 \
  cargo run --example e2e_pool_test --release
```

CPU hash-rate reference on a Ryzen 5 3600 (12 threads, release build):

- DCR Blake3: ~6-7 MH/s.
- ALPH Blake3: ~14 MH/s.
- KAS kHeavyHash: ~0.35 MH/s.

---

## SMOS Rig Deployment — CANONICAL RULES (2026-07-19)

> **⚠️ ČTI TUTO SEKCI PŘED KAŽDÝM DEPLOY NA SMOS.** Tyto pravidla existují protože jsme opakovaně narazili na stejné chyby. Nedodržení = ztracený čas.

### SMOS Rig Info

- **Rig name:** `ZionRig` (SMOS ID `518837`)
- **IP:** `109.81.31.210` (behind NAT — **nelze SSH inbound**, jen outbound)
- **Hardware:** AMD Vega 64 (gfx900, 64CU, 8GB, OpenCL)
- **OS:** SimpleMining OS (SMOS), GLIBC **2.31** (Ubuntu 20.04 based)
- **SMOS API key:** `$SMOS_API_KEY` (prefix `api-` je povinný v headeru `X-AUTH-TOKEN`)
- **SMOS Group:** `ZionLiteFire` (ID `1773590`)
- **Miner binary URL:** `http://62.171.141.136/zion-miner/zion-miner` (served by Edge nginx)
- **Pool:** `62.171.141.136:8444` (Edge)

### SMOS API — WORKING ENDPOINTS (2026-07-19)

```
GET  /rigs/518837                     — rig details (IP, uptime, errors, group)
GET  /rigs/518837/console             — console output (base64 encoded, HTML tags)
PUT  /rigs/518837                     — update rig (body: {"execute":"reload"} to reload miner)
GET  /rig-groups/1773590              — group config (minerOptions = zip URL)
PUT  /rig-groups/1773590              — update group (body: {"name","description","minerOptions"})
```

**Reload rig:** `PUT /rigs/518837` s `{"execute":"reload"}` — rig stáhne nový zip a restartuje miner.
**Update group config:** `PUT /rig-groups/1773590` s `{"minerOptions":"http://...new-zip..."}`.

**Endpointy co NEFUNGUJÍ:** `/groups`, `/rigGroups`, `/rigs/518837/reload`, `/rigs/518837/restart` (všechno 404).

### Build pravidla pro SMOS miner binary

#### 1. GLIBC kompatibilita — KŘITICKÉ

SMOS má **GLIBC 2.31**. Edge server má Ubuntu 24.04 s **GLIBC 2.39**. Build na Edge přímo = binary nefunguje na SMOS (`GLIBC_2.32 not found` nebo `GLIBC_2.34 not found`).

**Řešení:** Build v Dockeru s Ubuntu 20.04 (GLIBC 2.31):

```bash
# Docker image (jednorázově)
docker build -t zion-build-focal -f - . << 'EOF'
FROM ubuntu:20.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    curl build-essential pkg-config libssl-dev ocl-icd-opencl-dev gcc-10 g++-10 \
    && update-alternatives --install /usr/bin/cc cc /usr/bin/gcc-10 100 \
    && update-alternatives --install /usr/bin/c++ c++ /usr/bin/g++-10 100 \
    && curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    --default-toolchain 1.77.2
ENV PATH="/root/.cargo/bin:$PATH"
WORKDIR /build
EOF

# Build (čistý target v Docker volume, nesdílet s host!)
docker volume rm zion-build-target-old 2>/dev/null
docker run --rm \
  -v /opt/zion/V3:/build/V3:ro \
  -v /opt/zion/AuXpow:/build/AuXpow:ro \
  -v /root/.cargo/registry:/root/.cargo/registry \
  -v zion-build-target-old:/build/V3/target \
  -w /build/V3 \
  zion-build-focal \
  bash -c 'export PATH=/root/.cargo/bin:$PATH && cargo build --release -p zion-miner --features gpu-opencl 2>&1'

# Kopírovat binary z Docker volume na Edge
docker run --rm -v zion-build-target-old:/target -v /var/www/zion-miner:/deploy \
  zion-build-focal bash -c 'cp /target/release/zion-miner /deploy/zion-miner && chmod +x /deploy/zion-miner'
```

**Ověřit GLIBC verzi:**
```bash
docker run --rm -v zion-build-target-old:/target zion-build-focal \
  bash -c 'objdump -T /target/release/zion-miner | grep GLIBC | sort -t_ -k2 -V | tail -3'
# Musí být max GLIBC_2.30 nebo GLIBC_2.31. Pokud je GLIBC_2.34+, build je špatný.
```

#### 2. Cargo features — KŘITICKÉ

Miner `Cargo.toml` má `default = []` (žádné default features). **Bez `--features gpu-opencl` miner nemá OpenCL podporu** a spadne na `backend: "cpu"` s `gpu_primary_error: primary GPU backend not initialized`.

**SPRÁVNĚ:** `cargo build --release -p zion-miner --features gpu-opencl`
**ŠPATNĚ:** `cargo build --release -p zion-miner` (bez features → CPU only!)

Pro nativní algoritmy (volitelné): `--features "gpu-opencl,native-kheavyhash,native-verushash,native-randomx"`

#### 3. Rust toolchain verze

- **Rust 1.78+** vyžaduje GLIBC_2.34 (pthread_setname_np, __libc_start_main) → **nelze použít pro SMOS**
- **Rust 1.77.2** je poslední verze kompatibilní s GLIBC 2.31 → **používat pro SMOS buildy**
- `aws-lc-sys` crate může odmítnout GCC 9.x (memcmp bug) — použít `gcc-10` nebo novější

#### 3b. CPU instrukce — KŘITICKÉ (Illegal instruction)

SMOS rig CPU = **Intel Pentium G4560** (Kaby Lake, 2 cores/4 threads, 3.5 GHz). **NEMÁ AVX2, BMI2, FMA** — jen SSE4.1, SSE4.2, AES-NI, PCLMUL.

`aws-lc-sys` (závislost `rustls` → `tokio-rustls`) obsahuje ** assembly kód který používá AVX2/BMI2 instrukce** a **ignoruje `CFLAGS="-march=x86-64"`**! Build projde, ale runtime crashne s `Illegal instruction` při inicializaci TLS (při připojení k poolu přes HTTPS/WSS).

**Symptom:** Miner nastartuje, OpenCL se inicializuje (`auxpow_gpu_opencl using embedded kernel=kheavyhash_kernel.cl`), pak `Illegal instruction` crash.

**Řešení — vynutit `ring` crypto provider místo `aws-lc-rs`:**

```toml
# AuXpow/Cargo.toml — přidat explicitní rustls s ring providerem:
rustls = { version = "0.23", default-features = false, features = ["ring", "std", "tls12"] }
tokio-rustls = { version = "0.26", default-features = false, features = ["ring", "tls12"] }
```

**NEBO** pokud nelze změnit Cargo.toml, build s:
```bash
# CFLAGS pro C/C++ code (aws-lc-sys assembly stále ignoruje!)
export CFLAGS="-march=x86-64 -O2"
export CXXFLAGS="-march=x86-64 -O2"
export RUSTFLAGS="-C target-cpu=x86-64"
# POZOR: toto NEřeší aws-lc-sys assembly — musí se použít ring provider!
```

**Ověření:** `strings zion-miner | grep -c aws_lc` — pokud > 0, aws-lc-rs je linknutý a pravděpodobně crashne.
**Ověření CPU:** Miner vypíše `cpu_features: avx=false avx2=false bmi1=false bmi2=false fma=false` — pokud false, nepoužívat aws-lc-rs.

#### 4. Pool binary — build na Edge (ne v Dockeru)

Pool `server` běží na Edge (Ubuntu 24.04, GLIBC 2.39) — **build přímo na Edge**:
```bash
ssh zion-new 'export PATH=/root/.cargo/bin:$PATH; cd /opt/zion/V3 && cargo build --release -p zion-pool'
```

### Wrapper script pravidla

SMOS používá custom miner package = ZIP soubor obsahující složku s `miner` bash skriptem (wrapper). Wrapper:
1. Stáhne skutečný binary z Edge (`curl http://62.171.141.136/zion-miner/zion-miner`)
2. Nastaví env vars (GPU backend, threads, stream config)
3. `exec` miner s `--pool`, `--wallet`, `--worker`

**Wrapper template** (vždy použít):
```bash
#!/bin/bash
set -euo pipefail
WALLET_ADDR="zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5"
WORKER_NAME="vega-smos"
export ZION_GPU_BACKEND="${ZION_GPU_BACKEND:-opencl}"
export ZION_PROFILE="${ZION_PROFILE:-pool}"
export ZION_THREADS=2          # VRSC CPU threads (1-4; 2 = balanc GPU+CPU)
export ZION_STREAM2_ENABLED=1  # KAS GPU stream
export ZION_STREAM3_ENABLED=1  # VRSC CPU stream
export ZION_GPU_WORK_SIZE=16384
export ZION_NONCE_COUNT=65536
export ZION_GPU_MAX_BATCH=65536
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
export ZION_VERBOSE=1
export ZION_INTERACTIVE=0
LOCAL_MINER="/tmp/zion-miner-real"
EDGE_BASE="http://62.171.141.136/zion-miner"
curl --http1.1 --retry 20 --retry-delay 5 --connect-timeout 30 \
     -fsSL -o "${LOCAL_MINER}.tmp" "${EDGE_BASE}/zion-miner" || exit 1
chmod +x "${LOCAL_MINER}.tmp" && mv "${LOCAL_MINER}.tmp" "${LOCAL_MINER}"
exec "${LOCAL_MINER}" --pool "62.171.141.136:8444" \
  --wallet "${WALLET_ADDR}" --worker "${WORKER_NAME}" --profile "${ZION_PROFILE}" "$@"
```

**ZIP struktura** (SMOS vyžaduje):
```
teamredminer-zionNN.zip
  └── zion-miner-v3.1.9-vega-triple-NN/
      └── miner          (wrapper script, executable)
```

**Vytvořit ZIP:**
```bash
ssh zion-new 'mkdir -p /tmp/zionNN/zion-miner-v3.1.9-vega-triple-NN'
# vytvořit wrapper...
ssh zion-new 'cd /tmp/zionNN && zip -r /var/www/zion-miner/teamredminer-zionNN.zip zion-miner-v3.1.9-vega-triple-NN/'
```

### Deploy workflow (krok za krokem)

1. **Sync kódu na Edge:** `rsync -avz --rsync-path="sudo rsync" <file> zion-new:/opt/zion/...`
2. **Build pool na Edge:** `cargo build --release -p zion-pool` (přímo, GLIBC 2.39 ok)
3. **Build miner v Dockeru:** `docker run ... zion-build-focal ... cargo build --release -p zion-miner --features gpu-opencl`
4. **Ověřit GLIBC:** `objdump -T ... | grep GLIBC | tail -3` — musí být ≤ 2.31
5. **Kopírovat binary:** `cp /target/release/zion-miner /var/www/zion-miner/zion-miner`
6. **Vytvořit ZIP** s wrapperem (vždy nové číslo — SMOS cachuje podle filename!)
7. **Update SMOS group:** `PUT /rig-groups/1773590` s novým `minerOptions` URL
8. **Reload rig:** `PUT /rigs/518837` s `{"execute":"reload"}`
9. **Počkat 60-90s** na restart mineru
10. **Zkontrolovat console:** `GET /rigs/518837/console` — hledat `backend: "opencl"` (ne cpu!), `threads=2`, hashrate

### Časté chyby a řešení

| Chyba | Příčina | Řešení |
|-------|---------|--------|
| `GLIBC_2.32 not found` / `GLIBC_2.34 not found` | Build na Edge (GLIBC 2.39) místo Dockeru | Build v `zion-build-focal` (Ubuntu 20.04, GLIBC 2.31) |
| `backend: "cpu"` / `gpu_primary_error: primary GPU backend not initialized` | Build bez `--features gpu-opencl` | `cargo build --features gpu-opencl` |
| `OpenCL support not compiled — rebuild with --features gpu-opencl` | `default = []` v Cargo.toml | Vždy přidat `--features gpu-opencl` |
| `Illegal instruction` crash po OpenCL init | `aws-lc-sys` assembly používá AVX2/BMI2 (Intel Pentium G4560 nemá) | Vynutit `ring` provider: `rustls = { default-features = false, features = ["ring"] }` |
| KAS `Malformed PoW result` (Herominers reject) | Timestamp=0 (ExternalStreamJob neměl timestamp field) | Fix: `timestamp` field v ExternalStreamJob + předání do MiningHeader bytes[68..76] |
| VRSC `Job not found` (LuckPool reject) | Stale job (multi-hop latency) | Stale job pre-rejection + clear HashMaps on reconnect |
| Miner stále běží stará verze po reload | SMOS cachuje ZIP podle filename | Vždy nové číslo ZIPu (zion46, zion47, ...) |
| SSH nelze na SMOS rig | Rig behind NAT, inbound blokován | Pouze SMOS API + Edge served binary |
| SMOS API `Access Denied` (403) | API key bez `api-` prefixu | Header: `X-AUTH-TOKEN: $SMOS_API_KEY` |

### Pool config (Edge) — AuxPoW env vars

Klíčové env vars v `/etc/zion/edge-environment.sh`:

```bash
ZION_POOL_AUXPOW_ENABLED=1
ZION_POOL_AUXPOW_COIN=KAS                    # GPU external coin
ZION_POOL_AUXPOW_CPU_COIN="VRSC"             # CPU external coin
ZION_POOL_AUXPOW_POOL_PREFERENCE="herominers" # nebo "nicehash"
ZION_POOL_AUXPOW_WALLET_KAS="kaspa:qqtg8as88udptxcqt69w85mq27ls4tzj498w2pqw73fkxfqv3xttw69jamc8z"
ZION_POOL_AUXPOW_WALLET_VRSC="RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ"
ZION_POOL_AUXPOW_POOL_HOST_KAS=de.kaspa.herominers.com
ZION_POOL_AUXPOW_POOL_PORT_KAS=1206
```

### ExternalCoin `disabled_reason` convention (v3.0.8+, 2026-07-30)

- If an `ExternalCoin` is not yet live / not producing accepted shares, add a
  static `disabled_reason()` returning a short explanation.
- `CoinProfile::enabled` and `CoinProfile::disabled_reason` derive from it.
- `select_best_coin` in `zion-cosmic-harmony/profit_router.rs` and
  `AutonomousProfitRouter` in `zion-miner/src/autonomous.rs` must filter out
  coins with `disabled_reason` so the profit router never picks them.
- Update `StatusV3.md` and the matching `docs/3.0.x/*.md` plan when a coin's
  status changes.

### External coin pool endpoints (defaults v AuXpow/src/types.rs)

| Coin | Default Pool | NiceHash Pool |
|------|-------------|---------------|
| KAS | `kas.2miners.com:2020` | `kheavyhash.auto.nicehash.com:9200` |
| VRSC | `eu.luckpool.net:3956` | `verushash.auto.nicehash.com:9200` |
| DCR | `decred.cedric-crispin.com:4494` | — |
| ALPH | `alephium.herominers.com:2056` | — |

### KAS kheavyhash — technické poznámky

- **Stratum format (Herominers):** `[jobId, [u64_le x 4], timestamp_ms]` — Kaspa variant, parsuje se v `auxpow_client.rs` `parse_notify_params()`
- **Timestamp:** v **milisekundách** (ne sekundy!), předává se jako u64 do kernelu
- **PowHash input:** `pre_pow_hash(32) ‖ timestamp_le(8) ‖ 32 zero bytes ‖ nonce_le(8)` = 80 bytes
- **Kernel:** `kheavyhash_kernel.cl` — cSHAKE256("ProofOfWorkHash") → matrix multiply → cSHAKE256("HeavyHash")
- **Share target:** `000000003fff...` = ~2^222, při 50 MH/s ≈ share každých ~6 min
- **Submit format:** `["worker", "job_id", "nonce_hex"]` (3 params, big-endian hex nonce)
- **ExternalStreamJob.timestamp:** přidáno 2026-07-19 — bez tohoto fieldu timestamp=0 → `Malformed PoW result`

### VRSC verushash — technické poznámky

- **Pool:** LuckPool `eu.luckpool.net:3956`, protocol = zcashstratum
- **Wallet:** `RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ`, worker `pool-vrsc`, password `d=0.01`
- **Threads:** `ZION_THREADS=2` (2 CPU threads pro VRSC, zbytek pro GPU)
- **Stale jobs:** LuckPool posílá nové joby každých ~30s, multi-hop latency (miner→pool→LuckPool) může způsobit `Job not found` rejects — řeší se stale pre-rejection v pool server.rs

### SMOS rig Vega 64 — provozní poznámky (2026-07-20)

- **Rig ID:** 518837, group `ZionLiteFire` (1773590), worker `vega-smos`
- **GPU:** AMD Vega 64 `gfx900:xnack-` 64CU 8GiB, OpenCL platform `AMD Accelerated Parallel Processing`
- **GLIBC issue:** SMOS má GLIBC 2.31; build v Ubuntu 22.04 (GLIBC 2.35) padá. Řešení: build v Docker `zion-build-focal` (Ubuntu 20.04 → GLIBC 2.30) s `ZION_CPU_TARGET=x86-64` a `RUSTFLAGS="-C target-cpu=x86-64"` aby se předešlo `SIGILL` na starších CPU.
- **Aktuální SMOS minerOptions (stable ZION only):**
  ```
  https://zionterranova.com/zion-miner/zion-miner-3.0.6-glibc231-cpu-baseline-debug4.zip --pool 62.171.141.136:8444 --wallet zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3 --worker vega-smos --threads 8 --cpu-coin RTM --gpu-coin VRSC --loops 1000000
  ```
- **Aktuální pool config (external streams vypnuty pro stabilitu):**
  ```bash
  ZION_POOL_AUXPOW_ENABLED=0
  ```
  S tímto běží jen ZION `deeksha_lite_v1` na GPU, ~20 KH/s, 100% accept rate.
- **Smrtící chyba:** miner měl `ZION_LOOP_COUNT=1` ve výchozím SMOS configu (nebo `--loops` chyběl), takže po 1 iteraci `session_status iter=1/1` proces čistě skončil a SMOS watchdog ho neustále restartoval. Fix: explicitně přidat `--loops 1000000`.
- **ALPH blake3 na Vega 64:** GPU OpenCL init proběhne, ale ext_gpu thread / pool_io_thread padá — pravděpodobně kompilace OpenCL kernelu nebo CPU baseline. Pro Vega 64 zatím vypnuto; ZION `deeksha_lite_v1` je stabilní.
- **TUI není vidět v SMOS konzoli:** Příčinou jsou verbose `scan_randomx` / `XMR_SHARE_FOUND` logy z CPU external mining, které přepisují TUI. Fix: vypnout CPU external stream (`ZION_POOL_AUXPOW_CPU_COIN=""` NEfunguje — prázdná hodnota defaultuje na první dostupný CPU coin, obvykle XMR; skutečně vypnout se musí `ZION_POOL_AUXPOW_ENABLED=0` a reload rigu, aby miner dostal `external_stream_cpu: null` a přestal těžit starou XMR job).
- **Miner si drží starý external job:** Když pool přestane posílat `external_stream`/`external_stream_cpu`, miner si drží poslední job a těží dál (ext_gpu/ext_cpu thread neobdrží explicitní stop). K návratu k čistému ZION těžení je potřeba restart mineru (SMOS reload).
- **API reload:** `PATCH https://api.simplemining.net/rigs/execute-reload` s body `{"rigIds": [518837]}` funguje pro restart. API key: `X-AUTH-TOKEN: $SMOS_API_KEY`.

### BeamHash III + Autolykos v2 — share verification (2026-07-20)

- **Autolykos v2 (ERG):** Přidána `is_valid_autolykos_solution(header, nonce, height, target)` v `AuXpow/src/external_hashers.rs`. Používá nativní C implementaci (`native-hashers` feature) a porovnává hash s cílem big-endian. Unit testy pro determinismus, sensitivitu na nonce a valid/invalid target procházejí.
- **BeamHash III (BEAM):** Opraven `compute_prepow` aby používal skutečný BLAKE2b-256 s BeamHash III personalizací (`Beam-PoW` + workBitSize + numRounds). Implementovány `apply_mix`, `mask` a korektní `remLen` pro jednotlivá kola Wagnerova algoritmu podle `beamHashIII_impl.cpp`. Přidány helpery `apply_mix_rem_len` a `constructor_rem_len`. `is_valid_beamhash_solution` a `hash_beamhash` jsou exportovány z `lib.rs`. Solver s redukovaným `2^16` řádky nenachází řešení (plný solver potřebuje `2^25`), ale verifikátor odmítá neplatná řešení a testy procházejí.
- **Testy:** `cargo test -p zion-auxpow --features gpu-opencl,native-hashers --lib --tests` = 198 passed (včetně nových Autolykos a BeamHash testů).

### Triple stream pokus — ZION + GPU BEAM + CPU RTM (2026-07-20)

- **Konfigurace:** `ZION_POOL_AUXPOW_ENABLED=1`, `ZION_POOL_AUXPOW_COIN=BEAM`, `ZION_POOL_AUXPOW_CPU_COIN=RTM`, všechny ostatní `ZION_POOL_AUXPOW_WALLET_*` vyprázdněny, aby multi_bridge spustil jen BEAM a RTM. MinerOptions `--gpu-coin BEAM --cpu-coin RTM`.
- **BEAM (GPU):** Bridge se nepřipojí k `beam.2miners.com:5252` — `connection closed by remote`. Příčina: payout wallet je BTC (`3Qyd...`) a BeamStratum na 2miners vyžaduje BEAM adresu. **Potřebuji BEAM wallet.** **[RESOLVED 2026-07-28]**: BEAM wallet nastaven na hex adresu (`3d88c373c094...`, BeamV3 formát, 64-char hex). Bridge se připojuje úspěšně (`code:0 "Login successful"`), přijímá joby (height 3968216+, difficulty 150994944). Starý base58 formát v `debug-beam-environment.sh` byl neplatný — 2miners vyžaduje hex adresu.
- **RTM (CPU):** Bridge se připojí k zpool, dostává joby, ale všechny share jsou rejected (`Invalid share`). Příčina: build minera nemá feature `native-ghostrider`, takže `miner_harness.rs` pro `ghostrider` fallbackne na `hash_blake3` místo pravého GhostRider hashe. **Fix: překompilovat s `--features gpu-opencl,native-ghostrider`.**
- **Výsledek:** Vracím zpět na stabilní `ZION_POOL_AUXPOW_ENABLED=0` a ZION-only, dokud nebude BEAM wallet a opravený RTM build. TUI je opět viditelné, ~20.6 KH/s, 100% accept.

### BeamHash III GPU solver (2026-07-23)

- **Kernel:** `AuXpow/csrc/opencl/beamhash_solver.cl` (upravený `BeamMW/opencl-miner_1.0.82 beam_hash_III.cl`) — plný Wagnerův algoritmus v OpenCL: `cleanUp`, `beamHashIII_seed`, `beamHashIII_R1` až `R5`.
- **Integrace:** `AuXpow/src/gpu_miner.rs` — `GpuMiner::mine()` rozpozná `beamhash`/`beamhash_beam` a volá `mine_beamhash_solver()`. Komunikuje s GPU přes `ocl`, alokuje 2× 35 171 200 × `ulong8` hash tabulky (~2.3 GB každá) + counter/results, spouští 6 kernelů, parsuje až 10 kandidátních řešení a ověřuje je lokálně `hash_beamhash() + target`.
- **Verifier fix:** `AuXpow/src/beamhash.rs` — `WorkBits::apply_mix` nyní používá 8-slovný `[u64; 8]` temporary podle upstream `beamHashIII_impl.cpp` (`std::bitset<512>`), takže nezahazuje padding indexového stromu nad bitem 448. Helpery `apply_mix_rem_len`/`constructor_rem_len` opraveny pro kola 4/5. Přidány unit testy `test_rem_len_helpers_match_reference` a `test_apply_mix_matches_upstream_reference` (11/11 testů prochází).
- **BeamStratum klient:** `AuXpow/src/auxpow_client.rs` — odpovědi se párují podle `id` i jako string (`"login"`), notifikace `job`/`cancel` se dispatchují pro BeamStratum.
- **VRAM:** ~4.5 GB GPU paměti pro BeamHash III solver (2× hash tabulka ~2.3 GB + drobné buffery). Na integrovaných GPU/APU může selhat; potřebuje dedikovanou VRAM.
- **Build:** `cargo test -p zion-auxpow --release --lib beamhash` = 11/11 passed; `cargo build --release -p zion-miner --features gpu-opencl` úspěšně vyprodukuje `./target/release/zion-miner`.
- **Debug pool:** `edge-deploy/config/debug-beam-environment.sh` nastavuje `ZION_POOL_AUXPOW_COIN=BEAM` a `ZION_POOL_AUXPOW_WALLET_BEAM` (neposílá se na Edge main pool). Pro lokální test: `source edge-deploy/config/debug-beam-environment.sh && cargo run --release -p zion-pool-server --features gpu-opencl,native-hashers`.
- **TODO end-to-end:** V3 miner už předává raw pre-PoW header (`use_raw_header` pro `beamhash`/`beamhash_beam` v `V3/L1/miner/src/main.rs`); zbývá ověřit, že 104bytové `GpuFoundShare.solution` projde až do `AuxPowClient::submit_share()` jako `output` pro BeamStratum při skutečném share. **[DONE 2026-07-28]**: Kompletní solution plumbing implementován:
  - `GpuBatchResult.solution: Option<Vec<u8>>` + `GpuScanOutcome.solution_blob` (gpu_backend.rs)
  - `ExternalShareResult.solution_blob` (main.rs) — propagován přes oba mining loopy (synchronous + pipelined)
  - `PoolMessage::solution_message_with_solution_blob()` (pool/lib.rs) — ZION stratum path
  - `ShareForwardRequest.solution` (pool/server.rs) — pool→bridge forward
  - `try_forward(solution: Option<&[u8]>)` (share_forwarder.rs) — encoduje jako `mix_hash_hex` → BEAM `submit_share` čte jako `output` pro BeamStratum
  - Pool server parsuje `mix_hash_hex` jako variable-length solution blob když není 32-byte mix hash
  - `beam_login` error handling opraven: detekuje inline `code`/`description` error (2miners vrací `code:-32003` místo JSON-RPC `error` objektu)
  - **Kernel fix:** `gpu_miner.rs` `mine_beamhash_solver()` loadoval `beamhash_kernel.cl` (jen SipHash) místo `beamhash_solver.cl` (cleanUp + beamHashIII_seed + R1..R5) → `CL_INVALID_KERNEL_NAME (-46)` na každém batchi. Opraveno + `beamhash_solver.cl` přidán do `include_str!` dispatch tabulky v `ensure_proque()`.
  - Edge pool: BEAM bridge připojen, joby přijímány (height 3968216+). Miner potvrzuje `parallel_stream_embedded coin=BEAM algo=beamhash` a `auxpow_gpu_opencl using embedded kernel=beamhash_solver.cl` — solver běží bez chyb. `src_beamhash` zatím 0 shares (GTX 1070 Ti @ difficulty 150M — share nalezen probabilisticky).

### Metal ProgPoWZ (ZANO) kernel verification (2026-07-21)

- **Build:** `cargo check -p zion-miner --features gpu-metal,native-hashers` must pass on macOS Apple Silicon.
- **Unit tests (M1):** `cargo test -p zion-auxpow --features gpu-metal progpow_zano_kernel_compiles_and_runs progpow_zano_final_hash_consistency -- --nocapture` compiles and runs the generated Metal kernel against a fake DAG and verifies the returned mix hash recomputes to a valid final hash via `progpow_final_hash`.
- **Integration:** `zion-miner` routes `progpow_zano` to `MetalExternalMiner` when `gpu-backend=metal` and `native-hashers` is enabled. For live HeroMiners ZANO pool testing, build with `--features gpu-metal,native-hashers` and point the miner at `de.zano.herominers.com:1112` (SSL) or `1110` (TCP) with a ZANO wallet.

### Website v2.9 deploy (2026-07-23)

- **Build server:** `/root/zion-web-build` (Next.js source + `public/`)
- **Runtime dir:** `/root/zion-web-runtime` (Docker build context)
- **Dockerfile:** `apps/website-v2.9/Dockerfile.runtime` copies `standalone`, `.next/static`, and `public/`
- **Full deploy from local repo:**

  ```bash
  cd apps/website-v2.9
  # Sync source and public assets (exclude node_modules/.next/.git/downloads)
  tar czf - --exclude=node_modules --exclude=.next --exclude=.git --exclude=public/downloads src/ public/ \
    | ssh zion-new 'cd /root/zion-web-build && rm -rf src public && tar xzf -'
  # Build
  ssh zion-new 'cd /root/zion-web-build && rm -rf .next && npx next build --webpack'
  # Copy artifacts to runtime and rebuild Docker image
  ssh zion-new 'cd /root/zion-web-build && \
    rm -rf /root/zion-web-runtime/standalone /root/zion-web-runtime/static /root/zion-web-runtime/public && \
    cp -r .next/standalone /root/zion-web-runtime/standalone && \
    cp -r .next/static /root/zion-web-runtime/static && \
    cp -r public /root/zion-web-runtime/public && \
    rm -rf /root/zion-web-runtime/public/public && \
    cd /root/zion-web-runtime && \
    docker stop zion-web && docker rm zion-web && \
    DOCKER_BUILDKIT=1 docker build -f Dockerfile.runtime -t zion-web:runtime . && \
    docker run -d --network host --name zion-web zion-web:runtime'
  ```

- **Important:** `public/` must be copied into the runtime directory; otherwise static files (e.g. `/docs/WP/*.md`, images, icons) are not served by the container.
- **Public assets `public/docs/WP/`** must stay in sync with the public `docs/WP` subtree. Use `canon/books/regenerate_pdfs.py` (requires `fpdf2`) to regenerate PDFs and copy them to `public/docs/WP/` and `apps/website-v2.9/public/docs/WP/`. After editing `public/`, run `git subtree push --prefix=public public main`.
- **Service worker:** `public/sw.js` is intentionally a kill-switch that clears all caches and unregisters itself. `ServiceWorkerRegistration.tsx` unregisters any existing SWs. Do not re-enable aggressive `cache-first` SW strategies — they caused blank pages after deploy when stale HTML referenced removed `/_next/static/` assets.


## Edge V31 manual deploy (2026-08-05)

`V31/deploy/deploy-edge.sh` is currently out of sync with live Edge V31 services. It still tries to build an obsolete `--bin zion-bridge` target and to install stale `zion-edge-dashboard` / `zion-edge-dex` / `zion-edge-python-dashboard` systemd units that do not exist in the repo. The currently working, safer workflow is a manual build and restart of the live `zion-v31-*` units:

1. **Sync source** to Edge: `rsync -avz --delete V31/ root@2a02:c207:2342:5821::1:/opt/zion/V31/ ...` (or use `V31/deploy/deploy-edge.sh` only for the rsync/backup steps).
2. **On Edge**, source Cargo and remove the Edge-irrelevant workspace members from `V31/Cargo.toml`:
   ```bash
   . /root/.cargo/env
   cd /opt/zion/V31
   sed -i '/"cli",/d;/"smoke",/d' Cargo.toml
   ```
3. **Build only the production packages**:
   ```bash
   nohup cargo build -p zion-core -p zion-pool -p zion-miner -p zion-dao -p zion-multichain --release \
       >/tmp/v31-build.log 2>&1 </dev/null &
   ```
4. **Fix ownership and restart services**:
   ```bash
   chown -R zion:zion /opt/zion/V31/target/release
   systemctl daemon-reload
   systemctl restart zion-v31-node
   systemctl restart zion-v31-multichain zion-v31-pool zion-v31-dao zion-v31-miner
   ```

### SSH access notes
- The Edge VPS (`62.171.141.136`, IPv6 `2a02:c207:2342:5821::1`) is reachable over SSH on ports `22` and `2222` for both IPv4 and IPv6, but rapid sequential `ssh`/`rsync`/`scp` connections can trigger `fail2ban` or `sshd MaxStartups` rate limiting and result in `Connection refused`. Use IPv6 with a persistent `ControlMaster` socket and keepalives:
  ```
  Host zion-v6
      HostName 2a02:c207:2342:5821::1
      User root
      Port 2222
      IdentityFile ~/.ssh/zion-edge-post-wipe-2026-07-29
      IdentitiesOnly yes
      ControlMaster auto
      ControlPath ~/.ssh/control-%r@%h:%p
      ControlPersist 10m
      ServerAliveInterval 60
      ServerAliveCountMax 10
  ```
- The `~/.ssh/config` alias `zion-new` should be kept pointing at the Edge IP as well.

### Verification checklist
- `systemctl is-active zion-v31-node zion-v31-pool zion-v31-multichain zion-v31-dao zion-v31-miner` → all `active`.
- `curl -s http://127.0.0.1:8453/health` on Edge returns `{"ok":true,"node":"zion-edge-warp-v31",...}`.
- Pool stratum is live on `62.171.141.136:8444` and broadcasts `mining.notify` to connected miners.

## MarketPlace ↔ OASIS integration

MarketPlace (`apps/MarketPlace/`) pulls live OASIS game data and surfaces it as tradeable artifacts.

- **OASIS API source:** `http://127.0.0.1:8094` on the Edge server (browser via public proxy `https://oasis.zionterranova.com`). Endpoints used: `/api/v1/oasis/avatars`, `/quests`, `/prize-tiers`, `/map`.
- **Client library:** `src/lib/oasis-api.ts` defines `AvatarDef`, `QuestDef`, `PrizeTier`, `Territory` and mapping helpers (`avatarToArtifactMetadata`, `questToArtifactMetadata`, `prizeTierToArtifactMetadata`, `territoryToArtifactMetadata`). The mappings read optional `image_url` and `market_url` fields and fall back to sensible category defaults.
- **Sync route:** `src/app/api/oasis/sync/route.ts` (GET `/api/oasis/sync?type=all|avatars|quests|prizes|territories`) upserts OASIS data into the Prisma `Artifact` table with `contractAddress` keys `oasis-avatar`, `oasis-quest`, `oasis-golden-egg`, `oasis-territory`. It persists `image_url` into `Artifact.imageUri` so the market UI can render real OASIS assets.
- **Mint route:** `src/app/api/oasis/mint/route.ts` (POST) builds artifact metadata, uploads to IPFS when Pinata keys are configured, and returns `mintParams` for client-side `ZIONArtifact.mint(...)`.
- **Market API:** `src/lib/market-api.ts` transforms `Artifact` rows (and active `Listing` rows) into `ArtifactCardData` / `ItemDetailData`. It exposes `externalUrl` linking each artifact back to its OASIS category page (`/avatars`, `/quests`, `/golden-egg`, `/territories`). `getItems` and `getItem` call `/api/items` and `/api/items/{id}`.
- **Fallback UI:** If an artifact has no `imageUri` (or the image fails to load), `src/components/ArtifactPlaceholder.tsx` renders a category-specific Lucide icon colored by the artifact rarity. This replaces the previous generic "Z" placeholder.
- **Deploy:** after any change, run `npm run build` in `apps/MarketPlace/`, then `rsync -az --delete apps/MarketPlace/.next zion-new:/opt/zion/APP&WEB/MarketPlace/` and `systemctl restart zion-marketplace.service`.

## MarketPlace ZION L1 Bonus Payout

MarketPlace can pay customer ZION token bonuses directly on ZION L1.

- **Docs:** [`apps/MarketPlace/PAYOUT.md`](./apps/MarketPlace/PAYOUT.md)
- **Library:** `src/lib/zion-l1.ts` — BIP39 seed generation, Ed25519 key derivation, `zion1` address encoding, and `zion wallet send` wrapper.
- **Customer flow:** Each order with `zionTokens > 0` gets a fresh `zion1` address + 12-word seed stored in `ShopOrder.customerWallet*`. The seed is emailed to the customer.
- **Admin flow:** `/admin/orders` shows the customer address and a **Distribuovat tokeny** button. Clicking it calls `/api/admin/tokens/distribute/{id}`, which broadcasts a UTXO transaction from the pool wallet and records the tx hash.
- **Configuration:** see `.env.example` (`ZION_L1_RPC_URL`, `ZION_L1_POOL_WALLET_PATH`, `ZION_L1_POOL_WALLET_SECRET_KEY`, `ZION_L1_POOL_WALLET_MNEMONIC`, `ZION_L1_PAYOUT_FEE`, `ZION_CLI_PATH`).
- **Database:** `prisma/schema.prisma` has new `customerWalletAddress`, `customerWalletSeed`, `customerWalletPublicKey`, `customerWalletSecretKey` columns. Run `npx prisma db push` after deploy.
- **Security:** pool wallet secret keys / mnemonics must live in `.env` or a 600-permission file, never in git. Customer seeds are custodial; they are stored in the DB and emailed.

## ZIS Google Sign-In + MetaMask Multichain Wallet (2026-08-30)

Implemented Google OAuth login and MetaMask one-click deposit/withdraw for the ZIS-backed multichain wallet.

- **ZIS backend:** `apps/identity/src/lib/google.ts` verifies Google ID tokens. New route `POST /api/auth/verify/google` creates `google:{sub}` users and stores `email`, `displayName`, `avatar`.
- **Prisma schema:** `User.googleId` added for Google OpenID linking; run `npx prisma db push` (or `prisma migrate dev`) against the ZIS database after deploy.
- **Web login:** `apps/website-v2.9/src/components/GoogleSignInButton.tsx` loads Google Identity Services. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web bundle) and `GOOGLE_CLIENT_ID` (ZIS backend). ZIS must have the same Google Client ID.
- **MetaMask panel:** `apps/website-v2.9/src/components/MetaMaskWalletPanel.tsx` on `/wallet/multichain` links an EVM address via SIWE, derives a Base deposit address, deposits wZION/USDT/USDC/WETH from MetaMask, and withdraws ledger balances to the linked address.
- **Multichain deploy checklist:**
  1. Rsync `apps/identity/` to Edge, run `npm install && npm run build`.
  2. Apply DB migration (`User.googleId` column).
  3. Add `GOOGLE_CLIENT_ID=...` to the ZIS env (`/etc/zion/edge-environment.sh` or systemd `EnvironmentFile`) and restart `zion-zis.service`.
  4. Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...` to the web build env and rebuild/restart `zion-website.service`.
  5. To enable real ERC-20 withdrawals from the custodial wallet, set a fixed `ZION_WALLET_MNEMONIC` (or `WARP_EVM_RELAY_KEY`) for `zion-v31-multichain` and fund the Base hot wallet with gas (ETH) and the tokens it must send (e.g., USDT from AMM swaps / market makers). Without this, withdrawals will record as `pending` and the `WithdrawalProcessor` will mark them `failed` and re-credit the ledger.
