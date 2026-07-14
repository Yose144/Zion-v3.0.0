// Prometheus-scraping clients for Free World / Issobella and other auxiliary services.

import { httpGet } from '../lib/client';
import { FREE_WORLD, ISSOBELLA, endpointUrl, type ServiceEndpoint } from '../config/services';

export interface PrometheusSnapshot {
  raw: string;
  metrics: Record<string, number | string>;
}

function parsePrometheus(text: string): Record<string, number | string> {
  const metrics: Record<string, number | string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const key = parts[0].replace(/\{[^}]*\}/, '');
      const value = parts[parts.length - 1];
      const num = Number(value);
      metrics[key] = Number.isNaN(num) ? value : num;
    }
  }
  return metrics;
}

export async function fetchPrometheusMetrics(ep: ServiceEndpoint): Promise<PrometheusSnapshot | null> {
  const raw = await httpGet<string>(endpointUrl(ep, ep.metricsPath ?? '/metrics'), 3000);
  if (raw === null) return null;
  const text = typeof raw === 'string' ? raw : String(raw);
  return { raw: text, metrics: parsePrometheus(text) };
}

export interface FreeWorldStats {
  ok: boolean;
  blocks_scanned: number;
  grants_pending: number;
  grants_approved: number;
  grants_disbursed: number;
  projects_active: number;
  total_accumulated_zion: number | string;
  total_disbursed_zion: number | string;
  error?: string;
}

export async function fetchFreeWorldStats(): Promise<FreeWorldStats | null> {
  const m = await fetchPrometheusMetrics(FREE_WORLD);
  if (!m) return null;
  return {
    ok: true,
    blocks_scanned: Number(m.metrics['zion_free_world_blocks_scanned'] || 0),
    grants_pending: Number(m.metrics['zion_free_world_grants_pending'] || 0),
    grants_approved: Number(m.metrics['zion_free_world_grants_approved'] || 0),
    grants_disbursed: Number(m.metrics['zion_free_world_grants_disbursed'] || 0),
    projects_active: Number(m.metrics['zion_free_world_projects_active'] || 0),
    total_accumulated_zion: Number(m.metrics['zion_free_world_total_accumulated_zion'] || 0),
    total_disbursed_zion: Number(m.metrics['zion_free_world_total_disbursed_zion'] || 0),
  };
}

export interface IssobellaStats {
  ok: boolean;
  blocks_scanned: number;
  missions_planning: number;
  missions_launched: number;
  missions_operational: number;
  observations_recorded: number;
  proposals_submitted: number;
  total_accumulated_zion: number | string;
  total_disbursed_zion: number | string;
  error?: string;
}

export async function fetchIssobellaStats(): Promise<IssobellaStats | null> {
  const m = await fetchPrometheusMetrics(ISSOBELLA);
  if (!m) return null;
  return {
    ok: true,
    blocks_scanned: Number(m.metrics['zion_issobella_blocks_scanned'] || 0),
    missions_planning: Number(m.metrics['zion_issobella_missions_planning'] || 0),
    missions_launched: Number(m.metrics['zion_issobella_missions_launched'] || 0),
    missions_operational: Number(m.metrics['zion_issobella_missions_operational'] || 0),
    observations_recorded: Number(m.metrics['zion_issobella_observations_recorded'] || 0),
    proposals_submitted: Number(m.metrics['zion_issobella_proposals_submitted'] || 0),
    total_accumulated_zion: Number(m.metrics['zion_issobella_total_accumulated_zion'] || 0),
    total_disbursed_zion: Number(m.metrics['zion_issobella_total_disbursed_zion'] || 0),
  };
}
