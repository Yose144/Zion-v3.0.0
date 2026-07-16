// build.rs — compile native C algorithm libraries based on feature flags.
//
// Each algorithm is an independent cc::Build unit so they can be selectively
// included/excluded at cargo feature resolution time.  Missing a feature never
// prevents baseline miner compilation.
//
// NOTE: #[cfg(feature = "...")] does NOT work in build.rs.
//       Feature presence is checked via CARGO_FEATURE_<NAME> env vars.

use std::env;
use std::path::PathBuf;

fn feat(name: &str) -> bool {
    let key = format!("CARGO_FEATURE_{}", name.to_uppercase().replace('-', "_"));
    env::var(&key).is_ok()
}

/// On Windows MSVC, cc-rs may not find the Windows SDK / VC include paths when
/// invoked from a plain terminal (not a VS Developer Command Prompt).
/// Detect and add them explicitly so C standard headers are resolved.
fn add_msvc_includes(b: &mut cc::Build) {
    // 1. VCToolsInstallDir env var (set by vcvarsall.bat / developer prompt)
    if let Ok(v) = env::var("VCToolsInstallDir") {
        let inc = PathBuf::from(&v).join("include");
        if inc.exists() {
            b.include(&inc);
        }
    }

    // 2. Walk known VS installation roots (VS 2022 + VS 2026)
    let roots: &[&str] = &[
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
    b.include("csrc/compat");
    b.flag_if_supported("/FIzion_time_compat.h");
}

// ─────────────────────────────────────────────────────────────────────────
// CPU baseline control (XMRig-style)
//
// ZION_CPU_TARGET env var controls the C/C++ compilation target:
//   - "native"    (default): use -march=native (optimal for the build machine)
//   - "x86-64"  : baseline x86-64 (portable, for distribution / SMOS rigs)
//   - "x86-64-v2":  SSE4.2 + POPCNT (most modern CPUs, 2009+)
//   - "x86-64-v3":  AVX2 + BMI1/2 + FMA (2013+ Intel Haswell, 2015+ AMD Zen)
//   - any other  : passed directly as -march=<value>
//
// When ZION_CPU_TARGET is NOT "native", AVX2/BMI2 flags are NOT applied
// globally — only to specific files that have runtime dispatch (like
// RandomX argon2_avx2.c). This prevents SIGILL on CPUs like Pentium G4560
// (Kaby Lake, has AES-NI + SSE4.2 but NOT AVX/BMI2).
//
// Additionally, ZION_CPU_NO_AVX=1 and ZION_CPU_NO_BMI2=1 can be set to
// selectively disable AVX or BMI2 even with ZION_CPU_TARGET=native.
// ─────────────────────────────────────────────────────────────────────────

fn cpu_target() -> String {
    env::var("ZION_CPU_TARGET").unwrap_or_else(|_| "native".to_string())
}

/// Returns true if we're building for a portable target (not native).
fn is_portable() -> bool {
    let t = cpu_target();
    t != "native" && !t.is_empty()
}

/// Returns true if AVX2 should be enabled globally.
fn enable_avx2() -> bool {
    if env::var("ZION_CPU_NO_AVX").is_ok() {
        return false;
    }
    if !is_portable() {
        return true; // native
    }
    // Portable: only enable for v3+ targets
    let t = cpu_target();
    t == "x86-64-v3" || t == "x86-64-v4"
}

/// Returns true if BMI2 should be enabled globally.
fn enable_bmi2() -> bool {
    if env::var("ZION_CPU_NO_BMI2").is_ok() {
        return false;
    }
    if is_portable() {
        // Only enable for v3+ targets
        let t = cpu_target();
        return t == "x86-64-v3" || t == "x86-64-v4";
    }
    true // native
}

/// Apply the CPU baseline march flag to a cc::Build.
fn apply_cpu_baseline(b: &mut cc::Build, is_msvc: bool) {
    if is_msvc {
        return;
    }
    let target = cpu_target();
    if target == "native" {
        b.flag_if_supported("-march=native");
    } else if !target.is_empty() {
        // Use -march=<target> for portable builds
        let flag = format!("-march={}", target);
        b.flag_if_supported(&flag);
    }
}

/// Apply flags shared across all plain-C algorithm builds.
fn base_build(src: &str, lib: &str, target_os: &str, is_msvc: bool) {
    let mut b = cc::Build::new();
    b.file(src)
        .opt_level(3)
        .warnings(false)
        .cargo_warnings(false);

    if !is_msvc {
        b.flag_if_supported("-fPIC");
        b.flag_if_supported("-funroll-loops");
        b.flag_if_supported("-fomit-frame-pointer");
        apply_cpu_baseline(&mut b, is_msvc);
        if target_os == "linux" {
            b.define("_POSIX_C_SOURCE", "200112L");
        }
    } else {
        b.flag_if_supported("/std:c11");
        add_msvc_includes(&mut b);
    }
    b.compile(lib);
}

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    let is_msvc = env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default() == "msvc";

    // Log the CPU target for debugging
    println!(
        "cargo:warning=ZION native-ffi build: target={}, portable={}, avx2={}, bmi2={}",
        cpu_target(),
        is_portable(),
        enable_avx2(),
        enable_bmi2()
    );

    // -----------------------------------------------------------------------
    // Etchash / Ethash  (ETC, ETCPoW)
    // -----------------------------------------------------------------------
    if feat("native-etchash") {
        let mut b = cc::Build::new();
        b.file("csrc/etchash/etchash_native.c")
            .opt_level(3)
            .warnings(false)
            .cargo_warnings(false);
        if !is_msvc {
            b.flag_if_supported("-fPIC");
            if target_os == "linux" {
                b.define("_POSIX_C_SOURCE", "200112L");
            }
        } else {
            b.flag_if_supported("/std:c11");
            add_msvc_includes(&mut b);
        }
        b.compile("etchash_zion");
        if target_os == "linux" {
            println!("cargo:rustc-link-lib=m");
        }
    }

    // -----------------------------------------------------------------------
    // KawPow  (RVN, CLORE)
    // -----------------------------------------------------------------------
    if feat("native-kawpow") {
        base_build(
            "csrc/kawpow/kawpow_native.c",
            "kawpow_zion",
            &target_os,
            is_msvc,
        );
    }

    // -----------------------------------------------------------------------
    // Autolykos v2  (ERG)
    // -----------------------------------------------------------------------
    if feat("native-autolykos") {
        base_build(
            "csrc/autolykos/autolykos_native.c",
            "autolykos_zion",
            &target_os,
            is_msvc,
        );
    }

    // -----------------------------------------------------------------------
    // kHeavyHash  (KAS)
    // -----------------------------------------------------------------------
    if feat("native-kheavyhash") {
        base_build(
            "csrc/kheavyhash/kheavyhash_native.c",
            "kheavyhash_zion",
            &target_os,
            is_msvc,
        );
    }

    // -----------------------------------------------------------------------
    // Blake3  (ALPH, DCR)  — named blake3-algo to avoid clash with the
    //                         pure-Rust blake3 crate in the workspace
    // -----------------------------------------------------------------------
    if feat("native-blake3-algo") {
        base_build(
            "csrc/blake3/blake3_native.c",
            "blake3_algo_zion",
            &target_os,
            is_msvc,
        );
    }

    // -----------------------------------------------------------------------
    // Cosmic Harmony v3  (ZION)
    // -----------------------------------------------------------------------
    if feat("native-cosmic-harmony") {
        let mut b = cc::Build::new();
        b.file("csrc/cosmic_harmony/cosmic_harmony_v3_native.c")
            .opt_level(3)
            .warnings(false)
            .cargo_warnings(false);
        if !is_msvc {
            b.flag_if_supported("-fPIC");
            b.flag_if_supported("-funroll-loops");
            apply_cpu_baseline(&mut b, is_msvc);
            // Only enable AVX2 globally if the target supports it
            if target_arch == "x86_64" && enable_avx2() {
                b.flag_if_supported("-mavx2");
            }
            if target_os == "linux" {
                b.define("_POSIX_C_SOURCE", "200112L");
            }
        } else {
            b.flag_if_supported("/std:c11");
            if enable_avx2() {
                b.flag_if_supported("/arch:AVX2");
            }
            add_msvc_includes(&mut b);
        }
        b.compile("cosmic_harmony_zion");
    }

    // -----------------------------------------------------------------------
    // VerusHash v2.2  (VRSC)
    //   Production: Haraka + CLHash pipeline from VerusCoin upstream.
    //   Sources in csrc/verushash/real/ (downloaded from VerusCoin GitHub).
    //   Falls back to portable stub if real sources are not present.
    // -----------------------------------------------------------------------
    if feat("native-verushash") {
        let real_dir = "csrc/verushash/real";
        let has_real = std::path::Path::new(real_dir).join("verus_hash.cpp").exists();

        if has_real {
            // --- Production build: compile real VerusHash C++ sources ---
            // 1. Compile pure-C sources (haraka)
            let mut c_build = cc::Build::new();
            c_build
                .file("csrc/verushash/real/haraka.c")
                .file("csrc/verushash/real/haraka_portable.c")
                .include("csrc/verushash/real")
                .opt_level(3)
                .warnings(false)
                .cargo_warnings(false)
                .flag_if_supported("-funroll-loops")
                .flag_if_supported("-fomit-frame-pointer")
                .flag_if_supported("-fPIC");
            if !is_msvc {
                apply_cpu_baseline(&mut c_build, is_msvc);
                if target_arch == "x86_64" {
                    // Haraka needs PCLMUL + AES-NI + SSE4 — these are baseline
                    // on all x86-64 CPUs from ~2008+ (including Pentium G4560).
                    // AVX/BMI2 are NOT required and cause SIGILL on older CPUs.
                    c_build
                        .flag_if_supported("-mpclmul")
                        .flag_if_supported("-msse4")
                        .flag_if_supported("-msse4.1")
                        .flag_if_supported("-msse4.2")
                        .flag_if_supported("-mssse3")
                        .flag_if_supported("-maes");
                    // Only enable AVX/BMI2 if the target supports them
                    if enable_avx2() {
                        c_build
                            .flag_if_supported("-mavx")
                            .flag_if_supported("-mavx2");
                    }
                    if enable_bmi2() {
                        c_build
                            .flag_if_supported("-mbmi")
                            .flag_if_supported("-mbmi2");
                    }
                } else if target_arch == "aarch64" {
                    c_build
                        .flag_if_supported("-march=armv8-a+crypto")
                        .flag_if_supported("-flax-vector-conversions");
                    c_build.define("__ARM_NEON", None);
                }
            } else {
                add_msvc_includes(&mut c_build);
            }
            c_build.compile("verushash_c");

            // 2. Compile C++ sources (verus_hash, verus_clhash, ffi_wrapper)
            //    Also compile haraka C sources here so all symbols are in one archive.
            let mut cpp_build = cc::Build::new();
            cpp_build
                .cpp(true)
                .file("csrc/verushash/real/haraka.c")
                .file("csrc/verushash/real/haraka_portable.c")
                .file("csrc/verushash/real/verus_hash.cpp")
                .file("csrc/verushash/real/verus_clhash.cpp")
                .file("csrc/verushash/real/verus_clhash_portable.cpp")
                .file("csrc/verushash/real/ffi_wrapper_v3.cpp")
                .include("csrc/verushash/real")
                .opt_level(3)
                .warnings(false)
                .cargo_warnings(false)
                .flag_if_supported("-std=c++17")
                .flag_if_supported("-funroll-loops")
                .flag_if_supported("-fomit-frame-pointer")
                .flag_if_supported("-fPIC");
            if !is_msvc {
                apply_cpu_baseline(&mut cpp_build, is_msvc);
                if target_arch == "x86_64" {
                    // Same as C build: PCLMUL + AES + SSE4 are baseline.
                    // AVX/BMI2 only when target supports them.
                    cpp_build
                        .flag_if_supported("-mpclmul")
                        .flag_if_supported("-msse4")
                        .flag_if_supported("-msse4.1")
                        .flag_if_supported("-msse4.2")
                        .flag_if_supported("-mssse3")
                        .flag_if_supported("-maes");
                    if enable_avx2() {
                        cpp_build
                            .flag_if_supported("-mavx")
                            .flag_if_supported("-mavx2");
                    }
                    if enable_bmi2() {
                        cpp_build
                            .flag_if_supported("-mbmi")
                            .flag_if_supported("-mbmi2");
                    }
                } else if target_arch == "aarch64" {
                    cpp_build
                        .flag_if_supported("-march=armv8-a+crypto")
                        .flag_if_supported("-flax-vector-conversions");
                    cpp_build.define("__ARM_NEON", None);
                }
                if target_os == "macos" {
                    cpp_build.flag_if_supported("-stdlib=libc++");
                }
            } else {
                add_msvc_includes(&mut cpp_build);
            }
            cpp_build.compile("verushash_cpp");

            // 3. Link C++ stdlib + force re-link C archive for unresolved symbols
            if target_os == "macos" {
                println!("cargo:rustc-link-lib=c++");
            } else if !is_msvc {
                println!("cargo:rustc-link-lib=stdc++");
            }
            let out_dir = env::var("OUT_DIR").unwrap_or_default();
            if !out_dir.is_empty() {
                println!("cargo:rustc-link-search=native={}", out_dir);
                println!("cargo:rustc-link-lib=static=verushash_c");
            }
            println!("cargo:rerun-if-changed=csrc/verushash/real/");
        } else {
            // --- Fallback: portable stub (Keccak-256 placeholder) ---
            base_build(
                "csrc/verushash/verushash_portable.c",
                "verushash_zion",
                &target_os,
                is_msvc,
            );
        }
    }

    // -----------------------------------------------------------------------
    // RandomX  (XMR, ZEPH)
    //   Real tevador/RandomX C++ library + ZION wrapper.
    //   Source: csrc/randomx/randomx_src/ (cloned from github.com/tevador/RandomX)
    // -----------------------------------------------------------------------
    if feat("native-randomx") {
        build_randomx(&target_os, is_msvc);
    }
}

