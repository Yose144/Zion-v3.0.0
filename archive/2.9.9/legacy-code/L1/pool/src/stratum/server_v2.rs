/// Stratum Server - Full async TCP mining server implementation
///
/// Handles XMRig and Stratum protocol connections with:
/// - Async TCP (Tokio)
/// - Connection pooling (10k+ concurrent miners)
/// - Session management
/// - Protocol auto-detection
/// - Job distribution
/// - Share validation integration
use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use uuid::Uuid;

use super::connection_v2::{Connection, ConnectionState};
use super::protocol::{StratumError, StratumRequest, StratumResponse};
use crate::blockchain::{BlockTemplate, BlockTemplateManager};
use crate::metrics::prometheus as metrics;
use crate::revenue_proxy::{RevenueProxyManager, ShareSubmission};
use crate::session::SessionManager;
use crate::shares::{ProcessedShareOutcome, ShareProcessor, SubmittedShare};
use crate::stream_scheduler::{MinerGroup, ScheduledJob, ShareRoute, StreamScheduler};
use zion_core::blockchain::block::Algorithm as CoreAlgorithm;
use zion_core::blockchain::consensus;

pub struct StratumServer {
    host: String,
    port: u16,
    connections: Arc<RwLock<HashMap<String, Arc<RwLock<Connection>>>>>,
    connection_count: Arc<AtomicUsize>,
    /// AUDIT-FIX P0-13: Per-IP connection counter for rate limiting
    connections_per_ip: Arc<RwLock<HashMap<std::net::IpAddr, usize>>>,
    /// AUDIT-FIX P0-13: Maximum connections allowed from a single IP
    max_connections_per_ip: usize,
    session_manager: Arc<SessionManager>,
    share_processor: Arc<ShareProcessor>,
    template_manager: Arc<RwLock<Option<Arc<BlockTemplateManager>>>>,
    job_templates: Arc<RwLock<HashMap<String, BlockTemplate>>>,
    job_templates_order: Arc<RwLock<VecDeque<String>>>,
    max_connections: usize,
    _running: Arc<RwLock<bool>>,
    /// CH v3 Stream Scheduler — time-splits mining jobs across revenue streams
    stream_scheduler: Arc<RwLock<Option<Arc<StreamScheduler>>>>,
    /// Direct fallback for ext-* forwarding when scheduler route is unavailable
    revenue_proxy: Arc<RwLock<Option<Arc<RevenueProxyManager>>>>,
}

impl StratumServer {
    const JOB_CACHE_LIMIT: usize = 256;
    const COSMIC_STATE0_ENDIAN: &'static str = "little";

    /// Create new Stratum server
    pub fn new(
        host: String,
        port: u16,
        session_manager: Arc<SessionManager>,
        share_processor: Arc<ShareProcessor>,
        max_connections: Option<usize>,
    ) -> Self {
        tracing::info!("🌐 Creating Stratum server on {}:{}", host, port);

        Self {
            host,
            port,
            connections: Arc::new(RwLock::new(HashMap::new())),
            connection_count: Arc::new(AtomicUsize::new(0)),
            connections_per_ip: Arc::new(RwLock::new(HashMap::new())),
            max_connections_per_ip: 50, // AUDIT-FIX P0-13: max 50 conn/IP (3 processes × miner + retries; was 10 → too low)
            session_manager,
            share_processor,
            template_manager: Arc::new(RwLock::new(None)),
            job_templates: Arc::new(RwLock::new(HashMap::new())),
            job_templates_order: Arc::new(RwLock::new(VecDeque::new())),
            max_connections: max_connections.unwrap_or(10_000),
            _running: Arc::new(RwLock::new(false)),
            stream_scheduler: Arc::new(RwLock::new(None)),
            revenue_proxy: Arc::new(RwLock::new(None)),
        }
    }

    /// Set template manager (must be called before start)
    pub fn set_template_manager(&self, template_manager: Arc<BlockTemplateManager>) {
        let tm = self.template_manager.clone();
        tokio::spawn(async move {
            *tm.write().await = Some(template_manager);
        });
    }

    /// Set the stream scheduler (CH v3 time-splitting)
    pub fn set_stream_scheduler(&self, scheduler: Arc<StreamScheduler>) {
        // Avoid a startup race where miners can submit `ext-*` shares before the
        // scheduler is visible to `handle_submit()`, which would cause local
        // validation and zero external submissions.
        if let Ok(mut guard) = self.stream_scheduler.try_write() {
            *guard = Some(scheduler);
            return;
        }

        let ss = self.stream_scheduler.clone();
        tokio::spawn(async move {
            *ss.write().await = Some(scheduler);
        });
    }

    /// Set revenue proxy for direct ext-* share forwarding fallback
    pub fn set_revenue_proxy(&self, proxy: Arc<RevenueProxyManager>) {
        let rp = self.revenue_proxy.clone();
        tokio::spawn(async move {
            *rp.write().await = Some(proxy);
        });
    }

    async fn try_forward_external_direct(
        &self,
        job_id: &str,
        nonce: &str,
        worker: &str,
        result: &str,
    ) -> Option<String> {
        if !job_id.starts_with("ext-") {
            return None;
        }

        let parts: Vec<&str> = job_id.splitn(3, '-').collect();
        if parts.len() < 3 {
            return None;
        }

        let coin = parts[1].to_lowercase();
        let original_job_id = parts[2].to_string();

        let proxy = {
            let guard = self.revenue_proxy.read().await;
            guard.clone()
        }?;

        proxy
            .submit_share(ShareSubmission {
                coin: coin.clone(),
                job_id: original_job_id,
                nonce: nonce.to_string(),
                worker: worker.to_string(),
                result: result.to_string(),
                algorithm: String::new(),
            })
            .await;

        Some(coin)
    }

    /// Broadcast an external (scheduled) job to all connected miners
    /// Called by the StreamScheduler when switching streams
    pub async fn broadcast_scheduled_job(&self, job: ScheduledJob) {
        // Clone connections out of the lock to avoid holding read lock during async I/O
        let conns: Vec<Arc<RwLock<Connection>>> = {
            let connections = self.connections.read().await;
            connections.values().cloned().collect()
        };
        let mut sent = 0;

        for connection in &conns {
            let conn = connection.read().await;
            if conn.state != ConnectionState::Authenticated {
                continue;
            }

            let difficulty = conn.difficulty;
            let protocol = conn.protocol;
            drop(conn);

            let target = if job.target.is_empty() {
                Self::compute_job_target_hex(&job.algorithm, difficulty)
            } else {
                job.target.clone()
            };

            // Stratum mining.notify format aligned with miner parser:
            // [0] job_id, [1] blob, [2] target, [3] height, [4] algo, [5] seed_hash, [6] clean
            if protocol == super::connection_v2::Protocol::Stratum {
                let notify = serde_json::json!({
                    "id": serde_json::Value::Null,
                    "method": "mining.notify",
                    "params": [
                        job.job_id.clone(),        // [0] job_id
                        job.blob.clone(),          // [1] blob
                        target.clone(),            // [2] target hex
                        job.height,                // [3] height
                        job.algorithm.clone(),     // [4] algorithm name (crucial for stream switching!)
                        job.seed_hash.clone(),     // [5] seed_hash (RandomX/Ethash)
                        true,                      // [6] clean_jobs
                    ]
                });
                if Self::send_json(connection, notify).await.is_ok() {
                    sent += 1;
                }
            }

            if protocol == super::connection_v2::Protocol::XMRig {
                let msg = serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "job",
                    "params": {
                        "job_id": job.job_id.clone(),
                        "blob": job.blob.clone(),
                        "target": target,
                        "difficulty": job.difficulty as u64,
                        "height": job.height,
                        "algo": job.algorithm.clone(),
                        "seed_hash": job.seed_hash.clone(),
                        "coin": job.coin.clone(),
                    }
                });
                if Self::send_json(connection, msg).await.is_ok() {
                    sent += 1;
                }
            }

