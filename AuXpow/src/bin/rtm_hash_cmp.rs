// RTM SPH Test — GPU vs CPU
// Tests each of the 15 SPH hash functions individually.
//
// Usage: cargo run --features gpu-opencl --bin rtm_hash_cmp

use zion_auxpow::gpu_miner::GpuMiner;
use zion_auxpow::gpu_backend::GpuBackend;

const ALGO_NAMES: [&str; 15] = [
    "BLAKE", "BMW", "GROESTL", "JH", "KECCAK",
    "SKEIN", "LUFFA", "CUBEHASH", "SHAVITE", "SIMD",
    "ECHO", "HAMSI", "FUGUE", "SHABAL", "WHIRL",
];

// CPU reference hashes (from sphlib)
const CPU_HASHES: [&str; 15] = [
    "7283aa8a394efc002adfe5e42aca7ee2a2e28109118b3b4a97b54a6179a1863e3a5cb7eda8db045567b385af016551743f01393205c167a2bc9d991ef275540b",
    "bc98742cd2034da8cc940063aaaf6cae17eaa06894c49d680956c6feb66ce03fbf1e89b41af7a9c9c726cb7f0f568548cda33e1c7e92789d42b8d178ff9bf554",
    "21ceeb901c4966435a47128dfcf02fea1cc0063c112f841a1b07e6e31f76ea85dd1c07a5137939471fb3efc0535a4d0ea15056b71ff3e4efb4247e3b57b8de62",
    "5e1541149357105de373c9dfa82f6818e45f4a9ff738137921418e207247a472353e71731e4dd829a2c4cb99811acf39f608556039c825f13d26c0d3bcc6173c",
    "d0b06a8f62e967130d9761d4bfeeb471de0ff1dc9ccd27e7a11dd697e677107ddd39aae1b28528cfee9abfbbd421819bde4280919d90bef5eef1d9e4dd12d153",
    "16fe20083238c600cd32ed8ce518e6046b70d3eec2aabd99d0d9634c6114a7e105693df28a58b94297f7afe03d131a47bcd60e4c79f31666ea0a1bc3bd12b4b9",
    "c31c2a40d9d640a68ca9bd5d290f38ebf11ad029f68085fa5d2de246506f0b89621beecdb35a4608a7f2bfb4c9c5f49791d9cfd9135190ed0a0248a412a24f53",
    "4f2b0f666f3b9793815cd2c59dfbd6d46025ddd2eca0b1b7b6c336639025e3622fe33097d654c01ded2c40e79aafdf585fa13a274403a475fdca224a7d7aefd3",
    "455faf9d5f6eb99320089a798680345bfc008473c103b68ca3a571d2aa92736b5ac425c5387fe417cf55aa70be0be576988ab86724bf08476389f1539198cd38",
    "cd49179d879a54629d3c9988ab28c6740188a80f3e1fd1b64985dc1bb73e2316b7c4489ef03fd508bfdd8aa687cf70027a549cf3ccfde8801b8260f3b47d2ceb",
    "4e7d81acbd8de156f017697e71d4a3b36cb2f9cc18c57786467026b75788a42837e5bbaa279a4ed7a49c792d0d4b94d17465a6a3b22888f843d2fb10a6709e37",
    "e82437bceb44615448d8b4d50e36689d9a3887a4333fd502ef79cd4b10c4acc8b56c41802756e1536a139f9245cef1707b7ede341f582922d05e66af15724a80",
    "85b13233586e488ba82b764e08856ba241548713b3949d3098b59a8da6a3c22e1a238e910fec9e6d7ec708623f75960c01dd391c54f9136b3560cf5d899254ac",
    "3b7ed0d6459f9855469ddb3308b6eb1ef32e6d0fe37c7b725fa920d3637198bb0b37e6db06a1d34d41455135c8467e6830431a4f7450a40b5e16b2070e5e9de8",
    "3a64614c31b26aa3481767285d7877e16d0aae1afa17a73d6e79d51717de4d7188604c5b1e327a035a13e26163276403f290b9443ab1a6a6b8b05f1f3ecfb1fe",
];

fn main() {
    println!("=== RTM SPH GPU vs CPU Test ===\n");

    let mut header = [0u8; 80];
    header[0] = 0x01;
    for i in 4..68 {
        header[i] = ((i * 7 + 13) & 0xFF) as u8;
    }

    let mut gpu = match GpuMiner::new() {
        Ok(g) => {
            println!("GPU initialized: device={}", g.device_name());
            g
        }
        Err(e) => {
            eprintln!("GPU init failed: {}", e);
            return;
        }
    };

    let mut pass = 0;
    let mut fail = 0;

    for algo in 0..15u32 {
        match gpu.ghostrider_sph_test(&header, algo) {
            Ok(gpu_hash) => {
                let gpu_hex = hex::encode(&gpu_hash);
                let cpu_hex = CPU_HASHES[algo as usize];
                let name = ALGO_NAMES[algo as usize];

                if gpu_hex == cpu_hex {
                    println!("✓ {:>9}: MATCH", name);
                    pass += 1;
                } else {
                    println!("✗ {:>9}: MISMATCH", name);
                    println!("  CPU: {}", cpu_hex);
                    println!("  GPU: {}", gpu_hex);
                    fail += 1;
                }
            }
            Err(e) => {
                println!("✗ {:>9}: ERROR: {}", ALGO_NAMES[algo as usize], e);
                fail += 1;
            }
        }
    }

    println!("\n--- Summary ---");
    println!("Pass: {}/15, Fail: {}/15", pass, fail);
}
