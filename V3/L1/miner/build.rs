fn main() {
    #[cfg(feature = "gpu")]
    {
        // Provide OpenCL.lib location for linking on Windows
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let workspace_target = std::path::Path::new(&manifest_dir)
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("target"))
            .unwrap();
        println!("cargo:rustc-link-search=native={}", workspace_target.display());
    }

    #[cfg(feature = "gpu-metal")]
    {
        println!("cargo:rustc-link-lib=framework=Metal");
        println!("cargo:rustc-link-lib=framework=CoreGraphics");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }
}
