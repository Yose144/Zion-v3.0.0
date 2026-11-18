# KNOWN-ISSUES — otevřené problémy a provozní pasti

> **Účel:** jedno místo pro *nevyřešené* chyby a *dlouhodobě platná* poučení, aby se nehledala
> v OPS-LOGu. Záznam = příznak → pravděpodobná příčina → co dělat. Když se problém vyřeší,
> položka se **nemaže** — přesune se dolů do „Vyřešené" s datem a commitem.
>
> **Vazba:** detail každého bodu je v reportu, na který odkazuje. Krátký provozní log: `docs/OPS-LOG.md`.

---

## Otevřené problémy

### 1. Pool `/stats` — api-snapshot občas uvízne na mutexu (2026-11-12, NEVYŘEŠENO — jen projev)

- **Příznak:** `GET /stats` → `503 {"ok":false,"error":"stats snapshot stale"}`, `snapshot_age_s` roste; `/health`, stratum i payouty jedou normálně. Po ~4 min se samo uvolní.
- **Příčina (známá část):** `build_stats_payload` bere `pool`/`pplns` mutex; když ho někdo drží, snapshot thread čeká. **Kdo ho drží — neznámo.**
- **Co dělat:** dashboard-only outage, pool netřeba restartovat. Při příštím výskytu: `gdb -p <pool-pid> -batch -ex "thread apply all bt"` na binárce **s debug symboly** (release je stripovaná → backtrace bez jmen) nebo build s `debug = 1`.
- **Detail:** `3.3.0/docs/reports/REPORT_2026-11-12_KOMPLETNI.md`.

### 2. Market produkční `ADMIN_API_KEY` = dev hodnota (2026-11-12, čeká na rotaci)

- `/etc/zion/market.env` na produkci obsahuje `ADMIN_API_KEY=zion-dev-admin-key` — admin routy jsou pod ní chráněné, ale je to veřejně známá hodnota z repa. **Rotovat** (money-path ⇒ 👤 sign-off).
- **Detail:** `3.3.0/docs/reports/REPORT_2026-11-12_KOMPLETNI.md`.

### 3. EDGE1 node2/node3 — slepý UTXO index (2026-11-12, čeká na reindex)

- `zion-v31-node-2/3` měly neúplný UTXO set (108/5 241 UTXO pro user wallet) při **stejné výšce** → web balance failover na „rychlý ale slepý" node.
- **Fix aplikován:** `ZION_NETWORK_NODES_JSON` zúženo na EDGE2 `:9445` jen. **Node NEVRACET do env**, dokud neproběhne reindex/resync (`--v3-no-genesis` follower sync historický UTXO set nedoplnil).
- ** Pozn.:** `native_utxo_cache` tabulka je na všech nodech identická — diverguje jen runtime sada.
- **Detail:** `docs/OPS-LOG.md` 2026-11-12 (4).

### 4. Contabo incident — nedohledatelné forenzní okno (2026-11-17, uzavřeno co šlo)

- EDGE1 `auth.log` začíná 14. 11. 05:23 CET (starší rotací pryč), journald od 16. 11. → přístup **před** oknem z guesta neověřitelný. Hypervisor-level (offline disk/RAM) = u Contabo IR.
- **Hotovo:** SSH session audit obou boxů čisté, root hesla rotována (`/root/SECURITY-2026-11-17-root-password.txt`, chmod 600). **Zbývá 👤:** Contabo panel (heslo, API tokeny, MFA, vázaný e-mail), jestli se heslo neopakuje na Hetzner boxech, phishing obezřetnost.
- **Detail:** `docs/3.2/REPORTS/REPORT_2026-11-17_CONTABO_INCIDENT.md`.

### 5. Kotva výšky 144 000 (`DAO_TREASURY_LOCK_HEIGHT`) — padá ~29. 11. 2026

- Uprostřed G8 okna (do 16. 12.). Postup: `docs/ops/PREMINE_144K_CHECKLIST.md` (v 3.3.0).

