//! Non-inference routes: /v1/models, /v1/usage, /v1/admin/*, /health.

use crate::{
    auth::Auth,
    error::{ApiError, ApiResult},
    meter::{key_hash, Plan},
    proxy::AppState,
};
use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;

/// GET /health — unauthenticated liveness.
pub async fn health(State(st): State<Arc<AppState>>) -> Json<Value> {
    let mut upstreams = Vec::new();
    for m in st.catalog.all() {
        for (i, u) in m.upstreams.iter().enumerate() {
            upstreams.push(json!({
                "alias": m.alias,
                "position": i,
                "degraded": u.degraded,
                "live": st.catalog.is_live(&u.base).await,
            }));
        }
    }
    Json(json!({ "status": "ok", "service": "hiran-gateway", "upstreams": upstreams }))
}

/// GET /v1/models — only live aliases; free list for unauthenticated
/// callers too (it's the price list).
pub async fn list_models(State(st): State<Arc<AppState>>) -> Json<Value> {
    let mut out = Vec::new();
    for m in st.catalog.all() {
        let mut live = false;
        let mut degraded = false;
        for (i, u) in m.upstreams.iter().enumerate() {
            if st.catalog.is_live(&u.base).await {
                live = true;
                degraded = i > 0; // serving non-primary → degraded tier
                break;
            }
        }
        if !live {
            continue;
        }
        out.push(json!({
            "id": m.alias,
            "object": "model",
            "created": 1_760_000_000,
            "owned_by": "hiranyagarbha",
            "x-context": m.context,
            "x-tier": m.tier,
            "x-price-1m-usd": m.price_1m_usd,
            "x-degraded": degraded,
        }));
    }
    Json(json!({ "object": "list", "data": out }))
}

/// GET /v1/usage — caller's own key usage, last 30 days.
pub async fn usage(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let key = Auth::extract_key(&headers)?;
    let vk = st.auth.verify(&key, &st.meter).await?;
    let rows = st
        .meter
        .usage_for_key(&vk.key_hash, 30)
        .map_err(|e| ApiError::server(e.to_string()))?;
    let days: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "day": r.day,
                "requests": r.requests,
                "total_tokens": r.total_tok,
            })
        })
        .collect();
    let (rpm, daily) = vk.plan.limits();
    Ok(Json(json!({
        "plan": vk.plan.as_str(),
        "limits": { "requests_per_minute": rpm, "tokens_per_day": daily },
        "used_today": st.meter.tokens_today(&vk.key_hash),
        "days": days,
    })))
}

// ── Admin ──────────────────────────────────────────────────────────

fn require_admin(st: &AppState, headers: &HeaderMap) -> ApiResult<()> {
    let configured = match &st.admin_key_hash {
        Some(h) => h,
        None => return Err(ApiError::not_found("admin api disabled")),
    };
    let presented = headers
        .get("x-admin-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let hash = hex::encode(Sha256::digest(presented.as_bytes()));
    if hash == *configured {
        Ok(())
    } else {
        Err(ApiError::unauthorized("bad admin key"))
    }
}

#[derive(Deserialize)]
pub struct SetPlanBody {
    /// Raw zis_* key (hashed before store) or already-hashed 64-hex string.
    pub key: String,
    pub plan: String,
}

/// POST /v1/admin/plan — set tier for a key.
pub async fn set_plan(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<SetPlanBody>,
) -> ApiResult<Json<Value>> {
    require_admin(&st, &headers)?;
    let plan = match body.plan.as_str() {
        "free" => Plan::Free,
        "pro" => Plan::Pro,
        "team" => Plan::Team,
        other => return Err(ApiError::bad_request(format!("unknown plan '{other}'"))),
    };
    let kh = if body.key.len() == 64 && body.key.chars().all(|c| c.is_ascii_hexdigit()) {
        body.key.to_lowercase()
    } else {
        key_hash(&body.key)
    };
    st.meter
        .set_plan(&kh, plan)
        .map_err(|e| ApiError::server(e.to_string()))?;
    Ok(Json(json!({ "ok": true, "key_hash": &kh[..12], "plan": plan.as_str() })))
}

/// GET /v1/admin/plans — list configured tiers (truncated hashes).
pub async fn list_plans(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    require_admin(&st, &headers)?;
    let rows = st
        .meter
        .list_plans()
        .map_err(|e| ApiError::server(e.to_string()))?;
    let plans: Vec<Value> = rows
        .iter()
        .map(|(kh, plan)| json!({ "key_hash": &kh[..kh.len().min(12)], "plan": plan }))
        .collect();
    Ok(Json(json!({ "plans": plans })))
}
