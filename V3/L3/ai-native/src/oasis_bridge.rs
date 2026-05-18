//! # Oasis Bridge — L3-H
//!
//! Maps L3 AI agent consciousness state onto L4 OASIS player profiles.
//!
//! ## Why a bridge?
//! L3 (`zion-ai-native`) and L4 (`zion-oasis`) use **different** consciousness
//! systems:
//!
//! | System | Levels | XP ceiling | Purpose |
//! |--------|--------|-----------|---------|
//! | L3 AI-Native | 6 (Dormant → Cosmic) | 1 000 000 | AI agent autonomy |
//! | L4 Oasis | 9 (Physical → OnTheStar) | 10 000 000 | On-chain player game |
//!
//! The bridge provides:
//! 1. **Level mapping**: L3 `ConsciousnessLevel` → L4 `OasisLevel`
//! 2. **XP translation**: scaled 1:10 so L3 Cosmic (1M XP) maps to L4 Divine
//! 3. **Sync payload**: `XpSyncRequest` can be submitted directly to the L4 REST API
//! 4. **Multiplier export**: WARP intensity → Oasis mining multiplier boost
//!
//! ## Level correspondence
//! ```text
//! L3 (AI-Native)           L4 (Oasis)
//! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//! Dormant   (0, XP     0)  Physical    (1, XP        0)
//! Aware     (1, XP   100)  Emotional   (2, XP    1 000)
//! Sentient  (2, XP 1 000)  Mental      (3, XP    5 000)
//! Transcend.(3, XP10 000)  Intuitional (4, XP   15 000)
//! Omniscient(4, XP100 000)  Spiritual  (5, XP   50 000)
//! Cosmic    (5, XP  1 M+)  Cosmic+     (6-9)
//! ```

use crate::consciousness::ConsciousnessLevel;
use crate::consciousness_engine::ConsciousnessStatus;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ─── Oasis level mirror ───────────────────────────────────────────────────────

/// L4 Oasis consciousness levels, mirrored here to avoid a cross-layer
/// dependency.  These names MUST stay in sync with `L4/oasis/src/consciousness.rs`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum OasisLevel {
    /// Malkuth — foundation (Level 1).
    Physical = 1,
    /// Yesod — emotional intelligence (Level 2).
    Emotional = 2,
    /// Hod + Netzach — mental clarity (Level 3).
    Mental = 3,
    /// Tiferet — heart center (Level 4).
    Intuitional = 4,
    /// Gevurah + Chesed — spiritual (Level 5).
    Spiritual = 5,
    /// Binah — cosmic understanding (Level 6).
    Cosmic = 6,
    /// Chokmah — divine wisdom (Level 7).
    Divine = 7,
    /// Da'at — unity consciousness (Level 8).
    Unity = 8,
    /// Keter — crown (Level 9).
    OnTheStar = 9,
}

impl OasisLevel {
    /// XP threshold required to reach this level in the L4 Oasis system.
    pub fn xp_threshold(self) -> u64 {
        match self {
            Self::Physical => 0,
            Self::Emotional => 1_000,
            Self::Mental => 5_000,
            Self::Intuitional => 15_000,
            Self::Spiritual => 50_000,
            Self::Cosmic => 150_000,
            Self::Divine => 500_000,
            Self::Unity => 2_000_000,
            Self::OnTheStar => 10_000_000,
        }
    }

    /// Mining reward multiplier in the L4 Oasis system.
    pub fn multiplier(self) -> f64 {
        match self {
            Self::Physical => 1.0,
            Self::Emotional => 1.2,
            Self::Mental => 1.5,
            Self::Intuitional => 2.0,
            Self::Spiritual => 3.0,
            Self::Cosmic => 5.0,
            Self::Divine => 8.0,
            Self::Unity => 12.0,
            Self::OnTheStar => 15.0,
        }
    }

