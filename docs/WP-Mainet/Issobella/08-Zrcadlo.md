# ISSOBELLA — Kapitola 8: Zrcadlo
## Zrcadlo · L4 ↔ L6 / web — jak se stanice ukazuje lidem, a kde přesně zrcadlo končí

> *„Zrcadlo, které lže, je horší než žádné okno."*

---

## Příběh

Poutníci se jednou zeptali Kormy: *„Když stanice ještě neletí, jak to, že ji lidé vidí?"*

Korma je zavedl do malé místnosti, kde na stěně visely obrázky — skica prstence, tabulka s roky, seznam knih k přečtení. *„Tohle je zrcadlo,"* řekl. *„Ukazuje, co si lidé mají myslet — a musí ukazovat pořádně, jinak lže."*

Ukázal na první obrázek. *„Tady je stanice nakreslená na stránce `/l6-issobella`. Vidíš: oběžná dráha čtyři sta až pět set padesát kilometrů, prstenec s umělou gravitací, kvantová laboratoř. Ale podívej se, co tam stojí vedle obrázku — *Vize*. Ne *Stavba*. Ne *Hotovo*. Vize. Slovo, které říká pravdu."*

Ukázal na druhý obrázek — tabulku roků. *„Dva tisíce třicet: laboratoř na Zemi. Třiatřicet: demonstrátor. Třicet pět: malá družice. Čtyřicet pět: komponenty stanice. Kdo si přečte léta pozorně, vidí: tohle není letový řád. Je to cesta, po které se teprve jde."*

A pak ukázal na třetí obrázek — seznam dokumentů. *„A tady je zrcadlo nejupřímnější: knihovna. Architektura stanice, kvantový motor, umělá gravitace, lidské faktory, historie. Kdo chce, může si přečíst přesně to, co my čteme. Zrcadlo neskrývá své zdroje."*

*„A kde zrcadlo končí?"* zeptal se nováček.

*„Tam, kde by muselo lhát. Kdyby ukazovalo modul na oběžné dráze — lže, žádný tam není. Kdyby ukazovalo zůstatek, který se utrácí — lže, fond neutrácí. Kdyby tvrdilo, že kvantový motor funguje — lže, je to hypotéza. Zrcadlo končí přesně tam, kde končí pravda — a dobře postavené zrcadlo si tu hranici píše na okraj, aby ji nikdo nepřehlédl."*

---

## Co to znamená

**Issobella už žije — ale jen jako zrcadlo.** Ne na orbitě, ale na třech místech, kde si ji člověk může prohlédnout pořádně:

**Web `/l6-issobella`** (`APP&WEB/website-v2.9/src/app/l6-issobella/page.tsx`) — veřejná stránka vrstvy. Ukazuje:
- oběžnou dráhu 400–550 km a moduly stanice (Quantum Motor Bay, umělá gravitace, research library) — označené **Vize**,
- roadmapu 2030 → 2033 → 2035 → 2045+ — označenou **planned / vision**,
- premine kartu: 2,5 mld ZION, time-lock blok 144 000, admin multisig 3-of-3 + DAO vote,
- dokumentové karty vedoucí do katalogu.

**Katalog `/docs`** — servíruje celý výzkumný balík: `l6-readme`, `l6-architecture`, `l6-quantum-motor`, `l6-artificial-gravity`, `l6-human-factors`, `l6-history` — vše mapované na `APP&WEB/website-v2.9/public/docs/l6/*.md` (mirror `L6data/`).

**Dashboard** — operátorský pohled: L6 tracker (zůstatek fondu, metriky) v `ZION_OS/dashboard/app.py` a veřejné `MissionControlDashboard`. Read-only — dashboard ukazuje fond, ale fond neutrácí.

**OASIS** — vrstva L4 drží „krystalické světy"; L6 se tam zatím odráží jen jako příběh a směr, ne jako provozní svět.

**Hranice zrcadla** je tedy ostrá a čitelná: web říká *vize*, katalog říká *výzkum*, dashboard říká *fond*. Nikde se netvrdí *letí*. Tam, kde se příběh zrcadla snaží přejít za hranici, opravíme zrcadlo — ne pravdu.

---

## Kotva pravdy — ověřitelná fakta

| Obraz / tvrzení | Stav | Kotva |
|---|---|---|
| Veřejná stránka `/l6-issobella` existuje, zobrazuje stanici jako vizi (400–550 km, AG, kvantová laboratoř) | **ŽIVÉ** | `APP&WEB/website-v2.9/src/app/l6-issobella/page.tsx` (copy „Vize 2035+/2040+", premine karta) |
| Roadmapa 2030 → 2035 → 2045+ na webu | **ŽIVÉ** (jako zobrazený horizont) | `page.tsx` (timeline položky `planned`/`vision`) |
| Dokumenty `L6data/` servírované v katalogu `/docs` jako `l6-*` | **ŽIVÉ** | `APP&WEB/website-v2.9/src/app/docs/page.tsx` (mapování `l6-*` → `APP&WEB/website-v2.9/public/docs/l6/*.md`); samotné soubory v `APP&WEB/website-v2.9/public/docs/l6/` |
| Premine karta: 2,5 mld, lock 144 000, multisig 3-of-3 + DAO | **ŽIVÉ** | `page.tsx` (`genesisPremineAmount`, `genesisPremineDesc`); `v3_compat.rs` |
| Dashboard ukazuje L6 metriky (fond, tracker) | **ŽIVÉ** (operátorský pohled) | `StatusV3.md` 2026-08-23; `ZION_OS/dashboard/app.py` |
| L6 svět v OASIS | **STAVBA / HORIZONT** | OASIS drží L4 světy; L6 nemá vlastní provozní svět v `worlds.ts` |
| „Stanice existuje / letí" | **NEPLATNÉ TVRZENÍ** | Žádný modul na orbitě; horizont 2040+ |

---

*„Dobře postavené zrcadlo si hranici pravdy píše na okraj, aby ji nikdo nepřehlédl."*

**Navigace:** [← Kapitola 7: Hlídač na okraji](./07-Hlidac-Na-Okraji.md) · [Kapitola 9: Cesta poutníka →](./09-Cesta-Poutnika.md)
