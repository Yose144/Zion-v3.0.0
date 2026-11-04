# ZION APP · Christmas Edition 2026 / PF 2027

Balíček obrázků pro hlavní stránku https://app.zionterranova.com.
Připraveno podle veřejné stránky a jejího devítisnímkového slideru dne 4. 11. 2026.
Na živém webu nebyly provedeny změny. Toto je sada k nasazení, ne upravený zdrojový projekt.

## Co je uvnitř

- 9 vánočních úprav původních motivů slideru, každá ve velké a mobilní variantě.
- 2 vánoční úpravy stávajících obrázků novinek: Mainnet Beta a mapa L5.
- Stávající vánoční obraz novinky a 3 produktové karty, znovu komprimované bez změny motivu.
- Celkem 27 WebP souborů, bez velkých PNG originálů.
- `NAHLED.html`: místní vizuální přehled. Po rozbalení ho otevřete v prohlížeči.
- `MAPOVANI.csv` a `manifest.json`: přesné cesty, rozměry, velikosti a kontrolní součty.

## Nejjednodušší nasazení

1. Rozbalte ZIP do nové složky a nejprve otevřete `NAHLED.html`.
2. V reálném zdrojovém projektu appky najděte jeho složku `public`. U monorepa to může být podsložka konkrétní aplikace; tento balíček cestu k vašemu repozitáři nepředpokládá.
3. Zálohujte současné soubory uvedené v `MAPOVANI.csv` nebo vytvořte pracovní git commit.
4. Obsah zdejší složky `public` slučte s existující složkou `public` v projektu appky. Nahraďte pouze soubory ze seznamu. Nenahrazujte ani nemažte celou původní složku `public`.
5. Není nutné měnit seznam slajdů ani JSX: názvy cest a obě varianty obrázků odpovídají současné appce. Zachovejte nynější pořadí, odkazy a české/anglické popisky v komponentě.
6. Spusťte běžný build a preview svého projektu podle jeho `package.json` a existujícího postupu. Přesný deploy příkaz ani cestu zdrojové komponenty nelze určit pouze z veřejné stránky.
7. Zkontrolujte preview podle seznamu níže. Pak nasaďte svým obvyklým postupem.
8. Pokud prohlížeč nebo CDN stále ukazuje staré obrázky, vymažte cache těchto souborů, případně použijte verzování URL v komponentě. Parametr verze musí být shodný u `src` i obou položek `srcSet`.

## Přesné pořadí slideru

| Slajd | Motiv | Velký soubor | Menší soubor | Zachovat odkaz |
|---|---|---|---|---|
| 1 | Vánoce · Kingdom | `public/images/home/christmas-kingdom.webp` | `public/images/home/christmas-kingdom-m.webp` | `/news/christmas-2026` |
| 2 | Maitreya · Strom života | `public/images/home/hero.webp` | `public/images/home/hero-m.webp` | `/zion-archive#cesta` |
| 3 | OASIS · jedna rodina | `public/images/zion-archive/hero.webp` | `public/images/zion-archive/hero-m.webp` | `/l4-oasis` |
| 4 | L5 Free World · mapa | `public/images/l5-free-world/hero.webp` | `public/images/l5-free-world/hero-m.webp` | `/l5-free-world` |
| 5 | María del Camino · Tres Marías | `public/images/maria-del-camino/hero.webp` | `public/images/maria-del-camino/hero-m.webp` | `/terranova/maria-del-camino` |
| 6 | Království srdce · archa | `public/images/kralovstvi-srdce/hero.webp` | `public/images/kralovstvi-srdce/hero-m.webp` | `/terranova/kralovstvi-srdce` |
| 7 | Ekam · Oneness Temple | `public/images/ekam/hero.webp` | `public/images/ekam/hero-m.webp` | `/terranova/ekam` |
| 8 | Genesis Garden | `public/images/genesis-garden/hero.webp` | `public/images/genesis-garden/hero-m.webp` | `/terranova/genesis` |
| 9 | Amenti · Gíza | `public/images/amenti/hero.webp` | `public/images/amenti/hero-m.webp` | `/terranova/amenti` |

## Obrázky mimo slider

| Umístění na hlavní stránce | Soubory v balíčku | Postup |
|---|---|---|
| Produktové karty nad sliderem | `public/images/news/christmas-2026/card-pass.webp`, `card-book.webp`, `card-lampion.webp` | Přepsat stejnojmenné soubory; nynější motivy jsou již vánoční a zůstávají zachované. |
| Karta ZION Archive pod sliderem | `public/images/zion-archive/hero.webp`, `hero-m.webp` | Používá stejný pár jako slajd 3. Nepřidávat další duplicitní obrázek. |
| Vánoční novinka | `public/images/news/christmas-2026/hero-1600.webp`, `hero-960.webp` | Původní vánoční motiv novinky zůstává. Neměnit ho na jinou scénu ze slideru. |
| Novinka Mainnet Beta | `public/images/news/beta-cosmic-utopia.webp`, `beta-cosmic-utopia-m.webp` | Vánoční varianta původního motivu ekosystému. |
| Novinka L5 | `public/images/home/hero-l5-map.webp`, `hero-l5-map-m.webp` | Vánoční varianta původního přehledu L5 s poutníkem. Je to jiný obraz než slajd 4. |