### 6. Market `/shop/downloads` — route zablokuje celý event loop (2026-11-18, doručení DOČASNĚ ZAVŘENÉ)

- **Příznak:** request na `/shop/downloads/<soubor>` (i neexistující jméno) zablokuje `next-server` — přestane odpovídat **všechno** (32 % CPU, stav `R`, `curl` timeout), pomůže jen `systemctl restart zion-marketplace`. Jakýkoli bot/skener na této cestě = outage marketu.
- **Příčina:** není došetřená; v logu je `Error: The Server Reference ID did not match the expected format` → podezření na rozbitý turbopack chunk v nasazeném buildu, ne na logiku route (`verifyDownloadRequest` vrací 401 korektně).
- **Aktuální stav (2026-11-18):** nginx `location /shop/downloads/` vrací **`return 401`** bez proxy, aby cesta nemohla shodit appku → **digitální doručení je zavřené** (zákazník s podepsaným odkazem ZIP nestáhne). Kanonický soubor zůstává `/opt/zion/data/downloads/`.
- **Co dělat:** opravit route (ideálně bez `@/data/shopProducts` + bez Prisma v cestě), přebuildovat, ověřit **na staging portu** (`curl :3100/shop/downloads/abc` → 404, `/api/health` stále 200), teprve pak v nginx vrátit `proxy_pass http://127.0.0.1:3100`.
- **Souvislost:** při zavírání leaku se ukázalo, že ZIP byl i v `apps/MarketPlace/public/shop/downloads/` → Next ho servíroval **staticky před** route handlerem. Deploy teď má `--exclude='/public/shop/downloads'`.

### 7. Čtyři veřejné hostname bez vhostu (2026-11-18, rozpor s branou KS-8)

