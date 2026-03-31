# ZION TerraNova v2.9.8 — Ekam Deeksha Canonical Path

> Release window: březen 2026  
> Role in lineage: canonical runtime sjednocení po 2.9.7 pre-mainnet gate

v2.9.8 sjednocuje konsenzusní cestu do jediné kanonické větve `cosmic_harmony` (Ekam Deeksha) při zachování provozní kompatibility s CHv3 revenue subsystémy.

## Co je klíčové

- Jeden canonical PoW profil pro síťový runtime.
- NPU/GPU akcelerace zůstává akcelerace, ne oddělená consensus větev.
- Konsolidovaný rollout na aktivní veřejný host s interními seed kontejnery.
- Zachovaná provozní kompatibilita revenue streamů (pool/proxy/scheduler wiring).

## Provozní shrnutí

- Topologie: 1 veřejný host + interní seed kontejnery.
- Rollout: rebuild + reset + ověření produkce bloků.
- Výsledek validace: chain běží, pool akceptuje share, miner submituje accepted work.

## Dokumenty v této větvi

- `v2.9.8/changelog.md` — stručný release delta souhrn
- `v2.9.8/runtime.md` — runtime zásady a kompatibilita

## Návaznost na další vývoj

- v2.9.7: stabilizační a dokumentační pre-mainnet gate
- v2.9.8: canonical runtime sjednocení
- v2.9.9: pure-code cleanup a migrační příprava na čistý V3 mainnet track
