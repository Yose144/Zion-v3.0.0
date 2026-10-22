/**
 * Port: Clock.
 * Engine-agnostic time source. Adapters provide wall-clock, game-time, or UE5 tick.
 */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};
