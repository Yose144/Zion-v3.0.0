//! ZION L1 stratum pool server.
//!
//! Stand-alone binary that binds a TCP stratum port, accepts miner
//! connections, fetches block templates from a `zion-node` RPC and
//! forwards solved blocks back to the node.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::Context;
use clap::Parser;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tracing::{info, warn};
use zion_l1_types::{Address, ChainId};

use zion_pool::api::PoolApi;
use zion_pool::auxpow_bridge::MultiAuxPowBridge;
use zion_pool::auxpow_runtime;
use zion_pool::deferred_payout::{
    spawn_deferred_payout_processor, spawn_payout_confirmation_sweep, DeferredPayoutConfig,
    DeferredPayoutQueue,
};
use zion_pool::ncl_gateway::{NclGatewayClient, NclHeartbeatConfig, NclPricing};
use zion_pool::notifications::{NotificationsConfig, Notifier};
use zion_pool::payout::PayoutSweeper;
use zion_pool::qtc_native;
use zion_pool::revenue_scheduler::RevenueScheduler;
use zion_pool::share_relay::ShareRelayConfig;
use zion_pool::telemetry::MinerTelemetryRegistry;
use zion_pool::tls::{ExtraPortConfig, TlsConfig};
use zion_pool::v3_pplns::FeeConfig;
use zion_pool::{Pool, PoolConfig, StratumServer};

#[derive(Parser, Debug)]
#[command(name = "zion-pool")]
#[command(about = "ZION L1 stratum pool server")]
#[command(version)]
struct Args {
    /// Stratum bind address.
    #[arg(short, long, env = "ZION_POOL_BIND", default_value = "0.0.0.0:8444")]
    bind: String,

    /// Zion L1 node RPC URL for getTemplate / submitBlock. Comma-separated
    /// list enables HA failover with last-good stickiness, e.g.
    /// `http://127.0.0.1:9445,http://127.0.0.1:9446,http://127.0.0.1:9447`.
    #[arg(short, long, env = "ZION_L1_RPC_URL")]
    l1_rpc_url: Option<String>,

    /// Pool/miner address for coinbase in block templates.
    #[arg(
        short,
        long,
        env = "ZION_POOL_MINER_ADDRESS",
        default_value = "zion1pool"
    )]
    miner_address: String,

    /// PPLNS state persistence path.
    #[arg(long, env = "ZION_PPLNS_STATE_PATH")]
    state_path: Option<String>,

    /// PPLNS window in total difficulty (work units).
    #[arg(long, env = "ZION_PPLNS_WINDOW_SIZE", default_value_t = 500_000)]
    pplns_window_size: usize,

    /// Minimum miner payout in flowers.
    #[arg(long, env = "ZION_MIN_PAYOUT_FLOWERS", default_value_t = zion_core::MIN_PAYOUT_AMOUNT)]
    min_payout_flowers: u64,

    /// Humanitarian address passed to getTemplate.
    #[arg(long, env = "ZION_HUMANITARIAN_ADDRESS")]
    humanitarian_address: Option<String>,

    /// Issobella address passed to getTemplate.
    #[arg(long, env = "ZION_ISSOBELLA_ADDRESS")]
    issobella_address: Option<String>,

    /// Pool fee destination address (for API / future sweep).
    #[arg(long, env = "ZION_POOL_FEE_ADDRESS")]
    pool_fee_address: Option<String>,

    /// Pool API key for read-only HTTP endpoints.
    #[arg(long, env = "ZION_POOL_API_KEY")]
    api_key: Option<String>,

    /// Pool admin API key for privileged HTTP endpoints.
    #[arg(long, env = "ZION_POOL_API_ADMIN_KEY")]
    admin_key: Option<String>,

    /// Pool HTTP API bind address.
    #[arg(long, env = "ZION_POOL_API_BIND", default_value = "127.0.0.1:8080")]
    api_bind: String,

    /// Hex-encoded 32-byte Ed25519 signing key for the pool payout wallet.
    #[arg(long, env = "ZION_POOL_WALLET_KEY")]
    pool_wallet_key: Option<String>,

    /// Seconds between payout sweep attempts.
    #[arg(long, env = "ZION_PAYOUT_INTERVAL_S", default_value_t = 30)]
    payout_interval_s: u64,

    /// Pool fee in basis points.
    #[arg(long, env = "ZION_POOL_FEE_BPS", default_value_t = 100)]
    pool_fee_bps: u16,

    /// SQLite database path for persistent share/block/payout history.
    /// When set, enables /api/v1/blocks, /api/v1/payouts, /api/v1/miners endpoints.
    #[arg(long, env = "ZION_POOL_STORE_DB_PATH")]
    store_db_path: Option<String>,

    /// Coins paid in native units via revenue events (comma list, e.g.
    /// "qtu,prl").  Their shares are excluded from the unified ZION PPLNS
    /// distribution — payouts come from the per-coin treasury oracle.
    #[arg(long, env = "ZION_POOL_NATIVE_PAYOUT_COINS", default_value = "")]
    native_payout_coins: String,

    /// Per-coin minimum native-unit payout, `coin:amount` comma list.
    #[arg(long, env = "ZION_POOL_MIN_PAYOUT_NATIVE", default_value = "")]
    min_payout_native: String,
}

