# Mise Amenti
## Kanon 3.3 „Nirvana“ — společná ústava, mapa příběhu, technický závazek a stoletý kompas ZION TerraNova

> **Status:** Kanonický integrační corpus pro plánování a komunikaci ZION 3.3 „Nirvana“.  
> **Platnost kanonizace:** 2026-08-31.  
> **Rozsah:** L1–L6, příběh čtyř knih, onboarding, Sůl této země, Nirvana, NirvanaCloud, Mise Amenti, Generace Z a horizont 2026–2126.  
> **Nejde o release deklaraci:** tento adresář nemění verzi běžícího binárního protokolu, stav nasazení ani technické důkazy. Ty se vždy ověřují podle živého kódu a provozního stavu.

---

## Proč vzniká Mise Amenti

ZION už má mnoho silných dokumentů — technické plány, whitepapery, onboarding, příběhové knihy, provozní runbooky a rozšíření NirvanaCloud. Bez společného středu ale mohou vedle sebe existovat dvě nebezpečí:

1. **Příběh začne předbíhat skutečnost.** Horizont se omylem čte jako hotový produkt.
2. **Technika ztratí smysl.** Lidé vidí jen porty, kontrakty a testy, ale nevidí, jaký lidský problém má síť řešit.

`MiseAmenti/` je společný střed. Není novým whitepaperem, náhradou za kód ani novým náboženstvím. Je to **kanonická integrační vrstva**, která drží pohromadě:

- **důkaz** — co lze dnes ověřit;
- **stavbu** — co se aktivně vytváří a má měřitelné výstupy;
- **horizont** — dlouhodobý směr, který není slíbeným produktem;
- **příběh** — lidský jazyk, který pomáhá rozumět smyslu, ale nikdy nepřepisuje fakta.

---

## Kanonické prohlášení

Od této chvíle je `MiseAmenti/` **primárním integračním kanonem pro ZION 3.3 „Nirvana“**. Všechny nové dokumenty nebo změny, které se týkají celkové mise 3.3, musí z tohoto corpus vycházet nebo se na něj explicitně odkázat.

To neznamená, že se sem kopíruje celý repozitář. Naopak: **zdrojové dokumenty zůstávají na svých místech**, aby nevznikaly zastaralé kopie. Mise Amenti je jejich jasně řízená mapa a ústava.

### Pořadí pravdy při rozporu

| Priorita | Zdroj | O čem rozhoduje |
|---|---|---|
| 1 | Běžící síť, on-chain data, verifikovaný build a zdrojový kód | Co opravdu funguje, co je v konsensu, co bylo nasazeno |
| 2 | [`StatusV3.md`](../../../StatusV3.md), [`V31/STATUS.md`](../../../V31/STATUS.md), bezpečnostní reporty a `AGENTS.md` | Provozní stav, incidenty, aktivní konfigurace a limity |
| 3 | [`03-Zivy-Zaklad-3.3.md`](./03-Zivy-Zaklad-3.3.md) a [`07-Registr-Dukazu.md`](./07-Registr-Dukazu.md) | Kurátorovaný obraz skutečného stavu 3.3 a podkladů |
| 4 | [`04-Exekucni-Charta-3.3.md`](./04-Exekucni-Charta-3.3.md) | Co se smí označit jako aktivní práce, cíl nebo release gate |
| 5 | [`../V33_NIRVANA_MASTER_PLAN.md`](../../../V33_NIRVANA_MASTER_PLAN.md) | Technický předchůdce a detailní pracovní materiál pro 3.3 |
| 6 | `docs/WP-Mainet/` — whitepapery, onboarding, Sůl Země, Nirvana a NirvanaCloud | Výklad, veřejné pozvání, příběh a inspirace |

**Kód a provoz vždy vítězí nad tímto corpus.** Pokud je zde rozpor, je to dokumentační chyba, kterou je třeba opravit — ne duchovní či politický spor.

---

## Slovník, který chrání význam

