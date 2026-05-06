# ZION TerraNova v2.9.8 — Ekam Deeksha kanonická cesta

> Okno release: březen 2026  
> Role v linii: kanonické sjednocení runtime po pre-mainnet gate v2.9.7

v2.9.8 sjednocuje konsenzuální cestu do jediné kanonické větve `cosmic_harmony` (Ekam Deeksha) při zachování provozní kompatibility s CHv3 revenue subsystémy.

## Co je klíčové

- Jeden kanonický PoW profil pro síťový runtime.
- NPU/GPU akcelerace zůstává akcelerací, nikoli oddělenou konsenzuální větví.
- Konsolidovaný rollout na aktivní veřejný host s interními seed kontejnery.
- Zachovaná provozní kompatibilita revenue streamů (pool/proxy/scheduler).

## Provozní shrnutí

- Topologie: 1 veřejný host + interní seed kontejnery.
- Rollout: rebuild + reset + ověření produkce bloků.
- Výsledek validace: chain běží, pool přijímá share, miner hlásí accepted práci.

## Dokumenty v této větvi

- `v2.9.8/changelog.md` — stručný souhrn release delty
- `v2.9.8/runtime.md` — runtime zásady a kompatibilita

## Návaznost

- v2.9.7: stabilizační a dokumentační pre-mainnet gate
- v2.9.8: kanonické sjednocení runtime
- v2.9.9: pure-code cleanup a migrační příprava na čistý V3 mainnet track
