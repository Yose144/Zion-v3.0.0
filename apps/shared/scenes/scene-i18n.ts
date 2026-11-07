/**
 * Texty uvnitř 3D scén (`SceneLabel`).
 *
 * Scény žijí v `apps/shared/scenes/` a importuje je **web** i **Nirvana**,
 * proto tenhle soubor nesmí sahat na `@/lib/i18n-tx` ani na React — jen čistá
 * data a jedna funkce. `cs` zůstává v komponentách jako literál (české texty
 * jsou psané ručně, ne přes slovník); tenhle modul řeší **angličtinu → es/pt/fr**.
 *
 * Fallback je vždy angličtina, nikdy prázdný řetězec.
 */

export type SceneLang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

type Tr = readonly [es: string, pt: string, fr: string];

const DICT: Record<string, Tr> = {
  'Hall of Amenti — record of civilisation': ['Sala de Amenti — registro de la civilización', 'Sala de Amenti — registo da civilização', 'Salle d\'Amenti — registre de la civilisation'],
  'Hiranyagarbha — golden egg': ['Hiranyagarbha — huevo dorado', 'Hiranyagarbha — ovo dourado', 'Hiranyagarbha — œuf doré'],
  'Star face': ['Cara estelar', 'Face estelar', 'Face stellaire'],
  'Earth + orbital station': ['Tierra + estación orbital', 'Terra + estação orbital', 'Terre + station orbitale'],
  'Giza pyramids': ['Pirámides de Giza', 'Pirâmides de Gizé', 'Pyramides de Gizeh'],
  'Oasis': ['Oasis', 'Oásis', 'Oasis'],
  'Sailboats at sea': ['Velas en el mar', 'Veleiros no mar', 'Voiliers en mer'],
  'Cape Point lighthouse': ['Faro de Cape Point', 'Farol de Cape Point', 'Phare de Cape Point'],
  'Stone circle — Khoisan': ['Círculo de piedra — khoisan', 'Círculo de pedra — khoisan', 'Cercle de pierres — khoisan'],
  'Cliffs of the cape': ['Acantilados del cabo', 'Falésias do cabo', 'Falaises du cap'],
  'Seam of two oceans': ['Costura de dos océanos', 'Costura de dois oceanos', 'Couture de deux océans'],
  'Fynbos': ['Fynbos', 'Fynbos', 'Fynbos'],
  'Buddha · meditation': ['Buda · meditación', 'Buda · meditação', 'Bouddha · méditation'],
  'Lotus Pond': ['Estanque de lotos', 'Lago de lótus', 'Étang aux lotus'],
  'Rama Setu · bridge of hearts': ['Rama Setu · puente de corazones', 'Rama Setu · ponte de corações', 'Rama Setu · pont des cœurs'],
  'Anuradhapura — sacred axis': ['Anuradhapura — eje sagrado', 'Anuradhapura — eixo sagrado', 'Anuradhapura — axe sacré'],
  'Dharma Moksha — the golden orb': ['Dharma Moksha — la esfera dorada', 'Dharma Moksha — a esfera dourada', 'Dharma Moksha — l\'orbe doré'],
  'Artha Kama — hall of desires': ['Artha Kama — sala de los deseos', 'Artha Kama — sala dos desejos', 'Artha Kama — salle des désirs'],
  'Corner water bodies': ['Masas de agua en las esquinas', 'Massas de água nos cantos', 'Plans d\'eau d\'angle'],
  'Kailash — sacred mountain': ['Kailash — montaña sagrada', 'Kailash — montanha sagrada', 'Kailash — montagne sacrée'],
  'Monastery': ['Monasterio', 'Mosteiro', 'Monastère'],
  'Glacial lakes': ['Lagos glaciares', 'Lagos glaciares', 'Lacs glaciaires'],
  'Golden chorten': ['Chorten dorado', 'Chorten dourado', 'Chorten doré'],
  'Prayer flags': ['Banderas de oración', 'Bandeiras de oração', 'Drapeaux de prière'],
  'Kora — pilgrims\\\' path': ['Kora — sendero de peregrinos', 'Kora — caminho dos peregrinos', 'Kora — chemin des pèlerins'],
  'Issobella L6 — research core': ['Issobella L6 — núcleo de investigación', 'Issobella L6 — núcleo de investigação', 'Issobella L6 — cœur de recherche'],
  'Comms tower': ['Torre de comunicaciones', 'Torre de comunicações', 'Tour de communications'],
  'Radio telescopes': ['Radiotelescopios', 'Radiotelescópios', 'Radiotélescopes'],
  'Biodomes · genetics lab': ['Biodomos · laboratorio de genética', 'Biodomas · laboratório de genética', 'Biodômes · laboratoire de génétique'],
  'Landing pad': ['Plataforma de aterrizaje', 'Plataforma de aterragem', 'Plateforme d\'atterrissage'],
  'Launch spire': ['Aguja de lanzamiento', 'Torre de lançamento', 'Flèche de lancement'],
  'Cascade & pond': ['Cascada y estanque', 'Cascata e lago', 'Cascade et bassin'],
  'MATRIX · lunar base': ['MATRIX · base lunar', 'MATRIX · base lunar', 'MATRIX · base lunaire'],
  'hall · enter': ['sala · entrar', 'salão · entrar', 'salle · entrer'],
  'greenhouse': ['invernadero', 'estufa', 'serre'],
  'landing pad': ['plataforma de aterrizaje', 'plataforma de aterragem', 'plateforme d\'atterrissage'],
  'Earth': ['Tierra', 'Terra', 'Terre'],
  'GOLDEN EGG': ['HUEVO DORADO', 'OVO DOURADO', 'ŒUF DORÉ'],
  'heart of the OASIS spiral galaxy': ['corazón de la galaxia espiral OASIS', 'coração da galáxia espiral OASIS', 'cœur de la galaxie spirale OASIS'],
  'Fire circle — gathering': ['Círculo de fuego — encuentro', 'Círculo de fogo — encontro', 'Cercle de feu — rassemblement'],
  'Leaf sculpture': ['Escultura de hojas', 'Escultura de folhas', 'Sculpture de feuilles'],
  'Solar pavilion': ['Pabellón solar', 'Pavilhão solar', 'Pavillon solaire'],
  'Festival settlement': ['Asentamiento del festival', 'Povoado do festival', 'Village du festival'],
  'Songlines — sung paths': ['Songlines — caminos cantados', 'Songlines — caminhos cantados', 'Songlines — chemins chantés'],
};

/** Přeloží text scény pro daný jazyk. `cs`/`en` vrací vstup beze změny. */
export function tScene(en: string, lang: SceneLang): string {
  if (lang === 'cs' || lang === 'en') return en;
  const tr = DICT[en];
  if (!tr) return en;
  return tr[lang === 'es' ? 0 : lang === 'pt' ? 1 : 2] ?? en;
}