- **Mise Amenti** — literární a organizační název pro dlouhodobý závazek uchovat ověřitelné vědění, lidskou důstojnost, svobodu volby a schopnost obnovy napříč krizemi. Nejde o historické tvrzení o skutečných „Síních Amenti“.
- **Nirvana** — obraz stavu, kdy technologie přestává živit strach, dluh a závislost na pozornosti. Nejde o náboženský nárok ani o příslib ráje.
- **Global Assimilation** — výhradně **dobrovolná interoperabilita, otevřené přijetí a spolupráce**. Nikdy kulturní, politické, ekonomické nebo osobní donucování.
- **Global Attention** — lidská pozornost a výpočetní kapacita směrované ke vzdělávání, péči, tvorbě a ověřitelnému přínosu; nikdy dark patterns, závislostní UX nebo manipulace.
- **Vědomí / consciousness** — v narativních textech metafora pro pozornost, etiku a koherenci. Dokument nikde netvrdí, že software, model nebo agent má prokazatelně subjektivní vědomí či duchovní autoritu.
- **ŽIVÉ / STAVBA / HORIZONT / HYPOTÉZA / MÝTUS** — povinné značky stavu nároků definované v [`01-Kanon-a-Ustava.md`](./01-Kanon-a-Ustava.md).

---

## Číst podle své cesty

| Jsem… | Začnu zde | Potom |
|---|---|---|
| **Pozorovatel** | [`01-Kanon-a-Ustava.md`](./01-Kanon-a-Ustava.md) | [`03-Zivy-Zaklad-3.3.md`](./03-Zivy-Zaklad-3.3.md), veřejný onboarding |
| **Stavitel / vývojář** | [`04-Exekucni-Charta-3.3.md`](./04-Exekucni-Charta-3.3.md) | [`07-Registr-Dukazu.md`](./07-Registr-Dukazu.md), `V31/` |
| **Operátor / bezpečnostní reviewer** | [`05-Autonomie-a-Bezpecnost.md`](./05-Autonomie-a-Bezpecnost.md) | `AGENTS.md`, `V31/AGENTS.md`, `StatusV3.md` |
| **Čtenář příběhu** | [`02-Pribeh-a-Architektura.md`](./02-Pribeh-a-Architektura.md) | `docs/WP-Mainet/SulZeme/`, `nirvana/`, `NirvanaCloud/` |
| **Člověk z Generace Z / budoucí komunity** | [`06-Generacni-Kompas-2026-2126.md`](./06-Generacni-Kompas-2026-2126.md) | `NirvanaCloud/06` a `NirvanaCloud/07` |
| **Editor či budoucí správce canonu** | [`08-Protokol-Zmen.md`](./08-Protokol-Zmen.md) | [`CHANGELOG.md`](./CHANGELOG.md) |

---

## Obsah corpus

1. [`01-Kanon-a-Ustava.md`](./01-Kanon-a-Ustava.md) — závazné zásady, hierarchie důkazů a pět stavů tvrzení.
2. [`02-Pribeh-a-Architektura.md`](./02-Pribeh-a-Architektura.md) — cesta od čtyř knih přes onboarding a Sůl Země až k Nirvaně a Mise Amenti.
3. [`03-Zivy-Zaklad-3.3.md`](./03-Zivy-Zaklad-3.3.md) — věcný L1–L6 baseline: co je živé, co se staví a co je horizont.
4. [`04-Exekucni-Charta-3.3.md`](./04-Exekucni-Charta-3.3.md) — workstreamy, závislosti, akceptační kritéria a release gates.
5. [`05-Autonomie-a-Bezpecnost.md`](./05-Autonomie-a-Bezpecnost.md) — hranice Hiran/Maestro/Amitábha, lidské schválení, klíče, finance a incident response.
6. [`06-Generacni-Kompas-2026-2126.md`](./06-Generacni-Kompas-2026-2126.md) — odpověď na globální krize a stoleté scénáře bez falešných predikcí.
7. [`07-Registr-Dukazu.md`](./07-Registr-Dukazu.md) — registr zdrojů a přesný stav klíčových nároků.
8. [`08-Protokol-Zmen.md`](./08-Protokol-Zmen.md) — jak se canon mění, reviduje, překládá a případně zveřejňuje.
9. [`CHANGELOG.md`](./CHANGELOG.md) — neměnná stopa změn tohoto corpus.

Anglický vstupní bod pro globální spolupracovníky: [`README_EN.md`](./README_EN.md).

---

## První slib Mise Amenti

> **Nežádej víru tam, kde lze nabídnout důkaz.**  
> **Neprodávej horizont jako současnost.**  
> **Nech každého svobodně vstoupit, svobodně zpochybnit a svobodně odejít.**  
> **Když se vize střetne s faktem, oprav vizi — nikdy fakt.**

Toto je kanonická forma „záchranné mise“: ne záchrana lidí proti jejich vůli, ale uchování nástrojů, pravdy, paměti a vzájemné pomoci, aby se lidé mohli zachraňovat společně.
