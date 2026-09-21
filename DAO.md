# ZION DAO — Governance, Treasury & Guardian Multisig

> **Stav:** ŽIVÉ na produkci (Edge `62.171.141.136`), služba `zion-v31-dao`, API `127.0.0.1:8456`, veřejný proxy prefix `https://app.zionterranova.com/api/dao`.
> **Kód:** `V31/L2/dao` (Rust, axum, rusqlite/SQLite, tokio). UI: `APP&WEB/website-v2.9/src/app/dao/page.tsx`.
> **Verze:** `zion-dao 3.1.0-alpha` · **Poslední velký update:** 2026-09-21 (lifecycle fix + rozšířené API + nové DAO UI).
> **Kanonický provozní stav:** vždy ověřit proti `StatusV3.md` a live API — dokumentace nesmí být napřed před realitou.

---

## 1. Co DAO dělá

DAO řídí **treasury** (1.5 mld. ZION z genesis premine slotů 7+8), **governance návrhy** (parametry, treasury výdaje, granty, humanitární a emergency akce) a **guardian multisig** (5-of-7) pro všechny výdaje. Identitu a hlasovací sílu řeší **ZIS** (`zion_session` cookie) + L1 balance ve snapshot bloku návrhu — klient nikdy neposílá váhu hlasu.

```
Browser /app/dao ──► Next.js proxy /api/dao/* ──► zion-dao (127.0.0.1:8456)
                        │                            │
                        │ zion_session / X-DAO-Key   ├── SQLite dao.db (návrhy, hlasy, sigy)
                        ▼                            ├── L1 scanner (DAO mema → on-chain hlasy)
                   ZIS /api/auth/me                  └── L1 RPC 127.0.0.1:9445 (UTXO → treasury)
                   (identita → zion-l1 adresa)
```

---

## 2. Produkční parametry (live, ze `/api/dao/stats`)

| Parametr | Hodnota | Poznámka |
|---|---|---|
| Quorum | **15 %** | `quorum_percent` — podíl circulating supply, který musí hlasovat |
| Voting period | **14 dní** | `voting_period_days` |
| Timelock | **72 h** | `timelock_hours` mezi Passed a Executed |
| Proposal threshold | **10 000 000 ZION** | min. zůstatek proposera ve snapshot bloku |
| Min. váha hlasu | **1 ZION** | `min_vote_weight` (1 000 000 flowers) |
| Multisig | **5-of-7** | guardian podpisy pro treasury výdaje |
| Denní spend limit | **50 000 000 ZION** | `daily_spend_limit_zion` |
| Circulating supply | 4 000 000 000 ZION | pro výpočet kvóra |
| Treasury | 1 500 000 000 ZION | live L1 UTXO součet, ne konstanta |

Jednotky: **1 ZION = 1 000 000 flowers** (6 desetinných míst). API vrací flowers jako čísla/stringy — frontend je vždy převádí na ZION pro zobrazení.

**Config:** `/etc/zion/dao-mainnet.toml` (načítáno přes `DAO_CONFIG` env ve systemd unitu). Hodnoty `quorum_percent`, `voting_period_days`, `proposal_threshold`, `timelock_hours` jsou od 2026-09-21 napojené do `/stats` — config je nyní source of truth pro UI. `l1_rpc_url` se přebíjí přes `DAO_L1_RPC=127.0.0.1:9445`, port přes `DAO_API_PORT=8456`.

---

## 3. API referencia

Vše pod `/api/dao`. Odpověď je obálka `{ "success": bool, "data": … }`.

### Veřejné GET (přes Next.js proxy, bez auth)

| Endpoint | Popis |
|---|---|
| `GET /api/dao/health` | `{service, status:"ok", version}` |
| `GET /api/dao/stats` | kompletní governance metriky (viz §2 + `active`, `awaiting_tally`, `passed`, `executed`, `failed`, `total_votes_cast`, `unique_voters`, `guardian_count`) |
| `GET /api/dao/proposals?status=&proposal_type=&limit=&offset=` | seznam návrhů, newest-first, cap 200 |
| `GET /api/dao/proposals/:id` | detail návrhu vč. `is_voting_open`, `has_passed`, `snapshot_block` |
| `GET /api/dao/proposals/:id/votes` | `{votes: [{voter, choice, weight, tx_hash, voted_at}]}` |
| `GET /api/dao/treasury` | přehled treasury (UTXO součet, multisig, limity, pending ops) |
| `GET /api/dao/treasury/ops?status=` | multisig operace: `{op_id, proposal_id, operation, status, signatures[], signature_count, threshold, amount_*}` |
| `GET /metrics` | Prometheus text |

