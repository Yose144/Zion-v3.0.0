// Public 3.3 "Nirvana" workstreams — shared between /zion-archive#plan-v33 and /roadmap#nirvana.
// Derived from the canonical execution charter (Mise Amenti); internal detail lives in the
// repo plan NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md (waves W0–W6, gates KS-1…KS-9 — those are
// operator DoD, not public copy). Every entry is a goal/horizon with measurable acceptance
// criteria — never a completed capability or a promised date.
// Subtitle "loď Království srdce" is the public image of unification. It does not rename
// phases N0–N7 and it is not the literary book (that book stays a story).

export const NIRVANA_PUBLIC_TITLE = {
  cs: '3.3 Nirvana — loď Království srdce',
  en: '3.3 Nirvana — the boat called Kingdom of the Heart',
} as const;

export interface NirvanaWorkstream {
  id: string;
  layer: string;
  title: { cs: string; en: string };
  goal: { cs: string; en: string };
  acceptance: { cs: string; en: string };
  prerequisite: { cs: string; en: string };
  layerHref: string;
  chapterSlug: string;
}

export const NIRVANA_WORKSTREAMS: NirvanaWorkstream[] = [
  {
    id: 'identity',
    layer: 'L2 + ZIS',
    title: { cs: 'Identita a přenos hodnoty', en: 'Identity & value transfer' },
    goal: {
      cs: 'Bezpečné přihlášení a ověřitelný přenos hodnoty napříč explicitně podporovanými sítěmi.',
      en: 'Safe sign-in and verifiable value transfer across explicitly supported networks.',
    },
    acceptance: {
      cs: 'Doložený vklad → swap → výběr s recovery, refundací a jasně vysvětlenými riziky; Passkeys až po bezpečnostním review identity.',
      en: 'A demonstrated deposit → swap → withdrawal with recovery, refund and clearly explained risks; Passkeys only after an identity-security review.',
    },
    prerequisite: { cs: 'Stabilní základ 3.2', en: 'A stable 3.2 foundation' },
    layerHref: '/market',
    chapterSlug: '06-Mosty-Pres-Propast',
  },
  {
    id: 'orchestration',
    layer: 'L3',
    title: { cs: 'Hiranyagarbha — spolupráce AI', en: 'Hiranyagarbha — AI collaboration' },
    goal: {
      cs: 'Analýza a simulace nejdřív v izolovaném prostředí — ne tiché jednání nad produkcí.',
      en: 'Analysis and simulation first, inside an isolated environment — not silent action over production.',
    },
    acceptance: {
      cs: 'Omezená oprávnění, log všech akcí a lidské schválení pro cokoli s reálným dopadem.',
      en: 'Limited permissions, an action log and human approval for any real-world-impact action.',
    },
    prerequisite: { cs: 'Bezpečná identita a settlement', en: 'Safe identity and settlement' },
    layerHref: '/l3-hiran',
    chapterSlug: '07-Zlate-Luno-Hiranyagarbha',
  },
  {
    id: 'intent',
    layer: 'L3',
    title: { cs: 'Amitabha — rozhraní záměru', en: 'Amitabha — an intent interface' },
    goal: {
      cs: 'Text či hlas vrací srozumitelný plán; rozhodnutí zůstávají na člověku.',
      en: 'Text or voice returns a comprehensible plan; the decisions remain human.',
    },
    acceptance: {
      cs: 'Plán ukazuje náklady, příjemce, rizika a zrušení; oprávnění jsou otestovaná a nezávisle přezkoumaná.',
      en: 'The plan exposes costs, recipients, risks and cancellation; permissions are tested and independently reviewed.',
    },
    prerequisite: { cs: 'AI v sandboxu', en: 'Sandboxed AI' },
    layerHref: '/l3-hiran',
    chapterSlug: '08-Hlas-Amitabha',
  },
  {
    id: 'oasis',
    layer: 'L4',
    title: { cs: 'OASIS — sdílený svět', en: 'OASIS — a shared world' },
    goal: {
      cs: 'Bezpečný a přístupný prohlížečový náhled pro učení a tvorbu.',
      en: 'A safe, accessible browser preview for learning and creation.',
    },
    acceptance: {
      cs: 'Review přístupnosti, bezpečnosti a soukromí a změřený výkon na referenčních zařízeních; pokročilé 3D/streaming zůstává výzkumný horizont.',
      en: 'Accessibility, security and privacy reviews plus measured performance on reference devices; advanced 3D/streaming remains a research horizon.',
    },
    prerequisite: { cs: 'Bezpečná identita; paralelně s ostatními stopami', en: 'Safe identity; in parallel with other tracks' },
    layerHref: '/l4-oasis',
    chapterSlug: '09-Krystalicke-Svety-Oasis',
  },
  {
    id: 'earth',
    layer: 'L5',
    title: { cs: 'Free World — péče o Zemi', en: 'Free World — care for Earth' },
    goal: {
      cs: 'Ukázat cestu humanitární fond → rozhodnutí → projekty → výsledky.',
      en: 'Show the path humanitarian fund → decisions → projects → outcomes.',
    },
    acceptance: {
      cs: 'Alespoň jeden pilot s veřejným rozpočtem, výsledkem a nezávislým ověřením — prokázaný fyzický dopad, ne jen návrh nebo příběh.',
      en: 'At least one pilot with a public budget, an outcome and independent verification — demonstrated physical impact, not only a proposal or a story.',
    },
    prerequisite: { cs: 'Spolehlivá evidence; paralelní stopa', en: 'Reliable evidence; a parallel track' },
    layerHref: '/l5-free-world',
    chapterSlug: '10-Prameny-Zivota',
  },
  {
    id: 'science',
    layer: 'L6',
    title: { cs: 'Issobella — otevřená věda', en: 'Issobella — open science' },
    goal: {
      cs: 'Otevřená metodika, data a reprodukovatelné výpočty místo nepodložených slibů.',
      en: 'Open methodology, data and reproducible computation instead of unsupported promises.',
    },
    acceptance: {
      cs: 'První reprodukovatelný projekt s nezávislým review; kvantové a warp koncepty zůstávají hypotézy.',
      en: 'A first reproducible project with independent review; quantum and warp concepts remain hypotheses.',
    },
    prerequisite: { cs: 'Spolehlivá evidence; paralelní stopa', en: 'Reliable evidence; a parallel track' },
    layerHref: '/l6-issobella',
    chapterSlug: '11-Kvantovy-Ohen-Issobella',
  },
];
