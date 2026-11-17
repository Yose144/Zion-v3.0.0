# Ateliér ZION TerraNova

Zdrojová kopie nasazeného Ateliéru včetně plánovače, archivu, katalogu podkladů, fronty tvůrčího agenta a průchozího 3D betléma. Výchozí verzí je zdroj nasazení Ateliéru v5, `c930dfcdf22fee5ecb026dffef2b073d5e5c3c43`.

- [Nasazený Ateliér](https://zion-terranova-atelier.sereneteal3.chatgpt.site/)
- [Betlém ve 3D](https://zion-terranova-atelier.sereneteal3.chatgpt.site/betlem)
- [Návrh scény, kanonické vazby a výtvarné podklady](../Betlem/README.md)
- [Výtvarné varianty Engine B pro Nirvanu 3.3](../Betlem/engine-b/README.md)

## Lokální spuštění

Použij Node.js 24. Aplikace využívá vestavěný SQLite a nemá balíčkové závislosti.

```sh
cd Atelier/web
npm run dev -- --host 127.0.0.1 --port 3000
```

Přehled je na `http://127.0.0.1:3000/`, betlém na `/betlem`. Lokální server aplikuje migrace na SQLite v paměti a používá lokálního testovacího uživatele. Data tohoto náhledu končí s procesem.

```sh
npm run build
```

Sestavení vytvoří Cloudflare Worker v `dist/server/index.js`. Pro nasazení v Sites zkopíruj `.openai/hosting.example.json` jako `.openai/hosting.json` a doplň `project_id` cílového projektu Sites. Worker očekává vazbu D1 `DB`. Adresář `drizzle/` obsahuje migrace pro plány, podklady a tvůrčí frontu. Produkční identitu předává Sites. Pro repozitářovou kopii vedou odkazy na One Love a Sůl této země ke kanonickým souborům.

## Struktura

| Cesta | Obsah |
| --- | --- |
| `src/index.html`, `src/atelier.js`, `src/atelier.css` | Web Ateliéru, plánování a archiv |
| `src/catalog.js`, `src/lumi.webp` | Katalog a obrazový podklad |
| `src/worker.js`, `src/agent-worker.js`, `src/agent-ui.js` | API, rozhraní a nástroje MCP pro tvůrčí frontu |
| `src/betlem/` | Webová 3D scéna, geometrie, kamery a roster 200 avatarů OASIS |
| `drizzle/` | Databázové migrace |

Betlém v Ateliéru je prostorová studie pro pracovní lokaci u úpatí hory Kasiash. Umožňuje pohled shora, chůzi pomocí WASD nebo šipek a přiblížení vybraného avatara. Zjednodušenou geometrii vykresluje WebGL, případně Canvas. Výtvarné předlohy jsou uložené vedle webu v `Atelier/Betlem/`. Převod do Nirvany je samostatný navazující krok.

Provozní záznamy uživatelů, přístupové údaje a nastavení časovače agenta patří k provozu služby.
