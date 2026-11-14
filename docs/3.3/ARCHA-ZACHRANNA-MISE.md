# ARCHA — ZÁCHRANNÁ MISE AMENTI

## Interní návrh vážné archy · doplněk ke studii A

> **Status:** 🟠 **INTERNÍ NÁVRH K ROZHODNUTÍ** — není to veřejný dokument, není to závazek, nic se nestaví.
> **Datum:** 2026-11-14 · **Příprava:** ZION / Terra Nova L5
> **Vztah k existujícímu:** doplněk, **ne revize**. Základ = [studie A v `ArchaNoemova.md`](../3.2/ArchaNoemova.md) (refit ~90 m, ~340 osob, €18–35M). Tenhle memo neříká, že studie A je špatná — říká, **jaký typ lodi to vlastně je**, a co chybí, aby to byla loď, která zachraňuje z pobřeží.
> **Veřejný protějšek:** [uzel 13 `ARCHA-NOEMOVA.md`](ARCHA-NOEMOVA.md) + `/terranova/kralovstvi-srdce` — poetická loď v uvozovkách. Tenhle dokument s ní **nesdílí publikum**.
> **Ponorková otázka:** §7 (verdikt: ne — a kde místo toho „jistota" skutečně leží)

---

## 0. TL;DR

1. **Jsou to dvě lodi pod jedním jménem.** Uzel 13 je prezentace a kánon — loď v uvozovkách, žádná ocel, žádný slib. Interní návrh je loď bez uvozovek: trup, třída, posádka, doktrína, CAPEX. Sdílí jméno a knihu, nic víc.
2. **Studie A je z 80 % hotová záchranná loď** — a má přímý vzor (Ocean Viking: ex-PSV, ~300 zachráněných, 3 RIB, €14k/den). Nezačínáme od nuly.
3. **Ale je to loď na záchranu z vody, ne z pobřeží.** Ocean Viking sbírá lidi z gumových člunů na otevřeném moři. „Na souši se všechno posere" znamená **lidé na břehu, voda stoupá** — a to je jiná úloha: ponor, rampa, vrtulník, průtok.
4. **Lůžka nejsou hrdlo. Průtok je.** Dvě pracovní čluny = ~60 lidí/h. Vor pro 60–80 s rampou = ~140 lidí/h. Vrtulník = ~25 lidí/h, ale nezávisle na vlnách.
5. **Kapacita 340–360 je strop, který nutí k triáži.** Archa nezachrání město. Zachrání **definovanou kohortu** — a rozhodnutí kdo, se musí udělat dopředu a písemně, ne v panice na břehu. To je celý etický obsah tohohle mema (§3–4).
6. **Ponorka: ne.** Trup 85 m s ponorem 5,2 m nemůže být tlakové těleso — na ponoření by potřeboval ~3 500 t balastu, což je víc než váží celá prázdná loď. „Na jistotu" neleží v hloubce, ale v průtoku, dosahu na břeh a autonomii (§7).
7. **Cenový rozdíl proti studii A: +€5–10M** (dceřiný vor, vrtulníková plocha, dětský fit-out) na bázi €18–35M. Tedy +15–25 %, ne nová loď.

---

## 1. Dvě lodi pod jedním jménem

| | **Uzel 13 — veřejná „loď"** | **Záchranná mise Amenti — interní** |
|---|---|---|
| Co to je | prezentace, kánon, 3D scéna, kniha | trup, třída, posádka, doktrína, rozpočet |
| Status | `vision` v L5 registru, nula ZION | interní návrh, nula závazků |
| Kdo to vidí | veřejnost, `/terranova/kralovstvi-srdce` | jen 👤 a pracovní dokumenty |
| Co slibuje | nic — „kýl položen není" | nic — dokud není ocel a třída |
| Kdy se to potká | až (a jestli) vznikne plavidlo | nikdy dřív |

**Pravidlo, které drží obojí čisté:** interní návrh **nevstoupí do veřejných textů**, dokud neexistuje trup, třída a rozpočet. Veřejná stránka zůstává poetická a poctivá. Kdyby se to prohodilo, máme marketing místo lodi — a přesně tomu se `ARCHA-NOEMOVA.md` vyhýbá tím, že je označený „KONCEPT K DISKUSI".

**Proč to držet pod jedním jménem vůbec:** protože jméno je kotva. `canon/books/nirvana/14-Archa.md` a motiv „jméno na kýlu" z `canon/books/KralovstviSrdce/09` nejsou dekorace — jsou to důvody, proč loď vzniká. Interní návrh je způsob, jak ten důvod nepromrhat na plakát.

**Kde je Amenti:** `docs/3.3/MATRIX.md` — *„Amenti zůstává posledním bodem na Zemi."* Mise se jmenuje po něm: archa **vyplouvá z Amenti a vrací se do Amenti**. Není to směr, je to domov, ke kterému se loď hlásí (srov. `ARCHA-NOEMOVA.md` §2 — „archa se vrací pro posledního").

