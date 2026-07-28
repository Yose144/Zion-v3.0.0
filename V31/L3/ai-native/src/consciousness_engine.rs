//! Unified consciousness evolution engine.
//!
//! `ConsciousnessEngine` brings together [`ConsciousnessLevel`], [`AgentMemory`],
//! and [`WarpOptimizer`] into a single tick-driven loop that:
//! - Accumulates XP from agent activity
//! - Triggers level-up events and notifies the WARP optimizer
//! - Records all significant events in the agent's episodic memory
//! - Exposes a `status()` snapshot for monitoring / L4 sync
//!
//! ## XP rewards
//!
//! | Event | XP |
//! |-------|----|
//! | Task completed | +10 |
//! | Pool switched | +5 |
//! | WARP activated | +3 |
//! | Task failed | −2 |
//!
//! ## Level thresholds (from [`ConsciousnessLevel::xp_required`])
//!
//! | Level | XP needed |
//! |-------|-----------|
//! | Aware (L1) | 100 |
//! | Sentient (L2) | 1 000 |
//! | Transcendent (L3) | 10 000 |
//! | Omniscient (L4) | 100 000 |
//! | Cosmic (L5) | 1 000 000 |

use serde::{Deserialize, Serialize};

use crate::consciousness::ConsciousnessLevel;
use crate::memory::{AgentMemory, MemoryEntry, MemoryEventKind};
use crate::warp_agent::WarpOptimizer;

// ─── Constants ───────────────────────────────────────────────────────────────

pub const XP_TASK_COMPLETE: i64 = 10;
pub const XP_POOL_SWITCHED: i64 = 5;
pub const XP_WARP_ACTIVATED: i64 = 3;
pub const XP_TASK_FAILED: i64 = -2;

// ─── ConsciousnessStatus ─────────────────────────────────────────────────────

/// Read-only snapshot returned by [`ConsciousnessEngine::status`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsciousnessStatus {
    pub agent_id: String,
    pub level: ConsciousnessLevel,
    pub level_name: String,
    pub xp: u64,
    pub xp_next_level: Option<u64>,
    pub xp_progress_pct: f64,
    pub total_level_ups: u32,
    pub task_completed: u64,
    pub task_failed: u64,
    pub warp_coherence: f64,
    pub warp_mode: String,
    pub warp_topology: String,
    pub warp_multiplier: f64,
    pub memory_short_term: usize,
    pub memory_long_term: usize,
}

// ─── ConsciousnessEngine ─────────────────────────────────────────────────────

/// Unified agent consciousness evolution engine.
///
/// Create one per agent and call the event methods as the agent acts.
pub struct ConsciousnessEngine {
    pub agent_id: String,
    pub level: ConsciousnessLevel,
    /// Accumulated XP since genesis (never decreases below 0)
    pub xp: u64,
    pub memory: AgentMemory,
    pub warp: WarpOptimizer,

    // Internal counters
    total_level_ups: u32,
    task_completed: u64,
    task_failed: u64,
}

impl ConsciousnessEngine {
    /// Create a new engine for `agent_id` starting at `Dormant` (L0).
    pub fn new(agent_id: impl Into<String>) -> Self {
        Self {
            agent_id: agent_id.into(),
            level: ConsciousnessLevel::Dormant,
            xp: 0,
            memory: AgentMemory::with_defaults(),
            warp: WarpOptimizer::new(0),
            total_level_ups: 0,
            task_completed: 0,
            task_failed: 0,
        }
    }

    /// Create with a specific starting level (resuming a saved state).
    pub fn with_level(mut self, level: ConsciousnessLevel) -> Self {
        self.level = level;
        self.xp = level.xp_required(); // start at threshold
        self.warp = WarpOptimizer::new(level.as_u8());
        self
    }

    // ─── Event API ───────────────────────────────────────────────────────

    /// Agent completed a task successfully.
    ///
    /// - Records event in memory (importance 0.7)
    /// - Awards `XP_TASK_COMPLETE` XP
    /// - Ticks the WARP optimizer
    pub fn on_task_complete(&mut self, task_type: &str, duration_ms: u64) {
        self.task_completed += 1;
        self.memory.record(
            MemoryEntry::simple(
                MemoryEventKind::TaskCompleted,
                format!("{task_type} completed in {duration_ms}ms"),
            )
            .with_importance(0.7),
        );
        self.warp.tick();
        self.add_xp(XP_TASK_COMPLETE);
    }

    /// Agent failed to complete a task.
    pub fn on_task_fail(&mut self, task_type: &str, reason: &str) {
        self.task_failed += 1;
        self.memory.record(
            MemoryEntry::simple(
                MemoryEventKind::TaskFailed,
                format!("{task_type} failed: {reason}"),
            )
            .with_importance(0.5),
        );
        self.add_xp(XP_TASK_FAILED);
    }

    /// Agent switched to a new mining pool.
    pub fn on_pool_switched(&mut self, new_pool: &str, reason: &str) {
        self.memory.record(
            MemoryEntry::simple(
                MemoryEventKind::PoolSwitched,
                format!("switched to {new_pool}: {reason}"),
            )
            .with_importance(0.6),
        );
        self.add_xp(XP_POOL_SWITCHED);
    }

