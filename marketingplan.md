# Marketing plán — Market a Lumi

> **17. 11. 2026.** Provozní plán pro Facebook a Instagram.
> Virtuální zboží se začíná prodávat teď. Fyzická Lumi čeká na nový laser.
> Ceny, `buyable` a deploy se tímto dokumentem nemění. Prodejní pravda je katalog v kódu, ne starší plán v `lumi.md`.

---

## 1. Rozhodnutí 17. 11.

Dvě tratě. Nemíchají se v jednom postu.

| | Trať A — jede | Trať B — stojí |
|---|---|---|
| Co | ZION Pass a digitální kniha | Fyzická lucerna Lumi 2 (`lamp-001` a celý shop na `lumi.zionterranova.com`) |
| Proč teď | Checkout, e-mail a bonus už fungují. Mezní náklad dalšího kusu je skoro nula. | Nový laser není. Na 5W diodě trvá jeden kus ~4 hodiny. Poptávka z reklamy by přerostla sklad. |
| Cena v kampani | Pass **108 Kč**, kniha **216 Kč** | V reklamě **žádná cena**. Na webu zůstává 490 Kč, v `lumi.md` je návrh 590 Kč — ani jedno se teď neinzeruje. |
| Sklad | 999 / 999, `active`, `buyable: true` | Market má sklad **5**. Hotových kusů mimo market je v `lumi.md` ~17. **Neinzervat.** Ruční prodej ze skladu jen bez slibu, že se doplní. |
| Konec kampaně | **24. 12. 2026, 23:59 CET** (bonus 144 ZION/Kč) | Až bude nový laser, fyzický test hoření a jedna cena na všech plochách. |

Co z toho plyne pro člověka, který postuje:

- První věta každého postu prodává Pass nebo knihu. Nikdy lucernu, svíčku, řez laserem ani „posíláme do 10. 12.“
- Existující sklad Lumi se nefotí do feedu jako „skladem“. Když někdo napíše do zpráv, odpověď je: kusy ze současné série bereme jen napřímo, novou sérii oznámíme, až pojede nový stroj.
- Služby `digi-001`–`004` a software `soft-001`–`003` jsou v katalogu digitální, ale do vánoční kampaně nepatří. Konzultace a „rig“ nemají doručení za minutu. Druhá vlna, až Pass a kniha jedou.

---

## 2. Souhrn na jednu stránku

