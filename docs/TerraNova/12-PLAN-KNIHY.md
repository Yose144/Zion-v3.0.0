# Terra Nova — Redakční a Architektonický Plán Knihy

> Stav: pracovní kanonický plán
> Datum: 20. dubna 2026
> Účel: sjednotit TerraNova / Kompas do srozumitelné čtvrté knihy komplexu ZION

## 1. Výchozí teze

Terra Nova nemá být další paralelní manifest. Má být knihou, která uzavírá a převádí předchozí tři knihy do praxe.

Kanonická linie dnes dává největší smysl takto:

1. **Genesis** = semeno, zasvěcení, posvátný původ ZION.
2. **Kvantová Revoluce** = civilizační práh, makro-vize a důvod změny.
3. **Ekam Deeksha** = vnitřní proměna, kosmologie vědomí, pole přechodu.
4. **Terra Nova / Zlatý Kompas** = jak Nová Země skutečně vypadá, jak se staví a kam směřuje.

Z toho plyne první zásadní rozhodnutí:

- Terra Nova už nemá být prezentována jako „třetí kniha trilogie“.
- Má být prezentována jako **čtvrtý svazek** nebo **sjednocující kompas po třech knihách**.
- „Kompas“ nemá být konkurenční artefakt vedle knihy. Má být buď podtitul knihy, nebo její závěrečná část.

## 2. Hlavní závěry z analýzy

### 2.1 Co už dnes funguje dobře

- **00-SCENA.md** dobře otevírá velký horizont a dává obraz budoucnosti.
- **01-KOSMOLOGIE.md** je dnes nejsilnější střed knihy. Dobře propojuje Kvantovou Revoluci, Ekam Deeksha a TerraNova vrstvy.
- **03-KOMUNITY.md**, **04-AI-NATIVE.md** a velká část **05-L1-L4.md** mají dobrý potenciál jako střední tělo knihy.
- **KOMPAS.md** má silný závěr a jasné volání k akci.

### 2.2 Co dnes nefunguje nebo driftuje

1. **Není jasná role knihy v celém kánonu.**
   README mluví o trilogii, ale obsah i uživatelský záměr odpovídají čtyřem knihám.

2. **Míchají se různé druhy pravdy bez označení.**
   V jedné linii text střídá:
   - mýtus a symbol,
   - filozofickou interpretaci,
   - ověřenou runtime realitu,
   - produktovou roadmapu,
   - dlouhodobou spekulaci.

3. **Část reality je zastaralá vůči dnešnímu stavu ZIONu.**
   Kritické příklady:
   - Prague/USA/Singapore jsou v TerraNova stále místy psány jako aktivní současná topologie, i když dnes je kanonická produkční realita Prague-only.
   - některé části stále mluví o starších seed modelech a starém stavu rolloutů;
   - L2 a bridge vrstvy v knize místy neodpovídají aktuálnímu stavu Base mainnet a bridge runtime;
   - website/bridge reality byly v dubnu 2026 už znovu ověřeny live, ale kniha to nezohledňuje.

4. **Ekonomická vrstva je interně nekonzistentní.**
   V různých částech se objevují neslučitelné poměry, zejména kolem humanitárního a Issobella podílu. TerraNova musí být sladěna s kanonickou runtime realitou, ne s dřívějšími návrhovými verzemi.

5. **Struktura složky a struktura knihy si odporují.**
   README odkazuje na názvy a pořadí kapitol, které neodpovídají skutečným souborům. Například existuje **05b-MEDICAL.md**, ale přehled knihy pracuje s jiným pořadím i názvy.

6. **Některé kapitoly působí jako appendix, ne jako součást hlavního příběhu.**
   Nejvíc to platí pro:
   - **10-NVIDIA-COMPUTE.md**
   - **11-PROROCTVI.md**

7. **Kniha je místy encyklopedie, místy manifest a místy roadmapa.**
   Potřebuje jednu nosnou osu čtenářské zkušenosti.

## 3. Cílový tvar knihy

Terra Nova má být čtena jako odpověď na otázku:

**„Když Genesis zasela semeno, Kvantová Revoluce ukázala proč starý svět končí a Ekam Deeksha vysvětlila vnitřní přerod — jak tedy vypadá Nová Země konkrétně a jak ji stavíme?“**

To znamená:

- méně opakovat, co už udělaly předchozí knihy,
- více ukazovat převod idejí do světa,
- zachovat mytickou a poetickou vrstvu,
- ale průběžně ukazovat, co je skutečně live, co je plán a co je horizont.

## 4. Doporučená architektura knihy

### 4.1 Doporučená identita

Pracovní název:

**Terra Nova: Zlatý Kompas Nové Země**

