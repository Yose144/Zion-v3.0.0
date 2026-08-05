//! Template cache for the V31 pool.
//!
//! Caches a [`BlockTemplate`] fetched from the node for a configurable TTL so
//! that we do not hammer the RPC on every share submission.  Ported from the
//! V3 pool (`archive/V3/L1/pool/src/bin/server.rs` lines 413-460), simplified
//! to a pure cache (no embedded fetch — the caller is responsible for fetching
//! and calling [`TemplateCache::set`]).

use std::time::{Duration, Instant};

use zion_core::node::BlockTemplate;

/// A TTL-based cache for a single node block template.
///
/// The cache stores at most one [`BlockTemplate`].  A template is considered
/// fresh while `fetched_at.elapsed() < ttl`; once stale, callers should fetch
/// a new template from the node and call [`TemplateCache::set`].
pub struct TemplateCache {
    template: Option<BlockTemplate>,
    fetched_at: Instant,
    ttl: Duration,
}

impl TemplateCache {
    /// Create a new, empty cache with the given time-to-live.
    pub fn new(ttl: Duration) -> Self {
        Self {
            template: None,
            fetched_at: Instant::now(),
            ttl,
        }
    }

    /// Return a reference to the cached template if it is still fresh.
    ///
    /// Returns `None` if the cache is empty or the template has exceeded its
    /// TTL.  The caller should fetch a fresh template and call [`Self::set`]
    /// in that case.
    pub fn get(&self) -> Option<&BlockTemplate> {
        if self.is_fresh() {
            self.template.as_ref()
        } else {
            None
        }
    }

    /// Returns `true` if the cached template is within its TTL window.
    ///
    /// An empty cache is never fresh.
    pub fn is_fresh(&self) -> bool {
        self.template.is_some() && self.fetched_at.elapsed() < self.ttl
    }

    /// Store a new template, resetting the fetch timestamp.
    pub fn set(&mut self, template: BlockTemplate) {
        self.template = Some(template);
        self.fetched_at = Instant::now();
    }

    /// Force the next access to fetch a fresh template from the node.
    ///
    /// Called after a block is accepted so miners immediately get the next
    /// height's template instead of re-mining the accepted block.
    pub fn invalidate(&mut self) {
        self.template = None;
    }

    /// Return the height of the cached template, if any.
    pub fn height(&self) -> Option<u64> {
        self.template.as_ref().map(|t| t.height)
    }

    /// Return the time elapsed since the last successful fetch.
    ///
    /// For an empty cache this reports the time since [`Self::new`] (or the
    /// last [`Self::invalidate`], which does not reset the timestamp).
    pub fn elapsed(&self) -> Duration {
        self.fetched_at.elapsed()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_template(height: u64) -> BlockTemplate {
        BlockTemplate {
            template_id: 1,
            previous_hash: "abc".to_string(),
            height,
            difficulty: 100,
            target: "0000ff".to_string(),
            header_hex: "deadbeef".to_string(),
            target_hex: "0000ff".to_string(),
            block_reward: 50_000,
            header_json: "{}".to_string(),
            transactions: vec![],
        }
    }

    #[test]
    fn test_new_cache_is_empty() {
        let cache = TemplateCache::new(Duration::from_secs(60));
        assert!(cache.get().is_none());
        assert!(cache.height().is_none());
        assert!(!cache.is_fresh());
    }

    #[test]
    fn test_set_and_get() {
        let mut cache = TemplateCache::new(Duration::from_secs(60));
        cache.set(sample_template(42));
        let got = cache.get().expect("template should be cached");
        assert_eq!(got.height, 42);
        assert_eq!(cache.height(), Some(42));
        assert!(cache.is_fresh());
    }

    #[test]
    fn test_invalidate_clears_cache() {
        let mut cache = TemplateCache::new(Duration::from_secs(60));
        cache.set(sample_template(7));
        assert!(cache.get().is_some());

        cache.invalidate();
        assert!(cache.get().is_none());
        assert!(cache.height().is_none());
        assert!(!cache.is_fresh());
    }

    #[test]
    fn test_is_fresh_within_ttl() {
        let mut cache = TemplateCache::new(Duration::from_secs(60));
        cache.set(sample_template(1));
        // Immediately after set the template must be fresh.
        assert!(cache.is_fresh());
        assert!(cache.get().is_some());
    }

    #[test]
    fn test_is_stale_after_ttl() {
        // Use a zero-length TTL so the template is immediately stale.
        let mut cache = TemplateCache::new(Duration::from_secs(0));
        cache.set(sample_template(1));
        // With a zero TTL the template is already past its freshness window.
        // `elapsed()` is >= ttl, so is_fresh() must be false and get() None.
        assert!(!cache.is_fresh());
        assert!(cache.get().is_none());
    }
}
