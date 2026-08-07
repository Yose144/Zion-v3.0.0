'use client';

import StargateLogo from './StargateLogo';

const NAV = [
  { label: 'ZION v3.2.0', href: '#v3zion' },
  { label: 'GitHub', href: 'https://github.com/Zion-TerraNova/', external: true },
  { label: 'Market', href: 'https://market.zionterranova.com', external: true },
  { label: 'Support', href: '#support' },
  { label: 'Contact', href: '#contact' },
  { label: 'Archive V2', href: 'https://www.newearth.cz/V2/main.html', external: true },
];

export default function Header() {
  return (
    <header
      id="header"
      className="relative min-h-screen w-full flex flex-col items-center justify-start overflow-hidden"
    >
      <div className="w-full max-w-4xl px-4 pt-8 pb-6 flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-[560px]">
          <StargateLogo />
        </div>

        <div className="text-center -mt-8 sm:-mt-12 relative z-10">
          <h1 className="text-5xl sm:text-7xl font-black tracking-widest text-white drop-shadow-[0_0_18px_rgba(252,209,22,0.35)]">
            ZION
          </h1>
          <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-rasta-gold tracking-[0.2em] uppercase">
            Terra Nova &infin; OASIS
          </h2>
          <p className="mt-2 text-sm sm:text-base text-white/80 tracking-wider">
            Multichain Dharma Ecosystem
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://oasis.zionterranova.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-full font-bold text-rasta-black bg-rasta-gold hover:bg-yellow-300 transition-colors shadow-[0_0_24px_rgba(252,209,22,0.4)]"
            >
              Preview OASIS
            </a>
            <a
              href="https://app.zionterranova.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-full font-bold text-white bg-rasta-red hover:bg-red-600 transition-colors shadow-[0_0_24px_rgba(228,30,43,0.35)]"
            >
              eXplorer
            </a>
          </div>
        </div>
      </div>

      <nav className="w-full px-4 pb-10 mt-auto">
        <ul className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm sm:text-base">
          {NAV.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-rasta-gold hover:border-rasta-gold/50 transition-colors"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