**Co prodáváme.** Dva digitální dárky z vánoční edice na [market.zionterranova.com](https://market.zionterranova.com).

| Produkt | ID | Cena | Co přijde | Bonus do 24. 12. |
|---|---|---|---|---|
| ZION Pass | `zion-pass-001` | 108 Kč | Kód `ZAP-…` e-mailem. Otevře Nirvanu (hry, světy, chat) i ZION Archiv. | 15 552 ZION |
| Království srdce | `book-001` | 216 Kč | ZIP: 8 edic × 5 jazyků, PDF i EPUB, 40 knih. K tomu Archive Pass. | 31 104 ZION |

Platba: karta, bankovní převod, ZION. Doprava u obou: `virtualni-nakup`, nic se nebalí.

**Komu.** Člověk, který chce dárek do e-mailu ještě dnes — sobě nebo někomu, komu ho přepošle. Pass je vstup (levnější, srozumitelný). Kniha je příběh (dražší, konkrétní: loď, tesař, pět jazyků). Běžný dárkový zákazník nekupuje kvůli tokenu. Bonus je věta pod cenou, ne titulek.

**Kam vede odkaz.**

- Instagram, Pass: `https://market.zionterranova.com/vanoce/zion-pass?utm_source=instagram&utm_medium=social&utm_campaign=vanoce2026&utm_content=pass`
- Instagram, kniha: `https://market.zionterranova.com/vanoce/kniha-kralovstvi-srdce?utm_source=instagram&utm_medium=social&utm_campaign=vanoce2026&utm_content=kniha`
- Facebook: stejné cesty, `utm_source=facebook`.

Bio na obou sítích ukazuje **jen Pass** (108 Kč, nejnižší práh). Kniha žije v postech.

**Co je zakázané říct.**

- Že lucerna je skladem, že stihneme Vánoce, že řezeme „teď“, cena 490 nebo 590, personalizace, prodejny, komise.
- Že ZION je investice, výnos, „vydělej“, kurz nebo směna za koruny.
- Že software, konzultace nebo těžební rig jsou součástí vánoční edice.
- Denní slib z whitepaperu (`@zion_blockchain`, post každý den). Tahle kampaň je **3 publikace týdně**.

**Rytmus.** Úterý feed, čtvrtek Reels nebo story, sobota druhý feed nebo story. Neděle se nepostuje. Jedno odpoledne připraví celý týden.

---

## 3. Analýza: co je hotové a co prodej brzdí

### 3.1 Tři dokumenty, tři pravdy

| Zdroj | Co tvrdí | Co s tím udělá tahle kampaň |
|---|---|---|
| `lumi.md` (15. 11.) | Cena 590 Kč všude, reklama 0 Kč, prodejny, výroba na 5W laseru, strop ~30 kusů. | Cenu 590 **nepoužíváme** — do katalogu se nedostala. Reklamní zákaz platí dál pro Lumi a jako default i pro Meta ads. Prodejny a B2B na desítky kusů **nejsou v tomhle okně**. |
| `apps/MarketPlace/src/data/shopProducts.ts` + `shopNews.ts` | Pass 108, kniha 216, lucerna 490. Kampaň 144 ZION/Kč do 24. 12. 2026. Všechny tři `buyable: true`. | Pass a kniha jsou nabídka. Lucerna na webu zůstává koupitelná (tenhle dokument to nepřepisuje), v reklamě na ni **žádný odkaz**. |
| `heros/Lumi/LUMI_ZION_B_web_a_kampane/` | Bannery 1080×1080: Vánoce, svatba, květiny. Bez pevné ceny. Cesty `/vanoce` a `/kvetinarstvi` na Lumi webu při auditu 404. | Schovat. Použít až s laserem, testem hoření a jednou cenou. Na Pass a knihu z nich kampaň nestavět — je na nich lucerna. |

### 3.2 Co je hotové pro virtuál (jde postovat)

- Stránky: `/vanoce/zion-pass`, `/vanoce/kniha-kralovstvi-srdce`, homepage novinky „Market je otevřený“.
- Checkout: karta, převod, ZION, virtuální doručení. U knihy je ZIP na `filesUrl`. U Passu odchází kód `ZAP-…` a peněženka s bonusem.
- Obrázky Engine B: Pass `public/vanoce/home/01_zion_pass.webp`, kniha `book-001_kralovstvi-srdce.webp`, galerie „digitální dárek do e-mailu“. Čtverec 1080×1080 z nich jde oříznout bez nové ilustrace.
- Sklad digitálu neblokuje: 999 a 999.
- Fyzický test hoření, GPSR karta a laser **nejsou podmínka** Passu ani knihy.

### 3.3 Co chybí, než se první post objeví

Tohle neudělá repozitář. Udělá to člověk, v tomhle pořadí:

1. Facebook stránka a Instagram profesionální účet, propojené v Meta Business Suite. Handle z whitepaperu (`@zion_blockchain`) ber jako kandidáta, ne jako ověřený živý účet — před prvním postem otevři účet a zkontroluj, že na něm sedí odkaz na market.
2. Oříznout 6 čtverců a 2 na výšku z existujících Engine B obrázků Passu a knihy. Žádný nový render lucerny.
3. Vložit do bio odkaz na Pass (Instagram UTM). Do Facebookového tlačítka totéž s `utm_source=facebook`.
4. Jedna ruční objednávka Passu za 108 Kč až do e-mailu s kódem. Když e-mail nedorazí, nepostuje se.
5. Pixel se **nezapíná**. Lumi web ho nemá schválně. Market ho v tomhle kroku nedostane — chybí rozhodnutí o souhlasu. Měří se UTM a tabulka objednávek.

### 3.4 Proč Lumi teď prodej neunese

| | 5W laser (dnes) | Co by reklama udělala |
|---|---|---|
| Řez | ~4 h / kus, 20,9 m, 614 obrysů | Každá objednávka nad sklad je půlden stroje |
| Kapacita | 1,5–2 kusy denně, do Vánoc strop nízké desítky včetně hotových | Feed „skladem / do 10. 12.“ ten strop vyprodá dřív, než se stihne říct stop |
| Marže při 490–590 Kč | desítky až nízké stovky Kč na kus po čase člověka | Meta CPA u dárku v prosinci bývá vyšší než příspěvek na kus |
| Hotový sklad | ~17 + 5 v marketu | Stačí na ruční prodej. Nestačí na kampaň, která slibuje doplnění |
| `physical_test` | v podkladech pořád otevřený | Inzerovat hoření bez zapsaného testu nejde |

Závěr analýzy: jediný produkt, který je zároveň hotový, digitální a dárkový, je dvojice Pass + kniha. Všechno ostatní v katalogu buď čeká na stroj, nebo to není vánoční impulz.

---

## 4. Trať A — Facebook a Instagram, organicky, 17. 11.–24. 12.

Tři publikace týdně. Stejný obsah na FB i IG, jiné UTM. Formáty: feed **1080×1080**, story a Reels **1080×1920**.

Obrázek: Engine B Pass nebo obálka knihy. Na čtverec nepřidávat cenu do ilustrace — cena je v textu, ať se při změně sazby nemění soubor.

### Kalendář

Týden se počítá po–ne. Tento týden začíná úterým 17. 11., proto má dvě publikace a sobotní story. Od 24. 11. platí plné tři.

| Den | Formát | První věta | CTA | Kam |
|---|---|---|---|---|
| Út 17. 11. | Feed, čtverec, Pass | Pass za 108 Kč otevře Nirvanu i Archiv. Kód přijde e-mailem. | Koupit Pass | `utm_content=pass` |
| Čt 19. 11. | Reels, 15 s, obrazovka e-mailu | Zaplatíš. Za minutu máš kód. Žádná pošta. | Odkaz v bio | Pass |
| So 21. 11. | Story, Pass + nálepka odkazu | Dárek, který nezůstane na poště. | Nálepka „108 Kč“ | Pass |
| Po 24. 11. | Feed, čtverec, kniha | Příběh lodi, kterou postavil tesař. 40 knih, pět jazyků, 216 Kč. | Číst ukázku a koupit | `utm_content=kniha` |
| St 26. 11. | Story, obálka | Osm edic, jeden příběh. Pošleš odkaz, ne balík. | Nálepka | Kniha |
| So 28. 11. | Feed, Pass jako dárek | Pošli kód dál. Pass se neváže na tebe, váže se na průkaz. | Darovat Pass | Pass |
| Po 1. 12. | Reels, 20 s, listování PDF | Otevři knihu na telefonu. Je v pěti jazycích. | Odkaz v bio | Kniha |
| St 3. 12. | Feed, kniha, příběh | Tesař stavěl loď pro moře, které není na mapě. | Koupit knihu | Kniha |
| So 6. 12. | Story, oba | 108 vstup, 216 příběh. Obojí dnes v e-mailu. | Dvě nálepky | Pass + kniha |
| Po 8. 12. | Feed, oba, bez pošty | Letos dárek, který nečeká na Zásilkovnu. | Vybrat | Pass (bio), kniha v textu |
| St 10. 12. | Story, odpočet | Do 24. 12. je k Passu a knize vánoční bonus. | Nálepka | Pass |
| So 13. 12. | Feed, dvojice | Vstup a příběh. Dva e-maily, žádná adresa. | Koupit obojí zvlášť | oba odkazy |
| Po 15. 12. | Feed, Pass, odpočet | Zbývá devět dní vánoční edice. Pass je pořád 108 Kč. | Koupit dnes | Pass |
| St 17. 12. | Reels z 19. 11. znovu | Stejné video, nový text: „devět dní“. | Odkaz v bio | Pass |
| So 20. 12. | Feed, kniha, odpočet | Čtyři dny. Kniha přijde i 24. 12., protože je to soubor, ne balík. | Koupit knihu | Kniha |
| Po 22. 12. | Story | Zítra poslední celý den. Odkaz je v bio. | Nálepka | Pass |
| St 24. 12. | Feed, poslední | Dnes do půlnoci vánoční edice. Pak bonus končí, kniha a Pass zůstávají. | Koupit teď | Pass |

Po 24. 12. se posty s bonusem smažou z naplánovaných. Účty zůstanou, další vlna až s rozhodnutím o Lumi.

### Pravidla jednoho postu

- Jedna CTA. Bio je Pass. Když post prodává knihu, odkaz na knihu je v prvním komentáři (IG) a v textu příspěvku (FB).
- První řádek nese cenu nebo „e-mail“. Algoritmus schová zbytek.
- Hashtagů nejvýš pět, pod textem, ne v první větě: `#vanocnidarek` `#digitalnikniha` `#zion` a dva podle postu.
- Odpověď na komentář „kde je lucerna?“: „Lucerna čeká na novou sérii. Teď je v prodeji Pass a kniha, obojí hned e-mailem.“ Žádná cena lucerny, žádný termín.

---

## 5. Copy k překopírování

Bonus je vždy až poslední věta. Kdo token nezná, koupí dárek i bez ní.

### Feed

**F1 — Pass, start (17. 11. a 15. 12.)**

> ZION Pass, 108 Kč. Jeden kód otevře Nirvanu i ZION Archiv — hry, světy, chat a knihovnu, ze které ten svět vyrostl.
>
> Po zaplacení přijde e-mail s kódem ZAP-…. Žádná doprava, žádné čekání na sklad. Kód můžeš nechat sobě, nebo ho poslat dál jako dárek.
>
> Do 24. 12. je k Passu navíc 15 552 ZION na peněženku, která přijde se stejným e-mailem.
>
> Odkaz je v bio.

**F2 — Kniha, obsah (24. 11.)**

> Království srdce, 216 Kč. Příběh lodi, kterou postavil tesař — pro moře, které není na žádné mapě.
>
> V balíku je osm edic téhož příběhu, každá v pěti jazycích. Čtyřicet knih, PDF i EPUB. Otevřeš je na telefonu ještě dnes.
>
> Do 24. 12. je ke knize 31 104 ZION.
>
> Odkaz na knihu je v prvním komentáři.

**F3 — Pass jako dárek (28. 11.)**

> Dárek, který nepotřebuje adresu.
>
> ZION Pass stojí 108 Kč. Kód se neváže na tebe — váže se na průkaz. Pošleš ho v chatu a člověk na druhé straně vstoupí do Nirvany a do Archivu sám.
>
> Do 24. 12. k tomu patří 15 552 ZION.

**F4 — Kniha, příběh (3. 12.)**

> Tesař v dílně svého otce stavěl loď. Říkal jí Království srdce.
>
> Digitální kniha má 216 Kč. Osm edic, pět jazyků, PDF a EPUB. Není to ukázka — je to celý příběh, a je v e-mailu hned po zaplacení.
>
> Do 24. 12. bonus 31 104 ZION.

**F5 — Bez pošty (8. 12.)**

> Letos dárek, který nečeká na Zásilkovnu.
>
> Pass, 108 Kč — vstup do Nirvany a Archivu.
> Kniha, 216 Kč — příběh lodi v pěti jazycích.
>
> Obojí přijde e-mailem. Vánoční bonus k oběma běží do 24. 12.
>
> Pass je v bio. Kniha v prvním komentáři.

**F6 — Dva e-maily (13. 12.) a poslední den (24. 12.)**

> Vstup a příběh. Dva nákupy, dva e-maily, žádná adresa.
>
> 108 Kč Pass. 216 Kč kniha Království srdce.
>
> Dnes do půlnoci 24. 12. k nim patří vánoční bonus. Zítra Pass i kniha zůstávají, bonus ne.
>
> Odkaz na Pass je v bio.

U F6 před 24. 12. vynech větu „Dnes do půlnoci…“ a nech jen „Bonus běží do 24. 12.“

### Stories

Krátké, velký text, nálepka s odkazem. Čtyři texty, točit podle kalendáře.

**S1.** „Dárek, který nezůstane na poště. Pass, 108 Kč.“ Nálepka na Pass.

**S2.** „Osm edic. Jeden příběh. 216 Kč, e-mailem.“ Nálepka na knihu.

**S3.** „108 vstup. 216 příběh. Obojí dnes.“ Dvě nálepky.

**S4.** „Do 24. 12. vánoční bonus k Passu a knize. Odkaz v bio.“ Nálepka na Pass.

### Reels

**R1 — Kód za minutu (19. 11., znovu 17. 12.)** 1080×1920, 12–15 s, natáčí se obrazovka, ne dílna.

| Čas | Obraz | Text na videu |
|---|---|---|
| 0–3 s | stránka Passu, cena 108 | „108 Kč“ |
| 3–8 s | potvrzení objednávky / e-mail s kódem (osobní údaje zakrýt) | „Kód přijde e-mailem“ |
| 8–12 s | Nirvana nebo Archiv po zadání kódu, bez seedu a bez peněženky v záběru | „Žádná pošta“ |
| 12–15 s | černá, bílá věta | „Odkaz v bio“ |

Titulek pod videem: „ZION Pass. Zaplatíš, za chvíli máš kód, vstup je v Nirvaně i v Archivu. 108 Kč do 24. 12. s bonusem 15 552 ZION.“

Do záběru nepatří seed phrase, celá peněženka, admin, ani lucerna.

**R2 — Listování knihou (1. 12.)** 15–20 s.

| Čas | Obraz | Text na videu |
|---|---|---|
| 0–4 s | obálka Engine B | „Království srdce“ |
| 4–14 s | pomalé listování PDF, jedna stránka, čitelný odstavec | „40 knih · 5 jazyků“ |
| 14–20 s | zavření a věta | „216 Kč · e-mailem · odkaz v komentáři“ |

Titulek: „Digitální kniha, ne ukázka. Osm edic téhož příběhu, PDF i EPUB. 216 Kč, do 24. 12. bonus 31 104 ZION.“

---

## 6. Trať B — Lumi čeká

Podmínka, než se Lumi vrátí do feedu, do prodejen i do B2B:

1. Nový laser je v dílně a umí sérii (ne jen jeden zkušební kus).
2. Fyzický test hoření je zapsaný. Do té doby se neinzeruje svíčka.
3. Jedna cena na marketu i na `lumi.zionterranova.com`. Dnes je v kódu marketu **490 Kč**, v `lumi.md` návrh **590 Kč**. Kampaň nesmí vybrat jednu z nich potichu.
4. Sklad, který se slibuje, existuje. Slib „doplníme“ bez kapacity se neopakuje.

### Co se teď nesmí publikovat

- Reels a popisky z `lumi.md` §9: „20,9 metru řezu. 614 obrysů. 590 Kč. Posíláme do 10. 12.“
- Texty pro prodejny, komisi 30 %, objížďku 20.–21. 11. a B2B na 20–30 kusů (`lumi.md` §6 a §10). Bez laseru je to slib, který nejde splnit.
- Bannery `heros/Lumi/LUMI_ZION_B_web_a_kampane/kampane/` (Vánoce, svatba, květiny) jako reklama s odkazem na nákup.
- Stories „posledních X kusů lucerny“.

### Co zůstane schované a použije se později

- Ty bannery a mastery v `LUMI_ZION_B_web_a_kampane/` — vizuál je hotový, prodejní věta k němu zatím není.
- Foto plán a 12s střih „Rozsviť Lumi“ v `lumi.md` §9. Natočit při skutečné výrobě na novém stroji, ne aranžovat ze starého skladu.
- Ruční prodej hotových kusů (market sklad 5, zbytek série mimo inzerci). Bez postu, bez „edice pokračuje“, bez termínu dopravy v reklamě.

`lamp-001` na webu zůstává `buyable: true`. Tento plán to nemění. Reklama na něj neodkazuje, aby poptávka nepřerostla pět kusů a čtyřhodinový řez.

Až se trať B otevře, první post není sleva. První post je: stroj jede, cena je jedna, počet kusů je číslo, které sedí na sklad, cutoff dopravy je datum, které se stihne.

---

## 7. Placená Meta — volitelný modul, default vypnuto

Matematika z `lumi.md` platí pro lucernu dál: při čtyřech hodinách řezu se placený dosah nevyplatí. Na Pass a knihu se nesahá, dokud neřekneš výslovně „zapni test“.

Když ho zapneš, pravidla jsou tahle a nepřekračují se:

| | Hodnota |
|---|---|
| Kdy nejdřív | Po 7 dnech organiky (nejdříve 24. 11.), a jen když ruční objednávka Passu prošla až do e-mailu |
| Co | Jen Pass, 108 Kč. Kniha a Lumi v ads ne |
| Strop | **1 500 Kč** celkem, denní strop 150 Kč |
| Cíl | Nákup, ne dosah a ne prokliky |
| Vypnout | Když cena za nákup přeleze **80 Kč**, nebo když se za 1 500 Kč neprodá nic |
| Kreativa | F1 + odkaz s `utm_source=facebook&utm_medium=paid&utm_campaign=vanoce2026&utm_content=pass` |
| Pixel | Bez pixelu kampaň na nákup Meta nenastavíš pořádně. Pixel se nenasazuje v tomhle dokumentu. Test bez pixelu = jen provoz na odkaz, a pak strop platí stejně |

Dokud nezazní „zapni test“, útrata je **0 Kč**. Organika z §4 jede i bez toho.

---

## 8. Měření

Pixel na Lumi webu se nezapíná. Na marketu se v tomhle kroku nezavádí.

Co se zapisuje ručně, jednou týdně v pondělí (5 minut):

| Týden | Objednávky Pass | Objednávky kniha | Tržba Kč | Odkud (bio / komentář / zpráva / jiné) | Poznámka |
|---|---|---|---|---|---|
| 17.–23. 11. | | | | | |
| 24.–30. 11. | | | | | |
| 1.–7. 12. | | | | | |
| 8.–14. 12. | | | | | |
| 15.–24. 12. | | | | | |

UTM v odkazech z §2 jsou zdroj. Když objednávka v adminu nemá původ, počítá se do „jiné“. Pole „Jak jste nás našli?“ z `lumi.md` se na market v tomhle kroku nepřidává.

Po 24. 12. jedno číslo: kolik Passů a knih se prodalo, a jestli má smysl nechat bio na Passu i v lednu. Lumi se do té tabulky nepíše, dokud není trať B otevřená.

---

## 9. Checklist před prvním postem

- [ ] FB stránka a IG profesionální účet existují a jsi admin.
- [ ] Profilovka je značka marketu nebo obálka / Pass, ne fotka lucerny s cenou.
- [ ] Bio: jedna věta „ZION Pass, 108 Kč, kód e-mailem“ + odkaz na Pass s instagram UTM.
- [ ] Facebookové tlačítko vede na Pass s facebook UTM.
- [ ] F1, R1 a S1 jsou nahrané jako koncept, ne publikované.
- [ ] Ruční nákup Passu za 108 Kč: platba prošla, e-mail s `ZAP-…` dorazil, v záběru Reels není seed.
- [ ] V naplánovaných příspěvcích není Lumi, 490, 590, laser, svíčka, prodejna.
- [ ] Odpověď na „kde je lucerna?“ je uložená v poznámkách telefonu (§4).
- [ ] Placená kampaň je vypnutá. Strop 1 500 Kč se neutratí, dokud ho sám nezapneš.

První publikace podle kalendáře: **úterý 17. 11., feed F1.** Když je účet nebo e-mail Passu ještě rozbitý, posune se celý kalendář o stejný počet dní. Slib „do 24. 12.“ u bonusu se neposouvá — ten sedí na nastavení v obchodě, ne na prvním postu.
