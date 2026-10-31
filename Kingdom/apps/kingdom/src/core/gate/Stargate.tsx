import './stargate.css';

/**
 * Stargate — převzato 1:1 z `apps/IntroPage/public/stargate/`.
 *
 * 28 soustředných prstenců (22 chevronů `2.png` + 6 Śrí jantra `1.png`) a kruh
 * glyfů A–Z a–m. Všechno je čisté CSS (rotace + opacity), žádný canvas ani JS —
 * do prohlížeče jde jen markup a jedna statická stylesheeta.
 *
 * `aria-hidden`: je to dekorace. Přístupnost nese nadpis a CTA nad bránou.
 */
const CHEVRONS = Array.from({ length: 22 }, (_, index) => index + 1);
const YANTRA = [23, 24, 25, 26, 27, 28];
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklm'.split('');

export function Stargate() {
  return (
    <div className="k-stargate" aria-hidden="true">
      <div className="gate">
        <div className="container">
          {CHEVRONS.map((index) => (
            <img
              key={`chevron-${index}`}
              src="/stargate/2.png"
              alt=""
              className={`rotate${index}`}
              width={737}
              height={737}
              decoding="async"
            />
          ))}

          {YANTRA.map((index) => (
            <img
              key={`yantra-${index}`}
              src="/stargate/1.png"
              alt=""
              className={`rotate${index}`}
              width={700}
              height={700}
              decoding="async"
            />
          ))}
        </div>

        <div className="glyphs">
          {GLYPHS.map((glyph) => (
            <div key={glyph} className="glyph">
              {glyph}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
