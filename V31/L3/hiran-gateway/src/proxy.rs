//! OpenAI-compatible proxy with upstream failover + metering.

use crate::{
    auth::{Auth, VerifiedKey},
    error::{ApiError, ApiResult},
    meter::Meter,
    models::Catalog,
};
use axum::{
    body::Body,
    extract::State,
    http::HeaderMap,
    response::{IntoResponse, Response},
    Json,
};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

pub struct AppState {
    pub auth: Auth,
    pub catalog: Catalog,
    pub meter: Meter,
    pub client: reqwest::Client,
    pub timeout: Duration,
    pub fallback_timeout: Duration,
    pub admin_key_hash: Option<String>,
}

const MAX_TOKENS_CAP: u64 = 4096;
const MAX_PROMPT_CHARS: usize = 32_000;

/// POST /v1/chat/completions — plan-gated alias → ordered upstream chain.
pub async fn chat_completions(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(mut body): Json<Value>,
) -> ApiResult<Response> {
    let vk = authenticate(&st, &headers).await?;
    st.auth.check_limits(&vk, &st.meter)?;

    let model = body
        .get("model")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("missing model"))?
        .to_string();
    let def = st
        .catalog
        .get(&model)
        .ok_or_else(|| ApiError::not_found(format!("unknown model '{model}' — see /v1/models")))?
        .clone();

    let stream = body.get("stream").and_then(Value::as_bool).unwrap_or(false);

    // Clamp + normalize per spec §7.
    let prompt_est = estimate_prompt_tokens(&body);
    if prompt_est > (MAX_PROMPT_CHARS / 4) as u64 {
        return Err(ApiError::bad_request("prompt too large"));
    }
    {
        let obj = body
            .as_object_mut()
            .ok_or_else(|| ApiError::bad_request("body must be a JSON object"))?;
        let mt = obj.get("max_tokens").and_then(Value::as_u64).unwrap_or(MAX_TOKENS_CAP);
        obj.insert("max_tokens".into(), json!(mt.min(MAX_TOKENS_CAP)));
        if stream {
            // Metering must work on streams → force usage chunk.
            obj.insert("stream_options".into(), json!({"include_usage": true}));
        }
    }

    let started = std::time::Instant::now();
    let mut last_err = String::new();
    for (i, up) in def.upstreams.iter().enumerate() {
        let timeout = if i == 0 { st.timeout } else { st.fallback_timeout };
        let url = format!("{}/chat/completions", up.base.trim_end_matches('/'));
        let resp = match st.client.post(&url).json(&body).timeout(timeout).send().await {
            Ok(r) => r,
            Err(e) => {
                last_err = format!("{url}: {e}");
                tracing::warn!(model = %model, upstream = %up.base, error = %e, "upstream transport failed");
                continue;
            }
        };

        // Client-shaped errors (4xx) pass through — retrying won't help.
        if resp.status().is_client_error() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Ok((
                axum::http::StatusCode::from_u16(status.as_u16())
                    .unwrap_or(axum::http::StatusCode::BAD_REQUEST),
                Body::from(text),
            )
                .into_response());
        }
        if !resp.status().is_success() {
            last_err = format!("{url}: HTTP {}", resp.status());
            tracing::warn!(model = %model, upstream = %up.base, status = %resp.status(), "upstream 5xx — trying next");
            continue;
        }

        let latency = started.elapsed().as_millis() as u64;
        if stream {
            return Ok(stream_response(
                st.clone(), resp, vk, model, up.base.clone(), up.degraded, prompt_est, started,
            ));
        }
        return non_stream(
            st.clone(), resp, vk, model, up.base.clone(), up.degraded, prompt_est, latency,
        )
        .await;
    }

    Err(ApiError::overloaded(format!(
        "all upstreams failed for '{model}' ({last_err})"
    )))
}

