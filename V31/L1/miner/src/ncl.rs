//! Miner ↔ NCL (Neural Compute Layer) — **opt-in spike**.
//!
//! Do 11. 11. 2026 neměl miner na NCL jedinou referenci (`V33_GAP_ANALYSIS.md`
//! §N3): mineři dělali jen PoW a AI joby v NCL neměl kdo odebrat. Tenhle
//! modul je **spojení, ne nová schopnost**: miner se zaregistruje jako
//! worker, polluje `GET /jobs/next/:worker_id`, „spočítá" job a nahlásí
//! dokončení. Skutečné inferenční backendy (ONNX/WASM/TFLite) jsou další
//! krok — tady jde o to, aby řetěz `job → worker → complete` existoval
//! a byl testovatelný.
//!
//! ## Bezpečnostní a ekonomické mantinely
//!
//! - **Default OFF.** Bez `ZION_NCL_ENABLED=1` se nespustí žádný task a
//!   miner neposílá ani jeden HTTP požadavek navíc.
//! - **Žádná odměna na mainnetu.** `reward_flowers` z jobu se jen zaloguje;
//!   modul nedrží klíč, nepodepisuje tx a nesahá na `devfee`/wallet. Tím je
//!   splněné pravidlo „reward path jen v regtest" — payout cesta tu prostě
//!   není, dokud ji někdo nepřidá vědomě.
//! - **Výpočet je záměrně triviální** (`blake3(input_hash)`), aby spike
//!   nekonkuroval těžbě: `spawn_blocking` se nepoužívá, protože práce je
//!   pod mikrosecond. Až přijde skutečný backend, patří do `spawn_blocking`
//!   s timeoutem z jobu.
//! - **Chyby nejsou fatální.** Nedostupný NCL = `warn` jednou za pokus,
//!   PoW jede dál. Miner kvůli NCL nikdy nesmí spadnout ani zablokovat
//!   mining smyčku.
//!
//! ## Env kontrakt
//!
//! | Proměnná | Default | Význam |
//! |---|---|---|
//! | `ZION_NCL_ENABLED` | `0` | `1`/`true`/`yes`/`on` zapne loop |
//! | `ZION_NCL_URL` | `http://127.0.0.1:8099` | base URL NCL API |
//! | `ZION_NCL_WORKER_ID` | `miner-<address>` | stabilní id (přežije restart) |
//! | `ZION_NCL_ADDRESS` | = worker id | payout/identita, kterou NCL vidí |
//! | `ZION_NCL_BACKENDS` | `custom` | čárkou oddělený seznam (`custom,onnxruntime`) |
//! | `ZION_NCL_MAX_CONCURRENT` | `1` | kolik jobů najednou (spike = 1) |
//! | `ZION_NCL_POLL_MS` | `3000` | interval dotazu na frontu |
//! | `ZION_NCL_TIMEOUT_MS` | `5000` | HTTP timeout |

use std::sync::Once;
use std::time::Duration;

use serde::{Deserialize, Serialize};

const DEFAULT_URL: &str = "http://127.0.0.1:8099";
const DEFAULT_BACKENDS: &str = "custom";
const DEFAULT_POLL_MS: u64 = 3_000;
const DEFAULT_TIMEOUT_MS: u64 = 5_000;

static SPAWNED: Once = Once::new();

/// Runtime konfigurace NCL loopu.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NclConfig {
    pub url: String,
    pub worker_id: String,
    pub address: String,
    pub backends: Vec<String>,
    pub max_concurrent: usize,
    pub poll: Duration,
    pub http_timeout: Duration,
}

