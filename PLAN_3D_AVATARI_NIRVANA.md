# Nirvana — skuteční 3D avatáři podle portrétů

**Stav 2026-11-07: první experimentální busta Krishny, 0/202 schválených herních modelů.** Cílem je 202 individuálních, rozpoznatelných a herně použitelných postav podle oficiálních portrétů OASIS. Procedurální avatáři zůstávají náhradou, dokud není konkrétní model schválený. Nezaměňovat 2D portrét, generovaný návrh, statickou síť a hotový animovaný herní asset.

## 1. Výchozí stav a omezení

- Roster `V31/L4/oasis/data/avatars.json`: 202 postav, ID nejsou souvislá. Katalog Nirvany vzniká `scripts/ops/gen-avatar-catalog.mjs`; mapovat podle ID z rosteru, nikoli pořadí či názvu souboru archivu.
- Oficiální referenční portréty: `apps/website-v2.9/public/oasis-assets/final_portraits/`; originály `heros/ZION_OASIS_AVATARI_KOMPLET/`. Část originálů je lokální/untracked: před předáním zajistit jejich zálohování a práva, nevkládat automaticky do gitu.
- `apps/nirvana/src/core/avatars/{kit,body,AvatarModel}.tsx` (kit a body jsou `.ts`) nyní vyrábí sloučenou procedurální geometrii. `AvatarModel` používají výběr `/avatars`, MOBA a multiplayer Marsu. Výběrová animace otáčí celou postavou; nejde o rig ani chůzi.
- Jeden obrázek není skutečný 3D sken: neviditelné záda, nohy a části zakryté rukou se musí navrhnout a zkontrolovat. AI výstup bude návrh, ne důkaz věrnosti.
- Tento Mac: Apple M1, **8 GB sdílené RAM**, přibližně **17 GiB volného místa** při měření. Blender a PyTorch v aktuálním PATH/Pythonu nebyly nalezeny. Metal renderer neznamená, že náročný AI model poběží; dostupnost MPS a špičkovou paměť je třeba změřit. Nic nemazat kvůli místu bez souhlasu.

## 2. Nástroje a licenční brána

