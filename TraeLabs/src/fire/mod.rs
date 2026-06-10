//! Fire (Winter) algorithm variants - GPU intensive, generates heat

pub mod v1_thermal;
pub mod v2_recursive;

pub use v1_thermal::*;
pub use v2_recursive::*;
