# BODHI GAIA — Kapitola 1: Semeno a sůl
## Jak se sůl smlouvy stala semenem — a proč 5 % z každého bloku nikdo nemusí schválit

> *„Sůl chrání, co už je. Semeno tvoří, co ještě není. Smlouva, která má přežít potopu, potřebuje obojí."*

---

## Příběh

Prvního večera na Terra Nova, když už hořel oheň v Domě Lumi a na stole ležela miska hrubé soli, přišla k ohni žena v zeleném šatu s věncem z polního kvítí. Poutníci ji znali z příběhů — říkali jí **Sítá**, Matka Země, ta, která v Sůl této země šla s Rámou a Hanumanem po cestě nevyšlapané.

Nesedla si k ohni. Klekla si k prahu, kde končila podlaha z cedrových trámů a začínala holá hlína Nové země. Vzala hrst soli ze stolu a hrst hlíny z prahu a držela je vedle sebe v otevřených dlaních.

*„Vidíte?"* řekla. *„Tohle je sůl. Nesli jste ji od Galilejského jezera. Chrání chléb před zkázou, dává chuť vodě a je znamením smlouvy. Ale sůl nikdy nic nevypěstuje. Když ji zasadíte, půda umře."*

Pak otevřela druhou dlaň. V hlíně leželo jediné tmavé semeno. Nikdo nevěděl, odkud ho má — někteří říkali, že ho nesla z archy, jiní, že ho našla na břehu mezi kameny.

*„A tohle je semeno. Nechrání nic. Je to nejzranitelnější věc na světě. Ale jediné umí udělat to, co sůl nikdy neumí: z jednoho udělat tisíc."*

Tesař, který stavěl Dům Lumi, se zeptal: *„Co s ním chceš udělat?"*

*„Zasadit ho. Ne tady u ohně, kde je teplo a bezpečno. Venku. Do země, která ještě nikdy nedala úrodu."*

*„A kdo se o něj bude starat, když odejdeme dál na západ stavět mosty a chrámy?"*

Sítá se usmála. *„Proto jsem přišla. Chci, abychom si dali slib, který nezávisí na tom, kdo si co pamatuje. Z každého kusu chleba, který kdy tato země upeče, se odloží malý díl — ne pro krále, ne pro chrám, ne pro obchodníka. Pro zemi samotnou. Pro vodu, strom a semeno. A ten díl se odloží **dřív**, než někdo vůbec stihne rozhodnout, jestli se mu dnes chce dávat."*

*„Jak velký díl?"*

*„Pět z každé stovky. Pět pro zemi, pět pro hvězdy, jedno pro ty, kdo hlídají cestu. Zbytek tomu, kdo chléb upekl."*

Tesař se dlouho díval do ohně. Pak vzal dláto a do horního trámu nad dveřmi, hned vedle zlatého paprsku protínajícího vlnu, vyřezal malé semeno s kořínkem. *„Aby to nikdo nemohl přepsat, až zapomeneme, proč jsme to slíbili."*

Té noci Sítá zasadila semeno na svahu pod domem. Nikdo z poutníků nevěděl, co z něj vyroste. Ale všichni věděli jedno: **od teď každý blok chleba nese kus země v sobě.**

Ráno, když vyšli z domu, viděli, že na svahu zůstala Sítá sedět celou noc. Ne aby semeno hlídala — to nešlo. Aby ho **viděla**. *„Semeno nepotřebuje strážce,"* řekla, když k ní přišli. *„Potřebuje svědky. Věci, na které se nikdo nedívá, umírají potichu."*

A tak vznikla první z protokolů Země: **nic, co se dává zemi, se nesmí dávat potichu.**

---

## Co to znamená

**Kapitola 1 je o jediné technické větě, která drží celou vrstvu L5: 5 % z každého vytěženého bloku ZION patří humanitárnímu fondu Země, a to je zapsáno v konsensu L1 — ne v rozpočtu, ne ve stanovách, ne v dobré vůli.**

Rozdíl mezi solí a semenem je rozdíl mezi dvěma modely dobročinnosti:

| Model „soli" (starý svět) | Model „semene" (ZION L5) |
|---|---|
| Dar se rozhoduje *po* vzniku hodnoty. Někdo musí chtít. | Podíl se odděluje *při* vzniku hodnoty. Nikdo nemusí chtít. |
| Závisí na dárcích, kampaních a náladě trhu. | Závisí pouze na tom, zda síť produkuje bloky. |
| Tok je viditelný jen správcům fondu. | Tok je viditelný komukoliv s block explorerem — každý blok, každý výstup. |
| Sůl chrání, co už existuje (kapitál dárce). | Semeno tvoří, co ještě není (studna, strom, mesh). |

Konkrétně:

