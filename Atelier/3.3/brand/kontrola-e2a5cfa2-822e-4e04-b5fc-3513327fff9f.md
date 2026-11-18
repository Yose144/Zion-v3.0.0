# Favikon Zion 3.3 · kontrola výstupu

Job ID: `e2a5cfa2-822e-4e04-b5fc-3513327fff9f`  
Stav: pracovní kontrola ke schválení, 18. 11. 2026. Všechny tři kroky plánu jsou označené jako hotové. Níže je přejímka výstupu a návrh dalšího kroku pro laser z poznámky v plánu.

## Výsledek kontroly

Jako předávací balíček pro digitální použití vychází **v1.1**. Obsahuje stejnou barevnou stromovou ikonu a stejné exporty jako v1. Přidává původní široký glyf na tmavém pozadí a pokyny k němu. Porovnání ZIPů po jednotlivých souborech potvrdilo shodu společných obrazových exportů. Oba archivy prošly kontrolou ZIP CRC. SHA-256 obou podkladových PNG ve v1.1 odpovídá hodnotám v jeho manifestu.

| Použití | Ověřeno | Co zbývá |
| --- | --- | --- |
| CoinGecko | `exports/coingecko-200.png`, 200 × 200 RGBA | Posoudit vzhled ve skutečném zobrazení služby. Zveřejnění ani schválení listingem nebylo ověřeno. |
| Webový favicon | ICO má vrstvy 16, 32, 48, 64, 128 a 256 px. Samostatné 16px PNG se dekóduje. | Při vizuální kontrole 16px rastru na inkoustové i pergamenové ploše se Z ztrácí ve vícebarevné koruně. Pro 16 px připravit kontrastní mini variantu podle zadání v repu a porovnat ji při skutečné velikosti na obou pozadích. Barevný master ponechat pro větší plochy. |
| Horizontální glyf | v1.1 přidává `glyph/ZION_33_GLYPH_MASTER_ON_DARK.png` a `GLYPH_PRO_AI.md`. Podle průvodce má export 1600 × 492 px a neprůhledné pozadí. | Zachovat poměr stran, levý i pravý konec a návaznost tvarů. |
| Laser / 3D | V obou balíčcích jsou bitmapy a digitální exporty. Samostatné výrobní SVG/DXF v nich chybí. | Připravit okótované CAD podklady z autorizované L5 předlohy, digitálně zkontrolovat geometrii a až potom zkusit první kus. |

## Námět pro další krok · zkušební štítek L5

Na malé destičce umístit široký glyf doprostřed. První varianta použije gravírovanou plochu glyfu v kompaktní destičce. Druhá může použít průřezy jen tam, kde všechny části drží na nosiči. Navržený výrobní list má obsahovat očíslované díly, skutečné rozměry v mm a samostatné vrstvy ŘEZ a GRAVÍR. U 3D náhledu vycházet ze stejné vektorové geometrie. Hlavní podmínkou je potvrzení konkrétní L5 předlohy pro laser. Digitální export má v balíčku doložený původ a kontrolní součet, výrobní geometrie z něj zatím doložená není.

Přejímka laseru: vizuálně překrýt vektor s předlohou a zkontrolovat středové Z, návaznosti a diamantové konce. Ověřit měřítko SVG/DXF po importu, uzavření a jedinečnost řezných obrysů, spojitost nosné části a rozdíl mezi řezem a gravírem. První vzorek na skutečném materiálu má potvrdit čitelnost a zachování všech částí. Fyzická zkouška, 3D kontrola výrobní geometrie ani nasazení neproběhly.

Strom a Z jsou vizuální identita projektu. Štítek L5 je návrh. Doložený je obsah digitálních balíčků a jejich kontrola, žádná provozní tvrzení z motivu nevyvozujeme.

## Podklady

- [Favicon a glyf v1.1](https://chatgpt.com/library?file_id=libfile_4f4e6c884f608191a21103834899ac9f&account_id=personal) a [původní balíček v1](https://chatgpt.com/library?file_id=libfile_56eb35611e1c8191a8f97e958ae80832&account_id=personal) pro porovnání exportů.
- [Mini ikona ZION 3.3](https://github.com/Yose144/Zion-v3.0.0/blob/main/Atelier/3.3/brand/MINI-IKONA-GPT.md) pro čitelnost a nároky na tmavé i světlé pozadí.
- [Inventář loga](https://github.com/Yose144/Zion-v3.0.0/blob/main/docs/3.2/logo.md) a [kanonický balíček značky](https://github.com/Yose144/Zion-v3.0.0/blob/main/canon/brand/org/README.md) pro rozlišení originálu, listingu a faviconu.
- [One Love](https://github.com/Yose144/Zion-v3.0.0/blob/main/canon/books/ZION_ONBOARDING_3.2_ONE_LOVE_CZ.md) a [Sůl této země](https://github.com/Yose144/Zion-v3.0.0/blob/main/canon/books/SulZeme/00-README.md) pro oddělení příběhové a ověřitelné vrstvy.
