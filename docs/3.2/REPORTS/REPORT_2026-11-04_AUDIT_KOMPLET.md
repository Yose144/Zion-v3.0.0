# Kompletní kontrola — app, web, EDGE1, EDGE2, dashboard, kód vs dokumentace

**Datum:** 2026-11-04 · **Rozsah:** živé povrchy, oba hosty, kód (types + testy),
`docs/3.2`/`docs/3.3` vs realita · **Stav:** nálezy opraveny, dva blokované
externím vstupem (DNS, treasury) předány 👤.

## 1. Metoda

Prošel jsem **živé povrchy** (`curl` + HTTP hlavičky + TLS expiry), **oba
hosty** (`systemctl`, `nginx -T`, `journalctl`, SQLite, RPC), **kód**
(`tsc --noEmit`, build + testy `apps/nirvana-net`) a porovnal to s
dokumentací (`StatusV3.md`, `AGENTS.md`, `docs/3.2/REPORTS`, `infra/nginx`).

## 2. Živý stav (2026-11-04 ~07:40 CET)

| Povrch | Stav |
|---|---|
| `zionterranova.com` (Intro) | 200, build 07:02, vánoční promo nasazené |
| `app.zionterranova.com` | 200; `/explorer` `/dao` `/wallet` `/market` `/pool` 200; `/shop` 308 → market |
| `market.zionterranova.com` | 200 `healthy` (DB 7 ms); `/vanoce/zion-pass`, `/vanoce/kniha-kralovstvi-srdce`, `/vanoce/lampion` 200 |
| `nirvana.zionterranova.com` | `/` 200, `/net/health` 200 (`proto 26`), `/api/health` 200 |
| `pool.`, `oasis.`, `freeworld.`, `rpc.`, `auth.` (JWKS) | 200 |
| `dashboard.` | 401 (Basic Auth, očekávané) |
| `kingdom.` | 503 (plánovaná maintenance) |
| `api.`, `dex.`, `updates.`, `mining.`, `testnet.`, `newearth.cz` | `000` — viz §5 |

**Hosté:** EDGE1 14 běžících `zion-*`, EDGE2 24, **0 failed** na obou.
Chain: primary **109 006**, followeři 109 005/109 006, 3 peers, `3.2.0`.
Pool: 8 189 shares / **100 % accept** / 107 minerů s unpaid / 11 auxpow coinů.
DR standby: integrity `ok`, schema **v13**, sync 07:27 (RPO ≤ 15 min).
Disky: EDGE1 69 % (backups 20 G, dřív 42 G), EDGE2 59 %.
Certy: nejbližší `app.` 27. 12. 2026, `auth.` 24. 1. 2027.

## 3. Co bylo rozbité a je opravené

| # | Nález | Oprava |
|---|---|---|
| 1 | **EDGE2: 6 `.bak` konfigurací v `/etc/nginx/sites-enabled/`** → `nginx -t` 8× „conflicting server name", apex definován 10× | přesunuto do `/etc/nginx/backups/sites-enabled-removed-<ts>/`, `nginx -t` + reload, warnings pryč |
| 2 | **`/api/health` za ZAP bránou** (307 místo JSON) — endpoint pro monitoring byl nedostupný zvenčí | `/api/health` v `PUBLIC_PREFIXES` (`src/middleware.ts`) + kontrola v deploy smoke checku; nasazeno, live 200 |
| 3 | **`apps/website-v2.9` tsc: 11 chyb** ve 4 souborech | duplicitní `@types/react` (root 19.3.0 vs lokální 19.2.17) sjednoceno na jednu kopii; `src/types/styled-jsx.d.ts` pro `<style jsx>`; lock upraven; **0 chyb** |
| 4 | **`StatusV3.md` 3 dny pozadu** (proto 2, maintenance 503 na apexu) | nový update blok 2026-11-04 (proto 26, ZAP brána, MOBA/Saturn/tanky, e-shop, G8, payout backlog) |
| 5 | **`AGENTS.md` a report z 1. 11. tvrdily, že `/park` je „mimo ZAP pass"** | opraveno v novém záznamu `AGENTS.md`; ZAP brána je od 5. 11. na celé aplikaci |
| 6 | **G8 incidenty 2. 11. (120 s) a 3. 11. (180 s) nebyly v žádném reportu** | zapsáno níže §4 |
| 7 | **Repo vs. live nginx:** `infra/nginx/edge2/updates.zionterranova.com.conf` v repu, live smazán | conf odstraněn z repa (👤 rozhodl `updates.` zrušit) |
| 8 | **`apps/MarketPlace/AGENTS.md`** = auto-generovaný `next dev` soubor v necommitnutém stavu | přidán do `.gitignore` |
| 9 | **`apex-shot.mjs`** = scratch skript v rootu repa | přesunut do `.artifacts/probe/` (ignorováno) |

