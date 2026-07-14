//! Build script for zion-auxpow.
//!
//! Compiles C native hasher implementations when the `native-hashers` feature
//! is enabled.  The C sources live in `csrc/` and are compiled into a static
//! library linked at build time.

fn main() {
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

        // Enable OpenMP for parallel DAG generation on Linux/macOS.
        // The Ethash/ProgPow DAG generation loop in etchash_native.c uses
        // `#pragma omp parallel for` to distribute node computation across
        // all CPU cores, reducing epoch-120 DAG generation from ~3 minutes
        // (single-threaded) to ~15-20 seconds on a 12-core box.
        // On Windows, MSVC requires /openmp instead.
        #[cfg(target_os = "linux")]
        {
            build.flag("-fopenmp");
        }
        #[cfg(target_os = "macos")]
        {
            // Apple clang supports -Xpreprocessor -fopenmp + -lomp
            build.flag("-Xpreprocessor");
            build.flag("-fopenmp");
        }

        build
            .warnings(false) // C code may have unused-parameter warnings
            .opt_level(3)
            .compile("auxpow_native");

        // Link OpenMP runtime library (libgomp on Linux).
        #[cfg(target_os = "linux")]
        {
            println!("cargo:rustc-link-lib=gomp");
        }

        // Tell cargo to rerun if any C source changes
        for src in &sources {
            println!("cargo:rerun-if-changed={}", src);
        }
    }

    println!("cargo:rerun-if-changed=build.rs");
}