### Mutace — auth: `zion_session` cookie **nebo** `X-DAO-Key` (operator)

| Endpoint | Body | Poznámka |
|---|---|---|
| `POST /api/dao/proposals` | `{proposer, title, description, proposal_type:{kind,data}}` | ZIS cesta: identita+balance se resolvují server-side; `proposer_balance`/`snapshot_block` klient neposílá |
| `POST /api/dao/proposals/:id/vote` | `{voter, choice:"yes"|"no"|"abstain", weight}` | váha se u session cesty počítá z L1 balance ve `snapshot_block` |
| `POST /api/dao/proposals/:id/tally` | — | ruční sčítání (operator); jinak běží automaticky |
| `POST /api/dao/proposals/:id/execute` | — | po Passed + timelock |
| `POST /api/dao/proposals/:id/cancel` | — | proposer/operator |
| `POST /api/dao/treasury/submit` | `{operation, proposal_id, …}` | vytvoří multisig op (vyžaduje Passed návrh) |
| `POST /api/dao/treasury/:op_id/sign` | `{signer, signature}` | guardian podpis |
| `POST /api/dao/treasury/:op_id/execute` | — | po dosažení threshold |

### `proposal_type` — tagged union `{kind, data}`

```jsonc
{"kind":"Parameter",    "data":{"parameter_name":"…","current_value":"…","proposed_value":"…"}}
{"kind":"Treasury",     "data":{"recipient":"zion1…","amount":<flowers>,"purpose":"…"}}
{"kind":"Grant",        "data":{"recipient":"zion1…","amount":<flowers>,"milestones":[],"duration_days":30}}
{"kind":"Humanitarian", "data":{"category":"…","amount":<flowers>,"region":"…","description":"…"}}
{"kind":"Emergency",    "data":{"action":"…","justification":"…"}}
```

### Životní cyklus návrhu

```
Draft → Active ──(voting period)──► Passed ──(timelock 72h)──► Executed
            │                         │
            └── 0 votes / < quorum ──► Failed        └──(treasury op → multisig)
```

- **`is_voting_open`** = `status == Active && now < voting_ends_at` — jediná správná podmínka pro zobrazení vote tlačítek.
- **Awaiting tally** = `Active && !is_voting_open` — UI stav „čeká na sčítání". Backend od 2026-09-21 sčítá automaticky: periodický task v `main.rs` volá `runtime.process_expired()` každých `scan_interval_secs` (min 15 s) → expirované návrhy se samy přehodí na Passed/Failed.
- **`has_passed`** = kvórum + většina for.
- On-chain hlasy: L1 scanner parsuje `DAO` mema (`zion:vote:...`) z transakcí a cpaluje je do runtime — off-chain DB i on-chain hlasování sdílí stejný engine.

---

## 4. Frontend (`/dao`)

| Soubor | Role |
|---|---|
| `src/app/dao/page.tsx` | stránka — 4 taby (Návrhy / Treasury / Guardians / Roadmap), create modal s 5 typy návrhů, filtry stavů |
| `src/lib/dao-api.ts` | typovaný klient — `getDAOHealth/Stats/TreasuryOverview/TreasuryOps/Proposals/ProposalVotes`, `createGovernanceProposal`, `castGovernanceVote` (mapuje for/against/abstain → yes/no/abstain) |
| `src/components/dao/ProposalCard.tsx` | karta návrhu — progress bary, ZION-formátované váhy, voter list (expandable), vote buttons gated na `is_voting_open` |
| `src/components/dao/DAOStats.tsx` | metriky |
| `src/app/api/dao/[...path]/route.ts` | Next.js proxy — GET public; non-GET jen s `zion_session` nebo `X-DAO-Key`; cookie forwarduje upstream |

### Chování UI (stav 2026-09-21)

- **Daemon badge** se řídí `getDAOHealth().status`, ne timeoutem celého loadu.
- **Stat karty**: treasury (live ZION), návrhy, aktivní (+awaiting tally sublabel), schválené, unikátní hlasující + celkem hlasů, bridge relay.
- **Filtry návrhů:** Vše / Hlasování / Čeká na sčítání / Schváleno / Exekutováno / Neúspěšné — „awaiting" je client-side odvozený stav.
- **Create modal:** výběr typu návrhu → podmíněná pole; threshold note ukazuje live `proposal_threshold` ze stats; proposer = ZIS-linkovaná `zion-l1` adresa (není editovatelné pole — identitu řeší backend).
- **Treasury tab:** live overview + **multisig operace** (op_id, typ, částka, status, `signature_count/threshold`).
- **Guardians tab:** `/api/guardians/stats` je úmyslný 501 stub → UI ukazuje „under development"; `GuardiansTreeClient` má dev fallback — **neprezentovat jako live registry**.

