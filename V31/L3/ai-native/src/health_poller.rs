//! # 🩺 Hiran v2.4 Maestro — Health Poller
//!
//! Async polling of all 26 Zion ecosystem services. Produces a [`HealthMatrix`]
//! — a snapshot of service health used by the Maestro for routing decisions,
//! the Intent Router for fallback, and the dashboard for visualization.
//!
//! ## Architecture
//! ```text
//! HealthPoller ──► tokio::spawn(26 concurrent probes)
//!                  ├── L1:  node1 RPC/P2P/metrics, node2 RPC/P2P/metrics, pool stratum/stats
//!                  ├── L2:  bridge, dao, atomic-swap, dex
//!                  ├── L3:  warp, ai-native, hiran-orchestrator, hiran-inference
//!                  ├── L4:  oasis, oasis-metrics
//!                  ├── L5:  free-world
//!                  ├── L6:  issobella
//!                  └── Sys: dashboard, web-next, nginx-http, nginx-https, prometheus, docker
//!                  └── join_all → HealthMatrix
//! ```

use crate::tool_registry::Layer;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::timeout;

// ============================================================================
// Health status
// ============================================================================

/// Health status of a single service.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HealthStatus {
    /// Service responded OK within timeout.
    Healthy,
    /// Service responded but slowly (> 2s) or with non-200 status.
    Degraded,
    /// Service did not respond, connection refused, or timeout.
    Down,
    /// Health check not yet performed.
    Unknown,
}

impl HealthStatus {
    pub fn is_healthy(self) -> bool {
        matches!(self, HealthStatus::Healthy)
    }
    pub fn is_down(self) -> bool {
        matches!(self, HealthStatus::Down)
    }
}

impl std::fmt::Display for HealthStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Healthy => write!(f, "HEALTHY"),
            Self::Degraded => write!(f, "DEGRADED"),
            Self::Down => write!(f, "DOWN"),
            Self::Unknown => write!(f, "UNKNOWN"),
        }
    }
}

/// Health report for a single service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealth {
    /// Service name (e.g. "node1-rpc", "bridge").
    pub name: String,
    /// Layer the service belongs to.
    pub layer: Layer,
    /// Endpoint URL probed.
    pub endpoint: String,
    /// Result of the probe.
    pub status: HealthStatus,
    /// Response time in milliseconds (0 if down).
    pub latency_ms: u64,
    /// HTTP status code returned (0 if no response).
    pub http_status: u16,
    /// Error message if down/degraded.
    pub error: Option<String>,
    /// When the probe was performed.
    pub checked_at: DateTime<Utc>,
}

impl ServiceHealth {
    fn unknown(name: &str, layer: Layer, endpoint: &str) -> Self {
        Self {
            name: name.to_string(),
            layer,
            endpoint: endpoint.to_string(),
            status: HealthStatus::Unknown,
            latency_ms: 0,
            http_status: 0,
            error: None,
            checked_at: Utc::now(),
        }
    }
}

/// Snapshot of all service health — the "health matrix".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthMatrix {
    /// All service health reports.
    pub services: Vec<ServiceHealth>,
    /// When the matrix was assembled.
    pub timestamp: DateTime<Utc>,
    /// Total polling duration (ms).
    pub total_poll_ms: u64,
}

impl HealthMatrix {
    /// Number of services in each status.
    pub fn counts(&self) -> (usize, usize, usize, usize) {
        let mut h = 0;
        let mut d = 0;
        let mut o = 0;
        let mut u = 0;
        for s in &self.services {
            match s.status {
                HealthStatus::Healthy => h += 1,
                HealthStatus::Degraded => d += 1,
                HealthStatus::Down => o += 1,
                HealthStatus::Unknown => u += 1,
            }
        }
        (h, d, o, u)
    }

    /// True if all services are healthy.
    pub fn all_healthy(&self) -> bool {
        self.services.iter().all(|s| s.status.is_healthy())
    }

    /// True if any service is down.
    pub fn any_down(&self) -> bool {
        self.services.iter().any(|s| s.status.is_down())
    }

