const claimLabels = {
  live: "ŽIVÉ", building: "STAVBA", horizon: "HORIZONT", hypothesis: "HYPOTÉZA", myth: "MÝTUS",
};
const sourceStates = { source: "Podklad", canon: "Kánon", draft: "Koncept", conflict: "Rozpor v označení", idea: "Nápad", ready: "Připraveno", archived: "Odloženo" };
const workflowInfo = {
  lumi: {
    label: "Výroba Lumi 2", fields: [["variant", "Motiv a formát"], ["material", "Materiál a rozměry"], ["cut", "SVG/DXF a revize"], ["destination", "Cílová produktová karta"]],
    criterion: "U fotky hotového výrobku a souboru pro řez jde doložit stejnou revizi a výsledek zkušebního sestavení.",
    steps: ["Spárovat motiv s konkrétní revizí souboru pro řez.", "Zaznamenat fyzickou zkoušku a vyfotit sestavený motiv.", "Propojit ověřenou variantu s produktovou kartou."],
    scene: "Oceánský motiv v detailu na pracovním stole. Boční světlo ukazuje prořez a obrys lucerny.",
  },
  hero: {
    label: "Hero / ilustrace", fields: [["character", "Postava a hlavní rekvizita"], ["master", "Master nebo desktopový export"], ["mobile", "Mobilní výřez"], ["destination", "Cílová stránka"]],
    criterion: "Na desktopu i telefonu jsou čitelné hlavní motiv, rekvizita a titulek s CTA. Plán obsahuje obě verze a náhled.",
    steps: ["Vybrat kapitolu, jediný dějový okamžik a hlavní světlo.", "Připravit master a mobilní výřez podle Engine B.", "Ověřit čitelnost a kompozici na cílové stránce."],
    scene: "Lumi postaví lucernu mezi tři cesty. Jantarový paprsek ukáže první kamenný stupeň.",
  },
  avatar: {
    label: "Avatar", fields: [["key", "Klíč v rosteru"], ["reference", "Schválená reference"], ["prop", "Silueta a rekvizita"], ["placement", "Portrét, karta nebo herní model"]],
    criterion: "Identita, silueta a rekvizita odpovídají rosteru. Výstup je čitelný v cílovém měřítku.",
    steps: ["Dohledat záznam postavy v rosteru a referenční portrét.", "Připravit siluetu, oděv a jednu podpisovou rekvizitu.", "Porovnat návrh s rosterem v cílové kartě nebo kameře."],
    scene: "Postava stojí v jasné siluetě na okraji lesa. V záběru vede její podpisová rekvizita.",
  },
  scene: {
    label: "Herní scéna", fields: [["world", "Svět a route"], ["sourceScene", "Komponenta scény"], ["playerGoal", "Cíl hráče"], ["test", "Test a zařízení"]],
    criterion: "Hráč rozumí první volbě a dokončí ji v cílovém klientu. Storyboard i ověření mají odkaz.",
    steps: ["Najít existující scénu a napsat jednu volbu hráče.", "Navrhnout tři záběry pro příchod, setkání a volbu.", "Ověřit průchod na cílovém zařízení a uložit výsledek."],
    scene: "Rádha ukáže poutníkovi rozcestí. Světlo Lumiiny lucerny dovolí přečíst stopu na kameni.",
  },
  book: {
    label: "Kniha / kapitola", fields: [["chapter", "Kapitola"], ["character", "Postavy a jejich role"], ["language", "Jazyk vydání"], ["continuity", "Navazující scéna nebo vydání"]],
    criterion: "Text má odkaz na zdrojovou kapitolu, zachovává role postav a vyjasňuje stav případných technických tvrzení.",
    steps: ["Vybrat kapitolu a zapsat role postav v dané scéně.", "Napsat nebo ilustrovat jeden dějový okamžik.", "Porovnat výstup se zdrojem a označit status tvrzení."],
    scene: "Tesař zkouší první příčku lávky. Lumi svítí na okraj prkna a na přídi se objeví stopa po dešti.",
  },
  evidence: {
    label: "Technický podklad", fields: [["component", "Vrstva nebo služba"], ["build", "Revize nebo build"], ["scope", "Rozsah ověření"]],
    criterion: "Každé tvrzení má vlastní štítek. Pro ŽIVÉ je doložený rozsah i datum ověření.",
    steps: ["Zapsat jedno přesné tvrzení a jeho rozsah.", "Dohledat důkaz pro konkrétní prostředí a revizi.", "Zapsat datum, důkaz a správný štítek tvrzení."],
    scene: "Dvoupanelový výjev ukazuje softwarový panel s ověřitelnými daty a samostatný obraz dlouhodobé vize.",
  },
};
const sourceRevision = "f9b015fbeef47927f895fd55e566885c638eae75";
const publicRepo = "https://github.com/Yose144/Zion-v3.0.0/blob/" + sourceRevision + "/";
const catalogRows = [
  ["lumi-ocean", "Oceánský motiv Lumi 2", "Lumi", "lumi", "source", "Lumi / Elizabeth", "Dílna Lumi", "Výřez pro jednu ověřenou variantu a fotku do produktové karty.", "Laser/Lumi2/Oceanske.svg", {variant:"Oceánský motiv",cut:"Laser/Lumi2/Oceanske.svg",destination:"Produktová karta Lumi 2"}],
  ["lumi-cuts", "Kontrola řezů Lumi 2", "Lumi", "lumi", "source", "", "Dílna Lumi", "Záznam kontroly geometrie sedmi motivů. Fyzickou zkoušku zapiš k použitému materiálu.", "Laser/Lumi2/Lumi_MOTIVY_OBNOVENE_v4/KONTROLA.json", {variant:"Zvol motiv ze sedmi kontrolovaných variant"}],
  ["lumi-catalog", "Katalog motivů Lumi 2", "Lumi", "lumi", "source", "", "Dílna Lumi", "Katalog samostatného e-shopu pro dohledání varianty a cílové karty.", "apps/lumi/src/data/catalog.ts", {}],
  ["engine-hero", "Engine B · Hero Brány", "Brána", "hero", "source", "Lumi / Elizabeth", "Brána", "Jeden čitelný motiv, jantarové světlo a dva výřezy pro web.", "heros/engine/ZION_Design_Engine_v1.0_KOMPLET/ZION_DESIGN_ENGINE_v1.0.md", {character:"Lumi / Elizabeth a lucerna",destination:"První obrazovka Brány"}],
  ["engine-market", "Engine B · Tesařova dílna", "Market", "hero", "source", "Tesař z Nazareta, Lumi / Elizabeth", "Market", "Referenční výjev pro hero nebo sezónní kampaň Marketu.", "heros/engine/ZION_Design_Engine_v1.0_KOMPLET/02_PREDCHOZI_HERO/marketplace-tesarova-dilna.png", {character:"Tesař z Nazareta a Lumi s lucernou",destination:"Hero Marketu"}],
  ["avatar-roster", "Roster avatarů OASIS", "Oasis", "avatar", "source", "", "Oasis", "Klíč identity pro portrét, kartu a herní model.", "heros/oasis/OASIS_Avatar_Collection_v1/avatar_roster.csv", {}],
  ["oasis-gate", "Brána prvního hráče", "Oasis", "scene", "canon", "Rádha, Lumi / Elizabeth", "Oasis", "Literární podklad pro první volbu hráče u brány.", "canon/books/SulZeme/11-Brana-Prvniho-Hrace-a-Volba-Cesty.md", {world:"Oasis",playerGoal:"Zvolit první cestu"}],
  ["genesis-scene", "Zahrada Genesis", "Oasis", "scene", "source", "", "Bodhi Gaia", "Sdílená komponenta scény pro herní průchod nebo náhled.", "apps/shared/scenes/GenesisGarden.tsx", {world:"Bodhi Gaia / Zahrada Genesis",sourceScene:"GenesisGarden.tsx"}],
  ["ark-scene", "Království srdce · herní scéna", "Království srdce", "scene", "source", "Tesař z Nazareta", "Království srdce", "Sdílená 3D scéna archy pro storyboard a kontrolu kamery.", "apps/shared/scenes/KralovstviSrdce.tsx", {world:"Království srdce /present/kralovstvi-srdce",sourceScene:"KralovstviSrdce.tsx"}],
  ["one-love", "One Love · Whitepaper 3.2", "ZION TerraNova", "book", "canon", "", "ZION", "Kanonický zdroj pro Strom života, Zlaté vejce a kompas ekosystému.", "canon/books/ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_CZ.md", {language:"Čeština"}],
  ["sul-zeme", "Sůl této země · dvanáct zastavení", "ZION TerraNova", "book", "canon", "Noe, Rádha, Tesař z Nazareta", "Oasis", "Kanonický rozcestník kapitol a postav.", "canon/books/SulZeme/00-README.md", {language:"Čeština"}],
  ["lampion-book", "Lampion · Druhá lucerna", "Lumi", "book", "draft", "Lumi / Elizabeth, Tesař z Nazareta", "Dílna Lumi", "Literární koncept pro fyzický produkt Lumi 2.", "canon/books/Lampion/00-README.md", {language:"Čeština"}],
  ["maitreya", "Maitreya · kanonické kotvy", "ZION TerraNova", "book", "source", "Maitreya", "ZION", "Opěrné body pro oddělení vyprávění a faktových poznámek.", "canon/books/Maitreya/00-CANON-ANCHORS.md", {character:"Mladý Maitreya"}],
  ["nirvana-books", "Nirvana · Příběhy Nové Země", "ZION TerraNova", "book", "conflict", "", "Nirvana", "Obecný index ji řadí mezi koncepty. Vlastní index ji označuje za kanonickou vizionářskou řadu.", "canon/books/nirvana/00-README.md", {}],
  ["amenti", "Mise Amenti · Registr důkazů", "ZION TerraNova", "evidence", "canon", "", "ZION", "Pracovní rámec pro stav konkrétního tvrzení a jeho zdroj.", "canon/books/MiseAmenti/07-Registr-Dukazu.md", {}],
  ["issobella", "Issobella · software a orbitální vize", "ZION TerraNova", "evidence", "source", "", "Issobella", "Zaznamenej důkaz trackeru a horizont orbitální stanice jako samostatná tvrzení.", "V31/L6/issobella/README.md", {component:"L6 / Issobella"}],
];
const fixedSources = catalogRows.map(([id,title,project,kind,state,people,world,note,path,outline]) =>
  ({id,title,project,kind,state,people,world,note,url:publicRepo + path,outline}));
