//! GPU kernel sources for the ZION canonical proof-of-work algorithms.
//!
//! This module embeds OpenCL kernel source strings at compile time. The actual
//! device compilation and dispatch lives in the `zion-miner` crate.

pub mod opencl_kernel;
