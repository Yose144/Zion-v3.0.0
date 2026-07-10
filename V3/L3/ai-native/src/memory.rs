//! Episodic memory for AI agents.
//!
//! Inspired by `zion_memory_system.py` — ZION 2.9 history.
//!
//! ## Two-tier design
//! ```text
//! ┌─────────────────────────────────────────┐
//! │  SHORT-TERM  (ring buffer, N entries)    │
//! │  Latest events from the current session  │
//! └────────────────┬────────────────────────┘
//!                  │ eviction → promote if importance ≥ threshold
//! ┌────────────────▼────────────────────────┐
//! │  LONG-TERM  (archive, M entries)         │
//! │  Persistent important memories           │
//! └─────────────────────────────────────────┘
//! ```
//! Agent components call `record()` to add entries; they `recall()` by
//! keyword or kind before making decisions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

// ─── Event kinds ─────────────────────────────────────────────────────────────

/// Semantic category of a recorded memory event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryEventKind {
    TaskCompleted,
    TaskFailed,
    TaskTimeout,
    MessageSent,
    MessageReceived,
    ConsciousnessLevelUp,
    PoolSwitched,
    WarpActivated,
    WarpModeChanged,
    AgentSpawned,
    AgentTerminated,
    Evolution,
    RewardReceived,
    ErrorRecovered,
    Custom(String),
}

// ─── MemoryEntry ─────────────────────────────────────────────────────────────

/// A single recorded memory event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    /// Monotonic ID within this agent's memory
    pub id: u64,
    pub kind: MemoryEventKind,
    /// Human-readable summary used for keyword recall
    pub summary: String,
    /// Arbitrary metadata (JSON)
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    /// Importance weight 0.0–1.0 — drives long-term retention decisions.
    /// Events with `importance ≥ long_term_threshold` are archived.
    pub importance: f32,
}

impl MemoryEntry {
    /// Create a new entry with default importance of 0.5.
    pub fn new(kind: MemoryEventKind, summary: impl Into<String>, data: serde_json::Value) -> Self {
        Self {
            id: 0, // assigned by AgentMemory::record
            kind,
            summary: summary.into(),
            data,
            timestamp: Utc::now(),
            importance: 0.5,
        }
    }

    /// Set importance (clamped to 0.0–1.0).
    pub fn with_importance(mut self, i: f32) -> Self {
        self.importance = i.clamp(0.0, 1.0);
        self
    }

    /// Convenience constructor — no structured data payload.
    pub fn simple(kind: MemoryEventKind, summary: impl Into<String>) -> Self {
        Self::new(kind, summary, serde_json::Value::Null)
    }
}

// ─── AgentMemory ─────────────────────────────────────────────────────────────

/// Two-tier episodic memory store for a single agent.
///
/// Thread-safety: not `Send`/`Sync` by itself — wrap in `Arc<Mutex<_>>` if
/// shared between async tasks.
pub struct AgentMemory {
    /// FIFO short-term ring buffer
    short_term: VecDeque<MemoryEntry>,
    short_term_capacity: usize,
    /// Long-term archive
    long_term: Vec<MemoryEntry>,
    long_term_max: usize,
    /// Entries with `importance >= this` are promoted to long-term
    pub long_term_threshold: f32,
    next_id: u64,
    /// How many entries have ever been recorded (including evicted)
    pub total_recorded: u64,
}

impl AgentMemory {
    pub fn new(short_term_capacity: usize, long_term_max: usize) -> Self {
        Self {
            short_term: VecDeque::with_capacity(short_term_capacity),
            short_term_capacity,
            long_term: Vec::new(),
            long_term_max,
            long_term_threshold: 0.6,
            next_id: 1,
            total_recorded: 0,
        }
    }

    /// Sensible defaults: 50 short-term, 1 000 long-term.
    pub fn with_defaults() -> Self {
        Self::new(50, 1_000)
    }

    // ─── Recording ───────────────────────────────────────────────────────

    /// Record a new memory event; returns the assigned entry ID.
    pub fn record(&mut self, mut entry: MemoryEntry) -> u64 {
        entry.id = self.next_id;
        self.next_id += 1;
        self.total_recorded += 1;

        // High-importance entries go straight to long-term as well
        if entry.importance >= self.long_term_threshold {
            self.store_long_term(entry.clone());
        }

        // Short-term: append, evict oldest if full
        if self.short_term.len() >= self.short_term_capacity {
            if let Some(evicted) = self.short_term.pop_front() {
                // Promote important evictees that haven't been archived yet
                if evicted.importance >= self.long_term_threshold {
                    self.store_long_term(evicted);
                }
            }
        }
        self.short_term.push_back(entry);

        self.next_id - 1
    }

