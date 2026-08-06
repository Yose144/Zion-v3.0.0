//! ZION L1 stratum pool server.
//!
//! Stand-alone binary that binds a TCP stratum port, accepts miner
//! connections, fetches block templates from a `zion-node` RPC and
//! forwards solved blocks back to the node.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use clap::Parser;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tracing::{info, warn};
use zion_l1_types::{Address, ChainId};

use zion_pool::api::PoolApi;
use zion_pool::auxpow_bridge::MultiAuxPowBridge;
use zion_pool::auxpow_runtime;
use zion_pool::deferred_payout::{
    spawn_deferred_payout_processor, spawn_payout_confirmation_sweep,
    DeferredPayoutConfig, DeferredPayoutQueue,
};
use zion_pool::ncl_gateway::{NclGatewayClient, NclHeartbeatConfig, NclPricing};
use zion_pool::notifications::{Notifier, NotificationsConfig};
use zion_pool::payout::PayoutSweeper;
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

    /// Zion L1 node RPC URL for getTemplate / submitBlock.
    #[arg(short, long, env = "ZION_L1_RPC_URL")]
    l1_rpc_url: Option<String>,

    /// Pool/miner address for coinbase in block templates.
    #[arg(short, long, env = "ZION_POOL_MINER_ADDRESS", default_value = "zion1pool")]
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
    #[arg(long, env = "ZION_POOL_API_BIND", default_value = "0.0.0.0:8080")]
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
        l1_rpc_url: if l1_rpc_url.is_empty() { None } else { Some(l1_rpc_url.clone()) },
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
    };

    let telemetry = Arc::new(Mutex::new(MinerTelemetryRegistry::new()));
    let pool = Arc::new(Mutex::new(Pool::new(config, telemetry.clone())));
    let server = StratumServer::new(pool.clone());

    // ── Notifications (Telegram/SMTP/OASIS/webhook) ───────────────────────
    let notif_config = NotificationsConfig::from_env();
    let notifier = Arc::new(Notifier::new(notif_config.clone()));
    if notif_config.telegram_enabled() {
        info!("notifications: Telegram enabled (chat_id={:?})", notif_config.telegram_chat_id);
    }
    if notif_config.smtp_enabled() {
        info!("notifications: SMTP enabled (host={:?})", notif_config.smtp_host);
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
            info!("revenue_scheduler: multi-stream enabled — {}", rs.describe_plan());
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
        auxpow_runtime::spawn_auxpow_runtime(multi_bridge.clone(), auxpow_cfg);
    } else {
        info!("auxpow_runtime: disabled (no coins configured)");
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
    let auxpow_cfg_for_proxy = auxpow_runtime::config_from_env();
    for coin in &auxpow_cfg_for_proxy.enabled_coins {
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
                let client = zion_pool::revenue_proxy::client_from_profile(
                    &profile,
                    &wallet,
                    &worker,
                );
                tokio::spawn(async move {
                    client.run_loop().await;
                });
            }
        }
    }

    // ── Primary stratum listener ──────────────────────────────────────────
    let listener = TcpListener::bind(&args.bind).await?;
    let local_addr = listener.local_addr()?;
    info!("zion-pool listening on {}", local_addr);

    if !l1_rpc_url.is_empty() {
        info!("template feed from L1 RPC: {}", l1_rpc_url);
    } else {
        warn!("no --l1-rpc-url configured; template feed disabled");
    }

    // ── Deferred payout processor ─────────────────────────────────────────
    let deferred_queue: DeferredPayoutQueue = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let deferred_cfg = DeferredPayoutConfig::from_env();
    let deferred_rpc = if l1_rpc_url.is_empty() { None } else { Some(l1_rpc_url.clone()) };
    let deferred_wallet = if pool_fee_address.is_empty() { None } else { Some(pool_fee_address.clone()) };
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
    spawn_payout_confirmation_sweep(deferred_rpc.clone(), sweep_interval);

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

    let (_shutdown_tx, shutdown_rx) = watch::channel(false);

    let feed_server = server.clone();
    let feed_l1_rpc_url = l1_rpc_url.clone();
    let feed_handle = tokio::spawn(async move {
        feed_server
            .template_feed_loop(feed_l1_rpc_url, args.miner_address, shutdown_rx)
            .await;
    });

    let run_handle = tokio::spawn(async move {
        let _ = server.run(listener).await;
    });

    // ── Extra port listeners (difficulty stratification) ──────────────────
    let extra_ports = ExtraPortConfig::parse_from_env();
    for ep in &extra_ports {
        info!(
            "extra_port: binding {} label={} default_diff={}",
            ep.bind_addr, ep.label, ep.default_difficulty
        );
        let bind = ep.bind_addr.clone();
        let server_clone = StratumServer::new(pool.clone());
        tokio::spawn(async move {
            match TcpListener::bind(&bind).await {
                Ok(listener) => {
                    info!("extra_port: listening on {}", bind);
                    let _ = server_clone.run(listener).await;
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
                let server_clone = StratumServer::new(pool.clone());
                tokio::spawn(async move {
                    match TcpListener::bind(&tls_bind).await {
                        Ok(listener) => {
                            info!("tls: listening on {}", tls_bind);
                            loop {
                                match listener.accept().await {
                                    Ok((socket, peer)) => {
                                        let acceptor = acceptor.clone();
                                        let server = server_clone.clone();
                                        tokio::spawn(async move {
                                            match acceptor.accept(socket).await {
                                                Ok(tls_stream) => {
                                                    server.handle_tls_connection(tls_stream, peer).await;
                                                }
                                                Err(e) => {
                                                    warn!("tls handshake failed from {}: {}", peer, e);
                                                }
                                            }
                                        });
                                    }
                                    Err(e) => {
                                        warn!("tls accept error: {}", e);
                                        break;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            warn!("tls: failed to bind {}: {} — continuing without TLS", tls_bind, e);
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
    let api_handle = tokio::task::spawn_blocking(move || {
        let api = PoolApi::new(api_pool, None, Some(api_bridge));
        if let Err(e) = api.serve(&api_bind) {
            tracing::error!("pool API server error: {}", e);
        }
    });

    // ── Payout sweeper ────────────────────────────────────────────────────
    let sweep_pool = Arc::clone(&pool);
    let sweep_handle = tokio::spawn(async move {
        let interval = Duration::from_secs(args.payout_interval_s);
        PayoutSweeper::new(sweep_pool, interval)
            .with_notifier(notifier.clone())
            .run()
            .await;
    });

    tokio::select! {
        _ = feed_handle => {},
        _ = run_handle => {},
        _ = api_handle => {},
        _ = sweep_handle => {},
    }

    info!("zion-pool stopped");
    Ok(())
}
