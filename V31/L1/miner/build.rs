//! Build script for zion-miner (V31).
//!
//! Compiles C native hasher implementations when the `native-hashers` feature
//! is enabled. The C sources live in `csrc/` and are compiled into a static
//! library linked at build time.
//!
//! Also handles GPU backend linking (OpenCL, Metal) when those features are enabled.

/// On Windows MSVC, cc-rs may not find the Windows SDK / VC include paths when
/// invoked from a plain terminal (not a VS Developer Command Prompt).
/// Detect and add them explicitly so C standard headers are resolved.
/// Also adds the POSIX compat shim (clock_gettime etc.) for Windows.
fn add_msvc_includes(b: &mut cc::Build) {
    // 0. Define NOMINMAX globally — windows.h defines min/max macros that
    //    break std::numeric_limits<T>::max() in C++ code.
    b.define("NOMINMAX", None);

    // 1. VCToolsInstallDir env var (set by vcvarsall.bat / developer prompt)
    if let Ok(v) = std::env::var("VCToolsInstallDir") {
        let inc = std::path::PathBuf::from(&v).join("include");
        if inc.exists() {
            b.include(&inc);
        }
    }

    // 2. Walk known VS installation roots (VS 2022 + VS 2026 + VS 18)
    let roots: &[&str] = &[
        "C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\VC\\Tools\\MSVC",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Tools\\MSVC",
        "C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Tools\\MSVC",
        "D:\\VS2026\\VC\\Tools\\MSVC",
        "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC",
    ];
    for root in roots {
        if let Ok(entries) = std::fs::read_dir(root) {
            if let Some(latest) = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
                .max_by_key(|e| e.file_name())
            {
                let inc = latest.path().join("include");
                if inc.exists() {
                    b.include(&inc);
                    break;
                }
            }
        }
    }

    // 3. Windows SDK ucrt/um/shared headers
    let sdk_roots: &[&str] = &[
        "C:\\Program Files (x86)\\Windows Kits\\10\\Include",
        "C:\\Program Files\\Windows Kits\\10\\Include",
    ];
    for sdk_root in sdk_roots {
        if let Ok(entries) = std::fs::read_dir(sdk_root) {
            if let Some(latest) = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
                .max_by_key(|e| e.file_name())
            {
                for sub in &["ucrt", "um", "shared"] {
                    let p = latest.path().join(sub);
                    if p.exists() {
                        b.include(&p);
                    }
                }
                break;
            }
        }
    }

    // 4. Force-include the POSIX compat shim (provides clock_gettime etc.)
    //    The compat header lives in native-ffi/csrc/compat — use relative path
    //    from the miner crate root.
    let compat_dir = std::path::PathBuf::from("../native-ffi/csrc/compat");
    if compat_dir.exists() {
        b.include(&compat_dir);
        // Use flag() not flag_if_supported() — cc-rs's flag_if_supported
        // tests the flag with a dummy compilation that may not include the
        // compat dir, causing /FI to fail the support check.
        b.flag("/FIzion_time_compat.h");
    }
}

fn main() {
    let is_msvc = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default() == "msvc";

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

        // OpenMP for parallel DAG generation — disabled entirely.
        // DAG is generated on GPU; libomp is not always available
        // (macOS, minimal Docker containers). Can be re-enabled with
        // ZION_ENABLE_OPENMP=1 if needed for CPU-only DAG generation.
        let openmp_enabled = std::env::var("ZION_ENABLE_OPENMP").as_deref() == Ok("1");
        if openmp_enabled {
            build.flag_if_supported("-fopenmp");
        }

        // Windows MSVC: add include paths + POSIX compat shim
        if is_msvc {
            add_msvc_includes(&mut build);
            build.flag_if_supported("/utf-8");
        }

        // CPU baseline (XMRig-style): respect ZION_CPU_TARGET env var.
        {
            let cpu_target =
                std::env::var("ZION_CPU_TARGET").unwrap_or_else(|_| "x86-64".to_string());
            if !is_msvc {
                if cpu_target == "native" {
                    build.flag_if_supported("-march=native");
                } else if !cpu_target.is_empty() {
                    build.flag_if_supported(format!("-march={}", cpu_target));
                }
            }
            println!("cargo:warning=ZION miner build: cpu_target={}", cpu_target);
        }

        build.warnings(false).opt_level(3).compile("auxpow_native");

        let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
        if target_os == "linux" && openmp_enabled {
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
