# ZION TerraNova - Status report novy server

> Datum: 2026-03-10
> Scope: aktualni stav hostu 91.98.122.165 + kompatibilita vuci docs/v2.9.6, docs/2.9.7 a docs/2.9.8
> Typ: operacni snapshot pro git a dalsi dokumentacni cleanup

---

## 1. Executive summary

Novy primarni server `91.98.122.165` je aktualne funkcni jako jednotny produkcni host pro chain, pool a web.

Aktualne na nem bezici stack:

- `zion-core:2.9.8`
- `zion-pool:2.9.8`
- `zion-miner:2.9.8`
- `zion-seed-1:2.9.8`
- `zion-seed-2:2.9.8`
- `zion-redis:7-alpine`
- `zion-website:2.9.6`

Web a TLS routy pro `www`, `api` a `explorer` vraceji `200` a nginx + Let's Encrypt jsou na hostu nasazene spravne.

Hlavni provozni nesoulad, ktery stale zbyva:

- webovy health endpoint porad kontroluje stare dependency hosty `77.42.31.72:8444` a `77.42.31.72:8080`
- kvuli tomu `/health` vraci HTTP `200`, ale payload status je `down`
- release dokumentace 2.9.8 stale popisuje puvodni 3-server topologii jako aktivni stav, coz uz neodpovida realite

---

## 2. Oveřeny inventar noveho serveru

### Host

- Hostname: `Zion2`
- IP: `91.98.122.165`
- UTC snapshot: `2026-03-10T13:41:34Z`

### Bežici kontejnery

| Kontejner | Image | Stav | Porty |
|---|---|---|---|
| `zion-website` | `zion-website:2.9.6` | healthy | `3000` |
| `zion-pool` | `zion-pool:2.9.8` | healthy | `3333`, `8080` |
| `zion-seed-1` | `zion-core:2.9.8` | up | internal only |
| `zion-seed-2` | `zion-core:2.9.8` | up | internal only |
| `zion-redis` | `redis:7-alpine` | healthy | internal only |
| `zion-core` | `zion-core:2.9.8` | healthy | `8334`, `8444` |
| `zion-miner` | `zion-miner:2.9.8` | up | internal only |

### Deploy soubory pritomne na hostu

- `/root/zion-2.9.6/docker/docker-compose.testnet.yml`
- `/root/zion-web-deploy/docker/docker-compose.website.yml`
- `/etc/nginx/sites-enabled/zionterranova.com`

### TLS / certifikat

- CN: `zionterranova.com`
- Issuer: `Let's Encrypt E7`
- Valid from: `2026-03-10 12:35:52 GMT`
- Valid to: `2026-06-08 12:35:51 GMT`
- SAN:
  - `zionterranova.com`
  - `www.zionterranova.com`
  - `api.zionterranova.com`
  - `explorer.zionterranova.com`

---

## 3. Oveřeni endpointu

### Lokalni backend na hostu

| Route | HTTP |
|---|---|
| `/` | `200` |
| `/docs` | `200` |
| `/genesis` | `200` |
| `/health` | `200` |

### Verejne HTTPS routy

| Route | HTTP |
|---|---|
| `https://www.zionterranova.com/` | `200` |
| `https://api.zionterranova.com/health` | `200` |
| `https://explorer.zionterranova.com/blocks` | `200` |

### Dulezita poznamka k `/health`

Payload na `http://127.0.0.1:3000/health` v case kontroly:

```json
{
  "status": "down",
  "version": "v2.9.8",
  "environment": "production",
  "dependencies": {
    "rpc_node": {
      "healthy": false,
      "host": "77.42.31.72",
      "port": 8444
    },
    "mining_pool": {
      "healthy": false,
      "host": "77.42.31.72",
      "port": 8080
    }
  }
}
```

Z toho plyne:

- web proces bezi a route je dostupna
- health logika neni prepnuta na novy server model
- stale pouziva stare fallbacky z puvodni helsinske topologie

---

## 4. Kompatibilita s docs/v2.9.6

### Stav: parcialne kompatibilni, operacne neaktualni

Dokumenty `docs/v2.9.6` jsou vhodne jako historicky nebo architektonicky reference set, ale ne jako source of truth pro aktualni infrastrukturu.

### Co sedi

- repozitar stale drzi vetev `v2.9.6`
- dokumentace pokryva launch plan, p2p, consensus a migraci
- web stale pouziva cast `public/docs/v2.9.6`

### Co nesedi s realitou hostu 91.98.122.165

- `docs/v2.9.6/README.md` popisuje starou network topologii `Helsinki 77.42.31.72` + `Germany 46.225.126.243`
- `docs/v2.9.6/launch-plan.md` pocita s puvodnimi seed hosty a multiregionalnim mainnet cilem, ne s aktualnim single-host rebuild stavem
- `docs/v2.9.6/consensus.md` je v textu vnitrne nekonzistentni: hlavicka tvrdi CHv4 od genesis, ale niz popisuje Phase 4 jako aktivni od vysky `50 000`
- README stale mluvi o puvodnim PoW a historickych sitovych adresach, ne o aktualnim 2.9.8 runtime stacku na novem hostu

### Verdict pro 2.9.6

- architektura: pouzitelna jako historicky/produktovy kontext
- provozni stav: ne
- deploy source of truth: ne

---

## 5. Kompatibilita s docs/2.9.7

### Stav: technicky navazujici, ale neodpovida aktualnimu deploymentu

