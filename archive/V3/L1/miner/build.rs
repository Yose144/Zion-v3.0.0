fn main() {
    #[cfg(feature = "gpu-opencl")]
    {
        // Provide OpenCL.lib location for linking on Windows
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let manifest_path = std::path::Path::new(&manifest_dir);

        // V3/target/ — primary location
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

        // V3/L1/native-libs/ — repo-bundled Windows import library (OpenCL.lib)
        if let Some(native_libs) = manifest_path
            .parent()
            .map(|p| p.join("native-libs"))
        {
            if native_libs.exists() {
                println!(
                    "cargo:rustc-link-search=native={}",
                    native_libs.display()
                );
            }
        }

        // opencl_sdk/ — repo-bundled SDK
        if let Some(opencl_sdk) = manifest_path
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .map(|p| p.join("opencl_sdk"))
        {
            if opencl_sdk.exists() {
                println!("cargo:rustc-link-search=native={}", opencl_sdk.display());
            }
        }

        // Ensure OpenCL is linked after all zion-auxpow objects on Linux.
        // cl-sys emits -lOpenCL early in the link line; zion-auxpow's object
        // files are placed later, causing undefined references on GNU/Linux.
        // Re-emitting the link lib from the final binary crate places it last.
        #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
        {
            println!("cargo:rustc-link-lib=OpenCL");
        }
    }

    #[cfg(feature = "gpu-metal")]
    {
        println!("cargo:rustc-link-lib=framework=Metal");
        println!("cargo:rustc-link-lib=framework=CoreGraphics");
        println!("cargo:rustc-link-lib=framework=Foundation");
    }
}
