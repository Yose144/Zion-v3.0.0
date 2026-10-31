import './stargate.css';

/**
 * Stargate — **přesná replika** brány z newearth.cz.
 *
 * Zdroj: `apps/website-v2.9/src/components/StargateLogo.tsx` (live na
 * `app.zionterranova.com/doge-vs-zion`) + `public/stargate/stargate.css`.
 *
 * Struktura podle originálu:
 *   .stargate-wrap
 *     .gate
 *       .container
 *         img.rotate1..28   22 chevronových prstenců + 6 Śrí jantra
 *         a.center-logo     Z.webp / Z.gif
 *       .glyphs            52 glyfů (A–Z, a–z)
 *       .chevrons          9 vnějších chevronů
 *       .chevronInners     9 vnitřních chevronů
 *
 * Všechno je CSS — žádný canvas, žádný JS v prohlížeči. `aria-hidden`,
 * protože brána je dekorace; význam nese nadpis a CTA nad ní.
 */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

const ROTATE_LAYERS: Array<{ src: string; cls: string }> = [
  ...Array.from({ length: 22 }, (_, index) => ({ src: '2.png', cls: `rotate${index + 1}` })),
  ...Array.from({ length: 6 }, (_, index) => ({ src: '1.png', cls: `rotate${index + 23}` })),
];

export function Stargate() {
  return (
    <div className="stargate-wrap" aria-hidden="true">
      <div className="gate">
        <div className="container">
          {ROTATE_LAYERS.map((layer, index) => (
            <img
              key={layer.cls}
              src={`/stargate/${layer.src}`}
              alt=""
              className={layer.cls}
              width={737}
              height={737}
              loading={index < 4 ? 'eager' : 'lazy'}
              decoding={index < 4 ? 'sync' : 'async'}
            />
          ))}

          <a className="center-logo" href="https://oasis.zionterranova.com" aria-label="ZION — Oasis">
            <picture>
              <source srcSet="/stargate/Z.webp" type="image/webp" />
              <img
                src="/stargate/Z.gif"
                alt=""
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                style={{ filter: 'grayscale(100%) contrast(180%)', opacity: 0.6 }}
              />
            </picture>
          </a>
        </div>

        <div className="glyphs">
          {GLYPHS.map((glyph) => (
            <div key={glyph} className="glyph">
              {glyph}
            </div>
          ))}
        </div>

        <div className="chevrons">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="chevron" />
          ))}
        </div>

        <div className="chevronInners">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="chevronInner" />
          ))}
        </div>
      </div>
    </div>
  );
}
