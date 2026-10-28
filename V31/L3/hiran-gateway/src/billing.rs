//! Stripe webhook → plan tier sync (spec §4).
//!
//! `POST /v1/stripe/webhook` — verifies the `Stripe-Signature` header
//! (HMAC-SHA256 over `{t}.{payload}`, 5 min tolerance — same scheme
//! `stripe.webhooks.constructEvent` uses in the MarketPlace Next app),
//! then maps subscription events to plan tiers:
//!
//!   checkout.session.completed   → link stripe customer → key_hash
//!   customer.subscription.*      → price id → plan (metadata.key_hash or
//!                                  stored customer link; deleted → free)
//!
//! Key linkage: the subscribe flow puts `metadata.key_hash = sha256(zis key)`
//! on the checkout session; Stripe propagates it onto the subscription.

use crate::{
    error::{ApiError, ApiResult},
    meter::{key_hash, Meter, Plan},
    proxy::AppState,
};
use axum::{body::Bytes, extract::State, http::HeaderMap, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;

const SIG_TOLERANCE_SECS: i64 = 300;

#[derive(Debug, Clone)]
pub struct StripeConfig {
    pub webhook_secret: Option<String>,
    /// price id → plan mapping (env STRIPE_PRICE_PRO / STRIPE_PRICE_TEAM).
    pub price_pro: Option<String>,
    pub price_team: Option<String>,
}

impl StripeConfig {
    pub fn plan_for_price(&self, price_id: &str) -> Option<Plan> {
        if self.price_pro.as_deref() == Some(price_id) {
            Some(Plan::Pro)
        } else if self.price_team.as_deref() == Some(price_id) {
            Some(Plan::Team)
        } else {
            None
        }
    }
}

/// POST /v1/stripe/webhook
pub async fn webhook(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult<Json<Value>> {
    let stripe_cfg = st
        .stripe
        .clone()
        .ok_or_else(|| ApiError::server("stripe not configured"))?;
    let secret = stripe_cfg
        .webhook_secret
        .clone()
        .ok_or_else(|| ApiError::server("webhook secret not configured"))?;

    let sig_hdr = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::bad_request("missing stripe-signature"))?;
    verify_signature(sig_hdr, &body, &secret)?;

    let event: StripeEvent =
        serde_json::from_slice(&body).map_err(|e| ApiError::bad_request(e.to_string()))?;
    handle_event(st, &stripe_cfg, event)
        .await
        .map(|msg| Json(json!({ "received": true, "detail": msg })))
}

#[derive(Deserialize)]
struct StripeEvent {
    #[serde(rename = "type")]
    kind: String,
    data: StripeData,
}

#[derive(Deserialize)]
struct StripeData {
    object: Value,
}

async fn handle_event(st: Arc<AppState>, cfg: &StripeConfig, ev: StripeEvent) -> ApiResult<String> {
    let obj = ev.data.object;
    match ev.kind.as_str() {
        "checkout.session.completed" => {
            let customer = obj.get("customer").and_then(Value::as_str).unwrap_or("");
            let kh = metadata_key_hash(&obj);
            if !customer.is_empty() && !kh.is_empty() {
                st.meter
                    .set_stripe_customer(customer, &kh)
                    .map_err(|e| ApiError::server(e.to_string()))?;
                return Ok(format!(
                    "linked customer {}… → key",
                    &customer[..customer.len().min(8)]
                ));
            }
            Ok("session without key_hash metadata — ignored".into())
        }
        "customer.subscription.created" | "customer.subscription.updated" => {
            let kh = resolve_key_hash(&st.meter, &obj)?;
            let price_id = subscription_price_id(&obj)
                .ok_or_else(|| ApiError::bad_request("subscription without price id"))?;
            let plan = cfg
                .plan_for_price(&price_id)
                .ok_or_else(|| ApiError::bad_request(format!("unmapped price '{price_id}'")))?;
            set_plan(&st, &kh, plan)
        }
        "customer.subscription.deleted" => {
            let kh = resolve_key_hash(&st.meter, &obj)?;
            set_plan(&st, &kh, Plan::Free)
        }
        _ => Ok(format!("event {} ignored", ev.kind)),
    }
}

/// key_hash from subscription metadata, else via stored customer link.
fn resolve_key_hash(meter: &Meter, obj: &Value) -> ApiResult<String> {
    let kh = metadata_key_hash(obj);
    if !kh.is_empty() {
        return Ok(kh);
    }
    let customer = obj.get("customer").and_then(Value::as_str).unwrap_or("");
    if customer.is_empty() {
        return Err(ApiError::bad_request(
            "no key_hash metadata and no customer",
        ));
    }
    meter
        .stripe_key_hash(customer)
        .map_err(|e| ApiError::server(e.to_string()))?
        .ok_or_else(|| ApiError::bad_request(format!("unknown stripe customer '{customer}'")))
}

/// metadata.key_hash — accepts raw `zis_*` (hashed) or 64-hex.
fn metadata_key_hash(obj: &Value) -> String {
    let raw = obj
        .pointer("/metadata/key_hash")
        .and_then(Value::as_str)
        .unwrap_or("");
    if raw.is_empty() {
        return String::new();
    }
    if raw.len() == 64 && raw.chars().all(|c| c.is_ascii_hexdigit()) {
        raw.to_lowercase()
    } else {
        key_hash(raw)
    }
}

/// First subscription item's price id.
fn subscription_price_id(obj: &Value) -> Option<String> {
    obj.pointer("/items/data/0/price/id")
        .or_else(|| obj.pointer("/plan/id"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn set_plan(st: &AppState, kh: &str, plan: Plan) -> ApiResult<String> {
    st.meter
        .set_plan(kh, plan)
        .map_err(|e| ApiError::server(e.to_string()))?;
    tracing::info!(
        key_hash = &kh[..kh.len().min(12)],
        plan = plan.as_str(),
        "plan updated via stripe webhook"
    );
    Ok(format!("plan={} set", plan.as_str()))
}

// ── Signature verification ──────────────────────────────────────────

/// `Stripe-Signature: t=<unix>,v1=<hex>,v0=...` — verify any v1 matches
/// HMAC-SHA256(secret, "{t}.{payload}") and t within 5 min.
fn verify_signature(header: &str, payload: &[u8], secret: &str) -> ApiResult<()> {
    let mut t: Option<i64> = None;
    let mut v1s: Vec<String> = Vec::new();
    for part in header.split(',') {
        let mut kv = part.splitn(2, '=');
        match (kv.next(), kv.next()) {
            (Some("t"), Some(v)) => t = v.parse().ok(),
            (Some("v1"), Some(v)) => v1s.push(v.to_string()),
            _ => {}
        }
    }
    let t = t.ok_or_else(|| ApiError::bad_request("signature header missing t"))?;
    if v1s.is_empty() {
        return Err(ApiError::bad_request("signature header missing v1"));
    }
    let now = chrono::Utc::now().timestamp();
    if (now - t).abs() > SIG_TOLERANCE_SECS {
        return Err(ApiError::bad_request("stale webhook timestamp"));
    }
    let signed = format!("{t}.{}", String::from_utf8_lossy(payload));
    let expect = hex::encode(hmac_sha256(secret.as_bytes(), signed.as_bytes()));
    if v1s
        .iter()
        .any(|v| const_eq(v.as_bytes(), expect.as_bytes()))
    {
        Ok(())
    } else {
        Err(ApiError::unauthorized("invalid webhook signature"))
    }
}

/// RFC 2104 HMAC-SHA256 (avoids pulling the hmac crate for one call site).
fn hmac_sha256(key: &[u8], msg: &[u8]) -> Vec<u8> {
    const BLOCK: usize = 64;
    let mut k = if key.len() > BLOCK {
        Sha256::digest(key).to_vec()
    } else {
        key.to_vec()
    };
    k.resize(BLOCK, 0);
    let ipad: Vec<u8> = k.iter().map(|b| b ^ 0x36).collect();
    let opad: Vec<u8> = k.iter().map(|b| b ^ 0x5c).collect();
    let mut inner = Sha256::new();
    inner.update(&ipad);
    inner.update(msg);
    let inner_digest = inner.finalize();
    let mut outer = Sha256::new();
    outer.update(&opad);
    outer.update(inner_digest);
    outer.finalize().to_vec()
}

fn const_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sign(secret: &str, t: i64, payload: &[u8]) -> String {
        let signed = format!("{t}.{}", String::from_utf8_lossy(payload));
        format!(
            "t={t},v1={}",
            hex::encode(hmac_sha256(secret.as_bytes(), signed.as_bytes()))
        )
    }

    #[test]
    fn signature_roundtrip() {
        let secret = "whsec_test";
        let payload = br#"{"type":"checkout.session.completed"}"#;
        let t = chrono::Utc::now().timestamp();
        let hdr = sign(secret, t, payload);
        assert!(verify_signature(&hdr, payload, secret).is_ok());
        // tampered payload
        assert!(verify_signature(&hdr, b"{}", secret).is_err());
        // wrong secret
        assert!(verify_signature(&hdr, payload, "whsec_other").is_err());
        // stale
        let old = sign(secret, t - 400, payload);
        assert!(verify_signature(&old, payload, secret).is_err());
        // multi v1 header (rotation)
        let mixed = format!("t={t},v1=deadbeef,v1={}", hdr.split("v1=").nth(1).unwrap());
        assert!(verify_signature(&mixed, payload, secret).is_ok());
    }

    #[test]
    fn metadata_and_price_helpers() {
        let obj = json!({
            "customer": "cus_123",
            "metadata": {"key_hash": "zis_abc"},
            "items": {"data": [{"price": {"id": "price_pro"}}]},
        });
        assert_eq!(metadata_key_hash(&obj), key_hash("zis_abc"));
        assert_eq!(subscription_price_id(&obj).as_deref(), Some("price_pro"));
        let cfg = StripeConfig {
            webhook_secret: None,
            price_pro: Some("price_pro".into()),
            price_team: Some("price_team".into()),
        };
        assert_eq!(cfg.plan_for_price("price_pro"), Some(Plan::Pro));
        assert_eq!(cfg.plan_for_price("nope"), None);
    }
}
