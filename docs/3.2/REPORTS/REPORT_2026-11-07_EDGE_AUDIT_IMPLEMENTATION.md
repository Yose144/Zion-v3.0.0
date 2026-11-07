# Implementace autonomní fronty z auditu EDGE1/EDGE2 — 2026-11-07

> **Stav:** kód a testy v izolované větvi `fix/edge-audit-autonomous-20261107`; **nic z toho není nasazené** v produkci. Žádný restart služeb, deploy, DNS změna, výplata, změna klíčů ani zásah do G8 run #7.
> **Nadřazený audit a fronta:** [`REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md`](REPORT_2026-11-07_EDGE_AUDIT_AUTONOMOUS.md) (P1: PII objednávek, monitoring, sklad, release verifier).

## 1. Co je hotové

### 1.1 Objednávky — soukromí a atomický sklad (`apps/MarketPlace`)

- **Veřejná odpověď je nově explicitní DTO**, ne kopie Prisma řádku. Čerstvá objednávka i replay vrací jen `{id, orderId, status, totalCzk, createdAt}` (+ `bank`/`zion` platební údaje). Jméno, e-mail, telefon, adresa, poznámka, peněženka, seed a podpis se nevrací nikdy.
- **Opakované `orderId`** projde jen se shodným e-mailem (case/whitespace-insensitive, konstantní čas) a i při shodě dostane jen veřejný stav. Neshoda = **409 bez jediného pole zákazníka**. Shoda e-mailu je jen omezení replaye — **není to autentizace**; trvalý capability token je odložená práce.
- **Sekvenční replay nesmí mít vedlejší efekty:** nevytváří peněženku, fakturu ani e-maily, nerezervuje sklad a nepřepisuje platební očekávání. U ZION retry se používá **persistovaný vault/částka** z `loadExpectation`, ne dnešní kurz ani env; QR se generuje z uložených hodnot. Bankovní QR se generuje z `order.totalCzk`, ne z klientského vstupu.
- **Množství:** každý řádek musí být celé číslo 1–99; dva řádky stejného produktu se sčítají do jednoho nároku a součet nesmí překročit 99. Neplatné/desetinné/stringové hodnoty = **400 bez side efektů**.
- **Sklad:** rezervace probíhá uvnitř jedné transakce jako podmíněný `updateMany` (`stock >= qty`, `active`, `inStock`) v deterministickém pořadí; `count !== 1` transakci vrátí. Objednávka se zakládá **první** (unikátní `orderId`), takže prohraný souběh nerezervuje sklad; vyprodaný řádek dostane `inStock:false` ve stejném zápisu. Tím mizí „dva řádky po jednom kuse proti poslednímu kusu“.
- **Souběh:** `P2002` na `orderId` se čte jako vítězná objednávka a vrací stejný veřejný replay (nebo generický 409); nevzniká druhý e-mail, faktura ani stock pohyb.
- **Veřejný `GET /api/shop/orders/[orderId]`** už nečte ani nevrací PII, HTML faktury, položky, dopravu, sledování ani ZAP pass kód. Vrací jen stav/potvrzení a `Cache-Control: no-store`. Doručení dokladu a pass zůstává e-mailem kupujícímu. `order-success` stránka už pass nezobrazuje.
- **Bezpečnostní prohlášení u svíčkového zboží** zůstává server-side: bez `accepted` + podpisu není objednávka; ukládá se jméno, čas serveru a verze textu, ale podpis se nikdy nevrací klientovi.

### 1.2 Payout monitoring — čitelný kontrakt místo `ts:null`

- `/public/v1/payouts` nově podporuje `source=recorded`; neznámý `source` je **400**. Ve výchozím feedu zůstávají queued položky s `ts:null` (čas se nevymýšlí).
- `latest_recorded_ts` je nejnovější **skutečně zapsaný** ledger timestamp, nebo `null` pro prázdný ledger; queued řádek ho nesmí přepsat ani vyplnit limit.
- Filtr mince je nyní **v SQL před `LIMIT`** (`query_payouts_for_coin`, index `(coin, ts)`), takže novější jiné mince nemohou schovat poslední ZION zápis. Chyba DB čtení je **503** s `ok:false`, ne úspěšný prázdný seznam; interní chyba se nepropouští do odpovědi.
- Sonda `zion-writepath-probe.py` čte recorded endpoint a rozlišuje **HTTP dostupnost** (`zion_pool_payouts_api_ok`) od **platnosti měření** (`zion_pool_payout_measurement_ok`). Neplatný/null/budoucí timestamp nedá nulu ani `now()`; stáří se v takovém případě neemituje. Přibyl `zion_writepath_probe_success_timestamp_seconds` pro detekci zastaralého zeleného textfile. PG timeout je ohraničený a ostatní sondy se publikují.
- Pravidla: `ZionPoolPayoutStale` (> 1 h), `ZionPoolPayoutMeasurementMissing` (nula **i absence**), `ZionWritepathProbeStale` (starý textfile i chybějící completion). Host pravidla: `ZionHostMetricsMissing` pro chybějící/down `edge1|edge2` a `ZionHostMemoryLow` s `job="node"`.
- `node-hosts-scrape.yml` zavádí **jeden `node` job** s explicitními instancemi `edge1`/`edge2`, aby se hosty neslily do jednoho `localhost:9100`. Nová absence pravidla proto **vyžadují tento job/label** — samostatný deploy pravidel proti starému `edge2` jobu by alertoval falešně.
- Rollout runbook: [`V31/deploy/monitoring/EDGE-AUDIT-ROLLOUT.md`](../../../V31/deploy/monitoring/EDGE-AUDIT-ROLLOUT.md). Pořadí: pool read-API → sonda → scrape job → pravidla → (se souhlasem) start EDGE1 exporteru. Bez restartu poolu/nodů pro host/probe/rules část.

