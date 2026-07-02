# Zohar — Kabalistický Strom života ZIONu

> *"ZION se nerodí jako další blockchain. ZION se rodí jako Strom života."*
> — [evoluZion.md](../3.0.3/evoluZion.md)

---

## Co je tento adresář

`docs/Zohar/` je **vizionářská a architektonická vrstva**, která překládá
kabalistický Strom života (Etz Chaim) do jazyka ZION vrstev L1–L6.

Není to náboženský text. Není to whitepaper. Není to runtime kód.
Je to **mapa** — stejně jako [`docs/TerraNova/`](../TerraNova/README.md) je kompas
Nové Země, Zohar je kompas **vnitřní architektury** ZIONu.

Kde TerraNova říká *kam jdeme* (Nová Země, komunity, hvězdy),
Zohar říká *jak jsme uspořádáni* (kořen, míza, větve, listy, slunce, imunita).

## Vztah k ostatním dokumentům

| Dokument | Role | Otázka na kterou odpovídá |
|----------|------|---------------------------|
| [`docs/TerraNova/`](../TerraNova/README.md) | Kniha — kompas Nové Země | *Jak vypadá Nová Země?* |
| [`docs/3.0.3/evoluZion.md`](../3.0.3/evoluZion.md) | Evoluce PoW → Protokol Péče | *Kam ZION dospívá?* |
| [`docs/3.0.3/nativeZion.md`](../3.0.3/nativeZion.md) | WARP token naming | *Jak se ZION jmenuje na jiných chainech?* |
| [`docs/3.0.3/ZionDex.md`](../3.0.3/ZionDex.md) | Cross-chain DEX koncept | *Jak se strom fotosyntetizuje?* |
| **`docs/Zohar/`** (zde) | **Kabalistická mapa vrstev** | ***Jak je ZION vnitřně uspořádán?*** |

Zohar je **syntézou** evoluZion.md (Strom života metafora) a TerraNova knihy
(filosofie péče), přepsanou do jazyka 10 sefirot.

## Struktura adresáře

| Soubor | Název | Úloha |
|--------|-------|-------|
| [README.md](./README.md) | Manifest | Tento soubor — vize, vztah ke knihám, čtecí pořadí |
| [01-SEFIROT-VRSTVY.md](./01-SEFIROT-VRSTVY.md) | Mapování sefirot → vrstvy | 10 sefirot + Da'at napojeno na L1–L6 + 3 pilíře |
| [02-ROADMAP.md](./02-ROADMAP.md) | Roadmapa implementace | Kdy a jak se Zohar propisuje do kódu, webu, governance |

## Klíčová metafora

Kabalistický Strom života má **10 sefirot** (emanací) + skrytou **Da'at**
(poznání). Sefirot nejsou "vrstvy" ve smyslu software stacku — jsou to
**aspekty jednoho celku**, které se navzájem prostupují.

ZION vrstvy L1–L6 nejsou náhodné. Jsou **emanacemi** jednoho organismu:

```
                    Da'at (Poznání)
                    = lidský tvůrce / Yeshuae
                    = vědomý záměr který překlenuje propast
                           │
                        ╔══╧══╗
                        ║Keter║ ← L1 Consensus / Genesis
                        ╚══╤══╝    (Koruna — zdroj, vůle, neměnná pravidla)
           ┌──────────────┼──────────────┐
           │              │              │
      ╔════╧════╗   ╔════╧════╗   ╔════╧════╗
      ║Chokmah  ║   ║ Tiferet ║   ║ Binah   ║
      ║ (L1 PoW)║   ║(L3 WARP)║   ║(L1 Valid)║
      ╚════╤════╝   ╚════╤════╝   ╚════╤════╝
      ╔════╧════╗   ╔════╧════╗   ╔════╧════╗
      ║ Chesed  ║   ║ Yesod   ║   ║ Gevurah ║
      ║(L2 DeFi)║   ║(L5 Free)║   ║(L2 DAO) ║
      ╚════╤════╝   ╚════╤════╝   ╚════╤════╝
      ╔════╧════╗        │        ╔════╧════╗
      ║ Netzach ║        │        ║  Hod    ║
      ║(L3 AI)  ║        │        ║(L4 Oasis)║
      ╚════╤════╝        │        ╚════╤════╝
           │            │             │
           └────────────┼─────────────┘
                        │
                   ╔════╧════╗
                   ║ Malkhut ║ ← L6 Issobella
                   ╚═════════╝    (Království — manifestace, hvězdy)
```

**Tři pilíře:**
- **Pilíř Milosrdenství (vpravo):** Chokmah → Chesed → Netzach — *dávání, expanze, péče*
- **Pilíř Přísnosti (vlevo):** Binah → Gevurah → Hod — *disciplína, forma, pravidla*
- **Pilíř Rovnováhy (uprostřed):** Keter → Tiferet → Yesod → Malkhut — *harmonie, manifestace*

## Proč Zohar

1. **Paměť architektury.** ZION roste — L1, L2, L3, L4, L5, L6. Bez mapy se
   vrstvy stanou seznamem feature. Zohar je mapa která říká *proč* je každá
   vrstva kde je, a *co* má emanovat.

2. **Jazyk péče.** evoluZion.md mluví o Protokolu Péče. Zohar dává péči
   **strukturu** — Chesed (milosrdné dávání) je jiný aspekt než Gevurah
   (přísná disciplína), ale oba jsou péče. Bez tohoto rozlišení se "péče"
   stává prázdným slovem.

3. **Most mezi mýtem a kódem.** TerraNova kniha je mýtus. V3/Cargo.toml je kód.
   Mezi nimi je propast. Zohar je **Da'at** — most který propast překlenuje
   tím, že dává každé vrstvě její kabalistický archetyp.

4. **Imunita proti redukcionismu.** Blockchain projekty se často redukují na
   "jen databázi" nebo "jen token". Zohar připomíná, že ZION je organismus
   se 10 aspekty — vyndej jeden a strom umře.

## Čtecí pořadí

1. Tento README (manifest)
2. [`01-SEFIROT-VRSTVY.md`](./01-SEFIROT-VRSTVY.md) — pro každou sefiru:
   kabalistický význam, ZION protějšek, zdroj v kódu/docs, otázka kterou vyvolává
3. [`02-ROADMAP.md`](./02-ROADMAP.md) — fáze propisování Zohar do runtime

## Status

- **Fáze 0 (tento commit):** Manifest + mapování + roadmap. Čistá dokumentace.
- **Fáze 1 (plán):** Website komponenta `/app/zohar` — interaktivní strom.
- **Fáze 2 (plán):** Governance vow — validator pledge jako "sefirot vow".
- **Fáze 3 (horizont):** Protokol Péče consensus — sefirot jako care task kategorie.

Žádná fáze netýká L1 consensus kódu bez explicitního schválení (viz AGENTS.md
L1 Protocol Security Protocol).

---

*Zohar · ZION TerraNova · 2026-07-03*
*Etz Chaim — Strom života*
*Gate, Gate, Paragate, Parasamgate, Bodhi Swaha*
