use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use anyhow::Context;
use ed25519_dalek::SigningKey;
use zion_cosmic_harmony::ExternalCoin;
use zion_l1_types::{Address, ChainId};

use crate::config::PoolConfig;
use crate::share::ShareSubmission;
use crate::telemetry::MinerTelemetryRegistry;
use crate::v3_pplns::{PayoutEntry, PplnsConfig, PplnsEngine};
use crate::validator::ShareValidator;

#[derive(Clone, Copy, Debug, thiserror::Error)]
pub enum PoolError {
    #[error("nonce parse error")]
    Parse,
    #[error("invalid share")]
    Invalid,
    #[error("unknown job")]
    UnknownJob,
    #[error("unauthorized worker")]
    Unauthorized,
    #[error("coin not enabled for native payouts")]
    CoinNotNative,
    #[error("revenue event already processed")]
    DuplicateRevenueEvent,
}

/// Result of applying a native-coin revenue event (`on_coin_revenue`).
#[derive(Debug, Clone)]
pub struct CoinRevenueOutcome {
    /// Normalized coin ticker.
    pub coin: String,
    /// Revenue distributed (native base units).
    pub amount: u64,
    /// Payout entries emitted this event (below-threshold balances keep
    /// accruing in `unpaid_native` and are not listed here).
    pub emitted: usize,
    /// Sum of emitted amounts — equals `amount` only when every share
    /// holder had a valid payout address on the coin's chain.
    pub emitted_total: u64,
    /// Generated native payouts, persisted to the SQLite outbox by the API
    /// before the PPLNS snapshot is committed.
    pub payouts: Vec<(u64, PayoutEntry)>,
}

/// Stratum connection/session counters shared between every
/// `StratumServer` listener (primary port, extra ports, TLS) and the HTTP
/// API. Cloning the handle shares the same underlying atomics.
#[derive(Clone, Debug, Default)]
pub struct SessionCounters {
    /// Currently open stratum sessions.
    pub active_sessions: Arc<AtomicU64>,
    /// Cumulative accepted connections since start.
    pub total_connections: Arc<AtomicU64>,
}

#[derive(Debug)]
pub struct Pool {
    pub config: PoolConfig,
    pub pplns: PplnsEngine,
    pub validator: ShareValidator,
    pub current_job_id: AtomicU64,
    pub accepted: AtomicU64,
    pub rejected: AtomicU64,
    pub pplns_persist_success_timestamp_s: u64,
    pub pplns_persist_failures_total: u64,
    /// Live stratum session counters for the HTTP API.
    pub session_counters: SessionCounters,
    /// Authorized worker name -> payout address (anonymous mining).
    pub worker_addresses: HashMap<String, Address>,
    /// Worker name -> (external chain, raw address) for non-ZION payouts
    /// (e.g. `qtc:<ss58>` Quantus payouts).  Entries here bypass the ZION
    /// UTXO sweeper and are drained by the multichain payout sweeper via
    /// `POST /admin/external-payouts/drain`.
    pub worker_ext_payouts: HashMap<String, (String, String)>,
    /// Last computed payouts for a found block, keyed by block height.
    pub last_payouts: Option<(u64, Vec<PayoutEntry>)>,
    /// Ed25519 signing key for the pool payout wallet (hex 32 bytes).
    pub signing_key: Option<SigningKey>,
    /// Payouts waiting to be submitted on-chain.
    pub pending_payouts: Vec<(u64, PayoutEntry)>,
    /// (block_height, address) pairs already submitted to the wallet.
    pub sent_payouts: HashSet<(u64, String)>,
    /// Block heights that have already been processed for payout (idempotency guard).
    paid_block_heights: HashSet<u64>,
    /// Shared per-worker telemetry registry (hashrate, shares, blocks).
    pub telemetry: Arc<Mutex<MinerTelemetryRegistry>>,
    pub(crate) pearl: Option<Arc<crate::pearl_gateway::PearlRuntime>>,
}

impl Pool {
    pub fn new(config: PoolConfig, telemetry: Arc<Mutex<MinerTelemetryRegistry>>) -> Self {
        Self::try_new(config, telemetry)
            .unwrap_or_else(|e| panic!("failed to initialize pool: {e:#}"))
    }

    pub fn try_new(
        config: PoolConfig,
        telemetry: Arc<Mutex<MinerTelemetryRegistry>>,
    ) -> anyhow::Result<Self> {
        let pplns_config = PplnsConfig {
            window_size: config.pplns_window_size,
            min_payout_flowers: config.min_payout_flowers,
            fee_config: config.fee_config.clone(),
            native_payout_coins: config.native_payout_coins.clone(),
            min_payout_native: config.min_payout_native.clone(),
        };
        let mut pplns = PplnsEngine::new(pplns_config);
        if let Some(path) = config.state_path.as_ref() {
            if let Some(snap) = PplnsEngine::load_from_path(path)
                .with_context(|| format!("failed to load PPLNS state from {path}"))?
            {
                pplns.restore(snap);
            }
        }
        let signing_key = config.pool_wallet_key.as_deref().and_then(|hex_str| {
            let bytes = hex::decode(hex_str).ok()?;
            let arr = <[u8; 32]>::try_from(bytes).ok()?;
            Some(SigningKey::from_bytes(&arr))
        });
        Ok(Self {
            config,
            pplns,
            validator: ShareValidator::new(),
            current_job_id: AtomicU64::new(1),
            accepted: AtomicU64::new(0),
            rejected: AtomicU64::new(0),
            pplns_persist_success_timestamp_s: 0,
            pplns_persist_failures_total: 0,
            session_counters: SessionCounters::default(),
            worker_addresses: HashMap::new(),
            worker_ext_payouts: HashMap::new(),
            last_payouts: None,
            signing_key,
            pending_payouts: Vec::new(),
            sent_payouts: HashSet::new(),
            paid_block_heights: HashSet::new(),
            telemetry,
            pearl: crate::pearl_gateway::PearlRuntime::from_env(),
        })
    }

