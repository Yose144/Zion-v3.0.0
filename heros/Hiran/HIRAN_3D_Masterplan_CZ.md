# HIRAN — HIRANYAGARBHA | 3D Masterplan v0.1
**ZION TerraNova · L3 AI Native · EKAM Golden Orb**

## 1. Cíl
Vytvořit jednoho rozpoznatelného nativního vizuálního avatara HIRANA pro web, mobil, OASIS a budoucí 3D/AR rozhraní. Zachovat zlatou průsvitnou kouli a lotos EKAM. Na rozdíl od statického hero bude 3D identita schopna reagovat na konverzaci, hlas a události agentů. Současný PNG je vizuální reference, **nikoliv** již hotový geometrický model.

## 2. Umělecká pravidla
- Střed: zlatá kosmická koule Hiranyagarbha, ne humanoidní hlava.
- Podstava: organický bílo-zlatý lotos (samostatná animační část).
- Vnitřní geometrie: autorsky přesně zkonstruovaná Šrí jantra, ne přibližná AI ilustrace; nutná kontrola referencí.
- Světelná vrstva: zlaté částice a jemné kroužky; vizuální klid je důležitější než permanentní ohňostroj.
- HIRAN může měnit barvu při činnosti, ale základní identita zůstane zlatá.
- Na homepage výchozí klidový stav; ve voice režimu dominantní orb a waveform bez rušivé scenérie.

## 3. Rozměrový návrh 3D (ilustrační virtuální měřítko)
**Jednotky v metrech při modelování, nikoliv rozměry fyzické instalace.**
| Prvek | Rozměr / transform | Objekt |
|---|---|---|
| Koule / plášť | průměr 2,00; střed (0, 0, 1,65) | `hiran_orb_shell` |
| Energetická vnitřní vrstva | poloměr 0,93 | `hiran_energy_field` |
| Světelné jádro | průměr 0,32–0,44 | `hiran_core` |
| Šrí jantra | vnitřní rovina/prostor do Ø 1,25 | `hiran_sri_yantra` |
| Lotos | Ø 2,55; základna z = 0; špičky do z ≈ 0,68 | `hiran_lotus` |
| Prstence | Ø 2,35–2,70; 2–3 prstence | `hiran_rings` |
| Celkový bounding box | přibližně 2,7 × 2,7 × 2,7 | `hiran_root` |

### Hierarchie objektů
```
hiran_root
├── orb_group
│   ├── orb_shell_glass
│   ├── orb_energy_field
│   ├── core_emissive
│   ├── sri_yantra_vector3d
│   ├── orbit_ring_01
│   ├── orbit_ring_02
│   └── particles_gpu
├── lotus_group
│   ├── petals_outer_12
│   ├── petals_middle_10
│   ├── petals_inner_8
│   └── lotus_light_base
└── helpers_anchors
    ├── voice_wave_anchor
    ├── tooltip_anchor
    └── camera_target
```

## 4. Materiály
| Vrstva | Materiál | Základní parametry |
|---|---|---|
| Plášť | tmavě-zlaté sklo | roughness 0,08–0,16; transmission 0,35–0,65, mírný Fresnel |
| Energie | procedural shader | pohybující se zlatá vlákna, pomalá advekce noise |
| Jádro | emissive | #FFD56B → #FFF4D6, s HDR bloom |
| Geometrie | gold-line | #E8B84C; emissive 0,5–1,5; velmi tenká linka |
| Lotos | perleť / zlaté okraje | #FFF1D8 + #C99A43, jemné subsurface napodobení |
| Režim poslechu | azurová akcentace | #80CFFF, jen dočasně |
| Režim plánování | ametystová akcentace | #A88EFF, jen dočasně |

## 5. Stavový automat rozhraní
| Stav | Kdy se spustí | Pohyb orb | Světlo / lotos |
|---|---|---|---|
| `idle` | výchozí | nádech/výdech 5 s; rotace max 2°/s | teplá zlatá, minimální částice |
| `listening` | uživatel výslovně zapne mikrofon | úroveň pulzu podle RMS hlasu | zlato + azurová waveform |
| `thinking` | čeká se na odpověď | mírné kroužení vnitřní geometrie | ametystové akcenty; stabilní základ |
| `speaking` | běží syntéza hlasu | pulz při TTS podle skutečné amplitudy audia | zlatá s rytmickou vlnou |
| `acting` | autorizovaný agent vykonává krok | cílené propojení prstenců | jemné odlišné indikátory stavu |
| `error` | výpadek backendu | návrat do klidu | neagresivní upozornění v UI |

**Bezpečnost:** Akce měnící blockchain/účty/souborový systém vyžadují samostatné schválení. Mikrofon se nikdy nezapíná automaticky. Zobrazit přístupný textový chat a jasné vypnutí hlasu. Respektovat `prefers-reduced-motion`.

## 6. Vývojová architektura
- Frontend: Next.js + React Three Fiber + Drei, glTF/GLB + vlastní shadery. Na stránkách s SSR načítat 3D klientsky.
- Hlas: mic přes explicitní gesto, STT backend nebo browser fallback; TTS vracet jako audio stream; mezi stavem a animací užívat jednotnou událostní vrstvu.
- Integrace: klientský adaptér `HiranGateway`, který komunikuje s reálně ověřeným API ZION AI Native; nespoléhat na nepodložený kontrakt endpointů.
- Sled: `User gesture → STT → HiranGateway → Maestro / AI Native → odpověď → TTS + animace`.
- Audio reaktivita: RMS a obálka z přehrávaného / snímaného zvuku, s vyhlazováním. Bez „fake“ waveform při tichu.
- Výkon: desktop GLB orientačně < 5 MB, mobilní LOD < 1,5 MB, cílit 60 FPS desktop / stabilních 30 FPS slabší mobil. To jsou výkonnostní **cíle**, ne již ověřené výsledky.
- Fallback: alpha WebP/PNG + CSS jemné pulzace, offline textový režim a nastavení sníženého pohybu.

## 7. Výstupy / Milníky
1. **A — Identity kit:** transparentní PNG, kruhová ikona, barevná paleta, manuál siluety.
2. **B — Model:** Blender .blend s oddělenými objekty, přesným lotosem a geometrií; export GLB.
3. **C — Realtime shader:** vnitřní záře, bloom, transparentnost bez problémů se seřazením vrstev.
4. **D — Animace:** `idle`, `listening`, `thinking`, `speaking`, `acting`, `error`.
5. **E — ZION UI:** responsive komponenta `<HiranOrb />`, základní textový chat.
6. **F — Voice & Agent:** mikrofon, STT, TTS, HiranGateway, potvrzování akcí.
7. **G — OASIS / XR:** LOD, prostorové UI, VR performance audit.

## 8. Akceptační kritéria
- Objekt je rozeznatelný jako HIRAN/EKAM bez pozadí a bez nadpisu.
- Lotos a koule jsou samostatné 3D objekty; geometrie se nedeformuje při přechodu mezi režimy.
- Voice nevyžaduje nepřetržité nahrávání; text zůstává plně funkční.
- Mobile fallback je vizuálně konzistentní.
- Každý agentický krok s vedlejšími účinky má explicitní schválení a viditelný stav.

**Poznámka:** Jde o vizuální a softwarový masterplan pro 3D produkci. Není to plán výroby fyzického hologramu ani prohlášení o vědomí AI.