impl NclConfig {
    /// Postaví konfiguraci z `get` (proměnná → hodnota). Vrací `None`, když
    /// NCL není zapnuté — volající pak nesmí nic spouštět.
    ///
    /// `get` je injektované schválně: testy nepotřebují mutovat procesní env
    /// (a v paralelních testech by si ho rozbily).
    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Option<Self> {
        if !truthy(get("ZION_NCL_ENABLED").as_deref()) {
            return None;
        }
        let url = nonempty(get("ZION_NCL_URL")).unwrap_or_else(|| DEFAULT_URL.to_string());
        let address = nonempty(get("ZION_NCL_ADDRESS"))
            .or_else(|| nonempty(get("ZION_NCL_WORKER_ID")))
            .unwrap_or_else(|| "miner-unknown".to_string());
        let worker_id =
            nonempty(get("ZION_NCL_WORKER_ID")).unwrap_or_else(|| format!("miner-{address}"));
        let backends = nonempty(get("ZION_NCL_BACKENDS"))
            .unwrap_or_else(|| DEFAULT_BACKENDS.to_string())
            .split(',')
            .map(|b| b.trim().to_ascii_lowercase())
            .filter(|b| !b.is_empty())
            .collect::<Vec<_>>();
        let backends = if backends.is_empty() {
            vec![DEFAULT_BACKENDS.to_string()]
        } else {
            backends
        };
        Some(Self {
            url: url.trim_end_matches('/').to_string(),
            worker_id,
            address,
            max_concurrent: parse_u64(get("ZION_NCL_MAX_CONCURRENT"), 1).clamp(1, 16) as usize,
            poll: Duration::from_millis(
                parse_u64(get("ZION_NCL_POLL_MS"), DEFAULT_POLL_MS).clamp(250, 120_000),
            ),
            http_timeout: Duration::from_millis(
                parse_u64(get("ZION_NCL_TIMEOUT_MS"), DEFAULT_TIMEOUT_MS).clamp(500, 120_000),
            ),
            backends,
        })
    }

    /// Totéž z procesního prostředí.
    pub fn from_env() -> Option<Self> {
        Self::from_lookup(|key| std::env::var(key).ok())
    }
}

fn nonempty(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn truthy(value: Option<&str>) -> bool {
    matches!(
        value.map(|v| v.trim().to_ascii_lowercase()).as_deref(),
        Some("1") | Some("true") | Some("yes") | Some("on")
    )
}

fn parse_u64(value: Option<String>, default: u64) -> u64 {
    value
        .and_then(|v| v.trim().parse::<u64>().ok())
        .unwrap_or(default)
}

// ── HTTP DTO (miner nemá závislost na zion-ncl, aby netáhl axum/rusqlite) ──

#[derive(Debug, Serialize)]
struct RegisterBody<'a> {
    id: &'a str,
    address: &'a str,
    backends: Vec<String>,
    max_concurrent: usize,
    consciousness_level: u8,
}

/// NCL server zná backendy jako `OnnxRuntime`/`Wasm`/`TfLite`/`Custom`
/// (case-sensitive), ale v env je přirozené psát `custom` / `onnxruntime`.
/// Posíláme proto kanonický název — starší server bez `serde(alias)` by
/// jinak registraci odmítl 422 a miner by tiše nikdy nic nevzal.
fn canonical_backend(value: &str) -> &'static str {
    match value.trim().to_ascii_lowercase().as_str() {
        "onnxruntime" | "onnx" => "OnnxRuntime",
        "wasm" => "Wasm",
        "tflite" | "tf" => "TfLite",
        _ => "Custom",
    }
}

#[derive(Debug, Serialize)]
struct CompleteBody<'a> {
    worker_id: &'a str,
    output_hash: String,
    duration_ms: f64,
}

#[derive(Debug, Deserialize)]
struct ClaimedJob {
    id: String,
    input_hash: String,
    #[serde(default)]
    reward_flowers: u64,
    #[serde(default)]
    timeout_ms: u64,
}

/// Spawn the worker loop once per process when enabled. Idempotent — repeated
/// calls (e.g. a re-entered runtime) never start a second loop.
///
/// Returns `true` when a loop is running for this config (freshly spawned or
/// already spawned earlier).
pub fn maybe_spawn(config: Option<NclConfig>) -> bool {
    let Some(config) = config else {
        return false;
    };
    let mut spawned = false;
    SPAWNED.call_once(|| {
        spawned = true;
        let url = config.url.clone();
        let worker = config.worker_id.clone();
        tracing::info!(
            ncl.url = %url,
            ncl.worker_id = %worker,
            ncl.backends = ?config.backends,
            "NCL worker loop zapnutý (opt-in spike, žádná odměna)"
        );
        tokio::spawn(async move { run_loop(config).await });
    });
    spawned
}