Podtitul může znít například:

- *Čtvrtá kniha komplexu ZION*
- *Průvodce od vize ke stavbě nové civilizace*
- *Kde se blockchain, vědomí, komunita a hvězdy setkávají v jedné mapě*

### 4.2 Doporučené části

#### Prolog

**00-SCENA.md**

Úloha:
- otevřít budoucí obraz;
- přiznat, že úvodní flashback na Prahu, USA a Singapore je historická fáze zrodu, ne dnešní aktivní topologie;
- vybudovat napětí mezi malým začátkem a velkou civilizací.

#### Část I — Most ze tří knih

Nová nebo zásadně přepsaná úvodní kapitola.

Úloha:
- explicitně pojmenovat čtyřknihovou linii;
- krátce vysvětlit, co přinesla Genesis, Kvantová Revoluce a Ekam Deeksha;
- jasně říct, co Terra Nova přidává nového.

Bez této části bude Terra Nova vždy působit, jako by začínala uprostřed věty.

#### Část II — Proč Nová Země

Základ dnes tvoří:
- **01-KOSMOLOGIE.md**
- **02-VOLNA-ENERGIE.md**
- vybrané části **03-KOMUNITY.md**

Úloha:
- vysvětlit, proč starý model civilizace nestačí;
- ukázat nový vztah k energii, krajině, zdrojům a společnému životu;
- držet kontinuitu s Kvantovou Revolucí, ale neopakovat její celé argumentační pole.

#### Část III — Jak se žije Nová Země

Základ dnes tvoří:
- **03-KOMUNITY.md**
- **05b-MEDICAL.md**
- **04-AI-NATIVE.md**

Úloha:
- ukázat člověka, komunitu, zdraví, vzdělávání a AI jako jednu soustavu;
- přeložit vysokou filozofii do každodenního života;
- vysvětlit, jak se proměna vědomí projevuje v infrastruktuře, péči a vztazích.

Poznámka:

Medical kapitola má smysl, ale musí být rámována disciplinovaněji. Je třeba rozlišit:
- etablovanou medicínu a evidence-backed praxi,
- experimentální biofyzické protokoly,
- dlouhodobý výzkum,
- filozofické a komunitní principy péče.

#### Část IV — Jak je Nová Země postavena

Základ dnes tvoří:
- **05-L1-L4.md**
- **06-L5-SVOBODA.md**
- části **04-AI-NATIVE.md**

Úloha:
- vysvětlit vrstvy L1-L6 jako civilizační architekturu;
- pevně oddělit, co je implementované, co je rozpracované a co je vize;
- sladit ekonomiku, tokenomiku, topologii a runtime stav s kanonickými V3 a mainnet dokumenty.

Tohle je pravděpodobně nejdůležitější redakční zásah celé knihy.

#### Část V — Horizont a hvězdy

Základ dnes tvoří:
- **07-ISSOBELLA.md**
- **08-WARP-HVEZDY.md**

Úloha:
- ukázat, že hvězdný horizont není útěk ze Země, ale prodloužení dosažené zralosti civilizace;
- zachovat poetiku, ale být přesný v tom, co je metafora, co výzkumný cíl a co sci-fi horizont.

#### Část VI — Zlatý Kompas

Základ dnes tvoří:
- **KOMPAS.md**

Úloha:
- dát čtenáři závěrečný směr;
- převést knihu do plánu, rolí, etap a konkrétního pozvání ke spolupráci;
- fungovat jako závěr, ne jako oddělený žánr.

## 5. Co přesunout do appendixu

### 5.1 Proroctví

**11-PROROCTVI.md** má silnou symbolickou hodnotu, ale v hlavním těle knihy snadno rozbije důvěru a rytmus vyprávění.

Doporučení:

- ponechat ho v projektu,
- ale přesunout do appendices nebo do samostatné části „Tradice, symbolika a prorocká linie“;
- v hlavním textu na něj jen odkazovat jako na tradiční a duchovní horizont, ne jako na nosný argument technické civilizace.

### 5.2 Nvidia Compute

**10-NVIDIA-COMPUTE.md** obsahuje cenný materiál, ale stylisticky je bližší technologickému appendixu než kapitole knihy.

Doporučení:

- přesunout do technické přílohy;
- v hlavním textu ponechat jen princip výpočetní pyramidy a její význam pro AI Native infrastrukturu.

## 6. Redakční pravidla pro celou knihu

Každá kapitola má odpovídat na jednu hlavní otázku.

Příklad:

- Proč starý svět končí?
- Jak vypadá komunita Nové Země?
- Jakou roli má AI?
- Co je dnes live a co je ještě horizont?

### 6.1 Pět vrstev tvrzení

