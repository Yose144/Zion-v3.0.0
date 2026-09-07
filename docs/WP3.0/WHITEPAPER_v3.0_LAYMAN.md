# ZION TerraNova — Průvodce pro každého
## Co to je, jak to funguje a proč by vás to mělo zajímat

**Verze:** 3.0 — MainNet Genesis  
**Pro:** Každého, kdo chce pochopit ZION bez technického vzdělání

**Aktuální stav (2026-03-03):** 168h stabilita proběhla úspěšně, ale před ostrým MainNet spuštěním ještě dokončujeme CHv4 produkční upgrade a revenue produkční aktivaci (viz `docs/2.9.7/MAINNET_READINESS_UNIFIED.md`).

---

> *"Nestavíme banku. Stavíme most."*

---

## Úvod: Co je ZION jednou větou?

ZION je digitální měna (podobně jako Bitcoin), kterou může těžit kdokoli s běžným počítačem — a každá vytěžená mince automaticky přispívá částí své hodnoty na humanitární projekty a financování vesmírné stanice ZION Issobella.

---

## Část 1: Proč vůbec ZION existuje?

### Problém se současnými kryptoměnami

Možná jste slyšeli o Bitcoinu nebo Ethereu. Jsou to skvělé technologie, ale mají jeden velký problém: **velké peníze tam přišly dřív než vy**.

Představte si, že byste si šli koupit rodinný dům, ale zjistili byste, že developer a jeho investoři si ho koupili rok předem za čtvrtinovou cenu a teď ho prodávají vám. To je přesně to, co se děje ve většině kryptoměnových projektů — insider skupiny dostanou tokeny lacino, vy je kupujete draho.

ZION říká: **ne tak**.

### Co ZION dělá jinak

1. **Žádný předprodej.** Nikdo — ani zakladatelé — nemohl koupit ZION před ostatními. Kdo chce ZION, musí si ho vytěžit.
2. **Každý počítač se počítá.** ZION je navržen tak, aby byl odolný vůči průmyslovým těžebním strojům (tzv. ASIC). Váš domácí počítač má stejnou šanci jako velká farma.
3. **Každý blok pomáhá světu.** 5 % z každého vytěženého bloku jde do humanitárního fondu a dalších 5 % do fondu L5/L6 Issobella (věda a vesmírný program). Nedobrovolně, neodvolatelně — je to přímo v kódu.

---

## Část 2: Jak těžba funguje? (bez technického žargonu)

### Analogie: Digitální loterie s vypočítatelnou prací

Představte si, že stát vydá úlohu: "Najděte číslo, které po zpracování naším vzorcem dá výsledek začínající pěti nulami." Kdo ji najde první, dostane odměnu.

Počítač tuto úlohu řeší tak, že zkouší jedno číslo za druhým — miliardkrát za sekundu. Tomu se říká těžba (mining). Čím více počítačů zkouší, tím bezpečnější je síť.

V ZION dostane ten, jehož počítač úlohu vyřeší, odměnu **5 400 ZION** (plus případný bonus). Odměna každých 10 let mírně klesne o 20 % (tzv. Decade Decay) — na rozdíl od Bitcoinu, kde klesá skokově na polovinu. Síť tak funguje 100+ let a od roku 2126 vyplácí těžařům trvalou minimální odměnu navěky.

### Proč právě já mohu těžit?

Protože ZION používá algoritmus zvaný **CosmicHarmony**, který záměrně potřebuje hodně paměti RAM. Průmyslové ASIC stroje sice mají rychlé čipy, ale právě paměť je jejich slabinou. Výsledek: domácí počítač s 8–16 GB RAM je konkurenceschopný.

### Jak začít těžit?

```
1. Stáhněte si ZION miner z GitHubu
2. Vygenerujte si peněženku (adresu pro příjem)
3. Připojte se k poolu: pool.zionterranova.com:3333
4. Spusťte program a nechte ho běžet
```

Pool je jako "skupinová loterie" — jednotliví těžaři spojí výpočetní výkon a odměny si rozdělí poměrně. Díky tomu dostáváte menší, ale pravidelné platby místo občasné velké.

---

## Část 3: Peněžní struktura — kolik ZION existuje?

### Základní emise: 144 miliard ZION + tail

ZION má základní emisní cíl 144 000 000 000 tokenů (premine + hlavní emisní fáze). Poté běží tzv. tail emission — trvalá minimální odměna pro těžaře, aby síť měla dlouhodobě bezpečnostní budget.

Pro srovnání: Bitcoin má maximálně 21 milionů kusů. ZION má víc, protože se hodí jako každodenní platidlo, ne jen jako "digitální zlato".

### Nejmenší jednotka: flower

Stejně jako má Bitcoin satoshi, ZION má **flower**. Platí:

- **Spec 2.9.7 (Flowers): 1 ZION = 1 000 000 000 000 flower**
- **1 flower = nejmenší převoditelná jednotka v síti**

Díky tomu lze pohodlně posílat i velmi malé částky bez zaokrouhlovacích problémů.