/// The worker loop itself. Production entry is [`maybe_spawn`]; `pub` so the
/// end-to-end test can drive it against a real NCL server without the
/// process-global `Once`.
pub async fn run_loop(config: NclConfig) {
    let client = match reqwest::Client::builder()
        .timeout(config.http_timeout)
        .build()
    {
        Ok(client) => client,
        Err(err) => {
            tracing::warn!(error = %err, "NCL: HTTP klient se nepodařilo postavit, loop končí");
            return;
        }
    };

    let mut registered = false;
    loop {
        if !registered {
            match register(&client, &config).await {
                Ok(()) => registered = true,
                Err(err) => {
                    tracing::warn!(error = %err, "NCL: registrace workera selhala, zkusím znovu");
                    tokio::time::sleep(config.poll).await;
                    continue;
                }
            }
        }

        match claim(&client, &config).await {
            Ok(Some(job)) => {
                run_and_report(&client, &config, job).await;
            }
            Ok(None) => tokio::time::sleep(config.poll).await,
            Err(ClaimError::UnknownWorker) => {
                tracing::warn!(
                    "NCL: worker na serveru neexistuje (restart NCL?) — registruji znovu"
                );
                registered = false;
            }
            Err(ClaimError::Transport(err)) => {
                tracing::warn!(error = %err, "NCL: dotaz na frontu selhal, zkusím znovu");
                tokio::time::sleep(config.poll).await;
            }
        }
    }
}

async fn register(client: &reqwest::Client, config: &NclConfig) -> Result<(), String> {
    let body = RegisterBody {
        id: &config.worker_id,
        address: &config.address,
        backends: config
            .backends
            .iter()
            .map(|b| canonical_backend(b).to_string())
            .collect(),
        max_concurrent: config.max_concurrent,
        consciousness_level: 0,
    };
    let resp = client
        .post(format!("{}/workers", config.url))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    tracing::info!(ncl.worker_id = %config.worker_id, "NCL: worker zaregistrován");
    Ok(())
}

enum ClaimError {
    UnknownWorker,
    Transport(String),
}

async fn claim(
    client: &reqwest::Client,
    config: &NclConfig,
) -> Result<Option<ClaimedJob>, ClaimError> {
    let resp = client
        .get(format!(
            "{}/jobs/next/{}",
            config.url,
            urlencode(&config.worker_id)
        ))
        .send()
        .await
        .map_err(|e| ClaimError::Transport(e.to_string()))?;

    match resp.status().as_u16() {
        200 => resp
            .json::<ClaimedJob>()
            .await
            .map(Some)
            .map_err(|e| ClaimError::Transport(format!("neplatný JSON jobu: {e}"))),
        204 => Ok(None),
        404 => Err(ClaimError::UnknownWorker),
        other => Err(ClaimError::Transport(format!("HTTP {other}"))),
    }
}

async fn run_and_report(client: &reqwest::Client, config: &NclConfig, job: ClaimedJob) {
    let started = std::time::Instant::now();

    // Spike „compute": deterministický otisk vstupu. Skutečný backend
    // (ONNX/WASM/TFLite) sem patří až s `spawn_blocking` + timeoutem z jobu.
    let output_hash = blake3::hash(job.input_hash.as_bytes()).to_hex().to_string();
    let duration_ms = started.elapsed().as_secs_f64() * 1000.0;

    let body = CompleteBody {
        worker_id: &config.worker_id,
        output_hash: output_hash.clone(),
        duration_ms,
    };
    let result = client
        .post(format!("{}/jobs/{}/complete", config.url, job.id))
        .json(&body)
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            // Odměna se **jen loguje** — žádná wallet, žádná tx (mainnet safe).
            tracing::info!(
                ncl.job = %job.id,
                ncl.output_hash = %output_hash,
                ncl.reward_flowers = job.reward_flowers,
                ncl.timeout_ms = job.timeout_ms,
                ncl.duration_ms = duration_ms,
                "NCL: job dokončen"
            );
        }
        Ok(resp) => {
            tracing::warn!(
                ncl.job = %job.id,
                status = %resp.status(),
                "NCL: hlášení dokončení odmítnuto"
            );
            fail_job(
                client,
                config,
                &job.id,
                &format!("complete HTTP {}", resp.status()),
            )
            .await;
        }
        Err(err) => {
            tracing::warn!(ncl.job = %job.id, error = %err, "NCL: hlášení dokončení selhalo");
        }
    }
}

