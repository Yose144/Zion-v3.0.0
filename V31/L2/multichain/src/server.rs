use axum::{routing::get, Router};

use crate::config::ServerConfig;
use crate::error::MultichainResult;

/// HTTP API gateway for the Multi-Chain layer.
#[derive(Clone, Debug)]
pub struct ApiServer {
    config: ServerConfig,
}

impl ApiServer {
    pub fn new(config: ServerConfig) -> Self {
        Self { config }
    }

    pub async fn run(&self) -> MultichainResult<()> {
        let app = Router::new().route("/health", get(health));
        let listener = tokio::net::TcpListener::bind(format!("{}:{}", self.config.bind, self.config.port))
            .await
            .map_err(|e| crate::error::MultichainError::Internal(e.to_string()))?;
        axum::serve(listener, app)
            .await
            .map_err(|e| crate::error::MultichainError::Internal(e.to_string()))?;
        Ok(())
    }
}

async fn health() -> &'static str {
    "ok"
}
