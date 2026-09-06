//! # ZION OASIS — V3 L4 Consciousness Mining Game
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
//!                  │  └────────────────────────────────────┘ │
//!                  └──────────────────────────────────────────┘
//!                                    │
//!                  ┌─────────────────┴──────────────────┐
//!                  │  L3 AI Native (consciousness eval)  │
//!                  │  L3 NCL (compute for challenges)    │
//!                  │  L1 (mining rewards, premine 4.95B) │
//!                  └─────────────────────────────────────┘
//! ```
//!
//! ## ⚠️ Layer Boundary
//!
//! This is a **V3 L4 crate** — the topmost game layer.
//! OASIS does NOT modify L1 state. It reads mining data from L1,
//! uses L3 AI Native for consciousness evaluation,
//! and manages the game layer independently.
//!
//! ## Premine Allocation
//!
//! 4,950,000,000 ZION (4.95B) distributed over 10+ years:
//!   - 3 slots × 1.65B ZION each (Slots 4 & 5 repurposed to L5 Free World Projects)
//!   - Unlocked based on consciousness level achievements
//!   - Controlled by OASIS game engine + DAO governance

pub mod api;
pub mod auth;
pub mod blockchain_listener;
pub mod challenges;
pub mod combat;
pub mod config;
pub mod consciousness;
pub mod db;
pub mod error;
pub mod golden_egg;
pub mod guild;
pub mod hiran_bridge;
pub mod leaderboard;
pub mod levels;
pub mod metrics;
pub mod player;
pub mod prize_tiers;
pub mod quests;
pub mod raid_team;
pub mod rate_limit;
pub mod rewards;
pub mod server;
pub mod territory;
pub mod tithe;
pub mod websocket;
pub mod worlds;
pub mod xp;
pub mod zis_auth;

// Re-exports
pub use config::OasisConfig;
pub use consciousness::ConsciousnessLevel;
pub use error::{OasisError, OasisResult};
pub use guild::Guild;
pub use player::Player;
pub use xp::XpSystem;
