# ZION v3.2.0 — Mainnet Stable (RELEASE NOTES — DRAFT 2026-10-26)

> **Stav:** NÁVRH pro 9.B2 — publikovatelný až po G8 PASS + G9 + tagu `v3.2.0` (9.S1–S3). Nepublikovat pod touto hlavičkou dokud gates nejsou zelené.
>
> Nahrazuje `V31/release/RELEASE_NOTES.md` (hlavička „Mainnet Alpha") při vydání.

## Co je v3.2.0

První **stable** release mainnetu V31 (genesis 2026-08-06). Šestivrstvá architektura — od konsensusu PoW přes peněžní L2 po humanitární a vesmírné grantové fondy — provozovaná na dvouboxové produkci (EDGE primary + EDGE ops/pool).

### L1 — konsensus a mining

- **Ekam Deeksha v3.2 PoW** — 512 KiB scratchpad, 2 průchody, ASIC-odolný; nahrazuje Deeksha Lite v1 z public buildů 3.0.x/3.1.x.
- **zion-pool NG** — stratum :8444 (plain) + :8445 (TLS), PPLNS, aux merged-mining legs (evr/krx/mewc/qtu/prl…), vardiff, per-job share-target validace, L1 RPC failover na followery (9445→9446/9447) s last-good stickiness. API hardening (28. 10.): read-payload snapshot cache (`api-snapshot` thread, `/stats`+`/metrics`+`/public/v1/coins` mimo `pool` mutex), in-flight permit cap 64 se shed→503, bounded drain flush (žádný SIGKILL exit), watchdog restartuje wedged API (HTTP-fail citlivý probe).
- **zion-miner** — one-click GPU autodetect (CUDA/OpenCL/Metal), `native-all` hashery, public „Boost" branding build.
- Follower architektura: node2/node3 servírují `getTemplate` — pool přežije výpadek primary.

### L2 — value & governance

- **multichain/warpd** — bridge engine s fail-closed money paths (7 interních audit vln 25.–26. 10.): fabricated-deposit rejection, quorum bypass fix, double-mint okna uzavřena, atomic withdraw+journal, replay dedup na `burn_id`.
- **dao** — quadratic voting, NCL grant rounds (live kolo s 6 granty).
- **NCL daemon :8098** — grant pipeline.
- **QTC treasury** — deficit známý, payouty deferred (viz Known issues).

### L3 — AI

- **ai-native :8001 + Maestro v2.4** — `/v2/info`, `/v2/health-matrix`, `/v2/plan`, `/v2/orchestrate` (intent→DAG, mutace za `requires_approval` gate — vypnuté), BM25 RAG (39 docs/138 chunků), konstituční prompt; **append-only audit JSONL** `/opt/zion/data/l3-audit/` (28. 10.: systemd `ReadWritePaths` fix — sandbox jinak audit tiše zabíjel).
- **Hiran inference** — primární GPU host + CPU fallback na EDGE2 (vše za human gate).

### L4 — OASIS

- **oasis :8094 + OasisWeb** — 3D preview, world registry; pixel streaming = výslovně mimo scope (horizon).

### L5/L6 — grantové fondy

- **free-world :8095** — humanitární tithe tracker; scanner na chain tipu (opraveno 26. 10. — P0-1).
- **issobella :8097** — space fund tracker.
- QV grant disbursal za human-approval gate.

### Identita

- **ZIS** — EdDSA/Ed25519 JWT, JWKS, DB-backed ceremonies (WebAuthn/challenges/audit), dual-instance EDGE+EDGE2, `/metrics` + Prometheus alerting; Passkeys E2E.

### Provoz

- **Dvouboxová produkce:** EDGE2 (primary + web ingress nginx :80/:443, všech 7 L1–L6+app služeb) / EDGE (pool, followeři, dashboard, Grafana/Prometheus, watchdogy); SSH tunely oběma směry.
- **Monitoring:** G8 probe na obou boxech, write-path probe (L5/L6 scanner lag, db-sync PG auth — lekce P0-1/P0-2, payout-sweep freshness `zion_pool_last_payout_age_seconds` + alert `ZionPoolPayoutStale` >1 h), 18 veřejných endpointů 200; Alertmanager → g8-alert-sink (firing+resolved ověřeno 28. 10., append-only evidence `REPORT_2026-10-28_G8_ALERT_SINK.md`).
- **Deploy provenance:** `scripts/ops/deploy-provenance.sh` + baseline manifest `docs/3.2/DEPLOY-PROVENANCE*` — sha256/mtime/verze/checkout stav nasazených binárek na obou boxech; pool `/health` nese build ID (`6fae7b60d2b5-dirty`, od buildu 28. 10.).
- **Payout recovery (28. 10.):** fix `defdcd84a` deployed — under-fee'd payout batch (10 % cap < network min) → requeue místo doomed broadcastu; schema v11 `superseded_tx_id` + `void_payout_rows()` (evidence zachována, `total_paid` rollback); sweep **resurrectuje** mrtvé tx po UTXO/chain absence-proof + age threshold (`ZION_PAYOUT_STUCK_AGE_SECS`, 7 d). Backlog 1 180 → klesá live; voided rows requeued = žádný double-pay.
- **Payout treasury:** sjednoceno na canonical `pool_payout` wallet `zion1d2k…` (~187k ZION) na EDGE i EDGE2 standby.
- **Ops hardening:** EDGE fail2ban whitelist `+207.180.217.100 +62.171.141.136` (EDGE2/self se bannoval při scanner nárazu — recurring sshd refusal fix).
- **G8:** 30d continuous-run gate — run #5 pending (aktuálně 99.75 % bez kritického incidentu).

## Safety holdy aktivní při vydání

`WARP_BTC_SWAP_ENABLED=0` · `PRL_PAYOUT_DRY_RUN=1` · `WARP_API_KEY` unset · `WARP_L1_RELEASE_KEYS` absent · QTC payouts deferred. Aktivace jen po externím auditu a rozhodnutí operátora.

## Upgrade z v3.1.x

Genesis chain je permanentní (2026-08-06 reset) — V3.x chain data se nepřenášejí. Klienti `v3.2.0-cli`, `v3.2.0-desktop`, `v3.2.0-miner` (2026-08-22+). `zion-cli deploy`/`update` pro node operátory. Viz `docs/3.2/` pro migration playbook.

## Known issues (viz `DEFERRED_3.2.md`)

- On-chain `protocol_version` hlásí `3.1.0-alpha` (kosmetická divergence vs node 3.2.0).
- Pool stale-rate ~15–21 % = interní same-height racy, 0 externích ztrát (RCA 26. 10.).
- npm advisories ve web apps (next-critical v 7/9 appkách) — triáž `docs/3.2/AUDIT-TRIAGE.md`: fixy major-only; MarketPlace `next/image` off (Image-Opt RCE mimo hru), Server Actions unused; upgrade před Stable.
- cargo audit: 9 vuln major-only — pouze `zion-multichain` + k256 chain, pool/node money path čistá (viz `AUDIT-TRIAGE.md`).
- PRL/QTC payout paths drženy vypnuté; QTU attestation dokazuje jen ZION-key.
- Payout backlog: recovery běží (28. 10. `defdcd84a` — 1 180 → klesá; voided rows = evidence). Zbývá QTC deferred ~918 = 👤 treasury funding, viz `Zionb2b.md` §5.
- Maestro mutace vypnuté (`mutations_enabled=false`); auditované pouze read-only orchestrace.

## Ověření (pin `ad8ab5895`, 26. 10.)

Rust workspace 2 839 testů PASS · Foundry 48/48 · ZIS 46/46 · `cargo check` clean · clippy 0 errors.

## Credits / provenance

Build manifest: `docs/3.2/REPORTS/PROVENANCE-2026-10-26.md` (regeneruje se na RC commitu). Interní audit: `AUDIT-REPORT.md` + REPORTS vlna 1–7.
