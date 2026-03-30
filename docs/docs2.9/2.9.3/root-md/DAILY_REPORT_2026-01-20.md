# ZION v2.9 — Daily Report (2026-01-20)

## Shrnutí
Dnes jsme dotáhli zarovnání webu v2.9 na „backend realitu“ (hlavně veřejné endpointy a odkazy bez hardcoded portů), ověřili produkční deployment přes Docker/SSH a zároveň rozpracovali/rozšířili část pool backendu (NCL E2E + validace share pro Cosmic Harmony) pro lepší end-to-end průchodnost.

## Web (website-v2.9)
### Hotovo
- `/admin` je chráněný Basic Auth přes Next middleware (řízené ENV `ADMIN_USER` / `ADMIN_PASSWORD`).
- Doplněné veřejné endpointy v Next (App Router):
  - `/api/health` (agregovaný health-check pool + blockchain RPC)
  - `/health` (alias na `/api/health`)
  - `/pool/*` proxy přes `src/app/pool/[...path]/route.ts`
- Odstraněné hardcoded public porty `:8001` a `:8080` z UI a dokumentace.
  - API reference a linky nyní používají `https://zionterranova.com/api/*`, `https://zionterranova.com/health` a `https://zionterranova.com/pool/*`.
- U admin UI stránek proběhl facelift / sjednocení layoutu (bez přidávání nových „fake“ page linků):
  - `/admin` dashboard
  - `/admin/algo-manager`
  - `/admin/pool-config`

### Build/Deploy poznámky
- Fix build blockerů:
  - `.dockerignore` doplněn o vyloučení skrytých temp souborů v `public/downloads/**/.*` (Docker build context dříve padal na obřích hidden souborech).
  - Opravy JSX v docs stránce (aby `next build` prošel).
  - Typing fix pro catch-all route params v Next 16 (`context.params` jako Promise).

### Ověření (produkce)
- Po forced rebuild + recreate kontejneru se ověřily endpointy pomocí `curl` matice (kódy 200 na klíčových routách):
  - `/`, `/health`, `/api/health`, `/pool/stats`, `/api/network`, `/api/blockchain/stats`, …
- Lokální `npm run build` proběhl a následný grep v prerender HTML nepotvrdil výskyt `zionterranova.com:8001` ani `zionterranova.com:8080`.

## Pool backend (Python, src/pool)
### Změny
- `src/pool/auth/login_handler.py`
  - XMRig worker name: preferuje se `rigid` (rig-id), fallback na `pass`.
- `src/pool/mining/share_validator.py`
  - Přidán přepínač `validate_cosmic_hashes` a strategie „server-side hashing“ pro `cosmic_harmony`/`cosmic_harmony_v3` (pool si může sám dopočítat hash a netrustit miner output).
  - Upravena konverze targetu pro Cosmic Harmony v1/v3 z 64-bit LE targetu na 32-bit state0 porovnání.
- `src/pool/mining/algorithm_detector.py`
  - Robustnější fallback pro yescrypt: chytá se obecný exception a loguje se důvod.
- `src/pool/ncl_pool_manager.py` + `src/pool/zion_pool_v2_9.py`
  - Doplněn `ncl.get_task` handler hook v poolu.
  - Doplněný „task contract v1“ (vrací superset polí pro kompatibilitu: `model`, `input_data` jako string + `input_data_json`, `max_time_ms`, `reward_multiplier`, …).
  - Seed demo deterministických tasků (pokud je queue prázdná) pro smoke test.
  - Základní verifikace task výsledků (deterministic blake3 chaining, pokud je dostupný `blake3`).
- Přidán E2E klient: `tools/ncl_e2e_client.py` (login → ncl.register → ncl.get_task → compute → ncl.submit).

### Stav
- Web změny jsou nasazené a ověřené v produkci.
- Python/pool změny jsou v repu jako lokální změny (je potřeba rozhodnout, zda a kdy je nasazovat do produkčního pool containeru).

## Otevřené body / rozhodnutí
- Expozice `/grafana` a `/prometheus` na veřejné doméně (aktuálně 404, pokud to nginx explicitně neproxyuje).
- Veřejné JSON-RPC: jestli má být exposed a jak (proxy přes Next/nginx) vs. držet interně.
- U NCL: potvrdit „kanonický“ task contract (fields + verifikace) a jestli to primárně stavět na Python pool, nebo rovnou mířit na Rust zion-native stack.

## Doporučený další krok
1) Rozhodnout „clear root“ (co přesně čistit) + bezpečný cleanup skript.
2) Pokud chceme nasadit i pool backend změny: udělat separátní deploy krok pro pool container + E2E ověřit `ncl_e2e_client.py` proti produkci.
