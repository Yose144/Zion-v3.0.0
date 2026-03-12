//! HugePages memory allocator for mining scratchpads.
//!
//! Inspired by XMRig's VirtualMemory — uses OS-level huge pages (2 MiB) to
//! eliminate TLB misses during memory-hard scratchpad operations.
//!
//! The 64 KiB Ekam Deeksha scratchpad has 1024 pseudo-random 64-byte block
//! accesses per hash. With standard 4 KiB pages, each access can cause a TLB
//! miss. With 2 MiB huge pages, the entire scratchpad fits in ONE TLB entry.
//!
//! Platform support:
//! - macOS (arm64/x86_64): VM_FLAGS_SUPERPAGE_SIZE_2MB via mmap
//! - Linux: MAP_HUGETLB | MAP_POPULATE via mmap
//! - Fallback: aligned standard allocation via mmap MAP_ANONYMOUS
//!
//! Usage:
//! ```ignore
//! let hp = HugePageScratchpad::new(64 * 1024).unwrap();
//! let buf: &mut [u8] = hp.as_mut_slice();
//! // ... use buf as 64 KiB scratchpad ...
//! ```

use std::ptr;

/// Size of a "huge page" for allocation alignment (2 MiB).
const HUGE_PAGE_SIZE: usize = 2 * 1024 * 1024;

/// A single scratchpad buffer backed by huge pages (when available).
pub struct HugePageScratchpad {
    ptr: *mut u8,
    /// Actual mapped size (rounded to huge page boundary).
    mapped_size: usize,
    /// Logical scratchpad size (e.g. 64 KiB).
    logical_size: usize,
    /// Whether huge pages were successfully obtained.
    huge_pages: bool,
    /// Whether the memory is locked.
    locked: bool,
}

// SAFETY: The buffer is exclusively owned by this struct (no aliasing).
unsafe impl Send for HugePageScratchpad {}
unsafe impl Sync for HugePageScratchpad {}

/// Result of huge page availability check.
#[derive(Debug, Clone)]
pub struct HugePagesInfo {
    pub available: bool,
    pub allocated: bool,
    pub page_size: usize,
}

impl HugePageScratchpad {
    /// Allocate a scratchpad buffer, preferring huge pages.
    ///
    /// Falls back to regular mmap if huge pages are unavailable.
    /// The buffer is zero-initialized and memory-locked.
    pub fn new(size: usize) -> Result<Self, String> {
        let mapped_size = align_to_huge_page(size);
        
        // Try huge pages first, then fall back to regular mmap
        let (ptr, huge_pages) = alloc_huge_pages(mapped_size)
            .unwrap_or_else(|| {
                let p = alloc_regular(mapped_size);
                // Try transparent huge pages as a middle ground
                if let Some(p) = p {
                    advise_huge_pages(p, mapped_size);
                }
                (p, false)
            });

        let ptr = ptr.ok_or_else(|| {
            format!("Failed to allocate {} KiB scratchpad memory", size / 1024)
        })?;

        // Lock memory to prevent swapping (best-effort)
        let locked = mlock(ptr, mapped_size);

        // Advise kernel about random access pattern
        madvise_random(ptr, mapped_size);

        Ok(HugePageScratchpad {
            ptr,
            mapped_size,
            logical_size: size,
            huge_pages,
            locked,
        })
    }

    /// Returns a mutable slice to the scratchpad buffer.
    #[inline]
    pub fn as_mut_slice(&mut self) -> &mut [u8] {
        unsafe { std::slice::from_raw_parts_mut(self.ptr, self.logical_size) }
    }

    /// Returns an immutable slice to the scratchpad buffer.
    #[inline]
    pub fn as_slice(&self) -> &[u8] {
        unsafe { std::slice::from_raw_parts(self.ptr, self.logical_size) }
    }

    /// Returns a raw mutable pointer.
    #[inline]
    pub fn as_mut_ptr(&mut self) -> *mut u8 {
        self.ptr
    }

    /// Whether this allocation is backed by huge pages.
    #[inline]
    pub fn is_huge_pages(&self) -> bool {
        self.huge_pages
    }

    /// Whether this allocation is memory-locked.
    #[inline]
    pub fn is_locked(&self) -> bool {
        self.locked
    }

