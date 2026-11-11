# Pokyny pro další úpravy
Pracuj s vektory v této složce. PNG Puvodni_vytvarny_navrh je výtvarný zdroj, aktuální výpalový tvar je v SVG/DXF a v nových náhledech.

Každý úplný A3 soubor obsahuje jednu vrstvu CUT a devět cest v pořadí šest stěn, vršek, dno, proužek. Jednotky jsou mm, SVG Y dolů, DXF Y nahoru. V SVG jsou všechny cesty M/L/Z. Každá cesta zahrnuje vnější obrys a vnitřní otvory. Křivky jsou aproximovány uzavřenými polyliniemi. Tolerance zjednodušení motivu při tvorbě byla 0,035 mm.

Samostatná stěna má dokument 68 × 130 mm a obrys posunutý o (2,2) mm. Pro nahrazení stěny v A3 nejprve tento posun odečti, pak přičti (10 + 69 × sloupec, 14 + 136 × řádek). Sloupce i řádky se číslují od nuly. Použij šest stěn, ostatní díly ponech z cílového A3. Nepřekrývej dvě kontury na stejném místě.

Po úpravě zachovej nosný rám minimálně 4 mm, propojení všech dřevěných ostrůvků, rozměry jazýčků a jejich polohu. Nepřidávej do vrstvy CUT popisky ani rozměrové čáry. Exportuj SVG i DXF a aktualizuj náhledy. Ověř geometrii po zaokrouhlení exportu.

Kontrolu spusť z kořene rozbaleného archivu:
python overeni.py 01_Priroda
Stejně proveď další čtyři složky. Závislosti skriptu jsou Python, shapely a ezdxf.
Výsledek digitálního testu vždy odděluj od zkoušky fyzického kusu.
