//! # ZION OASIS — L4 Consciousness Mining Game
//!
//! *"Mining is not just computation — it's a journey of consciousness."*
//!
//! ## Architecture
//!
//! ```text
//!                  ┌──────────────────────────────────────────┐
//!                  │            🎮 ZION OASIS                 │
//!                  │                                          │
//!                  │  ┌────────────┐    ┌─────────────────┐  │
//!                  │  │ Conscious- │    │    Player       │  │
//!                  │  │ ness 9 Lvl │    │    Profiles     │  │
//!                  │  └─────┬──────┘    └───────┬─────────┘  │
//!                  │        │                    │            │
//!                  │  ┌─────┴──────┐    ┌───────┴─────────┐  │
//!                  │  │  XP System │    │   Guilds &      │  │
//!                  │  │  + Awards  │    │   Territories   │  │
//!                  │  └─────┬──────┘    └───────┬─────────┘  │
//!                  │        │                    │            │
//!                  │  ┌─────┴──────┐    ┌───────┴─────────┐  │
//!                  │  │ Challenges │    │  Leaderboard    │  │
//!                  │  │ AI + Quiz  │    │  + Rewards      │  │
//!                  │  └─────┬──────┘    └───────┬─────────┘  │
//!                  │        │                    │            │
//!                  │  ┌─────┴────────────────────┴─────────┐ │
//!                  │  │      Humanitarian Tithe (7 cat.)   │ │
//!                  │  │  💧🍞🏠🌍🏥📚🚨                    │ │
//!                  │  └────────────────────────────────────┘ │
//!                  └──────────────────────────────────────────┘
//!                                    │
//!                  ┌─────────────────┴──────────────────┐
//!                  │  L3 AI Native (consciousness eval)  │
//!                  │  L3 NCL (compute for challenges)    │
//!                  │  L1 (mining rewards, premine 8.25B) │
//!                  └─────────────────────────────────────┘
//! ```
//!
//! ## ⚠️ Layer Boundary
//!
//! This is an **L4 crate** — the topmost layer.
//! OASIS does NOT modify L1 state. It reads mining data from L1,
//! uses L3 AI Native for consciousness evaluation,
//! and manages the game layer independently.
//!
//! ## Premine Allocation
//!
//! 8,250,000,000 ZION (8.25B) distributed over 10+ years:
//!   - 5 slots × 1.65B ZION each
//!   - Unlocked based on consciousness level achievements
//!   - Controlled by OASIS game engine + DAO governance

pub mod error;
pub mod consciousness;
pub mod xp;
pub mod levels;
pub mod player;
pub mod guild;
pub mod territory;
pub mod challenges;
pub mod rewards;
pub mod leaderboard;
pub mod tithe;
pub mod api;
pub mod config;

// Re-exports
pub use config::OasisConfig;
pub use consciousness::ConsciousnessLevel;
pub use error::{OasisError, OasisResult};
pub use guild::Guild;
pub use player::Player;
pub use xp::XpSystem;