    /// Services that are down.
    pub fn down_services(&self) -> Vec<&ServiceHealth> {
        self.services
            .iter()
            .filter(|s| s.status.is_down())
            .collect()
    }

    /// Services in a specific layer.
    pub fn layer(&self, layer: Layer) -> Vec<&ServiceHealth> {
        self.services.iter().filter(|s| s.layer == layer).collect()
    }

    /// Get a service by name.
    pub fn get(&self, name: &str) -> Option<&ServiceHealth> {
        self.services.iter().find(|s| s.name == name)
    }

    /// Overall system status — Healthy if all healthy, Degraded if any degraded, Down if any down.
    pub fn overall(&self) -> HealthStatus {
        let (h, d, o, _u) = self.counts();
        if o > 0 {
            HealthStatus::Down
        } else if d > 0 || h < self.services.len() {
            HealthStatus::Degraded
        } else {
            HealthStatus::Healthy
        }
    }
}

// ============================================================================
// Service registry — the 26 Zion ecosystem services
// ============================================================================

/// A service to probe.
#[derive(Debug, Clone)]
pub struct ServiceProbe {
    pub name: &'static str,
    pub layer: Layer,
    pub endpoint: &'static str,
    /// HTTP path to probe (appended to endpoint). Defaults to "/health" if empty.
    pub health_path: &'static str,
    /// Probe method: HTTP GET (default) or TCP connect (for non-HTTP services).
    pub method: ProbeMethod,
}

/// How to probe a service.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProbeMethod {
    /// HTTP GET to endpoint + health_path. Healthy if 2xx.
    HttpGet,
    /// TCP connect to endpoint host:port. Healthy if connection succeeds.
    /// `health_path` is ignored for TCP probes.
    TcpConnect,
}

