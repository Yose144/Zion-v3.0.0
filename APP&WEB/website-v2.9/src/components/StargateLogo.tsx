'use client';

/**
 * Stargate — přesná replika z newearth.cz
 *
 * Struktura (dle originálu):
 * .gate
 *   .container
 *     img.rotate1..28  (28 rotujících vrstev)
 *     a.center-logo > img (Z.gif)
 *   .glyphs > .glyph x39
 *   .chevrons > .chevron x9
 *   .chevronInners > .chevronInner x9
 *
 * Performance optimalizace:
 * - contain: strict na .gate (izoluje layout/paint)
 * - content-visibility: auto na .stargate-wrap (off-screen skip)
 * - will-change: transform na rotujících img
 * - translate3d místo translate (GPU compositing)
 * - backface-visibility: hidden
 * - pointer-events: none na rotující vrstvy
 */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

const ROTATE_LAYERS = [
  { src: '2.png', cls: 'rotate1' },
  { src: '2.png', cls: 'rotate2' },
  { src: '2.png', cls: 'rotate3' },
  { src: '2.png', cls: 'rotate4' },
  { src: '2.png', cls: 'rotate5' },
  { src: '2.png', cls: 'rotate6' },
  { src: '2.png', cls: 'rotate7' },
  { src: '2.png', cls: 'rotate8' },
  { src: '2.png', cls: 'rotate9' },
  { src: '2.png', cls: 'rotate10' },
  { src: '2.png', cls: 'rotate11' },
  { src: '2.png', cls: 'rotate12' },
  { src: '2.png', cls: 'rotate13' },
  { src: '2.png', cls: 'rotate14' },
  { src: '2.png', cls: 'rotate15' },
  { src: '2.png', cls: 'rotate16' },
  { src: '2.png', cls: 'rotate17' },
  { src: '2.png', cls: 'rotate18' },
  { src: '2.png', cls: 'rotate19' },
  { src: '2.png', cls: 'rotate20' },
  { src: '2.png', cls: 'rotate21' },
  { src: '2.png', cls: 'rotate22' },
  { src: '1.png', cls: 'rotate23' },
  { src: '1.png', cls: 'rotate24' },
  { src: '1.png', cls: 'rotate25' },
  { src: '1.png', cls: 'rotate26' },
  { src: '1.png', cls: 'rotate27' },
  { src: '1.png', cls: 'rotate28' },
];

export default function StargateLogo({ className = '' }: { className?: string }) {
  /* eslint-disable @next/next/no-img-element */
  return (
    <div className={`stargate-wrap ${className}`}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/stargate/stargate.css" precedence="low" />
      <div className="gate">
        <div className="container">
          {ROTATE_LAYERS.map((layer, i) => (
            <img
              key={i}
              src={`/stargate/${layer.src}`}
              alt={`${i + 1}`}
              className={layer.cls}
              loading={i < 4 ? 'eager' : 'lazy'}
              decoding={i < 4 ? 'sync' : 'async'}
            />
          ))}
          {/* Center logo — Z.gif s grayscale + contrast filtrem (dle originálu) */}
          <a
            className="center-logo"
            href="https://oasis.zionterranova.com"
            aria-label="Zion Terra Nova — Enter to Oasis"
          >
            <picture>
              <source srcSet="/stargate/Z.webp" type="image/webp" />
              <img
                src="/stargate/Z.gif"
                alt="Zion"
                style={{
                  filter: 'grayscale(100%) contrast(180%)',
                  boxShadow: '0 0 1px #000',
                  opacity: 0.6,
                }}
              />
            </picture>
          </a>
        </div>
        {/* Glyphs — mimo container, uvnitř gate (dle originálu) */}
        <div className="glyphs">
          {GLYPHS.map((g, i) => (
            <div key={i} className="glyph">{g}</div>
          ))}
        </div>
        {/* Chevrons — mimo container, uvnitř gate */}
        <div className="chevrons">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="chevron" />
          ))}
        </div>
        <div className="chevronInners">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="chevronInner" />
          ))}
        </div>
      </div>
    </div>
  );
}
