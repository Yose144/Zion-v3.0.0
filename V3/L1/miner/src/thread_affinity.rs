//! Thread affinity pinning for CPU mining threads.
//!
//! On Linux, uses `sched_setaffinity` to pin worker threads to specific
//! physical CPU cores. This improves L3 cache utilization for RandomX
//! (which is highly cache-sensitive) and reduces context switches.
//!
//! For Ryzen 5 3600 (6C/12T), physical cores are 0-5 and SMT siblings are 6-11.
//! Pinning RandomX threads to physical cores 0-5 gives best per-thread efficiency.
//! When mining with GPU simultaneously, we can use cores 0-5 for RandomX
//! and leave SMT siblings free for GPU management overhead.

#[cfg(target_os = "linux")]
mod linux {
    use std::io;

    // Raw FFI for sched_setaffinity — avoids adding a libc dependency.
    // The CPU set structure is a bitmask: 1024 bits = 128 bytes (enough for any
    // current desktop CPU).

    const CPU_SETSIZE: usize = 1024;
    const CPU_SET_BYTES: usize = CPU_SETSIZE / 8; // 128 bytes

    extern "C" {
        fn sched_setaffinity(pid: i32, cpusetsize: usize, mask: *const u8) -> i32;
    }

    /// Pin the current thread to a specific CPU core.
    ///
    /// Returns Ok(()) on success, or an io::Error with errno on failure.
    pub fn pin_to_core(core_id: usize) -> io::Result<()> {
        let mut mask = [0u8; CPU_SET_BYTES];
        // Set the bit for the target core
        let byte_idx = core_id / 8;
        let bit_idx = core_id % 8;
        if byte_idx >= CPU_SET_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("core_id {} exceeds CPU_SETSIZE {}", core_id, CPU_SETSIZE),
            ));
        }
        mask[byte_idx] |= 1 << bit_idx;

        let ret = unsafe { sched_setaffinity(0, CPU_SET_BYTES, mask.as_ptr()) };
        if ret == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }

    /// Detect physical core layout from /proc/cpuinfo.
    /// Returns a vector of physical core IDs (not SMT siblings).
    /// On Ryzen 5 3600: returns [0, 1, 2, 3, 4, 5]
    pub fn physical_core_ids() -> Vec<usize> {
        let cpuinfo = std::fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
        let mut cores: Vec<(usize, usize)> = Vec::new(); // (processor, core_id)

        let mut cur_processor: Option<usize> = None;
        let mut cur_core_id: Option<usize> = None;

        for line in cpuinfo.lines() {
            if let Some(val) = line.strip_prefix("processor") {
                let val = val.trim_start_matches([':', ' ']);
                cur_processor = val.parse().ok();
            } else if let Some(val) = line.strip_prefix("core id") {
                let val = val.trim_start_matches([':', ' ']);
                cur_core_id = val.parse().ok();
            } else if line.is_empty() {
                // End of a processor block
                if let (Some(p), Some(c)) = (cur_processor, cur_core_id) {
                    cores.push((p, c));
                }
                cur_processor = None;
                cur_core_id = None;
            }
        }
        // Handle last block (no trailing newline)
        if let (Some(p), Some(c)) = (cur_processor, cur_core_id) {
            cores.push((p, c));
        }

        // On AMD, processor 0-5 are physical cores, 6-11 are SMT siblings.
        // The "core id" field maps to physical core 0-5.
        // We want the first N unique core IDs (by processor order).
        let mut seen = std::collections::HashSet::new();
        let mut result = Vec::new();
        for (proc, core) in cores.iter() {
            if seen.insert(*core) {
                result.push(*proc);
            }
        }
        if result.is_empty() {
            // Fallback: assume 0..num_cpus
            (0..num_cpus::get()).collect()
        } else {
            result
        }
    }
}

#[cfg(target_os = "linux")]
pub use linux::{pin_to_core, physical_core_ids};

#[cfg(target_os = "windows")]
mod windows {
    use std::io;