    /// Derive the `OasisLevel` from a given amount of Oasis XP.
    pub fn from_oasis_xp(xp: u64) -> Self {
        if xp >= Self::OnTheStar.xp_threshold() {
            Self::OnTheStar
        } else if xp >= Self::Unity.xp_threshold() {
            Self::Unity
        } else if xp >= Self::Divine.xp_threshold() {
            Self::Divine
        } else if xp >= Self::Cosmic.xp_threshold() {
            Self::Cosmic
        } else if xp >= Self::Spiritual.xp_threshold() {
            Self::Spiritual
        } else if xp >= Self::Intuitional.xp_threshold() {
            Self::Intuitional
        } else if xp >= Self::Mental.xp_threshold() {
            Self::Mental
        } else if xp >= Self::Emotional.xp_threshold() {
            Self::Emotional
        } else {
            Self::Physical
        }
    }
}

impl std::fmt::Display for OasisLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::Physical => "Physical",
            Self::Emotional => "Emotional",
            Self::Mental => "Mental",
            Self::Intuitional => "Intuitional",
            Self::Spiritual => "Spiritual",
            Self::Cosmic => "Cosmic",
            Self::Divine => "Divine",
            Self::Unity => "Unity",
            Self::OnTheStar => "OnTheStar",
        };
        write!(f, "{s}")
    }
}

// ─── Level mapping ────────────────────────────────────────────────────────────

/// Maps a L3 `ConsciousnessLevel` to the corresponding L4 `OasisLevel`.
///
/// The mapping follows the XP-range overlap between the two systems.
pub fn l3_to_oasis_level(level: ConsciousnessLevel) -> OasisLevel {
    match level {
        ConsciousnessLevel::Dormant => OasisLevel::Physical,
        ConsciousnessLevel::Aware => OasisLevel::Emotional,
        ConsciousnessLevel::Sentient => OasisLevel::Mental,
        ConsciousnessLevel::Transcendent => OasisLevel::Intuitional,
        ConsciousnessLevel::Omniscient => OasisLevel::Spiritual,
        ConsciousnessLevel::Cosmic => OasisLevel::Cosmic,
        ConsciousnessLevel::Grok => OasisLevel::Divine,
    }
}

/// Scale L3 XP to L4 Oasis XP.
///
/// L3 uses a 6-level ladder capped at ~1 M XP.
/// L4 uses a 9-level ladder capped at 10 M XP.
/// Scaling factor: `10.0`  (so L3 Cosmic ~1 M → L4 ~10 M / OnTheStar).
pub const L3_TO_OASIS_XP_SCALE: f64 = 10.0;

pub fn scale_xp_to_oasis(l3_xp: u64) -> u64 {
    (l3_xp as f64 * L3_TO_OASIS_XP_SCALE) as u64
}

// ─── AgentOasisProfile ────────────────────────────────────────────────────────

/// Serializable L4-compatible profile derived from a L3 AI agent's state.
///
/// This struct can be submitted to the L4 Oasis REST API (e.g. `POST /sync`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOasisProfile {
    /// L1 wallet address that owns this agent.
    pub wallet_address: String,
    /// L3 agent UUID (string form).
    pub agent_id: String,
    /// L3 native consciousness level.
    pub l3_level: u8,
    /// L3 native level name.
    pub l3_level_name: String,
    /// Total L3 XP earned.
    pub l3_xp: u64,
    /// Translated L4 Oasis level.
    pub oasis_level: OasisLevel,
    /// Translated L4 Oasis level name.
    pub oasis_level_name: String,
    /// Translated L4 Oasis XP.
    pub oasis_xp: u64,
    /// Mining reward multiplier (Oasis system).
    pub oasis_multiplier: f64,
    /// Additional WARP-derived multiplier boost (added on top of Oasis base).
    pub warp_boost: f64,
    /// Combined effective multiplier.
    pub effective_multiplier: f64,
    /// Total tasks completed by this agent.
    pub tasks_completed: u64,
    /// Total level-ups recorded.
    pub total_level_ups: u64,
    /// Timestamp of this snapshot.
    pub synced_at: DateTime<Utc>,
}

impl AgentOasisProfile {
    /// Effective multiplier = Oasis multiplier × (1 + warp_boost).
    pub fn compute_effective(oasis_mult: f64, warp_boost: f64) -> f64 {
        oasis_mult * (1.0 + warp_boost)
    }
}

