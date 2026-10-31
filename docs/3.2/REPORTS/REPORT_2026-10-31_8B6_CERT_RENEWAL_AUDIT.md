# 8.B6 — Certifikáty: renewal owner per cert + renew ověření

**Datum:** 2026-10-31 · **Verdikt: PASS po nápravě**

## Nález a oprava

**Stav před:** oba boxy měly `certbot.timer` a EDGE držel **synchronizované kopie** všech
certů (identické expiry timestampy) včetně aktivních renewal confů pro 8 domén, které DNS
směruje na EDGE2 → při splatnosti by renewal na EDGE **selhal** (HTTP-01 dopadne na EDGE2)
a porušoval "jeden owner per cert".

**Provedeno:** na EDGE přejmenováno 8 confů → `.conf.disabled` (reversibilní, konvence už
používaná na EDGE2):

| Doména | DNS | Owner po opravě |
|---|---|---|
| app, auth, freeworld, market, oasis, pool, rpc, zionterranova.com-0001 | → EDGE2 (207.180.217.100) | **EDGE2** ✅ |
| dashboard-0001, explorer, nirvana, stratum | → EDGE (62.171.141.136) | **EDGE** ✅ |

Duplicitní vlastnictví = **0**. Cert soubory na EDGE zůstávají (fallback vhosty je servírují
do expirace ~27. 12.–led.; fallback je legacy "do F6" — viz RUNBOOK).

## Renew ověření (live)

- **`auth.zionterranova.com`**: expiry **2027-01-24** (85 dní) — renew před deadlinou 25. 11.
  již proběhl ✅
- **EDGE2 `certbot renew --dry-run`**: **8/8 SUCCESS** (staging renewal všech aktivních confů)
- Timery: `certbot.timer` aktivní na obou boxech (EDGE2 denně, EDGE 2×/den)
- Expirované lineage: aktivní žádné; zbytky jsou `.disabled`/`empty` markery — nerenují ✅

## Residuál

- EDGE fallback HTTPS pro EDGE2-domény vyprší s posledním zkopírovaným certem (~27. 12.+).
  Pokud má fallback přežít F6, přidej EDGE2 `deploy_hook` rsync `live/`+`archive/` → EDGE.
  Dnes záměrně ponecháno bez hooku (fallback se vypíná).
