//! ZION NCL Daemon — V3 L3 Neural Compute Layer marketplace service.
//!
//! Serves the NCL REST API (job queue + worker registry + scheduling) with
//! SQLite persistence so queued jobs survive restarts.
//!
//! ## Env config
//! ```sh
//! NCL_BIND=127.0.0.1:8098        # bind address (localhost-only by default)
//! NCL_DB_PATH=/opt/zion/data/ncl/ncl.db   # unset → ephemeral in-memory
//! NCL_MAX_QUEUE=1000             # queued-job cap
//! RUST_LOG=zion_ncl=info         # tracing filter
//! ```

use std::net::SocketAddr;

use tracing::{error, info, warn};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use zion_ncl::api::{create_router, NclAppState};
use zion_ncl::store::JobStore;
use zion_ncl::{JobScheduler, ReputationRegistry};

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env().add_directive("zion_ncl=info".parse().unwrap()))
        .init();

    info!("🧠 ZION NCL Daemon v{} starting...", env!("CARGO_PKG_VERSION"));

    let bind: SocketAddr = env_or("NCL_BIND", "127.0.0.1:8098")
        .parse()
        .expect("invalid NCL_BIND");
    let max_queue: usize = env_or("NCL_MAX_QUEUE", "1000")
        .parse()
        .expect("invalid NCL_MAX_QUEUE");
    let db_path = std::env::var("NCL_DB_PATH").ok().filter(|s| !s.is_empty());

    let state = match &db_path {
        Some(path) => {
            if let Some(parent) = std::path::Path::new(path).parent() {
                if let Err(e) = std::fs::create_dir_all(parent) {
                    error!("cannot create NCL_DB_PATH dir {}: {}", parent.display(), e);
                    std::process::exit(1);
                }
            }
            let store = match JobStore::open(path) {
                Ok(s) => s,
                Err(e) => {
                    error!("cannot open NCL store {}: {}", path, e);
                    std::process::exit(1);
                }
            };

            // Re-hydrate queued jobs into the scheduler. Non-queued jobs stay
            // in the DB as history but are not re-armed (Assigned/Running jobs
            // from before the crash are stale — workers are gone).
            let mut scheduler = JobScheduler::new(max_queue);
            match store.load_pending() {
                Ok(pending) => {
                    let n = pending.len();
                    for job in pending {
                        if let Err(e) = scheduler.submit_job(job) {
                            warn!("re-hydrate skip job: {}", e);
                        }
                    }
                    info!("re-hydrated {} queued jobs from {}", n, path);
                }
                Err(e) => warn!("load_pending failed ({}): starting empty", e),
            }

            // NOTE: scheduler runs WITHOUT a shared reputation registry —
            // `JobScheduler::with_reputation` takes the registry by value
            // (plain HashMap, not Arc), so it would only see a stale copy.
            // Worker selection falls back to first-eligible until the
            // scheduler takes Arc<Mutex<ReputationRegistry>>.
            NclAppState::persistent(scheduler, ReputationRegistry::new(), store)
        }
        None => {
            warn!("NCL_DB_PATH unset — running ephemeral (jobs lost on restart)");
            NclAppState::ephemeral(JobScheduler::new(max_queue), ReputationRegistry::new())
        }
    };

    let app = create_router(state);
    let listener = match tokio::net::TcpListener::bind(bind).await {
        Ok(l) => l,
        Err(e) => {
            error!("failed to bind {}: {}", bind, e);
            std::process::exit(1);
        }
    };

    info!("NCL API listening on http://{} (db={})", bind, db_path.as_deref().unwrap_or("<memory>"));
    if let Err(e) = axum::serve(listener, app).await {
        error!("server error: {}", e);
        std::process::exit(1);
    }
}
