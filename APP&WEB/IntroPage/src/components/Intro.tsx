export default function Intro() {
  return (
    <section id="intro" className="w-full px-4 py-20 sm:py-28">
      <div className="max-w-3xl mx-auto p-6 sm:p-10 rounded-3xl bg-rasta-dark/60 border border-white/10 backdrop-blur-sm">
        <h2 className="text-2xl sm:text-3xl font-bold text-rasta-gold mb-6 tracking-wide">
          Intro
        </h2>
        <p className="text-white/90 leading-relaxed mb-4">
          <strong className="text-white">ZION</strong> je multichain ekosystém, který se dá ověřit, ne jen slíbit. Nový blok každých ~60 sekund, nativní Proof-of-Work, otevřený kód a fee split zapsaný přímo v pravidlech sítě.
        </p>
        <p className="text-white/90 leading-relaxed mb-4">
          Každý blok automaticky dělí odměnu: <strong className="text-white">89 % těžaři, 5 % humanitárnímu fondu, 5 % fondu budoucnosti, 1 % se spálí</strong>. Není to slib firmy — je to matematika ověřitelná v blockchainu.
        </p>
        <p className="text-white/90 leading-relaxed">
          Žádné ICO, žádný předprodej, žádné tajné alokace. Kdo chce ZION, těží ho, provozuje uzel, nebo ho získá na marketplace a DeFi.
        </p>
      </div>
    </section>
  );
}