Každé silné tvrzení v knize by mělo implicitně nebo explicitně patřit do jedné z těchto vrstev:

1. **Mýtus / symbol**
2. **Filozofická interpretace**
3. **Ověřená současnost**
4. **Schválený plán / roadmapa**
5. **Výzkumný nebo spekulativní horizont**

Ne všechny kapitoly to musí značit formální ikonou, ale redakčně to musí být vždy jasné.

### 6.2 Pravidlo neopakování

Terra Nova nemá znovu psát celé jádro Kvantové Revoluce ani celé jádro Ekam Deeksha.

Smí z nich převzít:

- základní slovník,
- tón kontinuity,
- několik klíčových obrazů,
- krátké mosty mezi knihami.

Nemá z nich převzít:

- celé velké expozice civilizační krize,
- celé výklady probuzení a Deeksha praxe,
- dlouhé opakované metafyzické argumenty bez nového posunu.

### 6.3 Pravidlo důvěryhodnosti

Čím víc je téma technické, medicínské nebo operační, tím přísněji musí být svázáno s realitou repo, kódu a ověřených dokumentů.

Terra Nova může být odvážná. Nemůže být fakticky rozjetá do několika verzí zároveň.

## 7. Konkrétní problémy, které musí první přepis odstranit

1. Opravit framing trilogie na čtyřknihovou linii.
2. Opravit mapu souborů a pořadí kapitol v README.
3. Přeznačit historické zmínky o Praha/USA/Singapore jako minulou rehearsal fázi, ne současnost.
4. Sladit ekonomické poměry s kanonickou runtime realitou.
5. Sladit bridge/L2 status s aktuální produkční dokumentací.
6. Rozdělit hlavní text a appendices.
7. Dopsat explicitní úvodní most ze tří předchozích knih.
8. U Full.md regenerovat obsah až po strukturálním srovnání jednotlivých kapitol.

## 8. Doporučený pracovní postup

### Fáze 1 — Kanonické ukotvení

Výstup:
- potvrzený status TerraNova jako čtvrté knihy / Zlatého Kompasu;
- potvrzený jednovětý popis role knihy;
- potvrzené rozlišení: hlavní text vs appendix.

### Fáze 2 — Strukturální refaktor

Výstup:
- sjednocené názvy souborů;
- sjednocené pořadí kapitol;
- README odpovídající skutečné podobě knihy;
- rozhodnutí, co se slučuje a co zůstává samostatné.

### Fáze 3 — Reality sync

Výstup:
- topologie, ekonomika, bridge a roadmapa sladěné s V3 a mainnet dokumenty;
- odstraněné zastaralé produkční reference;
- jasné oddělení live stavu od budoucích fází.

### Fáze 4 — Narativní přepis

Výstup:
- doplněný úvodní most;
- sjednocený hlas celé knihy;
- každá kapitola vede čtenáře od jednoho jasného obrazu k druhému.

### Fáze 5 — Appendix a odborné přílohy

Výstup:
- Proroctví, NVIDIA a podobné materiály přesunuté do podpůrné vrstvy;
- hlavní kniha je čitelná i bez nich.

### Fáze 6 — Kompletní sestavení

Výstup:
- nový **Full.md**;
- krátké public-facing shrnutí pro web;
- případně samostatný executive abstract pro čtenáře, kteří nechtějí číst celý rukopis.

## 9. Definice hotové knihy

Kniha bude hotová tehdy, když současně platí:

1. Čtenář pochopí, proč Terra Nova existuje vedle předchozích tří knih.
2. Čtenář bezpečně rozliší, co je symbol, co je live systém a co je budoucí horizont.
3. Kniha působí jako jeden příběh, ne jako složenka manifestu, roadmapy a appendixů.
4. Všechny technické a provozní reference budou odpovídat dnešní kanonické dokumentaci.
5. Závěr v podobě Kompasu čtenáře pošle do reality, ne jen do dojmu.

## 10. Doporučení pro bezprostřední další krok

Nejdřív nepřepisovat všechno naráz.

Nejvyšší návratnost má tento sled:

1. upravit README a celkovou identitu knihy,
2. dopsat novou úvodní kapitolu „Most ze tří knih“,
3. opravit kapitolu L1-L4 podle dnešní reality,
4. rozhodnout appendix vs hlavní text u Proroctví a Nvidia Compute,
5. teprve potom dělat plný stylistický přepis.

---

Tento plán je schválně přísný.

Terra Nova má potenciál být nejsrozumitelnější a nejdůležitější knihou celého komplexu ZION, protože jako první převádí mýtus, filosofii a probuzení do konkrétní civilizační mapy.

Právě proto musí být strukturálně čistší než všechny předchozí knihy.
