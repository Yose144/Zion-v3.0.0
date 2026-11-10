/**
 * Drobné efekty, které nejsou součástí fyziky: stříkající voda.
 *
 * Je to **pool**, ne `new` při každém záběru: 72 částic se recykluje, takže
 * smyčka nealokuje a GC nezpůsobuje záseky. Stejná pravidla jako u canvas
 * her v pouti — `update(dt)` nic nevytváří.
 *
 * Částice jsou čistá čísla (žádné three.js), takže se dají testovat v Node.
 */

export interface SplashParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Zbývající život (s); 0 = mrtvá. */
  life: number;
  /** Počáteční život (pro poměr velikosti). */
  max: number;
}

export const SPLASH_MAX = 72;
const GRAVITY = 9.8;

function dead(): SplashParticle {
  return { x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 };
}

export class SplashField {
  readonly particles: SplashParticle[] = [];
  private cursor = 0;

  constructor() {
    for (let index = 0; index < SPLASH_MAX; index++) this.particles.push(dead());
  }

  /**
   * Vystříkne `count` částic z bodu. `power` je 0..1 (síla záběru / pádu).
   * `spread` je úhel ve stupních, do kterého se stříká.
   */
  spawn(
    x: number,
    y: number,
    z: number,
    count: number,
    power = 0.6,
    spread = 360,
    seed = 1,
  ): void {
    const safeCount = Math.min(count, SPLASH_MAX);
    // deterministický „random“ — testy i hra se chovají stejně
    let state = (seed * 1664525 + 1013904223) >>> 0;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    for (let index = 0; index < safeCount; index++) {
      const particle = this.particles[this.cursor % SPLASH_MAX]!;
      this.cursor += 1;
      const angle = ((random() * spread - spread / 2) * Math.PI) / 180 - Math.PI / 2;
      const speed = 0.8 + random() * 2.4 * Math.max(0.2, power);
      particle.x = x + (random() - 0.5) * 0.5;
      particle.y = y + random() * 0.2;
      particle.z = z + (random() - 0.5) * 0.5;
      particle.vx = Math.cos(angle) * speed;
      particle.vz = Math.sin(angle) * speed;
      particle.vy = 1.4 + random() * 2.6 * Math.max(0.2, power);
      particle.max = 0.5 + random() * 0.6;
      particle.life = particle.max;
    }
  }

  /** Posun všech živých částic; mrtvé zůstanou pod hladinou. */
  update(dt: number): void {
    const step = Math.min(0.05, Math.max(0, dt));
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life -= step;
      particle.vy -= GRAVITY * step;
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.z += particle.vz * step;
      if (particle.life <= 0 || particle.y < -0.4) {
        particle.life = 0;
        particle.y = -100;
      }
    }
  }

  /** Kolik částic právě žije (pro testy a HUD). */
  alive(): number {
    let count = 0;
    for (const particle of this.particles) if (particle.life > 0) count += 1;
    return count;
  }
}