/// All Zion ecosystem services (Edge server 62.171.141.136 topology).
///
/// Sources: StatusV3.md service table, dashboard app.py SERVICE_REGISTRY_EDGE,
/// backup-edge.sh, docker-compose.yml. Covers L1–L6 + System + Infra.
pub const SERVICES: &[ServiceProbe] = &[
    // ── L1: Consensus ──────────────────────────────────────────────────────────
    ServiceProbe {
        name: "node1-rpc",
        layer: Layer::L1,
        endpoint: "http://127.0.0.1:9443",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "node1-p2p",
        layer: Layer::L1,
        endpoint: "127.0.0.1:8333",
        health_path: "",
        method: ProbeMethod::TcpConnect,
    },
    ServiceProbe {
        name: "node1-metrics",
        layer: Layer::L1,
        endpoint: "http://127.0.0.1:9100",
        health_path: "/metrics",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "node2-rpc",
        layer: Layer::L1,
        endpoint: "http://127.0.0.1:8448",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "node2-p2p",
        layer: Layer::L1,
        endpoint: "127.0.0.1:8334",
        health_path: "",
        method: ProbeMethod::TcpConnect,
    },
    ServiceProbe {
        name: "node2-metrics",
        layer: Layer::L1,
        endpoint: "http://127.0.0.1:9116",
        health_path: "/metrics",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "pool-stratum",
        layer: Layer::L1,
        endpoint: "127.0.0.1:8444",
        health_path: "",
        method: ProbeMethod::TcpConnect,
    },
    ServiceProbe {
        name: "pool-stats",
        layer: Layer::L1,
        endpoint: "http://127.0.0.1:8455",
        health_path: "/stats",
        method: ProbeMethod::HttpGet,
    },
    // ── L2: Bridge / DAO / Swap / DEX ───────────────────────────────────────────
    ServiceProbe {
        name: "bridge",
        layer: Layer::L2,
        endpoint: "http://127.0.0.1:9101",
        health_path: "/metrics",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "dao",
        layer: Layer::L2,
        endpoint: "http://127.0.0.1:8450",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "atomic-swap",
        layer: Layer::L2,
        endpoint: "http://127.0.0.1:8452",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "dex",
        layer: Layer::L2,
        endpoint: "http://127.0.0.1:8454",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    // ── L3: WARP / NCL / AI ─────────────────────────────────────────────────────
    ServiceProbe {
        name: "warp",
        layer: Layer::L3,
        endpoint: "http://127.0.0.1:8453",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "ai-native",
        layer: Layer::L3,
        endpoint: "http://127.0.0.1:8001",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "hiran-orchestrator",
        layer: Layer::L3,
        endpoint: "http://127.0.0.1:8004",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "hiran-inference",
        layer: Layer::L3,
        endpoint: "http://127.0.0.1:8002",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    // ── L4: OASIS ───────────────────────────────────────────────────────────────
    ServiceProbe {
        name: "oasis",
        layer: Layer::L4,
        endpoint: "http://127.0.0.1:8094",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "oasis-metrics",
        layer: Layer::L4,
        endpoint: "http://127.0.0.1:9102",
        health_path: "/metrics",
        method: ProbeMethod::HttpGet,
    },
    // ── L5: Free World ──────────────────────────────────────────────────────────
    ServiceProbe {
        name: "free-world",
        layer: Layer::L5,
        endpoint: "http://127.0.0.1:8095",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    // ── L6: Issobella ───────────────────────────────────────────────────────────
    ServiceProbe {
        name: "issobella",
        layer: Layer::L6,
        endpoint: "http://127.0.0.1:8096",
        health_path: "/health",
        method: ProbeMethod::HttpGet,
    },
    // ── System / Infra ──────────────────────────────────────────────────────────
    ServiceProbe {
        name: "dashboard",
        layer: Layer::System,
        endpoint: "http://127.0.0.1:8766",
        health_path: "/api/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "web-next",
        layer: Layer::System,
        endpoint: "http://127.0.0.1:3000",
        health_path: "/api/health",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "nginx-http",
        layer: Layer::System,
        endpoint: "http://127.0.0.1:80",
        health_path: "/",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "nginx-https",
        layer: Layer::System,
        endpoint: "https://127.0.0.1:443",
        health_path: "/",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "prometheus",
        layer: Layer::System,
        endpoint: "http://127.0.0.1:9090",
        health_path: "/-/healthy",
        method: ProbeMethod::HttpGet,
    },
    ServiceProbe {
        name: "docker",
        layer: Layer::System,
        endpoint: "http://127.0.0.1:2375",
        health_path: "/v5/containers/json?limit=1",
        method: ProbeMethod::HttpGet,
    },
];

// ============================================================================
// Health Poller
// ============================================================================

/// Configuration for the poller.
#[derive(Debug, Clone)]
pub struct PollerConfig {
    /// Per-probe timeout (default 3s).
    pub probe_timeout: Duration,
    /// Latency threshold for "degraded" (default 2s).
    pub degraded_threshold: Duration,
    /// HTTP client timeout (default 5s).
    pub client_timeout: Duration,
}

impl Default for PollerConfig {
    fn default() -> Self {
        Self {
            probe_timeout: Duration::from_secs(3),
            degraded_threshold: Duration::from_secs(2),
            client_timeout: Duration::from_secs(5),
        }
    }
}

/// Async health poller — probes all 26 services concurrently.
pub struct HealthPoller {
    config: PollerConfig,
    client: reqwest::Client,
}

impl HealthPoller {
    pub fn new(config: PollerConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(config.client_timeout)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self { config, client }
    }

    pub fn with_default() -> Self {
        Self::new(PollerConfig::default())
    }

    /// Probe all services concurrently. Returns the assembled health matrix.
    pub async fn poll_all(&self) -> HealthMatrix {
        let start = std::time::Instant::now();
        let (tx, mut rx) = mpsc::channel(SERVICES.len());

        for probe in SERVICES {
            let tx = tx.clone();
            let client = self.client.clone();
            let probe_timeout = self.config.probe_timeout;
            let degraded_threshold = self.config.degraded_threshold;
            let probe = probe.clone();
            tokio::spawn(async move {
                let health = probe_one(&client, &probe, probe_timeout, degraded_threshold).await;
                let _ = tx.send(health).await;
            });
        }
        drop(tx);

        let mut services: Vec<ServiceHealth> = Vec::with_capacity(SERVICES.len());
        while let Some(h) = rx.recv().await {
            services.push(h);
        }
        // Sort by layer then name for stable display
        services.sort_by(|a, b| a.layer.cmp(&b.layer).then_with(|| a.name.cmp(&b.name)));
        HealthMatrix {
            services,
            timestamp: Utc::now(),
            total_poll_ms: start.elapsed().as_millis() as u64,
        }
    }

    /// Probe a single service by name.
    pub async fn poll_one(&self, name: &str) -> Option<ServiceHealth> {
        let probe = SERVICES.iter().find(|p| p.name == name)?;
        Some(
            probe_one(
                &self.client,
                probe,
                self.config.probe_timeout,
                self.config.degraded_threshold,
            )
            .await,
        )
    }

    /// Probe all services in a specific layer.
    pub async fn poll_layer(&self, layer: Layer) -> Vec<ServiceHealth> {
        let probes: Vec<_> = SERVICES
            .iter()
            .filter(|p| p.layer == layer)
            .cloned()
            .collect();
        let mut tasks = Vec::with_capacity(probes.len());
        for probe in probes {
            let client = self.client.clone();
            let t = self.config.probe_timeout;
            let d = self.config.degraded_threshold;
            tasks.push(tokio::spawn(async move {
                probe_one(&client, &probe, t, d).await
            }));
        }
        let mut out = Vec::with_capacity(tasks.len());
        for t in tasks {
            if let Ok(h) = t.await {
                out.push(h);
            }
        }
        out
    }
}

/// Probe a single service endpoint.
async fn probe_one(
    client: &reqwest::Client,
    probe: &ServiceProbe,
    probe_timeout: Duration,
    degraded_threshold: Duration,
) -> ServiceHealth {
    match probe.method {
        ProbeMethod::HttpGet => probe_http(client, probe, probe_timeout, degraded_threshold).await,
        ProbeMethod::TcpConnect => probe_tcp(probe, probe_timeout).await,
    }
}

/// HTTP GET probe.
async fn probe_http(
    client: &reqwest::Client,
    probe: &ServiceProbe,
    probe_timeout: Duration,
    degraded_threshold: Duration,
) -> ServiceHealth {
    let url = format!("{}{}", probe.endpoint, probe.health_path);
    let mut health = ServiceHealth::unknown(probe.name, probe.layer, &url);
    health.endpoint = url.clone();

    let start = std::time::Instant::now();
    let result = timeout(probe_timeout, client.get(&url).send()).await;

    health.latency_ms = start.elapsed().as_millis() as u64;
    health.checked_at = Utc::now();

    match result {
        Ok(Ok(resp)) => {
            health.http_status = resp.status().as_u16();
            if resp.status().is_success() {
                if start.elapsed() > degraded_threshold {
                    health.status = HealthStatus::Degraded;
                    health.error = Some(format!("slow response: {}ms", health.latency_ms));
                } else {
                    health.status = HealthStatus::Healthy;
                }
            } else {
                health.status = HealthStatus::Degraded;
                health.error = Some(format!("HTTP {}", resp.status()));
            }
        }
        Ok(Err(e)) => {
            health.status = HealthStatus::Down;
            health.error = Some(e.to_string());
        }
        Err(_) => {
            health.status = HealthStatus::Down;
            health.error = Some(format!("timeout after {}ms", probe_timeout.as_millis()));
        }
    }
    health
}

/// TCP connect probe — for non-HTTP services (Stratum, P2P).
async fn probe_tcp(probe: &ServiceProbe, probe_timeout: Duration) -> ServiceHealth {
    // endpoint is "host:port" (no scheme)
    let mut health = ServiceHealth::unknown(probe.name, probe.layer, probe.endpoint);
    health.endpoint = probe.endpoint.to_string();

    let start = std::time::Instant::now();
    let result = timeout(
        probe_timeout,
        tokio::net::TcpStream::connect(probe.endpoint),
    )
    .await;

    health.latency_ms = start.elapsed().as_millis() as u64;
    health.checked_at = Utc::now();

    match result {
        Ok(Ok(_stream)) => {
            health.status = HealthStatus::Healthy;
            health.http_status = 0; // TCP — no HTTP status
        }
        Ok(Err(e)) => {
            health.status = HealthStatus::Down;
            health.error = Some(e.to_string());
        }
        Err(_) => {
            health.status = HealthStatus::Down;
            health.error = Some(format!("timeout after {}ms", probe_timeout.as_millis()));
        }
    }
    health
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ── Service registry ───────────────────────────────────────────────────────

    #[test]
    fn test_services_count_is_26() {
        assert_eq!(SERVICES.len(), 26, "Should have exactly 26 services");
    }

    #[test]
    fn test_services_cover_all_layers() {
        let layers: Vec<_> = SERVICES.iter().map(|s| s.layer).collect();
        assert!(layers.contains(&Layer::L1));
        assert!(layers.contains(&Layer::L2));
        assert!(layers.contains(&Layer::L3));
        assert!(layers.contains(&Layer::L4));
        assert!(layers.contains(&Layer::L5));
        assert!(layers.contains(&Layer::L6));
        assert!(layers.contains(&Layer::System));
    }

    #[test]
    fn test_services_unique_names() {
        let mut names: Vec<_> = SERVICES.iter().map(|s| s.name).collect();
        names.sort();
        let before = names.len();
        names.dedup();
        assert_eq!(names.len(), before, "Service names should be unique");
    }

    #[test]
    fn test_service_lookup() {
        assert!(SERVICES.iter().any(|s| s.name == "node1-rpc"));
        assert!(SERVICES.iter().any(|s| s.name == "node2-rpc"));
        assert!(SERVICES.iter().any(|s| s.name == "pool-stratum"));
        assert!(SERVICES.iter().any(|s| s.name == "bridge"));
        assert!(SERVICES.iter().any(|s| s.name == "dashboard"));
        assert!(SERVICES.iter().any(|s| s.name == "nginx-http"));
        assert!(SERVICES.iter().any(|s| s.name == "prometheus"));
        assert!(!SERVICES.iter().any(|s| s.name == "nonexistent"));
    }

    #[test]
    fn test_layer_distribution() {
        let l1 = SERVICES.iter().filter(|s| s.layer == Layer::L1).count();
        let l2 = SERVICES.iter().filter(|s| s.layer == Layer::L2).count();
        let l3 = SERVICES.iter().filter(|s| s.layer == Layer::L3).count();
        let l4 = SERVICES.iter().filter(|s| s.layer == Layer::L4).count();
        let l5 = SERVICES.iter().filter(|s| s.layer == Layer::L5).count();
        let l6 = SERVICES.iter().filter(|s| s.layer == Layer::L6).count();
        let sys = SERVICES.iter().filter(|s| s.layer == Layer::System).count();
        assert_eq!(
            l1, 8,
            "L1 should have 8 services (node1×3, node2×3, pool×2)"
        );
        assert_eq!(l2, 4, "L2 should have 4 services (bridge, dao, swap, dex)");
        assert_eq!(
            l3, 4,
            "L3 should have 4 services (warp, ai-native, hiran×2)"
        );
        assert_eq!(l4, 2, "L4 should have 2 services (oasis, oasis-metrics)");
        assert_eq!(l5, 1, "L5 should have 1 service (free-world)");
        assert_eq!(l6, 1, "L6 should have 1 service (issobella)");
        assert_eq!(
            sys, 6,
            "System should have 6 services (dashboard, web, nginx×2, prometheus, docker)"
        );
    }

    #[test]
    fn test_probe_methods() {
        // TCP probes: P2P + stratum
        let tcp: Vec<_> = SERVICES
            .iter()
            .filter(|s| s.method == ProbeMethod::TcpConnect)
            .collect();
        assert!(tcp.iter().any(|s| s.name == "node1-p2p"));
        assert!(tcp.iter().any(|s| s.name == "node2-p2p"));
        assert!(tcp.iter().any(|s| s.name == "pool-stratum"));
        // HTTP probes: everything else
        let http: Vec<_> = SERVICES
            .iter()
            .filter(|s| s.method == ProbeMethod::HttpGet)
            .collect();
        assert!(http.iter().any(|s| s.name == "node1-rpc"));
        assert!(http.iter().any(|s| s.name == "dashboard"));
    }

    // ── HealthStatus ───────────────────────────────────────────────────────────

    #[test]
    fn test_health_status_predicates() {
        assert!(HealthStatus::Healthy.is_healthy());
        assert!(!HealthStatus::Degraded.is_healthy());
        assert!(HealthStatus::Down.is_down());
        assert!(!HealthStatus::Healthy.is_down());
    }

    #[test]
    fn test_health_status_display() {
        assert_eq!(format!("{}", HealthStatus::Healthy), "HEALTHY");
        assert_eq!(format!("{}", HealthStatus::Degraded), "DEGRADED");
        assert_eq!(format!("{}", HealthStatus::Down), "DOWN");
        assert_eq!(format!("{}", HealthStatus::Unknown), "UNKNOWN");
    }

    // ── HealthMatrix ───────────────────────────────────────────────────────────

    fn sample_matrix() -> HealthMatrix {
        HealthMatrix {
            services: vec![
                ServiceHealth {
                    name: "node-rpc".into(),
                    layer: Layer::L1,
                    endpoint: "http://x".into(),
                    status: HealthStatus::Healthy,
                    latency_ms: 50,
                    http_status: 200,
                    error: None,
                    checked_at: Utc::now(),
                },
                ServiceHealth {
                    name: "bridge".into(),
                    layer: Layer::L2,
                    endpoint: "http://x".into(),
                    status: HealthStatus::Down,
                    latency_ms: 0,
                    http_status: 0,
                    error: Some("conn refused".into()),
                    checked_at: Utc::now(),
                },
                ServiceHealth {
                    name: "dao".into(),
                    layer: Layer::L2,
                    endpoint: "http://x".into(),
                    status: HealthStatus::Degraded,
                    latency_ms: 2500,
                    http_status: 200,
                    error: Some("slow".into()),
                    checked_at: Utc::now(),
                },
            ],
            timestamp: Utc::now(),
            total_poll_ms: 3000,
        }
    }

    #[test]
    fn test_matrix_counts() {
        let m = sample_matrix();
        let (h, d, o, u) = m.counts();
        assert_eq!(h, 1);
        assert_eq!(d, 1);
        assert_eq!(o, 1);
        assert_eq!(u, 0);
    }

    #[test]
    fn test_matrix_all_healthy() {
        let m = sample_matrix();
        assert!(!m.all_healthy());
        let mut m2 = m.clone();
        for s in &mut m2.services {
            s.status = HealthStatus::Healthy;
        }
        assert!(m2.all_healthy());
    }

    #[test]
    fn test_matrix_any_down() {
        let m = sample_matrix();
        assert!(m.any_down());
    }

    #[test]
    fn test_matrix_down_services() {
        let m = sample_matrix();
        let down = m.down_services();
        assert_eq!(down.len(), 1);
        assert_eq!(down[0].name, "bridge");
    }

    #[test]
    fn test_matrix_layer_filter() {
        let m = sample_matrix();
        let l2 = m.layer(Layer::L2);
        assert_eq!(l2.len(), 2);
        let l1 = m.layer(Layer::L1);
        assert_eq!(l1.len(), 1);
    }

    #[test]
    fn test_matrix_get() {
        let m = sample_matrix();
        assert!(m.get("node-rpc").is_some());
        assert!(m.get("nonexistent").is_none());
    }

    #[test]
    fn test_matrix_overall() {
        let m = sample_matrix();
        assert_eq!(m.overall(), HealthStatus::Down, "Any down → Down overall");
        let mut m2 = m.clone();
        for s in &mut m2.services {
            s.status = HealthStatus::Healthy;
        }
        assert_eq!(m2.overall(), HealthStatus::Healthy);
        let mut m3 = m.clone();
        for s in &mut m3.services {
            if s.status == HealthStatus::Down {
                // make it degraded instead
            }
        }
        // Manually construct a degraded-only matrix
        let m_degraded = HealthMatrix {
            services: vec![ServiceHealth {
                name: "x".into(),
                layer: Layer::L1,
                endpoint: "x".into(),
                status: HealthStatus::Degraded,
                latency_ms: 2500,
                http_status: 200,
                error: None,
                checked_at: Utc::now(),
            }],
            timestamp: Utc::now(),
            total_poll_ms: 100,
        };
        assert_eq!(m_degraded.overall(), HealthStatus::Degraded);
        let _ = m3; // suppress unused
    }

    // ── PollerConfig ───────────────────────────────────────────────────────────

    #[test]
    fn test_poller_config_default() {
        let c = PollerConfig::default();
        assert_eq!(c.probe_timeout, Duration::from_secs(3));
        assert_eq!(c.degraded_threshold, Duration::from_secs(2));
        assert_eq!(c.client_timeout, Duration::from_secs(5));
    }

    #[test]
    fn test_poller_construction() {
        let _p = HealthPoller::with_default();
        let _p2 = HealthPoller::new(PollerConfig {
            probe_timeout: Duration::from_secs(1),
            degraded_threshold: Duration::from_millis(500),
            client_timeout: Duration::from_secs(2),
        });
    }

    // ── Async poll (no live services — should all be Down) ─────────────────────

    #[tokio::test]
    async fn test_poll_all_no_live_services() {
        // No services running on this machine during tests — all should be Down
        // (or Degraded if something happens to be on those ports).
        let poller = HealthPoller::with_default();
        let matrix = poller.poll_all().await;
        assert_eq!(matrix.services.len(), 26);
        // We don't strictly assert all down — dev machines might have something
        // on 80/443 etc. Just check structure.
        let (h, d, o, u) = matrix.counts();
        assert_eq!(h + d + o + u, 26);
        assert!(matrix.total_poll_ms > 0);
    }

    #[tokio::test]
    async fn test_poll_one_unknown() {
        let poller = HealthPoller::with_default();
        let result = poller.poll_one("nonexistent").await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_poll_one_known_http() {
        let poller = HealthPoller::with_default();
        let result = poller.poll_one("node1-rpc").await;
        assert!(result.is_some());
        let h = result.unwrap();
        assert_eq!(h.name, "node1-rpc");
        assert_eq!(h.layer, Layer::L1);
        // Something may or may not be listening — just check structure
        assert!(matches!(
            h.status,
            HealthStatus::Healthy | HealthStatus::Down | HealthStatus::Degraded
        ));
    }

    #[tokio::test]
    async fn test_poll_one_known_tcp() {
        let poller = HealthPoller::with_default();
        let result = poller.poll_one("node1-p2p").await;
        assert!(result.is_some());
        let h = result.unwrap();
        assert_eq!(h.name, "node1-p2p");
        assert_eq!(h.layer, Layer::L1);
        // Something may or may not be listening on 8333 — just check structure
        assert!(matches!(
            h.status,
            HealthStatus::Healthy | HealthStatus::Down | HealthStatus::Degraded
        ));
    }

    #[tokio::test]
    async fn test_poll_layer() {
        let poller = HealthPoller::with_default();
        let l1 = poller.poll_layer(Layer::L1).await;
        assert_eq!(l1.len(), 8);
        assert!(l1.iter().all(|s| s.layer == Layer::L1));
        let l2 = poller.poll_layer(Layer::L2).await;
        assert_eq!(l2.len(), 4);
        let sys = poller.poll_layer(Layer::System).await;
        assert_eq!(sys.len(), 6);
    }
}
