//! ZION Archive Pass — marketplace-issued code validation for gated worlds.
//!
//! MarketPlace writes `/opt/zion/data/archive-market-codes.json` on EDGE2
//! when a paid order contains a product flagged `archive-pass:<id>`.
//! This daemon shares the host and the `zion` user, so codes validate
//! against the local file — no HTTP hop. Format mirrors the TS readers
//! (archive-pass.ts / archive-market-codes.ts): revoked or expired
//! records are inactive; a missing/corrupt file fails closed.

use serde::Deserialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
struct MarketCode {
    code: String,
    #[serde(default, rename = "expiresAt")]
    expires_at: Option<String>,
    #[serde(default, rename = "revokedAt")]
    revoked_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MarketCodeStore {
    version: u32,
    records: Vec<MarketCode>,
}

fn store_path() -> PathBuf {
    std::env::var("ARCHIVE_MARKET_CODES_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/opt/zion/data/archive-market-codes.json"))
}

static CACHE: Mutex<Option<(SystemTime, u64, Arc<MarketCodeStore>)>> = Mutex::new(None);

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// ISO-8601 → unix seconds (`YYYY-MM-DDTHH:MM:SS(.sss)(Z|±HH:MM)`);
/// handles Z and explicit offsets by truncating at the sign — the few
/// seconds of skew don't matter for pass expiry.
fn parse_iso(s: &str) -> Option<i64> {
    let s = s.trim();
    let (date, rest) = s.split_once('T')?;
    let mut d = date.split('-');
    let (y, m, day): (i64, i64, i64) = (
        d.next()?.parse().ok()?,
        d.next()?.parse().ok()?,
        d.next()?.parse().ok()?,
    );
    let time = rest.trim_end_matches('Z');
    let time = match time.find('+') {
        Some(i) => &time[..i],
        None => match time[1..].rfind('-') {
            Some(i) => &time[..i + 1],
            None => time,
        },
    };
    let mut t = time.split(':');
    let (h, min, sec): (i64, i64, f64) = (
        t.next()?.parse().ok()?,
        t.next()?.parse().ok()?,
        t.next()?.parse().ok()?,
    );
    // days since epoch (Howard Hinnant's civil→days)
    let y2 = if m <= 2 { y - 1 } else { y };
    let era = if y2 >= 0 { y2 } else { y2 - 399 } / 400;
    let yoe = y2 - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some((era * 146097 + doe - 719468) * 86400 + h * 3600 + min * 60 + sec as i64)
}

fn load() -> Option<Arc<MarketCodeStore>> {
    let path = store_path();
    let meta = std::fs::metadata(&path).ok()?;
    let mtime = meta.modified().ok()?;
    let size = meta.len();
    if let Ok(guard) = CACHE.lock() {
        if let Some((mt, sz, store)) = guard.as_ref() {
            if *mt == mtime && *sz == size {
                return Some(Arc::clone(store));
            }
        }
    }
    let text = std::fs::read_to_string(&path).ok()?;
    let store: MarketCodeStore = serde_json::from_str(&text).ok()?;
    if store.version != 1 {
        return None;
    }
    let store = Arc::new(store);
    if let Ok(mut guard) = CACHE.lock() {
        *guard = Some((mtime, size, Arc::clone(&store)));
    }
    Some(store)
}

/// True when the code exists in the market store and is usable right now.
pub fn is_valid_market_code(code: &str) -> bool {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return false;
    }
    let Some(store) = load() else {
        return false;
    };
    let now = now_unix() as i64;
    store.records.iter().any(|r| {
        r.code == trimmed
            && r.revoked_at.is_none()
            && r.expires_at
                .as_deref()
                .and_then(parse_iso)
                .map(|exp| exp > now)
                .unwrap_or(true)
    })
}
