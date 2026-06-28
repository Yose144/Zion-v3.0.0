'use client';

/**
 * Stargate — přesná replika z newearth.cz
 * 28 rotujících vrstev (2.png x22 + 1.png x6)
 * 39 glyphs (A-Z, a-m)
 * 9 chevrons + 9 chevronInners
 * Center logo (Z.png)
 * Metalický kruh (radial-gradient)
 *
 * Inspirováno public_html/stargate.css z newearth.cz
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
  return (
    <div className={`stargate-wrap ${className}`}>
      <link rel="stylesheet" href="/stargate/stargate.css" />
      <div className="gate">
        <div className="container">
          {ROTATE_LAYERS.map((layer, i) => (
            <img
              key={i}
              src={`/stargate/${layer.src}`}
              alt={`${i + 1}`}
              className={layer.cls}
              loading={i < 4 ? 'eager' : 'lazy'}
            />
          ))}
          <a
            className="center-logo"
            href="/"
            aria-label="Zion Terra Nova"
          >
            <img src="/stargate/Z.png" alt="Zion" />
          </a>
          <div className="glyphs">
            {GLYPHS.map((g, i) => (
              <div key={i} className="glyph">{g}</div>
            ))}
          </div>
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
    </div>
  );
}
