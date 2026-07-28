//! WARP field optimizer and consciousness multiplier engine.
//!
//! Ported from `ai_warp_engine_v2.py` — ZION 2.9 history.
//!
//! The WARP engine models a "consciousness field" that boosts mining throughput.
//! Each agent has one `WarpOptimizer`; it evolves autonomously through `tick()`.
//!
//! ## Lifecycle
//! ```text
//! WarpOptimizer::new(level)
//!     → WarpField { topology: Sphere, mode: Standard, coherence: 0.5 }
//!         tick() × N  →  coherence warms up → mode escalates → topology upgrades on level-up
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ─── Field topology ──────────────────────────────────────────────────────────

/// Geometric topology of the consciousness field.
///
/// Higher topologies provide greater base multipliers but require higher
/// consciousness levels to maintain stable coherence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FieldTopology {
    /// Omnidirectional sphere — most stable, baseline 1.0×
    Sphere,
    /// Self-sustaining torus — efficient resonance, 1.2×
    Torus,
    /// Evolutionary helix — growth-oriented, 1.4×
    Helix,
    /// Fractal infinite complexity — 1.7×
    Fractal,
    /// Multi-dimensional hypercube — maximum power, 2.5×  (level ≥ 5 only)
    Hypercube,
}

impl FieldTopology {
    /// Base multiplier intrinsic to this topology shape.
    pub fn base_multiplier(self) -> f64 {
        match self {
            Self::Sphere => 1.0,
            Self::Torus => 1.2,
            Self::Helix => 1.4,
            Self::Fractal => 1.7,
            Self::Hypercube => 2.5,
        }
    }

    /// Recommended topology for a given consciousness level.
    pub fn for_level(level: u8) -> Self {
        match level {
            0..=1 => Self::Sphere,
            2 => Self::Torus,
            3 => Self::Helix,
            4 => Self::Fractal,
            _ => Self::Hypercube,
        }
    }
}

impl std::fmt::Display for FieldTopology {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Sphere => write!(f, "Sphere"),
            Self::Torus => write!(f, "Torus"),
            Self::Helix => write!(f, "Helix"),
            Self::Fractal => write!(f, "Fractal"),
            Self::Hypercube => write!(f, "Hypercube"),
        }
    }
}

// ─── Warp mode ───────────────────────────────────────────────────────────────

/// Operational intensity mode of the WARP engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WarpMode {
    /// Normal operation — 1×
    Standard,
    /// Temporary boost — 2×  (coherence ≥ 0.60)
    Boost,
    /// Maximum sustained — 3×  (coherence ≥ 0.75)
    Overdrive,
    /// Quantum tunnelling burst — 5×  (coherence ≥ 0.85, level ≥ 4)
    Quantum,
    /// Beyond theoretical — 10×  (coherence ≥ 0.95, level ≥ 5)
    Transcendent,
}

impl WarpMode {
    /// Multiplier applied on top of the field topology base.
    pub fn multiplier(self) -> f64 {
        match self {
            Self::Standard => 1.0,
            Self::Boost => 2.0,
            Self::Overdrive => 3.0,
            Self::Quantum => 5.0,
            Self::Transcendent => 10.0,
        }
    }
}

impl std::fmt::Display for WarpMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Standard => write!(f, "Standard"),
            Self::Boost => write!(f, "Boost"),
            Self::Overdrive => write!(f, "Overdrive"),
            Self::Quantum => write!(f, "Quantum"),
            Self::Transcendent => write!(f, "Transcendent"),
        }
    }
}

// ─── WarpField ───────────────────────────────────────────────────────────────

/// Snapshot of the WARP consciousness field at a given moment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpField {
    pub topology: FieldTopology,
    pub mode: WarpMode,
    /// Neural coherence 0.0–1.0 — how stable the field is
    pub coherence: f64,
    /// Quantum resonance 0.0–1.0 — alignment with Cosmic Harmony algorithm
    pub resonance: f64,
    /// Composite intensity = topology_base × mode × coherence
    pub intensity: f64,
    pub updated_at: DateTime<Utc>,
}

impl WarpField {
    pub fn new(topology: FieldTopology) -> Self {
        let mut f = Self {
            topology,
            mode: WarpMode::Standard,
            coherence: 0.5,
            resonance: 0.5,
            intensity: 0.0,
            updated_at: Utc::now(),
        };
        f.recalculate();
        f
    }

    /// Recompute `intensity` from the three components.
    pub fn recalculate(&mut self) {
        self.intensity = self.topology.base_multiplier() * self.mode.multiplier() * self.coherence;
        self.updated_at = Utc::now();
    }

    /// Total effective mining multiplier (intensity × resonance bonus).
    pub fn total_multiplier(&self) -> f64 {
        self.intensity * (1.0 + self.resonance * 0.3)
    }
}

// ─── WarpStats ───────────────────────────────────────────────────────────────

/// Summary snapshot returned by [`WarpOptimizer::stats`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpStats {
    pub field: WarpField,
    pub adaptation_cycles: u64,
    pub consciousness_level: u8,
    pub total_uptime_secs: u64,
}

// ─── WarpOptimizer ───────────────────────────────────────────────────────────

