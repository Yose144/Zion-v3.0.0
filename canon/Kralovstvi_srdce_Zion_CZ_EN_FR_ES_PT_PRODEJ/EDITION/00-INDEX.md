# EDITION — edice Království srdce ve všech jazycích

Tahle složka drží **všechny edice knihy Království srdce** v pěti základních jazycích.
Vlajková ilustrovaná edice zůstává v kořeni prodejního adresáře; tady jsou ostatní
ediční linie, každá připravená na překlad do EN / ES / FR / PT.

Aktuální stav kdykoli zobrazíš:

```bash
cd EDITION
uv run _scripts/build_edition.py --check
```

Stavová matice je v [`00-STAV.md`](./00-STAV.md) (generovaná, neupravovat ručně).

---

## Struktura

```
EDITION/
├── 00-INDEX.md                    ← tento soubor
├── 00-STAV.md                     ← generovaná matice edice × jazyk
├── _scripts/
│   ├── build_edition.py           ← sázečka Markdown → PDF + EPUB
│   └── README.md
├── 00-nova-plavba/                ← vlajková edice (produkty v kořeni, zde jen odkaz)
├── klasicka/CZ|EN|ES|FR|PT/
├── cloude/
├── gemini/
├── gpt/
├── groq/
├── quen/
└── deepseek/
```

Každá edice má pět jazykových složek. Když v jazykové složce leží rukopis, sázečka
z něj udělá PDF a EPUB **vedle** něj. Prázdná složka = jazyk zatím neexistuje.

---

## Pojmenování souborů

V každé jazykové složce platí stejný vzor, jen s lokalizovaným názvem knihy:

| Složka | Vzor názvu | Příklad (gemini) |
|---|---|---|
| `CZ/` | `Kralovstvi_srdce_<edice>_CZ` | `Kralovstvi_srdce_gemini_CZ.md` |
| `EN/` | `Kingdom_of_the_Heart_<edice>_EN` | `Kingdom_of_the_Heart_gemini_EN.md` |
| `ES/` | `El_Reino_del_Corazon_<edice>_ES` | `El_Reino_del_Corazon_gemini_ES.md` |
| `FR/` | `Le_Royaume_du_Coeur_<edice>_FR` | `Le_Royaume_du_Coeur_gemini_FR.md` |
| `PT/` | `O_Reino_do_Coracao_<edice>_PT` | `O_Reino_do_Coracao_gemini_PT.md` |

Ke každému rukopisu vznikají tři odvozené soubory:

- `<název>.pdf` — sazba A5, stejný formát jako prodávaná ilustrovaná edice
- `<název>.epub` — EPUB 3 s obsahem a titulní stranou
- `<název>.kontrola.json` — počty slov, nadpisů, stran a dokumentů (kontrola sazby)

---

## Jak přidat jazyk

1. Přelož český rukopis dané edice a ulož ho do příslušné jazykové složky
   podle vzoru výše (`.md`, běžný Markdown jako zdroj).
2. Spusť sazbu:

   ```bash
   uv run _scripts/build_edition.py --only gemini --lang EN
   ```

3. Zkontroluj PDF a `*.kontrola.json`, pak teprve nabídni k prodeji.

Bez přepínačů skript sází všechno, co v `EDITION/` najde:

```bash
uv run _scripts/build_edition.py
```

---

## Co je hotové a co ne

| Edice | Stav před prodejem |
|---|---|
| **00-nova-plavba** (ilustrovaná) | ✅ Hotová v pěti jazycích, v kořeni adresáře |
| **klasicka** | Český text je původní midraš s pramennými tabulkami — sedí; chybí 4 překlady |
| **gemini** | Nejúplnější literární verze (24 kapitol). Český text sedí; chybí 4 překlady |
| **deepseek** (Kniha Kýlu) | Prolog + 12 zastavení + epilog + doslov; chybí 4 překlady |
| **quen** (Účetnice) | Uzavřená samostatná edice; chybí 4 překlady |
| **groq** (Loď, která se ptá) | Uzavřená samostatná edice; chybí 4 překlady |
| **gpt** | ⚠️ Obsahuje jen kapitoly 10–24; první půli je nutné převzít z Gemini edice a spojit do jednoho rukopisu |
| **cloude** (Cedrový kýl) | ⚠️ Zdroj je prostý text bez nadpisů a členění — nejdřív redakce do Markdownu, pak sazba |

**Pozor na povahu textů:** české rukopisy jsou pracovní verze, ne finální nakladatelská
adata. Nemají ISBN, tiráž ani jazykovou redakci. Prodejní edice musí projít redakcí
a kontrola sazby (`*.kontrola.json`) je technická, ne literární.

---

## Co sazba umí

- **Nadpisy** — titul, podtitul, části, kapitoly; úrovně zalomení a obsah se řídí
  konfigurací edice v `_scripts/build_edition.py` (`break_levels`, `toc_levels`).
- **Běžný text** — zarovnaný do bloku, tučné a kurzivní písmo, odkazy redukované na text.
- **Citace** — odsazené kurzívou se svislou linkou.
- **Tabulky** — dvou až čtyřsloupcové; víc sloupců se na A5 rozepíše do řádků.
- **Seznamy, oddělovače, bloky kódu.**
- **Titulní strana a tiráž** — s edicí, jazykem, datem a stavem rukopisu.
- **Obsah s čísly stran** (PDF) a navigace (EPUB).

Co sazba **neumí** a musí se dodat zvlášť: ilustrace, obálka s hřbetem, PDF/X pro tisk,
hyphenace (čeština láme slova bez dělení, takže někdy vznikají řídké řádky).

---

## Volitelná metadata

Chceš-li konkrétnímu rukopisu určit titul, podtitul nebo tirážní údaje, přidej vedle
něj soubor `<stejný název>.meta.json`:

```json
{
  "title": "Království srdce",
  "subtitle": "Příběh lodi, kterou postavil tesař",
  "edition_label": "Gemini edice · Svorník korpusu",
  "author": "Zion",
  "date": "2026-11-03",
  "lang": "cs",
  "status_note": "pracovní rukopis"
}
```

Bez metadat si skript vezme titul z prvního nadpisu a podtitul z nadpisu následujícího.