- `onboard.`, `portal.`, `realtime.` mají DNS na **EDGE1**, ale aplikace běží na **EDGE2** (`:3030`, `:3002`, `:3011`) a vhost nikde → spojení neprojde (000).
- `ops.` má DNS na EDGE1, appka běží na `:3031` a vyžaduje `X-Ops-Auth` od nginxu (sama vrací 403) → bez vhostu nepoužitelné. Plánovaný hostname pro ops appku je `dashboard.zionterranova.com` (ten dnes obsluhuje starý Python dashboard `:8766`).
- **Brána `KS-8`** („0 mrtvých veřejných povrchů — buď 200, nebo DNS pryč") je tím **porušena**. Řešení: buď nasadit vhosty, nebo DNS záznamy smazat.
- **Pozn.:** `updates.zionterranova.com` je naopak **už živý** (401 `licence_required`), i když `3.3.0/CODE_VS_DOCS.md` (13. 11.) tvrdí „veřejně mrtvé".

### 8. Známé holds (záměrně vypnuté)

- `PRL_PAYOUT_DRY_RUN=1` — pool payouty v dry-run.
- `WARP_API_KEY` unset (pre-existing), `WARP_BTC_SWAP_ENABLED=0` — safety hold do externího auditu.
- SMOS rig 518837 offline → inference na operátorském PC + EDGE2 CPU fallback.
- EDGE cleanup ~62 GB starých dat — **NEMAZAT bez potvrzení** (po observačním období).
- Avatar 037 Gándhí — zůstává procedurální (dodavatel model odmítl).

> **Už NENÍ hold (rozhodnutí 👤 18. 11.):** QTC/PRL nativní payout je **zapnutý** — `ZION_POOL_NATIVE_PAYOUT_COINS="qtu,prl"`, `QTC_PAYOUT_ENABLED=1` (EDGE2), pearl upstream wallet = pool wallet `prl1pzy8…`. `treasury_free=0`, takže payouty jen `deferred`; před dosypáním treasury se reálně neodešle nic.

---

## Dlouhodobé pasti (poučení — nechyby, ale způsoby jak si ublížit)

| Past | Projev | Řešení / pravidlo |
|---|---|---|
| `systemd PrivateTmp=yes` + state v `/tmp` | watchdog counter se každým during resetoval → restart **nikdy** nenastal | persistent state do `/run/<unit>/` (opravлено u `zion-pool-api-fails`, `template-fails`) |
| systemd drop-in s shell-expandovanými hodnoty | `${ZION_MINER_*}` se expandovalo do prázdných hodnot → 955+ crash-loop | v drop-ins vždy runtime `${VAR}`, nikdy expandované hodnoty |
| `window.confirm/alert` v Electron rendereru | sync dialogy = no-op → mrtvá tlačítka | `dialog.showMessageBox` v main přes IPC |
| Next `output: standalone` + `@prisma/client-<hash>` | symlink zůstane s **absolutní mac cestou** → „Cannot find module" na serveru | deploy skript dereferencuje symlinky (~7 MB navíc) |
| GLB lodí nejsou v gitu (D-008) | build/deploy bez nich = chybějící modely | deploy je kopíruje z existující instalace |
| `getUtxos` na nodu bez `limit` | whole-set ~27 MB; součet kolísá kvůli **mempool-spent filtru** → vypadá jako divergence | porovnávat `total_count`/`total_amount` po uklidnění; `:9445` ukazuje míň UTXO (mempool) než followeři |
| Dva `next-server` na stejném portu | `SO_REUSEPORT` → starší instance servíruje starý build, nové soubory 404 | před auditem `lsof -ti :<port>` |
| Paralelní session + `git add -A` | chytí cizí necommitnuté soubory do commitu | před commitem `git diff --cached`, přidávat jen explicitní cesty |
| `prepare-rust-miner.js → cleanResources()` | smaže **tracked** binárky z `resources/` (32 MB) | nerunovat mining e2e bez V31 buildu; obnovit `git checkout -- resources/` |
| Dlouhá MPS/CPU dávka (avatar 3D) | swap 19/20 GB, load 45, disk 98 % → **25× zpomolení bez chyby** | hlídat `vm.swapusage` + `df`; `generate.py` je opakovatelný |
| `.artifacts` / `PUBLIC` symlinky | ukazují na `/Volumes/ZION-Storage` — když není mountnutý, batch padá/divně | zkontrolovat `ls /Volumes/ZION-Storage` před delší prací |
| `mv` s více argumenty | `mv a b c dir/` je v pořádku, ale `mvf a b c dir/` wrapper vzal jen první dva → **přepsal soubor** | smazat/obnovit z gitu; stěhovat soubory **jednotlivě** |
| macOS `rm` na cache běžící appky | Chrome/Spotify okamžitě tvoří soubory znovu; zbytek malý | čist cache appky, která **neběží** (Spotify cache = user-data-dir, nelézt) |
| `tmutil` lokální snapshoty | `rm` neviditelně drží místa — `df` se nehýbe | `tmutil thinlocalsnapshots / <GB> 4` (dzi 2026-11-17: 16→46 GiB) |

---

## Vyřešené (historie — nenechávat otevřené)

- **2026-11-17:** macOS disk 16→55 GiB — smazány Rust `target/`, `.next` cache, `node_modules`, package cache, staré CLI verze, kilo worktree; protrhány TM snapshoty.
- **2026-11-17:** apex zpět live — `sites-enabled` kopie `sites-available` (maintenance patch byl jen v enabled).
- **2026-11-12:** `getBlockByHeight` storage-lock → `get_output_owners` batch (12/12 ≤ 26 ms); EDGE1 node2/3 blind UTXO → env fix; realtime proto 3 live; ZIS 3.3 staging JWKS shodné.
- **2026-11-12:** desktop wallet — UTXO paging + `maxTxInputs` 100 KB cap + fragmentation error + Consolidate + nativní dialogy (backport do Kingdom).
- **2026-11-13:** `window.confirm` → `dialog.showMessageBox`; wallet e2e 9/9 proti živému nodu.
- **2026-11-16:** avatar davky 04–08 — 201/202 GLB; pipeline TripoSR+Blender; thrashing incident vyřešen uvolněním místa.

*Poslední aktualizace: 2026-11-17 — vytvořeno při kanonizaci docs/. Nové položky přidávej **nahoře** do příslušné sekce.*