1. **[TripoSR](https://github.com/VAST-AI-Research/TripoSR)** — zdroj i váhy dle projektu MIT, lokální image→mesh, GLB a volitelný bake textury. První experiment: malý vstup, nízké `--mc-resolution`, `--chunk-size`, jeden obrázek. Projekt uvádí přibližně 6 GB VRAM ve výchozím nastavení, což na 8GB sjednocené paměti není příslib funkčnosti. Samostatně prověřit licence všech závislostí a modelu pro odstranění pozadí.
2. **Důležitá chyba MPS:** oficiální `run.py` po `--device` bez CUDA bezpodmínečně nastaví `device = 'cpu'`. Pro pokus na M1 použít izolovanou, zaznamenanou úpravu výběru zařízení; otestovat reálné `torch.backends.mps.is_available()` a operátory, nikoli tvrdit, že stačí `--device mps`. Fallback na CPU je samostatný měřený experiment.
3. **[Blender](https://www.blender.org/)** — zdarma/open source pro ruční úpravy, retopologii, UV, rig, animaci a export glTF. Instalace až po kontrole místa a původu; samotné generování neřeší animace.
4. **[TRELLIS.2 pro Mac](https://github.com/shivampkumar/trellis-mac)** — alternativní experiment pouze na vhodnějším vlastním hardwaru: autor doporučuje 24 GB RAM a ~15 GB váhy, naměřil ~18 GB špičku. Výchozí RMBG-2.0 je **CC BY-NC**, DINOv3 má vlastní podmínky a gated přístup: pro komerční použití nepřijímat bez právní kontroly a případné náhrady. MIT licence portu neplatí automaticky pro všechny váhy. Na tomto Macu nedoporučeno.
5. Nepoužívat placené služby, GPU pronájem ani upload portrétů třetí straně bez výslovného souhlasu. U každého modelu, vah, segmentace, knihoven a textur zaznamenat verzi, licenci, povolení pro zamýšlené použití, původ a atribuci. Nejasná licence = blokace vydání.

## 3. Pilot: Krishna, avatar ID 0

**Předloha:** `apps/website-v2.9/public/oasis-assets/final_portraits/000-krishna-maitreya.webp` (párovat s rosterem podle ID; označení souboru je historický slug). První vizuální rozbor skutečného obrázku:

- mladý muž s teplou pletí, dlouhé tmavé vlnité vlasy, čelní ozdoba/tilak; ne předpokládaná modrá pleť ze starého procedurálního kánonu;
- zlatý diadém s modrým kamenem, výrazné paví pero a bílý květ, náušnice, vrstvy šperků;
- bílo-zlatý oděv, bohatě zdobená tmavě modrá látka s kosmickými motivy, zlaté lemy;
- flétna u pravého ramene, otevřená natažená ruka; zářivá geometrická svatozář a efekt nad dlaní jsou oddělitelné efekty, nikoli nutně geometrie těla;
- portrét ukazuje horní část těla a komplikované pozadí. Nohy, záda, neutrální postoj a některé části oděvu jsou **návrh k odsouhlasení**, ne fakta z obrázku.

### P0 — experiment, ne produkce

- [ ] Založit izolovaný pracovní adresář mimo git, zaznamenat místo na disku, verze a revize nástrojů. Nepřepisovat originální portrét.
- [ ] Připravit čistou masku postavy: ručně zkontrolovat obličej, vlasy, pero, flétnu a obě ruce; pozadí a svatozář odstranit. Porovnat originál, masku a vstup; zachovat autorský zdroj.
- [ ] Zkusit TripoSR po prokazatelné opravě MPS volby; zaznamenat příkaz, skutečné zařízení, nastavení, dobu, peak RAM, velikost výsledku a případnou chybu. Při nedostatku paměti neoslabovat systémové limity naslepo; zkusit menší rozlišení/chunk nebo CPU. Upozornění: původní portrét není celá postava, takže přímý výsledek může být pouze busta a selhat na průsvitných detailech.
- [ ] Pokud generátor selže nebo neuchová podobu, označit experiment **FAIL** a pokračovat ručním modelem v Blenderu, případně požádat o další bezplatně dostupný vhodnější hardware. Nezastírat chybějící model.
- [ ] Zkontrolovat 4 pohledy proti referenci: tvář, vlasy, pero, flétna, šperky, barvy a silueta; zapsat vady a rozhodnutí o spodku/zádech. Při nesouladu ruční opravy nebo nový pokus; neoznačovat automaticky vytvořenou síť za schválenou.

### P1 — první herní model

- [ ] Doplnit celé tělo, rozumnou topologii, UV a materiály; samostatně řešit flétnu, pero a efekty. Síť opravit, nikoli jen bez kontroly zjednodušit.
- [ ] Společný humanoidní rig a váhy, jednotky metry, Y nahoru a směr dopředu dle ověřeného renderu Nirvany; idle, chůze/běh, útok, případně smrt podle potřeb her. V návrhu rozlišit generovaný statický mesh a fungující skinned model.
- [ ] Exportovat master a optimalizované GLB včetně textur; kontrola glTF validátorem, čtyř stran, výšky, orientace, textur, kloubů a průniku oděvu. Zdrojový model uložit mimo distribuční asset; do gitu pouze schválený soubor dle repo politiky a velikostních limitů.
- [ ] Po schválení podobnosti začlenit do `/avatars`, MOBA a Mars MP **týmž mapováním `avatarId`**; chybějící/neplatný asset a chyba načítání bezpečně vrací stávající procedurální model. Testovat přepnutí ID a více současných instancí; každá animovaná postava potřebuje vlastní skeleton/AnimationMixer, sdílené zdroje se nesmí předčasně uvolnit.
- [ ] Změřit scénu před/po na M1 a emulovaném mobilu: FPS/frame time, draw calls, tris, GPU paměť pokud dostupná, síťový přenos a načítání při 10 hrdinech MOBA. Vyzkoušet skutečný telefon při dostupnosti. Pilotem stanovit reálné stropy; předběžný cíl **≤20k tris a ≤4 draw calls na herní LOD**, textura ≤1024², nikoli splněná záruka.

## 4. Pipeline pro všech 202

1. **Inventář:** automaticky spojit roster, ID, oficiální portréty, kanonické atributy a zdrojové soubory; zkontrolovat 202 unikátních ID, žádné chybějící nebo duplicitní mapy a zaznamenat SHA-256 vstupů. Kánon a portrét při rozporu vyžadují redakční rozhodnutí, nepřepisovat je potichu.
2. **Individuální design brief:** pro každého výslovně popsat viditelné znaky, zvláštní anatomii (např. sloní hlava), siluetu, pomůcky, zakryté části a nejistoty. Záda/dolní část těla jsou interpretace; zvláštní kulturní a náboženské znaky posoudit citlivě.
3. **Výroba v dávkách:** nejprve Krishna, poté reprezentativní vzorek odlišných siluet a anatomií; teprve po schválení pipeline dávky zbytku rosteru. Podkladová generace může urychlit práci, ale individuální podobu, obličej, ruce, kostým a doplňky kontroluje člověk. Žádné předstírání 202 hotových modelů pouhou změnou parametrů.
4. **Rig a animace:** humanoidy retargetovat na ověřenou společnou kostru; výjimky evidovat zvlášť. Ověřit deformaci ramen, loktů, prstů a oděvů v pohybu, při držení atributu i z pohledu kamery. Doplňky navázat na kosti, aby neplavaly.
5. **Optimalizace:** master → herní LOD → vzdálený/mobilní LOD, textury komprimované po ověření podpory loaderu. Žádná destruktivní úprava originálu; změřit kvalitu po redukci i souhrnný výkon 10 různých postav.
6. **Manifest:** ID, název, reference+hash, původ a licence, verze, cesty a hashe master/GLB/LOD, rig, stav, review, výkon, známá omezení. Stavy `brief → draft → reviewed → rigged → optimized → integrated → verified`; `verified` jen po reálných testech.
7. **Postupné zapojování:** načítat pouze potřebné modely, při chybě použít stávající vzhled; statické cesty pod `/models/` ověřit vůči middleware. Multiplayer přenáší ID, ne síť ani nedůvěryhodné URL. Žádný bump protokolu, pokud se wire kontrakt nemění.
8. **Kontrola každé dávky:** porovnání front/3⁄4/bok/záda s referencí, test chybějícího GLB, výběr a hra, dvě současné instance i multiplayer, únik GPU paměti při střídání a benchmark. Při chybě stáhnout jen daný model z manifestu, ne rozbít ostatní.

## 5. Brány a dokončení

| Brána | Co musí být doloženo |
|---|---|
| G0 | Inventář 202/202, kontrola licencí a vlastnictví předloh |
| G1 | Krishna: zaznamenaný experiment a výtvarně schválená podoba, nebo poctivý FAIL a další postup |
| G2 | Krishna: rig, herní GLB, fallback, vizuální a herní testy, naměřený výkon |
| G3 | Reprezentativní sada odlišných anatomií a odsouhlasené rozpočty |
| G4 | 202/202 mají individuální schválený model, manifest a herní LOD |
| G5 | 202/202 ověřených referencí a assetů, regrese výběru/MOBA/Marsu/MP, mobilní test a zdokumentované výjimky |

Finální deploy je samostatné rozhodnutí: build z izolovaného čistého artefaktu, kontrola změn paralelních session, protokolu a rollbacku; bez výslovného schválení produkci neměnit. Čas a počet dávek odhadnout až z naměřeného pilotu, ne z rychlosti samotné AI inference.

## 6. První experiment na M1

- PyTorch 2.15.0, Python 3.11, MPS dostupné a ověřené výpočtem; GPU inference s explicitním `--device mps` po opravě CPU fallbacku v izolované kopii TripoSR.
- TripoSR váhy 1,68 GB; `--chunk-size 1024 --mc-resolution 64`, automatické odstranění pozadí U²-Net. Dopředný výpočet 6,0 s, extrakce 6,3 s (nezahrnuje inicializaci a stahování). Export: 1 mesh, 4 115 vrcholů, 8 218 trojúhelníků, 162 KiB. Špička RAM zatím nezměřena.
- `torchmcubes` se v izolovaném prostředí sice sestavil, ale načetl nekompatibilní systémový PyTorch dylib; pro experiment nahrazen CPU `skimage.measure.marching_cubes` s převodem os. Tato změna není dosud řádně regresně ověřena na referenční geometrii.
- Lokální experimentální výstupy `.artifacts/krishna-triposr-pilot/mesh.glb` a `input.png` nejsou finální asset. Automatická maska **odstranila korunu, pero a květ**, které splývají s pozadím. Geometrie nebyla vizuálně ověřena z několika stran, není rigovaná ani připojená ke hře. G1 i G2 zůstávají otevřené.
- Další krok: opravit masku podle originálu, ověřit licence segmentačních vah a osovou konvenci extrakce na známém tělese, zkusit vyšší rozlišení s měřením paměti; poté vyrenderovat více pohledů a teprve hodnotit podobnost. K dispozici je alternativně GTX 1070 Ti, zatím žádný vzdálený výpočet nespouštět.
