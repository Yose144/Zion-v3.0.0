# 3.3 Nirvana — loď Království srdce

> **Datum:** 2026-10-29 · **HEAD:** `4040126ad` (`main`, v sync s origin)
> **Co tento soubor je:** čtecí paluba nad execution plány. Spojuje živý ekosystém do jednoho obrazu lodi.
> **Co tento soubor není:** přejmenování fází N0–N7, přepis knihy [`canon/books/KralovstviSrdce/`](canon/books/KralovstviSrdce/00-README.md), ani nová vrstva pravdy.

Pravda zůstává v pořadí z [`NIRVANA-V3.3-MAP.md`](NIRVANA-V3.3-MAP.md) §0: kód a živé sondy, Registr důkazů, execution (N0–N7, DoD V33-1…9), charta, vize, narativ. Tahle kapitola je **čtení** těch vrstev, ne jejich náhrada.

Veřejný podtitul (web `/roadmap#nirvana` a archiv `#plan-v33`): **„3.3 Nirvana — loď Království srdce“**. Fáze se jmenují dál N0–N7. Kniha Království srdce zůstává **MÝTUS / DRAFT** s kotvou pravdy. Přejmenování releasu je operátorské rozhodnutí a v téhle vlně se nedělá.

Strojovna (Hash / Care / Scene) je specifikovaná v [`docs/3.3/ENGINE-SRDCE.md`](docs/3.3/ENGINE-SRDCE.md). Není to druhý miner a není v DoD 3.3.

---

## Paluba

Štítky jsou stejné jako v [Registru důkazů](canon/books/MiseAmenti/07-Registr-Dukazu.md): **ŽIVÉ / STAVBA / HORIZONT / HYPOTÉZA / MÝTUS**.

| Část lodi | Vrstva | Stav 29. 10. | Co se smí říct |
|---|---|---|---|
| **Kýl** | L1 Ekam Deeksha, primary node na EDGE2, followeři node2/node3 na EDGE | **ŽIVÉ** | Řetěz běží. Konsensus, emise a genesis se v téhle vlně nemění. 1% slot před aktivací se pálí (mint = 99 % subsidy), operátorům se nevyplácí. |
| **Stěžeň a plachty** | Pool na EDGE (stratum 8444/8445, API 8080), AuxPoW QTU/PRL/ZANO/VRSC, fleet | **ŽIVÉ** provoz, **STAVBA** nativní payouty | Schema v13 (`height` = odměna, `inclusion_height` = zařazení). Job-target validace, API snapshot mimo zámek poolu, M3 sharding zámků. PRL `DRY_RUN` a QTC treasury deficit nejsou flipnuté. |
| **Kompas** | ZIS (`auth.zionterranova.com`) | **ŽIVÉ** služba, **STAVBA** passkeys | EdDSA/JWKS běží. Produkční passkey E2E na třech webech chybí (V33-4). |
| **Pokladna** | WARP, ZionDex, DAO | Most **ŽIVÉ**, swap a DEX settlement **HORIZONT** do rozhodnutí | BTC swap drží `ENABLED=0`. On-chain settlement čeká na funding. Premine zámek do výšky 144 000 je živý; dry-run unlocku na regtestu prošel 28. 10. |
| **Hlava** | Hiran / Maestro / NCL | Maestro **ŽIVÉ** read-only, NCL **STAVBA** | E2E orchestrace 6/6 kroků, mutace vypnuté. Žádný produkční NCL job. |
| **Paluba** | OASIS WebGPU + marketplace | Preview a obchod **ŽIVÉ**, UE5 **HORIZONT** | OasisWeb renderuje v prohlížeči. WebGPU náhled `?gpu=webgpu` je stavba (G0–G2), ne hotový klient. Marketplace má B2B checkout. Pixel streaming není v DoD. |
| **Přístav** | Free World + Issobella | Portály **ŽIVÉ**, pilot a DeSci **STAVBA** | Scanner na tipu. Grant se dnes nevyplácí. Žádný impact packet, žádný L1 anchor článku. |
| **Příběh na přídi** | Kniha Království srdce, Nirvana / Tres Marías | **MÝTUS** | Loď tesaře. Kotva pravdy v knize. Nesmí se číst jako specifikace mainnetu. |

DoD v3.3 zůstává **0/9**. G8 run #5 běží do ~24. 11. G9 je od 26. 10. pozastavené — Stable nemá datum.

---

## Topologie, která se nestěhuje

| Role | Host | Drží |
|---|---|---|
| EDGE2 | `207.180.217.100` | Primary node (RPC 9445, P2P 8335), nginx ingress, web, marketplace, ZIS, OASIS :8094, WARP, DAO, Postgres, free-world, Hiran CPU fallback |
| EDGE | `62.171.141.136` | Pool (reálné IP minerů — záměrně ne za nginx), node2 :9446, node3 :9447, Grafana, Prometheus, fallback-miner |
| Tunel | edge ↔ EDGE2 ~1 ms | Cross-box RPC je prakticky lokální |

`V31/`, `scripts/` a `ZION_OS/` zůstávají v rootu. Jejich jméno je součást produkčního kontraktu ([`REPO-MAP.md`](REPO-MAP.md)).

