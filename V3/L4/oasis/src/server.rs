//! OASIS REST API Server — Axum HTTP server for UE5 client, mobile app, web dashboard.
//!
//! ## Endpoints
//!
//! | Method | Path | Description |
//! |--------|------|-------------|
//! | GET    | /health | Health check |
//! | GET    | /api/v1/oasis/player/:address | Get player profile |
//! | POST   | /api/v1/oasis/player/:address/xp | Award XP to player |
//! | GET    | /api/v1/oasis/leaderboard | Top players by XP |
//! | POST   | /api/v1/oasis/guild | Create a guild |
//! | GET    | /api/v1/oasis/guild/:id | Get guild info |
//! | POST   | /api/v1/oasis/guild/:id/join | Join a guild |
//! | GET    | /api/v1/oasis/map | Full territory map |
//! | GET    | /api/v1/oasis/rewards/pools | Reward pool status |

use crate::api::ApiResponse;
use crate::config::OasisConfig;
use crate::db::OasisDb;
use crate::guild::Guild;
use crate::rewards::{RewardPool, RewardSlot};
use crate::territory::TerritoryMap;
use crate::xp::{XpSource, XpSystem};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::info;

/// Shared application state.
#[derive(Clone)]
pub struct OasisState {
    pub db: OasisDb,
    pub config: OasisConfig,
    pub xp_sys: Arc<XpSystem>,
}

impl OasisState {
    pub fn new(db: OasisDb, config: OasisConfig) -> Self {
        let daily_cap = config.daily_xp_cap;
        Self {
            db,
            config,
            xp_sys: Arc::new(XpSystem { daily_cap }),
        }
    }
}

/// Build the Axum router with all OASIS routes.
pub fn build_router(state: OasisState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/v1/oasis/player/:address", get(get_player))
        .route("/api/v1/oasis/player/:address/xp", post(award_xp))
        .route("/api/v1/oasis/leaderboard", get(leaderboard))
        .route("/api/v1/oasis/guild", post(create_guild))
        .route("/api/v1/oasis/guild/:id", get(get_guild))
        .route("/api/v1/oasis/guild/:id/join", post(join_guild))
        .route("/api/v1/oasis/map", get(territory_map))
        .route("/api/v1/oasis/rewards/pools", get(reward_pools))
        .with_state(state)
}

/// Start the HTTP server on the configured port.
pub async fn start_server(state: OasisState) -> anyhow::Result<()> {
    let bind = format!("{}:{}", state.config.bind, state.config.port);
    let router = build_router(state);
    let listener = TcpListener::bind(&bind).await?;
    info!("OASIS API server listening on http://{}", bind);
    axum::serve(listener, router).await?;
    Ok(())
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// GET /health
async fn health() -> impl IntoResponse {
    #[derive(Serialize)]
    struct Health {
        status: &'static str,
        service: &'static str,
        version: &'static str,
    }
    Json(ApiResponse::ok(Health {
        status: "ok",
        service: "zion-oasis",
        version: env!("CARGO_PKG_VERSION"),
    }))
}

/// GET /api/v1/oasis/player/:address
async fn get_player(
    State(state): State<OasisState>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    match state.db.get_or_create_player(&address) {
        Ok(player) => (StatusCode::OK, Json(ApiResponse::ok(player))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::<()>::error(&e.to_string())),
        )
            .into_response(),
    }
}

/// Request body for POST /api/v1/oasis/player/:address/xp
#[derive(Debug, Deserialize)]
pub struct AwardXpRequest {
    pub source: String,
    pub amount: Option<u64>,
    pub details: Option<serde_json::Value>,
}

/// Response for XP award
#[derive(Debug, Serialize)]
pub struct AwardXpResponse {
    pub address: String,
    pub xp_awarded: u64,
    pub total_xp: u64,
    pub level: String,
    pub leveled_up: bool,
}

/// POST /api/v1/oasis/player/:address/xp
async fn award_xp(
    State(state): State<OasisState>,
    Path(address): Path<String>,
    Json(req): Json<AwardXpRequest>,
) -> impl IntoResponse {
    let mut player = match state.db.get_or_create_player(&address) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::<()>::error(&e.to_string())),
            )
                .into_response()
        }
    };

    // Build XP source from request
    let amount = req.amount.unwrap_or(10);
    let source = match req.source.as_str() {
        "block_mined" => XpSource::BlockMined {
            block_height: 0,
            shares: amount,
        },
        "meditation" => XpSource::Meditation {
            duration_minutes: amount as u32,
        },
        "tithe" => XpSource::Tithe {
            category: "general".to_string(),
            amount,
        },
        "guild_quest" => XpSource::GuildQuest {
            quest_id: "quest-0".to_string(),
        },
        "referral" => XpSource::Referral {
            referred_address: "unknown".to_string(),
        },
        _ => XpSource::BlockMined {
            block_height: 0,
            shares: amount.min(100),
        },
    };

    let award = state
        .xp_sys
        .award(player.total_xp, player.level, &source, player.daily_xp);

    player.total_xp = award.new_total_xp;
    player.daily_xp += award.actual_amount;
    player.level = award.new_level;

    if let Err(e) = state.db.save_player(&player) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::<()>::error(&e.to_string())),
        )
            .into_response();
    }

    let resp = AwardXpResponse {
        address,
        xp_awarded: award.actual_amount,
        total_xp: award.new_total_xp,
        level: award.new_level.name().to_string(),
        leveled_up: award.leveled_up,
    };
    (StatusCode::OK, Json(ApiResponse::ok(resp))).into_response()
}