/// POST /v1/completions — map prompt→chat message, force non-stream.
pub async fn completions(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> ApiResult<Response> {
    let prompt = body
        .get("prompt")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("missing prompt"))?
        .to_string();
    let mut chat = body;
    let obj = chat.as_object_mut().unwrap();
    obj.remove("prompt");
    obj.insert("messages".into(), json!([{"role": "user", "content": prompt}]));
    obj.insert("stream".into(), json!(false));
    chat_completions(State(st), headers, Json(chat)).await
}

async fn authenticate(st: &AppState, headers: &HeaderMap) -> ApiResult<VerifiedKey> {
    let key = Auth::extract_key(headers)?;
    st.auth.verify(&key, &st.meter).await
}

/// Non-streaming path: forward verbatim, meter from `usage`.
async fn non_stream(
    st: Arc<AppState>,
    resp: reqwest::Response,
    vk: VerifiedKey,
    model: String,
    upstream: String,
    degraded: bool,
    prompt_est: u64,
    latency: u64,
) -> ApiResult<Response> {
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| ApiError::server(format!("upstream body read failed: {e}")))?;
    let mut v: Value =
        serde_json::from_slice(&bytes).map_err(|_| ApiError::server("upstream returned non-JSON"))?;
    let (pt, ct, est) = usage_of(&v, prompt_est);
    record(&st, &vk, &model, pt, ct, &upstream, latency, est);
    if degraded {
        v["x-degraded"] = json!(true);
    }
    Ok(Json(v).into_response())
}

/// Streaming path: tee SSE bytes, harvest `usage`/deltas, record at end.
fn stream_response(
    st: Arc<AppState>,
    resp: reqwest::Response,
    vk: VerifiedKey,
    model: String,
    upstream: String,
    degraded: bool,
    prompt_est: u64,
    started: std::time::Instant,
) -> Response {
    let acc = Arc::new(Mutex::new(StreamAcc::default()));
    let acc_scan = acc.clone();

    // Pass upstream bytes through while scanning SSE lines for usage/delta content.
    let scanned = resp
        .bytes_stream()
        .inspect(move |item| {
            if let Ok(bytes) = item {
                if let Ok(text) = std::str::from_utf8(bytes) {
                    let mut a = acc_scan.lock().unwrap();
                    scan_chunk(text, &mut a);
                }
            }
        })
        .map(|item| item.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)));

    let stream = MeteredStream {
        inner: Box::pin(scanned),
        on_end: Some(Box::new(move || {
            let st = st.clone();
            let acc = acc.clone();
            let latency = started.elapsed().as_millis() as u64;
            tokio::spawn(async move {
                let (pt, ct, est) = {
                    let a = acc.lock().unwrap();
                    match a.usage {
                        Some((p, c)) => (p, c, false),
                        None => (prompt_est, a.delta_chars / 4, true),
                    }
                };
                record(&st, &vk, &model, pt, ct, &upstream, latency, est);
            });
        })),
    };

    let mut r = Response::new(Body::from_stream(stream));
    r.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        "text/event-stream".parse().unwrap(),
    );
    if degraded {
        r.headers_mut()
            .insert("x-degraded", axum::http::HeaderValue::from_static("true"));
    }
    r
}

#[derive(Default)]
struct StreamAcc {
    /// Incomplete trailing line carried between TCP chunks.
    tail: String,
    usage: Option<(u64, u64)>,
    delta_chars: u64,
}

fn scan_chunk(text: &str, acc: &mut StreamAcc) {
    let joined = format!("{}{}", acc.tail, text);
    let mut lines = joined.split('\n').peekable();
    while let Some(line) = lines.next() {
        if lines.peek().is_none() {
            acc.tail = line.to_string(); // last piece may be incomplete
            break;
        }
        let data = match line.trim().strip_prefix("data:") {
            Some(d) => d.trim(),
            None => continue,
        };
        if data == "[DONE]" {
            continue;
        }
        let Ok(v) = serde_json::from_str::<Value>(data) else { continue };
        if let Some(u) = v.get("usage") {
            let p = u.get("prompt_tokens").and_then(Value::as_u64).unwrap_or(0);
            let c = u.get("completion_tokens").and_then(Value::as_u64).unwrap_or(0);
            if p > 0 || c > 0 {
                acc.usage = Some((p, c));
            }
        }
        if let Some(delta) = v.pointer("/choices/0/delta/content").and_then(Value::as_str) {
            acc.delta_chars += delta.len() as u64;
        }
    }
}

