# Kontrola balíčku — 11. 11. 2026

Základ kódu: cf090fa266394052d71be66d6b31f6bbb42925aa, repozitář Yose144/Zion-v3.0.0.

- 107 WebP: soubory otevřené a dekódované; rozměry a unikátní cílové cesty ověřené. Celkem 26,25 MiB obrazových exportů. Dvě původní značkové vrstvy jsou navíc.
- 43 změněných zdrojových souborů v source/apps/. code.patch se ověřeně aplikuje na čistý index uvedeného základního commitu; git diff --check prošel.
- Wallet SDK build: prošel.
- Market: npm run build:market prošel včetně postbuild kroku.
- App: next build --webpack prošel. V tomto zúženém checkoutu nebyl spuštěn generátor celého dokumentového korpusu z prebuild; úplný npm run build:web zůstává krokem integrace v plném repozitáři.
- Samostatné `tsc --noEmit` Appky: NEPROŠLO — dvě TS2344 v automaticky generovaném `.next/types/validator.ts:30` (LayoutProps/Route → never). Build má v existující konfiguraci ignoreBuildErrors; úspěšný build tedy nenahrazuje typovou kontrolu. Před produkčním nasazením vyřešit v úplném checkoutu. Generované typy se v tomto balíčku ručně neobcházejí.
- HTTP smoke: 52 kontrol Marketu + 65 kontrol Appky; všech 117 vrátilo HTTP 200. Zahrnuje všech 107 verzovaných obrazových URL a 10 stránek.
- Vizuálně zkontrolované přehledové listy ilustrací. Interaktivní prohlížeč a mobilní screenshoty celého UI nebyly ověřené; provést na stagingu podle QUICK_UPGRADE.md.
- Kanonická tvář Maitreyi a přesná geometrie produktového lampionu vyžadují porovnání s originály. Generované produktové obrazy jsou ilustrace, výrobní dokumentace a 3D model se nemění.
- Produkční nasazení: NEPROVEDENO. Změny databází, objednávek a plateb: NEPROVEDENY.

Koncepční scény projektů TerraNova zobrazují literární vize; technický stav projektu se tím nemění. Kompletnost zde znamená popsanou obrazovou migraci Marketu a Appky podle MAPOVANI.csv, nikoli nový backend nebo migraci všech samostatných služeb ZION.
