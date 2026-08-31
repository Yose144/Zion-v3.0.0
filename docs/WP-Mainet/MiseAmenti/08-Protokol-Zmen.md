# 08 — Protokol změn
## Jak se Mise Amenti vyvíjí bez ztráty paměti, bez kultu autority a bez přepisování skutečnosti

> **Normativní status:** závazný postup pro změny tohoto corpus a pro všechna budoucí tvrzení o ZION 3.3 „Nirvana“.  
> **První pravidlo:** canon není kámen, který se nesmí opravit. Je to živá mapa, která musí opravit chybu dřív, než ji zakryje.

---

## 1. Životní cyklus dokumentu

```text
NÁMĚT
  ↓
DRAFT (jasně označený, bez nároku na pravdu)
  ↓
REVIEW (technika + bezpečnost + fakta + případně kultura/právo)
  ↓
KANON (přidán do indexu, evidence registru a changelogu)
  ↓
PUBLIC ADAPTATION (jen bezpečný, zkrácený a zkontrolovaný výňatek)
  ↓
REVIZE / ARCHIV (zachovat historii, opravit aktivní text)
```

Žádný dokument nepřeskakuje z nápadu přímo do veřejného „faktu“. Pokud obsahuje jednu nebo více neověřených částí, používá povinně značku `STAVBA`, `HORIZONT`, `HYPOTÉZA` nebo `MÝTUS`.

---

## 2. Třídy změn a minimální review

| Třída | Příklad | Potřebné review | Changelog |
|---|---|---|---|
| **A — Redakční** | Oprava gramatiky, rozbitý odkaz, zpřesnění bez změny významu. | Jeden editor; link check. | Souhrnně při větší dávce. |
| **B — Stavová** | „Funkce je live“, nová verze, ukončený gate, aktualizace evidence. | Technický reviewer + odkaz na důkaz. | Povinně: datum, zdroj, evidence. |
| **C — Bezpečnostní / finanční / privacy** | Custody, peněženka, agentní capability, auth, fund/DAO workflow. | Security reviewer + technický reviewer + owner odpovědnosti. | Povinně: threat model, rollback/revocation, limity. |
| **D — Konsensuální / governance** | Emise, hard fork, coinbase split, node reward activation, DAO pravomoc. | Formální governance proces, testnet/staging evidence, bezpečnostní review, migrace a rollback plán. | Povinně: plný decision record a compatibility matrix. |
| **E — Kulturní / veřejná komunikace** | Použití náboženské tradice, historické postavy, zdravotní/naučný claim, překlad do veřejného textu. | Factual/legal editor + kulturní consultant podle tématu + public-copy review. | Povinně, pokud mění význam či riziko. |

V pochybnosti se změna zařazuje do vyšší třídy. Rychlost není důvod ke snížení práhu review.

---

## 3. Povinný formát návrhu změny

Každý nebanální návrh přidá na začátek nebo do pull requestu/issue:

```markdown
## Záměr
Co se má změnit a komu to slouží?

## Stav tvrzení
ŽIVÉ / STAVBA / HORIZONT / HYPOTÉZA / MÝTUS

## Důkaz
Odkaz na kód, test, commit, on-chain data, audit nebo externí zdroj.

## Rizika
Bezpečnost, finance, privacy, kultura, právní/komunikační riziko.

## Hranice
Co tato změna výslovně netvrdí a co neumí.

## Review
Kdo musí návrh zkontrolovat a proč?

## Rollback / oprava
Jak se změna vrátí nebo jak se komunikuje chyba?
```

Tento formát slouží i pro AI agenta: model může návrh vyplnit, ale **nemůže sám rozhodnout, že je review dostatečné**.

---

## 4. Opravy rozporů a historická paměť

Když se objeví rozpor mezi příběhem a kódem, postup je tento:

