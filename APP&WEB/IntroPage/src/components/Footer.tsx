import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="w-full px-4 py-12 border-t border-white/10 bg-rasta-dark/40">
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
        <a
          href="https://market.zionterranova.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 inline-block transition-transform hover:scale-110"
        >
          <Image
            src="/images/logo144.png"
            alt="ZION TerraNova Logo"
            width={80}
            height={80}
            className="w-20 h-20 object-contain"
            loading="lazy"
          />
        </a>
        <p className="text-white/60 text-sm tracking-wider">
          &copy; 2026 ZION &reg; Terra Nova &infin; Oasis
        </p>
      </div>
    </footer>
  );
}
