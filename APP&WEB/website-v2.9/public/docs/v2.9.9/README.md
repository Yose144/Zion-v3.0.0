# ZION TerraNova v2.9.9 — Pure Code

> Release window: březen 2026  
> Role in lineage: čistící a migrační větev před V3 mainnet track

v2.9.9 je čistící release: cílem není přidávat feature ani měnit consensus výstup, ale odstranit legacy balast a zamknout auditovatelný základ.

## Co je klíčové

- Jeden PoW profil v runtime (`cosmic_harmony` = Ekam Deeksha).
- Jedna aktivní dispatch cesta v miner flow.
- Redukce duplicit a mrtvých fallbacků.
- Příprava čisté migrace do V3 mainnet-track repozitáře.

## Release principy

- Odebírat, ne přidávat.
- Jediný source of truth.
- Zachovat pool kompatibilitu.
- Nulový záměr měnit consensus hash output.

## Dokumenty v této větvi

- `v2.9.9/changelog.md` — změnová osa a čistící scope
- `v2.9.9/migration.md` — mapování 2.9.9 -> V3