## Sdílené cesty a možnost omezit úpravu jen na homepage

Obrázky ve složkách `zion-archive`, `l5-free-world`, `maria-del-camino`, `kralovstvi-srdce`, `ekam`, `genesis-garden` a `amenti` mohou používat i detailní stránky. Přepsání stejné cesty změní obrázek všude, kde se používá. Vyhledejte přesnou cestu v projektu a ověřte použití.

Chcete-li sezónní edici pouze ve slideru, uložte jeho 18 souborů do nové složky, například `public/images/christmas-2026/slider/`, a pouze v devíti položkách seznamu slideru upravte dvojici `src` / `srcM`. Každému motivu dejte jedinečné jméno (např. `01-kingdom.webp`, `01-kingdom-m.webp`). Kartu Archivu pak přepněte zvlášť, pokud má být vánoční i ona. Tato izolovaná varianta vyžaduje změnu komponenty; bez zdrojového projektu zde není provedena.

## Rozměry, ořez a čitelnost

- Slider: 1672 × 941 px; menší varianta 960 × 540 px. Menší soubory zachovávají celý motiv a nejsou alternativním portrétním ořezem.
- Produktové karty: 960 × 540 px, současné obrázky jsou již ve vánočním stylu kolekce.
- Novinka Vánoce: 1600 × 900 px a 960 × 540 px.
- Ostatní novinky: 1672 × 941 px a 960 × 540 px.
- WebP: kvalita 78, komprese method 6; rozměry konkrétních souborů jsou v manifestu.
- Slider ponechte v poměru 16:9. Nevkládejte přes jeho obraz další velké titulky: některé texty jsou již součástí ilustrací.
- Karta Archivu dosud používá jiný poměr. Pro zobrazení celé široké rodiny OASIS nastavte obrazový box na 16:9, nebo použijte `object-fit: contain` s tmavým pozadím. `object-fit: cover` v úzkém boxu může odříznout krajní postavy.
- Drobné texty v ilustracích slouží jako součást původních motivů. Důležité názvy, stav projektu a navigace mají zůstat i jako čitelný HTML text mimo obrázek.

## Co při nasazení zachovat

- Současné 9slajdové pořadí a všechny cílové odkazy.
- Ovládání vpřed/vzad, devět indikátorů, pauzu a podporu klávesnice.
- Aktuální přepínání po 7 sekundách, zastavení při interakci a respektování reduced motion / Save-Data.
- Stav Mainnet Beta a informace o odloženém veřejném launchi. Vánoční grafika nemění stav projektu, ceny ani dostupnost lampionu.
- Interaktivní 3D okno Nirvany nahoře. Tento balíček nemění herní renderer, jeho scény ani jeho načítací poster.
- Logo v navigaci, technické widgety a textový obsah appky.

## Kontrola po nasazení

1. Desktop: projděte všech 9 slajdů a zkontrolujte správné pořadí a cíle odkazů.
2. Mobil: vyzkoušejte šířky 360, 390 a 768 px, celý obraz i popisky pod ním.
3. Zkontrolujte, že `src` i `srcSet` načítají nové soubory a nikde není 404.
4. Vyzkoušejte pauzu, šipky, klávesnici a indikátory; změna obrázků nemá měnit chování slideru.
5. Zkontrolujte kartu Archivu: žádná krajní postava se nemá nechtěně oříznout.
6. Prohlédněte produktové karty, tři novinky a sdílené detailní stránky.
7. Přepněte CS/EN a ověřte HTML popisky. Jazykové přepínání se nemění tímto balíčkem.
8. Při problému vraťte zálohované obrazové soubory nebo příslušný commit a obnovte cache.

## Pro vývojáře

Toto je sada rasterových vizuálů a návod, nikoli patch aplikace. Není potřeba instalovat žádné nové závislosti. Zdrojové názvy souborů a cesty byly ověřeny ve veřejném HTML a ve veřejně servírovaném seznamu slideru. Chcete-li změnit jen obrázky, nesaháte do funkční logiky appky. Změny aplikace nebyly nasazeny ani otestovány v jejím zdrojovém prostředí; ověřena je integrita tohoto ZIPu a všech WebP souborů.