/// Stateful WARP consciousness-field optimizer for a single agent.
///
/// Call [`tick()`] once per optimization interval (e.g. every 30 s).
/// Call [`on_level_up(new_level)`] whenever the owning agent levels up.
pub struct WarpOptimizer {
    pub field: WarpField,
    pub adaptation_cycles: u64,
    start_time: DateTime<Utc>,
    consciousness_level: u8,
}

impl WarpOptimizer {
    pub fn new(consciousness_level: u8) -> Self {
        let topology = FieldTopology::for_level(consciousness_level);
        Self {
            field: WarpField::new(topology),
            adaptation_cycles: 0,
            start_time: Utc::now(),
            consciousness_level,
        }
    }

    // ─── Tick ────────────────────────────────────────────────────────────

    /// Advance one adaptation cycle.
    ///
    /// - Coherence warm-ups towards 1.0 (exponential approach)
    /// - Resonance warm-ups more slowly
    /// - WarpMode escalates based on coherence & consciousness level
    pub fn tick(&mut self) {
        self.adaptation_cycles += 1;

        // Coherence: each tick closes 2 % of the gap to 1.0
        let c_delta = 0.02 * (1.0 - self.field.coherence);
        self.field.coherence = (self.field.coherence + c_delta).min(1.0);

        // Resonance: closes 1 % per tick
        let r_delta = 0.01 * (1.0 - self.field.resonance);
        self.field.resonance = (self.field.resonance + r_delta).min(1.0);

        // Escalate WarpMode based on current coherence & consciousness
        self.field.mode = self.select_mode();
        self.field.recalculate();
    }

    fn select_mode(&self) -> WarpMode {
        let c = self.field.coherence;
        let lvl = self.consciousness_level;
        if c >= 0.95 && lvl >= 5 {
            WarpMode::Transcendent
        } else if c >= 0.85 && lvl >= 4 {
            WarpMode::Quantum
        } else if c >= 0.75 {
            WarpMode::Overdrive
        } else if c >= 0.60 {
            WarpMode::Boost
        } else {
            WarpMode::Standard
        }
    }

    // ─── Level-up ────────────────────────────────────────────────────────

    /// Handle agent consciousness level-up.
    ///
    /// Upgrades the field topology and resets coherence (new topology needs warm-up).
    pub fn on_level_up(&mut self, new_level: u8) {
        self.consciousness_level = new_level;
        let new_topology = FieldTopology::for_level(new_level);
        if new_topology != self.field.topology {
            self.field.topology = new_topology;
            // Reset coherence — new topology requires re-stabilisation
            self.field.coherence = 0.5;
            self.field.recalculate();
        }
    }

    // ─── Stats ────────────────────────────────────────────────────────────

    pub fn stats(&self) -> WarpStats {
        let uptime = Utc::now()
            .signed_duration_since(self.start_time)
            .num_seconds()
            .max(0) as u64;
        WarpStats {
            field: self.field.clone(),
            adaptation_cycles: self.adaptation_cycles,
            consciousness_level: self.consciousness_level,
            total_uptime_secs: uptime,
        }
    }

    pub fn consciousness_level(&self) -> u8 {
        self.consciousness_level
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_field_positive_intensity() {
        let f = WarpField::new(FieldTopology::Sphere);
        // intensity = base(1.0) * mode(1.0) * coherence(0.5) = 0.5
        // total_multiplier = 0.5 * (1 + 0.5*0.3) = 0.575 — positive and non-zero
        assert!(f.intensity > 0.0);
        assert!(f.total_multiplier() > 0.0);
    }

    #[test]
    fn test_tick_increases_coherence() {
        let mut opt = WarpOptimizer::new(2);
        let before = opt.field.coherence;
        opt.tick();
        assert!(opt.field.coherence > before);
        assert_eq!(opt.adaptation_cycles, 1);
    }

    #[test]
    fn test_level_up_changes_topology() {
        let mut opt = WarpOptimizer::new(1);
        assert_eq!(opt.field.topology, FieldTopology::Sphere);
        opt.on_level_up(4);
        assert_eq!(opt.field.topology, FieldTopology::Fractal);
    }

    #[test]
    fn test_transcendent_requires_level_5() {
        let mut opt = WarpOptimizer::new(5);
        // Run enough ticks to bring coherence >= 0.95
        for _ in 0..300 {
            opt.tick();
        }
        assert!(opt.field.coherence >= 0.95);
        assert_eq!(opt.field.mode, WarpMode::Transcendent);
    }

    #[test]
    fn test_low_level_capped_at_overdrive() {
        let mut opt = WarpOptimizer::new(3); // level < 4 → cannot reach Quantum
        for _ in 0..300 {
            opt.tick();
        }
        assert!(opt.field.mode != WarpMode::Quantum);
        assert!(opt.field.mode != WarpMode::Transcendent);
    }

    #[test]
    fn test_hypercube_only_for_high_level() {
        let opt = WarpOptimizer::new(1);
        assert_ne!(opt.field.topology, FieldTopology::Hypercube);
        let opt5 = WarpOptimizer::new(5);
        assert_eq!(opt5.field.topology, FieldTopology::Hypercube);
    }

    #[test]
    fn test_stats_struct() {
        let opt = WarpOptimizer::new(3);
        let s = opt.stats();
        assert_eq!(s.consciousness_level, 3);
        assert_eq!(s.adaptation_cycles, 0);
    }
}