/// Stream wrapper that fires `on_end` once when the inner stream ends
/// (client disconnect ends polling — usage then stays unmetered; that is
/// acceptable for MVP, the daily quota errs on the generous side).
struct MeteredStream {
    inner: std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send>>,
    on_end: Option<Box<dyn FnOnce() + Send>>,
}

impl futures_util::Stream for MeteredStream {
    type Item = Result<bytes::Bytes, std::io::Error>;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        match self.inner.as_mut().poll_next(cx) {
            std::task::Poll::Ready(None) => {
                if let Some(f) = self.on_end.take() {
                    f();
                }
                std::task::Poll::Ready(None)
            }
            other => other,
        }
    }
}

fn usage_of(v: &Value, prompt_est: u64) -> (u64, u64, bool) {
    match v.get("usage") {
        Some(u) => {
            let p = u.get("prompt_tokens").and_then(Value::as_u64).unwrap_or(0);
            let c = u.get("completion_tokens").and_then(Value::as_u64).unwrap_or(0);
            (p, c, false)
        }
        None => {
            let est = v
                .pointer("/choices/0/message/content")
                .and_then(Value::as_str)
                .map(|s| s.len() as u64 / 4)
                .unwrap_or(0);
            (prompt_est, est, true)
        }
    }
}

/// Rough prompt-token estimate (chars/4 over all message contents).
fn estimate_prompt_tokens(body: &Value) -> u64 {
    match body.get("messages").and_then(Value::as_array) {
        Some(msgs) => msgs
            .iter()
            .filter_map(|m| m.get("content").and_then(Value::as_str))
            .map(|c| c.len() as u64)
            .sum::<u64>()
            / 4,
        None => 0,
    }
}

fn record(
    st: &AppState,
    vk: &VerifiedKey,
    model: &str,
    pt: u64,
    ct: u64,
    upstream: &str,
    latency: u64,
    estimated: bool,
) {
    if let Err(e) = st.meter.record(
        &vk.key_hash, &vk.user_id, model, pt, ct, upstream, latency, estimated,
    ) {
        tracing::warn!(error = %e, "usage record failed");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sse_scan_counts_usage_and_deltas() {
        let mut acc = StreamAcc::default();
        scan_chunk("data: {\"choices\":[{\"delta\":{\"content\":\"He\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"llo\"}}]}\n", &mut acc);
        scan_chunk("data: {\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":7}}\ndata: [DONE]\n", &mut acc);
        assert_eq!(acc.delta_chars, 5);
        assert_eq!(acc.usage, Some((12, 7)));
    }

    #[test]
    fn sse_scan_handles_split_chunks() {
        let mut acc = StreamAcc::default();
        scan_chunk("data: {\"choices\":[{\"delta\":{\"cont", &mut acc);
        scan_chunk("ent\":\"abc\"}}]}\ndata: [DONE]\n", &mut acc);
        assert_eq!(acc.delta_chars, 3);
    }

    #[test]
    fn usage_fallback_estimates() {
        let v = json!({"choices":[{"message":{"content":"abcd efgh"}}]});
        let (p, c, est) = usage_of(&v, 10);
        assert!(est && p == 10 && c == 2);
    }

    #[test]
    fn prompt_estimate() {
        let body = json!({"messages":[{"role":"user","content":"aaaaaaaa"},{"role":"assistant","content":"bbbb"}]});
        assert_eq!(estimate_prompt_tokens(&body), 3); // 12 chars / 4
    }
}
