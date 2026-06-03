import { invoke } from "@tauri-apps/api/core";

export interface ServiceStatus {
  name: string;
  layer: string;
  state: string;
  pid: number | null;
  auto_restart: boolean;
  ports: Record<string, number>;
  description: string;
}

export async function getServices(): Promise<ServiceStatus[]> {
  return invoke("get_services");
}

export async function getOrchestratorStatus(): Promise<{
  timestamp: string;
  services: ServiceStatus[];
}> {
  return invoke("get_orchestrator_status");
}

export async function startService(service: string): Promise<string> {
  return invoke("start_service", { service });
}

export async function stopService(service: string): Promise<string> {
  return invoke("stop_service", { service });
}

export async function restartService(service: string): Promise<string> {
  return invoke("restart_service", { service });
}

export async function getSystemInfo(): Promise<{
  os: string;
  arch: string;
  version: string;
}> {
  return invoke("get_system_info");
}