    /// Logical scratchpad size.
    #[inline]
    pub fn len(&self) -> usize {
        self.logical_size
    }
}

impl Drop for HugePageScratchpad {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            if self.locked {
                unsafe { libc::munlock(self.ptr as *const libc::c_void, self.mapped_size) };
            }
            unsafe { libc::munmap(self.ptr as *mut libc::c_void, self.mapped_size) };
            self.ptr = ptr::null_mut();
        }
    }
}

/// Check if huge pages are available on this system.
pub fn is_huge_pages_available() -> HugePagesInfo {
    #[cfg(target_os = "macos")]
    {
        // macOS arm64 (Apple Silicon) natively uses 16K pages.
        // VM_FLAGS_SUPERPAGE_SIZE_2MB is x86_64-only on macOS.
        // On arm64, we fall back to regular mmap with madvise hints.
        // Even without superpages, 16K native pages mean the 64 KiB
        // scratchpad only needs 4 TLB entries (vs 16 on x86_64 4K pages).
        #[cfg(target_arch = "aarch64")]
        let available = false; // superpages not supported on arm64 macOS
        #[cfg(not(target_arch = "aarch64"))]
        let available = true;  // x86_64 macOS supports superpages

        HugePagesInfo {
            available,
            allocated: false,
            page_size: if available { HUGE_PAGE_SIZE } else { 16384 }, // native 16K on arm64
        }
    }

    #[cfg(target_os = "linux")]
    {
        let available = std::fs::read_to_string("/proc/sys/vm/nr_hugepages")
            .map(|s| s.trim().parse::<u64>().unwrap_or(0) > 0)
            .unwrap_or(false);

        HugePagesInfo {
            available,
            allocated: false,
            page_size: HUGE_PAGE_SIZE,
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        HugePagesInfo {
            available: false,
            allocated: false,
            page_size: 4096,
        }
    }
}

// ============================================================================
// Platform-specific allocation
// ============================================================================

/// Try to allocate memory backed by huge pages.
/// Returns (pointer, true) on success, or None on failure.
fn alloc_huge_pages(size: usize) -> Option<(Option<*mut u8>, bool)> {
    let ptr = alloc_huge_pages_inner(size);
    if let Some(p) = ptr {
        if !p.is_null() {
            return Some((Some(p), true));
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn alloc_huge_pages_inner(size: usize) -> Option<*mut u8> {
    // macOS: VM_FLAGS_SUPERPAGE_SIZE_2MB = 0x40000
    // This is the same flag XMRig uses for macOS huge page allocation.
    const VM_FLAGS_SUPERPAGE_SIZE_2MB: i32 = 0x40000;

    let ptr = unsafe {
        libc::mmap(
            ptr::null_mut(),
            size,
            libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_PRIVATE | libc::MAP_ANON,
            VM_FLAGS_SUPERPAGE_SIZE_2MB, // fd field doubles as vm_flags on macOS
            0,
        )
    };

    if ptr == libc::MAP_FAILED {
        None
    } else {
        Some(ptr as *mut u8)
    }
}

#[cfg(target_os = "linux")]
fn alloc_huge_pages_inner(size: usize) -> Option<*mut u8> {
    let ptr = unsafe {
        libc::mmap(
            ptr::null_mut(),
            size,
            libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_PRIVATE | libc::MAP_ANONYMOUS | libc::MAP_HUGETLB | libc::MAP_POPULATE,
            -1,
            0,
        )
    };

    if ptr == libc::MAP_FAILED {
        None
    } else {
        Some(ptr as *mut u8)
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn alloc_huge_pages_inner(_size: usize) -> Option<*mut u8> {
    None
}

/// Allocate regular mmap memory (fallback when huge pages unavailable).
fn alloc_regular(size: usize) -> Option<*mut u8> {
    let ptr = unsafe {
        libc::mmap(
            ptr::null_mut(),
            size,
            libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_PRIVATE | libc::MAP_ANON,
            -1,
            0,
        )
    };

    if ptr == libc::MAP_FAILED {
        None
    } else {
        Some(ptr as *mut u8)
    }
}

/// Try to enable transparent huge pages for a memory region (Linux only).
fn advise_huge_pages(ptr: *mut u8, size: usize) {
    #[cfg(target_os = "linux")]
    unsafe {
        // MADV_HUGEPAGE = 14
        libc::madvise(ptr as *mut libc::c_void, size, libc::MADV_HUGEPAGE);
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (ptr, size);
    }
}

/// Lock memory to prevent swapping (best-effort).
fn mlock(ptr: *mut u8, size: usize) -> bool {
    unsafe { libc::mlock(ptr as *const libc::c_void, size) == 0 }
}

/// Advise the kernel that access will be random.
fn madvise_random(ptr: *mut u8, size: usize) {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    unsafe {
        libc::madvise(
            ptr as *mut libc::c_void,
            size,
            libc::MADV_RANDOM | libc::MADV_WILLNEED,
        );
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = (ptr, size);
    }
}

/// Align size up to huge page boundary.
fn align_to_huge_page(size: usize) -> usize {
    (size + HUGE_PAGE_SIZE - 1) & !(HUGE_PAGE_SIZE - 1)
}

// ============================================================================
// Thread-local pool — one HugePageScratchpad per mining thread
// ============================================================================

use std::cell::RefCell;

// Thread-local huge-page-backed scratchpad buffer (one per mining thread).
thread_local! {
    static HP_SCRATCHPAD: RefCell<Option<HugePageScratchpad>> = const { RefCell::new(None) };
}

/// Execute a closure with the thread-local huge-page scratchpad.
///
/// On first call per thread, allocates a new HugePageScratchpad.
/// Subsequent calls reuse the same buffer (zero-cost after init).
#[inline]
pub fn with_huge_page_scratchpad<F, R>(size: usize, f: F) -> R
where
    F: FnOnce(&mut [u8]) -> R,
{
    HP_SCRATCHPAD.with(|cell| {
        let mut opt = cell.borrow_mut();
        if opt.is_none() || opt.as_ref().map(|hp| hp.len()) != Some(size) {
            match HugePageScratchpad::new(size) {
                Ok(hp) => {
                    let status = if hp.is_huge_pages() { "HUGE PAGES" } else { "regular pages" };
                    let lock = if hp.is_locked() { "+locked" } else { "" };
                    log::info!(
                        "Scratchpad allocated: {} KiB on {} {}",
                        size / 1024, status, lock
                    );
                    *opt = Some(hp);
                }
                Err(e) => {
                    log::warn!("HugePages alloc failed ({}), falling back to Vec", e);
                    // Caller gets a panic if we can't allocate — this shouldn't happen.
                    panic!("Cannot allocate scratchpad: {}", e);
                }
            }
        }
        let hp = opt.as_mut().unwrap();
        f(hp.as_mut_slice())
    })
}

/// Check if the current thread's scratchpad is using huge pages.
pub fn current_thread_has_huge_pages() -> bool {
    HP_SCRATCHPAD.with(|cell| {
        cell.borrow().as_ref().map(|hp| hp.is_huge_pages()).unwrap_or(false)
    })
}

/// Get a human-readable memory status line for the miner banner.
///
/// Example output:
/// - "HUGE PAGES 2048 KiB + mlock (64 KiB scratchpad)"
/// - "mmap 16K pages + mlock (64 KiB scratchpad)"
/// - "mmap regular (64 KiB scratchpad)"
pub fn memory_status_line(scratchpad_size: usize) -> String {
    let info = is_huge_pages_available();

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let platform_note = "Apple Silicon 16K native pages";
    #[cfg(all(target_os = "macos", not(target_arch = "aarch64")))]
    let platform_note = "macOS x86_64 superpages";
    #[cfg(target_os = "linux")]
    let platform_note = if info.available {
        "Linux HugePages enabled"
    } else {
        "Linux (enable hugepages: sysctl vm.nr_hugepages=128)"
    };
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    let platform_note = "standard pages";

    format!(
        "{} KiB scratchpad | {} KiB pages | {} | {}",
        scratchpad_size / 1024,
        info.page_size / 1024,
        if info.available { "HUGEPAGES ready" } else { "mmap fallback" },
        platform_note,
    )
}
