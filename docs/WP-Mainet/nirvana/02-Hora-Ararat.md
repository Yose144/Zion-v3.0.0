# NIRVANA — Epizoda 2: Hora Ararat
## Kde archa poprvé spočine na pevné zemi — Kotva stability a nezničitelný konsensus

> *„Hora není cílový domov. Je to první důkaz, že pod rozbouřenou hladinou stále existuje pevná skála, která unese tíhu světa."*

---

## Příběh

Po mnoha týdnech plavby za paprskem Lumi se stalo něco, na co už téměř nikdo nevěřil.

Trup archy zadrhnul o skalisko. Nešlo o ztroskotání; byl to pomalý, pevný dosed těžkého kýlu na kamenné lože. Loď se zakymácela, zahučela ve všech dřevech a poprvé po měsících neustálého pohupování se zastavila. Nastalo naprosté ticho.

Lidé vystoupali po strmých žebřících na horní palubu. Mlha se rozestoupila a před nimi se tyčil mohutný, holý skalní masiv. Vystupoval z ustupující hladiny jako obrovský maják vytesaný samotnou zemí. Všude kolem byl ještě chlad, vlhko a šedý čedič. Žádná zeleň, žádné stromy obsypané ovocem.

Pojmenovali ten vrchol **Ararat**.

Na Araratu se nedalo žít navždy — byl příliš strmý a kamenitý. Ale dalo se na něm udělat to nejdůležitější: **vystoupit na pevnou zem, zapálit první oheň, který nesfoukne vítr, a položit základní kámen budoucího majáku.**

Jeden starý kovář vzal těžké kladivo, které celou potopu opatroval pod kabátem. Udeřil jím do skály a řekl: *„Zde už nepohne voda ničím. Zde je dno, od kterého stavíme směrem k nebi."* A mladá dívka vedle něj vsypala do skalní pukliny hrst hlíny a zasadila semínko divokého ječmene.

---

## Co to znamená

**Hora Ararat je zhmotněním nezlomné stability a neměnného konsensu v blockchainovém organismu ZION.**

V životě sítě to představuje přechod od experimentu k **nezvratné produkční realitě**:

1. **Pevný bod v P2P síti:** Žádný uzel nestojí sám. Síť ZION tvoří distribuovaný mesh uzlů (Node 1, Node 2, Node 3 na Edge i nezávislé záložní uzly po celém světě), které nepřetržitě synchronizují historii řetězce.
2. **LWMA-60 Difficulty Engine:** Algoritmus adaptivní obtížnosti *Linear Weighted Moving Average* s ochranou proti skokovým výkyvům (clamp ±50%) zajišťuje, že bloky vznikají s železnou pravidelností ~60 sekund, ať už síť těží tisíce strojů, nebo jen malá skupina věrných strážců.
3. **Imutabilita historie:** Bloky zapsané na Araratu nelze smazat, zreorganizovat ani přepsat svévolným dekretem. Jsou navždy zapečetěny kryptografickými hashy a BLAKE3 doménovým tagováním UTXO v2 transakcí.

---

## Kotva pravdy — ověřitelná fakta

> Fakta v tomto boxu jsou přímo testovatelná v kódu repozitáře a na živém Edge serveru.

| Prvek příběhu | Co je na síti ZION ověřitelné |
|---|---|
| **Pevné usazení kýlu** | Bloková produkce dosáhla výšky **23 600+ bloků**; diff rate ~31 500+ s plynulým přizpůsobováním času bloku na ~60 s. |
| **P2P pilíře hory** | Multi-node mesh topologie: Node 1 (port `8335`), Node 2 (`8336`), Node 3 (`8337`) s dedikovanými RPC sockety a ochranou `fail2ban` proti DDoS útokům. |
| **Kladivo kováře** | Nativní SQLite indexace (`tx_index`, `output_index`, `address_tx_index` ve `V31/L1/core/src/storage.rs`) pro O(1) transakční odezvu. |
| **Semeno ve skále** | PPLNS pool automaticky kumuluje a potvrzuje výplaty těžařům on-chain s sweep mechanizmem a UTXO fallbackem. |
| **Nezávislost na vnějším světě** | Zero-dependency architektura — L1 node i pool běží v čistém Rustu bez nutnosti centralizovaných cloudových knihoven. |

---

*→ Pokračování: [Epizoda 3 — Nová země (Terra Nova)](./03-Nova-Zeme.md)*

---

*[Zpět na index Nirvany → `00-README.md`](./00-README.md)*
