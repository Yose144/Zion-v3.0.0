// Direct Hiranyagarbha / Hiran inference HTTP API clients.

import { httpGet, httpPost } from '../lib/client';
import { HIRANYAGARBHA, HIRAN_INFERENCE, endpointUrl, type ServiceEndpoint } from '../config/services';

export interface HiranHealth {
  status?: string;
  ok?: boolean;
  version?: string;
  uptime_seconds?: number;
  backend?: string;
  model?: string;
  agents?: number;
  tasks?: number;
  error?: string;
}

export interface HiranAgent {
  id: string;
  name?: string;
  status?: string;
  capabilities?: string[];
  consciousness?: number;
}

export interface HiranNclJob {
  id: string;
  status?: string;
  type?: string;
  priority?: number;
  created_at?: number;
}

function orchUrl(path: string, ep: ServiceEndpoint = HIRANYAGARBHA): string {
  return endpointUrl(ep, path);
}

function hiranUrl(path: string, ep: ServiceEndpoint = HIRAN_INFERENCE): string {
  return endpointUrl(ep, path);
}

export async function checkOrchestratorHealth(ep: ServiceEndpoint = HIRANYAGARBHA): Promise<boolean> {
  const h = await httpGet<HiranHealth>(orchUrl('/health', ep), 2000);
  return !!h && (h.status === 'ok' || h.ok === true);
}

export async function checkHiranInferenceHealth(ep: ServiceEndpoint = HIRAN_INFERENCE): Promise<boolean> {
  const h = await httpGet<HiranHealth>(hiranUrl('/health', ep), 2000);
  return !!h && (h.status === 'ok' || h.ok === true);
}

export async function fetchOrchestratorStatus(ep: ServiceEndpoint = HIRANYAGARBHA): Promise<HiranHealth | null> {
  return httpGet<HiranHealth>(orchUrl('/orchestrator/status', ep), 3000);
}

export async function fetchAgents(ep: ServiceEndpoint = HIRANYAGARBHA): Promise<HiranAgent[] | null> {
  const res = await httpGet<{ success: boolean; data?: { agents: HiranAgent[] } }>(orchUrl('/api/agents', ep), 3000);
  return res?.data?.agents ?? null;
}

export async function fetchAgentCapabilities(id: string, ep: ServiceEndpoint = HIRANYAGARBHA): Promise<unknown | null> {
  return httpGet<unknown>(orchUrl(`/api/agents/${encodeURIComponent(id)}/capabilities`, ep), 3000);
}

export async function fetchNclJobs(ep: ServiceEndpoint = HIRANYAGARBHA): Promise<HiranNclJob[] | null> {
  const res = await httpGet<{ success: boolean; data?: { jobs: HiranNclJob[] } }>(orchUrl('/api/ncl/jobs', ep), 3000);
  return res?.data?.jobs ?? null;
}

export async function chatWithHiran(message: string, ep: ServiceEndpoint = HIRAN_INFERENCE): Promise<{ response?: string; error?: string } | null> {
  return httpPost<{ response?: string; error?: string }>(hiranUrl('/chat', ep), { message }, 10000);
}

// ── Dashboard-style agent telemetry wrappers ────────────────────────────────

export interface AgentStatus {
  online: boolean;
  version?: string;
  uptime_seconds?: number;
  rigs_total?: number;
  rigs_online?: number;
  orchestrator_alive?: boolean;
  inference_alive?: boolean;
  backend?: string;
  model?: string;
  agents?: number;
  tasks?: number;
}

export async function fetchAgentStatus(): Promise<AgentStatus | null> {
  const [orch, hiran] = await Promise.all([
    checkOrchestratorHealth().catch(() => false),
    checkHiranInferenceHealth().catch(() => false),
  ]);
  const status = await fetchOrchestratorStatus().catch(() => null);
  return {
    online: orch || hiran,
    orchestrator_alive: orch,
    inference_alive: hiran,
    version: status?.version ?? '—',
    uptime_seconds: status?.uptime_seconds,
    backend: status?.backend ?? '—',
    model: status?.model ?? '—',
    agents: status?.agents ?? 0,
    tasks: status?.tasks ?? 0,
    rigs_total: 0,
    rigs_online: 0,
  };
}

export async function fetchAgentTelemetry(): Promise<Record<string, unknown> | null> {
  const s = await fetchOrchestratorStatus().catch(() => null);
  return s ? (s as unknown as Record<string, unknown>) : null;
}

export async function fetchAgentNodes(): Promise<{ nodes?: unknown[] } | null> {
  const agents = await fetchAgents().catch(() => null);
  if (!agents) return null;
  return { nodes: agents.map((a) => ({ ...a, online: a.status === 'online' })) };
}

export async function fetchAgentRewards(): Promise<Record<string, unknown> | null> {
  return null;
}

export async function fetchAgentGpu(): Promise<Record<string, unknown> | null> {
  return null;
}