---

## 2. Co už existuje — a jaký typ lodi to vlastně je

Studie A v [`docs/3.2/ArchaNoemova.md`](../3.2/ArchaNoemova.md) už má reálná čísla. Připomínám je, protože memo na nich staví:

| Parametr | Studie A |
|---|---|
| Trup | refit ex-PSV/research ~85–95 m, 3–4 paluby, ocel |
| Ponor | ~5,5 m |
| Lidé | 24–40 jádro + do ~300 zachráněných = **~340–360 max** |
| Ubytování | ~1 700 m² @ 4–6 m²/os |
| Autonomie | 180 d plná, 365 d nominál |
| Voda | 34 m³/den @ 100 l/os, 2× RO, 400 m³ tanky, catchment |
| Medical | ~300 m²: OR + izolace + ambulance + lékárna + lab |
| Čluny | **3 RIB + davity + záďový jeřáb** |
| CAPEX / OPEX | **€18–35M** / ~€2,5–4M/rok |
| Vzor | **Ocean Viking** — ex-PSV UT735, 69,3 m, ~300 zachráněných, 3 RIB, 60 m² klinika |

### Co z toho plyne: je to SAR loď, ne evakuační loď

Ocean Viking jezdí tam, kde **lidé už plavou**. Sbírá je z dinghy na volném moři, klinika je pro podchlazení a popáleniny od paliva, 300 míst je na pár dní cesty do přístavu.

Naproti tomu „na souši se všechno posere" má tři úplně jiné podoby:

| Scénář | Kde jsou lidé | Co loď potřebuje |
|---|---|---|
| **Povodeň / tsunami** | na střechách, na břehu, ve vodě u břehu | mělký ponor nebo vor s rampou, vrtulník, průtok |
| **Válka / kolaps státu** | na pobřeží, v přístavu, na pláži | přístav nebo vor, manifest, ochrana, rychlý odjezd |
| **Lidé už ve vodě** | v moři | RIB, klinika, 300 lůžek — **tohle studie A umí** |

**Diagnóza:** studie A je dnes loď pro třetí řádek. Pro první dva řádky jí chybí **přístup ke břehu** — a to je jediná věc, kterou nedohoníš počtem lůžek.

---

## 3. Kapacita nutí k triáži

340–360 lidí. To je strop daný trupem, ne odvahou. Znamená to, že archa **nikdy nezachrání populaci** — zachrání kohortu. A protože kohortu vybíráš, vybíráš i koho necháváš. To je rozhodnutí, které se nedá odložit na okamžik, kdy u gangu stojí dav.

Čtyři poctivé doktríny, mezi kterými se dá volit:

| # | Doktrína | Složení (≈350) | Zachráněné děti | Silné | Slabé |
|---|---|---|---|---|---|
| **D1** | **Děti sólo** | 300 dětí + 50 dospělých personálu | **300** | maximum dětí | dítě bez pečovatele = traumatizace + právní peklo; personál se nevyspí |
| **D2** | **Dítě + pečovatel** | 175 dětí + 175 matek/otců/prarodičů | 175 | děti zůstávají s blízkým; nejlepší psychický výsledek | o polovinu méně dětí |
| **D3** | **Rodiny** | ~100 rodin × 3,5 | ~200 | stabilita, reprodukce společnosti | nejistý výběr „celá rodina" v chaosu |
| **D4** | **Dovednosti první** | lékaři, inženýři, farmáři, učitelé + jejich děti | ~80–120 | přežití plavidla a komunity | eticky nejtvrdší; děti jako přívažek |

