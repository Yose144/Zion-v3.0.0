# Lumi 2 — obnovené motivy v4

Tato sada nahrazuje esteticky nepovedenou v3. Vychází z původních schválených výřezů, nikoli ze silně zesílených stěn v3. Obsahuje všech 7 kolekcí a 42 stěn včetně Vánoc.

## Co se změnilo
Původní průchozí detaily jsou obnovené. Opravy jsou místní: nadbytečná velmi tenká spojka mezi sousedními otvory je odstraněna jen tehdy, když díl po modelovém řezu zůstává vcelku. Potřebná napojení jsou místně rozšířena nebo doplněna. Neproběhlo plošné zmenšení všech otvorů a jemné motivy nejsou nahrazené gravírem na plné desce.

U jednotlivých stěn se celková plocha otvorů proti zdroji změnila o méně než 1,5 %. Samotné toto číslo není zárukou vzhledu; skutečné obrysy ukazují přiložené náhledy. Porovnani_kvetiny.png porovnává chybnou v3 s touto sadou.

Zpevněný vršek a mechanická konstrukce zůstávají z ověřené v3. Vánoční stěny vycházejí z dodaného původního rozkladu PNG a mají stejné konstrukční rozhraní jako ostatní sady.

## Použití
- V každé kolekci otevři **A3_REZ_1ku1.svg** NEBO **A3_REZ_1ku1.dxf**. Ne oba zároveň.
- Importuj v mm a při 100 %. Rozklad má 420 × 297 mm, dno přes vrcholy 140 mm.
- Každá A3 obsahuje šest stěn, vršek, dno a zkušební proužek. Sedm lampionů = sedm A3 desek.
- Jednotlive_dily obsahuje samostatné díly v SVG/DXF; nepřidávej je na již kompletní A3.
- Modrý A3_GRAVIR_VOLITELNY ve složce původního Lumi 2 zachovává původní drobné doplňky. Je to mělký linkový gravír, ne průchozí řez. Ostatní sady jsou kompletní průchozí motivy bez povinného gravíru.
- Při společném importu gravíru a řezu zachovej společný počátek A3. Gravíruj první, vnitřní řezy potom, obvod dílu poslední.

## Rozměry a sestavení
Nominální překližka 3 mm. Tělo stěny 63,267949 × 120 mm; s jazýčky výška 126 mm. Jazýčky 8 × 3 mm, drážky 8,1 × 3,1 mm. Dno a vršek přes vrcholy 140 mm, otvor vršku Ø90 mm. Konstrukce počítá s lepením.

Skutečnou tloušťku materiálu změř. Nejdřív použij testovací proužek s drážkami 2,8 / 2,9 / 3,0 / 3,1 / 3,2 mm. Kerf není kompenzován; nastav jej podle svého stroje a zkoušky. Neměň kvůli spojům měřítko celé lucerny.

## Kontrola a hranice ověření
Ověřeny skutečně exportované SVG/DXF: uzavřené a jedinečné kontury, validní souvislé dřevo, rozhraní spojů, rozklad bez kolizí, shoda samostatných dílů a chování při modelových nekompenzovaných šířkách řezu 0,2 / 0,3 / 0,4 mm. Každý díl zůstává jedním kusem. Podrobnosti jsou v KONTROLA.json a Overeni.json.

V4 záměrně NEPOUŽÍVÁ plošné minimum 2 mm z v3. Výchozí cíl u sousedních otvorů je přibližně 1,2 mm; místní napojení mohou být jemnější. Skutečné naměřené hodnoty jsou v protokolu. Zúžení uvnitř jedné kontury a pevnost dřeva nelze shrnout jedním číslem.

**Před celou sérií je nutný jeden zkušební výpal stěny a vršku na skutečném stroji. Digitální souvislost není fyzická pevnostní ani tepelná zkouška.** Pokud tvůj změřený kerf přesahuje 0,4 mm, tato kontrola pro něj neplatí. Výkon a rychlost nejsou bez znalosti stroje předepsané.

Starší marketingové rendery nejsou přesné výrobní podklady; rozhodují tyto vektory a jejich náhledy.
