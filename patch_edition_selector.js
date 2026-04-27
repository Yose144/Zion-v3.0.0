const fs = require('fs');

const path = 'APP&WEB/website-v2.9/src/app/terranova/TerraNovaBookClient.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = '{/* ═══════ TABLE OF CONTENTS (inline) ═══════ */}';

const replacement = `{/* ═══════ EDITION SELECTOR ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-12 border-y border-white/5 py-8"
        >
          <div className="text-center mb-6">
            <h3 className="text-[10px] uppercase tracking-[0.4em] text-zion-gold/80 font-mono mb-3">
              {cs ? 'Režim čtení' : 'Reading Mode'}
            </h3>
            <p className="text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {cs 
                ? 'Epos Terra Nova roste hned v několika formách. Přepínejte mezi zdrojovými texty podle toho, jakou vrstvu vyhledáváte.' 
                : 'The Terra Nova epic grows in several forms. Switch between the source texts depending on the layer you seek.'}
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { id: 'unified', name: cs ? 'Zlatý Kompas (Složená Osa)' : 'Golden Compass (Unified)', color: '#FFD700', bg: 'rgba(255,215,0,0.15)', border: 'rgba(255,215,0,0.4)' },
              { id: 'org', name: cs ? 'ORG Větev (Organická)' : 'ORG Branch (Organic)', color: '#32CD32', bg: 'rgba(50,205,50,0.1)', border: 'rgba(50,205,50,0.3)' },
              { id: 'final', name: cs ? 'ZION Core (Technická)' : 'ZION Core (Technical)', color: '#00BFFF', bg: 'rgba(0,191,255,0.1)', border: 'rgba(0,191,255,0.3)' },
              { id: 'gemini', name: cs ? 'Odysea (Sci-Fi Příběh)' : 'Odyssey (Sci-Fi Tale)', color: '#8A2BE2', bg: 'rgba(138,43,226,0.15)', border: 'rgba(138,43,226,0.4)' }
            ].map(ed => (
              <button
                key={ed.id}
                onClick={() => { setActiveEdition(ed.id as any); setActiveChapter(0); setActiveSection(0); }}
                className="px-5 py-3 rounded-2xl border text-sm font-medium transition-all flex items-center gap-2 relative overflow-hidden"
                style={{
                  backgroundColor: activeEdition === ed.id ? ed.bg : 'rgba(0,0,0,0.4)',
                  borderColor: activeEdition === ed.id ? ed.border : 'rgba(255,255,255,0.08)',
                  color: activeEdition === ed.id ? ed.color : 'rgba(255,255,255,0.5)'
                }}
              >
                {activeEdition === ed.id && (
                  <motion.div layoutId="activeEditionGlow" className="absolute inset-0 bg-white/5 opacity-50" />
                )}
                {ed.name}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ═══════ TABLE OF CONTENTS (inline) ═══════ */}`;

content = content.replace(target, replacement);

fs.writeFileSync(path, content, 'utf8');
