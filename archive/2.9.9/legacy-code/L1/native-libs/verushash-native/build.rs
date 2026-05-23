use std::env;
use std::path::PathBuf;

fn main() {
    let csrc = PathBuf::from("csrc");
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let is_msvc = env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default() == "msvc";

    // Verify the C sources exist (download_sources.sh must have been run)
    if !csrc.join("verus_hash.cpp").exists() {
        panic!(
            "\n\n\
             ========================================================\n\
             ERROR: VerusCoin C sources not found in csrc/\n\
             \n\
             Please run the download script first:\n\
             \n\
             cd native-libs/verushash-native && bash download_sources.sh\n\
             \n\
             This will fetch the required files from GitHub.\n\
             ========================================================"
        );
    }

    // ---------------------------------------------------------------
    // Build strategy: compile C and C++ files separately (to respect
    // C vs C++ linkage), but merge all object files into ONE static
    // library so the linker sees all symbols in a single archive.
    // ---------------------------------------------------------------

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    // 1. Compile pure-C sources into object files
    let mut c_build = cc::Build::new();
    c_build
        .file(csrc.join("haraka.c"))
        .file(csrc.join("haraka_portable.c"))
        .include(&csrc)
        .opt_level(3)
        .flag_if_supported("-funroll-loops")
        .flag_if_supported("-fomit-frame-pointer")
        .flag_if_supported("-fPIC")
        .warnings(false);
    apply_arch_flags(&mut c_build, &target_arch, &target_os, is_msvc);
    // On MSVC Windows: cc-rs may not auto-detect Windows SDK include paths.
    // Explicitly add MSVC + Windows SDK (ucrt/um) include dirs if they exist.
    if is_msvc {
        add_msvc_includes(&mut c_build);
    }
    c_build.cargo_warnings(false);
    c_build.compile("verushash_c");

    // 2. Compile C++ sources into object files
    let mut cpp_build = cc::Build::new();
    cpp_build
        .cpp(true)
        .file(csrc.join("verus_hash.cpp"))
        .file(csrc.join("verus_clhash.cpp"))
        .file(csrc.join("verus_clhash_portable.cpp"))
        .file(csrc.join("ffi_wrapper.cpp"))
        .include(&csrc)
        .opt_level(3)
        .flag_if_supported("-std=c++17")
        .flag_if_supported("-funroll-loops")
        .flag_if_supported("-fomit-frame-pointer")
        .flag_if_supported("-fPIC")
        .warnings(false);
    apply_arch_flags(&mut cpp_build, &target_arch, &target_os, is_msvc);
    if is_msvc {
        add_msvc_includes(&mut cpp_build);
    }
    if target_os == "macos" {
        cpp_build.flag_if_supported("-stdlib=libc++");
    }
    cpp_build.cargo_warnings(false);
    cpp_build.compile("verushash_cpp");

    // 3. Tell Cargo to link both static libs AND the C++ runtime.
    //    cc::Build::compile() already emits the link-lib directives,
    //    but we need the C++ stdlib explicitly.
    //    On MSVC, the CRT is linked automatically — no extra flag needed.
    if target_os == "macos" {
        println!("cargo:rustc-link-lib=c++");
    } else if !is_msvc {
        println!("cargo:rustc-link-lib=stdc++");
    }

    // Force re-link of verushash_c for unresolved symbols in verushash_cpp.
    // On Linux with --as-needed, the order matters. The native-lib search
    // path includes OUT_DIR already.
    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static=verushash_c");

    // Rebuild if any C source changes
    println!("cargo:rerun-if-changed=csrc/");
}

/// Apply architecture-specific compiler flags
fn apply_arch_flags(build: &mut cc::Build, arch: &str, _os: &str, is_msvc: bool) {
    if is_msvc {
        // MSVC on x86_64: AES/SSE intrinsics available without extra flags.
        // GCC-style flags (-mpclmul etc.) are not valid for cl.exe.
        return;
    }
    match arch {
        "aarch64" => {
            // ARM64 — need crypto extensions for AES-NI equivalent
            // Use armv8-a (not armv8.1-a) for broader compatibility (e.g. Apple M1)
            // On macOS/Apple Silicon, -march=armv8-a+crypto may not be needed,
            // the compiler enables crypto by default, but the flag is harmless.
            build
                .flag_if_supported("-march=armv8-a+crypto")
                .flag_if_supported("-flax-vector-conversions");
            // Define so our compat header knows we are on ARM
            build.define("__ARM_NEON", None);
        }
        "x86_64" => {
            // x86_64 — need SSE4 + AES-NI + PCLMUL for haraka / clhash
            build
                .flag_if_supported("-mpclmul")
                .flag_if_supported("-msse4")
                .flag_if_supported("-msse4.1")
                .flag_if_supported("-msse4.2")
                .flag_if_supported("-mssse3")
                .flag_if_supported("-maes");
        }
        other => {
            eprintln!(
                "cargo:warning=verushash-native: unsupported target arch '{}', \
                 falling back to portable build",
                other
            );
            build.flag_if_supported("-march=native");
        }
    }
}

/// On Windows MSVC builds, cc-rs may not find the Windows SDK include paths
/// automatically. Detect and add them explicitly so C standard headers
/// (stdio.h, stdlib.h) and MSVC intrinsics (immintrin.h) are resolved.
fn add_msvc_includes(build: &mut cc::Build) {
    // MSVC runtime headers
    let msvc_base = "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC";
    if let Ok(entries) = std::fs::read_dir(msvc_base) {
        if let Some(latest) = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .max_by_key(|e| e.file_name())
        {
            let inc = latest.path().join("include");
            if inc.exists() {
                build.include(&inc);
            }
        }
    }
    // Windows SDK (ucrt contains stdio.h / stdlib.h etc.)
    let sdk_base = "C:\\Program Files (x86)\\Windows Kits\\10\\Include";
    if let Ok(entries) = std::fs::read_dir(sdk_base) {
        if let Some(latest) = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .max_by_key(|e| e.file_name())
        {
            let ucrt = latest.path().join("ucrt");
            let um = latest.path().join("um");
            let shared = latest.path().join("shared");
            if ucrt.exists() { build.include(&ucrt); }
            if um.exists() { build.include(&um); }
            if shared.exists() { build.include(&shared); }
        }
    }
}