    fn store_long_term(&mut self, entry: MemoryEntry) {
        // Deduplicate by ID (can be called twice for the same high-importance entry)
        if self.long_term.iter().any(|e| e.id == entry.id) {
            return;
        }

        if self.long_term.len() >= self.long_term_max {
            // Evict the least important entry if it scores lower than incoming
            let min_pos = self
                .long_term
                .iter()
                .enumerate()
                .min_by(|(_, a), (_, b)| {
                    a.importance
                        .partial_cmp(&b.importance)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .map(|(i, _)| i);

            if let Some(pos) = min_pos {
                if self.long_term[pos].importance < entry.importance {
                    self.long_term.remove(pos);
                } else {
                    return; // incoming is less important — discard
                }
            }
        }
        self.long_term.push(entry);
    }

    // ─── Recall ──────────────────────────────────────────────────────────

    /// Return recent short-term memories (newest first).
    pub fn recent(&self, limit: usize) -> Vec<&MemoryEntry> {
        self.short_term.iter().rev().take(limit).collect()
    }

    /// Recall memories from both tiers by keyword match in `summary`.
    ///
    /// Results are sorted by importance (desc) then recency (desc).
    pub fn recall(&self, keyword: &str) -> Vec<&MemoryEntry> {
        let kw = keyword.to_lowercase();
        let mut hits: Vec<&MemoryEntry> = self
            .short_term
            .iter()
            .chain(self.long_term.iter())
            .filter(|e| e.summary.to_lowercase().contains(&kw))
            .collect();

        // De-duplicate (same entry may appear in both tiers)
        hits.dedup_by_key(|e| e.id);

        hits.sort_by(|a, b| {
            b.importance
                .partial_cmp(&a.importance)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(b.timestamp.cmp(&a.timestamp))
        });
        hits
    }

    /// Recall all memories of a specific kind (both tiers, importance sorted).
    pub fn recall_by_kind(&self, kind: &MemoryEventKind) -> Vec<&MemoryEntry> {
        let mut hits: Vec<&MemoryEntry> = self
            .long_term
            .iter()
            .chain(self.short_term.iter())
            .filter(|e| &e.kind == kind)
            .collect();
        hits.dedup_by_key(|e| e.id);
        hits.sort_by(|a, b| {
            b.importance
                .partial_cmp(&a.importance)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        hits
    }

    /// Return all memories from both tiers (newest first).
    pub fn recall_all(&self) -> Vec<MemoryEntry> {
        let mut all = self.long_term.clone();
        all.extend(self.short_term.clone());
        all.sort_by_key(|b| std::cmp::Reverse(b.timestamp));
        all
    }

    /// Clear all memories.
    pub fn flush(&mut self) {
        self.short_term.clear();
        self.long_term.clear();
        self.total_recorded = 0;
    }

    // ─── Stats ────────────────────────────────────────────────────────────

    pub fn short_term_len(&self) -> usize {
        self.short_term.len()
    }

    pub fn long_term_len(&self) -> usize {
        self.long_term.len()
    }

    /// Compute average importance of all long-term entries.
    pub fn avg_importance(&self) -> f32 {
        if self.long_term.is_empty() {
            return 0.0;
        }
        self.long_term.iter().map(|e| e.importance).sum::<f32>() / self.long_term.len() as f32
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn low(summary: &str) -> MemoryEntry {
        MemoryEntry::new(
            MemoryEventKind::TaskCompleted,
            summary,
            serde_json::json!({}),
        )
        .with_importance(0.3)
    }

    fn high(summary: &str) -> MemoryEntry {
        MemoryEntry::new(
            MemoryEventKind::TaskCompleted,
            summary,
            serde_json::json!({}),
        )
        .with_importance(0.9)
    }

    #[test]
    fn test_short_term_capacity() {
        let mut m = AgentMemory::new(3, 100);
        m.record(low("a"));
        m.record(low("b"));
        m.record(low("c"));
        assert_eq!(m.short_term_len(), 3);
        m.record(low("d"));
        assert_eq!(m.short_term_len(), 3); // still 3 after eviction
    }

    #[test]
    fn test_high_importance_promoted_to_long_term() {
        let mut m = AgentMemory::new(2, 100);
        m.record(high("critical event"));
        assert_eq!(m.long_term_len(), 1);
    }

    #[test]
    fn test_evicted_high_importance_stays_in_long_term() {
        let mut m = AgentMemory::new(2, 100);
        m.record(high("rare event"));
        m.record(low("x"));
        m.record(low("y")); // evicts "rare event" from short-term
        let hits = m.recall("rare event");
        assert!(
            !hits.is_empty(),
            "evicted high-importance entry should be in long-term"
        );
    }

    #[test]
    fn test_recall_keyword() {
        let mut m = AgentMemory::with_defaults();
        m.record(low("mined block 500"));
        m.record(high("pool switched to faster node"));
        let hits = m.recall("pool");
        assert_eq!(hits.len(), 1);
        assert!(hits[0].summary.contains("pool"));
    }

    #[test]
    fn test_recall_by_kind() {
        let mut m = AgentMemory::with_defaults();
        m.record(
            MemoryEntry::new(
                MemoryEventKind::PoolSwitched,
                "switched",
                serde_json::json!({}),
            )
            .with_importance(0.8),
        );
        m.record(low("unrelated"));
        let hits = m.recall_by_kind(&MemoryEventKind::PoolSwitched);
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn test_recall_sorted_by_importance() {
        let mut m = AgentMemory::with_defaults();
        m.record(low("low importance pool event").with_importance(0.3));
        m.record(high("high importance pool event").with_importance(0.95));
        let hits = m.recall("pool");
        assert!(hits[0].importance > hits[1].importance);
    }

    #[test]
    fn test_recent() {
        let mut m = AgentMemory::new(10, 100);
        m.record(low("first"));
        m.record(low("second"));
        m.record(low("third"));
        let recent = m.recent(2);
        assert_eq!(recent[0].summary, "third"); // newest first
    }
}