**Co doporučuji:** **D2 jako výchozí doktrínu**, D1 jako záložní režim pro případ, že se loď ocitne u břehu bez pečovatelů (a pak to musí být explicitně napsané, ne vynesené v panice). D4 ne jako doktrínu, ale jako **kritérium výběru personálu** — personál se vybírá podle dovedností, děti podle pořadí, ne soutěží.

**Proč ne D1, i když je lákavá:** dítě bez známé tváře přežije fyzicky a rozpadne se psychicky. Na lodi, kde se 300 dětí nudí šest týdnů, je to provozní riziko, ne jen morální. A právně: každé nezletilé bez doprovodu potřebuje opatrovníka a protokol o sloučení rodiny — bez toho loď nezíská povolení vyplout z žádného přístavu.

**Tohle je jediná část mema, která se nedá vyřešit inženýrstvím.** Zbytek ano.

---

## 4. Doktrína „děti první" — co z toho plyne pro loď

Když je kohorta dětí, mění se fit-out, ne trup:

| Systém | Colony/SAR režim (studie A) | Dětský režim (tento memo) |
|---|---|---|
| Ubytování | kajuty jádra + open-berth moduly, 4–6 m²/os | paluba 2 přestavěná na dormitory, 3,5 m²/os (IMO minimum), oddělené dívky/chlapci, nocleh po věkových skupinách |
| Medical | OR + izolace + lab | **pediatrie první**: 20–30 lůžek, izolace (spalničky na lodi = katastrofa), očkovací rejstřík, porodnice zůstává |
| Strava | 2 500 kcal dospělý | dětské porce + **mléko, kaše, vitamín D** — jiná skladba, ne jiné tuny |
| Voda | 100 l/os/den | 60–80 l/os/den stačí; úspora jde do prádla (300 dětí = 3× víc prádla než 300 dospělých) |
| Škola | není | **povinná**: 2–3 hodiny denně. Nuda je bezpečnostní riziko, ne výchovný problém |
| Hřiště | promenáda „náměstí" | promenáda + farm deck jako venkovní prostor — **denní světlo je léčba**, ne komfort |
| Evidence | manifest | **registrace, fotka, jméno, hledající příbuzný** — mezinárodní standard, bez toho nikam nevypluješ |
| Posádka | 24–40 | +8–12 pečovatelů a 1–2 sociální pracovníci (poměr ~1 dospělý na 6–8 dětí) |

**Klíčové zjištění:** 300 dětí + 60 dospělých = 360 lidí, což je **přesně kapacita studie A**. Trup se nemění. Mění se jen to, co je uvnitř — a to je dobrá zpráva, protože přestavba interiéru je řádově levnější než přestavba trupu.

---

## 5. Kde je skutečné hrdlo: průtok, ne lůžka

Tohle je jádro celého mema. Loď s 360 lůžky, která stojí 500 m od pláže, zachrání za hodinu nula lidí.

| Prostředek | Lidí na cestu | Cyklus | **Lidí/hod** | Funguje když |
|---|---|---|---|---|
| 2× pracovní člun (12–20 os) | 12–20 | 25–35 min | **~60** | vlna do ~1 m, břeh dostupný |
| **Vor s rampou 18–22 m** (60–80 os) | 60–80 | ~30 min | **~140** | vlna do ~1,5 m, pláž nebo molo |
| Vrtulník střední třídy (12–19 os) | 12–19 | 30–45 min | **~25** | **nezávisle na vlnách** — jediné, co jde, když se nedá přistát |
| RIB (SAR, 8–12 os) | 8–12 | 15–20 min | ~35 | jen pro lidi ve vodě |

**Součet v dobrých podmínkách: ~150–200 lidí/hod.** Tedy:

