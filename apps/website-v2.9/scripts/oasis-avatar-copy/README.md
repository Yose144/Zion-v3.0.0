# Veřejné texty avatarů (cs + en)

Tahle složka je **jediné místo, kde se editují texty avatarů** na
`/l4-oasis/avatars`. Jeden JSON per kruh, klíč = `id` avatara.

```json
{
  "63": {
    "subtitle":  { "cs": "Pele", "en": "Pele" },
    "role":      { "cs": "Ta, která tvoří tím, že spálí", "en": "She who creates by burning" },
    "location":  { "cs": "Kilauea, ostrov Havaj", "en": "Kīlauea, Hawaiʻi" },
    "questLine": { "cs": "…", "en": "…" },
    "teaching":  { "cs": "…", "en": "…" },
    "ability":   { "cs": "…", "en": "…" },
    "quote":     { "cs": "…", "en": "…" },
    "essence":   { "cs": "…", "en": "…" }
  }
}
```

Pravidla:

- **Vždy oba jazyky.** Chybí-li `cs`, stránka spadne na `en` (radši
  anglicky než prázdno).
- `essence` je volitelná — nepíše se, pokud stačí verze z
  `scripts/oasis-essence-i18n.json`.
- Žádný markdown (`**`, `· Quest: …`). Jedna až dvě věty, věcný tón,
  žádné interní zkratky („DAO timelock", „CL 4–8", „NFT").
- Jména postav se nepřekládají ani nekomolí.
- Prázdný `questLine` znamená „tahle postava linii nemá" — UI ji skryje.

Po editaci:

```bash
node scripts/gen-oasis-avatars.mjs   # z apps/website-v2.9
npx tsc --noEmit
```

`src/lib/oasis/avatars.ts` je generovaný výstup — needituj ho.
