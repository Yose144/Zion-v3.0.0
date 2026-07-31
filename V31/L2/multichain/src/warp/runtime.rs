//! WARP runtime — reusable long-running bridge node loop.
//!
//! Encapsulates the same startup/shutdown logic as the `warpd` binary:
//!   - open `TransferDb`
//!   - build validator set and `WarpRouter`
//!   - spawn HTTP API server, chain watcher, outbound executor, timelock monitor
//!
//! Used by both the standalone `warpd` binary and `MultichainService`.

use std::sync::Arc;

use tokio::sync::Mutex;
use tracing::{error, info};

use crate::warp::config::WarpConfig;
use crate::warp::db::TransferDb;
use crate::warp::error::WarpResult;
use crate::warp::executor::OutboundExecutor;
use crate::warp::server::{create_router, WarpState};
use crate::warp::timelock::TimelockMonitor;
use crate::warp::validator::WarpValidatorSet;
use crate::warp::watcher::WarpWatcher;
use crate::warp::WarpRouter;

/// Long-running WARP bridge runtime.
pub struct WarpRuntime {
    config: WarpConfig,
    #[allow(dead_code)]
    db: Option<TransferDb>,
    router: Arc<Mutex<WarpRouter>>,
    validators: Arc<Mutex<WarpValidatorSet>>,
}

impl WarpRuntime {
    /// Create a runtime from `config`.
    ///
    /// Opens the `TransferDb`, loads validator keys from env, and builds a
    /// `WarpRouter` that restores persisted transfers from the DB.
    pub fn new(config: WarpConfig) -> WarpResult<Self> {
        let db_path = config.database_path.clone();
        std::fs::create_dir_all(
            std::path::Path::new(&db_path)
                .parent()
                .unwrap_or(std::path::Path::new(".")),
        )
        .ok();
        let transfer_db = TransferDb::open(&db_path).ok();

        let mut validator_set = WarpValidatorSet::new(config.quorum);
        validator_set.load_from_env()?;
        info!(
            "[warpd] Loaded {} validator(s), can sign quorum locally: {}",
            validator_set.total_count(),
            validator_set.can_sign_quorum_locally()
        );
        let validators = Arc::new(Mutex::new(validator_set));

        let registry = crate::warp::ChainRegistry::with_defaults();
        let fee_engine = crate::warp::FeeEngine::with_defaults();
        let db = transfer_db.clone().ok_or_else(|| {
            crate::warp::error::WarpError::Internal("WARP database not available".to_string())
        })?;
        let mut router = WarpRouter::with_db(registry, fee_engine, validators.clone(), db.clone())?;
        router.daily_limit = config.daily_limit_flowers();
        router.timelock_threshold = config.timelock_threshold_flowers();

        Ok(Self {
            config,
            db: Some(db),
            router: Arc::new(Mutex::new(router)),
            validators,
        })
    }

    /// Shared router handle.
    pub fn router(&self) -> Arc<Mutex<WarpRouter>> {
        Arc::clone(&self.router)
    }

    /// Validator set handle.
    pub fn validators(&self) -> Arc<Mutex<WarpValidatorSet>> {
        Arc::clone(&self.validators)
    }

    /// Run the WARP daemon loops forever.
    ///
    /// Returns `Ok(())` if any of the loops exits (which is treated as a
    /// fatal shutdown signal) or `Err` on initialization failure.
    pub async fn run(self) -> WarpResult<()> {
        let bind_addr = format!("{}:{}", self.config.listen_addr, self.config.listen_port);
        let app_state = WarpState {
            router: self.router.clone(),
            config: self.config.clone(),
            db: self.db.clone(),
        };
        let app = create_router(app_state);
        let bind_addr_for_task = bind_addr.clone();
        let api_handle = tokio::spawn(async move {
            info!("[warpd] API server listening on {}", bind_addr_for_task);
            let listener = match tokio::net::TcpListener::bind(&bind_addr_for_task).await {
                Ok(l) => l,
                Err(e) => {
                    error!("[warpd] Failed to bind API server: {}", e);
                    return;
                }
            };
            if let Err(e) = axum::serve(listener, app).await {
                error!("[warpd] API server error: {}", e);
            }
        });

        let watcher_db = self.db.clone();
        let watcher =
            WarpWatcher::from_config(self.config.clone(), self.router.clone(), watcher_db);
        let watcher_handle = tokio::spawn(watcher.run());

        let executor = OutboundExecutor::new(self.router.clone(), self.validators.clone());
        let executor_handle = tokio::spawn(executor.run());

        let timelock = TimelockMonitor::default(self.router.clone());
        let timelock_handle = tokio::spawn(timelock.run());

        info!("[warpd] WARP daemon started. API: http://{}", bind_addr);

        tokio::select! {
            _ = api_handle => error!("[warpd] API server exited"),
            _ = watcher_handle => error!("[warpd] Watcher exited"),
            _ = executor_handle => error!("[warpd] Executor exited"),
            _ = timelock_handle => error!("[warpd] Timelock monitor exited"),
        }

        Ok(())
    }
}
