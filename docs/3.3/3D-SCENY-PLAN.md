# Plán dokončení 3D scén — web a Nirvana

Aktualizováno: 31. 10. 2026. Tento dokument zachycuje stav při požadavku „pushnout vše a dát plán do rootu“. **Finální nasazení této sady zatím neproběhlo.**

## Rozsah a pravidla

Doladit 12 projektových scén podle existujících hero předloh, ověřit je na webu i v Nirvaně a nasadit obě aplikace. Hlavní universe a samostatná L6 preview do této sady nepatří.

- Jediný zdroj geometrie a vzhledu: `apps/shared/scenes/`. Aplikační komponenty mají obsahovat pouze obal, navigaci a Canvas; nevytvářet další kopie scén.
- Zachovat již vytvořené typi, rozestavěné lodě a dřevěnou flotilu.
- Předlohy jsou v `heros/`; pro lodě zejména `heros/Kralovstvi srdce/2 Lode.png`.
- Použít existující release checkout; nezakládat druhý. Nasazovat přesně otestované balíčky.
- Nepovažovat úspěšný build ani HTTP 200 za důkaz funkčního 3D vykreslení.

## Hotová implementace

Runtime kandidát: **`2c3566593`**. Navazující změny reportu a auditovacího skriptu se ukládají samostatně; nemění sestavené scény.

| Scéna | Provedené úpravy | Úplná finální kontrola |
| --- | --- | --- |
| Genesis Garden | Záběr loděnice, obloha a dosah kamery, popisky; zachována typi a lodě | Nirvana PASS; web nedokončen |
| Dharma Temple | Společná kamera, popisky a animace nad pobřežím, lodí a sopkou | Rozpracováno |
| Te Pīko Ora | Sjednocené záběry, popisky a animace vesnice a laguny | Zbývá |
| Golden Republic Bohemia | Oblý Říp, vyšší kamera, rozlišení materiálů a stínů | Zbývá |
| Bodhi Lanka | Lotosové střechy, klidnější voda, opravená klenba mostů | Zbývá |
| Ekam | Světlejší mramor, jemnější světelný sloup a obloha | Zbývá |
| LUMI / Nová Amerika | Čitelnější okna, jemnější osvětlení a sklo, souvislý sopečný terén | Zbývá |
| Uluru | Jemnější songlines, opravené barvy oblohy a hvězdné masky | Zbývá |
| Tres Marias | Sjednocené záběry a popisky dřevěné flotily | Zbývá |
| Boa Esperança | Souvislý oceán místo překrývajících se ploch, viditelnější skály | Zbývá |
| Kailash | Souvislé skalní a sněhové povrchy, klidnější jezero | Zbývá |
| Amenti | Vyšší a širší kamera, tlumenější portál a paprsek | Zbývá |

Společné úpravy jsou implementované:

- [x] Responzivní kamera a DPR nejvýše 1,5.
- [x] Ovládání kamery přes výchozí OrbitControls.
- [x] Omezení automatického pohybu podle `prefers-reduced-motion`.
- [x] Opakované použití stínových map mezi pravidelnými aktualizacemi.
- [x] Sprite popisky bez vnořených ReactDOM kořenů; zalamování a čitelné písmo.
- [x] Oprava úniku textur při změně jazyka: regresní test nyní 8 → 8 místo 8 → 38 textur.
- [x] CS/EN přepínač a mobilní hlavička prezentací Nirvany.
- [x] Auditovací skript s pokračováním přes `--resume` a kontrolou produkce přes `--startup-only`.
- [x] Nasazení předem sestaveného balíčku přes `--artifact-dir`, záloha a návrat při chybě startu.

## Skutečně ověřený stav

- [x] Produkční build Nirvany, včetně TypeScriptu.
- [x] Produkční build webu a samostatné `tsc --noEmit`.
- [x] Start obou samostatných nasazovacích balíčků.
- [x] Genesis Garden v Nirvaně: čtyři CS/EN desktop/mobil pohledy, opakované změny jazyka, stabilní prostředky, ovládání, omezení pohybu a reload.
- [ ] Úplná akceptace všech **24 stránek a 96 snímků**.
- [ ] Dokončení vizuálního porovnání všech scén a opakovatelného měření výkonu.
- [ ] Nasazení a následné ověření veřejných webů.

Lokální testovací servery se během kontroly opakovaně ukončily signálem SIGTERM; přesná příčina nebyla potvrzena. Webová sada proto obsahuje `ERR_CONNECTION_REFUSED`, včetně reloadu Genesis. Tyto výsledky **nejsou PASS**. Při předání byly zbývající vlastní testy ukončeny; před pokračováním obnovit servery a běh testů.

Výkon se měří na serveru přes softwarové WebGL. Genesis v Nirvaně: baseline 1,335 FPS, finální vzorek 1,663 FPS. Je to srovnávací diagnostika, nikoli tvrzení o výkonu na fyzické GPU. Případné poklesy přes 15 % ověřit znovu bez souběžného browserového běhu.

## 1. Obnovit ověření

Existující checkout: `.artifacts/3d-tuning/release`, commit `2c3566593`. Zachovat jej do dokončení nasazení. Pokud již neexistuje, vytvořit jeden checkout tohoto commitu, nainstalovat závislosti podle lockfilů a znovu sestavit obě aplikace.

Hotové samostatné balíčky jsou uvnitř tohoto checkoutu:

| Aplikace | Umístění pod checkoutem | BUILD_ID |
| --- | --- | --- |
| Nirvana | `apps/nirvana/.next/standalone/nirvana` | `ctZaorSm6IRLO-hw39asw` |
| Web | `apps/website-v2.9/.next/standalone/website-v2.9` | `aLCS7Zosem-tzszPSUR44` |

