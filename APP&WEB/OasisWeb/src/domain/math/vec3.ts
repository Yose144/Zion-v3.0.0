/**
 * Engine-agnostic 3D vector. Pure data, no rendering.
 * Designed for easy hand-port to C++/Blueprint (UE5).
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