async fn fail_job(client: &reqwest::Client, config: &NclConfig, job_id: &str, reason: &str) {
    let body = serde_json::json!({
        "worker_id": config.worker_id,
        "reason": reason,
    });
    let _ = client
        .post(format!("{}/jobs/{}/fail", config.url, job_id))
        .json(&body)
        .send()
        .await;
}

/// Minimální percent-encoding pro segment cesty (worker id je od nás, ale
/// nikdy nevíme, co dali do env).
fn urlencode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            other => out.push_str(&format!("%{other:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config_from(pairs: &[(&str, &str)]) -> Option<NclConfig> {
        let owned: Vec<(String, String)> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        NclConfig::from_lookup(|key| owned.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone()))
    }

    #[test]
    fn disabled_by_default() {
        assert!(config_from(&[]).is_none());
        assert!(config_from(&[("ZION_NCL_ENABLED", "0")]).is_none());
        assert!(config_from(&[("ZION_NCL_ENABLED", "false")]).is_none());
    }

    #[test]
    fn enabled_with_defaults() {
        let cfg = config_from(&[("ZION_NCL_ENABLED", "1")]).expect("zapnuto");
        assert_eq!(cfg.url, DEFAULT_URL);
        assert_eq!(cfg.backends, vec!["custom".to_string()]);
        assert_eq!(cfg.max_concurrent, 1);
        assert_eq!(cfg.poll, Duration::from_millis(DEFAULT_POLL_MS));
        assert_eq!(cfg.http_timeout, Duration::from_millis(DEFAULT_TIMEOUT_MS));
        assert_eq!(cfg.worker_id, format!("miner-{}", cfg.address));
    }

    #[test]
    fn custom_values_are_parsed_and_sanitised() {
        let cfg = config_from(&[
            ("ZION_NCL_ENABLED", "YES"),
            ("ZION_NCL_URL", "http://ncl.local:8099/"),
            ("ZION_NCL_ADDRESS", "zion1abc"),
            ("ZION_NCL_BACKENDS", " Custom , ,onnxruntime "),
            ("ZION_NCL_MAX_CONCURRENT", "4"),
            ("ZION_NCL_POLL_MS", "1500"),
            ("ZION_NCL_TIMEOUT_MS", "2500"),
        ])
        .expect("zapnuto");
        assert_eq!(cfg.url, "http://ncl.local:8099", "trailing slash pryč");
        assert_eq!(cfg.address, "zion1abc");
        assert_eq!(cfg.worker_id, "miner-zion1abc");
        assert_eq!(cfg.backends, vec!["custom", "onnxruntime"]);
        assert_eq!(cfg.max_concurrent, 4);
        assert_eq!(cfg.poll, Duration::from_millis(1500));
        assert_eq!(cfg.http_timeout, Duration::from_millis(2500));
    }

    #[test]
    fn garbage_numbers_fall_back_and_are_clamped() {
        let cfg = config_from(&[
            ("ZION_NCL_ENABLED", "true"),
            ("ZION_NCL_POLL_MS", "not-a-number"),
            ("ZION_NCL_TIMEOUT_MS", "1"),
            ("ZION_NCL_MAX_CONCURRENT", "999"),
        ])
        .expect("zapnuto");
        assert_eq!(cfg.poll, Duration::from_millis(DEFAULT_POLL_MS));
        assert_eq!(cfg.http_timeout, Duration::from_millis(500), "clamp dolů");
        assert_eq!(cfg.max_concurrent, 16, "clamp nahoru");
    }

    #[test]
    fn empty_backends_csv_falls_back_to_default() {
        let cfg = config_from(&[("ZION_NCL_ENABLED", "on"), ("ZION_NCL_BACKENDS", " , , ")])
            .expect("zapnuto");
        assert_eq!(cfg.backends, vec!["custom".to_string()]);
    }

    #[test]
    fn urlencode_escapes_path_segment() {
        assert_eq!(urlencode("miner-1"), "miner-1");
        assert_eq!(urlencode("a b/c"), "a%20b%2Fc");
    }
}
