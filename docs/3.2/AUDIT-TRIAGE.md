# Audit Triage — 2026-10-28 (B-EXIT-2 evidence)

Scope: `cargo audit` (V31 workspace, 645 pkg lock) + `npm audit` (apps/*).
Verdict: **žádný mechanický fix neexistuje** — všechny patch path jsou semver-major.
Pool/node money path (`zion-pool`, `zion-node`) není zasažen přímo mimo `crypto-bigint` přes `k256`.

## cargo audit — 9 vulnerabilities, 17 warnings

| Crate | Advisory | Dopad | Reachability | Fix |
|---|---|---|---|---|
| rustls 0.21.12 | RUSTSEC-2026-0346 (Debug impls leaktují TLS secrets), RUSTSEC-2026-0349 (ServerHello downgrade) | TLS vrstva | **zion-multichain only** (ethers → hyper-rustls/reqwest/tokio-tungstenite `rustls-tls` 0.21 feature) | major: přejít deps na rustls-0.23 feature set |
| rustls-webpki 0.101.7 | RUSTSEC-2026-0382 (distrusted intermediates) | cert verify | zion-multichain (přes rustls 0.21) | součást rustls-0.23 migrace |
| webpki-roots 0.25.4 | RUSTSEC-2026-0381 (emSign intermediates) | root trust | zion-multichain | součást migrace |
| zip 0.6.6 | RUSTSEC-2026-0367/0368/0369 (SUID bits, symlink escape, perms přes symlink) | extract arbitrary archivů | zion-multichain (svm-rs → ethers-solc build tooling) | major svm-rs/ethers-solc; alternativa: oddělit solc tooling z prod binárky |
| zstd-safe 5.0.2 | RUSTSEC-2026-0403 (uninit memory, legacy frames) | decompress | zstd chain | major zstd bump |
| crypto-bigint 0.5.5 | RUSTSEC-2026-0387 (timing variability v "constant-time" ops) | ECDSA signing timing | **k256 0.13.4 → zion-core, zion-l1-types, zion-miner, zion-multichain** | k256 major (crypto-bigint 0.6) |
| +17 warnings | unmaintained: fxhash, instant, … | — | různé | housekeeping |

### Rizikové zhodnocení

- **`zion-pool` / `zion-node`: čisté** — payout/consensus path tyto crate nelinkuje.
- **WARP/multichain:** real exposure, ale aktuálně drží safety holds (`WARP_BTC_SWAP_ENABLED=0`, L1 release keys unset) — outbound RPC TLS riziko je nízké, dokud holds drží.
- **crypto-bigint timing:** nejrelevantnější — k256 signuje (miner, multichain validators). Remote timing oracle je v praxi obtížný, ale před Stable doporučit k256 bump.
- **zip/svm-rs:** pouze contract-build tooling; riziko při extrakci nepřívěrohodných archivů (solc download chain). Prod binary zvážit build bez solc.

**Rozhodnutí:** žádný in-range patch neexistuje (`cargo update -p` → 0 změn pro všechny). Bump ethers/k256 stacku = samostatný task mimo RC okno → položka pro Stable gate, neblokuje Beta.

## npm audit — apps/* (2026-10-28)

| App | Critical | High | Moderate |
|---|---|---|---|
| MarketPlace | 1 | 35 | 18 |
| mobile-app | 3 | 24 | 20 |
| desktop-agent | 1 | 17 | 2 |
| zion-wallet-sdk | 1 | 8 | 1 |
| OasisWeb | 1 | 4 | 0 |
| IntroPage | 1 | 3 | 1 |
| pool-ui | 1 | 1 | 1 |
| identity | 0 | 1 | 4 |
| website-v2.9 | 0 | 1 | 4 |

### MarketPlace detail (B2B-kritická appka)

- `next 14.2.35` → **critical** přes ~25 advisories (Image Optimizer RCE GHSA-2xp9-vwfh-vxw4 / GHSA-2464-fhr4-w9xw, middleware bypass GHSA-36qx-fr4f-26g5, SSRF v Server Actions GHSA-89xv-2m56-2m9x, cache poisoning, DoS sada). Fix = **next 16.4.3** (semver-major, App Router/middleware migrace). `npm audit fix` = 0 změn.
- High: axios 1.0–1.19, nodemailer ≤10.1.3, ws ≤8.20.1, zod <4.6.6, js-yaml, nanoid, follow-redirects, postcss, glob, brace-expansion, @fastify/busboy, source-map-js, parse-duration — všechny fixy major.
- Pozn.: ~polovina Next advisories cílí featury, které MarketPlace nemusí používat (Image Optimizer, Server Actions, Edge runtime) — per-CVE feature-usage review sníží reálný exposure před migrací.

### MarketPlace feature-usage review (28.10)

Reálný exposure je užší než advisory count:

- **`next/image` se nikde nepoužívá** → aplikováno `images.unoptimized: true` (next.config.js) — `/_next/image` optimizer endpoint se vypne kompletně → RCE-in-Image-Optimization třída (GHSA-2xp9, GHSA-2464) mimo hru.
- **Žádné Server Actions** (`"use server"` 0×) → SSRF/cache-confusion v Server Actions neaplikovatelné.
- **`src/middleware.ts` existuje** (admin pre-filter + CORS na `/api/admin|shop|stripe`) — ale je to jen coarse pre-filter; autoritativní auth je v route handlers (`requireAdminAuth`, Node runtime) → middleware-bypass CVE (GHSA-36qx) admin surface neotevře. Middleware cache-poison/redirect CVEs zbývají relevantní → major upgrade stále potřeba.
- Zůstává: DoS sada (Server Components, rewrites smuggling), cache poisoning v RSC — opravuje až next 15/16.

### Doporučení npm

1. MarketPlace: před produkčním B2B launch naplánovat next 15/16 migraci; mezitím per-CVE review (Image Optimizer off? Server Actions použité?) + nginx/edge mitigace.
2. Ostatní Next.js appky (IntroPage, OasisWeb, pool-ui, zion-wallet-sdk): stejný `next` critical pattern — sdílená migrace.
3. mobile-app 3 critical — expo/RN stack, samostatná dávka.
4. Gate: triage DONE, upgrade = deliberate work s testováním — **neblokuje RC/Beta; povinné před Stable/veřejným B2B launch**.

## Clippy / fmt stav

- `cargo clippy -p zion-pool --all-targets`: 32 warnings v test targetech (style: `.len()>=1`, `assert!` na map contains apod.) — neblokující, cleanup dávka možná.
- `cargo fmt --check`: pre-existing diffs mimo payout soubory (node.rs aj.) — payout změny fmt-clean.