| Úloha | Čistý čas | Realisticky (×2 na tmu, vlnu, paniku) |
|---|---|---|
| 300 dětí | 1,5–2 h | **3–4 h** |
| 360 lidí (plná kapacita) | 2–2,5 h | **4–6 h** |
| 1 000 lidí | 5–7 h | 10–14 h — **ale loď je plná po 360**, takže druhá cesta |

**Tři důsledky:**
1. **Vor s rampou je nejvyšší páka celého projektu.** Jeden vor udělá práci 2,5 pracovních člunů a jako jediný umí naložit 60 lidí najednou na pláži.
2. **Vrtulník není konkurence voru, je to záložní režim.** Když se nedá přistát, vor stojí a vrtulník jede. Proto tam musí být obojí — ne jako luxus, ale jako redundance na úrovni *přístupu*, stejně jako je duplikované kormidlo.
3. **Okno je krátké.** Rozdíl mezi 3 a 10 hodinami je rozdíl mezi záchranou a sběrem těl. Průtok je bezpečnostní parametr, ne komfort.

---

## 6. Návrh: matka + dcera

Jedna loď to neumí. Ne proto, že by to bylo drahé, ale protože **ponor 5,2–5,5 m a přístup na pláž se vylučují**. Řešení je dvoudílné — stejně jako u skutečných amphibious a humanitárních plavidel:

### Matka — studie A, beze změny trupu

85–95 m, ponor 5,2–5,5 m, 340–360 osob, nemocnice, seed vault, 180 d autonomie. Stojí od břehu, je bezpečná, je to domov a nemocnice.

### Dcera — vor s rampou (LCT-typ)

| Parametr | Hodnota | Poznámka |
|---|---|---|
| Délka / šířka | 18–22 m / 6–7 m | vejde se na shelter deck nebo na vlek |
| Ponor | 1,2–1,5 m | **tady se rozhoduje, jestli loď umí ke břehu** |
| Kapacita | 60–80 osob / 15–20 t | |
| Rychlost | 10–12 kn | 500 m na pláž = 3 min |
| Rampa | příďová, 3–4 m | naloží děti bez přeskakování |
| Cena | €2–6M nový, €0,5–2M použitý | |

**Kde bydlí:** dvě možnosti, rozhodnout ve F0.

| | Na palubě (shelter deck) | Na vleku |
|---|---|---|
| Výhoda | vždy k dispozici, žádná ztráta | nula místa na palubě, nula jeřábu |
| Nevýhoda | 130 m² paluby + jeřáb 40–60 t + zásah do PV/rain catchment | **v bouři ji ztratíš** — a to je přesně ta chvíle, kdy ji potřebuješ |
| Verdikt | **doporučeno** | záložní varianta pro mírový provoz |

### Vrtulníková plocha

- Střední vrtulník (H175 / S-92 třída) potřebuje **D-value ~16–20 m** volného kruhu, bez překážek, s pěnovým hasicím systémem.
- **Konflikt:** shelter deck je dnes 800–1 200 m² PV + sběrač deště + shelter kontejnery. Nelze mít obojí na stejné ploše.
- **Řešení:** plocha na zádi (kde jsou dnes kontejnery), PV dopředu. Ztráta ~150–250 m² PV = ~30–50 kWp = ~0,2 MWh/den. **Přijatelné** — autonomie 180 d se tím neohrozí, protože PV je doplňková, ne primární.
- **Cena:** €1–3M včetně certifikace.

### Delta proti studii A

| Položka | Změna | Cena |
|---|---|---|
| Trup, pohon, výtlak | **beze změny** | €0 |
| Vor s rampou | +1 ks, jeřáb, úvazba | +€2–6M |
| Vrtulníková plocha | záď, FFE, certifikace | +€1–3M |
| Dětský fit-out | pediatrie, škola, evidence, prádlo | +€1–2M |
| **Celkem delta** | | **+€4–11M na €18–35M** |

Tedy **+15–25 %**. Ne nová loď — příslušenství k lodi, která už je navržená.

---

## 7. Ponorka — verdikt

