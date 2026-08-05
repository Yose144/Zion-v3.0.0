fn main() {
    zion_native_ffi::verushash::init();
    let hps = zion_native_ffi::verushash::benchmark(500000);
    println!(
        "VerusHash v2.2 hashrate: {:.0} H/s ({:.2} kH/s)",
        hps,
        hps / 1000.0
    );
    let header = [0x07u8; 76];
    let h = zion_native_ffi::verushash::hash(&header, 42);
    println!("Sample hash: {:02x?}", &h[..8]);
    println!(
        "Version: {}",
        zion_native_ffi::verushash::version().unwrap()
    );
}
