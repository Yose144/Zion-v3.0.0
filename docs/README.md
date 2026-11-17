# docs/ — index a pravidla zařazování

> **Verze:** 2026-11-17 · **Předchozí stav:** ~80 volných souborů navrchu, žádná mapa.
> Kanonizace: soubory roztříděny do bucketů (`git mv`), `AGENTS.md` zeštíhlen
> (datovaný log → `OPS-LOG.md`).

## Kam co patří

| Kam | Co tam jde |
|---|---|
| `reports/` | Datované reporty, audity, incidenty, status snapshoty (`REPORT_*`, `AUDIT_*`, `STATUS_*`, `SESSION_*`) |
| `plans/` | Plány, roadmapy, návrhy (`*_PLAN`, `*_ROADMAP`, `NextSteps`) |
| `ops/` | Runbooky, guide, topologie, benchmarky, **`KNOWN-ISSUES.md`** (otevřené chyby + pasti) |
| `mainnet/` | Mainnet checklists, konstituce, genesis, premine, readiness |
| `whitepaper/` | Whitepaper kapitolově + `whitepaper-v3.0.4.md`, `ZION_CODEX_*` |
| `oasis/` | OASIS devlog (+ překlady cs/es/fr/pt) a Oáza reference |
| `LEGAL/` | Právní dokumenty: disclaimer, risk, privacy, terms, token disclosure, jurisdiction |
| `security/` | Security disclosure, `vulnerabilities.json` |
| `private/` | Interní/succession dokumenty, PGP signed statements, klíče |
| `marketing/` | Produktové a prodejní dokumenty (Lumi, Marketplace) |
| `book/` | Knihy a narativ (`ekam-deeksha/`, `QUANTUM_REVOLUTION`) |
| `banner/`, `listings/`, `lang/` | Assety: bannery, listing copy, README překlady |
| `stargate/` | Stargate téma |
| `v2.9.6/`, `docs2.9/` | Verzí-specific dokumentace 2.9.x |
| `ARCHIVE/` | Zastaralé/superseded dokumenty (nic se nemaže, archivuje) |
| `2.9.5` … `3.3` | Verzí-specific dokumentace; `3.2/` a `3.3/` drží `REPORTS/` |
| `ChV3/`, `Miners/`, `TerraNova/`, `WP*/`, `Zohar/`, `verus/` | Tematické celky |

## Kanonické soubory navrchu

- `README.md` — tenhle index
- `CODE_VS_DOCS.md` — hierarchie pravdy (kód > kanon > dokumenty)
- `FAQ.md` — časté dotazy
- `REPO-MAP.md` — mapa repozitáře
- `OPS-LOG.md` — **datovaný provozní log** (🆕 záznamy, nejnovnější nahoře)

## Pravidla

1. **Nový dokument = nový soubor ve správném bucketu**, ne přírůstek do `AGENTS.md`.
2. Datovaný provozní záznam → `OPS-LOG.md` (stručně) + detail do `reports/` nebo `3.x/REPORTS/`.
3. Otevřená chyba/past → `ops/KNOWN-ISSUES.md`; po vyřešení přesunout do „Vyřešené".
4. Verzí-specific materiál → do `docs/<verze>/`, ne navrch.
5. Přesuny jen přes `git mv` (historie zůstává); smazání jen přes `git rm`.
6. Verzí adresáře `2.9.5`…`3.3` jsou **historické** — nové věci do aktuální verze (`3.3/`), ne do starých.

## Poznámka k `3.3.0/`

Repo `3.3.0/` má **vlastní** `AGENTS.md` a `docs/` — jeho pravidla (max ~500 řádků AGENTS.md,
reporty do `docs/reports/`) platí pro soubory **uvnitř** `3.3.0/`, ne pro tento strom.
 Tento `docs/` pokrývá archivovaný root (3.2 a starší) + sdílené materiály.