Poznámka: runtime/API v aktuálním L1 kódu zatím pracují s 1 ZION = 1 000 000 atomic units; Flowers.md popisuje cílovou migrační specifikaci.

### Jak ZION přichází do oběhu

Každých 60 sekund přibyde nový blok a s ním 5 400 nových ZION. Každých 10 let odměna klesne o 20 % (Decade Decay) — mírně, ne najednou na polovinu jako u Bitcoinu. Těžaři tak mají předvídatelný příjem na 100+ let. Od roku 2126 běží síť navěky na trvalé minimální odměně.

### Genesis: Co bylo na začátku?

Při spuštění sítě bylo vytvořeno 16,78 miliardy ZION předem (tzv. premine — 11,65 % celkové nabídky). Tato část se rozdělila takto:

| Část | Kolik | Proč |
|------|-------|------|
| OASIS/Golden Egg | 8,25 miliard | Odměny pro první hráče a těžaře |
| DAO pokladna | 4 miliardy | Rozhoduje komunita (zamknuto 1 rok) |
| Infrastruktura | 2,59 miliardy | Servery, vývoj, bezpečnostní audit |
| Humanitární fond | 1,44 miliardy | Okamžitý seed pro humanitární projekty |

---

## Část 4: Vědomostní těžba — proč být věrný se vyplatí

### Co je to Consciousness Mining?

Představte si, že těžba je jako trénink. Čím déle a pravidelněji trénujete, tím lepší výsledky máte — a tím víc vám síť dá.

ZION má 9 úrovní "vědomí", které odrážejí vaši angažovanost v síti:

| Úroveň | Název | Bonus k odměně |
|--------|-------|----------------|
| 1 | Physical | standard |
| 2 | Mental | +10 % |
| 3 | Aware | +20 % |
| 4 | Conscious | +30 % |
| 5 | Awakened | +50 % |
| 6 | Enlightened | +100 % (dvojnásobek) |
| 7 | Transcendent | +200 % (trojnásobek) |
| 8 | Cosmic | 5× víc |
| 9 | On The Star | 10× víc |

### Jak stoupat na vyšší úroveň?

Sbíráte XP body (zkušenostní body) za:
- Těžbu (každý odeslání výsledku = 10 XP)
- Nalezení bloku (1 000 XP)
- Pomoc komukoliv v komunitě
- Přispění do kódu projektu
- Humanitární dary

Pokud přestanete být aktivní, XP pomalu klesá — maximum ale nikdy nepřijdete. Systém odměňuje věrnost, ne sezónní zájem.

### Proč tohle dělá ZION zajímavým?

Místo aby šli všechny odměny jen těm s nejdražšími stroji, ZION odměňuje ty, kdo jsou součástí komunity dlouhodobě. Není to sprint — je to maraton.

---

## Část 5: Humanitární fond a L5/L6 — peníze, které mění svět

### Jak to funguje v praxi

Každý blok, který kdekoli na světě někdo vytěží, automaticky pošle:
- **5 %** → Humanitární fond (dětské projekty, čistá voda, vzdělání)
- **5 %** → L5/L6 Issobella Fund (věda, volná energie, vesmírná stanice)

Žádná neziskovka, žádný správce, žádné schvalovací výbory ve smokingu. Jen kód, on-chain hlasování a lidé, kteří chtějí změnit svět. **Zapsáno přímo v kódu** (`reward_calculator.rs`), nedá se změnit bez konsenzu sítě.

### Co se s těmito penězi děje?

Organizace po celém světě mohou podat žádost o grant přes ZION DAO (hlasovací systém). Komunita hlasuje, jestli projekt schválí. Pokud ano, peníze jdou přímo na adresu organizace — ověřitelně, transparentně.

Typy projektů: studny s čistou vodou, solární panely pro školy, potravinová bezpečnost, nouzová pomoc po katastrofech, zalesňování.

### L5 Free World (cíl 2030)

L5 je humanitární vrstva financovaná přímo protokolem. Cílem je:
- Výzkum kvantové a volné energie (open-source hardware)
- Svobodné komunity s lokálními energetickými zdroji
- Humanitární mise, vzdělání, zdravotnictví

### L6 ZION Issobella (cíl 2040+)

Issobella je vesmírná observatoř na nízké oběžné dráze Země (LEO), řízená DAO. Každá vytěžená mince dnes přispívá k jejímu vybudování. Vědecká data budou otevřená pro celou komunitu. Od roku 2126 bude financována trvalou emisní odměnou navěky.

---

## Část 6: Komunita rozhoduje — DAO

### Co znamená DAO?

DAO (Decentralized Autonomous Organization) je způsob, jak skupina lidí rozhoduje o věcech bez středu moci. Žádný CEO, žádná rada, žádné tajné schůzky.

V ZION: **1 ZION = 1 hlas**.

Kdokoliv s ZION tokeny může hlasovat o tom, co se děje s penězi z DAO treasury, jaké projekty podpořit nebo jak se síť vyvíjí.