    pub fn next_job_id(&self) -> u64 {
        self.current_job_id.fetch_add(1, Ordering::Relaxed) + 1
    }

    fn parse_nonce(nonce_hex: &str) -> Result<u64, PoolError> {
        let s = nonce_hex
            .trim()
            .trim_start_matches("0x")
            .trim_start_matches("0X");
        u64::from_str_radix(s, 16).map_err(|_| PoolError::Parse)
    }

    fn record_share(&mut self, submission: &ShareSubmission, height: u64, coin: &str) {
        let worker = &submission.worker;
        let (chain, address) = self.worker_payout_target(worker);
        self.pplns
            .register_address_with_chain(worker, &address, &chain);
        let share_difficulty = submission.difficulty.max(1);
        self.pplns
            .record_share_with_diff_for_coin(worker, worker, height, share_difficulty, coin);
    }

    /// Credit an accepted external (AuxPoW) stream share into PPLNS so the
    /// miner earns ZION for upstream-verified work (multi-algo phase C).
    ///
    /// External shares carry no meaningful ZION difficulty — upstream
    /// targets are coin-specific — so they are credited at an explicit
    /// configured weight (`ZION_POOL_AUXPOW_WEIGHT_<COIN>` override, else
    /// `ZION_POOL_AUXPOW_PPLNS_WEIGHT`, default 500 ≈ the vardiff floor).
    /// The external coin itself stays with the pool as revenue; the ZION
    /// PPLNS credit is what the miner is paid out of.
    pub fn record_external_share(
        &mut self,
        _miner_id: &str,
        worker_name: &str,
        height: u64,
        weight: u64,
        coin: &str,
    ) {
        let (chain, address) = self.worker_payout_target(worker_name);
        self.pplns
            .register_address_with_chain(worker_name, &address, &chain);
        self.pplns.record_share_with_diff_for_coin(
            worker_name,
            worker_name,
            height,
            weight.max(1),
            coin,
        );
    }

    /// Resolve a worker string to its `(chain, payout_address)` target.
    ///
    /// `qtc:<ss58>` / bare `qz…` SS58 → `("quantus", ss58)`; `zion1…` →
    /// `("zion", encoded)`; anything else falls back to the pool wallet
    /// (shares still counted, payout retained by the pool).
    fn worker_payout_target(&self, worker: &str) -> (String, String) {
        let wallet = worker.split('.').next().unwrap_or(worker).trim();
        if let Some((chain, addr)) = self
            .worker_ext_payouts
            .get(worker)
            .or_else(|| self.worker_ext_payouts.get(wallet))
        {
            return (chain.clone(), addr.clone());
        }
        if let Some(ss58) = parse_quantus_payout(wallet) {
            return ("quantus".to_string(), ss58);
        }
        if let Some(prl) = parse_pearl_payout(wallet) {
            return ("pearl".to_string(), prl);
        }
        if let Some(addr) = self
            .worker_addresses
            .get(worker)
            .or_else(|| self.worker_addresses.get(wallet))
            .cloned()
            .or_else(|| parse_worker_address(worker))
        {
            return ("zion".to_string(), addr.encoded);
        }
        ("zion".to_string(), self.config.pool_address.encoded.clone())
    }

    /// `true` when `wallet` parses to a known payout target (ZION / QTU /
    /// PRL address, optionally `chain:`-tagged).  Public-authorize guard —
    /// garbage wallets would otherwise silently mine to the pool address.
    pub fn wallet_is_valid(&self, wallet: &str) -> bool {
        let wallet = wallet.split('.').next().unwrap_or(wallet).trim();
        parse_quantus_payout(wallet).is_some()
            || parse_pearl_payout(wallet).is_some()
            || parse_worker_address(wallet).is_some()
    }

    pub fn register_worker(&mut self, worker: &str) {
        let wallet = worker.split('.').next().unwrap_or(worker).trim();
        if let Some(ss58) = parse_quantus_payout(wallet) {
            self.worker_ext_payouts
                .insert(worker.to_string(), ("quantus".to_string(), ss58.clone()));
            self.pplns
                .register_address_with_chain(worker, &ss58, "quantus");
            return;
        }
        if let Some(prl) = parse_pearl_payout(wallet) {
            self.worker_ext_payouts
                .insert(worker.to_string(), ("pearl".to_string(), prl.clone()));
            self.pplns
                .register_address_with_chain(worker, &prl, "pearl");
            return;
        }
        if let Some(addr) = parse_worker_address(worker) {
            self.worker_addresses
                .insert(worker.to_string(), addr.clone());
            self.pplns.register_address(worker, &addr.encoded);
        }
    }

