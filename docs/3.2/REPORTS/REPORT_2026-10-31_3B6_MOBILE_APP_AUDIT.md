# Report: 3.B6 — Mobile app (3.0.6) API audit vs 3.2

**Datum:** 2026-10-31 · **Scope:** `apps/mobile-app` (React Native, verze 3.0.6) · **Status:** ✅ Audited — preview-marked, dead backend vhosts zdokumentovány

## Task

„Sladit s 3.2 API, nebo explicitně označit ‚preview'"

## Preview marking — už splněno

| Lokalita | Stav |
|---|---|
| `package.json` description | „…(app build 3.0.6, preview client) on ZION v3.2 Mainnet Beta" |
| `src/constants/config.js` | `CLIENT_STAGE: 'preview'` |
| `SettingsScreen` | renderuje „Mobile preview · preview" |

## Endpoint audit (live curl sweep)

| Endpoint | Stav | Consumující feature |
|---|---|---|
| `rpc.zionterranova.com` | ✅ 200 | BlockchainRPC — send/receive, balance |
| `explorer.zionterranova.com` | ✅ 200 (301→https) | explorer links |
| `pool.zionterranova.com` | ✅ 200 | PoolAPI, MiningService |
| `auth.zionterranova.com` | ✅ 200 | ZisAvatar (public avatar endpoint jen) |
| `app.zionterranova.com/api/dao/*` | ✅ 200 | DAOService — proposals/stats/treasury/health |
| `api.zionterranova.com` | ❌ **TLS SAN mismatch** | `WZIONBridgeService` RELAY_API + generic `API_URL` |
| `dex.zionterranova.com` | ❌ **TLS SAN mismatch** | `DexScreen` ZIONDEX_ROUTER_URL |
| `updates.zionterranova.com` | ❌ **TLS SAN mismatch** | `IAPService` VALIDATION_URL (receipt validation) |

**Diagnóza dead hostů:** DNS resolvuje na EDGE IPv4 (`62.171.141.136`), nginx odpovídá, ale **žádný vhost pro tyto jména** → padne na default cert bez SAN match. Služby (wzion relay, dex router, iap validation) **nejsou na EDGE nikdy nasazené** — nejde o outage, ale o neexistující backend.

## Degradace na mrtvých endpointech — graceful

- `BridgeScreen`: `getBridgeStats().catch(() => null)`, tx-status poll `.catch(() => null)`, Alert na errors — necrashuje
- `DexScreen`: router fetch wrapped, Alert na selhání
- `IAPContext` init: try/catch → `LicenseService.getCachedEntitlements()` fallback, purchase callbacky chyby propagují do UI

Tj. preview build se chová korektně — funkce bez backendu zobrazí chybu/prázdný stav, ne crash/hang.

## Verdikt

- ✅ Preview marking splňuje 3.B6 fallback variantu („explicitně označit preview")
- ⚠️ Plné sladění s 3.2 API závisí na 👤 produktovém rozhodnutí: nasadit wzion-relay/dex-router/iap-validation na EDGE (vhost + služba + cert), nebo featury z buildu odstřihnout
- Mobile UI změny nelze vizuálně ověřit bez device/emulatoru — deploy gating zůstává na store submission flow (3.B6 checklist doplněn)

## Doporučení (follow-up)

1. 👤 Rozhodnout osud tří dead vhosts před store submission (deploy vs. feature cut)
2. Zvážit `APP_VARIANT=preview` conditional route-gating Bridge/Dex tabů, dokud backend nežije
3. IAP receipt validation — dočasně client-side only nebo vypnout Pro/MinerBoost gating v preview
