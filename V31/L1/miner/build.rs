//! Build script for zion-miner (V31).
//!
//! Compiles C native hasher implementations when the `native-hashers` feature
//! is enabled. The C sources live in `csrc/` and are compiled into a static
//! library linked at build time.
//!
//! Also handles GPU backend linking (OpenCL, Metal) when those features are enabled.

fn main() {
    // ── Native C hashers (from AuXpow) ──
    if std::env::var("CARGO_FEATURE_NATIVE_HASHERS").is_ok() {
        let mut build = cc::Build::new();

        // When native-verushash is enabled, the real C++ VerusHash is provided
        // by the zion-native-ffi crate. Skip the portable stub to avoid
        // duplicate symbol errors.
        let has_native_verushash = std::env::var("CARGO_FEATURE_NATIVE_VERUSHASH").is_ok();

        let mut sources = vec![
            "csrc/blake3_native.c",
            "csrc/kheavyhash_native.c",
            "csrc/autolykos_native.c",
            "csrc/kawpow_native.c",
            "csrc/etchash_native.c",
        ];

        if !has_native_verushash {
            sources.push("csrc/verushash_portable.c");
        }

        for src in &sources {
            build.file(src);
        }

        // OpenMP for parallel DAG generation (see AuXpow build.rs for details).
        let openmp_disabled = std::env::var("ZION_DISABLE_OPENMP").as_deref() == Ok("1");
        let target_os_for_omp = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
        if target_os_for_omp == "macos" && !openmp_disabled {
            build.flag("-Xpreprocessor");
            build.flag("-fopenmp");
        }

        // CPU baseline (XMRig-style): respect ZION_CPU_TARGET env var.
        {
            let cpu_target =
                std::env::var("ZION_CPU_TARGET").unwrap_or_else(|_| "x86-64".to_string());
            if cpu_target == "native" {
                build.flag_if_supported("-march=native");
            } else if !cpu_target.is_empty() {
                build.flag_if_supported(format!("-march={}", cpu_target));
            }
            println!(
                "cargo:warning=ZION miner build: cpu_target={}",
                cpu_target
            );
        }

        build
            .warnings(false)
            .opt_level(3)
            .compile("auxpow_native");

        let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
        if target_os == "macos" && !openmp_disabled {
            println!("cargo:rustc-link-lib=omp");
        }

        for src in &sources {
            println!("cargo:rerun-if-changed={}", src);
        }
        println!("cargo:rerun-if-env-changed=ZION_DISABLE_OPENMP");
        println!("cargo:rerun-if-env-changed=ZION_CPU_TARGET");
    }

    // ── GPU OpenCL linking ──
    #[cfg(feature = "gpu-opencl")]
    {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let manifest_path = std::path::Path::new(&manifest_dir);

        // V31/target/ — primary location
        if let Some(workspace_target) = manifest_path
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("target"))
        {
            println!(
                "cargo:rustc-link-search=native={}",
                workspace_target.display()
            );
        }

        // Ensure OpenCL is linked after all miner objects on Linux.
        #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
        {
            println!("cargo:rustc-link-lib=OpenCL");
        }
    }

    // ── GPU Metal linking (macOS) ──
    #[cfg(feature = "gpu-metal")]
    {
        println!("cargo:rustc-link-lib=framework=Metal");
        println!("cargo:rustc-link-lib=framework=CoreGraphics");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }

    println!("cargo:rerun-if-changed=build.rs");
}