    /// Register an explicit payout address for a miner (v3 Hello
    /// `payout_address` field).  Accepts `qtc:<ss58>`/`qtu:<ss58>`/bare
    /// `qz…` for Quantus payouts and `zion1…` for native payouts.
    /// Returns the registered `(chain, address)` on success.
    pub fn register_payout_address<'a>(
        &mut self,
        miner_id: &str,
        address: &'a str,
    ) -> Option<(&'static str, &'a str)> {
        let addr = address.trim();
        if let Some(ss58) = parse_quantus_payout(addr) {
            self.worker_ext_payouts
                .insert(miner_id.to_string(), ("quantus".to_string(), ss58.clone()));
            self.pplns
                .register_address_with_chain(miner_id, &ss58, "quantus");
            return Some(("quantus", addr));
        }
        if let Some(_prl) = parse_pearl_payout(addr) {
            self.worker_ext_payouts
                .insert(miner_id.to_string(), ("pearl".to_string(), _prl.clone()));
            self.pplns
                .register_address_with_chain(miner_id, &_prl, "pearl");
            return Some(("pearl", addr));
        }
        if addr.starts_with("zion1") {
            if let Ok(parsed) = Address::new(ChainId::ZionL1, addr.as_bytes().to_vec(), addr) {
                self.worker_addresses
                    .insert(miner_id.to_string(), parsed.clone());
                self.pplns.register_address(miner_id, &parsed.encoded);
                return Some(("zion", addr));
            }
        }
        None
    }

    pub fn submit_zion(
        &mut self,
        submission: ShareSubmission,
        header: &[u8],
        height: u64,
    ) -> Result<bool, PoolError> {
        let target = self.config.zion_target;
        self.submit_zion_with_target(submission, header, height, &target)
    }

    pub fn submit_zion_with_target(
        &mut self,
        submission: ShareSubmission,
        header: &[u8],
        height: u64,
        target: &[u8; 32],
    ) -> Result<bool, PoolError> {
        let nonce = Self::parse_nonce(&submission.nonce_hex)?;
        if self.validator.validate_zion(header, nonce, target) {
            self.record_share(&submission, height, "zion");
            self.accepted.fetch_add(1, Ordering::Relaxed);
            Ok(true)
        } else {
            self.rejected.fetch_add(1, Ordering::Relaxed);
            Err(PoolError::Invalid)
        }
    }

    pub fn submit_auxpow(
        &mut self,
        coin: ExternalCoin,
        submission: ShareSubmission,
        header: &[u8],
        height: u64,
    ) -> Result<bool, PoolError> {
        let target = self.config.auxpow_target;
        self.submit_auxpow_with_target(coin, submission, header, height, &target)
    }

    pub fn submit_auxpow_with_target(
        &mut self,
        coin: ExternalCoin,
        submission: ShareSubmission,
        header: &[u8],
        height: u64,
        target: &[u8; 32],
    ) -> Result<bool, PoolError> {
        let nonce = Self::parse_nonce(&submission.nonce_hex)?;
        if self.validator.validate_auxpow(coin, header, nonce, target) {
            self.record_share(&submission, height, coin.as_str());
            self.accepted.fetch_add(1, Ordering::Relaxed);
            Ok(true)
        } else {
            self.rejected.fetch_add(1, Ordering::Relaxed);
            Err(PoolError::Invalid)
        }
    }

    /// Compute miner payouts for the given full block subsidy.
    ///
    /// The node coinbase already splits the block reward 89/5/5/1, so the pool
    /// only redistributes the miner share (89% minus rounding dust).
    pub fn payouts(&mut self, block_reward: u64) -> Vec<PayoutEntry> {
        let miner_share = zion_core::emission::fee_split(block_reward).0;
        self.pplns.compute_miner_payouts(miner_share)
    }

    /// Record a found block and compute PPLNS payouts for it.
    pub fn on_block_found(&mut self, block_height: u64, block_reward: u64) {
        if !self.paid_block_heights.insert(block_height) {
            return;
        }
        let payouts = self.payouts(block_reward);
        for payout in payouts {
            let key = (block_height, payout.address.clone());
            if !self.sent_payouts.contains(&key) {
                self.pending_payouts.push((block_height, payout));
            }
        }
        self.last_payouts = Some((
            block_height,
            self.pending_payouts
                .iter()
                .map(|(_, p)| p.clone())
                .collect(),
        ));
    }

    /// Apply a native-coin revenue event (F3): the treasury oracle observed
    /// `amount_native` base units of new income for `coin` (node-authored
    /// blocks landing in the node wallet, or upstream-pool payouts into our
    /// per-coin account).  Distributes it across the coin's PPLNS slice and
    /// queues `native_units` payout entries tagged with `event_id`.
    ///
    /// Fail-closed rules:
    /// - `coin` must be listed in `native_payout_coins` — otherwise its
    ///   shares would also earn from the unified ZION distribution and the
    ///   event would double-pay.
    /// - `event_id` must be unique (oracle-supplied, e.g. `"qtu:rev:42"`);
    ///   repeats are rejected so POST retries cannot double-distribute.
    pub fn on_coin_revenue(
        &mut self,
        coin: &str,
        amount_native: u64,
        ref_height: u64,
        event_id: &str,
    ) -> Result<CoinRevenueOutcome, PoolError> {
        let coin = coin.trim().to_ascii_lowercase();
        if !self.pplns.is_native_payout_coin(&coin) {
            return Err(PoolError::CoinNotNative);
        }
        if event_id.is_empty() || self.pplns.has_applied_revenue_event(event_id) {
            return Err(PoolError::DuplicateRevenueEvent);
        }

        let chain = crate::coin_leg::payout_chain_for_coin(&coin).into_owned();
        let mut entries = self
            .pplns
            .compute_miner_payouts_for_coin(&coin, amount_native, &chain);
        for entry in &mut entries {
            entry.revenue_event = Some(event_id.to_string());
        }
        let payouts: Vec<_> = entries
            .into_iter()
            .map(|entry| (ref_height, entry))
            .collect();
        self.pending_payouts.extend(payouts.iter().cloned());
        self.pplns.mark_revenue_event_applied(event_id);
        let emitted_total = payouts
            .iter()
            .map(|(_, payout)| payout.amount)
            .fold(0u64, u64::saturating_add);
        Ok(CoinRevenueOutcome {
            coin,
            amount: amount_native,
            emitted: payouts.len(),
            emitted_total,
            payouts,
        })
    }

    pub fn stats(&self) -> (u64, u64) {
        (
            self.accepted.load(Ordering::Relaxed),
            self.rejected.load(Ordering::Relaxed),
        )
    }

    pub fn pool_address(&self) -> &Address {
        &self.config.pool_address
    }

    /// Persist the current PPLNS state, if a state path is configured.
    ///
    /// Returns `Ok(true)` if a snapshot was written because the state was dirty,
    /// `Ok(false)` if there was nothing to save, and `Err` only on I/O failure.
    pub fn save(&mut self) -> std::io::Result<bool> {
        if let Some(path) = self.config.state_path.as_ref() {
            match self.pplns.save_if_dirty(path) {
                Ok(saved) => {
                    if saved {
                        self.pplns_persist_success_timestamp_s =
                            crate::telemetry::now_unix_seconds();
                    }
                    Ok(saved)
                }
                Err(e) => {
                    self.pplns_persist_failures_total =
                        self.pplns_persist_failures_total.saturating_add(1);
                    Err(e)
                }
            }
        } else {
            Ok(false)
        }
    }

    /// Restore PPLNS state from the configured path, if any.
    pub fn restore(&mut self) -> std::io::Result<()> {
        if let Some(path) = self.config.state_path.as_ref() {
            if let Some(snap) = PplnsEngine::load_from_path(path)? {
                self.pplns.restore(snap);
            }
        }
        Ok(())
    }

    /// Drain and return the queued ZION payouts for the sweep thread.
    /// External-chain entries (e.g. Quantus) stay queued — they are drained
    /// via [`take_external_payouts`].
    pub fn take_pending_payouts(&mut self) -> Vec<(u64, PayoutEntry)> {
        let (zion, ext): (Vec<_>, Vec<_>) = std::mem::take(&mut self.pending_payouts)
            .into_iter()
            .partition(|(_, p)| p.chain() == "zion");
        self.pending_payouts = ext;
        zion
    }

    /// Live snapshot of every coin leg — the runtime counterpart of
    /// `coin_leg`'s static registry.  Consumed by the stratum router and
    /// the `/public/v1/coins` API tier.
    pub fn leg_statuses(
        &self,
        multi_bridge: &crate::auxpow_bridge::MultiAuxPowBridge,
    ) -> Vec<crate::coin_leg::LegStatus> {
        use crate::coin_leg::{LegKind, LegStatus};
        let mut legs: Vec<LegStatus> = Vec::new();

        // ZION native — always served; "connected" = node RPC configured.
        legs.push(LegStatus {
            leg_id: "zion".into(),
            coin: "ZION".into(),
            kind: LegKind::Native,
            enabled: true,
            connected: self.config.l1_rpc_url.is_some(),
            job_id: None,
            job_age_ms: None,
            share_pct: None,
        });

        // QTC native leg (own quantus-node over QUIC).
        let (q_en, q_conn, q_pct, q_jid, q_age) = multi_bridge.native_status();
        legs.push(LegStatus {
            leg_id: "qtc-native".into(),
            coin: "QTU".into(),
            kind: LegKind::Native,
            enabled: q_en,
            connected: q_conn,
            job_id: q_jid,
            job_age_ms: q_age,
            share_pct: Some(q_pct),
        });

        // PRL native + upstream legs (pearl-gateway / LuckyPool).
        if let Some(pearl) = &self.pearl {
            let (n_en, njid, nage, npct, u_en, u_conn, ujid, uage, _upend, _sn, _su) =
                pearl.status();
            legs.push(LegStatus {
                leg_id: "prl-native".into(),
                coin: "PRL".into(),
                kind: LegKind::Native,
                enabled: n_en,
                connected: njid.is_some(),
                job_id: njid,
                job_age_ms: nage,
                share_pct: Some(npct),
            });
            legs.push(LegStatus {
                leg_id: "prl-upstream".into(),
                coin: "PRL".into(),
                kind: LegKind::Upstream,
                enabled: u_en,
                connected: u_conn,
                job_id: ujid,
                job_age_ms: uage,
                share_pct: None,
            });
        }

        // Bridged auxpow legs — one per enabled coin. "connected" is the
        // job-freshness proxy the dashboard already uses (<120 s).
        for coin in multi_bridge.enabled_coins() {
            let job = multi_bridge.latest_job_for_coin(&coin);
            let (jid, age) = job
                .as_ref()
                .map(|j| {
                    (
                        Some(j.external_job_id.clone()),
                        j.received_at.map(|t| t.elapsed().as_millis() as u64),
                    )
                })
                .unwrap_or((None, None));
            let (leg_id, kind) = if coin == zion_cosmic_harmony::ExternalCoin::Quantus {
                // QTU upstream leg — same source as the coin row above,
                // but tracked under its own leg id.
                ("qtc-upstream".to_string(), LegKind::Upstream)
            } else {
                (
                    format!("aux-{}", coin.as_str().to_lowercase()),
                    LegKind::Upstream,
                )
            };
            legs.push(LegStatus {
                leg_id,
                coin: coin.as_str().to_string(),
                kind,
                enabled: true,
                connected: age.map(|a| a < 120_000).unwrap_or(false),
                job_id: jid,
                job_age_ms: age,
                share_pct: None,
            });
        }

        legs
    }

    /// Drain queued payouts for a non-ZION chain (`"quantus"`).  ZION
    /// entries and other chains stay queued.
    pub fn take_external_payouts(&mut self, chain: &str) -> Vec<(u64, PayoutEntry)> {
        let (taken, kept): (Vec<_>, Vec<_>) = std::mem::take(&mut self.pending_payouts)
            .into_iter()
            .partition(|(_, p)| p.chain() == chain);
        self.pending_payouts = kept;
        taken
    }

    /// Snapshot (without draining) of queued external-chain payouts for a
    /// chain — used by the status API.
    pub fn pending_external_payouts(&self, chain: &str) -> Vec<&PayoutEntry> {
        self.pending_payouts
            .iter()
            .map(|(_, p)| p)
            .filter(|p| p.chain() == chain)
            .collect()
    }

    pub fn pending_revenue_payouts(&self, event_id: &str) -> Vec<(u64, PayoutEntry)> {
        self.pending_payouts
            .iter()
            .filter(|(_, payout)| payout.revenue_event.as_deref() == Some(event_id))
            .cloned()
            .collect()
    }

    /// Put payouts back into the queue for a later retry.
    pub fn requeue_payouts(&mut self, payouts: Vec<(u64, PayoutEntry)>) {
        self.pending_payouts.extend(payouts);
    }

    /// Mark a payout as successfully submitted so it is not re-sent.
    pub fn mark_payout_sent(&mut self, block_height: u64, address: &str) {
        self.sent_payouts
            .insert((block_height, address.to_string()));
    }
}