Dokumenty `docs/2.9.7` popisuji pre-mainnet baseline, CHv4 readiness a revenue/NCL gating. Jsou dulezite pro pochopeni evolution path, ale nejsou popisem dnes beziciho hostu.

### Co sedi

- 2.9.7 readiness material navazuje na CHv4/Deeksha smer
- `RELEASE_2.9.7_PRODUCTION_BASE.md` dobre zachycuje build gates a feature gating
- `MAINNET_READINESS_UNIFIED.md` je relevantni jako release historie a rozhodovaci kontext

### Co nesedi s aktualnim hostem

- 2.9.7 dokumenty nepocitaji s dnesnim `zion-only` testnet compose profilem
- revenue cast v `RELEASE_2.9.7_PRODUCTION_BASE.md` stale pocita s `config/ch4_revenue_settings.json`, zatimco aktualni compose na novem hostu mountuje `config/ch3_zion_only_settings.json`
- 2.9.7 readiness je postavena jako pre-mainnet baseline, ne jako aktualni website+nginx+single-host runtime snapshot

### Verdict pro 2.9.7

- release historie: ano
- operational match se serverem 91.98.122.165: ne

---

## 6. Kompatibilita s docs/2.9.8

### Stav: runtime verze ano, topologie a deploy report uz ne

`docs/2.9.8` je nejbliz aktualnimu runtime stacku, protoze core/pool/miner/seedy bezici na hostu jedou na `2.9.8`.

### Co sedi

- na hostu bezi `zion-core:2.9.8`, `zion-pool:2.9.8`, `zion-miner:2.9.8`
- lokalni compose `docker/docker-compose.testnet.yml` odpovida 2.9.8 generaci stacku
- Deeksha canonical path zustava aktualni smer

### Co nesedi

- `docs/2.9.8/DEPLOY_REPORT_2.9.8.md` stale uvadi tri fyzicke servery: Helsinki, Usa, Asia
- aktualni realita je jeden fyzicky host `91.98.122.165` a dva interní seed kontejnery `zion-seed-1`, `zion-seed-2`
- deploy report 2.9.8 stale uvadi `MINER_POOL_URL=77.42.31.72:3333` pro x86 nody, coz je uz historicka informace
- website neni buildnuta jako `2.9.8`, ale jako `zion-website:2.9.6`
- web health endpoint stale fallbackuje na `77.42.31.72`, coz odporuje aktualnimu single-host modelu

### Verdict pro 2.9.8

- runtime family: ano
- operacni inventar noveho serveru: jen castecne
- dokument jako source of truth pro aktualni infra: ne bez revize

---

## 7. Dulezite zjištěne nesoulady

### A. Web health endpoint je stale stary

Soubor:

- `APP&WEB/website-v2.9/src/app/api/health/route.ts`

Problem:

- default fallback pro `POOL_API` je `http://77.42.31.72:8080`
- default fallback pro `RPC_URL` je `http://77.42.31.72:8444/jsonrpc`

Dusledek:

- `/health` route je sice dostupna, ale tvrdi `status=down`
- health reporting neni kompatibilni s novym serverem bez explicitnich env overridu nebo kodove opravy

### B. Sitova konfigurace webu stale pouziva starou 3-node mapu

Soubor:

- `APP&WEB/website-v2.9/src/lib/network-config.ts`

Problem:

- default seed nodes stale ukazuji na `77.42.31.72`, `178.156.240.160`, `5.223.43.93`
- default mining pool stale ukazuje na `77.42.31.72:3333`

Dusledek:

- vsechny geolokacni a default network API odpovedi webu jsou bez env override stale historicke

### C. Website verze je odlisna od chain stacku

Aktualni stav hostu:

- website image: `zion-website:2.9.6`
- chain stack: `2.9.8`

To muze byt legitimni, pokud web nese starsi product branding, ale musi to byt explicitne popsano v dokumentaci. Jinak to pusobi jako nekonzistence release vrstvy.

---

## 8. Doporučeni pro dalsi krok pred git push

### Minimum

1. Commitnout tento report jako auditni snapshot.
2. Nechat `SERVERS.md` a `docs/ops/runbook.md` jako aktualni source of truth pro infrastrukturu.

### Doporucene hned po tom

1. Opravit `APP&WEB/website-v2.9/src/app/api/health/route.ts`, aby novy host nehlasila jako `down`.
2. Opravit `APP&WEB/website-v2.9/src/lib/network-config.ts`, aby defaulty odpovidaly nove topologii nebo byly plne env-driven.
3. Doplnit do `docs/2.9.8/DEPLOY_REPORT_2.9.8.md`, ze jde o historicky 3-server snapshot, ne o aktualni live infra stav.
4. Rozhodnout, zda `zion-website:2.9.6` je zamerny release label, nebo ma byt sjednocen s runtime 2.9.8 vetvi.

---

## 9. Finalni verdict

Novy server `91.98.122.165` je funkcni a pripraveny jako aktualni primarni host.

Z hlediska reality plati:

- chain + pool + miner stack jede na `2.9.8`
- website je dostupna, routy i TLS funguji
- aktualni infra uz neni 3-host deployment, ale single-host deployment s internimi seed kontejnery

Z hlediska dokumentace plati:

- `docs/v2.9.6` = historicky a architektonicky kontext
- `docs/2.9.7` = pre-mainnet baseline a readiness historie
- `docs/2.9.8` = nejblizsi runtime verzi, ale uz neodpovida aktualni fyzicke topologii

Nejvetsi otevreny rozpor pred dalsim push je stale web health/network config vrstva, ktera ve fallbacku porad veri stare helsinske infrastrukture.