Každý balíček má `.zion-build.json` s commitem, BUILD_ID a kontrolním součtem serveru. Závislosti nemají odkazovat mimo balíček. `public/`, `.next/static/` a u webu `archive-content/` jsou připravené vedle `server.js`. Webový prebuild změnil v manifestu dokumentů pouze datum 30. → 31. října.

Spustit servery ve dvou samostatných terminálech:

```bash
cd /home/zionserver/2.9.6-main/.artifacts/3d-tuning/release/apps/nirvana
PORT=3040 HOSTNAME=127.0.0.1 node .next/standalone/nirvana/server.js
```

```bash
cd /home/zionserver/2.9.6-main/.artifacts/3d-tuning/release/apps/website-v2.9
PORT=3041 HOSTNAME=127.0.0.1 node .next/standalone/website-v2.9/server.js
```

Z kořene hlavního repozitáře dokončit sady. `--resume` ponechá již úspěšné případy stejného commitu a zopakuje nehotové nebo neúspěšné:

```bash
python3 scripts/ops/audit-project-scenes.py --app nirvana --release 2c3566593 --output .artifacts/3d-tuning/final --resume
python3 scripts/ops/audit-project-scenes.py --app web --release 2c3566593 --output .artifacts/3d-tuning/final-web --resume
```

- [ ] Vyřešit příčinu ukončování lokálních serverů, pokud se zopakuje; nepřepisovat síťové chyby na úspěch.
- [ ] Zkontrolovat všech 24 konečných výsledků: `status: pass`, žádné runtime/shader chyby a žádné neplatné vrcholy.
- [ ] Projít všech 96 finálních snímků. Kontrolovat zejména mosty Bodhi, oblohu Genesis, oceán Boa, sníh Kailash a celý záběr Amenti.
- [ ] Porovnat počty textur a geometrie po změnách jazyka a po opětovném načtení.
- [ ] Zaznamenat výkon proti baseline; zopakovat podezřelé výsledky samostatně.
- [ ] Při opravě runtime kódu vytvořit nový commit/build a opakovat dotčené kontroly; nikdy nenastavit starému balíčku pouze nový commit v metadatech.

Baseline a průběžné výsledky jsou v `.artifacts/3d-tuning/`. Tento adresář je záměrně ignorovaný Gitem; snímky a buildy nejsou součástí pushnutých zdrojů.

## 2. Doplnit report a push

- [ ] Doplnit `docs/3.2/REPORTS/REPORT_2026-10-31_PROJECT_SCENE_TUNING.md` o konečné výsledky 24 stránek, vizuální porovnání a výkon.
- [ ] Zkontrolovat diff a commitnout pouze nové změny této etapy; nerozmíchat další souběžně rozpracovanou práci.
- [ ] Pushnout a ověřit shodu lokálního HEAD s `origin/main`.

## 3. Nasadit otestované balíčky

Nasadit **nejdříve web, potom Nirvanu**. Před startem potvrdit, že `.zion-build.json` odpovídá právě dokončeným testům. Při opakování použít nové označení release, aby se nepřepsala záloha.

```bash
export ZION_DEPLOY_RELEASE="3d-2c3566593-$(date -u +%Y%m%dT%H%M%SZ)"
bash apps/website-v2.9/deploy/deploy-web2.9.sh --artifact-dir /home/zionserver/2.9.6-main/.artifacts/3d-tuning/release/apps/website-v2.9/.next/standalone/website-v2.9
bash apps/nirvana/deploy/deploy-nirvana.sh --artifact-dir /home/zionserver/2.9.6-main/.artifacts/3d-tuning/release/apps/nirvana/.next/standalone/nirvana
```

| Aplikace | Server / služba | Veřejná adresa |
| --- | --- | --- |
| Web | `zion-edge2` / `zion-website.service`, port 3000 | https://app.zionterranova.com |
| Nirvana | `zion-new` / `zion-nirvana.service`, port 3010 | https://nirvana.zionterranova.com |

- [ ] Zaznamenat čas, release označení a záložní cestu z výstupu obou deployů.
- [ ] Ověřit BUILD_ID a metadata přímo na obou serverech.
- [ ] Ověřit všech 24 veřejných stránek, načtené JS/CSS soubory a skutečně běžící WebGL:

```bash
python3 scripts/ops/audit-project-scenes.py --app all --nirvana-url https://nirvana.zionterranova.com --web-url https://app.zionterranova.com --release 2c3566593 --output .artifacts/3d-tuning/production --startup-only
```

- [ ] Při chybě veřejné scény vrátit příslušnou zálohu a znovu ověřit službu. Automatický návrat skriptu pokrývá start a root HTTP kontrolu; nenahrazuje kontrolu WebGL.

## 4. Uzavřít práci

- [ ] Doplnit report o skutečný výsledek nasazení a veřejné kontroly; commit a push.
- [ ] Ukončit vlastní preview servery a odstranit dočasný release worktree až po úspěšné akceptaci.
- [ ] Ponechat jednu sadu důkazů a potřebné rollback zálohy; odstranit vlastní neúspěšné pomocné kopie a skripty.
- [ ] Předat stručné shrnutí, oba veřejné odkazy a commit. Hotovo znamená 24/24 PASS lokálně i po nasazení.

## Poznámka k požadavku „pushnout vše“

Aktuální pracovní strom kromě 3D obsahuje i mobilní úpravy MarketPlace, formátovací změny V31 core a aktualizaci širšího plánu. Jejich zahrnutí do Gitu neznamená jejich nasazení ani dokončení všech jejich testů. `npm run typecheck` v MarketPlace při předání prošlo. Při zachycení stavu chyběl také sledovaný soubor `apps/desktop-agent/resources/node`; před dalším desktop releasem ověřit záměr tohoto odebrání a obsah balíčku.