---

## Mapa povrchů

Jeden příběh, víc hostname. Tahle vlna je **neslévá** do jednoho Next monorepa a **neruší** DNS. Říká, kdo kterou URL vlastní.

| Hostname | App | Stack | Vlastní | Duplicita |
|---|---|---|---|---|
| `zionterranova.com` | [`apps/IntroPage`](apps/IntroPage) | Next 14, statický export | Apex, brána | Vedle app webu; `public_html` je starý V2 strom |
| `app.zionterranova.com` | [`apps/website-v2.9`](apps/website-v2.9) | Next 16.4.3, React 19, `3.2.0` | Explorer, `/pool`, vrstvy L3–L6, archiv knih | Vlastní `zion-*` CSS, ne sdílený i18n |
| `freeworld.zionterranova.com` | IntroPage `freeworld/` + web `/l5-free-world` | statický build + proxy na web | L5 portál | Třetí L5 povrch vedle webu |
| `oasis.zionterranova.com` | [`apps/OasisWeb`](apps/OasisWeb) | Next 16.2.9, statický export | 3D klient, WebGPU = render | Web `/l4-oasis` je jen rozcestník |
| `pool.zionterranova.com` | [`apps/pool-ui`](apps/pool-ui) | Next 14.2.30 | Dashboard minerů, ops konzole | Web `/pool` je druhý pool UI |
| `market.zionterranova.com` | [`apps/MarketPlace`](apps/MarketPlace) | Next 14.2.5 | Obchod, Stripe, B2B | Vlastní Prisma vedle `apps/shared` |
| `auth.zionterranova.com` | [`apps/identity`](apps/identity) | Fastify 5 | ZIS | — |
| — (klient) | [`apps/desktop-agent`](apps/desktop-agent) | Electron `3.2.0` | Miner + wallet | Hlavičky říkaly Alpha; srovnáno na Beta v téhle vlně, bez deploye |
| — (klient) | [`apps/mobile-app`](apps/mobile-app) | RN, **build aplikace 3.0.6** | Wallet preview | Síťový štítek už byl `v3.2 · Mainnet Beta`; kódové jméno na obrazovce srovnáno, semver buildu se nemění |
| — (knihovna) | [`apps/zion-wallet-sdk`](apps/zion-wallet-sdk) | `2.0.0` | RPC/wallet helper | Web pinuje vendored `.tgz` |
| — (ops) | [`apps/shared`](apps/shared) | db-sync + CSS tokeny | Postgres sync | Website tokeny neimportuje |

i18n je roztříštěné (website `LanguageContext`, pool-ui `lib/i18n`, marketplace vlastní hook, freeworld `data-i18n`). Sdílený balík v téhle vlně nevzniká.

---

## Mrtvé routy webu (29. 10.)

`next.config.ts` je přesměrovává natrvalo. Složky pod `src/app/` nikdo neimportuje. Widgety, které trh skutečně renderuje, žijí v `src/components/dex/` a na `/market`. Složky níže jsou po téhle vlně pryč:

| Bývalá cesta | Kam vede redirect |
|---|---|
| `/defi`, `/bridge`, `/warp`, `/swap`, `/dex`, `/ziondex` | `/market` nebo kotva na trhu |
| `/wiki` | `/docs` |
| `/roadmap-295` | `/roadmap` |
| `/onboard` | `/mining` |
| `/kompas` | `/terranova` |
| `/cesta` | `/zion-archive` |

`/api/defi/*` zůstává. Odkazy v `defi-contracts.ts` a starých článcích dál trefí redirect. Nový trh se nestaví z smazaných stránek.

---

## Odložené stromy

| Cesta | Verdikt |
|---|---|
| `docs/WP-Mainet/SurtaSrdce/01-Dopis-pro-Surtu.md` | Starší nezařazený opis. Kanon je [`canon/books/SurtaSrdce/01-Dopis-pro-Surtu.md`](canon/books/SurtaSrdce/01-Dopis-pro-Surtu.md) (má přesnější pasáž o mahásamádhi). Poznámka v [`docs/WP-Mainet/README.md`](docs/WP-Mainet/README.md). Kanon se tím opisem nepřepisuje. |
| `L4data/img/OasisMaitreya.png` | Jedinečný obrázek, v `canon/l4` nebyl. Přesunut do [`canon/l4/img/OasisMaitreya.png`](canon/l4/img/OasisMaitreya.png). Prázdný root `L4data/` zaniká. Do UI zatím není zapojený. |

---

## Co tahle vlna nedělá

Rotace secretů, `PRL DRY_RUN=0`, zapnutí BTC swapu, tag `v3.2.0`, přesun `V31/`, mazání `public_html` a záloh, UE5, aktivace Proof-of-Care na L1, deploy na EDGE nebo EDGE2.

Další pořadí je v [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md): nejdřív N0 (G8, člověk u G9), pak N1–N2 po rozhodnutích o penězích, N3–N4 až jako jeden NCL job na `zion-compute` a WebGPU parity, N5–N7 až po DoD.