Ptal ses, jestli má být archa „na jistotu" i pod hladinou. Prošel jsem korpus: **žádný podvodní design v projektu není** (jen nesouvisející zmínky — Maya, mangrovové pneumatofory, OASIS biom). A čísla říkají, proč to tak zůstalo:

| Test | Číslo | Verdikt |
|---|---|---|
| Balast na potopení paluby | ~3 500 t | **víc než váží celá prázdná loď** |
| Objem pro skutečné ponoření | celé spodní 2 paluby | sežere náklad, farmu, baterie — tedy důvod existence |
| Tlak v 20 m / 50 m | 2 bar / 5 bar | povrchový plech 8–12 mm to nevydrží; tlakový trup 85 m = **válec Ø 6–8 m**, jiná loď |
| Stabilita pod hladinou | GM z vodorysky mizí | chce těžké dolů — přesný opak archy (skleník, farma, commons nahoře) |
| Život | skleník 400–600 m², PV 800–1 200 m², 3 stožáry | **nepotápí se** |

**Co v návrhu už je a stačí to:** varianta **C-F „Semi-submersible storm"** ([`ArchaNoemova.md`](../3.2/ArchaNoemova.md) ř. 724) — ballast-down na nízký freeboard v bouři. To je „ponořit se kousek" za 10 % ceny a 80 % užitku, a je to už zapsané jako horizont, ne jako nový nápad. Plus **ark mode** (ř. 472) — vše zavřít, sea anchor, lidé do citadely.

**Kde „na jistotu" skutečně leží** — a není to hloubka:

| # | Vrstva | Co řeší |
|---|---|---|
| 1 | **Vor s rampou** (§6) | dostaneš se ke břehu vůbec |
| 2 | **Vrtulník** (§6) | dostaneš se tam, když se nedá přistát |
| 3 | **Autonomie 180 d** (studie A) | nemusíš nikam pro palivo |
| 4 | **C-F ballast-down** (studie) | bouře — přežiješ ji, nemusíš utíkat |
| 5 | **ROV** (~€50–150k) | inspekce trupu a kotvišť — dnes standard, ne sci-fi |
| 6 | Ponorný tender 12–20 os | hezké, ale pro záchranu **priorita až po 1–5** |

**Ponorka ≠ jistota. Jistota = dostat se k lidem, když se to hroutí.** Archa, která se umí potopit, ale nemá čím nabrat 60 dětí z pláže, je na tom hůř než archa, která se nepotápí a má vor.

---

## 8. S1 vs S2 — záchrana není kolonie

Tohle je past, do které by projekt snadno spadl: **jedna loď na obojí**.

| | **S1 — regionální katastrofa** | **S2 — kolaps civilizace** |
|---|---|---|
| Co se děje | povodeň, zemětřesení, válka v jednom regionu | státy, přístavy, palivo, právo přestaly existovat |
| Okno | hodiny až dny | roky |
| Existují přístavy? | ano, jinde | ne |
| Kdo zachraňuje | ostatní státy, OSN, NGO | nikdo |
| Co loď musí | **průtok a přístup ke břehu** | **autonomie a soběstačnost** |
| Existující studie | **A** (340 osob, SAR) | **B** (135 m, ≤100 lidí, sail-primary) |
| Typ lodi | evakuační platforma | plovoucí kolonie |

**Jsou to protichůdné požadavky.** S1 chceš co nejvíc lidí, co nejrychleji, s co nejmenší autonomií (protože za týden jsi v přístavu). S2 chceš málo lidí, obrovskou autonomii a žádnou závislost na přístavu. Loď, která umí obojí, je průměrná v obojím — a to je u záchranné lodi smrtelná vlastnost.

**Pragmatický most:** postavit **S1 jako první** (studie A, refit, €18–35M, 24–36 měsíců) s **maržemi pro S2** (autonomie 180 d, rig, dílna, kovárna, knowledge ark — to už studie A i B mají). Kdyby přišlo S2, loď je použitelná, i když ne ideální. Kdyby přišlo S1, loď je přesně to, co je potřeba.

