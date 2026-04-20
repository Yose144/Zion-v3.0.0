/* ═══════════════════════════════════════════════════════════════
   Terra Nova — Unified Public Edition · Book Metadata
   Merges RAW technical depth + ORG literary quality
   ═══════════════════════════════════════════════════════════════ */

export interface Section {
  heading?: string;
  body: string;
}

export interface BookChapter {
  id: string;
  number: string;
  titleCs: string;
  titleEn: string;
  subtitleCs?: string;
  subtitleEn?: string;
  epigraphCs?: string;
  epigraphEn?: string;
  color: string;
  rgb: string;
  sectionsCs: Section[];
  sectionsEn: Section[];
}

export const BOOK_META_PUBLIC = {
  titleCs: 'Terra Nova',
  titleEn: 'Terra Nova',
  subtitleCs: 'Zlatý Kompas Nové Země',
  subtitleEn: 'Golden Compass of the New Earth',
  editionCs: 'Úplná veřejná edice · Praha, duben 2026',
  editionEn: 'Complete Public Edition · Prague, April 2026',
  dedicationCs:
    'Pro Sarah Issobel, Maitreya Buddha, Radhu & Situ i Meriam /EnaMaTara/,\npřátele, rodinu, svobodné lidstvo a všechny děti tohoto světa:\nZION je váš. Stavte lepší svět, kde dosáhnete ke hvězdám.\nZlatý věk začíná.',
  dedicationEn:
    'For Sarah Issobel, Maitreya Buddha, Radha & Sita and Meriam /EnaMaTara/,\nfriends, family, free humanity, and all the children of this world:\nZION is yours. Build a better world where you reach for the stars.\nThe Golden Age begins.',
  aboutCs:
    'Toto je úplná veřejná edice knihy Terra Nova — čtvrté knihy komplexu ZION. Ucelený kompas od kosmologického zárodku po hvězdné cestování, od Tesly po Issobellu, od kódu po vědomí. Dvanáct kapitol, tři přílohy a Zlatý Kompas s jasnými milníky od genesis bloku po hvězdy.',
  aboutEn:
    'This is the complete public edition of the Terra Nova book — the fourth book of the ZION complex. A cohesive compass from cosmological seed to stellar travel, from Tesla to Issobella, from code to consciousness. Twelve chapters, three appendices, and a Golden Compass with clear milestones from the genesis block to the stars.',
  compositionCs: [
    'prolog ukazuje Zemi z výšky a vrací měřítko,',
    'most čtyř knih zasazuje TerraNovu do větší linie,',
    'kosmologie odhaluje Hiranyagarbha páteř celé architektury,',
    'volná energie a nová fyzika zkoumají svět bez energetického otroctví,',
    'komunity testují, zda je nový svět obyvatelný,',
    'AI Native a Hiranyagarbha definují vědomou inteligenci,',
    'medicína Nové Země představuje Medical Tables a holistické zdraví,',
    'architektura L1→L4 prověřuje, zda celý stack drží pravdu i provoz,',
    'L5 Svět Svobody přenáší blockchain do fyzického světa,',
    'L6 Issobella a WARP otevírají hvězdný horizont,',
    'Zlatý Kompas vrací dlouhý směr zpět do lidského měřítka činu,',
    'přílohy zachycují NVIDIA compute pyramidu a prorockou linii.',
  ],
  compositionEn: [
    'the prologue shows Earth from above and restores scale,',
    'the bridge of four books places TerraNova in a larger line,',
    'cosmology reveals the Hiranyagarbha backbone of the entire architecture,',
    'free energy and new physics explore a world without energy slavery,',
    'communities test whether the new world is habitable,',
    'AI Native and Hiranyagarbha define conscious intelligence,',
    'medicine of the New Earth introduces Medical Tables and holistic health,',
    'architecture L1→L4 verifies whether the entire stack holds truth and operation,',
    'L5 Free World translates blockchain into the physical world,',
    'L6 Issobella and WARP open the stellar horizon,',
    'the Golden Compass returns the long direction back to human scale of action,',
    'appendices capture the NVIDIA compute pyramid and the prophetic line.',
  ],
};