/// Build the real tevador/RandomX C++ library + ZION wrapper.
///
/// RandomX is C++ (not C), so we use `.cpp(true)` and compile all .cpp
/// source files from the randomx_src/src/ directory plus our wrapper.
fn build_randomx(target_os: &str, is_msvc: bool) {
    let rx_dir = "csrc/randomx/randomx_src/src";

    // Core RandomX C++ source files (common to all platforms)
    let mut core_sources = vec![
        "aes_hash.cpp",
        "allocator.cpp",
        "blake2_generator.cpp",
        "bytecode_machine.cpp",
        "cpu.cpp",
        "dataset.cpp",
        "instruction.cpp",
        "instructions_portable.cpp",
        "randomx.cpp",
        "soft_aes.cpp",
        "superscalar.cpp",
        "virtual_machine.cpp",
        "vm_interpreted.cpp",
        "vm_interpreted_light.cpp",
    ];

    // Argon2 (C sources, used for cache initialization)
    let argon2_sources = [
        "argon2_core.c",
        "argon2_ref.c",
        "argon2_avx2.c",
        "argon2_ssse3.c",
        "blake2/blake2b.c",
        // Virtual memory management (provides allocMemoryPages, setPagesRW, etc.)
        "virtual_memory.c",
        // Reciprocal calculation (provides randomx_reciprocal)
        "reciprocal.c",
    ];

    // Architecture-specific JIT compiler and assembly generator
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    if target_arch == "aarch64" {
        core_sources.push("jit_compiler_a64.cpp");
    } else {
        core_sources.push("assembly_generator_x86.cpp");
        core_sources.push("jit_compiler_x86.cpp");
    }
    // VM compiled (JIT) — needed for all architectures
    core_sources.push("vm_compiled.cpp");
    core_sources.push("vm_compiled_light.cpp");

    let mut b = cc::Build::new();
    b.cpp(true)
        .opt_level(3)
        .warnings(false)
        .cargo_warnings(false)
        .include("csrc/randomx/randomx_src/src")
        .include("csrc/randomx/randomx_src/src/asm");

    // Add all core source files
    for src in &core_sources {
        let path = format!("{}/{}", rx_dir, src);
        if std::path::Path::new(&path).exists() {
            b.file(&path);
        } else {
            println!("cargo:warning=RandomX source not found: {}", path);
        }
    }

    // Add Argon2 C source files
    for src in &argon2_sources {
        let path = format!("{}/{}", rx_dir, src);
        if std::path::Path::new(&path).exists() {
            b.file(&path);
        }
    }

    // Add our wrapper
    b.file("csrc/randomx/randomx_wrapper.cpp");

    // ARM64: add assembly file for dataset item calculation
    if target_arch == "aarch64" {
        let asm_path = format!("{}/jit_compiler_a64_static.S", rx_dir);
        if std::path::Path::new(&asm_path).exists() {
            b.file(&asm_path);
        }
    } else if target_arch == "x86_64" {
        // x86_64: add GNU assembler static code for the x86 JIT compiler
        let asm_path = format!("{}/jit_compiler_x86_static.S", rx_dir);
        if std::path::Path::new(&asm_path).exists() {
            b.file(&asm_path);
        }
    }

    // Platform-specific flags
    if !is_msvc {
        b.flag_if_supported("-fPIC");
        b.flag_if_supported("-std=c++17");
        b.flag_if_supported("-funroll-loops");
        b.flag_if_supported("-fomit-frame-pointer");
        apply_cpu_baseline(&mut b, is_msvc);

        // ARM64: enable hardware AES (ARMv8 Crypto Extensions)
        // Apple M1 supports ARMv8.0-A with AES extensions.
        // This defines __ARM_FEATURE_CRYPTO which activates vaeseq_u8/vaesmcq_u8
        // in intrin_portable.h, giving ~10x AES throughput vs soft AES.
        if target_arch == "aarch64" {
            // Try -march=armv8-a+crypto first (works on Linux + macOS)
            // On Apple Silicon, -march may not work, so also try -mcpu=apple-m1
            b.flag_if_supported("-march=armv8-a+crypto");
            b.flag_if_supported("-mcpu=apple-m1");
        } else if target_arch == "x86_64" {
            // x86_64 baseline: AES-NI + SSE4.2 (supported by all x86-64 CPUs
            // from ~2008+, including Pentium G4560).
            //   -maes        → AES-NI instructions (aesenc/aesdec) → hard_aes=yes
            //                  Without this, RandomX falls back to soft AES (~10x slower)
            //   -msse4.2     → SSE4.2 (required by RandomX for _mm_crc32_u64)
            // AVX2/BMI2 are only enabled when the target supports them.
            // argon2_avx2.c is compiled separately with AVX2 (see below).
            b.flag_if_supported("-maes");
            b.flag_if_supported("-msse4.2");
            if enable_avx2() {
                b.flag_if_supported("-mavx");
                b.flag_if_supported("-mavx2");
            }
            if enable_bmi2() {
                b.flag_if_supported("-mbmi");
                b.flag_if_supported("-mbmi2");
            }
        }
    } else {
        b.flag_if_supported("/std:c++17");
        add_msvc_includes(&mut b);
    }

    // ── XMRig-style: compile argon2 AVX2/SSSE3 sources separately ──
    // These files use AVX2/SSSE3 intrinsics and must be compiled with
    // the corresponding flags. They are only included if the target
    // supports AVX2. RandomX does runtime dispatch via function pointers.
    if target_arch == "x86_64" && !is_msvc && enable_avx2() {
        // argon2_avx2.c — compiled with -mavx2
        let mut avx2_build = cc::Build::new();
        avx2_build
            .file(&format!("{}/argon2_avx2.c", rx_dir))
            .include("csrc/randomx/randomx_src/src")
            .opt_level(3)
            .warnings(false)
            .cargo_warnings(false)
            .flag_if_supported("-fPIC")
            .flag_if_supported("-std=c++17")
            .flag_if_supported("-mavx2")
            .flag_if_supported("-maes");
        avx2_build.compile("randomx_argon2_avx2");

        // argon2_ssse3.c — compiled with -mssse3
        let mut ssse3_build = cc::Build::new();
        ssse3_build
            .file(&format!("{}/argon2_ssse3.c", rx_dir))
            .include("csrc/randomx/randomx_src/src")
            .opt_level(3)
            .warnings(false)
            .cargo_warnings(false)
            .flag_if_supported("-fPIC")
            .flag_if_supported("-std=c++17")
            .flag_if_supported("-mssse3");
        ssse3_build.compile("randomx_argon2_ssse3");

        // Force-link these archives
        let out_dir = env::var("OUT_DIR").unwrap_or_default();
        if !out_dir.is_empty() {
            println!("cargo:rustc-link-search=native={}", out_dir);
            println!("cargo:rustc-link-lib=static=randomx_argon2_avx2");
            println!("cargo:rustc-link-lib=static=randomx_argon2_ssse3");
        }
    }

    b.compile("randomx_zion");

    // On macOS ARM64, force-load the entire static library to ensure
    // global constructors (from jit_compiler_a64.cpp) are included.
    // Without this, the linker strips global constructors from static
    // libraries, causing __GLOBAL__sub_I_* undefined symbol errors.
    if target_os == "macos" {
        let out_dir = env::var("OUT_DIR").unwrap_or_default();
        let lib_path = format!("{}/librandomx_zion.a", out_dir);
        println!("cargo:rustc-link-arg=-Wl,-force_load,{}", lib_path);
    }

    // Tell cargo to re-run if any RandomX source changes
    println!("cargo:rerun-if-changed=csrc/randomx/randomx_wrapper.cpp");
    println!("cargo:rerun-if-changed=csrc/randomx/randomx_src/src/randomx.h");
}