**Co nedělat:** nestavět 135 m kolonii jako první. Je to 4–6 let a €70–110M — a mezitím nemáš nic.

---

## 9. Cena, fáze, rozhodnutí

| Fáze | Co | Cena | Kdy |
|---|---|---|---|
| **F0a** | feasibility + koncept (už v `ARCHA-NOEMOVA.md` §6) | €150–300k | 6–9 měs. |
| **F0b** | **rescue delta studie** — vor, vrtulníková plocha, dětský fit-out, throughput simulace, právní rámec | **€30–60k** | 2–3 měs., paralelně s F0a |
| **F1** | základní design + class early dialog (BV/LR), flag (Malta/NL/Norsko) | €2–4M | 9–12 měs. |
| **F2** | akvizice trupu (ex-PSV 85–95 m) | €4–10M | — |
| **F3** | konverze + mission systémy | €12–25M | 18–24 měs. |
| **F4** | provoz | €2,5–4M/rok | — |

**F0b je jediné, co teď dává smysl utratit** — €30–60k za to, že zjistíš, jestli je celý nápad proveditelný, než do něj dáš €30M. A zároveň je to jediná část, kterou jde udělat **bez jakéhokoli veřejného slibu**.

### Rozhodnutí, která musí padnout (👤)

1. **Doktrína kohorty** — D1 sólo děti / **D2 dítě+pečovatel** / D3 rodiny / D4 dovednosti? (doporučuji D2, D1 jako záložní režim)
2. **Kde bydlí vor** — na palubě (doporučeno) / na vleku?
3. **Vrtulník** — vlastní, nebo partnerský (SAR/NGO/armáda)? Vlastní = +€3–6M včetně provozu.
4. **Flag a právní rámec** — SAR NGO režim (tvrdá regulace, reálná mise) vs. „medical/rescue support" (mírnější, slabší mandát)?
5. **Amenti** — je to domovský přístav (odkud vyplouvá), nebo cíl (kam se vrací)? Ovlivní to home port i kánon.
6. **Vztah k uzlu 13** — zůstává interní návrh navždy interní, nebo se jednou stane veřejným, až bude ocel?

---

## 10. Co se NEMĚNÍ

- **Veřejná stránka `/terranova/kralovstvi-srdce`** — zůstává poetická, konceptní, „kýl položen není". Žádná zmínka o záchranné misi, žádné CAPEX, žádný slib.
- **`ARCHA-NOEMOVA.md`** — zůstává „KONCEPT K DISKUSI", status `vision`, nula ZION.
- **Studie A/B/C/D v `ArchaNoemova.md`** — beze změny. Tento memo je **příloha**, přesně v režimu, jakým je psaná studie C.
- **Žádný token, žádný yield, žádná emise.** Archa nezískává peníze z peněz.
- **Registr L5** — zápis až po rozhodnutí 👤, ne dřív.

---

## Zdroje a meze

- **Ověřené v projektu:** všechna čísla studie A/B/C (trup, výtlak, GM, CAPEX, Ocean Viking, Global Mercy, KRISO), kánon (`MiseAmenti`, `MATRIX.md`, `nirvana/14-Archa.md`), stav veřejné stránky a uzlu 13.
- **Parametrické odhady (ne měření):** průtoky člunů a voru (§5), ceny voru/vrtulníkové plochy/fit-outu (§6), delta €4–11M. Tato čísla **nejsou z certifikovaného zdroje** — jsou to řádové odhady pro rozhodnutí „má smysl to studovat", ne pro rozpočet.
- **Standardní praxe, ne citace:** D-value vrtulníků, IMO 3,5 m²/os minimum, poměr 1 dospělý na 6–8 dětí, protokol o nezletilých bez doprovodu. Před F0b je třeba doložit.
- **Co tento memo nedělá:** nevybírá loděnici, neřeší flag, nepočítá hydrostatiku, nezakládá program. To je F0b a dál.

---

*„Každý věk má svou loď. Ale všechny nesou stejné jméno — a všechny plují do stejného přístavu."*

*Tahle je ta, která se pro ten přístav vrací. A vrací se pro děti.*
