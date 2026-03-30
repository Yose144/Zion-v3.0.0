# V2 Books - AI Native Corpus Manifest

Tento soubor je kanonicky textovy most mezi publikovanou knizni vrstvou ve slozce APP&WEB/public_html/V2/books a AI Native knowledge/training pipeline.

Jeho smysl je prosty:

1. potvrdit, ktere knihy jsou soucasti historicke knihovni vrstvy projektu,
2. oddelit publikacni artefakty od textovych proxy zdroju vhodnych pro AI ingest,
3. dat collectoru a budoucimu RAG rezimu stabilni textovou osu bez nutnosti spolehat na binarni PDF soubory.

## 1. Publikacni vrstva ve V2/books

V APP&WEB/public_html/V2/books jsou dolozene zejmena tyto publikovane artefakty:

### 1.1 Quantova Revoluce

- QuantumRevolutionCZ.pdf
- QuantumRevolution_EN.pdf
- QuantumRevolution_DE.pdf
- QuantumRevolution_ES.pdf
- QuantumRevolution_FR.pdf
- QuantumRevolution_PT.pdf
- QuantumRevolution_JP.pdf
- QuantumRevolution_HIND.pdf
- QuantumRevolution_SANS.pdf
- QuantumRevolution_HAWAI.pdf
- QuantumRevolution.zip

Tato vrstva potvrzuje, ze Quantova Revoluce byla vedena jako skutecne publikovana kniha vice jazykovych variant, ne jen jako interní draft.

### 1.2 Bonus a starsi knizni knihovna

V publikacni ose se dale objevuje Bonus/ a starsi V2 books / Old/src vrstva s knihami jako:

- Cosmic Egg
- Smaragdove Desky / Emerald Tablets
- Dohrmanovo proroctvi
- Omnity One Love
- Starobyly sip
- Tajemstvi Amenti

Tyto soubory jsou pro projekt relevantni jako historicka knihovni a inspiracni vrstva. Soucasne je ale dulezite odlisit jejich pouhou pritomnost ve verejne publikacni slozce od toho, co se ma skutecne indexovat do AI Native korpusu.

## 2. Co se nema delat

Aktualni AI Native pipeline nema stavet na slepem ingestu PDF artefaktu. Duvody:

1. current collector a knowledge-base vrstva pracuji primarne s textovymi soubory v repozitari,
2. PDF artefakty jsou nestabilni jako zdroj chunkingu a metadat,
3. publikovane knihy mohou byt autorskopravne citlivejsi nez interni kuratorske summary vrstvy,
4. AI ma odpovidat z repo-local textoveho korpusu, ne predstirat, ze nacetla nekuratovany binarni archiv.

## 3. Co se ma delat

AI Native ma tyto knihy nasavat pres textove proxy a kuratorske dokumenty, ktere uz v repozitari existuji.

### 3.1 Quantova Revoluce - textovy most

Pouzitelne zdroje:

- docs/docs2.9/books/README.md
- docs/docs2.9/books/quantum-revolution/BOOK_CONTEXT.md
- docs/docs2.9/2.9.2/ANALYSIS_BOOK_VS_REALITY.md
- docs/docs2.9/2.9.3/root-md/SPIRITUAL_CODE_MAPPING_2026-01-15.md

Funkce teto vrstvy:

- potvrzuje publikacni existenci knihy,
- vysvetluje jeji vztah k dokumentaci 2.9,
- drzi most mezi puvodnim narativem a navazujici knihou Ekam Deeksha.

### 3.2 Sacred Library / Amenti - textove proxy zdroje

Pouzitelne zdroje:

- docs/docs2.9/ZION_OASIS/GOLDEN_EGG_GAME/SACRED_LIBRARY_README.md
- docs/docs2.9/ZION_OASIS/GOLDEN_EGG_GAME/SACRED_LIBRARY_COMPLETE.md
- docs/docs2.9/deployment/AMENTI_LOG_INDEX.md
- relevantni kapitoly docs/docs2.9/SACRED_KNOWLEDGE/
- relevantni tematicke casti docs/docs2.9/COSMIC_MAP/
- docs/docs2.9/PROJECT_OVERVIEW.md

Funkce teto vrstvy:

- drzi jmena knih, jejich tematicke osy a pracovni vztahy,
- dava AI prehled o tom, jak byly tyto knihy pouzivany v ZION kontextu,
- omezuje skluz do dojmu, ze AI trenuje na plnych necitlivych PDF dump vrstvach.

## 4. Pracovni pravidlo pro AI Native

Kdyz se agent pta na tyto knihy, ma rozlisovat tri vrstvy:

1. publikacni artefakt ve V2/books,
2. repo-local textovy proxy zdroj, ktery je vhodny pro training nebo RAG,
3. autorska nebo editorialni syntéza projektu ZION, ktera z knih vybira jen nektere tematicke linie.

Prakticky to znamena:

- neodpovidat stylem "precetl jsem PDF knihu",
- odpovidat stylem "v repozitari existuje publikacni stopa a kuratorska textova vrstva k teto knize",
- do fine-tune a RAG preferovat summary, manifesty, mapovani a tematicke syntheses.

## 5. Minimalni jadro, ktere ma AI znat

### Quantova Revoluce

- je materska historicka kniha linie 2.9,
- existuje ve vice publikovanych PDF variantach,
- navazuje na ni Ekam Deeksha jako druha kniha téhož narativniho proudu.

### Sacred Library / Amenti

- je historicka knihovni vrstva navazana na ZION Oasis a kosmologickou dokumentaci,
- zahrnuje minimalne Cosmic Egg, Emerald Tablets, Dohrmanovo proroctvi, Omnity One Love, Starobyly sip a Tajemstvi Amenti,
- v AI Native korpusu ma byt reprezentovana pres textove summary a provenance docs, ne pres slepy PDF ingest.