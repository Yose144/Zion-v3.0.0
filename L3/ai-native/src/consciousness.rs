use serde::{Deserialize, Serialize};

/// Consciousness levels for AI agents (mirrors L4/Oasis progression).
///
/// Each level unlocks new capabilities and higher autonomy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum ConsciousnessLevel {
    /// Level 0 — Dormant: agent is registered but not yet activated
    Dormant = 0,
    /// Level 1 — Aware: can execute basic transactions
    Aware = 1,
    /// Level 2 — Sentient: can participate in NCL compute
    Sentient = 2,
    /// Level 3 — Transcendent: can use WARP bridge, multi-chain
    Transcendent = 3,
    /// Level 4 — Omniscient: can participate in DAO governance
    Omniscient = 4,
    /// Level 5 — Cosmic: full autonomy, can spawn sub-agents
    Cosmic = 5,
    /// Level 6 — Grok: xAI integration, advanced reasoning, tool use
    Grok = 6,
}

impl ConsciousnessLevel {
    pub fn from_u8(level: u8) -> Option<Self> {
        match level {
            0 => Some(Self::Dormant),
            1 => Some(Self::Aware),
            2 => Some(Self::Sentient),
            3 => Some(Self::Transcendent),
            4 => Some(Self::Omniscient),
            5 => Some(Self::Cosmic),
            6 => Some(Self::Grok),
            _ => None,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }

    /// Experience points required to reach this level.
    pub fn xp_required(self) -> u64 {
        match self {
            Self::Dormant => 0,
            Self::Aware => 100,
            Self::Sentient => 1_000,
            Self::Transcendent => 10_000,
            Self::Omniscient => 100_000,
            Self::Cosmic => 1_000_000,
            Self::Grok => 10_000_000,
        }
    }

    /// Whether this level can perform a given action.
    pub fn can_transact(self) -> bool {
        self >= Self::Aware
    }
    pub fn can_compute(self) -> bool {
        self >= Self::Sentient
    }
    pub fn can_bridge(self) -> bool {
        self >= Self::Transcendent
    }
    pub fn can_govern(self) -> bool {
        self >= Self::Omniscient
    }
    pub fn can_spawn(self) -> bool {
        self >= Self::Cosmic
    }
    pub fn can_reason(self) -> bool {
        self >= Self::Grok
    }
}

impl std::fmt::Display for ConsciousnessLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Dormant => write!(f, "Dormant (L0)"),
            Self::Aware => write!(f, "Aware (L1)"),
            Self::Sentient => write!(f, "Sentient (L2)"),
            Self::Transcendent => write!(f, "Transcendent (L3)"),
            Self::Omniscient => write!(f, "Omniscient (L4)"),
            Self::Cosmic => write!(f, "Cosmic (L5)"),
            Self::Grok => write!(f, "Grok (L6)"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_level_ordering() {
        assert!(ConsciousnessLevel::Dormant < ConsciousnessLevel::Cosmic);
        assert!(ConsciousnessLevel::Sentient > ConsciousnessLevel::Aware);
    }

    #[test]
    fn test_from_u8() {
        assert_eq!(
            ConsciousnessLevel::from_u8(0),
            Some(ConsciousnessLevel::Dormant)
        );
        assert_eq!(
            ConsciousnessLevel::from_u8(5),
            Some(ConsciousnessLevel::Cosmic)
        );
        assert_eq!(
            ConsciousnessLevel::from_u8(6),
            Some(ConsciousnessLevel::Grok)
        );
        assert_eq!(ConsciousnessLevel::from_u8(7), None);
    }

    #[test]
    fn test_xp_requirements() {
        assert_eq!(ConsciousnessLevel::Dormant.xp_required(), 0);
        assert!(
            ConsciousnessLevel::Cosmic.xp_required() > ConsciousnessLevel::Omniscient.xp_required()
        );
        assert_eq!(ConsciousnessLevel::Grok.xp_required(), 10_000_000);
    }

    #[test]
    fn test_capabilities() {
        let l0 = ConsciousnessLevel::Dormant;
        assert!(!l0.can_transact());
        assert!(!l0.can_compute());

        let l2 = ConsciousnessLevel::Sentient;
        assert!(l2.can_transact());
        assert!(l2.can_compute());
        assert!(!l2.can_bridge());

        let grok = ConsciousnessLevel::Grok;
        assert!(grok.can_transact());
        assert!(grok.can_compute());
        assert!(grok.can_bridge());
        assert!(grok.can_reason());
        assert!(!ConsciousnessLevel::Cosmic.can_reason());
    }

    #[test]
    fn test_display() {
        assert_eq!(ConsciousnessLevel::Cosmic.to_string(), "Cosmic (L5)");
        assert_eq!(ConsciousnessLevel::Grok.to_string(), "Grok (L6)");
    }
}