### 1.3 Release artefakty — žádné falešné PASS

- Builder odmítá `--from-commit` ≠ HEAD, pokud explicitně nezvolíš `--isolate` (archiv pinned commitu); `--isolate` má nový cílový adresář, výstup přežije úklid dočasného zdroje a BUILD-INFO nese správný commit/clean stav. Necommitnuté změny se počítají jako dirty.
- Cargo selhání se propaguje (`|| return $?`), takže se nezabalí zastaralá binárka z cache. Chybějící/neúplná sada binárek balení zastaví. Mapování `zion-multichain → warpd` opraveno, BUILD-INFO se sám nechecksumuje a macOS metadata se do taru nepřidávají.
- Verifier je striktní a offline: kompletní `RELEASE-MATRIX.json` (verze, commit, packages, všechny target/varianty), shoda jmen s cílem, hash a velikost archivu i binárek, executable bit (mimo Windows), clean provenance, žádné duplicitní/nebezpečné tar členy ani odkazy. **Prázdný `SHA256SUMS`, chybějící matice i částečný matrix už neprojdou.**

## 2. Ověření (lokální, bez produkce)

| Oblast | Důkaz |
|---|---|
| Objednávky — čisté funkce | `node apps/MarketPlace/e2e/order-guard.mjs` → **14/14**; `order-stock.mjs` → 8/8; `fire-consent.mjs` → 15/15 |
| Objednávky — skutečné handlery | `node apps/MarketPlace/e2e/order-handlers.mjs` → **18/18** (skutečné `NextRequest`/`NextResponse` + reálné ceny, QR, consent a stock guards; Prisma/peněženka/faktura/e-maily/rate-limit/platební modul jsou fail-closed mocky; žádná DB, síť ani reálné e-maily) |
| Typecheck | `tsc --noEmit` pro `apps/MarketPlace` **bez chyb** (app-local `node_modules` symlink na existující závislosti; žádná instalace) |
| Pool API/store | `cargo test -p zion-pool --lib -- --test-threads=1` → **439 prošlo, 1 selhal**; nové testy pro sparse coin filtr a DB chybu prošly |
| Sonda | `python3 -m unittest discover -s V31/deploy/monitoring -p 'test_writepath_probe.py'` → **9/9** |
| Prometheus | Na EDGE1 (read-only, dočasný adresář, hned uklizen): `promtool check rules` 2+14 pravidel **SUCCESS**, `promtool check config node-hosts-scrape.yml` **SUCCESS**, `promtool test rules edge-audit.rules.test.yml` **SUCCESS** |
| Release verifier | `python3 -m unittest scripts/ops/test_release_artifacts.py` → **16/16**; `bash scripts/ops/test-release-verify.sh` → **PASS** (empty/missing/bad, cizí commit, pinned isolate, selhané Cargo bez stale cache, úspěšný mock build 2 targetů, částečná sada binárek, dirty tree, existující isolate cíl) |

**Známá, již existující chyba:** `stratum::tests::pearl_stratum_end_to_end` selhává na `mining.notify arrives: Elapsed(())` i na **čistém HEAD** (ověřeno dočasným checkoutem `api.rs`/`store.rs` a návratem). Nesouvisí s touto dávkou; v tomto prostředí je to timing/fixture problém Pearl stratum testu.

## 3. Meze a co zůstává na operátorovi

- **Nic není nasazené.** Pořadí rollout: nejdřív pool API kompatibilní s novou sondou, pak sonda, scrape job, pravidla. Starý pool bez `latest_recorded_ts` je s novou sondou **nekompatibilní** — measurement alert bude (správně) firingovat.
- Souběh objednávek je testován **serializovanou snapshot transakcí**, ne skutečným PostgreSQL MVCC. Ruční ověření proti produkční DB by vyžadovalo schválený testovací účet a reálnou objednávku — neprovedeno.
- Capability token pro pozdější dohledání objednávky je odložený; e-mail zůstává doručovací kanál. Zákazník bez e-mailu nemá alternativní self-service cestu.
- EDGE1 node-exporter zůstává **inactive**; jeho spuštění je operátorská akce. Dashboardy/alerty napojené na staré `node`/`node_exporter` selektory je třeba při merge scrape jobu zkontrolovat.
- Release build žádného reálného targetu neproběhl (jen mock Cargo); podepsaný tag, publikace ani clean-room stažení nejsou součástí.
- G8 run #7 se neměnil. **QTC payout OFF, PRL dry-run, BTC swap OFF.**

## 4. Změněné soubory

- `apps/MarketPlace/src/app/api/shop/orders/route.ts`, `.../[orderId]/route.ts`, `src/lib/shop-order-guard.ts`, `src/lib/shop-api.ts`, `src/app/order-success/page.tsx`
- `apps/MarketPlace/e2e/order-guard.mjs`, `order-handlers.mjs`
- `V31/L1/pool/src/api.rs`, `src/store.rs`
- `V31/deploy/monitoring/zion-writepath-probe.py`, `zion_writepath.rules.yml`, `zion-host.rules.yml`, `node-hosts-scrape.yml`, `test_writepath_probe.py`, `edge-audit.rules.test.yml`, `EDGE-AUDIT-ROLLOUT.md`
- `scripts/ops/build-release-artifacts.sh`, `verify-release-artifacts.py`, `test_release_artifacts.py`, `test-release-verify.sh`
- Dokumentace: tento report, `docs/3.2/StatusV3.md`, `docs/3.2/ROADMAP.md`, `docs/3.3/NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md` (korekce G8 #7 už z auditu).