            {
                let mut conn = connection.write().await;
                conn.current_job_id = Some(job.job_id.clone());
                if !job.algorithm.is_empty() {
                    conn.algorithm = Some(job.algorithm.clone());
                }
            }
        }

        tracing::info!(
            "📢 StreamScheduler: Broadcasted {} job ({}) to {} miners [algo={}]",
            job.stream_id,
            job.job_id,
            sent,
            job.algorithm
        );
    }

    /// Broadcast a job to specific session IDs only (for per-miner assignment)
    /// Used when ProfitSwitcher changes coin → only Revenue group gets new job
    pub async fn broadcast_job_to_sessions(&self, session_ids: &[String], job: ScheduledJob) {
        // Clone targeted connections out of the lock
        let target_conns: Vec<Arc<RwLock<Connection>>> = {
            let connections = self.connections.read().await;
            session_ids
                .iter()
                .filter_map(|sid| connections.get(sid).cloned())
                .collect()
        };
        let mut sent = 0;

        for connection in &target_conns {
            let conn = connection.read().await;
            if conn.state != ConnectionState::Authenticated {
                continue;
            }

            let difficulty = conn.difficulty;
            let protocol = conn.protocol;
            drop(conn);

            let target = if job.target.is_empty() {
                Self::compute_job_target_hex(&job.algorithm, difficulty)
            } else {
                job.target.clone()
            };

            // Stratum mining.notify format aligned with miner parser:
            // [0] job_id, [1] blob, [2] target, [3] height, [4] algo, [5] seed_hash, [6] clean
            if protocol == super::connection_v2::Protocol::Stratum {
                let notify = serde_json::json!({
                    "id": serde_json::Value::Null,
                    "method": "mining.notify",
                    "params": [
                        job.job_id.clone(),        // [0] job_id
                        job.blob.clone(),          // [1] blob
                        target.clone(),            // [2] target hex
                        job.height,                // [3] height
                        job.algorithm.clone(),     // [4] algorithm name
                        job.seed_hash.clone(),     // [5] seed_hash
                        true,                      // [6] clean_jobs
                    ]
                });
                if Self::send_json(connection, notify).await.is_ok() {
                    sent += 1;
                }
            }

            if protocol == super::connection_v2::Protocol::XMRig {
                let msg = serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "job",
                    "params": {
                        "job_id": job.job_id.clone(),
                        "blob": job.blob.clone(),
                        "target": target,
                        "difficulty": job.difficulty as u64,
                        "height": job.height,
                        "algo": job.algorithm.clone(),
                        "seed_hash": job.seed_hash.clone(),
                        "coin": job.coin.clone(),
                    }
                });
                if Self::send_json(connection, msg).await.is_ok() {
                    sent += 1;
                }
            }

            {
                let mut conn = connection.write().await;
                conn.current_job_id = Some(job.job_id.clone());
                if !job.algorithm.is_empty() {
                    conn.algorithm = Some(job.algorithm.clone());
                }
            }
        }

        tracing::info!(
            "📢 StreamScheduler: Sent {} job to {}/{} targeted miners",
            job.stream_id,
            sent,
            session_ids.len()
        );
    }

    fn strip_0x(s: &str) -> &str {
        s.strip_prefix("0x").unwrap_or(s)
    }

    fn job_id_from_template(template: &BlockTemplate) -> String {
        let prev = Self::strip_0x(template.prev_hash.as_str());
        let prev8: String = prev.chars().take(8).collect();
        // Include template.timestamp so job_id changes when the pool refreshes templates
        // (even if height/prev_hash stay the same). This prevents validating shares
        // against the wrong blob after a refresh.
        format!("h{}-{}-{}", template.height, prev8, template.timestamp)
    }

    fn base_job_id(job_id: &str) -> String {
        // Pool job ids support both legacy and timestamped formats:
        // - legacy base: "h{height}-{prev8}" then per-conn "{base}-{algo}"
        // - new base:    "h{height}-{prev8}-{timestamp}" then per-conn "{base}-{algo}"
        // Recover the base id for template lookup.
        let mut parts = job_id.split('-');
        let p0 = parts.next().unwrap_or("");
        let p1 = parts.next().unwrap_or("");
        let p2 = parts.next();

        if p0.is_empty() || p1.is_empty() {
            return job_id.to_string();
        }

        // If we have a third segment and it's all digits, treat it as timestamp.
        if let Some(p2) = p2 {
            let is_timestamp = !p2.is_empty() && p2.chars().all(|c| c.is_ascii_digit());
            if is_timestamp {
                return format!("{}-{}-{}", p0, p1, p2);
            }
        }

        // Otherwise treat as legacy (base is just height+prev8).
        format!("{}-{}", p0, p1)
    }

    async fn cache_template(&self, template: &BlockTemplate) {
        let base = Self::job_id_from_template(template);

        {
            let mut map = self.job_templates.write().await;
            map.insert(base.clone(), template.clone());
        }

        {
            let mut order = self.job_templates_order.write().await;
            order.retain(|id| id != &base);
            order.push_back(base.clone());

            while order.len() > Self::JOB_CACHE_LIMIT {
                if let Some(oldest) = order.pop_front() {
                    let mut map = self.job_templates.write().await;
                    map.remove(&oldest);
                }
            }
        }
    }

    fn normalize_block_target_from_template(
        algorithm: &str,
        template: &BlockTemplate,
    ) -> Option<String> {
        let algo = algorithm.to_lowercase();

        if algo == "randomx" || algo == "rx/0" {
            // ShareValidator::check_block_target(RandomX) expects u64 hex.
            // If RPC returns a wider target, keep the low 64-bits (last 16 hex chars).
            let t = Self::strip_0x(template.target.as_str()).trim();
            if t.is_empty() {
                return None;
            }
            let t = if t.len() > 16 { &t[t.len() - 16..] } else { t };
            return Some(t.to_string());
        }

        if algo == "cosmic_harmony"
            || algo == "cosmic"
            || algo == "cosmic_harmony_v1"
            || algo == "cosmic_harmony_v3"
            || algo == "cosmic_harmony_v4"
            // CHvDeeksha aliases (v2.9.8)
            || algo == "cosmic_harmony_deeksha"
            || algo == "deeksha"
            || algo == "chv_deeksha"
            || algo == "cosmic_deeksha"
            || algo == "chdeeksha"
        {
            // Cosmic share validator compares a 32-bit value (state0) to a u32 target.
            // Prefer explicit target_u32 from core template, else fall back to low32 of `target`.
            if let Some(t32) = template.target_u32.as_ref() {
                let t = Self::strip_0x(t32).trim();
                if !t.is_empty() {
                    let t = if t.len() > 8 { &t[t.len() - 8..] } else { t };
                    return Some(t.to_string());
                }
            }

            let t = Self::strip_0x(template.target.as_str()).trim();
            if t.is_empty() {
                return None;
            }
            let t = if t.len() > 8 { &t[t.len() - 8..] } else { t };
            return Some(t.to_string());
        }

        if algo == "yescrypt" || algo == "autolykos" || algo == "autolykos_v2" {
            // Validator currently treats these targets as simplified u128.
            // Prefer explicit target_u128 from core template, else fall back to low128 of `target`.
            if let Some(t128) = template.target_u128.as_ref() {
                let t = Self::strip_0x(t128).trim();
                if !t.is_empty() {
                    let t = if t.len() > 32 { &t[t.len() - 32..] } else { t };
                    return Some(t.to_string());
                }
            }

            let t = Self::strip_0x(template.target.as_str()).trim();
            if t.is_empty() {
                return None;
            }
            let t = if t.len() > 32 { &t[t.len() - 32..] } else { t };
            return Some(t.to_string());
        }

        if algo == "blake3" {
            let t = Self::strip_0x(template.target.as_str()).trim();
            if t.is_empty() {
                return None;
            }
            let t = if t.len() > 64 { &t[t.len() - 64..] } else { t };
            return Some(t.to_string());
        }

        let t = Self::strip_0x(template.target.as_str()).trim();
        if t.is_empty() {
            return None;
        }
        Some(t.to_string())
    }

    fn normalize_algorithm_hint(value: &str) -> Option<String> {
        let v = value.trim().to_lowercase();
        if v.is_empty() {
            return None;
        }

        let normalized = match v.as_str() {
            "rx/0" | "randomx" | "rx0" => "randomx",
            "cosmic" | "cosmic_harmony" | "cosmicharmony" => "cosmic_harmony",
            "cosmic_harmony_v2" | "cosmicharmonyv2" | "cosmic-harmony-v2" => "cosmic_harmony_v2",
            "cosmic_harmony_v3" | "cosmicharmonyv3" | "cosmic-harmony-v3" => "cosmic_harmony_v3",
            "cosmic_harmony_v4" | "cosmicharmonyv4" | "cosmic-harmony-v4" | "chv4" | "ch4" => {
                "cosmic_harmony_v4"
            }
            "yescrypt" => "yescrypt",
            "blake3" => "blake3",
            "autolykos" | "autolykos_v2" | "autolykosv2" | "autolykos2" | "autolykos_v2_gpu" => {
                "autolykos_v2"
            }
            _ => return None,
        };

        Some(normalized.to_string())
    }

    fn parse_algorithm_hint(pass: &str) -> Option<String> {
        // Common miner formats: "algo=cosmic", "a=cosmic_harmony", "x,a=randomx,d=10000"
        for part in pass.split([',', ';', ' ']) {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }

            if let Some(v) = part.strip_prefix("algo=") {
                if let Some(a) = Self::normalize_algorithm_hint(v) {
                    return Some(a);
                }
            }

            if let Some(v) = part.strip_prefix("a=") {
                if let Some(a) = Self::normalize_algorithm_hint(v) {
                    return Some(a);
                }
            }
        }

        // Compatibility: some miners set password directly to algo name (e.g. "autolykos").
        Self::normalize_algorithm_hint(pass)
    }

    fn is_hex(s: &str) -> bool {
        !s.is_empty() && s.as_bytes().iter().all(|b: &u8| b.is_ascii_hexdigit())
    }

    fn strict_address_validation() -> bool {
        std::env::var("ZION_STRICT_ADDRESS")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    }

    fn is_valid_wallet(address: &str, strict: bool) -> bool {
        let addr = address.trim();
        // P1-19: Proper Bech32 address validation for ZION addresses.
        // ZION uses `zion1` prefix (HRP="zion", separator="1").
        if !addr.starts_with("zion1") {
            return false;
        }

        let tail = &addr[5..]; // after "zion1"

        // Bech32 charset: qpzry9x8gf2tvdw0s3jn54khce6mua7l (lowercase only)
        // ZION addresses must be lowercase after the prefix.
        const BECH32_CHARSET: &[u8] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";

        if strict {
            // Strict mode: enforce exact Bech32 length (39 chars after prefix = 44 total)
            // and valid Bech32 character set.
            if tail.len() != 39 {
                return false;
            }
            return tail.as_bytes().iter().all(|b| BECH32_CHARSET.contains(b));
        }

        // Relaxed mode (testnet/devnet): accept 20-90 chars after prefix,
        // only lowercase alphanumeric (Bech32-compatible charset).
        // P2WPKH (native segwit) = 39 chars, P2WSH = 59 chars — both valid.
        let len_ok = (20..=90).contains(&tail.len());
        len_ok && tail.as_bytes().iter().all(|b| BECH32_CHARSET.contains(b))
    }

    fn extract_nonce_and_result(params: &[Value]) -> (Option<String>, Option<String>) {
        let mut nonce: Option<String> = None;
        let mut result: Option<String> = None;

        for v in params {
            let Some(s) = v.as_str() else { continue };
            let s = s.trim();
            if !Self::is_hex(s) {
                continue;
            }
            if nonce.is_none() && s.len() == 8 {
                nonce = Some(s.to_string());
                continue;
            }
            if result.is_none() && s.len() == 64 {
                result = Some(s.to_string());
                continue;
            }
        }

        (nonce, result)
    }

    fn parse_difficulty_hint(pass: &str) -> Option<u64> {
        // Common miner formats: "d=10000", "x,d=10000", "d=10000,foo"
        for part in pass.split([',', ';', ' ']) {
            let part = part.trim();
            if let Some(v) = part.strip_prefix("d=") {
                if let Ok(n) = v.trim().parse::<u64>() {
                    if n > 0 {
                        return Some(n);
                    }
                }
            }
        }
        None
    }

    fn parse_group_hint(pass: &str) -> Option<MinerGroup> {
        // Supports: g=zion|revenue|ncl|dual (also group=...)
        // Example password strings:
        //   "algo=cosmic_harmony_v3,g=zion"
        //   "algo=cosmic_harmony_v3,g=dual"   ← LolMiner-style dual-stream miner
        //   "g=revenue"
        for part in pass.split([',', ';', ' ']) {
            let part = part.trim();
            let Some(v) = part
                .strip_prefix("g=")
                .or_else(|| part.strip_prefix("group="))
            else {
                continue;
            };
            let v = v.trim().to_lowercase();
            return match v.as_str() {
                "z" | "zion" => Some(MinerGroup::Zion),
                "r" | "rev" | "revenue" => Some(MinerGroup::Revenue),
                "n" | "ncl" => Some(MinerGroup::Ncl),
                // Dual-stream miner: self-routes secondary coin, pool sends ZION jobs only
                "d" | "dual" => Some(MinerGroup::Dual),
                _ => None,
            };
        }
        None
    }

    fn compute_job_target_hex(algorithm: &str, difficulty: u64) -> String {
        let diff = difficulty.max(1);
        match algorithm.to_lowercase().as_str() {
            "randomx" | "rx/0" => {
                let t = u64::MAX / diff;
                format!("{:016x}", t)
            }
            "cosmic_harmony" | "cosmic_harmony_v3" | "cosmic_harmony_v4" | "cosmic"
            // CHvDeeksha aliases (v2.9.8) — stejný u32 target formát
            | "cosmic_harmony_deeksha" | "deeksha" | "chv_deeksha" | "cosmic_deeksha"
            | "chdeeksha" | "deeksha_canonical" => {
                let t = (u32::MAX as u64) / diff;
                let t = (t.min(u32::MAX as u64)) as u32;
                format!("{:08x}", t)
            }
            "cosmic_harmony_v2" => {
                // CHv2: treat as 256-bit target in share validator.
                consensus::target_from_difficulty_256(diff)
            }
            "yescrypt" => {
                // Yescrypt share validator compares first 28 bytes (224-bit) big-endian.
                // Use target = floor((2^224 - 1) / diff).
                let target = Self::target_224_from_difficulty(diff);
                hex::encode(target)
            }
            "autolykos" | "autolykos_v2" => {
                // Autolykos uses full 256-bit comparison in validator.
                consensus::target_from_difficulty_256(diff)
            }
            "blake3" => consensus::target_from_difficulty_256(diff),
            _ => "ffffffffffffffff".to_string(),
        }
    }

    fn target_224_from_difficulty(diff: u64) -> [u8; 28] {
        // Compute floor((2^224 - 1) / diff) in base-256 big-endian.
        // Numerator is all 0xFF.
        let mut out = [0xffu8; 28];
        if diff <= 1 {
            return out;
        }

        let mut rem: u128 = 0;
        for b in out.iter_mut() {
            let acc: u128 = (rem << 8) | (*b as u128);
            let q = (acc / diff as u128) as u8;
            rem = acc % diff as u128;
            *b = q;
        }
        out
    }

    fn algorithm_from_height(height: u64) -> String {
        CoreAlgorithm::from_height(height).name().to_string()
    }

    async fn template_for_job(&self) -> Option<BlockTemplate> {
        let tm = self.template_manager.read().await;
        let template_manager = tm.as_ref()?;
        if let Some(t) = template_manager.get_template().await {
            self.cache_template(&t).await;
            return Some(t);
        }
        match template_manager.force_update().await {
            Ok(t) => {
                self.cache_template(&t).await;
                Some(t)
            }
            Err(e) => {
                tracing::warn!("Template fetch failed (using placeholder job): {}", e);
                None
            }
        }
    }

    async fn template_for_job_id(&self, job_id: &str) -> Option<BlockTemplate> {
        let base = Self::base_job_id(job_id);

        {
            let map = self.job_templates.read().await;
            if let Some(t) = map.get(&base) {
                return Some(t.clone());
            }
        }

        let current = self.template_for_job().await?;
        let current_base = Self::job_id_from_template(&current);
        if current_base == base {
            return Some(current);
        }

        None
    }

    async fn send_json(connection: &Arc<RwLock<Connection>>, message: Value) -> Result<()> {
        let payload = serde_json::to_string(&message)? + "\n";
        let sender = { connection.read().await.outbound.clone() };
        if let Some(tx) = sender {
            let _ = tx.send(payload);
        }
        Ok(())
    }

    /// Start Stratum server
    pub async fn start(self: Arc<Self>) -> Result<()> {
        let addr = format!("{}:{}", self.host, self.port);

        // Use SO_REUSEADDR to avoid "Address already in use" on restart
        let socket = socket2::Socket::new(
            socket2::Domain::IPV4,
            socket2::Type::STREAM,
            Some(socket2::Protocol::TCP),
        )?;
        socket.set_reuse_address(true)?;
        socket.set_nonblocking(true)?;
        let sock_addr: std::net::SocketAddr = addr
            .parse()
            .map_err(|e| anyhow::anyhow!("Invalid address '{}': {}", addr, e))?;
        socket.bind(&socket2::SockAddr::from(sock_addr))?;
        socket.listen(1024)?;
        let std_listener: std::net::TcpListener = socket.into();
        let listener = TcpListener::from_std(std_listener)?;

        tracing::info!("✅ Stratum server listening on {} (SO_REUSEADDR)", addr);

        {
            let mut running = self._running.write().await;
            *running = true;
        }

        // Spawn connection cleaner task
        let server_clone = Arc::clone(&self);
        tokio::spawn(async move {
            server_clone.connection_cleaner().await;
        });

        // Accept connections loop
        loop {
            match listener.accept().await {
                Ok((mut socket, peer_addr)) => {
                    // Check connection limit (lock-free via atomic counter)
                    let conn_count = self.connection_count.load(Ordering::Relaxed);
                    if conn_count >= self.max_connections {
                        tracing::warn!(
                            "🚫 Max connections ({}) reached, rejecting {}",
                            self.max_connections,
                            peer_addr
                        );
                        let _ = socket.shutdown().await;
                        continue;
                    }

                    // AUDIT-FIX P0-13: Per-IP connection limit
                    {
                        let ip_counts = self.connections_per_ip.read().await;
                        let ip_count = ip_counts.get(&peer_addr.ip()).copied().unwrap_or(0);
                        if ip_count >= self.max_connections_per_ip {
                            tracing::warn!(
                                "🚫 Per-IP limit ({}) reached for {}, rejecting",
                                self.max_connections_per_ip,
                                peer_addr.ip()
                            );
                            let _ = socket.shutdown().await;
                            continue;
                        }
                    }
                    // Increment per-IP counter
                    {
                        let mut ip_counts = self.connections_per_ip.write().await;
                        *ip_counts.entry(peer_addr.ip()).or_insert(0) += 1;
                    }

                    tracing::info!("🔌 New connection from {}", peer_addr);

                    let server = Arc::clone(&self);
                    tokio::spawn(async move {
                        if let Err(e) = server.handle_connection(socket, peer_addr).await {
                            tracing::error!("Connection error from {}: {}", peer_addr, e);
                        }
                    });
                }
                Err(e) => {
                    tracing::error!("Failed to accept connection: {}", e);
                }
            }
        }
    }

    /// Handle single miner connection
    async fn handle_connection(&self, socket: TcpStream, peer_addr: SocketAddr) -> Result<()> {
        let session_id = Uuid::new_v4().to_string();

        // Create connection object
        let connection = Arc::new(RwLock::new(Connection::new(session_id.clone(), peer_addr)));

        // Register connection
        {
            let mut connections = self.connections.write().await;
            connections.insert(session_id.clone(), Arc::clone(&connection));
        }

        self.connection_count.fetch_add(1, Ordering::Relaxed);
        metrics::inc_connections();

        tracing::debug!("📝 Connection registered: {} ({})", session_id, peer_addr);

        // Split socket for reading and writing
        let (reader, mut writer) = socket.into_split();
        let mut reader = BufReader::new(reader);

        // Writer task (notifications + responses)
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        {
            let mut conn = connection.write().await;
            conn.outbound = Some(tx);
        }

        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if writer.write_all(msg.as_bytes()).await.is_err() {
                    break;
                }
                let _ = writer.flush().await;
            }
        });

        // Main message loop
        let mut line = String::new();
        loop {
            line.clear();

            // Read line with timeout
            // Keep this timeout shorter than stale-cleaner horizon so reconnect storms
            // from one miner don't accumulate ghost sockets and trip per-IP limits.
            match tokio::time::timeout(Duration::from_secs(45), reader.read_line(&mut line)).await {
                Ok(Ok(0)) => {
                    // EOF - connection closed
                    tracing::info!("📥 Connection closed by client: {}", peer_addr);
                    break;
                }
                Ok(Ok(_)) => {
                    // Process message
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    tracing::debug!("📨 Received from {}: {}", peer_addr, trimmed);

                    match self.handle_message(&connection, trimmed).await {
                        Ok(Some(response)) => {
                            // Send response
                            let response_str = serde_json::to_string(&response)?;
                            tracing::debug!("📤 Sending to {}: {}", peer_addr, response_str);

                            Self::send_json(&connection, response).await?;
                        }
                        Ok(None) => {
                            // No response needed (e.g., keepalive)
                        }
                        Err(e) => {
                            tracing::error!("Message handling error: {}", e);

                            // Send error response
                            let error_response = json!({
                                "jsonrpc": "2.0",
                                "error": {
                                    "code": -1,
                                    "message": e.to_string()
                                },
                                "id": null
                            });

                            let _error_str = serde_json::to_string(&error_response)?;
                            Self::send_json(&connection, error_response).await?;
                        }
                    }
                }
                Ok(Err(e)) => {
                    tracing::error!("Read error from {}: {}", peer_addr, e);
                    break;
                }
                Err(_) => {
                    // Timeout
                    tracing::warn!("⏱️  Connection timeout: {}", peer_addr);
                    break;
                }
            }

            // Update last activity
            {
                let mut conn = connection.write().await;
                conn.update_activity();
            }
        }

        // Cleanup connection
        {
            let mut connections = self.connections.write().await;
            connections.remove(&session_id);
        }

        // Unregister from StreamScheduler (rebalance will handle reassignment)
        if let Some(scheduler) = { self.stream_scheduler.read().await.clone() } {
            scheduler.unregister_miner(&session_id).await;
        }

        self.connection_count.fetch_sub(1, Ordering::Relaxed);
        metrics::dec_connections();

        // AUDIT-FIX P0-13: Decrement per-IP counter on disconnect
        {
            let mut ip_counts = self.connections_per_ip.write().await;
            let ip = peer_addr.ip();
            if let Some(count) = ip_counts.get_mut(&ip) {
                *count = count.saturating_sub(1);
                if *count == 0 {
                    ip_counts.remove(&ip);
                }
            }
        }

        // Per-miner connection metric
        {
            let conn = connection.read().await;
            if let Some(ref addr) = conn.wallet_address {
                metrics::dec_miner_connections(addr);
            }
        }

        {
            let mut conn = connection.write().await;
            conn.outbound = None;
        }

        tracing::info!("🔌 Connection closed: {} ({})", session_id, peer_addr);

        Ok(())
    }

    /// Handle incoming message
    async fn handle_message(
        &self,
        connection: &Arc<RwLock<Connection>>,
        message: &str,
    ) -> Result<Option<Value>> {
        // Parse JSON-RPC message
        let request: StratumRequest =
            serde_json::from_str(message).map_err(|e| anyhow!("Invalid JSON: {}", e))?;

        let method = request.method.as_str();
        tracing::debug!("🔧 Handling method: {}", method);

        {
            let mut conn = connection.write().await;
            conn.detect_protocol(method);
        }

        match method {
            "login" => self.handle_login(connection, &request).await,
            "submit" => self.handle_xmrig_submit(connection, &request).await,
            "mining.subscribe" => self.handle_subscribe(connection, &request).await,
            "mining.authorize" => self.handle_authorize(connection, &request).await,
            "mining.submit" => self.handle_submit(connection, &request).await,
            "keepalived" => self.handle_keepalive(connection, &request).await,
            "getjob" => self.handle_getjob(connection, &request).await,
            // NCL (Neural Compute Layer) JSON-RPC methods.
            "ncl.register" | "ncl.get_task" | "ncl.submit" | "ncl.status" => {
                self.handle_ncl(connection, &request).await
            }
            _ => Err(anyhow!("Unknown method: {}", method)),
        }
    }

    fn detect_algorithm_from_agent(agent: &str) -> String {
        let a = agent.to_lowercase();
        if a.contains("autolykos") {
            return "autolykos".to_string();
        }
        if a.contains("yescrypt") {
            return "yescrypt".to_string();
        }
        if a.contains("randomx") || a.contains("rx/0") {
            return "randomx".to_string();
        }
        // Default: ZION's native algorithm (Cosmic Harmony)
        "cosmic_harmony".to_string()
    }

    /// Handle login (XMRig protocol)
    async fn handle_login(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let params = request
            .params
            .as_ref()
            .ok_or_else(|| anyhow!("Missing params"))?;

        // Extract login parameters
        let login = params
            .get("login")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing login"))?;

        let wallet = login.trim().to_lowercase();
        let strict_wallet = Self::strict_address_validation();
        if !Self::is_valid_wallet(&wallet, strict_wallet) {
            tracing::warn!("Invalid wallet address: {}", wallet);
            let response = StratumResponse::error(
                request.id.clone(),
                StratumError::invalid_params("Invalid wallet address"),
            );
            return Ok(Some(serde_json::to_value(response)?));
        }

        let pass = params.get("pass").and_then(|v| v.as_str()).unwrap_or("");
        let agent = params.get("agent").and_then(|v| v.as_str()).unwrap_or("");
        let rigid = params.get("rigid").and_then(|v| v.as_str());

        tracing::info!(
            "🔐 Login attempt: wallet={}, worker={:?}, agent={}",
            wallet,
            rigid,
            agent
        );
        let algorithm_hint = Self::parse_algorithm_hint(pass);
        let mut algorithm = algorithm_hint
            .clone()
            .unwrap_or_else(|| Self::detect_algorithm_from_agent(agent));
        let difficulty_hint = Self::parse_difficulty_hint(pass);
        let group_hint = Self::parse_group_hint(pass);

        // Update connection state
        {
            let mut conn = connection.write().await;
            conn.state = ConnectionState::Authenticated;
            conn.wallet_address = Some(wallet.clone());
            conn.worker_name = rigid.map(|s| s.to_string());
            conn.user_agent = Some(agent.to_string());
            conn.algorithm = Some(algorithm.clone());
            if let Some(d) = difficulty_hint {
                conn.difficulty = d;
            }
            conn.current_job_id = Some("initial".to_string());
        }

        // Per-miner connection metric
        metrics::inc_miner_connections(&wallet);

        // Create initial job from latest template (fallback to placeholder)
        let (mut job_id, mut blob, mut height) = if let Some(tpl) = self.template_for_job().await {
            let job_id = Self::job_id_from_template(&tpl);
            let blob = tpl.blob.unwrap_or_else(|| "0".repeat(152));

            // TEST/E2E mode: if miner explicitly selected an algorithm (via pass hint),
            // keep it. Otherwise follow the chain's algorithm schedule.
            if algorithm_hint.is_none() {
                algorithm = Self::algorithm_from_height(tpl.height);
            }

            // Avoid cross-algo nonce collisions in duplicate-share cache.
            let job_id = format!("{}-{}", job_id, algorithm);

            (job_id, blob, tpl.height)
        } else {
            ("initial".to_string(), "0".repeat(152), 0)
        };

        let diff = connection.read().await.difficulty;
        let mut target = Self::compute_job_target_hex(&algorithm, diff);

        {
            let mut conn = connection.write().await;
            conn.current_job_id = Some(job_id.clone());
            conn.algorithm = Some(algorithm.clone());
        }

        // Create session (in-memory)
        let session_id = connection.read().await.session_id.clone();
        let _ = self
            .session_manager
            .get_or_create(
                session_id.clone(),
                wallet.clone(),
                rigid.map(|s| s.to_string()),
                algorithm.clone(),
            )
            .await;

        // Register miner with StreamScheduler for per-miner assignment.
        // If scheduler has a job for this miner, override the default ZION login job.
        let mut seed_hash = String::new();
        if let Some(scheduler) = { self.stream_scheduler.read().await.clone() } {
            let (_group, scheduled_job) = scheduler
                .register_miner_with_hint(&session_id, group_hint)
                .await;
            if let Some(sj) = scheduled_job {
                job_id = sj.job_id.clone();
                blob = sj.blob.clone();
                height = sj.height;
                seed_hash = sj.seed_hash.clone(); // Needed for RandomX initialization
                if !sj.algorithm.is_empty() {
                    algorithm = sj.algorithm.clone();
                }
                target = if sj.target.is_empty() {
                    Self::compute_job_target_hex(&algorithm, diff)
                } else {
                    sj.target.clone()
                };

                let mut conn = connection.write().await;
                conn.current_job_id = Some(job_id.clone());
                conn.algorithm = Some(algorithm.clone());
            }
        }

        // Safety fallback: RandomX requires seed_hash to initialize DAG.
        // If we have a randomx job but seed_hash is empty → revert to cosmic_harmony.
        // This avoids "RandomX not initialized" errors on the client miner.
        // Only applies when falling back to ZION blob (blob is from ZION template, not XMR).
        if (algorithm == "randomx" || algorithm == "rx/0") && seed_hash.is_empty() {
            tracing::warn!(
                "⚠️  RandomX job without seed_hash for session={} — falling back to cosmic_harmony",
                &session_id[..8.min(session_id.len())]
            );
            algorithm = "cosmic_harmony".to_string();
            target = Self::compute_job_target_hex("cosmic_harmony", diff);
            // Re-fetch ZION template blob so the miner gets a valid cosmic_harmony job
            if let Some(tpl) = self.template_for_job().await {
                let fallback_id = Self::job_id_from_template(&tpl);
                job_id = format!("{}-cosmic_harmony", fallback_id);
                blob = tpl.blob.unwrap_or_else(|| "0".repeat(152));
                height = tpl.height;
                seed_hash = String::new();
            }
            let mut conn = connection.write().await;
            conn.current_job_id = Some(job_id.clone());
            conn.algorithm = Some("cosmic_harmony".to_string());
        }

        // Build response - include difficulty for miner compatibility
        let response = StratumResponse::success(
            request.id.clone(),
            json!({
                "id": connection.read().await.session_id,
                "job": {
                    "blob": blob,
                    "job_id": job_id,
                    "target": target,
                    "difficulty": diff,
                    "height": height,
                    "algo": algorithm,
                    "seed_hash": seed_hash,   // Required for RandomX (XMR revenue jobs)
                    "cosmic_state0_endian": Self::COSMIC_STATE0_ENDIAN
                },
                "status": "OK"
            }),
        );

        Ok(Some(serde_json::to_value(response)?))
    }

    /// Handle subscribe (Stratum protocol)
    async fn handle_subscribe(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        tracing::info!("📡 Subscribe from {}", connection.read().await.peer_addr);

        let subscription_id = Uuid::new_v4().to_string();

        {
            let mut conn = connection.write().await;
            conn.subscription_id = Some(subscription_id.clone());
        }

        // P1-25: Use per-session extranonce1 for unique share search space
        let extranonce1 = {
            let conn = connection.read().await;
            conn.extranonce1.clone()
        };

        let response = StratumResponse::success(
            request.id.clone(),
            json!([
                [
                    ["mining.notify", subscription_id],
                    ["mining.set_difficulty", subscription_id]
                ],
                extranonce1, // Per-session extranonce1 (4 bytes hex)
                4            // Extranonce2_size
            ]),
        );

        Ok(Some(serde_json::to_value(response)?))
    }

    /// Handle authorize (Stratum protocol)
    async fn handle_authorize(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let params = request
            .params
            .as_ref()
            .and_then(|p| p.as_array())
            .ok_or_else(|| anyhow!("Invalid authorize params"))?;

        let username = params
            .first()
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing username"))?;

        let password = params.get(1).and_then(|v| v.as_str()).unwrap_or("");
        let difficulty_hint = Self::parse_difficulty_hint(password);
        let algorithm_hint = Self::parse_algorithm_hint(password);
        let group_hint = Self::parse_group_hint(password);

        tracing::info!("🔐 Authorize: {}", username);

        // Parse wallet.worker format
        let parts: Vec<&str> = username.split('.').collect();
        let wallet = parts[0].trim().to_lowercase();
        let worker = parts.get(1).copied();

        let strict_wallet = Self::strict_address_validation();
        if !Self::is_valid_wallet(&wallet, strict_wallet) {
            tracing::warn!("Invalid wallet address: {}", wallet);
            let response = StratumResponse::error(
                request.id.clone(),
                StratumError::invalid_params("Invalid wallet address"),
            );
            return Ok(Some(serde_json::to_value(response)?));
        }

        // Update connection
        {
            let mut conn = connection.write().await;
            conn.state = ConnectionState::Authenticated;
            conn.wallet_address = Some(wallet.clone());
            conn.worker_name = worker.map(|s| s.to_string());
            if let Some(a) = algorithm_hint {
                conn.algorithm = Some(a);
            } else if conn.algorithm.is_none() {
                conn.algorithm = Some("cosmic_harmony".to_string());
            }
            if let Some(d) = difficulty_hint {
                conn.difficulty = d;
            }
        }

        // Create session
        let session_id = connection.read().await.session_id.clone();
        let algo = connection
            .read()
            .await
            .algorithm
            .clone()
            .unwrap_or_else(|| "cosmic_harmony".to_string());
        let _ = self
            .session_manager
            .get_or_create(
                session_id.clone(),
                wallet.clone(),
                worker.map(|s| s.to_string()),
                algo,
            )
            .await;

        // Register miner with StreamScheduler for per-miner assignment.
        // If we already have a scheduled job for this miner, push it immediately.
        if let Some(scheduler) = { self.stream_scheduler.read().await.clone() } {
            let (_group, scheduled_job) = scheduler
                .register_miner_with_hint(&session_id, group_hint)
                .await;
            if let Some(job) = scheduled_job {
                self.broadcast_job_to_sessions(std::slice::from_ref(&session_id), job)
                    .await;
            }
        }

        let response = StratumResponse::success(request.id.clone(), json!(true));

        Ok(Some(serde_json::to_value(response)?))
    }

    /// Handle submit (share submission)
    async fn handle_submit(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        // Extract wallet + worker + difficulty
        let (wallet, worker, difficulty, algorithm, current_job_id) = {
            let conn = connection.read().await;
            let wallet = conn
                .wallet_address
                .as_ref()
                .ok_or_else(|| anyhow!("Not authenticated"))?
                .clone();
            let worker = conn.worker_name.clone();
            let difficulty = conn.difficulty;
            let algorithm = conn
                .algorithm
                .clone()
                .unwrap_or_else(|| "cosmic_harmony".to_string());
            let current_job_id = conn
                .current_job_id
                .clone()
                .unwrap_or_else(|| "current".to_string());
            (wallet, worker, difficulty, algorithm, current_job_id)
        };

        // Parse Stratum submit params.
        // Depending on miner/algorithm, some implementations include extra fields.
        let params = request
            .params
            .as_ref()
            .and_then(|p| p.as_array())
            .ok_or_else(|| anyhow!("Invalid submit params"))?;

        let (found_nonce, found_result) = Self::extract_nonce_and_result(params);

        let job_id = params
            .get(1)
            .and_then(|v| v.as_str())
            .unwrap_or(&current_job_id)
            .to_string();

        // Compatibility: different miners put nonce/result at different positions.
        // Prefer the known layout (idx4/idx5) but fall back to scanning by hex length.
        let nonce = params
            .get(4)
            .and_then(|v| v.as_str())
            .filter(|s| Self::is_hex(s) && s.len() == 8)
            .map(|s| s.to_string())
            .or(found_nonce)
            .ok_or_else(|| anyhow!("Missing nonce"))?;

        // Miner-provided result hash is optional (validator computes the hash itself).
        let result_hex = params
            .get(5)
            .and_then(|v| v.as_str())
            .filter(|s| Self::is_hex(s) && s.len() == 64)
            .map(|s| s.to_string())
            .or(found_result);

        // ═══════════════════════════════════════════════════════════
        // CH v3 Share Routing — Forward external shares to 2miners
        // ═══════════════════════════════════════════════════════════
        // If this job belongs to an external revenue stream (ext-etc-*, ext-rvn-*),
        // route the share to the external pool via RevenueProxy instead of
        // validating it as a ZION block share.
        {
            let scheduler_guard = self.stream_scheduler.read().await;
            if let Some(scheduler) = scheduler_guard.as_ref() {
                let route = scheduler
                    .route_share(
                        &job_id,
                        &nonce,
                        &worker.clone().unwrap_or_default(),
                        result_hex.as_deref().unwrap_or(""),
                    )
                    .await;
                match route {
                    ShareRoute::External(coin) => {
                        tracing::info!(
                            "💱 Share routed to EXTERNAL pool: coin={} job={} wallet={} nonce={}",
                            coin,
                            job_id,
                            wallet,
                            nonce
                        );

                        // Update session stats (count as accepted — external pool will validate)
                        let session_id = {
                            let conn = connection.read().await;
                            conn.session_id.clone()
                        };
                        let mut session = self
                            .session_manager
                            .get_or_create(
                                session_id,
                                wallet.clone(),
                                worker.clone(),
                                algorithm.clone(),
                            )
                            .await;
                        session.record_share_outcome(true);
                        self.session_manager.update(&session).await;

                        {
                            let mut conn = connection.write().await;
                            conn.record_share(true);
                        }

                        metrics::inc_accepted();

                        let response = serde_json::json!({
                            "id": request.id,
                            "jsonrpc": "2.0",
                            "result": { "status": "OK" },
                            "error": serde_json::Value::Null,
                        });
                        return Ok(Some(response));
                    }
                    ShareRoute::Zion => {
                        // Normal ZION share — continue to block validation below
                    }
                }
            }
        }

        if let Some(coin) = self
            .try_forward_external_direct(
                &job_id,
                &nonce,
                &worker.clone().unwrap_or_default(),
                result_hex.as_deref().unwrap_or(""),
            )
            .await
        {
            tracing::info!(
                "💱 Share routed to EXTERNAL pool (direct fallback): coin={} job={} wallet={} nonce={}",
                coin, job_id, wallet, nonce
            );
            let response = serde_json::json!({
                "id": request.id,
                "jsonrpc": "2.0",
                "result": { "status": "OK" },
                "error": serde_json::Value::Null,
            });
            return Ok(Some(response));
        }

        let tpl = self.template_for_job_id(&job_id).await;
        let tpl_height = tpl.as_ref().map(|t| t.height);
        let job_blob = tpl
            .as_ref()
            .and_then(|t| t.blob.clone())
            .unwrap_or_else(|| "0".repeat(152));
        // CRITICAL FIX: Extract algorithm from the job_id suffix (e.g. "h1930-20000000-...-cosmic_harmony")
        // rather than using conn.algorithm, which may be contaminated by external job broadcasts
        // (e.g. "ethash" from ETC TimeSplit phase). The job_id always encodes the correct algorithm
        // that was used when the job was created.
        let algo_for_job = job_id
            .rsplit('-')
            .next()
            .filter(|s| !s.is_empty() && !s.chars().all(|c| c.is_ascii_hexdigit()))
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                tpl_height
                    .map(Self::algorithm_from_height)
                    .unwrap_or_else(|| "cosmic_harmony".to_string())
            });
        let block_target = tpl
            .as_ref()
            .and_then(|t| Self::normalize_block_target_from_template(&algo_for_job, t));

        // DEBUG: Log block_target extraction for share validation
        tracing::info!(
            "🎯 Block target for algo={}: {:?} (template_available={})",
            algo_for_job,
            block_target,
            tpl.is_some()
        );

        let job_target = Self::compute_job_target_hex(&algo_for_job, difficulty);

        let submitted = SubmittedShare {
            job_id,
            nonce,
            result: result_hex,
            algorithm: algo_for_job.clone(),
            job_blob,
            job_target,
            block_target,
            height: tpl_height,
        };

        tracing::info!(
            "📊 Share submit wallet={} worker={:?} algo={} diff={} block_target={:?}",
            wallet,
            worker,
            algo_for_job,
            difficulty,
            submitted.block_target
        );

        let outcome: ProcessedShareOutcome = self
            .share_processor
            .process_share(&submitted, &wallet)
            .await?;

        if outcome.result.valid {
            tracing::info!(
                "📊 Share ACCEPTED: wallet={} job={} algo={} diff={}",
                wallet,
                submitted.job_id,
                algo_for_job,
                difficulty
            );
            metrics::inc_accepted();
        } else {
            tracing::warn!(
                "❌ Share REJECTED: wallet={} job={} reason={}",
                wallet,
                submitted.job_id,
                outcome.result.reason
            );
            metrics::inc_rejected();
        }

        // Update in-memory session stats
        let session_id = {
            let conn = connection.read().await;
            conn.session_id.clone()
        };

        let mut session = self
            .session_manager
            .get_or_create(
                session_id,
                wallet.clone(),
                worker.clone(),
                algo_for_job.clone(),
            )
            .await;
        session.algorithm = algo_for_job.clone();
        session.record_share_outcome(outcome.result.valid);
        self.session_manager.update(&session).await;

        // Track per-connection stats
        {
            let mut conn = connection.write().await;
            conn.record_share(outcome.result.valid);
            conn.algorithm = Some(algo_for_job.clone());
            if outcome.result.valid {
                if let Some(new_diff) = conn.vardiff_on_share(true) {
                    tracing::info!(
                        "🎚️  VarDiff retarget: session={} diff {} -> {}",
                        conn.session_id,
                        conn.difficulty,
                        new_diff
                    );
                    conn.difficulty = new_diff;

                    metrics::inc_vardiff_retarget();

                    if conn.protocol == super::connection_v2::Protocol::Stratum {
                        let msg = json!({
                            "id": null,
                            "method": "mining.set_difficulty",
                            "params": [new_diff]
                        });
                        let _ = Self::send_json(connection, msg).await;

                        // Push a new job immediately so the miner switches to the
                        // updated target without waiting for the next template tick.
                        let target = Self::compute_job_target_hex(&algo_for_job, new_diff);
                        let notify = json!({
                            "id": null,
                            "method": "mining.notify",
                            "params": [
                                submitted.job_id,
                                submitted.job_blob,
                                target,
                                tpl_height.unwrap_or(0),
                                algo_for_job,
                                serde_json::Value::Null,
                                false
                            ]
                        });
                        let _ = Self::send_json(connection, notify).await;
                    }
                }
            }
        }

        // Stratum response: true/false
        let response = StratumResponse::success(request.id.clone(), json!(outcome.result.valid));
        Ok(Some(serde_json::to_value(response)?))
    }

    /// Handle submit (XMRig protocol)
    async fn handle_xmrig_submit(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let conn = connection.read().await;
        let wallet = match conn.wallet_address.as_ref() {
            Some(w) => w.clone(),
            None => {
                let response =
                    StratumResponse::error(request.id.clone(), StratumError::unauthorized());
                return Ok(Some(serde_json::to_value(response)?));
            }
        };
        let worker = conn.worker_name.clone();
        let algorithm = conn
            .algorithm
            .clone()
            .unwrap_or_else(|| "cosmic_harmony".to_string());
        let difficulty = conn.difficulty;

        let params = match request.params.as_ref().and_then(|p| p.as_object()) {
            Some(p) => p,
            None => {
                let response = StratumResponse::error(
                    request.id.clone(),
                    StratumError::invalid_params("Missing submit params"),
                );
                return Ok(Some(serde_json::to_value(response)?));
            }
        };

        let job_id = match params.get("job_id").and_then(|v| v.as_str()) {
            Some(v) if !v.is_empty() => v.to_string(),
            _ => {
                let response = StratumResponse::error(
                    request.id.clone(),
                    StratumError::invalid_params("Missing job_id"),
                );
                return Ok(Some(serde_json::to_value(response)?));
            }
        };

        let nonce = match params.get("nonce").and_then(|v| v.as_str()) {
            Some(v) if !v.is_empty() => v.to_string(),
            _ => {
                let response = StratumResponse::error(
                    request.id.clone(),
                    StratumError::invalid_params("Missing nonce"),
                );
                return Ok(Some(serde_json::to_value(response)?));
            }
        };

        let result = match params.get("result").and_then(|v| v.as_str()) {
            Some(v) if !v.is_empty() => v.to_string(),
            _ => {
                let response = StratumResponse::error(
                    request.id.clone(),
                    StratumError::invalid_params("Missing result"),
                );
                return Ok(Some(serde_json::to_value(response)?));
            }
        };

        // ═══════════════════════════════════════════════════════════
        // Revenue Share Routing — Forward ext-* shares to external pool
        // ═══════════════════════════════════════════════════════════
        // XMRig protocol shares for revenue stream jobs (ext-xmr-*, ext-etc-*)
        // must be forwarded to the external pool, not validated locally.
        {
            let scheduler_guard = self.stream_scheduler.read().await;
            if let Some(scheduler) = scheduler_guard.as_ref() {
                let route = scheduler
                    .route_share(
                        &job_id,
                        &nonce,
                        &worker.clone().unwrap_or_default(),
                        &result,
                    )
                    .await;
                match route {
                    ShareRoute::External(coin) => {
                        tracing::info!(
                            "💱 [XMRig] Share routed to EXTERNAL pool: coin={} job={} wallet={} nonce={}",
                            coin, job_id, wallet, nonce
                        );
                        let session_id = {
                            let conn = connection.read().await;
                            conn.session_id.clone()
                        };
                        let mut session = self
                            .session_manager
                            .get_or_create(
                                session_id,
                                wallet.clone(),
                                worker.clone(),
                                algorithm.clone(),
                            )
                            .await;
                        session.record_share_outcome(true);
                        self.session_manager.update(&session).await;
                        {
                            let mut conn = connection.write().await;
                            conn.record_share(true);
                        }
                        metrics::inc_accepted();
                        let response = serde_json::json!({
                            "id": request.id,
                            "jsonrpc": "2.0",
                            "result": { "status": "OK" },
                            "error": serde_json::Value::Null,
                        });
                        return Ok(Some(response));
                    }
                    ShareRoute::Zion => {
                        // Normal ZION share — continue to validation below
                    }
                }
            }
        }

        if let Some(coin) = self
            .try_forward_external_direct(
                &job_id,
                &nonce,
                &worker.clone().unwrap_or_default(),
                &result,
            )
            .await
        {
            tracing::info!(
                "💱 [XMRig] Share routed to EXTERNAL pool (direct fallback): coin={} job={} wallet={} nonce={}",
                coin, job_id, wallet, nonce
            );
            let response = serde_json::json!({
                "id": request.id,
                "jsonrpc": "2.0",
                "result": { "status": "OK" },
                "error": serde_json::Value::Null,
            });
            return Ok(Some(response));
        }

        // Graceful fallback: if specific job template is not in cache,
        // use current template instead of rejecting with "Job not found".
        let tpl = match self.template_for_job_id(&job_id).await {
            Some(t) => Some(t),
            None => {
                tracing::warn!(
                    "⚠️ Job {} not in cache (base={}), falling back to current template",
                    job_id,
                    Self::base_job_id(&job_id)
                );
                self.template_for_job().await
            }
        };
        let tpl_height = tpl.as_ref().map(|t| t.height);
        let job_blob = tpl
            .as_ref()
            .and_then(|t| t.blob.clone())
            .unwrap_or_else(|| "0".repeat(152));
        // CRITICAL FIX: Extract algorithm from job_id suffix (same as handle_submit_v1)
        // conn.algorithm may be contaminated by external job broadcasts (e.g. "ethash")
        let algo_for_job = job_id
            .rsplit('-')
            .next()
            .filter(|s| !s.is_empty() && !s.chars().all(|c| c.is_ascii_hexdigit()))
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                tpl_height
                    .map(Self::algorithm_from_height)
                    .unwrap_or_else(|| "cosmic_harmony".to_string())
            });
        let block_target = tpl
            .as_ref()
            .and_then(|t| Self::normalize_block_target_from_template(&algo_for_job, t));

        let job_target = Self::compute_job_target_hex(&algo_for_job, difficulty);

        let submitted = SubmittedShare {
            job_id,
            nonce,
            result: Some(result),
            algorithm: algo_for_job.clone(),
            job_blob,
            job_target,
            block_target,
            height: tpl_height,
        };

        let outcome = self
            .share_processor
            .process_share(&submitted, &wallet)
            .await?;

        if outcome.result.valid {
            metrics::inc_accepted();
        } else {
            metrics::inc_rejected();
        }

        // Update session stats
        let session_id = conn.session_id.clone();
        drop(conn);

        let mut session = self
            .session_manager
            .get_or_create(
                session_id,
                wallet.clone(),
                worker.clone(),
                algo_for_job.clone(),
            )
            .await;
        session.algorithm = algo_for_job.clone();
        session.record_share_outcome(outcome.result.valid);
        self.session_manager.update(&session).await;

        // Track per-connection stats.
        // IMPORTANT: We must drop the write lock BEFORE calling send_json(),
        // because send_json() acquires a read lock on the same RwLock.
        // Holding write + requesting read = deadlock on Tokio RwLock.
        let vardiff_retarget: Option<(u64, super::connection_v2::Protocol)> = {
            let mut conn = connection.write().await;
            conn.record_share(outcome.result.valid);
            conn.algorithm = Some(algo_for_job.clone());
            if outcome.result.valid {
                if let Some(new_diff) = conn.vardiff_on_share(true) {
                    tracing::info!(
                        "🎚️  VarDiff retarget: session={} diff {} -> {}",
                        conn.session_id,
                        conn.difficulty,
                        new_diff
                    );
                    let proto = conn.protocol;
                    conn.difficulty = new_diff;
                    metrics::inc_vardiff_retarget();
                    Some((new_diff, proto))
                } else {
                    None
                }
            } else {
                None
            }
            // write lock dropped here
        };

        // Send VarDiff notifications AFTER releasing the write lock
        if let Some((new_diff, proto)) = vardiff_retarget {
            if proto == super::connection_v2::Protocol::Stratum {
                let msg = json!({
                    "id": null,
                    "method": "mining.set_difficulty",
                    "params": [new_diff]
                });
                let _ = Self::send_json(connection, msg).await;

                // Push updated job with new target immediately
                let target = Self::compute_job_target_hex(&algo_for_job, new_diff);
                let notify = json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": [
                        submitted.job_id,
                        submitted.job_blob,
                        target,
                        tpl_height.unwrap_or(0),
                        algo_for_job,
                        serde_json::Value::Null,
                        false
                    ]
                });
                let _ = Self::send_json(connection, notify).await;
            }

            // XMRig protocol does not use `mining.set_difficulty`; push an updated job.
            // Without this, XMRig miners will keep submitting shares for the old
            // target and get mass rejects after VarDiff retarget.
            if proto == super::connection_v2::Protocol::XMRig {
                let height = tpl_height.unwrap_or(0);
                let target = Self::compute_job_target_hex(&algo_for_job, new_diff);
                let msg = json!({
                    "jsonrpc": "2.0",
                    "method": "job",
                    "params": {
                        "job_id": submitted.job_id,
                        "blob": submitted.job_blob,
                        "target": target,
                        "difficulty": new_diff,
                        "height": height,
                        "algo": algo_for_job,
                        "cosmic_state0_endian": Self::COSMIC_STATE0_ENDIAN
                    }
                });
                let _ = Self::send_json(connection, msg).await;
            }
        }

        if outcome.result.valid {
            tracing::info!(
                "📊 Share ACCEPTED: wallet={} job={} algo={} diff={}",
                wallet,
                submitted.job_id,
                algo_for_job,
                difficulty
            );
            // XMRig protocol expects boolean `true` as result, not an object.
            let response = StratumResponse::success(request.id.clone(), json!(true));
            return Ok(Some(serde_json::to_value(response)?));
        }

        tracing::warn!(
            "❌ Share REJECTED: wallet={} job={} reason={}",
            wallet,
            submitted.job_id,
            outcome.result.reason
        );
        let reason = outcome.result.reason.clone();
        let mut err = if reason.to_lowercase().contains("duplicate") {
            StratumError::new(StratumError::DUPLICATE_SHARE, reason.clone())
        } else if reason.to_lowercase().contains("target")
            || reason.to_lowercase().contains("difficulty")
        {
            StratumError::new(StratumError::LOW_DIFFICULTY, reason.clone())
        } else {
            StratumError::new(StratumError::UNKNOWN, reason.clone())
        };
        err.data = Some(json!({
            "reason": reason,
            "algo": submitted.algorithm,
            "job_id": submitted.job_id,
            "difficulty": difficulty,
        }));
        let response = StratumResponse::error(request.id.clone(), err);
        Ok(Some(serde_json::to_value(response)?))
    }

    /// Handle keepalive
    async fn handle_keepalive(
        &self,
        _connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let response =
            StratumResponse::success(request.id.clone(), json!({"status": "KEEPALIVED"}));
        Ok(Some(serde_json::to_value(response)?))
    }

    /// NCL (Neural Compute Layer) handler — Phase B: PoUW aktivace.
    ///
    /// Protokol: JSON-RPC přes stratum spojení.
    /// Miner posílá: ncl.register → ncl.get_task → ncl.submit (opakuje)
    ///
    /// Verifikace: hash_chaining_v1 = blake3(seed) × rounds
    /// Pool ověří stejným výpočtem (deterministické, rychlé).
    async fn handle_ncl(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        if !Self::ncl_enabled() {
            let response = StratumResponse::success(
                request.id.clone(),
                json!({
                    "enabled": false,
                    "status": "ncl_disabled",
                    "message": "NCL is disabled on this pool"
                }),
            );
            return Ok(Some(serde_json::to_value(response)?));
        }

        {
            let conn = connection.read().await;
            if conn.state != ConnectionState::Authenticated {
                let response = StratumResponse::error(
                    request.id.clone(),
                    StratumError::invalid_params("Not authenticated"),
                );
                return Ok(Some(serde_json::to_value(response)?));
            }
        }

        match request.method.as_str() {
            "ncl.register" => self.handle_ncl_register(connection, request).await,
            "ncl.get_task" => self.handle_ncl_get_task(connection, request).await,
            "ncl.submit" => self.handle_ncl_submit(connection, request).await,
            "ncl.status" => self.handle_ncl_status(connection, request).await,
            _ => {
                let response = StratumResponse::success(
                    request.id.clone(),
                    json!({"status": "ok"}),
                );
                Ok(Some(serde_json::to_value(response)?))
            }
        }
    }

    fn ncl_enabled() -> bool {
        std::env::var("ZION_NCL_ENABLED")
            .map(|v| {
                let s = v.trim().to_lowercase();
                s == "1" || s == "true" || s == "yes" || s == "on"
            })
            .unwrap_or(true)
    }

    fn ncl_rounds() -> u32 {
        std::env::var("ZION_NCL_ROUNDS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .map(|n| n.clamp(100, 20_000))
            .unwrap_or(1000)
    }

    /// NCL Register — miner oznamuje NPU schopnosti.
    async fn handle_ncl_register(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let params = request.params.as_ref();
        let npu_type = params
            .and_then(|p| p.get("npu_type"))
            .and_then(|v| v.as_str())
            .unwrap_or("cpu");
        let npu_tflops = params
            .and_then(|p| p.get("npu_tflops"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.5);
        let allocation = params
            .and_then(|p| p.get("allocation"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.25);

        let session_id = connection.read().await.session_id.clone();
        tracing::info!(
            "🧠 NCL register: session={} npu={} ({:.1} TFLOPS) allocation={:.0}%",
            session_id, npu_type, npu_tflops, allocation * 100.0
        );
        metrics::inc_ncl_registered();

        let response = StratumResponse::success(
            request.id.clone(),
            json!({
                "status": "registered",
                "version": "1.0",
                "supported_task_types": ["hash_chaining_v1"],
                "task_fee_percent": 1,
                "miner_share_percent": 89, // WP3.0 §5.5: 89% miners
                "session_id": session_id
            }),
        );
        Ok(Some(serde_json::to_value(response)?))
    }

    /// NCL Get Task — vygeneruje hash_chaining_v1 úkol z aktuálního job seedu.
    ///
    /// Seed je deterministicky odvozený z aktuálního job_id + session_id,
    /// takže každý miner dostane unikátní, ověřitelný úkol.
    async fn handle_ncl_get_task(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let (session_id, current_job_id) = {
            let conn = connection.read().await;
            (
                conn.session_id.clone(),
                conn.current_job_id.clone().unwrap_or_else(|| "genesis".to_string()),
            )
        };

        // Deterministický seed: blake3(job_id || session_id)
        let seed_input = format!("ncl:{}:{}", current_job_id, session_id);
        let seed_hash = blake3::hash(seed_input.as_bytes());
        let seed_hex = hex::encode(seed_hash.as_bytes());

        // Bounded rounds for production safety (env override via ZION_NCL_ROUNDS).
        let rounds: u32 = Self::ncl_rounds();
        let task_id = format!("ncl_{}_{}", &current_job_id[..8.min(current_job_id.len())], &session_id[..8.min(session_id.len())]);

        tracing::debug!(
            "📤 NCL task: {} seed={}... rounds={}",
            task_id, &seed_hex[..16], rounds
        );

        let response = StratumResponse::success(
            request.id.clone(),
            json!({
                "version": "1.0",
                "task_id": task_id,
                "task_type": "hash_chaining_v1",
                "seed": seed_hex,
                "rounds": rounds,
                "max_time_ms": 5000,
                "model": "blake3_chain_v1",
                "input_data": format!("{{\"mode\":\"deterministic\",\"iterations\":{}}}", rounds),
                "reward_multiplier": 1.0
            }),
        );
        metrics::inc_ncl_tasks_created();
        Ok(Some(serde_json::to_value(response)?))
    }

    /// NCL Submit — ověří výsledek hash_chaining_v1 a přidělí bonus.
    ///
    /// Verifikace: blake3(seed)^rounds == submitted_result
    /// Pool provede stejný výpočet k ověření (fast: <100ms).
    async fn handle_ncl_submit(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let params = match request.params.as_ref() {
            Some(p) => p,
            None => {
                let response = StratumResponse::error(
                    request.id.clone(),
                    StratumError::invalid_params("Missing params"),
                );
                return Ok(Some(serde_json::to_value(response)?));
            }
        };

        let task_id = params.get("task_id").and_then(|v| v.as_str()).unwrap_or("");
        // Pool v1 protokol: výsledek je v "result" nebo "result_hash"
        let submitted = params
            .get("result")
            .or_else(|| params.get("result_hash"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if task_id.trim().is_empty() {
            let response = StratumResponse::error(
                request.id.clone(),
                StratumError::invalid_params("Missing task_id"),
            );
            return Ok(Some(serde_json::to_value(response)?));
        }

        // Zrekonstruujeme seed z task_id (obsahuje prefix job_id a session_id)
        let (session_id, current_job_id) = {
            let conn = connection.read().await;
            (
                conn.session_id.clone(),
                conn.current_job_id.clone().unwrap_or_else(|| "genesis".to_string()),
            )
        };
        let seed_input = format!("ncl:{}:{}", current_job_id, session_id);
        let seed_hash = blake3::hash(seed_input.as_bytes());
        let seed_hex = hex::encode(seed_hash.as_bytes());

        // Spustíme verifikaci asynchronně (CPU-bound → spawn_blocking)
        let rounds: u32 = Self::ncl_rounds();
        let expected = {
            let seed_bytes = match hex::decode(&seed_hex) {
                Ok(b) => b,
                Err(_) => {
                    tracing::warn!("NCL submit: invalid seed hex");
                    return Ok(Some(serde_json::to_value(StratumResponse::error(
                        request.id.clone(),
                        StratumError::invalid_params("Bad seed"),
                    ))?));
                }
            };
            tokio::task::spawn_blocking(move || {
                let mut state = [0u8; 32];
                state.copy_from_slice(&seed_bytes[..32]);
                for _ in 0..rounds {
                    let h = blake3::hash(&state);
                    state.copy_from_slice(h.as_bytes());
                }
                hex::encode(state)
            })
            .await?
        };

        // Normalizovat submitted hex (strip 0x prefix)
        let submitted_clean: String = submitted.trim_start_matches("0x").to_lowercase();
        if submitted_clean.len() != 64 || !Self::is_hex(&submitted_clean) {
            metrics::inc_ncl_tasks_rejected();
            let response = StratumResponse::error(
                request.id.clone(),
                StratumError::invalid_params("Invalid result format"),
            );
            return Ok(Some(serde_json::to_value(response)?));
        }
        metrics::inc_ncl_tasks_submitted();
        let valid = submitted_clean == expected;

        if valid {
            tracing::info!(
                "✅ NCL share accepted: task={} session={}",
                task_id, session_id
            );
            let response = StratumResponse::success(
                request.id.clone(),
                json!({
                    "status": "accepted",
                    "task_id": task_id,
                    "bonus_zion": 0.001,
                    "message": "NCL PoUW share accepted"
                }),
            );
            metrics::inc_ncl_tasks_accepted();
            Ok(Some(serde_json::to_value(response)?))
        } else {
            tracing::warn!(
                "❌ NCL share rejected: task={} session={} submitted={}... expected={}...",
                task_id, session_id,
                &submitted_clean[..16.min(submitted_clean.len())],
                &expected[..16]
            );
            let response = StratumResponse::error(
                request.id.clone(),
                StratumError::invalid_params("NCL result mismatch"),
            );
            metrics::inc_ncl_tasks_rejected();
            Ok(Some(serde_json::to_value(response)?))
        }
    }

    /// NCL Status — vrátí stav NCL integrace pro toto session.
    async fn handle_ncl_status(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let session_id = connection.read().await.session_id.clone();
        let response = StratumResponse::success(
            request.id.clone(),
            json!({
                "version": "1.0",
                "enabled": true,
                "session_id": session_id,
                "supported_types": ["hash_chaining_v1"],
                "task_interval_ms": 5000,
                "rounds": Self::ncl_rounds(),
                "fee_percent": 10
            }),
        );
        Ok(Some(serde_json::to_value(response)?))
    }

    /// Handle getjob — returns current scheduled job (Revenue XMR/ETC or ZION cosmic_harmony)
    async fn handle_getjob(
        &self,
        connection: &Arc<RwLock<Connection>>,
        request: &StratumRequest,
    ) -> Result<Option<Value>> {
        let (difficulty, _algo_hint) = {
            let conn = connection.read().await;
            tracing::debug!("📋 Job request from session {}", conn.session_id);
            (conn.difficulty, conn.algorithm.clone())
        };

        // ─── Check if stream scheduler has an active Revenue job ───
        // If the scheduler is in Revenue phase with an external job (XMR/ETC),
        // return that job instead of the default ZION cosmic_harmony.
        // This prevents getjob polling from overwriting push-delivered Revenue jobs.
        {
            let scheduler_guard = self.stream_scheduler.read().await;
            if let Some(scheduler) = scheduler_guard.as_ref() {
                if let Some(sched_job) = scheduler.current_job().await {
                    // Check if this is a Revenue external job (not ZION)
                    if sched_job.job_id.starts_with("ext-") {
                        let target = if sched_job.target.is_empty() {
                            Self::compute_job_target_hex(&sched_job.algorithm, difficulty)
                        } else {
                            sched_job.target.clone()
                        };

                        {
                            let mut conn = connection.write().await;
                            conn.current_job_id = Some(sched_job.job_id.clone());
                            conn.algorithm = Some(sched_job.algorithm.clone());
                        }

                        tracing::debug!(
                            "📋 getjob → returning Revenue job: {} algo={}",
                            sched_job.job_id,
                            sched_job.algorithm
                        );

                        let response = StratumResponse::success(
                            request.id.clone(),
                            json!({
                                "blob": sched_job.blob,
                                "job_id": sched_job.job_id,
                                "target": target,
                                "difficulty": sched_job.difficulty as u64,
                                "height": sched_job.height,
                                "algo": sched_job.algorithm,
                                "seed_hash": sched_job.seed_hash,
                                "coin": sched_job.coin,
                            }),
                        );
                        return Ok(Some(serde_json::to_value(response)?));
                    }
                }
            }
        }

        // ─── Default: ZION cosmic_harmony job ───
        let (job_id, blob, height, algorithm) = if let Some(tpl) = self.template_for_job().await {
            let base_job_id = Self::job_id_from_template(&tpl);
            let blob = tpl.blob.unwrap_or_else(|| "0".repeat(152));
            // Always use chain-schedule algorithm for ZION template jobs.
            // algo_hint from connection may be "ethash" from a previous external job.
            let algorithm = Self::algorithm_from_height(tpl.height);
            let job_id_for_conn = format!("{}-{}", base_job_id, algorithm);
            (job_id_for_conn, blob, tpl.height, algorithm)
        } else {
            (
                "current-cosmic_harmony".to_string(),
                "0".repeat(152),
                0,
                "cosmic_harmony".to_string(),
            )
        };

        {
            let mut conn = connection.write().await;
            conn.current_job_id = Some(job_id.clone());
            conn.algorithm = Some(algorithm.clone());
        }

        let target = Self::compute_job_target_hex(&algorithm, difficulty);

        let response = StratumResponse::success(
            request.id.clone(),
            json!({
                "blob": blob,
                "job_id": job_id,
                "target": target,
                "difficulty": difficulty,
                "height": height,
                "algo": algorithm,
                "cosmic_state0_endian": Self::COSMIC_STATE0_ENDIAN
            }),
        );

        Ok(Some(serde_json::to_value(response)?))
    }

    /// Background task to clean up inactive connections
    async fn connection_cleaner(&self) {
        let mut cleanup_interval = interval(Duration::from_secs(60));

        loop {
            cleanup_interval.tick().await;

            let mut to_remove = Vec::new();

            // Find inactive connections — clone to avoid holding read lock during iteration
            {
                let connections = self.connections.read().await;
                let snapshot: Vec<(String, Arc<RwLock<Connection>>)> = connections
                    .iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect();
                drop(connections); // Release read lock ASAP

                for (session_id, connection) in &snapshot {
                    let conn = connection.read().await;
                    // Aggressive cleanup for miner reconnect scenarios (CH v3 stream switching):
                    // old sockets should be removed quickly to avoid per-IP limit exhaustion.
                    if conn.is_stale(Duration::from_secs(90)) {
                        // 5 minutes timeout
                        to_remove.push(session_id.clone());
                    }
                }
            }

            // Remove stale connections
            if !to_remove.is_empty() {
                tracing::info!("🧹 Cleaning {} stale connections", to_remove.len());

                let mut connections = self.connections.write().await;
                let removed = to_remove
                    .iter()
                    .filter(|sid| connections.remove(*sid).is_some())
                    .count();
                drop(connections);
                // Adjust atomic counter
                self.connection_count.fetch_sub(removed, Ordering::Relaxed);
            }
        }
    }

    /// Get connection count
    pub async fn connection_count(&self) -> usize {
        self.connection_count.load(Ordering::Relaxed)
    }

    /// Broadcast message to all authenticated connections
    pub async fn broadcast(&self, message: Value) -> Result<usize> {
        // Clone connections out of the lock
        let conns: Vec<Arc<RwLock<Connection>>> = {
            let connections = self.connections.read().await;
            connections.values().cloned().collect()
        };
        let mut count = 0;

        for connection in &conns {
            let conn = connection.read().await;
            if conn.state == ConnectionState::Authenticated {
                drop(conn);
                if let Err(e) = Self::send_json(connection, message.clone()).await {
                    tracing::debug!("Failed to send broadcast: {}", e);
                } else {
                    count += 1;
                }
            }
        }

        tracing::debug!("📢 Broadcasted to {} connections", count);
        Ok(count)
    }

    /// Broadcast new mining job to all connected miners
    /// REVENUE-GUARD: Skip miners that are in Revenue phase (have ext-* job)
    pub async fn broadcast_new_job(&self, template: BlockTemplate) {
        self.cache_template(&template).await;
        let job_id = Self::job_id_from_template(&template);
        let blob = template.blob.clone().unwrap_or_else(|| "0".repeat(152));
        let height = template.height;

        let scheduler_opt = { self.stream_scheduler.read().await.clone() };
        let per_miner_mode = match scheduler_opt.as_ref() {
            Some(sched) => sched.is_per_miner_mode().await,
            None => false,
        };

        // ── Revenue-phase guard ──────────────────────────────────
        // If StreamScheduler is in Revenue phase (phase != 0), do NOT
        // overwrite miners with cosmic_harmony — they should keep their
        // ext-xmr-* job until the scheduler switches back to ZION.
        if !per_miner_mode {
            let on_zion = match scheduler_opt.as_ref() {
                Some(sched) => sched.is_on_zion_phase().await,
                None => true, // no scheduler → always broadcast
            };
            if !on_zion {
                tracing::debug!(
                    "📢 Skipping broadcast_new_job (height={}) — Revenue phase active",
                    height
                );
                // Still cache the template for validation but don't push to miners
                return;
            }
        }

        // Clone connections out of the lock to avoid deadlock
        let conns: Vec<(String, Arc<RwLock<Connection>>)> = {
            let connections = self.connections.read().await;
            connections
                .iter()
                .map(|(sid, c)| (sid.clone(), c.clone()))
                .collect()
        };
        let mut sent = 0;

        for (session_id, connection) in &conns {
            if per_miner_mode {
                if let Some(sched) = scheduler_opt.as_ref() {
                    let group = sched.get_miner_group(session_id).await;
                    // Dual miners self-route secondary coin but still receive ZION jobs
                    if group != MinerGroup::Zion && group != MinerGroup::Dual {
                        continue;
                    }
                }
            }

            let conn = connection.read().await;
            if conn.state != ConnectionState::Authenticated {
                continue;
            }

            let difficulty = conn.difficulty;
            let protocol = conn.protocol;
            // CRITICAL: Always use chain-schedule algorithm for ZION template jobs.
            // Do NOT inherit conn.algorithm here — it may be "ethash" from a previous
            // external ETC job broadcast by StreamScheduler.  That would cause the
            // miner to submit an ethash-tagged share for a ZION blob, which the
            // validator cannot verify (Algorithm::Unknown → rejected).
            let algorithm = Self::algorithm_from_height(height);
            drop(conn);

            let target = Self::compute_job_target_hex(&algorithm, difficulty);

            // Per-algo job id avoids duplicate-share collisions across algos.
            let job_id_for_conn = format!("{}-{}", job_id, algorithm);

            // Send mining.notify for Stratum protocol
            // Format: [job_id, blob, target, height, algo, seed_hash, clean_jobs]
            if protocol == super::connection_v2::Protocol::Stratum {
                let notify = json!({
                    "id": null,
                    "method": "mining.notify",
                    "params": [
                        job_id_for_conn.clone(),  // [0] job_id
                        blob.clone(),              // [1] blob
                        target.clone(),            // [2] target hex
                        height,                    // [3] height
                        algorithm.clone(),         // [4] algorithm name
                        "",                        // [5] seed_hash (empty for non-RandomX)
                        true,                      // [6] clean_jobs
                    ]
                });

                if Self::send_json(connection, notify).await.is_ok() {
                    sent += 1;
                }
            }

            // XMRig JSON-RPC protocol expects `{"method":"job","params":{...}}` pushes.
            // Without this, XMRig miners keep working on the login template forever and
            // their submits become invalid as soon as the pool updates the template.
            if protocol == super::connection_v2::Protocol::XMRig {
                let msg = json!({
                    "jsonrpc": "2.0",
                    "method": "job",
                    "params": {
                        "job_id": job_id_for_conn.clone(),
                        "blob": blob.clone(),
                        "target": target,
                        "difficulty": difficulty,
                        "height": height,
                        "algo": algorithm,
                        "cosmic_state0_endian": Self::COSMIC_STATE0_ENDIAN
                    }
                });
                if Self::send_json(connection, msg).await.is_ok() {
                    sent += 1;
                }
            }

            // Update connection's current_job_id
            {
                let mut conn = connection.write().await;
                conn.current_job_id = Some(job_id_for_conn);
                conn.algorithm = Some(algorithm.clone());
            }
        }

        tracing::info!(
            "📢 Broadcasted new job (height={}) to {} miners",
            height,
            sent
        );
        metrics::inc_job_broadcasts();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shares::{RedisStorage, ShareProcessor, ShareValidator};

    #[tokio::test]
    async fn test_server_creation() {
        let session_manager = Arc::new(SessionManager::new());
        let storage = Arc::new(RedisStorage::new("redis://localhost", 1000).unwrap());
        let validator = Arc::new(ShareValidator::new("little"));
        let share_processor = Arc::new(ShareProcessor::new(
            validator,
            storage,
            None,
            "ZION_TEST_WALLET".to_string(),
            "ZION_HUMANITARIAN_WALLET".to_string(),
            1.0,
            10.0,
            1000,
        ));

        let server = StratumServer::new(
            "127.0.0.1".to_string(),
            3333,
            session_manager,
            share_processor,
            Some(1000),
        );

        assert_eq!(server.max_connections, 1000);
        assert_eq!(server.connection_count().await, 0);
    }
}