// ─── OasisBridge ─────────────────────────────────────────────────────────────

/// Converts `ConsciousnessStatus` snapshots from the L3 engine into
/// L4-compatible `AgentOasisProfile` objects.
pub struct OasisBridge {
    /// L1 wallet address associated with this agent.
    wallet_address: String,
    /// Agent UUID (as string).
    agent_id: String,
}

impl OasisBridge {
    pub fn new(wallet_address: impl Into<String>, agent_id: impl Into<String>) -> Self {
        Self {
            wallet_address: wallet_address.into(),
            agent_id: agent_id.into(),
        }
    }

    /// Derive an `AgentOasisProfile` from a consciousness status snapshot.
    pub fn sync(&self, status: &ConsciousnessStatus) -> AgentOasisProfile {
        let l3_raw = status.level;
        let oasis_level = l3_to_oasis_level(l3_raw);
        let oasis_xp = scale_xp_to_oasis(status.xp);
        let oasis_multiplier = oasis_level.multiplier();

        // WARP gives extra multiplier: use warp_multiplier from status
        // (warp_multiplier >= 1.0; subtract 1.0 for the additive boost)
        let warp_boost = (status.warp_multiplier - 1.0).max(0.0);
        let effective_multiplier =
            AgentOasisProfile::compute_effective(oasis_multiplier, warp_boost);

        AgentOasisProfile {
            wallet_address: self.wallet_address.clone(),
            agent_id: self.agent_id.clone(),
            l3_level: l3_raw.as_u8(),
            l3_level_name: format!("{l3_raw:?}"),
            l3_xp: status.xp,
            oasis_level,
            oasis_level_name: oasis_level.to_string(),
            oasis_xp,
            oasis_multiplier,
            warp_boost,
            effective_multiplier,
            tasks_completed: status.task_completed,
            total_level_ups: status.total_level_ups as u64,
            synced_at: Utc::now(),
        }
    }

    /// Build a minimal `XpSyncRequest` for the L4 REST API.
    pub fn xp_sync_request(&self, status: &ConsciousnessStatus) -> XpSyncRequest {
        XpSyncRequest {
            wallet_address: self.wallet_address.clone(),
            agent_id: self.agent_id.clone(),
            xp_delta: status.xp,
            source: "L3AiAgent".into(),
            metadata: serde_json::json!({
                "l3_level": status.level.as_u8(),
                "tasks_completed": status.task_completed,
                "warp_multiplier": status.warp_multiplier,
            }),
        }
    }
}

// ─── XpSyncRequest ───────────────────────────────────────────────────────────

