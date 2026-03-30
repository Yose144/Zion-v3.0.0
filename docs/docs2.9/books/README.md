# Historical 2.9 Books

Tato slozka je kanonicka pracovni knizni vetev pro historickou linii 2.9.

Jeji ucel je oddelit:

1. vydane nebo publikovane knihy,
2. jejich historicke vazby na dokumentaci 2.9,
3. navazujici rukopisne vetve, ktere z puvodnich knih vyrustaji.

## Aktualni knizni osa

### 1. Quantova Revoluce

Historicky zaklad narativni linie projektu.

Relevantni stopy v repozitari:

1. publikovane PDF edice ve `APP&WEB/public_html/V2/books/`,
2. analyza souladu knihy s technickou realitou v `docs/docs2.9/2.9.2/ANALYSIS_BOOK_VS_REALITY.md`,
3. mapovani kapitol knihy na konkretni implementace v `docs/docs2.9/2.9.3/root-md/SPIRITUAL_CODE_MAPPING_2026-01-15.md`.

### 2. Ekam Deeksha

Nova navazujici kniha, ktera ma vyrustat primo z osy Quantove Revoluce a rozsirit ji o:

1. historickou linii Amma, Bhagavan, Oneness a Ekam,
2. filozofii Deekshy jako prenosu vedomi,
3. kosmologii Hiranyagarbhy,
4. vyklad Zlatého veku jako civilizacniho algoritmu.

### 3. V2 Books a Sacred Library

Publikovana knizni vrstva ve slozce APP&WEB/public_html/V2/books je samostatna historicka osa artefaktu, kterou AI Native nema ignorovat. Zaroven je ale potreba odlisit samotne PDF publikace od textovych proxy zdroju vhodnych pro training a RAG.

Proto je pro AI ingest kanonicky doplnen manifest:

1. docs/docs2.9/books/V2_BOOKS_AI_NATIVE_CORPUS.md

Tento manifest spojuje:

1. Quantovu Revoluci jako publikovanou materskou knihu,
2. Sacred Library / Amenti knihovnu jako dalsi historickou knizni vrstvu,
3. pravidla, pres ktere se tyto knihy maji dostavat do AI Native korpusu.

## Struktura

### `quantum-revolution/`

Pracovni mosty a kontext ke stavajici knize.

### `ekam-deeksha/`

Nova navazujici knizni vetev obsahujici:

1. most z Quantove Revoluce,
2. plnou osnovu knihy,
3. synopse kapitol,
4. slovnik pojmu,
5. prvni pracovni kapitolu.

## Editacni princip

Quantova Revoluce zustava puvodni materskou knihou historicke vetve 2.9.
Ekam Deeksha neni paralelni odnoz bez vztahu, ale vedoma druha kniha tehoz narativniho proudu.