//! Build script for zion-auxpow.
//!
//! Compiles C native hasher implementations when the `native-hashers` feature
//! is enabled.  The C sources live in `csrc/` and are compiled into a static
//! library linked at build time.

fn main() {
    // Declare check-cfg for the has_autolykos_c cfg flag set below.
    println!("cargo::rustc-check-cfg=cfg(has_autolykos_c)");

    // Only compile C sources when the feature is explicitly enabled.
    // The pure-Rust hashers in `external_hashers.rs` are always available
    // as the default path.
    if std::env::var("CARGO_FEATURE_NATIVE_HASHERS").is_ok() {
        let mut build = cc::Build::new();

        // When native-verushash is enabled, the real C++ VerusHash is provided
        // by the zion-native-ffi crate.  Skip the portable stub to avoid
        // duplicate symbol errors.
        let has_native_verushash = std::env::var("CARGO_FEATURE_NATIVE_VERUSHASH").is_ok();

        let mut sources = vec![
            "csrc/blake3_native.c",
            "csrc/kheavyhash_native.c",
            // autolykos_native.c temporarily excluded on Windows MSVC builds
            // due to cl.exe crash (VS 2026 access violation).  The pure-Rust
            // Autolykos hasher in external_hashers.rs is used instead.
            "csrc/kawpow_native.c",
            "csrc/etchash_native.c",
        ];

        // Only include autolykos_native.c on non-Windows or when explicitly
        // requested via ZION_BUILD_AUTOLYKOS_C=1.
        let target = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
        let force_autolykos = std::env::var("ZION_BUILD_AUTOLYKOS_C").as_deref() == Ok("1");
        let has_autolykos_c = target != "windows" || force_autolykos;
        if has_autolykos_c {
            sources.push("csrc/autolykos_native.c");
            // Tell the Rust code that the C autolykos implementation is available.
            println!("cargo:rustc-cfg=has_autolykos_c");
        }

        if !has_native_verushash {
            sources.push("csrc/verushash_portable.c");
        }

        for src in &sources {
            build.file(src);
        }

        // MSVC's cl.exe crashes on UTF-8 multi-byte characters in source
        // files (em-dashes, arrows in comments) without the /utf-8 flag.
        // Add it for MSVC targets to prevent STATUS_ACCESS_VIOLATION crashes.
        let target = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
        if target == "windows" {
            build.flag("/utf-8");
        }

        // Enable OpenMP for parallel DAG generation on Linux/macOS.
        // The Ethash/ProgPow DAG generation loop in etchash_native.c uses
        // `#pragma omp parallel for` to distribute node computation across
        // all CPU cores, reducing epoch-120 DAG generation from ~3 minutes
        // (single-threaded) to ~15-20 seconds on a 12-core box.
        // On Windows, MSVC requires /openmp instead.
        // NOTE: OpenMP disabled for cross-compilation to older CPUs (Pentium G4560)
        // because libgomp may contain AVX instructions that cause SIGILL.
        // The DAG generation falls back to single-threaded (still works, just slower).
        // OpenMP can be disabled via ZION_DISABLE_OPENMP=1 for cross-compiles
        // where a matching libomp is not available (e.g. x86_64-apple-darwin
        // cross-compile from Apple Silicon without an x86_64 libomp).
        // The DAG generation falls back to single-threaded (still works).
        let openmp_disabled = std::env::var("ZION_DISABLE_OPENMP").as_deref() == Ok("1");
        // Use CARGO_CFG_TARGET_OS for cross-compilation awareness.
        let target_os_for_omp = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
        if target_os_for_omp == "macos" && !openmp_disabled {
            // Apple clang supports -Xpreprocessor -fopenmp + -lomp
            build.flag("-Xpreprocessor");
            build.flag("-fopenmp");
        }

        // Apply CPU baseline (XMRig-style): respect ZION_CPU_TARGET env var.
        // Default is "x86-64" (baseline SSE2) for portable distribution builds.
        // This prevents SIGILL on older CPUs (e.g. Intel Pentium G4560/G5420
        // which have AES-NI + SSE4.2 but NOT AVX/BMI2).
        // Users who want maximum performance on their own machine can set
        // ZION_CPU_TARGET=native for a local build.
        // The flag is applied via flag_if_supported to avoid errors on
        // compilers that don't understand -march.
        // NOTE: Must be called BEFORE compile() — flags added after compile()
        // have no effect (cc::Build::compile consumes the builder).
        {
            let cpu_target =
                std::env::var("ZION_CPU_TARGET").unwrap_or_else(|_| "x86-64".to_string());
            if cpu_target == "native" {
                build.flag_if_supported("-march=native");
            } else if !cpu_target.is_empty() {
                build.flag_if_supported(&format!("-march={}", cpu_target));
            }
            println!("cargo:warning=ZION AuXpow build: cpu_target={}", cpu_target);
        }

        build
            .warnings(false) // C code may have unused-parameter warnings
            .opt_level(3)
            .compile("auxpow_native");

        // Link OpenMP runtime library (libgomp on Linux).
        // NOTE: Disabled on Linux to avoid SIGILL on CPUs without AVX.
        // IMPORTANT: Use CARGO_CFG_TARGET_OS (cross-compilation aware)
        // instead of #[cfg(target_os = "macos")] which evaluates the HOST
        // OS, not the TARGET OS — causing -lomp to be linked on Windows
        // when cross-compiling from macOS.
        let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
        if target_os == "macos" && !openmp_disabled {
            println!("cargo:rustc-link-lib=omp");
        }

        // Tell cargo to rerun if any C source or environment-controlled settings change
        for src in &sources {
            println!("cargo:rerun-if-changed={}", src);
        }
        println!("cargo:rerun-if-env-changed=ZION_DISABLE_OPENMP");
        println!("cargo:rerun-if-env-changed=ZION_CPU_TARGET");
    }

    println!("cargo:rerun-if-changed=build.rs");
}