### Auth flow

`useAuth()` → `user.linkedAddresses[zion-l1]` → proposer/voter hint; skutečnou identitu a váhu řeší server. Bez session: GET čtení funguje, mutace vrací 401 („Sign in with ZIS…"). **Nikdy neposílat `ZION_DAO_API_KEY` z browseru** — ten zůstává operátorům.

---

## 5. Ostatní DAO povrchy

| Plocha | Stav |
|---|---|
| `mobile-app` | `DAOService.js` → `CONFIG.DAO.API_BASE = https://app.zionterranova.com/api/dao` (opraveno 2026-09-21; `zionterranova.com/api/dao` je nginx-allowlist = 403 pro uživatele). Read-only; write cesta zatím není napojená. |
| `ZION_OS/desktop` | `DaoPanel.tsx` + `api/dao.ts` — vlastní klient, zatím nesyncnutý s novými poli (pozor na status/flower sémantiku při dalším kole) |
| `/defi/dao` | redirect na `/multichain` (schválený stav) |
| `/dashboard/dao-tree` | vizualizační stránka, ne operativní UI |
| `ZION_OS/dashboard` (8766) | operátorský dashboard čte `dao.db` metriky (J6 „My Ecosystem") |
| `V3/` legacy DAO | historická implementace — **neměnit, nenasazovat** |

---

## 6. Operace (runbook)

```bash
# Edge SSH
ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@62.171.141.136

# Stav / logy / DB
systemctl status zion-v31-dao
journalctl -u zion-v31-dao -f
sqlite3 /opt/zion/data/dao.db 'SELECT id,title,status FROM proposals;'

# Build + deploy binárky (vždy NA Edge — glibc!)
rsync -az -e "ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222" V31/L2/dao/ root@62.171.141.136:/root/build/V31/L2/dao/
ssh … 'cd /root/build/V31 && /root/.cargo/bin/cargo build --release -p zion-dao'
ssh … 'cp /opt/zion/V31/target/release/zion-dao{,.bak-$(date +%Y%m%d)}; systemctl stop zion-v31-dao; cp /root/build/V31/target/release/zion-dao /opt/zion/V31/target/release/; systemctl start zion-v31-dao'

# Web deploy
cd APP&WEB/website-v2.9 && npm run build
rsync -az --delete -e "ssh -i … -p 2222" src .next public package.json next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts 'root@62.171.141.136:/opt/zion/APP&WEB/website-v2.9/'
ssh … 'chown -R zion:zion "/opt/zion/APP&WEB/website-v2.9"; systemctl restart zion-website'
curl -s -o /dev/null -w '%{http_code}' https://app.zionterranova.com/dao   # = 200
```

- **Testy:** `cargo test -p zion-dao` (78 pass), `npx tsc --noEmit` + `npm run build` ve webu.
- **Porty:** DAO `8456` (env `DAO_API_PORT`; `core-endpoints.ts` default sjednocen 2026-09-21). Nginx `/api/dao` → `127.0.0.1:8456`. Website env `ZION_DAO_API_URL=http://127.0.0.1:8456`.
- **Backup:** `dao.db` je v denním Edge archivu (DR drill F5 ověřen 2026-09-14).

---

## 7. Známé limity (stávající stav)

1. **Guardians registry není implementován** — `/api/guardians/stats` = 501 stub; guardian adresy žijí jen v configu.
2. **L5/L6 proposal bridge** — `dao_client.rs` ve free-world/issobella ukazuje defaultně na port 8080 (pool, ne DAO) → submit-to-dao flow je nesestavený.
3. **On-chain hlasování** přes `zion:vote:` mema umí scanner, ale UI konstrukci takové tx nenabízí.
4. **Desktop `DaoPanel`** má vlastní stale mapping.
5. **Konfigurovatelnost guardianů/parametrů** je částečná — multisig threshold a sada guardianů jsou v configu, ale rotace nemá governance flow.
6. **Žádná notifikace** při změně stavu návrhu (tally/timelock/execute) — jen polling.

---

## 8. Plán rozšíření — směr V3.3 „Nirvana" (full UI + backend)

Cílový stav: DAO je plně obsluhované z UI (web → mobile → desktop), lifecycle je kompletně on-chain auditable a L5/L6 fondy se řídí přes DAO návrhy. Z V3.3 plánu navazuje: **quadratic voting pro granty** (§6.1), **DAO záplaty navrhované Hiranyagarbha agentem** (§4.1), **ZK důkazy reputace** (§3.2), agent sub-účty s budgety (§3.2).

### Fáze D1 — UI/UX dorovnání (krátký horizont)

| Úkol | Soubor | Poznámka |
|---|---|---|
| Proposal detail stránka `/dao/[id]` | nový route | plný popis, timeline (voting→timelock→exec), voter tabulka, odhad kvóra progress bar (`total_votes / quorum_target`) |
| Kvórum progress na kartě | `ProposalCard.tsx` | „x % of 15% quorum" — data už jsou ve stats |
| Notifikace/refresh po vote+create | `page.tsx` | už se volá `loadDAOData()`; doplnit toast místo `alert()` |
| Treasury op detail + sign flow pro guardiany | `page.tsx` + nový `TreasuryOpCard` | sign je mutace přes ZIS — jen pro guardian adresy z configu (zobrazit whitelist) |
| Mobile DAO screen sync | `DAOService.js` + `DAOScreen.js` | mapovat nová pole (status/is_voting_open/flowers→ZION); read-only zatím OK |
| Desktop `DaoPanel` sync | `ZION_OS/desktop` | stejný mapping jako web |

### Fáze D2 — Backend governance rozšíření

| Úkol | Soubor | Poznámka |
|---|---|---|
| Guardian registry endpoint | `api.rs` + `db.rs` | `GET /api/dao/guardians` → skutečná tabulka (adresa, role, aktivní od, podpisy stats); nahradit 501 stub v `/api/guardians/stats` web route |
| Proposal events / audit log | `db.rs` | `proposal_events` tabulka (created/voted/tallied/executed + actor + tx_hash) → `GET /proposals/:id/events` |
| Quadratic voting pro granty | `voting.rs` | per-proposal-type voting scheme — `weight = sqrt(balance)` pro `Grant`/`Humanitarian`, lineární pro zbytek; flag v `ProposalTypeDto` |
| Vote delegation | `voting.rs` + `db.rs` | `delegations` tabulka (delegator→delegate, scope); váha = vlastní + delegovaná ve snapshot |
| L5/L6 submit-to-dao fix | `V31/L5|L6/*/dao_client.rs` | správný base URL 8456 + auth; grants/missions → `Humanitarian`/`Parameter` návrhy |
| On-chain vote UX | web + `l1_scanner.rs` | „vote by transaction" modal vygeneruje `zion:vote:<id>:<choice>` memo + deep link do wallet; scanner už ingestuje |
| Config-driven threshold registry | `config.rs` | `Parameter` návrh typu `dao.quorum` apod. → executor reálně přepíše runtime hodnoty (dnes jsou Parameter návrhy inertní) |

### Fáze D3 — Autonomie a integrace (V3.3 horizont)

| Úkol | Poznámka |
|---|---|
| Hiranyagarbha → DAO návrhy | L3 agent při detekci incidentu vytvoří `Emergency`/`Parameter` návrh přes dedikovaný agent sub-účet (ZIS Agent Keyring, capped budget) — vždy s human approval |
| ZK Dharma proofs | hlas/reputace ověřitelné bez odhalení zůstatku — napojit na ZIS proof endpointy |
| Notifikační pipeline | DAO event → notification service (Prisma `Notifications` už je ve shared schématu) → e-mail/push/in-app |
| Guardian rotace přes governance | `Parameter`/`Emergency` typ pro add/remove guardian → multisig re-key flow |

### Implementační poznámky

- Nové mainnet-track změny **vždy do `V31/`**, nikdy do `V3/`.
- Každá mutace musí respektovat: ZIS session **nebo** `X-DAO-Key`; client-supplied identity/weight se u session cesty ignoruje (backend resolvuje z L1 snapshot).
- Flowers jsou u64 — ve frontendu držet jako string/BigInt-safe, zobrazovat přes `/1e6` helper.
- Public copy pravidla z `website-v2.9/AGENTS.md` platí i pro DAO UI (žádné interní porty/názvy služeb v textech).
