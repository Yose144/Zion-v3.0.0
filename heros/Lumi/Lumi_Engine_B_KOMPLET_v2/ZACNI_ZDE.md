# Lumi · Engine B · Sjednocená sada v2

Tato sada nahrazuje předchozí nesourodé webové návrhy. Šest kolekcí: přírodní, svatební, květinová, oceánská, vesmírná a vánoční. Všechny používají stejnou produktovou scénu a srovnatelnou velikost lucerny. Oba weby používají stejné zdrojové ilustrace, pouze jiné formáty.

Otevřete PREHLED.html: nahoře světlý přehled pro Lumi, dole příběhový banner a karty pro market. Jde o prezentační náhled, ne kopii celého webu. PREHLED.jpg porovnává všech šest kolekcí vedle sebe.

## Lumi
Současný úvod používá formát 4:3 v rozměrech 960×720 a 640×480. Složka lumi obsahuje tyto varianty pro všech šest kolekcí a čtvercové produktové obrázky 900×900. Sekci šesti kolekcí doporučujeme zařadit za stávající nabídku velikostí; kolekce nejsou nové velikosti produktu. Obecný úvod webu může zůstat.

## Market
Složka market obsahuje šest produktových karet 900×900, šest bannerů ve dvou velikostech 1440×810 a 960×540 a společný příběhový banner 1600×900 a 960×540. Příběhový banner slouží jako společný úvod kolekcí, karty tvoří jednotnou řadu. Všechny kolekce včetně Vánoc mají v kartách stejné pozadí; dřívější zimní banner ponechte pouze pro samostatnou sezónní kampaň.

## Nasazení
Nahrajte obrázky z lumi do /images/lumi-b/kolekce-v2/ na lumi.zionterranova.com. Obrázky z market do /images/design-v1/kolekce-v2/ na market.zionterranova.com. Jde o navržené nové cesty, ne existující nasazení. Současné soubory nepřepisujte. Přesné názvy, kolekce a alt texty jsou v manifest.json. Zachovejte pořadí kolekcí stejné na obou webech.

Používejte připravené poměry stran a height:auto. Příběhový banner na mobilu zobrazte celý 16:9, aby nezmizely postavy. Názvy a tlačítka patří do HTML. Nevkládejte text na detail výřezů. Nevymýšlejte ceny, dostupnost ani neexistující produktové odkazy; propojte s reálným katalogem.

## Pokyny pro AI a další práci
Zachovat Engine B, identitu postav a jednotnou scénu produktu. Při další variantě měnit motiv panelů, nikoli současně prostředí, úhel, měřítko nebo osvětlení. Nerozlišovat Vánoce jiným typem karty. Novou sezónní atmosféru používat v samostatném kampaňovém banneru. Nepřepisovat výrobní SVG/DXF podle ilustrací.

## Podklady a ověření
Vychází z živých úvodních ilustrací Lumi a marketu zkontrolovaných v tomto rozhovoru a z nových návrhů výřezů. Výtvarné varianty vytvořeny vestavěným imagegen; zadání jsou v PROMPTY.json. Zkontrolované exporty a odkazy v přehledu. Jde o marketingové ilustrace s možnými odchylkami od výrobní geometrie, nikoli přesný 3D render. Živé weby nebyly změněny.