1. **Coinbase každého bloku má pevné výstupy.** Výstup 0 patří těžaři (89 %), výstup 1 humanitárnímu fondu L5 (5 %), výstup 2 vědeckému fondu L6 Issobella (5 %) a výstup 3 — po aktivaci — poolu odměn pro provozovatele uzlů (1 %; před aktivací je tento díl spálen). Toto pořadí není zvyk; je to kód v `v3_template.rs`.
2. **Adresa fondu je kanonická a veřejná.** `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` je zakódována v jádru (`v3_compat.rs`), v CLI (`zion node start --human`), v dashboardu i na webu. Žádný operátor ji nemůže tiše vyměnit bez změny konsensu.
3. **Semeno potřebuje svědky, ne strážce.** Proto L5 nezačíná výplatami, ale **trackerem**: služba `zion-free-world` čte každý blok a eviduje, co do fondu přiteklo. Pro 3.2.0 bylo rozhodnuto (gate G10), že L5 běží jako *read-only fund tracker + DAO proposal bridge* — fond roste, ale žádná služba L5 nemá klíč k tomu, aby z něj sama něco odeslala. To není nedostatek. To je první protokol Země: *nic se nedává potichu*.
4. **Dávat dřív, než se rozhodne.** Tím, že je podíl oddělen konsensem, mizí nejčastější selhání humanitárních systémů: únava dárců. Síť, která těží, dává. Síť, která přestane těžit, přestane dávat — a to je poctivé; nikdo neslibuje víc, než blok dokáže vytvořit.

> **Přesnost místo patosu:** při dnešní výši subsidy ~5 400,067 ZION jde do fondu Země ~270,003 ZION na blok, přibližně každých 60 sekund. Nikdo neví, jakou to bude mít cenu. Víme jen, kolik ZIONu to je a kam to jde.

---

## Kotva pravdy — ověřitelná fakta

> Semeno z příběhu má v síti přesný protějšek: jeden výstup v každém coinbase.

| Prvek příběhu | Stav | Co je na síti ZION ověřitelné | Co ještě chybí |
|---|---|---|---|
| **„Pět z každé stovky pro zemi"** | **ŽIVÉ** | Emisní split 89 / 5 / 5 / 1 v `V31/L1/core/src/emission.rs` a `v3_template.rs`; výstup `coinbase_humanitarian` v každém nativním bloku, viditelný přes `getBlockByHeight` → `transactions[].outputs`. | Nic — je v konsensu. |
| **„Aby to nikdo nemohl přepsat"** | **ŽIVÉ** | Kanonická L5 adresa `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` je hard-coded v `V31/L1/core/src/v3_compat.rs`; totéž v `docs/PREMINE_ADDRESSES_PUBLIC.txt`, `HARD_RESET_PLAYBOOK.md`, dashboardu a webu `/l5-free-world`. | Změna adresy = změna konsensu (třída D v protokolu změn). |
| **„Semeno potřebuje svědky"** | **ŽIVÉ** | `zion-v31-free-world.service` active na Edge (`127.0.0.1:8095`), skenuje L1 coinbase každých 60 s; `GET /api/v1/fund/balance`, `GET /metrics`; nginx `/api/free-world/` (operator-only). | Veřejný portál s živým grafem toků; nezávislý audit skeneru proti explorer datům. |
| **„Nic se nedává potichu"** | **ŽIVÉ** (rozhodnutí) | Gate G10: žádná automatická výplata z L5; spend pouze přes DAO návrh → hlasování → timelock → guardian multisig (`docs/3.2/L5_L6_ACTIVATION_PLAN.md`). | DAO UI/UX pro L5 návrhy; DAO exekuce dnes nestaví ani nevysílá výplatní transakci (`V31/L2/dao/src/runtime.rs` — summary-only). |
| **„Jedno pro ty, kdo hlídají cestu"** | **STAVBA** | Node reward 1 % je v kódu s `node_reward_activation_height = u64::MAX` (default vypnuto); před aktivací je díl spálen. | Konkrétní activation height a on-chain evidence 4-výstupového coinbase. |
| **„Kus země v každém bloku chleba"** | **ŽIVÉ** (číslo je dynamické) | Každý blok přidá ~270 ZION do fondu; celkový zůstatek se čte z chainu (explorer `/explorer`, adresa fondu), ne z této stránky. | Historická čísla v starších textech (např. „přes 23 600 plateb") jsou snímky v čase — vždy ověřit `getStatus`/explorer. |
| **Sítá, tesař, semeno z archy** | **MÝTUS** | Archetypy ze Sůl této země (ep. 4 a 10). | — |

> **Známý rozpor k opravě:** kapitola 6 knihy TerraNova ([`06-L5-SVOBODA.md`](../../TerraNova/06-L5-SVOBODA.md)) uvádí historických **10 %** do humanitárního fondu. Kanonický split je **5 % L5 + 5 % L6**; TerraNova kapitola je historický text a musí být označena nebo opravena (viz [kap. 9](./09-Kotva-Pravdy-a-Hranice.md)).

---

*→ Pokračování: [Kapitola 2 — Tři stromy, jedna zahrada (L5 Trinity)](./02-Tri-Stromy-Jedna-Zahrada.md)*

---

*[Zpět na index Knihy Země → `00-README.md`](./00-README.md)*
