// This example requires the `native-verushash` feature, which is only
// available on x86_64 Linux with the VerusHash native kernel compiled.
// Run with: cargo run --example verus_bench --features native-verushash

#[cfg(feature = "native-verushash")]
fn main() {
    zion_native_ffi::verushash::init();
    let hps = zion_native_ffi::verushash::benchmark(500000);
    println!("VerusHash v2.2 hashrate: {:.0} H/s ({:.2} kH/s)", hps, hps / 1000.0);
    let header = [0x07u8; 76];
    let h = zion_native_ffi::verushash::hash(&header, 42);
    println!("Sample hash: {:02x?}", &h[..8]);
    println!("Version: {}", zion_native_ffi::verushash::version().unwrap());
}

#[cfg(not(feature = "native-verushash"))]
fn main() {
    eprintln!("verus_bench requires the `native-verushash` feature (x86_64 Linux only).");
    eprintln!("Run with: cargo run --example verus_bench --features native-verushash");
}