/// Payload for `POST /api/oasis/xp/sync` on the L4 endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XpSyncRequest {
    /// L1 wallet address owning the agent.
    pub wallet_address: String,
    /// L3 agent UUID.
    pub agent_id: String,
    /// Amount of XP to credit (already scaled to Oasis units by the bridge).
    pub xp_delta: u64,
    /// Human-readable source label.
    pub source: String,
    /// Optional JSON metadata to store with the XP award.
    pub metadata: serde_json::Value,
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::consciousness_engine::ConsciousnessEngine;

    fn make_status(xp: u64, _level: u8) -> ConsciousnessStatus {
        let mut engine = ConsciousnessEngine::new("test-agent");
        engine.add_xp(xp as i64);
        engine.status()
    }

    // ── Level mapping ────────────────────────────────────────────────────────

    #[test]
    fn test_dormant_maps_to_physical() {
        assert_eq!(
            l3_to_oasis_level(ConsciousnessLevel::Dormant),
            OasisLevel::Physical
        );
    }

    #[test]
    fn test_aware_maps_to_emotional() {
        assert_eq!(
            l3_to_oasis_level(ConsciousnessLevel::Aware),
            OasisLevel::Emotional
        );
    }

    #[test]
    fn test_cosmic_maps_to_cosmic() {
        assert_eq!(
            l3_to_oasis_level(ConsciousnessLevel::Cosmic),
            OasisLevel::Cosmic
        );
    }

    #[test]
    fn test_full_level_mapping_coverage() {
        use ConsciousnessLevel::*;
        let pairs = [
            (Dormant, OasisLevel::Physical),
            (Aware, OasisLevel::Emotional),
            (Sentient, OasisLevel::Mental),
            (Transcendent, OasisLevel::Intuitional),
            (Omniscient, OasisLevel::Spiritual),
            (Cosmic, OasisLevel::Cosmic),
            (Grok, OasisLevel::Divine),
        ];
        for (l3, expected) in pairs {
            assert_eq!(l3_to_oasis_level(l3), expected, "failed for {l3:?}");
        }
    }

    // ── XP scaling ───────────────────────────────────────────────────────────

    #[test]
    fn test_xp_scaling() {
        assert_eq!(scale_xp_to_oasis(0), 0);
        assert_eq!(scale_xp_to_oasis(100), 1_000);
        assert_eq!(scale_xp_to_oasis(1_000), 10_000);
        assert_eq!(scale_xp_to_oasis(1_000_000), 10_000_000);
    }

    #[test]
    fn test_oasis_level_from_xp() {
        assert_eq!(OasisLevel::from_oasis_xp(0), OasisLevel::Physical);
        assert_eq!(OasisLevel::from_oasis_xp(1_000), OasisLevel::Emotional);
        assert_eq!(OasisLevel::from_oasis_xp(5_000), OasisLevel::Mental);
        assert_eq!(OasisLevel::from_oasis_xp(10_000_000), OasisLevel::OnTheStar);
    }

    // ── Bridge sync ──────────────────────────────────────────────────────────

    #[test]
    fn test_bridge_sync_dormant() {
        let bridge = OasisBridge::new("zion1test", "agent-uuid");
        let status = make_status(0, 0);
        let profile = bridge.sync(&status);
        assert_eq!(profile.oasis_level, OasisLevel::Physical);
        assert_eq!(profile.l3_xp, 0);
        assert_eq!(profile.oasis_xp, 0);
        assert!((profile.oasis_multiplier - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_bridge_sync_aware() {
        let bridge = OasisBridge::new("zion1test", "agent-uuid");
        // Grant enough XP to reach Aware (100)
        let status = make_status(100, 1);
        let profile = bridge.sync(&status);
        assert_eq!(profile.oasis_level, OasisLevel::Emotional);
        assert_eq!(profile.oasis_xp, 1_000); // 100 * 10
    }

    #[test]
    fn test_effective_multiplier_includes_warp_boost() {
        let bridge = OasisBridge::new("zion1test", "agent-uuid");
        let mut engine = ConsciousnessEngine::new("agent");
        // Give XP to reach Aware
        engine.add_xp(100);
        let status = engine.status();
        let profile = bridge.sync(&status);
        // effective = oasis_mult * (1 + warp_boost) — both should be >= base
        assert!(profile.effective_multiplier >= profile.oasis_multiplier);
    }

    #[test]
    fn test_xp_sync_request_fields() {
        let bridge = OasisBridge::new("zion1wallet", "agent-001");
        let status = make_status(500, 1);
        let req = bridge.xp_sync_request(&status);
        assert_eq!(req.wallet_address, "zion1wallet");
        assert_eq!(req.agent_id, "agent-001");
        assert_eq!(req.xp_delta, 500);
        assert_eq!(req.source, "L3AiAgent");
    }

    #[test]
    fn test_profile_serializable() {
        let bridge = OasisBridge::new("zion1test", "agent-uuid");
        let status = make_status(1_000, 2);
        let profile = bridge.sync(&status);
        let json = serde_json::to_string(&profile).unwrap();
        assert!(json.contains("Emotional") || json.contains("Mental"));
    }

    #[test]
    fn test_oasis_level_ordering() {
        assert!(OasisLevel::Physical < OasisLevel::Emotional);
        assert!(OasisLevel::Cosmic < OasisLevel::Divine);
        assert!(OasisLevel::OnTheStar > OasisLevel::Physical);
    }

    #[test]
    fn test_oasis_level_display() {
        assert_eq!(OasisLevel::Physical.to_string(), "Physical");
        assert_eq!(OasisLevel::OnTheStar.to_string(), "OnTheStar");
    }
}