## 4. G8 run #6 — rozpočet do 28. 11.

| | |
|---|---|
| Run | `g8-20261029T234617Z`, cíl **2026-11-28 23:46 UTC** |
| Uptime | **99,7504 %** (gate ≥ 99,9 %) |
| Incidenty | **10**, celkem **1 140 s** |
| Povoleno pro 99,9 % | 2 592 s → **zbývá ~1 442 s (24 min)** |

Dosud nezapsané incidenty:

| Kdy (UTC) | Trvání | Služby |
|---|---|---|
| 2026-11-02 19:49 | 120 s | `chain_live` |
| 2026-11-03 04:33 | 60 s | `pool_http` |
| 2026-11-03 15:25 | 180 s | `pool_http`, `pool_stratum` |

Zbylých ~24 min znamená, že **jeden kritický incident ≥ 900 s gate položí**.
Do 28. 11. se nevyplatí plánovat restarty poolu bez drainu.

## 5. Otevřené — blokováno externím vstupem (👤)

1. **DNS `api.` a `dex.`** — 👤 31. 10. rozhodl publikovat. Stav zjištěný
   sondou: vhosty na EDGE2 **jsou**, ale jen na `listen 80` (bez TLS);
   certy pro `api.`/`dex.` na EDGE2 **neexistují** (`/etc/letsencrypt/live/`
   je neobsahuje), zatímco repo verze confů už 443 bloky s certy mají.
   DNS (`ns1.webglobe.cz`, `ns2.webglobe.cz`, `ns3.webglobe.com`) posílá
   oba názvy na **EDGE1** (`62.171.141.136`) → TLS SAN mismatch, `curl` = `000`.

   Pořadí, jinak HTTPS neprojde:
   1. přepnout A záznamy `api.` a `dex.` na `207.180.217.100`,
   2. na EDGE2 vystavit certy (`certbot` HTTP-01 přes webroot),
   3. doplnit 443 bloky z `infra/nginx/edge2/*.conf` a `systemctl reload nginx`.
2. **DNS `updates.`** — rozhodnuto smazat, pořád se resolvuje na EDGE1.
3. **`mining.` `testnet.` `newearth.cz`** — DNS na EDGE1, ale bez odpovědi
   (`000`); buď dořešit, nebo smazat (stejná třída jako `updates.`).
4. **Payout backlog** — 783 unconfirmed = **899 903 ZION**, nejstarší
   **2026-08-07**, 692 superseded. Sweep běží (poslední payout < 1 min),
   ale legacy ocas zůstává; rozhodnutí o doplacení/odpisu je treasury věc.
5. **Quantus external payouts pending = 11 393** (docs uváděly ~918) — roste.

## 5b. Co zůstalo jako (neškodné) varování

`nginx -t` na EDGE2 stále hlásí `protocol options redefined for …:443`
(u `kingdom.` a `market.`). To je důsledek `listen 443 ssl http2` ve více
server blocích pro stejnou adresu — nginx to jen varuje, nic se nepřepisuje
(na rozdíl od `conflicting server name`, které shadowuje celý vhost).
Oprava by znamenala sáhnout do všech vhostů; vědomě neděláno.


## 6. Meze této kontroly

- Dashboard je za Basic Auth — obsah `/api/ops/*` jsem neviděl, ověřeno jen
  že služba žije a vrací 401 (ne 5xx) a že `vastctl-*` unity běží.
- Testy `apps/nirvana-net` běžely **lokálně** proti lokální instanci, ne proti
  produkci (produkce ověřena jen `/net/health` + WS handshake v minulých dnech).
- Obsah 40+ knih v `canon/` a textace e-shopu nebyly předmětem kontroly.
- Reálný telefon pro mobilní ovládání chybí (headless emulace) — beze změny.
