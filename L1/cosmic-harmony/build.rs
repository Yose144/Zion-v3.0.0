//! Build script for native library compilation + linking
//!
//! Uses the `cc` crate to compile native C sources in-tree, so no pre-built
//! `.so`/`.dylib` files are required on Linux.  The compiled static archive is
//! linked automatically by cargo.
//!
//! Feature flags:
//!   cargo build --features native-ethash        # ethash only
//!   cargo build --features native-autolykos     # autolykos v2 only
//!   cargo build --features native-all           # all native algos

use std::path::PathBuf;

fn main() {
    let src_dir: PathBuf = std::env::current_dir()
        .unwrap()
        .parent()
        .unwrap()
        .join("native-libs")
        .join("all");

    println!("cargo:rerun-if-changed={}", src_dir.display());

    // -----------------------------------------------------------------------
    // Helper closure: compile a C source into a static archive via `cc` crate
    // -----------------------------------------------------------------------
    let compile = |lib_name: &str, c_file: &str| {
        let src = src_dir.join(c_file);
        if !src.exists() {
            eprintln!("cargo:warning=native source not found, skipping: {}", src.display());
            return;
        }
        let mut build = cc::Build::new();
        build
            .file(&src)
            .opt_level(3)
            .flag_if_supported("-fPIC")
            .flag_if_supported("-std=c99")
            .flag_if_supported("-march=native")
            .flag_if_supported("-Wno-unused-function");

        if !std::env::var("TARGET").unwrap_or_default().contains("windows") {
            build.define("LINUX", None);
        }

        build.compile(lib_name);
        // cc::Build::compile outputs a static archive; cargo links it automatically.
    };

    // -----------------------------------------------------------------------
    // Compile per feature flag
    // -----------------------------------------------------------------------

    if cfg!(feature = "native-ethash") {
        compile("ethash_zion", "ethash_native.c");
    }

    if cfg!(feature = "native-autolykos") {
        compile("autolykos_zion", "autolykos_v2_native.c");
    }

    if cfg!(feature = "native-kawpow") {
        compile("kawpow_zion", "kawpow_native.c");
    }

    if cfg!(feature = "native-kawpow-gpu") {
        compile("kawpow_gpu_zion", "kawpow_gpu_native.c");
    }

    if cfg!(feature = "native-kheavyhash") {
        compile("kheavyhash_zion", "kheavyhash_native.c");
    }

    if cfg!(feature = "native-equihash") {
        compile("equihash_zion", "equihash_native.c");
    }

    if cfg!(feature = "native-progpow") {
        compile("progpow_zion", "progpow_native.c");
    }

    if cfg!(feature = "native-argon2d") {
        compile("argon2d_zion", "argon2d_native.c");
    }

    if cfg!(feature = "native-blake3") {
        compile("blake3_zion", "blake3_native.c");
    }

    if cfg!(feature = "native-cosmic-harmony") {
        compile("cosmic_harmony_zion", "cosmic_harmony_v2_native.c");
    }

    // -----------------------------------------------------------------------
    // RandomX + Yescrypt: rely on pre-built .so (complex C++ deps)
    // -----------------------------------------------------------------------
    let lib_dir = src_dir.parent().unwrap();
    let link_dir = lib_dir.display().to_string();

    if cfg!(feature = "native-randomx") {
        println!("cargo:rustc-link-search=native={}", link_dir);
        println!("cargo:rustc-link-lib=randomx_zion");
    }

    if cfg!(feature = "native-yescrypt") {
        println!("cargo:rustc-link-search=native={}", link_dir);
        println!("cargo:rustc-link-lib=yescrypt_zion");
    }

    // Math library needed on Linux for several C sources (-lm)
    if cfg!(target_os = "linux") {
        println!("cargo:rustc-link-lib=m");
    }

    // OpenCL: on Windows, provide search path for the generated OpenCL.lib import library.
    // The library was generated from OpenCL.dll (installed by AMD/Intel/NVIDIA GPU drivers)
    // using MSVC lib.exe and a standard OpenCL exports DEF file.
    // Regenerate with: powershell -File make_opencl_lib.ps1 (in workspace root)
    if std::env::var("CARGO_FEATURE_GPU").is_ok() && cfg!(target_os = "windows") {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let opencl_sdk = PathBuf::from(&manifest_dir)
            .parent().unwrap()  // L1/
            .parent().unwrap()  // workspace root
            .join("opencl_sdk");
        if opencl_sdk.exists() {
            println!("cargo:rustc-link-search=native={}", opencl_sdk.display());
        } else {
            println!("cargo:warning=opencl_sdk/ not found — run make_opencl_lib.ps1 to generate OpenCL.lib for GPU builds on Windows.");
        }
        println!("cargo:rerun-if-changed=opencl_sdk/OpenCL.lib");
    }
}