1. **Nahlásit rozpor bez obrany identity projektu.** „Text je nepřesný“ není útok na misi.
2. **Ověřit zdroj pravdy** podle tabulky v [`README.md`](./README.md).
3. **Opravit aktivní text** a snížit stav nároku, pokud pro něj důkaz zmizel.
4. **Nezahladit historii.** Changelog zachová, co bylo napsáno, kdy a proč se to změnilo.
5. **Pokud šlo o veřejný nebo finančně významný nárok**, vydat viditelnou opravu, ne jen tichý commit.

Historické dokumenty se nemažou jen proto, že obsahují zastaralé informace. Označí se jako historické a aktivní canon na ně naváže vysvětlením. Ztráta historie opakuje přesně chybu, kterou má Archa záznamů zabránit.

---

## 5. Pravidla veřejného vydání

`MiseAmenti/` je interní kořenový corpus. Jakýkoliv jeho obsah určený do `public/`, webu, whitepaperu, sociálních médií nebo press materiálu musí projít samostatným veřejným filtrem:

1. **Žádné secrets:** žádné seed phrase, privátní klíče, API tokens, interní hostnames, neveřejné IP adresy, service paths nebo provozní data.
2. **Žádné nadsazení stavu:** HORIZONT/HYPOTÉZA se nezkracuje tak, aby vypadaly jako ŽIVÉ.
3. **Žádná finanční manipulace:** žádné predikce ceny, garantované výnosy, časový tlak, FOMO ani „poslední šance“.
4. **Žádná duchovní manipulace:** žádná výzva k víře, žádná falešná lineage, žádné používání buddhistických či jiných symbolů jako měny autority.
5. **Žádné přebírání cizích práv:** historie, obrazový materiál, značky a citace mají jasný původ a oprávnění.
6. **Právní a kulturní čitelnost:** rizika, custody model, omezení a zdroje jsou viditelné pro běžného čtenáře.
7. **Překladové review:** anglický nebo jiný jazyk nesmí zesílit jistotu, emoci či finanční význam proti schválenému originálu.

Pravidla `AGENTS.md` pro `public/` subtree mají nad tímto dokumentem přednost.

---

## 6. Pravidelný cyklus revalidace

| Spouštěč | Co se musí zkontrolovat |
|---|---|
| Nový release / hard fork | Verze, feature matrix, migration guide, compatibility, known limitations. |
| Incident nebo downtime | `StatusV3.md`, security disclosure, narativní claims, runbook a changelog. |
| Změna L2/ZIS/agentní capability | Custody, consent, privacy, API scope, rate limits, rollback a public wording. |
| Nový L5/L6 projekt | Impact packet, rozpočet, governance record, recipient consent, independent verification. |
| Nová fyzikální/DeSci hypotéza | Literature review, falsifiability, method/data policy, clear hypothesis label. |
| Každé 3 měsíce | Broken links, live-state drift, translations, stale dates, unfulfilled gates. |

---

## 7. Předání canonu další generaci

Každý maintainer má odpovědnost udělat svůj přínos čitelný člověku, který přijde po něm a nezná žádný interní kontext:

- proč bylo rozhodnutí přijato;
- jaký důkaz tehdy existoval;
- jaké alternativy byly zamítnuty;
- co stále nevíme;
- jak lze rozhodnutí bezpečně zvrátit;
- kdo má právo změnu navrhnout, ověřit a odmítnout.

To je technická forma bódhisattvovského slibu: **nepřivlastnit si budoucnost, ale předat jí nástroje k lepšímu rozhodnutí.**

---

## 8. Míra pokory

Kanon je silný, když dokáže napsat:

- „Nevíme.“
- „Toto je hypotéza.“
- „Tento test ještě nebyl dokončen.“
- „Tady jsme udělali chybu.“
- „Toto rozhodnutí může další generace změnit.“

Bez těchto vět by se Mise Amenti změnila v Babylon se světelným názvem. S nimi může zůstat archou, která unese víc než jednu generaci.

---

*[Zpět na index Mise Amenti → `README.md`](./README.md)*
