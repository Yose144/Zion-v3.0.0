# Navazující práce — web Lumi, engine B a 3D

Tento ZIP obsahuje opravenou vánoční kolekci. Rozšíření webu ani nový 3D model zatím nejsou realizované.

## Závazná geometrie a motivy
- Používej SVG/DXF z této opravené sady, nikdy staré geometrické vánoční návrhy.
- Šest motivů má stabilní pořadí a názvy uvedené v Motivy.json.
- Předlohové PNG je výtvarná reference. Přesné otvory pro produkt, konfigurátor a 3D odvozuj z aktuálních SVG.
- Ke svatební, přírodní, květinové, oceánské a vesmírné sadě použij původní podklady uživatele. Nevymýšlej náhrady existujících motivů.

## Engine B — následující obrazová sada
Malované prostředí, jemná selektivní komiksová linka, přirozené materiály, čitelná silueta, jeden jantarový světelný akcent. Lesní zeleň, inkoustová modř, pergamen a březové dřevo. Žádný lesklý generický 3D anime vzhled. Text, ceny, CTA a překlady nepatří do obrázku.

Atmosféru lze malovat, tvar výrobku a ornamenty zachovat. Ilustrační vizualizace nesmí být vydávány za skutečné fotografie výrobku.

Připravit obrazové plochy pro homepage, kolekce a detail Lumi 2, svatby, firmy, příběh, průvodce sestavením, personalizaci, dárkové balení a galerii. K původním pěti kolekcím přidat vánoční. Zachovat současné samostatné produkty Mini a Kit; jejich rozměry neodvozovat prostým zmenšením Lumi 2.

## 3D — zadání pro další krok
1. Importovat uzavřené kontury SVG se skutečnými otvory; nepřevádět ornament na pouhou obrázkovou texturu.
2. Extrudovat březovou překližku na 3 mm, respektovat souřadnice SVG Y dolů a převod os do 3D.
3. Sestavit šest stěn podle původní geometrie Lumi 2. Půdorys těla vychází z šestiúhelníku o poloměru 65 mm; apotéma osy stěny je 65√3/2 mm. Vnější vrcholy desek mají průměr 140 mm.
4. Ověřit skutečné usazení jazýčků do vršku a dna podle výřezů, nikoli odhadem z ilustrace. Převzít existující ověřený způsob sestavení, je-li dostupný model.
5. Každou stěnu, dno a vršek ponechat jako samostatně pojmenovaný objekt. Zachovat ID motivů pro konfigurátor.
6. Připravit GLB v metrech, rozumné UV, jemnou dřevěnou texturu, tmavší řeznou hranu a rozložený pohled sestavení. Zkontrolovat počet polygonů, normály, díry a průniky.
7. Světlo uvnitř vizualizovat jako LED; žádné neověřené tvrzení o bezpečnosti otevřeného plamene. Provozní pokyny ověřuje výrobce.
8. Produktový poster renderovat ze stejného 3D modelu. U průvodce používat přesné renderované kroky, nikoli vymyšlené AI spoje.

## Předání webové sady
Ke každému assetu zapsat cílovou stránku a plochu, cestu, rozměry, poměr stran, alt v CZ/EN/DE a motivy. Uchovat master, WebP a mobilní variantu. Hero načíst prioritně, ostatní líně; explicitní width/height. 3D načítat až po aktivaci uživatelem, s posterem a přístupným ovládáním.

Před nasazením: zkontrolovat aktuální web, skutečné názvy souborů a komponent, responzivní ořezy, shodu ornamentů s vektory a přepínání všech šesti kolekcí. Tento dokument je zadání, nikoli důkaz provedeného nasazení.
