export default function Elements() {
  return (
    <section id="elements" className="w-full px-4 py-20 sm:py-28">
      <div className="max-w-3xl mx-auto p-6 sm:p-10 rounded-3xl bg-rasta-dark/60 border border-white/10 backdrop-blur-sm">
        <h2 className="text-2xl sm:text-3xl font-bold text-rasta-gold mb-6 tracking-wide">
          Tři cesty na palubu
        </h2>

        <p className="text-white/90 leading-relaxed mb-10">
          U brány do Oasis stojí dvě kněžky: <strong className="text-white">Rádha</strong> a <strong className="text-white">Elizabeth</strong>. Jedna drží sůl a med — druhá lucernu budoucnosti. Celý ZION se teď přesouvá do Oasis. Pod zahradou běží <strong className="text-white">3.2.0 Mainnet Stable &quot;One Love&quot;</strong>. První OASIS preview je live, trvalý genesis bude potvrzen po 5měsíčním testu do Silvestra.
        </p>

        <div className="space-y-8">
          <div className="p-5 rounded-2xl border-l-4 border-rasta-gold bg-white/5">
            <h3 className="text-xl font-bold text-white mb-2">1. Pozorovatel</h3>
            <p className="text-white/80 leading-relaxed">
              Nic neinstaluj. Podívej se na živou síť v{' '}
              <a
                href="https://app.zionterranova.com/explorer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rasta-gold hover:underline"
              >
                exploreru
              </a>
              , prolistuj kód na{' '}
              <a
                href="https://github.com/Zion-TerraNova/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rasta-gold hover:underline"
              >
                GitHubu
              </a>{' '}
              a přečti si{' '}
              <a
                href="https://app.zionterranova.com/whitepapers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rasta-gold hover:underline"
              >
                whitepaper
              </a>
              .
            </p>
          </div>

          <div className="p-5 rounded-2xl border-l-4 border-rasta-green bg-white/5">
            <h3 className="text-xl font-bold text-white mb-2">2. Hráč</h3>
            <p className="text-white/80 leading-relaxed">
              Vstup do prvního{' '}
              <a
                href="https://oasis.zionterranova.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rasta-gold hover:underline"
              >
                OASIS preview
              </a>
              . Vyber si avatara, projdi questy, sbírej XP za skutečné činy a postupuj od CL1 až po CL9 <em className="text-rasta-gold">On The Star</em>.
            </p>
          </div>

          <div className="p-5 rounded-2xl border-l-4 border-rasta-red bg-white/5">
            <h3 className="text-xl font-bold text-white mb-2">3. Stavitel</h3>
            <p className="text-white/80 leading-relaxed">
              Tvůj počítač může nést kus mostu. Stáhni{' '}
              <a
                href="https://app.zionterranova.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rasta-gold hover:underline"
              >
                miner
              </a>
              , vytvoř peněženku a spusť uzel nebo těžbu — jedna binárka, interaktivní menu, GPU + CPU Boost.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
