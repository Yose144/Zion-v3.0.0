fn main() {
    // Tell the linker where OpenCL.lib lives.
    // We generate it from OpenCL.dll using gen_opencl_lib.ps1 → C:\OCL_SDK\
    println!("cargo:rustc-link-search=native=C:\\OCL_SDK");
    println!("cargo:rustc-link-lib=OpenCL");
}
