# REPORT 2026-10-31 — E-shop dohromady

> **Okno:** 2026-10-31  
> **Host:** EDGE2, `market.zionterranova.com`, služba `zion-marketplace`  
> **Stav:** nasazeno. Zkušební objednávka zůstala nezaplacená.

## Zkušební objednávka

| | |
|---|---|
| Objednávka | `ORD-1793452959-st4meu` |
| Faktura | `FV2026-000037` |
| Zboží | Království srdce, 144 Kč, firma Workflow test, IČO `12345679` |
| E-mail | `shop@newearth.cz` |
| Platba | karta, Stripe session zrušená, `paymentStatus=pending` |
| Bonus | 1440 ZION, **neodesláno** (objednávka není zaplacená) |
| Sklad knihy | 999 → 998 |

## Pošta

Zákaznické potvrzení skládá rasta šablonu v `apps/MarketPlace/src/lib/v2-email.ts`. Dřív se nejdřív čekalo na PDF přílohu a chybějící Chrome shodil celý dopis. Teď HTML odejde vždy a PDF se připojí jen když se složí.

Po doinstalaci Chrome 156 do `/home/zion/.cache/puppeteer` a opravě šablony journal hlásí `Customer order confirmation sent … (with invoice attachment)`. SMTP chyba nebyla.

## Bonus ZION

Výplata je ve `apps/MarketPlace/src/lib/bonus-payout.ts`. Spustí se až při `paymentStatus=paid` z `markShopOrderPaid`, ze Stripe `verify` a z webhooku `checkout.session.completed`. Druhé volání už odeslaný bonus nepošle. Tlačítko v adminu je ruční opakování a u nezaplacené objednávky nic neudělá.

`zionTokens` jsou celé ZION, stejné číslo jako v adminu. CLI `wallet send --amount` bere ZION, ne flowers. Dřívější dělení `1_000_000` by z 1440 ZION udělalo 0,00144.

Zdroj je kanonická pool payout peněženka `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6`, ne shop vault. Soubor `/etc/zion/MarketPlace/pool-wallet.json` na EDGE2 na ni ukazuje (600, uživatel `zion`). Starý soubor je vedle jako `.bak-old-payout-20261031`.

Suchý běh: `Sending 1440 ZION`, `1440000000` flowers, odesílatel kanonická adresa, bez `Broadcast OK`. CLI musí startovat v `/opt/zion/data/v31`, jinak spadne na relativní `multichain.db`. To dělá `ZION_L1_CLI_CWD`.

## Admin a Stripe

- Seznam faktur míří na `/api/invoice/<id>/download` a `?format=pdf`. HTML i PDF zkušební faktury vrací 200, PDF začíná `%PDF`.
- Detail objednávky ukazuje částku a uloženou Stripe session.
- `/admin/stripe` čte `/api/admin/stripe/status`: tajný klíč je nastavený, **webhook secret chybí**. Endpoint `https://market.zionterranova.com/api/stripe/webhook` bez `whsec` v produkci vrací 400. Zaplacení kartou bonus spustí návrat na `/order-success`.

## 3D stíhačky

Modal v `ShopProductModal` u cest `/shop/models/*.stl` pouští `StarfighterViewer` (Three.js r170, orbita, mřížka). Odkaz na Thingiverse zůstává odkazem. Naživo: kategorie starfighters, TIE Fighter, `tiefighter.stl` 200, plátno `three.js r170`, model se vykreslí.

## Otevřeno

- `STRIPE_WEBHOOK_SECRET` pořád prázdný. Až bude ve Stripe dashboardu, patří jen do serverového `.env`.
- Nezaplacenou zkušební objednávku nerušit: zrušení sklad nevrací.