    // Windows API for thread affinity.
    // GetActiveProcessorCount(ALL_PROCESSOR_GROUPS) returns total logical CPUs.
    // SetThreadAffinityMask pins the current thread to a CPU set (bitmask).
    extern "system" {
        fn SetThreadAffinityMask(hThread: usize, dwThreadAffinityMask: usize) -> usize;
        fn GetCurrentThread() -> usize;
    }

    /// Pin the current thread to a specific CPU core on Windows.
    ///
    /// Uses SetThreadAffinityMask with a 64-bit mask (sufficient for up to
    /// 64 logical CPUs).  Returns Ok(()) on success.
    pub fn pin_to_core(core_id: usize) -> io::Result<()> {
        if core_id >= 64 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("core_id {} exceeds 64-bit mask", core_id),
            ));
        }
        let mask: usize = 1usize << core_id;
        unsafe {
            let h = GetCurrentThread();
            let prev = SetThreadAffinityMask(h, mask);
            if prev == 0 {
                Err(io::Error::last_os_error())
            } else {
                Ok(())
            }
        }
    }

    /// On Windows, we cannot easily detect physical vs SMT cores from userspace
    /// without WMI.  Return 0..N (all logical cores) and let the caller decide.
    /// The caller (maybe_pin_thread) will use logical IDs; for RandomX, the
    /// first N logical IDs are typically physical cores on Intel/AMD.
    pub fn physical_core_ids() -> Vec<usize> {
        (0..num_cpus::get()).collect()
    }
}

#[cfg(target_os = "windows")]
pub use windows::{pin_to_core, physical_core_ids};

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub fn pin_to_core(_core_id: usize) -> std::io::Result<()> {
    Ok(()) // No-op on other platforms
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub fn physical_core_ids() -> Vec<usize> {
    (0..num_cpus::get()).collect()
}

/// Pin a worker thread to a physical core based on its index.
///
/// For RandomX with `threads` workers:
/// - If threads <= physical_cores: pin each thread to physical core [0..threads]
/// - If threads > physical_cores: pin first N to physical, rest to SMT siblings
///
/// Controlled by `ZION_CPU_AFFINITY` env var:
/// - "0" or "off": disable affinity pinning
/// - "physical": pin to physical cores only (default for RandomX)
/// - "spread": spread across all logical cores
/// - Not set: auto (physical for RandomX, spread for VerusHash)
pub fn maybe_pin_thread(thread_idx: usize, total_threads: usize, algorithm: &str) {
    let env_val = std::env::var("ZION_CPU_AFFINITY").unwrap_or_else(|_| "auto".to_string());

    if env_val == "0" || env_val == "off" {
        return;
    }

    let physical = physical_core_ids();
    let num_physical = physical.len();
    let total_logical = num_cpus::get();

    // For RandomX, prefer physical cores (cache-sensitive).
    // For VerusHash, spreading is fine (compute-bound, not cache-bound).
    let use_physical = match env_val.as_str() {
        "physical" => true,
        "spread" => false,
        _ => algorithm == "randomx", // auto
    };

    let core_id = if use_physical {
        if thread_idx < num_physical {
            // Pin to physical core
            physical[thread_idx]
        } else {
            // Overflow: use SMT siblings.
            // On AMD Zen (Linux), SMT siblings are at processor_id + num_physical
            // (e.g., core 0's sibling is processor 6 on a 6C/12T Ryzen).
            // On Windows, physical_core_ids() returns all logical IDs, so
            // num_physical == total_logical — just spread across logical cores.
            let smt_idx = thread_idx - num_physical;
            if num_physical < total_logical && smt_idx < num_physical {
                // Linux AMD Zen: map to SMT sibling
                physical[smt_idx] + num_physical
            } else {
                // Windows or non-SMT: spread across logical cores
                thread_idx % total_logical
            }
        }
    } else {
        // Spread across all logical cores
        thread_idx % total_logical
    };

    if let Err(e) = pin_to_core(core_id) {
        // Non-fatal — continue without affinity
        eprintln!(
            "[affinity] warning: failed to pin thread {} to core {}: {}",
            thread_idx, core_id, e
        );
    }
}