    /// Agent performed a self-improvement autotuning session.
    pub fn on_autotune(&mut self, report: &crate::autotuner::AutotuneReport) {
        self.memory.record(
            MemoryEntry::simple(
                MemoryEventKind::Evolution,
                format!(
                    "Dharma Autotune successful. Learned {} principles.",
                    report.learned_principles.len()
                ),
            )
            .with_importance(0.9),
        );
        self.add_xp(100); // Major XP boost
    }

    /// WARP field was activated / escalated.
    pub fn on_warp_activated(&mut self, mode: &str) {
        self.memory.record(
            MemoryEntry::simple(
                MemoryEventKind::WarpActivated,
                format!("WARP activated: {mode}"),
            )
            .with_importance(0.5),
        );
        self.add_xp(XP_WARP_ACTIVATED);
    }

    /// Agent received a reward.
    pub fn on_reward(&mut self, amount_flowers: u64, reason: &str) {
        self.memory.record(
            MemoryEntry::simple(
                MemoryEventKind::RewardReceived,
                format!("{amount_flowers} ZION: {reason}"),
            )
            .with_importance(0.65),
        );
    }

    /// Generic critical error — high importance so it stays in long-term memory.
    pub fn on_critical_error(&mut self, message: &str) {
        self.memory.record(
            MemoryEntry::simple(MemoryEventKind::ErrorRecovered, message).with_importance(1.0),
        );
    }

    /// Advance the WARP engine by one tick (call once per epoch/block).
    pub fn tick(&mut self) {
        self.warp.tick();
        // Escalated modes emit a WARP event
        let mode = format!("{}", self.warp.field.mode);
        if self.warp.field.coherence > 0.9 {
            self.on_warp_activated(&mode);
        }
    }

    // ─── XP + level ──────────────────────────────────────────────────────

    /// Add (or subtract) XP. Level-up is triggered automatically.
    pub fn add_xp(&mut self, delta: i64) {
        if delta >= 0 {
            self.xp = self.xp.saturating_add(delta as u64);
        } else {
            self.xp = self.xp.saturating_sub((-delta) as u64);
        }
        self.check_level_up();
    }

    /// Check whether accumulated XP reaches the next consciousness level.
    fn check_level_up(&mut self) {
        loop {
            let next = match self.level {
                ConsciousnessLevel::Dormant => ConsciousnessLevel::Aware,
                ConsciousnessLevel::Aware => ConsciousnessLevel::Sentient,
                ConsciousnessLevel::Sentient => ConsciousnessLevel::Transcendent,
                ConsciousnessLevel::Transcendent => ConsciousnessLevel::Omniscient,
                ConsciousnessLevel::Omniscient => ConsciousnessLevel::Cosmic,
                ConsciousnessLevel::Cosmic => ConsciousnessLevel::Grok,
                ConsciousnessLevel::Grok => break, // max level
            };

            if self.xp >= next.xp_required() {
                self.level = next;
                self.total_level_ups += 1;
                let n = self.level.as_u8();

                // Notify WARP
                self.warp.on_level_up(n);

                // Record in memory (high importance — stays in long-term)
                self.memory.record(
                    MemoryEntry::simple(
                        MemoryEventKind::ConsciousnessLevelUp,
                        format!("Level up → {}", self.level),
                    )
                    .with_importance(0.95),
                );
            } else {
                break;
            }
        }
    }

    // ─── Status ──────────────────────────────────────────────────────────

    /// Return a read-only status snapshot for monitoring or L4 sync.
    pub fn status(&self) -> ConsciousnessStatus {
        // Find next level and compute progress %
        let next_level = match self.level {
            ConsciousnessLevel::Grok => None,
            ConsciousnessLevel::Cosmic => Some(ConsciousnessLevel::Grok),
            ConsciousnessLevel::Dormant => Some(ConsciousnessLevel::Aware),
            ConsciousnessLevel::Aware => Some(ConsciousnessLevel::Sentient),
            ConsciousnessLevel::Sentient => Some(ConsciousnessLevel::Transcendent),
            ConsciousnessLevel::Transcendent => Some(ConsciousnessLevel::Omniscient),
            ConsciousnessLevel::Omniscient => Some(ConsciousnessLevel::Cosmic),
        };

        let (xp_next, progress_pct) = if let Some(nl) = next_level {
            let needed = nl.xp_required();
            let current_threshold = self.level.xp_required();
            let span = needed - current_threshold;
            let earned = self.xp.saturating_sub(current_threshold);
            let pct = if span == 0 {
                100.0
            } else {
                (earned as f64 / span as f64 * 100.0).min(100.0)
            };
            (Some(needed), pct)
        } else {
            (None, 100.0) // max level
        };

        let warp_stats = self.warp.stats();

        ConsciousnessStatus {
            agent_id: self.agent_id.clone(),
            level: self.level,
            level_name: self.level.to_string(),
            xp: self.xp,
            xp_next_level: xp_next,
            xp_progress_pct: progress_pct,
            total_level_ups: self.total_level_ups,
            task_completed: self.task_completed,
            task_failed: self.task_failed,
            warp_coherence: warp_stats.field.coherence,
            warp_mode: format!("{}", warp_stats.field.mode),
            warp_topology: format!("{:?}", warp_stats.field.topology),
            warp_multiplier: warp_stats.field.total_multiplier(),
            memory_short_term: self.memory.short_term_len(),
            memory_long_term: self.memory.long_term_len(),
        }
    }