/// GET /api/v1/oasis/leaderboard
async fn leaderboard(
    State(state): State<OasisState>,
) -> impl IntoResponse {
    match state.db.top_players(100) {
        Ok(entries) => (StatusCode::OK, Json(ApiResponse::ok(entries))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::<()>::error(&e.to_string())),
        )
            .into_response(),
    }
}

/// Request for POST /api/v1/oasis/guild
#[derive(Debug, Deserialize)]
pub struct CreateGuildRequest {
    pub name: String,
    pub founder: String,
    pub description: Option<String>,
}

/// POST /api/v1/oasis/guild
async fn create_guild(
    State(state): State<OasisState>,
    Json(req): Json<CreateGuildRequest>,
) -> impl IntoResponse {
    // Check founder XP requirement (Mental level = 5000 XP)
    match state.db.get_player(&req.founder) {
        Ok(Some(player)) if player.total_xp < crate::guild::MIN_LEVEL_CREATE => {
            return (
                StatusCode::FORBIDDEN,
                Json(ApiResponse::<()>::error(
                    "Insufficient level to create a guild (requires Mental level, 5000 XP)",
                )),
            )
                .into_response();
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::<()>::error(&e.to_string())),
            )
                .into_response();
        }
        _ => {}
    }

    let id = uuid::Uuid::new_v4().to_string();
    let mut guild = Guild::new(id, req.name, req.founder);
    if let Some(desc) = req.description {
        guild.description = desc;
    }

    if let Err(e) = state.db.save_guild(&guild) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::<()>::error(&e.to_string())),
        )
            .into_response();
    }

    (StatusCode::CREATED, Json(ApiResponse::ok(guild))).into_response()
}

/// GET /api/v1/oasis/guild/:id
async fn get_guild(
    State(state): State<OasisState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.db.get_guild(&id) {
        Ok(Some(guild)) => (StatusCode::OK, Json(ApiResponse::ok(guild))).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::<()>::error("Guild not found")),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::<()>::error(&e.to_string())),
        )
            .into_response(),
    }
}

/// Request for POST /api/v1/oasis/guild/:id/join
#[derive(Debug, Deserialize)]
pub struct JoinGuildRequest {
    pub address: String,
}

/// POST /api/v1/oasis/guild/:id/join
async fn join_guild(
    State(state): State<OasisState>,
    Path(id): Path<String>,
    Json(req): Json<JoinGuildRequest>,
) -> impl IntoResponse {
    let mut guild = match state.db.get_guild(&id) {
        Ok(Some(g)) => g,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiResponse::<()>::error("Guild not found")),
            )
                .into_response()
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::<()>::error(&e.to_string())),
            )
                .into_response()
        }
    };

    // Check player XP for Emotional level
    match state.db.get_player(&req.address) {
        Ok(Some(player)) if player.total_xp < crate::guild::MIN_LEVEL_JOIN => {
            return (
                StatusCode::FORBIDDEN,
                Json(ApiResponse::<()>::error(
                    "Insufficient level to join a guild (requires Emotional level, 1000 XP)",
                )),
            )
                .into_response();
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResponse::<()>::error(&e.to_string())),
            )
                .into_response();
        }
        _ => {}
    }

    if let Err(e) = guild.add_member(&req.address) {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::<()>::error(&e.to_string())),
        )
            .into_response();
    }

    // Update player's guild_id
    if let Ok(mut player) = state.db.get_or_create_player(&req.address) {
        player.guild_id = Some(id.clone());
        let _ = state.db.save_player(&player);
    }

    if let Err(e) = state.db.save_guild(&guild) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::<()>::error(&e.to_string())),
        )
            .into_response();
    }

    (StatusCode::OK, Json(ApiResponse::ok(guild))).into_response()
}

/// GET /api/v1/oasis/map
async fn territory_map() -> impl IntoResponse {
    let map = TerritoryMap::genesis_map();
    Json(ApiResponse::ok(map))
}

/// GET /api/v1/oasis/rewards/pools
async fn reward_pools() -> impl IntoResponse {
    #[derive(Serialize)]
    struct PoolsResponse {
        pools: Vec<RewardPool>,
        total_allocated: u64,
        total_distributed: u64,
    }

    let pools: Vec<RewardPool> = RewardSlot::all()
        .into_iter()
        .map(RewardPool::new)
        .collect();
    let total_allocated: u64 = pools.iter().map(|p| p.total).sum();
    let total_distributed: u64 = pools.iter().map(|p| p.distributed).sum();
    let resp = PoolsResponse {
        pools,
        total_allocated,
        total_distributed,
    };
    Json(ApiResponse::ok(resp))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use crate::player::Player;
    use tower::util::ServiceExt;

    fn test_state() -> OasisState {
        let db = OasisDb::in_memory().expect("db");
        let config = OasisConfig::default();
        OasisState::new(db, config)
    }

    #[tokio::test]
    async fn test_health_endpoint() {
        let state = test_state();
        let app = build_router(state);
        let resp = app
            .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_player_creates_if_missing() {
        let state = test_state();
        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/oasis/player/zion1newplayer")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_leaderboard_endpoint() {
        let state = test_state();
        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/oasis/leaderboard")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_territory_map_endpoint() {
        let state = test_state();
        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/oasis/map")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_reward_pools_endpoint() {
        let state = test_state();
        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/oasis/rewards/pools")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_award_xp_endpoint() {
        let state = test_state();
        // Pre-create player first
        state.db.save_player(&Player::new("zion1miner".to_string())).unwrap();
        let app = build_router(state);
        let body = serde_json::json!({
            "source": "block_mined",
            "amount": 10
        });
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/oasis/player/zion1miner/xp")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_get_guild_not_found() {
        let state = test_state();
        let app = build_router(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/oasis/guild/nonexistent-id")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }
}
