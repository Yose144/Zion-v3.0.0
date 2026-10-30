export interface WorldPoint {
  id: string;
  name: string;
  layer: number;
  location?: string;
  vibe?: string;
  summary?: string;
  galaxyPosition?: { x: number; y: number; z: number };
}

export function parseWorlds(payload: unknown): WorldPoint[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  const worlds: WorldPoint[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : '';
    if (!id) continue;
    const name = typeof rec.name === 'string' ? rec.name : id;
    const layer = typeof rec.layer === 'number' ? rec.layer : 4;
    const location = typeof rec.location === 'string' ? rec.location : undefined;
    const vibe = typeof rec.vibe === 'string' ? rec.vibe : undefined;
    const summary = typeof rec.summary === 'string' ? rec.summary : undefined;
    const gp = rec.galaxyPosition;
    let galaxyPosition: WorldPoint['galaxyPosition'];
    if (gp && typeof gp === 'object') {
      const p = gp as Record<string, unknown>;
      if (typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number') {
        galaxyPosition = { x: p.x, y: p.y, z: p.z };
      }
    }
    worlds.push({ id, name, layer, location, vibe, summary, galaxyPosition });
  }
  return worlds;
}

const LAYER_COLOR = ['#8a8a8a', '#fcd116', '#e41e2b', '#7ec8ff', '#066928', '#c084fc', '#f5f5f5'];

export function layerColor(layer: number): string {
  return LAYER_COLOR[layer] ?? '#fcd116';
}

/** Ring layout when the catalog has no galaxy coordinate. */
export function worldPosition(world: WorldPoint, index: number, total: number): [number, number, number] {
  if (world.galaxyPosition) {
    const g = world.galaxyPosition;
    return [g.x * 8, g.y * 4, g.z * 8];
  }
  const layer = Math.min(6, Math.max(1, world.layer || 1));
  const radius = 2.2 + layer * 1.15;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const y = (layer - 3.5) * 0.35;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}
