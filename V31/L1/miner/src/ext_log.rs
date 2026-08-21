//! Logging macros for internal AuxPoW / Trinity (Stream 2/3) mining.
//!
//! In `public_build` (the public release binary), these compile down to
//! no-ops so that no external coin names (ZANO, VRSC, KAS, etc.), job ids,
//! or AuxPoW pool URLs ever reach stdout, the TUI log pane, or a log file.
//! The streams still run and mine exactly the same — only their log
//! visibility is affected. In non-public (internal/dev) builds these
//! macros behave exactly like the equivalent `tracing::*!` macro.

#[cfg(feature = "public_build")]
#[macro_export]
macro_rules! ext_info {
    ($($arg:tt)*) => {};
}
#[cfg(not(feature = "public_build"))]
#[macro_export]
macro_rules! ext_info {
    ($($arg:tt)*) => { tracing::info!($($arg)*) };
}

#[cfg(feature = "public_build")]
#[macro_export]
macro_rules! ext_warn {
    ($($arg:tt)*) => {};
}
#[cfg(not(feature = "public_build"))]
#[macro_export]
macro_rules! ext_warn {
    ($($arg:tt)*) => { tracing::warn!($($arg)*) };
}

#[cfg(feature = "public_build")]
#[macro_export]
macro_rules! ext_debug {
    ($($arg:tt)*) => {};
}
#[cfg(not(feature = "public_build"))]
#[macro_export]
macro_rules! ext_debug {
    ($($arg:tt)*) => { tracing::debug!($($arg)*) };
}

pub use crate::{ext_debug, ext_info, ext_warn};
