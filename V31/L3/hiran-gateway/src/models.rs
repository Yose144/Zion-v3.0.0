//! Model alias catalog + upstream failover chains + liveness probes.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Upstream {
    /// OpenAI-compatible base URL, e.g. `http://127.0.0.1:8004/v1`.
    pub base: String,
    /// True when this entry is the degraded/CPU fallback tier.
    #[serde(default)]
    pub degraded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDef {
    /// Public alias served as OpenAI `model` id (e.g. `hiran-mini`).
    pub alias: String,
    /// Ordered failover chain — index 0 is primary.
    pub upstreams: Vec<Upstream>,
    /// Context window advertised in /v1/models.
    #[serde(default = "default_ctx")]
    pub context: u32,
    /// Minimum plan tier required (`free` model serves everyone).
    #[serde(default)]
    pub tier: String,
    /// Advertised $/1M tokens (informational until billing lands).
    #[serde(default)]
    pub price_1m_usd: f64,
}

fn default_ctx() -> u32 {
    4096
}

/// Built-in catalog when no models.json exists — single-model MVP start.
fn default_catalog() -> Vec<ModelDef> {
    vec![ModelDef {
        alias: "hiran-mini".into(),
        upstreams: vec![
            Upstream { base: "http://127.0.0.1:8004/v1".into(), degraded: false },
            Upstream { base: "http://127.0.0.1:8002/v1".into(), degraded: true },
        ],
        context: 4096,
        tier: "free".into(),
        price_1m_usd: 0.6,
    }]
}

struct Probe {
    live: bool,
    at: Instant,
}

pub struct Catalog {
    models: Vec<ModelDef>,
    by_alias: HashMap<String, usize>,
    client: reqwest::Client,
    probe_ttl: Duration,
    /// Liveness per upstream base URL.
    probes: Mutex<HashMap<String, Probe>>,
}

impl Catalog {
    pub fn load(path: &str, probe_ttl_secs: u64) -> Result<Self> {
        let models = match std::fs::read_to_string(path) {
            Ok(raw) => serde_json::from_str::<Vec<ModelDef>>(&raw)
                .with_context(|| format!("parse {path}"))?,
            Err(_) => {
                tracing::info!(path, "models.json absent — using built-in hiran-mini catalog");
                default_catalog()
            }
        };
        anyhow::ensure!(!models.is_empty(), "model catalog empty");
        let by_alias = models
            .iter()
            .enumerate()
            .map(|(i, m)| (m.alias.clone(), i))
            .collect();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()?;
        Ok(Self {
            models,
            by_alias,
            client,
            probe_ttl: Duration::from_secs(probe_ttl_secs),
            probes: Mutex::new(HashMap::new()),
        })
    }

    pub fn get(&self, alias: &str) -> Option<&ModelDef> {
        self.by_alias.get(alias).map(|i| &self.models[*i])
    }

    pub fn all(&self) -> &[ModelDef] {
        &self.models
    }

    /// Cached liveness probe: `{base}/models` must answer 2xx.
    pub async fn is_live(&self, base: &str) -> bool {
        {
            let probes = self.probes.lock().unwrap();
            if let Some(p) = probes.get(base) {
                if p.at.elapsed() < self.probe_ttl {
                    return p.live;
                }
            }
        }
        let url = format!("{}/models", base.trim_end_matches('/'));
        let live = self
            .client
            .get(&url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);
        self.probes
            .lock()
            .unwrap()
            .insert(base.to_string(), Probe { live, at: Instant::now() });
        live
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_catalog_shape() {
        let c = Catalog::load("/nonexistent/models.json", 30).unwrap();
        assert_eq!(c.all().len(), 1);
        let m = c.get("hiran-mini").unwrap();
        assert_eq!(m.upstreams.len(), 2);
        assert!(m.upstreams[1].degraded);
        assert!(c.get("nope").is_none());
    }

    #[test]
    fn json_catalog_parse() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(
            tmp.path(),
            r#"[{"alias":"x","upstreams":[{"base":"http://u/v1"}],"price_1m_usd":1.5}]"#,
        )
        .unwrap();
        let c = Catalog::load(tmp.path().to_str().unwrap(), 30).unwrap();
        assert_eq!(c.get("x").unwrap().price_1m_usd, 1.5);
    }
}
