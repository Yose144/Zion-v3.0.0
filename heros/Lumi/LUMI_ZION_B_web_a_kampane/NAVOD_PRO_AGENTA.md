# Nasazení vizuálů Lumi

Cíl je vizuální aktualizace veřejného e-shopu `lumi.zionterranova.com` podle ZION Design Engine v1.0 ve schválené variantě B. Výchozím předobrazem fyzického výrobku je aktuální šestihranný Lumi 2. Prostředí používají matnou štětcovou texturu, tenkou organickou linku a soustředěné jantarové světlo.

## 1. Najdi zdrojový projekt

- Ověř kořen aplikace podle domény, směrování a produktového katalogu. U Next.js může být aplikace uvnitř monorepa. Cesty `public/` v balíku jsou relativní vůči kořeni konkrétní aplikace Lumi.
- Najdi katalog a komponenty příkazem `rg -n '03-vecerni-svetlo|02-konstrukce|produkt-lumi-2|misto-navic|svetla-u-brany|og-lumi|rozlozeni-a3|sest-sten' .`.
- Porovnej výsledek s `AUDIT_WEBU.json`. Implementační názvy jsou na agentovi, rozhodující je trasa a konkrétní sekce nebo SKU z manifestu.

## 2. Zapoj soubory podle role

- Zkopíruj `public/images/lumi-b/` do veřejných assetů Lumi. V kódu používej veřejné cesty `/images/lumi-b/…`.
- Původní sdílené cesty nahrazuj **podle komponenty a významu**. Jeden původní večerní obrázek se dnes používá pro domov, svatby, produkty, galerii i fallback. Plošná náhrada řetězce by tyto pozice znovu sjednotila.
- Produktovou kartu, související karty, hlavní náhled produktu a případný obrázek v košíku odvozuj ze stejného záznamu pro daný slug. U produktových detailů nastav pořadí galerie z manifestu. Související karty mají načítat obrázek vlastního produktu.
- Technické PNG A3 a šesti stěn v balíku odpovídají veřejnému webu. Pokud je má repozitář identické, ponech stávající soubory. Pokud jsou v repozitáři novější, přednost má novější ověřený technický podklad. V průvodci a galerii použij `contain`, aby zůstal vidět celý nákres. Název odkazu na PDF i cestu k interaktivnímu GLB ponech.
- Do obou fallbacků 3D prohlížeče vlož `3d-poster.webp`. Při kontrole klikni na aktivaci modelu a ověř jeho vlastní načtení. Pro produktový render a konstrukční detail preferuj vlastní neutrální poměr 1:1.
- U Mini uveď viditelný popisek „Ilustrační zobrazení Lumi Mini“. Přesná fotografie nebo ověřený výrobní render má při pozdější aktualizaci přednost. U personalizace uveď „Ukázka motivu na dřevěném vzorku“ a u dárkového balení zkontroluj, že obrázek nezaměňuje doplněk za sadu s lampionem. U sady tří odliš v galerii scénu se sadou a detail jednoho kusu.
- Široké hero používej v panoramatickém slotu. Do stávajícího slotu 4:3 patří připravená varianta `-4x3.webp`. Pokud má komponenta vlastní `srcset`, sladíš ho se zvoleným výřezem. Titulek, cena a CTA zůstávají živý obsah mimo webovou ilustraci. Významový alt popisuje skutečnou scénu a používá existující lokalizace. Čistě dekorativní obrázky mají prázdný alt.
- Pro společné Open Graph a Twitter použij `og-lumi.jpg` a nastav **1200 × 630 px**. Produktové OG odvoď z vybraného obrázku SKU a jeho skutečných rozměrů. Favicon a ikony webu používají stávající značku.

## 3. Použij kampaně

`kampane/` obsahuje české bannery 1080 × 1080. Svatební kampaň odkazuje na aktivní `/svatby`. Vánoční a květinářský hero je připravený k použití v kampani nebo na budoucí landing page. Cesty `/vanoce` a `/kvetinarstvi` při auditu vracely 404. Pro externí kampaň použij aktivní produktový detail nebo jinou ověřenou cílovou stránku. Vánoční banner je bez pevné ceny, protože veřejná nabídka samostatného e-shopu se lišila od ZION Marketu.

## 4. Ověř nasazení v repozitáři

1. Použij stávající příkazy projektu pro lint, testy a build podle jeho package manageru.
2. Projdi homepage, kolekci, všech šest produktů, svatby, firmy, příběh, průvodce a košík s vloženým produktem. Zkontroluj přímé URL obrázků, aby vracely správný formát a úspěšný stav.
3. Ověř obraz a text na mobilu kolem 390 px a na desktopu kolem 1440 px. Kontroluj, že ořez neschová horní otvor ani podstavu lampionu a že se vykreslí celý technický nákres.
4. Ověř produktová a sdílená metadata, změnu jazyků, 3D fallback i načtení modelu. Při kontrole objednávky stačí zkušební košík bez platby.
5. Změny drž u vizuálů, metadat a jejich použití. Projektový checkout, ceník a obchodní texty nepřepisuj. Výstupem je změna v repozitáři a stručný seznam ověřených tras.
