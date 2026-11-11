# Lumi 2 — Vánoční filigrán

**Opravená verze podle výtvarného návrhu schváleného 11. 11. 2026.** Nahrazuje předchozí zamítnutou geometrickou vánoční sadu. Schválení se týká výtvarné předlohy; převedené výrobní kontury vyžadují zkušební výpal.

## Co použít
- `Lumi_2_A3_1ku1.svg` NEBO `Lumi_2_A3_1ku1.dxf`: kompletní rozklad jedné lucerny na jedné desce A3.
- `Jednotlive_steny/`: šest samostatných motivů, každý v SVG, DXF a PNG.
- `Vsech_6_sten.png`: aktuální vzhled skutečných řezných kontur včetně můstků. Hnědé je dřevo, světlé jsou otvory.
- `Rozklad_A3.png`: aktuální rozmístění všech dílů.
- `Schvalena_vytvarna_predloha.png`: původní schválený obrazový návrh, nikoli soubor pro laser.
- `Kontrola_spoju.json`: souřadnice všech přidaných můstků a počty otvorů.
- `Overeni_rozmeru.json`, `Kontrola_jednotlivych_sten.json`: výsledky kontrol exportovaných souborů.
- `NAVOD_PRO_AI_WEB_3D.md`: podklady pro následující rozšíření webu a 3D.

## Šest motivů
1. Stromeček s betlémskou hvězdou a ozdobami.
2. Betlém — Marie, Josef a Ježíšek.
3. Dva zvonky s mašlí a cesmínou.
4. Anděl s hvězdou a rozevlátým rouchem.
5. Vánoční svíčka s cesmínou a čemeřicí.
6. Dvě zdobené koule v jehličnatých větvích.

## Co se změnilo při převodu
Ornamenty byly obtaženy ze schváleného PNG, jemně vyhlazeny a přizpůsobeny původnímu tělu stěny. Otvory menší než 0,65 mm² byly zaceleny. Doplněné můstky mají nominální šířku 1,7 mm; to není tvrzení o minimální tloušťce všech původních detailů ornamentu. Jednotlivé jemné tahy zůstávají tenčí a vyžadují výpalovou zkoušku. Výrobní podobu ukazují nové náhledy, ne samotná předloha.

Původní vnější obrysy stěn, jazýčky, dno, botanický vršek a zkušební proužek byly převzaty z dodaných podkladů Lumi 2. Vršek má původní neutrální botanický ornament, vánoční jsou všechny stěny.

## Rozměry
- A3: 420 × 297 mm, měřítko 1:1.
- Materiál: nominálně 3mm překližka.
- Tělo stěny: 63,26795 × 120 mm; s jazýčky výška 126 mm.
- Nosný rám: alespoň 4 mm.
- Jazýčky: 8 × 3 mm; rozteč středů 29 mm.
- Drážky: 8,1 × 3,1 mm; otvor vršku Ø 90 mm.
- Samostatné stěny: dokument 68 × 130 mm; obrys posunutý o (2, 2) mm.
- Osm dílů lucerny plus zkušební proužek. Žádná kompenzace řezu není aplikována.

## Postup na laseru
1. Importuj SVG nebo DXF v mm, při 100 %. Nepřizpůsobuj obálku dílů rozměru A3.
2. Červená vrstva CUT obsahuje pouze uzavřené řezné kontury, žádné gravírování či popisky.
3. Vyřízni zkušební proužek; jeho drážky mají šířky 2,8 / 2,9 / 3,0 / 3,1 / 3,2 mm.
4. Otestuj nejprve jednu detailní stěnu — betlém nebo svíčku. Nastavení výkonu, rychlosti a kompenzaci řezu urči podle skutečného materiálu a stroje.
5. Řež vnitřní otvory před vnějšími obrysy. Sestav nejprve nasucho, ověř lícování a pevnost, potom případně slep.

## Co je ověřeno a co zbývá
Digitálně prošla platnost a uzavřenost polygonů, shoda SVG/DXF, rozmístění na A3, totožnost vnějších obrysů všech stěn, všech 24 párů jazýček–drážka a souvislost každé stěny při odebrání 0,15 mm z každé řezné hrany (model řezu 0,3 mm). Nejde o mechanickou zkoušku a kontrola souvislosti sama nepotvrzuje pevnost tenkých detailů. Fyzický výpal, lícování a pevnost zatím ověřeny nejsou.

Kontrola z kořene rozbaleného balíčku: `python overeni.py .`
Reprodukce výstupů: nainstaluj závislosti z requirements.txt a spusť `python generovat.py`. Skript používá pouze přiložené zdroje a přepíše exporty i náhledy v této složce.