fn parse_address(encoded: &str) -> anyhow::Result<Address> {
    Address::new(ChainId::ZionL1, vec![], encoded)
        .map_err(|e| anyhow::anyhow!("invalid ZION address {encoded}: {e}"))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    let pool_address = parse_address(&args.miner_address)?;
    let l1_rpc_url = args.l1_rpc_url.unwrap_or_default();

    let humanitarian_address = args.humanitarian_address.unwrap_or_default();
    let issobella_address = args.issobella_address.unwrap_or_default();
    let pool_fee_address = args.pool_fee_address.unwrap_or_default();

    let fee_config = FeeConfig {
        humanitarian_pct: 5,
        issobella_pct: 5,
        pool_fee_pct: u64::from(args.pool_fee_bps) / 100,
        humanitarian_wallet: humanitarian_address.clone(),
        issobella_wallet: issobella_address.clone(),
        pool_fee_wallet: pool_fee_address.clone(),
    };

    let pool_wallet_key = args.pool_wallet_key.clone();
    let config = PoolConfig {
        port: 0,
        pool_fee_bps: args.pool_fee_bps,
        pplns_window_size: args.pplns_window_size,
        min_payout_flowers: args.min_payout_flowers,
        pplns_window_blocks: 100,
        zion_target: [0xFF; 32],
        auxpow_target: [0xFF; 32],
        pool_address,
        worker: String::new(),
        password: String::new(),
        l1_rpc_url: if l1_rpc_url.is_empty() {
            None
        } else {
            Some(l1_rpc_url.clone())
        },
        state_path: args.state_path,
        reconnect_rate_limit: Default::default(),
        fee_config,
        api_key: args.api_key,
        admin_key: args.admin_key,
        humanitarian_address,
        issobella_address,
        pool_wallet_key: args.pool_wallet_key,
        payout_interval_s: args.payout_interval_s,
        payout_tx_fee_flowers: zion_core::fee::MIN_TX_FEE.max(1),
        native_payout_coins: zion_pool::config::parse_native_payout_coins(
            &args.native_payout_coins,
        ),
        min_payout_native: zion_pool::config::parse_min_payout_native(&args.min_payout_native),
    };

    let telemetry = Arc::new(Mutex::new(MinerTelemetryRegistry::new()));

    // Open persistent share store for block/payout recording.
    let share_store = match args.store_db_path.as_ref() {
        Some(path) => {
            let store = zion_pool::store::ShareStore::open(path)
                .with_context(|| format!("failed to open pool share store at {path}"))?;
            info!("pool share store opened: {}", path);
            Some(Arc::new(store))
        }
        None => None,
    };
    let pool = Arc::new(Mutex::new(Pool::try_new(config, telemetry.clone())?));

    if let Some(store) = share_store.as_ref() {
        // Restore persisted share-dedup marks before any submit path can
        // run — closes the post-restart replay window on upstream-keyed
        // external job ids.
        pool.lock()
            .expect("pool lock poisoned")
            .attach_dedup_store(store.clone());
        let recovered = zion_pool::pool::recover_pending_coin_revenue(
            &mut pool.lock().expect("pool lock poisoned"),
            store,
        )?;
        if recovered > 0 {
            info!(recovered, "recovered pending native revenue events");
        }
    }

    // One block tracker shared by every listener + the HTTP API — a
    // per-listener tracker fragments luck and shares-since-block counters.
    let block_tracker = Arc::new(Mutex::new(zion_pool::block_tracker::BlockTracker::new()));
    if let Some(store) = share_store.as_ref() {
        // Restore the luck window + shares-since-last-block counter so a
        // restart does not zero pool_luck_100/500 or pending blocks.
        match store.query_blocks_for_coin("zion", 1000) {
            Ok(mut rows) => {
                rows.reverse(); // newest-first → oldest-first
                let last_ts = rows.last().map(|r| r.ts).unwrap_or(0);
                let count = rows.len();
                let counter = store
                    .accepted_shares_since("zion", last_ts)
                    .unwrap_or(0);
                block_tracker
                    .lock()
                    .expect("block tracker lock poisoned")
                    .restore(rows, counter);
                info!(
                    restored = count,
                    shares_since_last_block = counter,
                    "block tracker restored from store"
                );
            }
            Err(e) => tracing::warn!("block tracker restore skipped: {}", e),
        }
    }
    let server = StratumServer::new(pool.clone())
        .with_share_store(share_store.clone())
        .with_block_tracker(block_tracker.clone());
    // Captured before `server` is moved into its run task — the HTTP API
    // reports the same template height for est. earnings.
    let current_height = server.current_height();

    // ── Notifications (Telegram/SMTP/OASIS/webhook) ───────────────────────
    let notif_config = NotificationsConfig::from_env();
    let notifier = Arc::new(Notifier::new(notif_config.clone()));
    if notif_config.telegram_enabled() {
        info!(
            "notifications: Telegram enabled (chat_id={:?})",
            notif_config.telegram_chat_id
        );
    }
    if notif_config.smtp_enabled() {
        info!(
            "notifications: SMTP enabled (host={:?})",
            notif_config.smtp_host
        );
    }
    if notif_config.oasis_enabled() {
        info!("notifications: OASIS webhook enabled");
    }
    if notif_config.webhook_enabled() {
        info!("notifications: block webhook enabled");
    }
    let server = server.with_notifier(notifier.clone());

    // ── Revenue scheduler (multi-stream revenue routing) ──────────────────
    let revenue_scheduler = Arc::new(Mutex::new(RevenueScheduler::from_env(0.0)));
    {
        let rs = revenue_scheduler.lock().unwrap();
        if rs.is_multistream() {
            info!(
                "revenue_scheduler: multi-stream enabled — {}",
                rs.describe_plan()
            );
        }
    }
    let server = server.with_revenue_scheduler(revenue_scheduler);

    // ── AuxPoW bridge runtime ─────────────────────────────────────────────
    let multi_bridge = MultiAuxPowBridge::new();
    let auxpow_cfg = auxpow_runtime::config_from_env();
    if !auxpow_cfg.enabled_coins.is_empty() {
        info!(
            "auxpow_runtime: {} coins enabled",
            auxpow_cfg.enabled_coins.len()
        );
        auxpow_runtime::spawn_auxpow_runtime(multi_bridge.clone(), auxpow_cfg.clone());
    } else {
        info!("auxpow_runtime: disabled (no coins configured)");
    }

    // ── Native Quantus leg (own quantus-node via QUIC miner protocol) ────
    // Enabled only via QTC_NATIVE_* env — see qtc_native.rs.
    if qtc_native::maybe_spawn(&multi_bridge).is_some() {
        info!("qtc_native: native Quantus source enabled");
    }

    // Wire the bridge into the stratum server for triple-stream mining
    let server = server.with_multi_bridge(multi_bridge.clone());

    // ── Share relay config ────────────────────────────────────────────────
    let relay_cfg = ShareRelayConfig::from_env();
    if relay_cfg.enabled() {
        info!(
            "share_relay: enabled → {}",
            relay_cfg.upstream_pool_addr.as_deref().unwrap_or("?")
        );
    }

    // ── Revenue proxy (external pool forwarding) ──────────────────────────
    // Skip revenue_proxy for coins that already have an auxpow_runtime bridge
    // — both systems connect to the same upstream pool with the same wallet,
    // and dual connections cause pools like HeroMiners to close one of them.
    // The auxpow_runtime bridge already handles both job fetching AND share
    // forwarding, so revenue_proxy is redundant for those coins.
    let auxpow_cfg_for_proxy = auxpow_runtime::config_from_env();
    let bridge_coins = auxpow_cfg.enabled_coins.clone();
    for coin in &auxpow_cfg_for_proxy.enabled_coins {
        if bridge_coins.contains(coin) {
            info!(
                "revenue_proxy: skipping {:?} — already handled by auxpow_runtime bridge",
                coin
            );
            continue;
        }
        if let Some(wallet) = auxpow_cfg_for_proxy.wallet_for_coin(coin) {
            if !wallet.is_empty() {
                let profile = zion_cosmic_harmony::CoinProfile::for_coin(*coin);
                let worker = auxpow_cfg_for_proxy.worker_name.clone();
                info!(
                    "revenue_proxy: starting external pool client for {:?} → {} (wallet={})",
                    coin,
                    profile.pool_address(),
                    &wallet[..wallet.len().min(12)]
                );
                let client =
                    zion_pool::revenue_proxy::client_from_profile(&profile, &wallet, &worker);
                tokio::spawn(async move {
                    client.run_loop().await;
                });
            }
        }
    }

    // ── Primary stratum listener ──────────────────────────────────────────
    let listener = TcpListener::bind(&args.bind).await?;
    let local_addr = listener.local_addr()?;
    // Report the real bound port through the HTTP API (config.port was
    // previously hardcoded to 0, so /stats reported "port":0).
    pool.lock().unwrap().config.port = local_addr.port();
    info!("zion-pool listening on {}", local_addr);

    if !l1_rpc_url.is_empty() {
        info!("template feed from L1 RPC: {}", l1_rpc_url);
    } else {
        warn!("no --l1-rpc-url configured; template feed disabled");
    }

    // ── Deferred payout processor ─────────────────────────────────────────
    let deferred_queue: DeferredPayoutQueue =
        std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let deferred_cfg = DeferredPayoutConfig::from_env();
    let deferred_rpc = if l1_rpc_url.is_empty() {
        None
    } else {
        Some(l1_rpc_url.clone())
    };
    let deferred_wallet = if pool_fee_address.is_empty() {
        None
    } else {
        Some(pool_fee_address.clone())
    };
    let deferred_key = pool_wallet_key.clone();
    spawn_deferred_payout_processor(
        deferred_queue.clone(),
        deferred_cfg,
        deferred_rpc.clone(),
        deferred_wallet,
        deferred_key,
        Some(notifier.clone()),
    );

    // ── Payout confirmation sweep ─────────────────────────────────────────
    let sweep_interval = std::env::var("ZION_PAYOUT_SWEEP_INTERVAL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);
    spawn_payout_confirmation_sweep(deferred_rpc.clone(), sweep_interval, share_store.clone());

    // ── NCL Gateway (AI compute revenue stream) ───────────────────────────
    if let Ok(gateway_url) = std::env::var("ZION_NCL_GATEWAY_URL") {
        if !gateway_url.trim().is_empty() {
            match NclGatewayClient::new(&gateway_url) {
                Ok(client) => {
                    let pricing = NclPricing::from_env();
                    let heartbeat = NclHeartbeatConfig::from_env();
                    info!(
                        "ncl_gateway_enabled url={} heartbeat={} interval_secs={} price_in_per_1k={} price_out_per_1k={}",
                        client.authority(),
                        heartbeat.enabled,
                        heartbeat.interval.as_secs(),
                        pricing.price_in_per_1k_tokens,
                        pricing.price_out_per_1k_tokens
                    );
                    // NCL dispatcher would be spawned here with the revenue collector
                    // For now, just log that it's enabled — full spawn requires
                    // a RevenueCollector handle from the pool runtime
                }
                Err(e) => {
                    warn!("ncl_gateway_config_error url={} error={}", gateway_url, e);
                }
            }
        } else {
            info!("ncl_gateway_enabled=false (set ZION_NCL_GATEWAY_URL to enable)");
        }
    } else {
        info!("ncl_gateway_enabled=false (set ZION_NCL_GATEWAY_URL to enable)");
    }

    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    // Extract routing_stats handle before server is moved into run_handle
    let api_routing_stats = server.routing_stats_handle();

    let feed_server = server.clone();
    let feed_l1_rpc_url = l1_rpc_url.clone();
    let feed_shutdown = shutdown_rx.clone();
    let feed_handle = tokio::spawn(async move {
        feed_server
            .template_feed_loop(feed_l1_rpc_url, args.miner_address, feed_shutdown)
            .await;
    });

    let run_shutdown = shutdown_rx.clone();
    let run_handle = tokio::spawn(async move {
        let _ = server.run_with_shutdown(listener, run_shutdown).await;
    });

    // ── Extra port listeners (difficulty stratification) ──────────────────
    let extra_ports = ExtraPortConfig::parse_from_env();
    for ep in &extra_ports {
        info!(
            "extra_port: binding {} label={} default_diff={}",
            ep.bind_addr, ep.label, ep.default_difficulty
        );
        let bind = ep.bind_addr.clone();
        let server_clone = StratumServer::new(pool.clone())
            .with_share_store(share_store.clone())
            .with_block_tracker(block_tracker.clone())
            .with_current_height(current_height.clone());
        let ep_shutdown = shutdown_rx.clone();
        tokio::spawn(async move {
            match TcpListener::bind(&bind).await {
                Ok(listener) => {
                    info!("extra_port: listening on {}", bind);
                    let _ = server_clone.run_with_shutdown(listener, ep_shutdown).await;
                }
                Err(e) => {
                    warn!("extra_port: failed to bind {}: {}", bind, e);
                }
            }
        });
    }

    // ── TLS listener (non-fatal) ──────────────────────────────────────────
    if let Some(tls_cfg) = TlsConfig::from_env() {
        info!(
            "tls: attempting to bind {} with cert {}",
            tls_cfg.bind, tls_cfg.cert_path
        );
        match zion_pool::tls::load_tls_acceptor(&tls_cfg.cert_path, &tls_cfg.key_path) {
            Ok(acceptor) => {
                let tls_bind = tls_cfg.bind.clone();
                let server_clone = StratumServer::new(pool.clone())
                    .with_share_store(share_store.clone())
                    .with_block_tracker(block_tracker.clone())
                    .with_current_height(current_height.clone());
                let mut tls_shutdown = shutdown_rx.clone();
                tokio::spawn(async move {
                    match TcpListener::bind(&tls_bind).await {
                        Ok(listener) => {
                            info!("tls: listening on {}", tls_bind);
                            loop {
                                let (socket, peer) = tokio::select! {
                                    res = listener.accept() => match res {
                                        Ok(conn) => conn,
                                        Err(e) => {
                                            warn!("tls accept error: {}", e);
                                            break;
                                        }
                                    },
                                    _ = tls_shutdown.changed() => {
                                        if *tls_shutdown.borrow() {
                                            info!("tls: drain — listener stopped accepting");
                                            break;
                                        }
                                        continue;
                                    }
                                };
                                {
                                    let acceptor = acceptor.clone();
                                    let server = server_clone.clone();
                                    tokio::spawn(async move {
                                        match acceptor.accept(socket).await {
                                            Ok(tls_stream) => {
                                                server
                                                    .handle_tls_connection(tls_stream, peer)
                                                    .await;
                                            }
                                            Err(e) => {
                                                warn!("tls handshake failed from {}: {}", peer, e);
                                            }
                                        }
                                    });
                                }
                            }
                        }
                        Err(e) => {
                            warn!(
                                "tls: failed to bind {}: {} — continuing without TLS",
                                tls_bind, e
                            );
                        }
                    }
                });
            }
            Err(e) => {
                warn!("tls: cert load failed: {} — continuing without TLS", e);
            }
        }
    }

    // ── HTTP API ──────────────────────────────────────────────────────────
    let api_pool = Arc::clone(&pool);
    let api_bind = args.api_bind.clone();
    let api_bridge = multi_bridge.clone();
    let api_share_store = share_store.clone();
    let api_block_tracker = block_tracker.clone();
    let api_current_height = current_height.clone();
    let api_handle = tokio::task::spawn_blocking(move || {
        let api = Arc::new(
            PoolApi::new(api_pool, api_share_store, Some(api_bridge))
                .with_routing_stats(api_routing_stats)
                .with_block_tracker(api_block_tracker)
                .with_current_height(api_current_height),
        );
        if let Err(e) = api.serve(&api_bind) {
            tracing::error!("pool API server error: {}", e);
        }
    });

    // ── Payout sweeper ────────────────────────────────────────────────────
    let sweep_pool = Arc::clone(&pool);
    let sweep_share_store = share_store.clone();
    let sweep_notifier = notifier.clone();
    let sweep_handle = tokio::spawn(async move {
        let interval = Duration::from_secs(args.payout_interval_s);
        PayoutSweeper::new(sweep_pool, interval)
            .with_notifier(sweep_notifier)
            .with_share_store(sweep_share_store)
            .run()
            .await;
    });

    // ── PPLNS state persistence ───────────────────────────────────────────
    let persist_pool = Arc::clone(&pool);
    let persist_handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let pool = Arc::clone(&persist_pool);
            let _ = tokio::task::spawn_blocking(move || {
                if let Ok(mut p) = pool.lock() {
                    match p.save() {
                        Ok(true) => info!("pplns state persisted"),
                        Ok(false) => {}
                        Err(e) => warn!("failed to save pplns state: {}", e),
                    }
                }
            })
            .await;
        }
    });

    // ── Job-freshness alerting (A4.4) ──────────────────────────────────
    // Poll every leg's job_age_ms; a leg over threshold means its
    // upstream stopped delivering fresh work (miners keep grinding a
    // dead job and waste shares). Alert via Notifier once per leg per
    // cooldown; a recovered leg is re-armed so the next outage alerts
    // again. The zion leg reports no job_age and is skipped naturally.
    let stale_threshold_ms = std::env::var("ZION_POOL_JOB_STALE_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(120_000);
    let stale_cooldown_s = std::env::var("ZION_POOL_JOB_STALE_COOLDOWN_S")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(600);
    let stale_pool = Arc::clone(&pool);
    let stale_bridge = multi_bridge.clone();
    let stale_notifier = notifier.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut alerted: std::collections::HashMap<String, std::time::Instant> =
            std::collections::HashMap::new();
        loop {
            interval.tick().await;
            let legs = {
                let p = match stale_pool.lock() {
                    Ok(p) => p,
                    Err(_) => continue,
                };
                p.leg_statuses(&stale_bridge)
            };
            for leg in legs {
                if !leg.enabled {
                    continue;
                }
                let Some(age) = leg.job_age_ms else { continue };
                if age <= stale_threshold_ms {
                    alerted.remove(&leg.leg_id);
                    continue;
                }
                let recent = alerted
                    .get(&leg.leg_id)
                    .map(|t| t.elapsed().as_secs() < stale_cooldown_s)
                    .unwrap_or(false);
                if recent {
                    continue;
                }
                alerted.insert(leg.leg_id.clone(), std::time::Instant::now());
                let n = stale_notifier.clone();
                let (coin, id) = (leg.coin.clone(), leg.leg_id.clone());
                let _ = tokio::task::spawn_blocking(move || {
                    n.notify_job_stale(&coin, &id, age, stale_threshold_ms);
                })
                .await;
            }
        }
    });

    // ── Graceful drain (A4.3) ───────────────────────────────────────────
    // SIGTERM/SIGINT → broadcast shutdown to every accept loop + the
    // template feed, give in-flight submits a short grace window, then a
    // final PPLNS flush so a restart loses no credited shares. Bounded by
    // systemd TimeoutStopSec; ZION_POOL_DRAIN_GRACE_MS tunes the window.
    let drain_pool = Arc::clone(&pool);
    let drain_started = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let drain_flag = drain_started.clone();
    let drain_grace_ms = std::env::var("ZION_POOL_DRAIN_GRACE_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(1500);
    let drain_handle = tokio::spawn(async move {
        wait_for_terminate().await;
        drain_flag.store(true, std::sync::atomic::Ordering::SeqCst);
        info!(
            "drain: shutdown signal — refusing new sessions, {}ms grace",
            drain_grace_ms
        );
        let _ = shutdown_tx.send(true);
        tokio::time::sleep(Duration::from_millis(drain_grace_ms)).await;
        let pool2 = Arc::clone(&drain_pool);
        let _ = tokio::task::spawn_blocking(move || {
            if let Ok(mut p) = pool2.lock() {
                match p.save() {
                    Ok(true) => info!("drain: final pplns flush persisted"),
                    Ok(false) => info!("drain: pplns state already clean"),
                    Err(e) => warn!("drain: final pplns flush failed: {}", e),
                }
            }
        })
        .await;
        info!("drain: complete — exiting");
        // The drain task owns process exit: runtime teardown waits on
        // detached blocking tasks (the std-blocking API listener) until
        // TimeoutStopSec SIGKILLs — process::exit skips that entirely;
        // all durable state is already on disk.
        tokio::time::sleep(Duration::from_millis(50)).await;
        std::process::exit(0);
    });

    tokio::select! {
        _ = feed_handle => {},
        _ = run_handle => {},
        _ = api_handle => {},
        _ = sweep_handle => {},
        _ = persist_handle => {},
    }

    // A listener arm can win the select race the instant its accept loop
    // drains — keep main() alive so runtime teardown cannot drop the
    // drain task mid-grace. The task exits the process itself; the
    // timeout only bounds a pathological hang.
    if drain_started.load(std::sync::atomic::Ordering::SeqCst) {
        let _ = tokio::time::timeout(Duration::from_secs(10), drain_handle).await;
    }

    info!("zion-pool stopped");
    Ok(())
}

/// Resolve once SIGTERM or SIGINT arrives (Ctrl-C on non-unix).
async fn wait_for_terminate() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};
        let mut term = match signal(SignalKind::terminate()) {
            Ok(s) => s,
            Err(e) => {
                warn!("failed to install SIGTERM handler: {}", e);
                return;
            }
        };
        let mut int = match signal(SignalKind::interrupt()) {
            Ok(s) => s,
            Err(e) => {
                warn!("failed to install SIGINT handler: {}", e);
                return;
            }
        };
        tokio::select! {
            _ = term.recv() => {},
            _ = int.recv() => {},
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
