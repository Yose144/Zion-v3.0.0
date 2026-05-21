# ZION OASIS — V3 L4 Integration

> Propojení legacy docs2.9 OASIS s `V3/L4/oasis` mainnet-track crate.

---

## Status Migrace (2026-05-21)

| Komponenta | docs2.9 | V3/L4/oasis | Stav |
|------------|---------|-------------|------|
| Avatar roster (202 postav) | `AVATAR_ROSTER.md` | `V3/L4/docs/AVATARS/` | ✅ Přehled přenesen do V3 |
| Sacred Trinity (17 Hindu) | `SACRED_TRINITY/` | `V3/L4/docs/AVATARS/sacred-trinity.md` | ✅ Základní 17 přeneseno |
| Golden Egg hra | `GOLDEN_EGG_GAME/` | `V3/L4/oasis/src/golden_egg.rs` | ✅ Kód existuje, docs v V3 |
| Consciousness levels | `SACRED_KNOWLEDGE/` | `V3/L4/oasis/src/levels.rs` | ✅ 9 Sefirot v kódu |
| UE5 projekt | — | `V3/L4/oasis/ue5/` | ✅ Existuje |
| Guildy & teritoria | — | `V3/L4/oasis/src/guild.rs`, `territory.rs` | ✅ Existuje |

---

## Kanonická pravda

Pro **mainnet-track vývoj** platí následující pořadí zdrojů pravdy:

1. `V3/L4/oasis/src/` — Rust kód (player, levels, golden_egg, guild, territory, combat, ...)
2. `V3/L4/docs/` — Tato dokumentace (avatar systém, game systémy, API, UE5)
3. `docs/docs2.9/ZION_OASIS/AVATAR_ROSTER.md` — Legacy plný roster 202 avatarů (referenční)
4. `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/` — Individuální bios (referenční)

**Nové změny** se píšou primárně do `V3/L4/`. Legacy docs2.9 zůstávají jako archiv a inspirace.

---

## Co se změnilo vůči docs2.9

### Avatar systém

- **Core roster:** 51 avatars (zůstává)
- **Extended roster:** 151 avatarů — plánováno jako DLC/expanze Q3–Q4 2026
- **NFT rarity:** Přesunuto on-chain (původně jen koncept)
- **Quest lines:** Každý avatar má 5 questů, ale implementace je nyní v `src/quests.rs` a `UE5_AvatarQuestTable.csv`

### Consciousness Levels

- Původně teoretický koncept v `SACRED_KNOWLEDGE/` → nyní plně implementováno v `src/levels.rs` s feature unlocks
- XP tabulka a multiplikátory jsou nyní konfigurovatelné v `data/world.json`

### Golden Egg

- Původně čistě textový treasure hunt v `GOLDEN_EGG_GAME/` → nyní má backend engine (`src/golden_egg.rs`)
- 108 clues, 3 Master Keys, DAO approval mechanismus — vše v kódu
- Prize tiers (8.25B ZION) zůstávají, distribuce bude via L2 DAO treasury

---

## Odkazy

| Co | Cesta |
|----|-------|
| V3 L4 crate | `../../V3/L4/oasis/` |
| V3 L4 docs | `../../V3/L4/docs/` |
| Avatar roster (full) | `./AVATAR_ROSTER.md` |
| Sacred Trinity bios | `./SACRED_TRINITY/` |
| Golden Egg lore | `./GOLDEN_EGG_GAME/` |
