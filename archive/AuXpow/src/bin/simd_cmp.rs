use zion_auxpow::gpu_miner::GpuMiner;
#[cfg(feature = "native-ghostrider")]
use zion_native_ffi::ghostrider;

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    (0..hex.len()).step_by(2).map(|i| u8::from_str_radix(&hex[i..i+2], 16).unwrap()).collect()
}

fn main() {
    let mut gpu = GpuMiner::new().unwrap();

    // CPU state after final keccak for CNDarklite(step10 output)
    let cpu_state_hex = "513865cd5d160b44588196d95173c7a6273012a7b1dee5aa873346a6ad3a8d7218f37b678dcaa18040e62c2e27ffb90d65d85294cbb4c7558af516925af9a7080f353e1ef899dde3711c08152edc63bcd6f0e22d68cb834e4109b3eb734b9d9fc145d6975b7061e41a403961eac207b624b81b261a64404db5dcac574aea5204c3910dabf8ddeb8f12d4b6077d3f624bf4441e37b434701dede18e538240ed8bc3332c5008266dd2e586372cbd9ea825a359c038bc3d5a80b92c0dd0c629b165d95d5e068810e815";
    let cpu_state = hex_to_bytes(cpu_state_hex);

    // Test groestl (hash_sel=1) with CPU state
    let gpu_groestl = gpu.extra_hash_test(&cpu_state, 1).unwrap();
    let groestl_hex: String = gpu_groestl.iter().map(|b| format!("{:02x}", b)).collect();
    println!("GPU groestl(CPU_state): {}", groestl_hex);
    println!("CPU expected:           34ef29701dffa8d743432c5abf6088d2c6926d4b76aa27c799fd617fe5008511");

    // Test the full CN hash (CNDarklite: memory=512KB, iter_div=131072, aes_init=16384)
    let input: [u8; 64] = {
        let hex = "ca7a536a9e1ef913108ce12efbc9714077562e8877dfa90d0391cab10751fcf4e0e215422c85e3d2a313d770c642a3b32b34f7909236c67696f38ca88eb481d9";
        let mut arr = [0u8; 64];
        let bytes = hex_to_bytes(hex);
        for i in 0..64 { arr[i] = bytes[i]; }
        arr
    };

    let (gpu_cn, _) = gpu.ghostrider_cn_full_test(&input, 64, 524288, 131072, 16384).unwrap();
    let cn_hex: String = gpu_cn.iter().map(|b| format!("{:02x}", b)).collect();
    println!("\nGPU cn_hash_full(CNDarklite): {}", cn_hex);

    // Call CPU CNDarklite hash directly for comparison
    #[cfg(feature = "native-ghostrider")]
    {
        let cpu_cn = ghostrider::cn_darklite_debug(&input);
        let cpu_hex: String = cpu_cn.iter().map(|b| format!("{:02x}", b)).collect();
        println!("CPU cn_darklite:              {}", cpu_hex);

        if gpu_cn == cpu_cn {
            println!("\n✓ PASS: GPU and CPU CNDarklite hashes match!");
        } else {
            println!("\n✗ FAIL: GPU and CPU CNDarklite hashes differ!");
        }
    }
}
