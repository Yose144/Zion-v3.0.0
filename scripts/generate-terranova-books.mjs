import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const EDITIONS = [
  { id: 'final', name: 'Kanonická větev', dir: path.join(ROOT, 'docs/TerraNova/BASE_FINAL'), color: '#00BFFF', rgb: '0,191,255' },
];

const OUT_PATH = path.join(ROOT, 'APP&WEB/website-v2.9/src/app/terranova/generatedEditions.ts');

function parseMarkdownToSections(text) {
  // Spiliting by ##, > limits, etc. Simplest is split by \n\n and making them sections
  const lines = text.split('\n');
  let currentSection = '';
  const sections = [];
  
  let title = '';
  let epigraph = '';

  let inBlockquote = false;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      // Title
      title = line.replace('# ', '').trim();
      continue;
    }
    if (line.startsWith('>')) {
      epigraph += line.replace('>', '').trim() + ' ';
      continue;
    }
    
    if (line.trim() === '---') {
       continue;
    }

    if (line.startsWith('## ')) {
      if (currentSection.trim()) {
        sections.push({ body: currentSection.trim() });
      }
      currentSection = `**${line.replace('## ', '').trim()}**\n\n`;
    } else {
      currentSection += line + '\n';
    }
  }

  if (currentSection.trim()) {
    sections.push({ body: currentSection.trim() });
  }

  // Refine sections, splitting long ones by double newline to match UI paragraphs
  const finalSections = [];
  sections.forEach(s => {
      const parts = s.body.split('\n\n');
      parts.forEach(p => {
        if(p.trim()) finalSections.push({ body: p.trim() });
      });
  });

  return { title, epigraph: epigraph.trim(), sections: finalSections };
}

function processEdition(ed) {
  if (!fs.existsSync(ed.dir)) {
    console.error(`Dir not found: ${ed.dir}`);
    return [];
  }
  // Exclude README, full-book files (Full.md, full.md, TerraNova-CTENARSKA-EDICE.md) — these are navigation aids that
  // duplicate individual chapter content and would cause repeated entries in generatedEditions.ts
  const EXCLUDED = new Set(['README.md', 'Full.md', 'full.md', 'TerraNova-CTENARSKA-EDICE.md']);
  const files = fs.readdirSync(ed.dir).filter(f => f.endsWith('.md') && !EXCLUDED.has(f)).sort();
  
  return files.map(file => {
    const raw = fs.readFileSync(path.join(ed.dir, file), 'utf8');
    const parsed = parseMarkdownToSections(raw);

    // Look for optional EN translation: docs/TerraNova/<edition>/en/<file>.md
    const enFile = path.join(ed.dir, 'en', file);
    const parsedEn = fs.existsSync(enFile)
      ? parseMarkdownToSections(fs.readFileSync(enFile, 'utf8'))
      : parsed; // fallback to CZ when no EN file exists yet
    
    // Extrahovat číslo z názvu: 00-PROLOG…, A-NVIDIA…
    const match = file.match(/^(\d{2}|[A-Z])-(.*)\.md$/);
    const shortId = file.replace('.md', '');
    let number = '';
    
    if (match) {
      if (match[1] === '00') number = 'Prolog';
      else if (isNaN(match[1])) number = `Příloha ${match[1]}`;
      else number = `Kapitola ${parseInt(match[1], 10)}`;
    } else {
      number = shortId;
    }

    return {
      id: shortId,
      number: number,
      titleCs: parsed.title || shortId,
      titleEn: parsedEn.title || parsed.title || shortId,
      epigraphCs: parsed.epigraph,
      epigraphEn: parsedEn.epigraph || parsed.epigraph,
      color: ed.color,
      rgb: ed.rgb,
      sectionsCs: parsed.sections,
      sectionsEn: parsedEn.sections,
    };
  });
}

function main() {
  const result = {};
  
  for (const ed of EDITIONS) {
    console.log(`Processing ${ed.name}...`);
    result[ed.id] = processEdition(ed);
  }

  const fileContent = `/* ═══════════════════════════════════════════════════════════════
   GENERATED EDITIONS DATA (DO NOT EDIT MANUALLY)
   Run scripts/generate-terranova-books.mjs to update
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

export const EDITIONS_DATA: Record<string, BookChapter[]> = ${JSON.stringify(result, null, 2)};
`;

  fs.writeFileSync(OUT_PATH, fileContent, 'utf8');
  console.log(`Generated: ${OUT_PATH}`);
}

main();