### Timelock — bezpečnostní pojistka

Žádné rozhodnutí nelze provést okamžitě. Po schválení návrhu existuje 48hodinová "chladicí lhůta", během které může kdokoli problém nahlásit. Teprve potom se exekuuje.

---

## Část 7: wZION — ZION na jiných blockchainech

### Proč most?

Bitcoin a ZION jsou "uzavřené" sítě — nemohou přímo komunikovat s Ethereem nebo jinými EVM chainy. wZION je jako "obal" — uzamknete ZION na L1, dostanete ekvivalentní wZION na Ethereum/Base/Arbitrum, se kterým pak můžete obchodovat na DEX burzách.

Je to podobné jako když jedete do zahraničí: vyměníte koruny (ZION L1) za euro (wZION na Base) a obráceně při návratu.

---

## Část 8: AI computing (NCL) — těžba s extra hodnotou

### Co je NCL?

Vaše GPU (grafická karta) je při těžbě kryptoměn z 30 % nečinná — čeká. NCL (Neural Compute Layer) využívá tuto volnou kapacitu na **AI výpočty**.

Výzkumníci, startupy nebo vývojáři si mohou přes ZION síť "objednat" AI výpočet (přeložení textu, klasifikaci obrázku, chatbota) za malý poplatek v ZION. Minér výpočet provede a dostane extra odměnu.

Výsledek: **vaše GPU těží ZION a zároveň pomáhá AI světu** — a vy dostáváte odměnu za oboje.

---

## Část 9: Čestný start — proč na to dbáme

### Skutečný Fair Launch

Tým za ZIONem **nevlastní žádné tokeny z předprodeje**. Pokud zakladatelé chtějí ZION, musí si ho vytěžit jako kdokoli jiný.

Genesis premine (16,78 miliard) je transparentně rozdělen na čtyři kategorie s veřejnými adresami — každý si může ověřit, kde tyto peníze jsou, a sledovat jejich pohyb.

To je záměrný kontrast s projekty, kde insideři mají miliony tokenů před veřejným spuštěním, prodávají je na vrcholu a komunita platí za jejich zisky.

---

## Část 10: Časová osa

```
2024          Vývoj Rust technologie
2025          TestNet spuštěn
v2.9.6        Decade Decay, WARP cross-chain, L2/L3/L4 implementace
v2.9.7        Kód zmrazen — no features, jen stabilita (nyní)
v2.9.8–2.9.9  Opravy chyb a testování
v3.0          MainNet Genesis — ostrý start, skutečné tokeny (Q4 2026)
2027+         DAO, NCL AI marketplace, mobile wallet, DEX
2030          L5 Free World Foundation (volná energie, humanit. mise)
2036          1. Decade Decay: odměna klesne 5 400 → 4 320 ZION (−20 %)
2040+         L6 ZION Issobella — vznik vesmírné stanice
2126          Tail emission navěky: 724,785 ZION/blok (síť neskončí)
```

---

## Část 11: Otázky a odpovědi

### "Můžu zbohatnout na ZION?"

Nikdo to neví. Hodnotu ZION neurčujeme my, ale trh — zájem, adopce, ekonomika. Neexistuje žádná záruka zisku. Jak u každé kryptoměny platí: investujte jen to, o co jste připraveni přijít.

### "Je ZION legální?"

ZION je open-source software, ne cenný papír. Zakladatelé nikdy nevydali tokeny formou ICO ani presale. Vždy se informujte o legislativě ve své zemi.

### "Co se stane s TestNet tokeny?"

Jsou bezcenné — pouze pro testování. MainNet začne novým blokem #0. Testnet tokeny nebudou převedeny.

### "Kde si stáhnu miner?"

```
https://github.com/Yose144/Zion-2.9
```

### "Kde najdu komunitu?"

Discord a GitHub jsou primární kanály. Odkaz najdete na https://zionterranova.com.

---

## Závěr: ZION v jednom odstavci

ZION je digitální měna s emisním cílem 144 miliard tokenů v hlavní fázi, těžená běžnými počítači bez ASIC přednosti, spuštěná čestně bez předprodeje. 5 % každého bloku jde na humanitární projekty, dalších 5 % na L5/L6 Issobella (volná energie + vesmírná stanice). Odměna každých 10 let klesne o 20 % (Decade Decay) a od roku 2126 běží tail emission — síť tak funguje dlouhodobě bez emisního šoku.  
Síť odměňuje věrné těžaře bonusy až 10×, funguje přes AI výpočtovou vrstvu a je plně řízena komunitou přes on-chain hlasování.

Nejde o obohacení jednotlivců. Jde o experiment: **může technologie přirozeně sloužit hodnotám?**

ZION věří, že ano.

---

*"Technologie bez srdce je jen stroj. Technologie se srdcem mění svět."*

---

**© 2026 ZION CoZ s.r.o., Praha. MIT licence. Whitepaper version 3.0 — laická verze.**