fn parse_worker_address(worker: &str) -> Option<Address> {
    let wallet = worker.split('.').next().unwrap_or(worker).trim();
    if wallet.starts_with("zion1") {
        Address::new(ChainId::ZionL1, wallet.as_bytes().to_vec(), wallet).ok()
    } else {
        None
    }
}

/// Parse a Quantus payout target from a worker wallet field.
///
/// Accepts `qtc:<ss58>` / `qtu:<ss58>` (explicit) or a bare `qz…` SS58-189
/// address (Quantus account IDs encode with prefix 189 → base58 `qz`).
/// Full checksum verification happens in the multichain sweeper — the pool
/// only needs routing, not custody, so a shape check suffices here.
fn parse_quantus_payout(wallet: &str) -> Option<String> {
    // Strip an explicit chain tag (case-insensitive) but keep the SS58
    // address itself verbatim — base58 is case-sensitive.
    let lower = wallet.to_ascii_lowercase();
    let bare = if lower.starts_with("qtc:") || lower.starts_with("qtu:") {
        &wallet[4..]
    } else {
        wallet
    };
    // SS58 prefix 189 addresses are 47-48 base58 chars starting with "qz".
    if bare.len() >= 45
        && bare.len() <= 50
        && bare.starts_with("qz")
        && bare.chars().all(|c| c.is_ascii_alphanumeric())
    {
        Some(bare.to_string())
    } else {
        None
    }
}

