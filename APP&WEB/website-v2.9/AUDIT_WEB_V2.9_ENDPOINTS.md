# Audit – web v2.9 vs. backend endpointy (2026-01-20)

## Stav v produkci (zionterranova.com)

### OK (200)
- `/health` (Next route → agregace závislostí)
- `/api/health` (JSON health)
- `/pool/stats` (Next proxy → pool API)
- `/pool/miner/{wallet}` (Next proxy → pool API)
- `/api/network`
- `/api/network/best-pool`
- `/api/blockchain/stats`
- `/api/blockchain/blocks`
- `/api/guardians/stats`

### Očekávané / známé odchylky
- `/api/presale/status` → `410 Gone` (deprekované/odstraněné)

### Nezaproxované (typicky 404 přes nginx)
- `/grafana/*`
- `/prometheus/*`

## Co bylo opraveno ve webu
- Odstraněny veřejné hardcoded odkazy na `:8001` a `:8080` v UI (API Reference + Dashboard).
- `API Reference` nyní ukazuje reálné public cesty `/api/*`, `/pool/*`, `/health`.

## Co ještě chybí / rozhodnutí
- Jestli má být observability přístupná z webu přes `/grafana` a `/prometheus` (nginx proxy) nebo jen interně.
- Pokud má existovat veřejný JSON-RPC endpoint (dříve komunikováno jako `/json-rpc`), je potřeba buď:
  - přidat Next route handler proxy, nebo
  - zdokumentovat skutečný endpoint (pokud už existuje jinde) a sjednotit s nginx.