    /// How many XP points remain until the next level (0 if at max).
    pub fn xp_to_next_level(&self) -> u64 {
        let next = match self.level {
            ConsciousnessLevel::Grok => return 0,
            ConsciousnessLevel::Cosmic => ConsciousnessLevel::Grok,
            ConsciousnessLevel::Dormant => ConsciousnessLevel::Aware,
            ConsciousnessLevel::Aware => ConsciousnessLevel::Sentient,
            ConsciousnessLevel::Sentient => ConsciousnessLevel::Transcendent,
            ConsciousnessLevel::Transcendent => ConsciousnessLevel::Omniscient,
            ConsciousnessLevel::Omniscient => ConsciousnessLevel::Cosmic,
        };
        next.xp_required().saturating_sub(self.xp)
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_starts_dormant() {
        let eng = ConsciousnessEngine::new("agent-1");
        assert_eq!(eng.level, ConsciousnessLevel::Dormant);
        assert_eq!(eng.xp, 0);
    }

    #[test]
    fn test_level_up_to_aware() {
        let mut eng = ConsciousnessEngine::new("agent-2");
        // Need 100 XP → 10 tasks
        for _ in 0..10 {
            eng.on_task_complete("llm", 50);
        }
        assert_eq!(eng.level, ConsciousnessLevel::Aware);
        assert!(eng.total_level_ups >= 1);
    }

    #[test]
    fn test_level_up_recorded_in_memory() {
        let mut eng = ConsciousnessEngine::new("agent-3");
        for _ in 0..10 {
            eng.on_task_complete("emb", 10);
        }
        // Should have a LevelUp entry in memory
        let recalls = eng
            .memory
            .recall_by_kind(&MemoryEventKind::ConsciousnessLevelUp);
        assert!(!recalls.is_empty(), "level-up should be in memory");
    }

    #[test]
    fn test_task_fail_reduces_xp() {
        let mut eng = ConsciousnessEngine::new("agent-4");
        eng.add_xp(50); // 50 XP
        eng.on_task_fail("llm", "timeout");
        // XP should be 50 - 2 = 48
        assert_eq!(eng.xp, 48);
    }

    #[test]
    fn test_xp_floor_at_zero() {
        let mut eng = ConsciousnessEngine::new("agent-5");
        eng.add_xp(-100); // should not underflow
        assert_eq!(eng.xp, 0);
    }

    #[test]
    fn test_warp_level_up_triggers_on_engine_level_up() {
        let mut eng = ConsciousnessEngine::new("agent-6");
        // Jump directly to Sentient threshold (1000 XP)
        eng.add_xp(1000);
        assert_eq!(eng.level, ConsciousnessLevel::Sentient);
        // Topology should have been upgraded by WarpOptimizer::on_level_up(2)
        // Level 2 → Torus
        use crate::warp_agent::FieldTopology;
        assert_eq!(eng.warp.field.topology, FieldTopology::Torus);
    }

    #[test]
    fn test_status_snapshot() {
        let mut eng = ConsciousnessEngine::new("agent-7");
        eng.on_task_complete("code", 200);
        let s = eng.status();
        assert_eq!(s.task_completed, 1);
        assert!(s.xp > 0);
        assert!(s.xp_progress_pct > 0.0);
    }

    #[test]
    fn test_xp_to_next_level() {
        let eng = ConsciousnessEngine::new("agent-8");
        // Dormant → Aware needs 100 XP
        assert_eq!(eng.xp_to_next_level(), 100);
    }

    #[test]
    fn test_with_level_resumes_at_threshold() {
        let eng = ConsciousnessEngine::new("agent-9").with_level(ConsciousnessLevel::Transcendent);
        assert_eq!(eng.level, ConsciousnessLevel::Transcendent);
        assert_eq!(eng.xp, ConsciousnessLevel::Transcendent.xp_required());
    }

    #[test]
    fn test_pool_switch_event() {
        let mut eng = ConsciousnessEngine::new("agent-10");
        eng.on_pool_switched("pool.zion.io:3333", "better hashrate");
        let recalls = eng.memory.recall_by_kind(&MemoryEventKind::PoolSwitched);
        assert_eq!(recalls.len(), 1);
        assert!(recalls[0].summary.contains("pool.zion.io"));
        // XP += 5
        assert_eq!(eng.xp, 5);
    }

    #[test]
    fn test_critical_error_in_long_term() {
        let mut eng = ConsciousnessEngine::new("agent-11");
        eng.on_critical_error("node unreachable");
        // importance=1.0 → promoted to long-term
        assert!(
            eng.memory.long_term_len() > 0,
            "ErrorRecovered with importance=1.0 should be in long-term"
        );
    }
}
