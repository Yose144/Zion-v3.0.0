# ZION TerraNova v2.9.9 — Pure Code

> Okno release: březen 2026  
> Role v linii: čistící a migrační větev před V3 mainnet trackem

v2.9.9 je čistící release: cílem není přidávat funkce ani měnit výstup konsenzu, ale odstranit legacy balast a uzamknout auditovatelný základ.

## Co je klíčové

- Jeden PoW profil v runtime (`cosmic_harmony` = Ekam Deeksha).
- Jedna aktivní dispatch cesta v miner flow.
- Redukce duplicit a mrtvých fallbacků.
- Příprava čisté migrace do V3 mainnet-track repozitáře.

## Principy release

- Odebírat, ne přidávat.
- Jediný zdroj pravdy (source of truth).
- Zachovat kompatibilitu s poolem.
- Záměr nulové změny hash výstupu konsenzu.

## Dokumenty v této větvi

- `v2.9.9/changelog.md` — změnová osa a rozsah čištění
- `v2.9.9/migration.md` — mapování zamýšleného přechodu 2.9.9 → V3
