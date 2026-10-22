# 16 — Návaznost na OASIS — HORIZONT

> **HORIZONT** — návrh budoucí adaptace, **nikoli seznam dostupných funkcí**. Zdrojový kód a data OASIS zůstávají nedotčené; tato kapitola jen navrhuje, jak filmový svět později navštívit.

## První pravidlo adaptace

**Přenášíme cestu Lumi a její svět; nepřenášíme automaticky osobní žádost o ruku ani soukromý vztah skutečných lidí.**

Herní verze není jen video vložené do portálu. To, co Lumi ve filmu pochopí, může návštěvník zakusit **drobnou interakcí**.

## Zastavení — mapa film → interakce

| Zastavení | Obraz(y) | Návrh interakce | Zásadní hranice |
|---|---|---|---|
| **Práh a světlo** | 01, 10 | Přejít práh brány; posvítit si na ornament a najít linii. | Lumi jako průvodce, ne brána jako test. |
| **Péče o vodu** | 02 | Uvolnit malé koryto; sledovat vodu téct. | Nikdo nemusí „uspět" — lze jen projít kolem. |
| **Dům jmen** | 03 | Nechat si přečíst své „označení" a zkusit říct jen jméno. | Žádná gamifikace identity, žádné „tituly". |
| **Větrná zahrada** | 04 | Pomoci obnovit vodní vedení; mechanismus reaguje jako partner. | Technika ve službě života, ne puzzle za odměnu. |
| **Voda a paměť** | 05 | Sklonit světlo k hladině; zahlédnout stylizované fragmenty. | Jen schválené obrazy; žádné rodinné dokumenty. |
| **Strom nad Zemí** | 06 | Projít obytnou zahradou; pomoci s drobným úkonem. | Issobella = „možná budoucnost", ne slib. |
| **Slib v hlubině** | 07 | Volitelná kulturní část — krátká pohádka o návratu. | Ne zkouška víry; lze přeskočit. |
| **Dílna první čáry** | 08 | Prohlédnout schválený motiv nebo nakreslit vlastní linii. | Každý může začít malým dílem. |
| **Otevřená stránka** | 09–10 | Dobrovolně napsat/nakreslit představu domova, nebo odejít. | **Žádná povinná odpověď**; žádná veřejná galerie bez volby. |

## Vztah Lumi a návštěvníka

- **Lumi jako průvodkyně** — ne automaticky nový hratelný model, ne romantický chatbot.
- Samostatně se rozhodne: NPC, zastavení v Codexu, avatar k výběru, nebo kombinace.
- **Nepředstírá skutečnou Ericku** ani konkrétní dítě; nenabízí vztah s reálnou osobou.
- Nepoužívá **rodinné materiály jako personalizační data** (jména dětí, fotografie, vzpomínky).

## Hranice herního návrhu

- Linka sama **neurčuje tokenové odměny, ekonomiku, skóre vztahů ani prahy přístupu**; nemění existující pravidla hry.
- Z návrhu žádosti se **nestane hra na získání souhlasu** skutečné ženy.
- Soukromé odpovědi/kresby návštěvníků se **nesmějí bez volby publikovat**.
- **Nevyžadovat** finanční dar, nákup, citlivou zpověď ani sdílení rodinného příběhu.
- Umožnit **přerušení, návrat a přeskočení** citlivých částí; zvuk a pohyb musí jít omezit; obsah musí být srozumitelný i textově.
- Konkrétní ukládání postupu se navrhne až při implementaci — **zatím se netvrdí, že je bezpečně vyřešené**.

## Co lze mezi filmem a hrou sdílet

| Sdílené po schválení | Nesdílené automaticky |
|---|---|
| Výtvarná bible Lumi | Osobní epilog |
| Lucerna, symboly, prostředí | Záznam reakce Ericky |
| Model zahradního mechanismu | Její fotografie, rodinné údaje |
| Krátké dialogy | Jména dětí, soukromá korespondence |
| Schválená hudba a ambient | Referenční hudba bez práv |

## Opory v repozitáři (ověřené)

| Opora | Co dokládá | Co **ne**dokládá |
|---|---|---|
| `BabylonIntro.tsx` | Rádha a Elizabeth v úvodním textu; jedna nese lucernu | Hotový film, detailní model Lumi |
| `worlds.ts` — ELIZABET | Položka světa, popis strážkyně, layer 3 | Avatar id ≠ identifikátor světa |
| `GameView.tsx` | Režim avatars propojuje panel a scénu | Nový obsah už zapojený |
| `avatars/Panel.tsx` | Panel načítá avatary (jméno, role, quest, teaching, ability) | Aktuální API vrací Lumi |
| `avatars/Scene.tsx` | Výběr avatarových uzlů, jednoduché koule | Animovaná postava z filmu |
| `lib/api.ts` | AvatarDef s číselným id, funkce pro avatary/questy | ELIZABET jako avatarové id |

## Před budoucí implementací

1. Ověřit **skutečný záznam Elizabet/Lumi** v avatarových datech a vztah k položce světa — neslepě duplikovat identitu.
2. Schválit **veřejnou charakteristiku** a oddělit ji od neveřejné rodinné fikce.
3. Vybrat **první malou scénu**: brána, Lumi, lucerna — ne všechny světy najednou.
4. Napojit **jednu dokončenou interakci** a ověřit na existující navigaci a skutečném ukládání postupu.
5. Teprve potom přidávat další kapitoly a vazbu na filmový přehrávač.
6. Před zveřejněním prověřit **obsah, práva, přístupnost a absenci osobních podkladů** v distribuovaných souborech.

## Technické otázky k vyjasnění (až při implementaci)

- Kam patří „cesta DOMŮ" — jako quest line existujícího světa, nová oblast, nebo samostatná interaktivní kapitola?
- Jak se ukládá postup návštěvníka — lokálně, na účtu, nebo vůbec (volba)?
- Lumi jako avatar — nový model, nebo skin/persona existující Elizabeth?
- Filmový přehrávač v OASIS — embed, vlastní stránka, nebo jen externí odkaz?

---

*Žádný z těchto bodů se uložením dokumentu neprovádí. Zdrojový kód a data OASIS zůstávají nedotčené.*