/// Parse a Pearl payout target from a worker wallet field.
///
/// Accepts `prl:<bech32>` / `pearl:<bech32>` (explicit) or a bare `prl1…`
/// segwit address (mainnet HRP `prl`, BIP86 taproot `prl1p…`).  Full bech32m
/// checksum verification happens in the multichain sweeper — the pool only
/// needs routing, so a shape check suffices here.
fn parse_pearl_payout(wallet: &str) -> Option<String> {
    let lower = wallet.to_ascii_lowercase();
    let bare = if lower.starts_with("prl:") {
        &wallet[4..]
    } else if lower.starts_with("pearl:") {
        &wallet[6..]
    } else {
        wallet
    };
    // Bech32 segwit address: `prl1` + 6–87 data/checksum chars (v1 p2tr = 62
    // total).  All-lowercase by spec; reject mixed-case and non-bech32 chars.
    let lower_bare = bare.to_ascii_lowercase();
    if bare.len() >= 20
        && bare.len() <= 90
        && lower_bare.starts_with("prl1")
        && bare == lower_bare.as_str()
        && bare[4..]
            .chars()
            .all(|c| "qpzry9x8gf2tvdw0s3jn54khce6mua7l".contains(c))
    {
        Some(bare.to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> PoolConfig {
        PoolConfig::default()
    }

    fn telemetry() -> Arc<Mutex<MinerTelemetryRegistry>> {
        Arc::new(Mutex::new(MinerTelemetryRegistry::new()))
    }

    #[test]
    fn try_new_fails_when_configured_snapshot_is_corrupt() {
        let path = std::env::temp_dir().join(format!(
            "zion_pool_corrupt_snapshot_{}.json",
            std::process::id()
        ));
        std::fs::write(&path, b"{not-json").unwrap();

        let err = Pool::try_new(
            PoolConfig {
                state_path: Some(path.to_string_lossy().into_owned()),
                ..config()
            },
            telemetry(),
        )
        .unwrap_err();

        assert!(format!("{err:#}").contains("failed to load PPLNS state"));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn failed_pplns_snapshot_save_is_counted_and_retried() {
        let root =
            std::env::temp_dir().join(format!("zion_pool_snapshot_retry_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("missing").join("state.json");
        let mut pool = Pool::new(
            PoolConfig {
                state_path: Some(path.to_string_lossy().into_owned()),
                ..config()
            },
            telemetry(),
        );
        pool.pplns.record_share_at("miner", "worker", 1, 10);

        assert!(pool.save().is_err());
        assert_eq!(pool.pplns_persist_failures_total, 1);
        assert_eq!(pool.pplns_persist_success_timestamp_s, 0);

        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        assert!(pool.save().unwrap());
        assert_eq!(pool.pplns_persist_failures_total, 1);
        assert!(pool.pplns_persist_success_timestamp_s > 0);

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn submits_valid_zion_share() {
        let mut pool = Pool::new(config(), telemetry());
        let header = b"zion_header";
        let nonce = 0u64;
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "zion_1".into(),
            nonce_hex: format!("{:016x}", nonce),
            difficulty: 1,
        };
        assert!(pool.submit_zion(submission, header, 0).unwrap());
        assert_eq!(pool.stats(), (1, 0));
    }

    #[test]
    fn rejects_invalid_zion_share() {
        let mut pool = Pool::new(config(), telemetry());
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "zion_1".into(),
            nonce_hex: "not_a_nonce".into(),
            difficulty: 1,
        };
        assert!(pool.submit_zion(submission, b"header", 0).is_err());
    }

    #[test]
    fn submits_valid_auxpow_share() {
        let mut pool = Pool::new(config(), telemetry());
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "aux_1".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 1,
        };
        assert!(pool
            .submit_auxpow(ExternalCoin::Bitcoin, submission, b"aux_header", 0)
            .unwrap());
        assert_eq!(pool.stats(), (1, 0));
    }

    #[test]
    fn rejects_invalid_auxpow_share() {
        let mut pool = Pool::new(
            PoolConfig {
                auxpow_target: [0x00u8; 32],
                ..config()
            },
            telemetry(),
        );
        let submission = ShareSubmission {
            worker: "worker1".into(),
            job_id: "aux_1".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 1,
        };
        assert!(pool
            .submit_auxpow(ExternalCoin::Bitcoin, submission, b"aux_header", 0)
            .is_err());
    }

    #[test]
    fn payouts_are_proportional() {
        let mut pool = Pool::new(
            PoolConfig {
                min_payout_flowers: 1,
                ..config()
            },
            telemetry(),
        );
        let header = b"payout_header";
        for i in 0..4 {
            let submission = ShareSubmission {
                worker: "worker1".into(),
                job_id: format!("zion_{i}"),
                nonce_hex: format!("{:016x}", i),
                difficulty: 1,
            };
            pool.submit_zion(submission, header, 1).unwrap();
        }
        let reward = 1_000_000;
        let payouts = pool.payouts(reward);
        assert_eq!(payouts.len(), 1);
        let miner_share = zion_core::emission::fee_split(reward).0;
        assert_eq!(payouts[0].amount, miner_share);
    }

    #[test]
    fn on_block_found_is_idempotent() {
        let mut pool = Pool::new(config(), telemetry());
        pool.on_block_found(100, 1_000_000);
        let pending1 = pool.take_pending_payouts();
        pool.on_block_found(100, 1_000_000);
        let pending2 = pool.take_pending_payouts();
        assert_eq!(
            pending2.len(),
            0,
            "duplicate block height must not produce new payouts"
        );
        pool.requeue_payouts(pending1);
        let pending3 = pool.take_pending_payouts();
        assert_eq!(
            pending3.len(),
            0,
            "requeue of drained payouts after idempotent on_block_found should not duplicate"
        );
    }

    #[test]
    fn coin_revenue_distributes_native_units() {
        let mut pool = Pool::new(
            PoolConfig {
                native_payout_coins: vec!["qtu".into()],
                ..config()
            },
            telemetry(),
        );
        pool.pplns
            .register_address_with_chain("alice", "qz1alice", "quantus");
        pool.pplns
            .record_share_with_diff_for_coin("alice", "rig", 1, 100, "qtu");

        // Coin not enabled for native payouts → CoinNotNative.
        assert!(matches!(
            pool.on_coin_revenue("zion", 1000, 42, "zion:bal:0:1000"),
            Err(PoolError::CoinNotNative)
        ));
        // Empty event id → DuplicateRevenueEvent.
        assert!(matches!(
            pool.on_coin_revenue("qtu", 1000, 42, ""),
            Err(PoolError::DuplicateRevenueEvent)
        ));

        let out = pool
            .on_coin_revenue("QTU", 5_000_000, 42, "qtu:bal:0:5m")
            .unwrap();
        assert_eq!(out.coin, "qtu");
        assert_eq!(out.emitted, 1);
        assert_eq!(out.emitted_total, 5_000_000);

        // Duplicate event id is rejected — retries can't double-pay.
        assert!(matches!(
            pool.on_coin_revenue("qtu", 5_000_000, 42, "qtu:bal:0:5m"),
            Err(PoolError::DuplicateRevenueEvent)
        ));

        // The emitted entry is a native-unit quantus payout carrying the
        // event id, drained via the quantus external queue.
        let drained = pool.take_external_payouts("quantus");
        assert_eq!(drained.len(), 1);
        let (h, p) = &drained[0];
        assert_eq!(*h, 42);
        assert_eq!(p.miner_id, "alice");
        assert_eq!(p.amount, 5_000_000);
        assert_eq!(p.unit(), "native");
        assert_eq!(p.coin.as_deref(), Some("qtu"));
        assert_eq!(p.revenue_event.as_deref(), Some("qtu:bal:0:5m"));
        // Nothing leaked into the ZION queue.
        assert!(pool.take_pending_payouts().is_empty());
    }

    #[test]
    fn next_job_id_increments() {
        let pool = Pool::new(config(), telemetry());
        assert_eq!(pool.next_job_id(), 2);
        assert_eq!(pool.next_job_id(), 3);
    }

    #[test]
    fn anonymous_worker_address_parsed_from_username() {
        let mut pool = Pool::new(config(), telemetry());
        pool.register_worker("zion1abc.worker1");
        let (chain, addr) = pool.worker_payout_target("zion1abc.worker1");
        assert_eq!(chain, "zion");
        assert_eq!(addr, "zion1abc");
    }

    const QTC_ADDR: &str = "qzmAAFv4c7tprk5UyJfav4hgkGR8xyckGeZL2KhwM1FWMW1gk";

    #[test]
    fn quantus_worker_parses_qtc_prefix() {
        assert_eq!(
            parse_quantus_payout(&format!("qtc:{QTC_ADDR}")).as_deref(),
            Some(QTC_ADDR)
        );
        assert_eq!(
            parse_quantus_payout(&format!("QTU:{QTC_ADDR}")).as_deref(),
            Some(QTC_ADDR)
        );
        assert_eq!(parse_quantus_payout(QTC_ADDR).as_deref(), Some(QTC_ADDR));
        assert_eq!(parse_quantus_payout("zion1abc"), None);
        assert_eq!(parse_quantus_payout("qzshort"), None);
        assert_eq!(parse_quantus_payout("qtc:notqz_address!"), None);
    }

    #[test]
    fn quantus_worker_registers_external_payout() {
        let mut pool = Pool::new(config(), telemetry());
        pool.register_worker(&format!("qtc:{QTC_ADDR}.rig1"));
        let (chain, addr) = pool.worker_payout_target(&format!("qtc:{QTC_ADDR}.rig1"));
        assert_eq!(chain, "quantus");
        assert_eq!(addr, QTC_ADDR);
    }

    #[test]
    fn explicit_payout_address_routes_quantus() {
        let mut pool = Pool::new(config(), telemetry());
        // v3 Hello payout_address
        let pa = format!("qtc:{QTC_ADDR}");
        let res = pool.register_payout_address("miner42", &pa);
        assert_eq!(res.map(|(c, a)| (c, a)), Some(("quantus", &pa[..])));
        let (chain, addr) = pool.worker_payout_target("miner42.rigA");
        assert_eq!(chain, "quantus");
        assert_eq!(addr, QTC_ADDR);
        // zion1 still works, garbage rejected
        assert_eq!(
            pool.register_payout_address("m2", "zion1zz"),
            Some(("zion", "zion1zz"))
        );
        assert_eq!(pool.register_payout_address("m3", "garbage"), None);
    }

    #[test]
    fn external_payouts_partition_from_zion() {
        let mut pool = Pool::new(
            PoolConfig {
                min_payout_flowers: 1,
                ..config()
            },
            telemetry(),
        );
        // One QTC miner + one ZION miner submit shares at height 1.
        pool.register_worker(&format!("qtc:{QTC_ADDR}.rig1"));
        let sub_qtc = ShareSubmission {
            worker: format!("qtc:{QTC_ADDR}.rig1"),
            job_id: "zion_1".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 1,
        };
        let sub_zion = ShareSubmission {
            worker: "zion1miner".into(),
            job_id: "zion_2".into(),
            nonce_hex: "0000000000000001".into(),
            difficulty: 1,
        };
        pool.submit_zion(sub_qtc, b"h", 1).unwrap();
        pool.submit_zion(sub_zion, b"h", 1).unwrap();
        pool.on_block_found(1, 1_000_000);

        // ZION drain must leave the quantus entry behind.
        let zion = pool.take_pending_payouts();
        assert!(zion.iter().all(|(_, p)| p.chain() == "zion"));
        assert_eq!(zion.len(), 1);
        let ext = pool.take_external_payouts("quantus");
        assert_eq!(ext.len(), 1);
        assert_eq!(ext[0].1.chain(), "quantus");
        assert_eq!(ext[0].1.address, QTC_ADDR);
    }

    const PRL_ADDR: &str = "prl1p29st0fecym0gk9zyh8ch90sxkf6apmwqdznk0tvu6kf5wxwsmqxqqzwjdm";

    #[test]
    fn pearl_worker_parses_prl_prefix() {
        assert_eq!(
            parse_pearl_payout(&format!("prl:{PRL_ADDR}")).as_deref(),
            Some(PRL_ADDR)
        );
        assert_eq!(
            parse_pearl_payout(&format!("pearl:{PRL_ADDR}")).as_deref(),
            Some(PRL_ADDR)
        );
        assert_eq!(
            parse_pearl_payout(&format!("PRL:{PRL_ADDR}")).as_deref(),
            Some(PRL_ADDR)
        );
        assert_eq!(parse_pearl_payout(PRL_ADDR).as_deref(), Some(PRL_ADDR));
        assert_eq!(parse_pearl_payout("zion1abc"), None);
        assert_eq!(parse_pearl_payout("prl1"), None);
        assert_eq!(
            parse_pearl_payout(PRL_ADDR.to_ascii_uppercase().as_str()),
            None
        );
        assert_eq!(parse_pearl_payout(&format!("prl:{QTC_ADDR}")), None);
    }

    #[test]
    fn pearl_worker_registers_external_payout() {
        let mut pool = Pool::new(config(), telemetry());
        pool.register_worker(&format!("prl:{PRL_ADDR}.rig1"));
        let (chain, addr) = pool.worker_payout_target(&format!("prl:{PRL_ADDR}.rig1"));
        assert_eq!(chain, "pearl");
        assert_eq!(addr, PRL_ADDR);
        // Bare prl1 wallet (native pearl stratum identity) routes too.
        let (chain, addr) = pool.worker_payout_target(&format!("{PRL_ADDR}.rig1"));
        assert_eq!(chain, "pearl");
        assert_eq!(addr, PRL_ADDR);
    }

    #[test]
    fn explicit_payout_address_routes_pearl() {
        let mut pool = Pool::new(config(), telemetry());
        let pa = format!("prl:{PRL_ADDR}");
        let res = pool.register_payout_address("miner43", &pa);
        assert_eq!(res.map(|(c, a)| (c, a)), Some(("pearl", &pa[..])));
        let (chain, addr) = pool.worker_payout_target("miner43.rigB");
        assert_eq!(chain, "pearl");
        assert_eq!(addr, PRL_ADDR);
    }

    /// F2c: shares recorded through the pool carry a coin tag that lands
    /// in `PplnsEngine::coin_stats` — auxpow submits take the ExternalCoin
    /// ticker, external-stream credits take the leg's coin string.
    #[test]
    fn shares_carry_coin_tags_into_pplns() {
        let mut pool = Pool::new(config(), telemetry());
        let sub = ShareSubmission {
            worker: "zion1m".into(),
            job_id: "j1".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 1,
        };
        pool.submit_zion(sub, b"h", 1).unwrap();

        let sub = ShareSubmission {
            worker: "zion1m".into(),
            job_id: "j2".into(),
            nonce_hex: "0000000000000000".into(),
            difficulty: 2,
        };
        pool.submit_auxpow(ExternalCoin::Quantus, sub, b"h", 1)
            .unwrap();

        // Native QTU leg credits via record_external_share with "qtu".
        pool.record_external_share("wallet", "wallet.rig", 1, 4, "qtu");
        // Pearl native leg credits via record_external_share with "prl".
        pool.record_external_share("wallet2", "wallet2.rig", 1, 8, "prl");

        let stats = pool.pplns.coin_stats();
        let find = |c: &str| stats.iter().find(|s| s.coin == c).unwrap();
        assert_eq!(find("zion").accepted_total, 1);
        // auxpow Quantus submit (weight 2) + external "qtu" credit (4) → 6
        assert_eq!(find("qtu").accepted_total, 2);
        assert_eq!(find("qtu").window_weight, 6);
        assert_eq!(find("prl").accepted_total, 1);
        assert_eq!(find("prl").window_weight, 8);
    }
}
