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
    /// Optional upstream `model` id rewrite (public alias → backend weight).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDef {
    /// Public alias served as OpenAI `model` id (e.g. `hiran-mini`).
    pub alias: String,
    /// Ordered failover chain — index 0 is primary. Empty when `mockup`.
    #[serde(default)]
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
    /// Planned persona — listed in /v1/models with `x-mockup`, chat → 503.
    #[serde(default)]
    pub mockup: bool,
    /// Product role: chat | coder | thinking | lore | agentic.
    #[serde(default)]
    pub role: String,
    /// Extra tags for clients (`trinity`, `code`, …).
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_ctx() -> u32 {
    4096
}

fn env_base(name: &str, default: &str) -> String {
    std::env::var(name)
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| default.to_string())
}

/// Built-in catalog when no models.json exists — F1 fabric (mini + coder + trinity).
fn default_catalog() -> Vec<ModelDef> {
    let coder_primary = env_base("HIRAN_CODER_PRIMARY", "http://127.0.0.1:8005/v1");
    let coder_upstream_model =
        env_base("HIRAN_CODER_UPSTREAM_MODEL", "qwen2.5-coder-7b-instruct");
    let mut coder_ups = vec![Upstream {
        base: coder_primary,
        degraded: false,
        model: Some(coder_upstream_model.clone()),
    }];
    if let Ok(fb) = std::env::var("HIRAN_CODER_FALLBACK") {
        let fb = fb.trim().to_string();
        if !fb.is_empty() {
            coder_ups.push(Upstream {
                base: fb,
                degraded: true,
                model: Some(coder_upstream_model),
            });
        }
    }

    vec![
        ModelDef {
            alias: "hiran-mini".into(),
            upstreams: vec![
                Upstream {
                    base: env_base("HIRAN_MINI_PRIMARY", "http://127.0.0.1:8004/v1"),
                    degraded: false,
                    model: None,
                },
                Upstream {
                    base: env_base("HIRAN_MINI_FALLBACK", "http://127.0.0.1:8002/v1"),
                    degraded: true,
                    model: None,
                },
            ],
            context: 4096,
            tier: "free".into(),
            price_1m_usd: 0.6,
            mockup: false,
            role: "chat".into(),
            tags: vec!["live".into(), "hiran".into()],
        },
        ModelDef {
            alias: "hiran-coder".into(),
            upstreams: coder_ups,
            context: 8192,
            tier: "pro".into(),
            price_1m_usd: 2.5,
            mockup: false,
            role: "coder".into(),
            tags: vec!["code".into(), "agentic".into(), "hiran".into()],
        },
        ModelDef {
            alias: "hiran-amitabha".into(),
            upstreams: vec![],
            context: 8192,
            tier: "pro".into(),
            price_1m_usd: 3.0,
            mockup: true,
            role: "thinking".into(),
            tags: vec!["trinity".into(), "hiran".into(), "thinking".into()],
        },
        ModelDef {
            alias: "hiran-issobella".into(),
            upstreams: vec![],
            context: 16384,
            tier: "pro".into(),
            price_1m_usd: 4.0,
            mockup: true,
            role: "agentic".into(),
            tags: vec!["trinity".into(), "hiran".into(), "code".into(), "agentic".into()],
        },
        ModelDef {
            alias: "hiran-maitreya".into(),
            upstreams: vec![],
            context: 8192,
            tier: "pro".into(),
            price_1m_usd: 3.5,
            mockup: true,
            role: "lore".into(),
            tags: vec!["trinity".into(), "hiran".into(), "rag".into(), "lore".into()],
        },
    ]
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
            Ok(raw) => {
                let mut file: Vec<ModelDef> = serde_json::from_str(&raw)
                    .with_context(|| format!("parse {path}"))?;
                // Ensure F1 built-ins exist even on older models.json.
                merge_missing_builtins(&mut file);
                file
            }
            Err(_) => {
                tracing::info!(
                    path,
                    "models.json absent — using built-in F1 catalog (mini+coder+trinity)"
                );
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
        self.probes.lock().unwrap().insert(
            base.to_string(),
            Probe {
                live,
                at: Instant::now(),
            },
        );
        live
    }

    /// True if any upstream answers (mockups are never live).
    pub async fn alias_live(&self, def: &ModelDef) -> (bool, bool) {
        if def.mockup || def.upstreams.is_empty() {
            return (false, false);
        }
        for (i, u) in def.upstreams.iter().enumerate() {
            if self.is_live(&u.base).await {
                return (true, i > 0);
            }
        }
        (false, false)
    }
}

fn merge_missing_builtins(file: &mut Vec<ModelDef>) {
    let builtins = default_catalog();
    for b in builtins {
        if file.iter().any(|m| m.alias == b.alias) {
            continue;
        }
        tracing::info!(alias = %b.alias, "merging missing F1 builtin into catalog");
        file.push(b);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_catalog_f1_shape() {
        let c = Catalog::load("/nonexistent/models.json", 30).unwrap();
        assert!(c.get("hiran-mini").is_some());
        assert!(c.get("hiran-coder").is_some());
        assert!(c.get("hiran-amitabha").unwrap().mockup);
        assert!(c.get("hiran-issobella").unwrap().mockup);
        assert!(c.get("hiran-maitreya").unwrap().mockup);
        assert!(c.get("hiran-coder").unwrap().upstreams[0].model.is_some());
        assert!(c.get("nope").is_none());
    }

    #[test]
    fn json_catalog_merges_builtins() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(
            tmp.path(),
            r#"[{"alias":"hiran-mini","upstreams":[{"base":"http://u/v1"}],"price_1m_usd":1.5}]"#,
        )
        .unwrap();
        let c = Catalog::load(tmp.path().to_str().unwrap(), 30).unwrap();
        assert_eq!(c.get("hiran-mini").unwrap().price_1m_usd, 1.5);
        assert!(c.get("hiran-coder").is_some());
        assert!(c.get("hiran-maitreya").unwrap().mockup);
    }

    #[test]
    fn json_catalog_parse_rewrite() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(
            tmp.path(),
            r#"[{"alias":"x","upstreams":[{"base":"http://u/v1","model":"backend-id"}],"tags":["code"]}]"#,
        )
        .unwrap();
        let c = Catalog::load(tmp.path().to_str().unwrap(), 30).unwrap();
        assert_eq!(
            c.get("x").unwrap().upstreams[0].model.as_deref(),
            Some("backend-id")
        );
    }
}
