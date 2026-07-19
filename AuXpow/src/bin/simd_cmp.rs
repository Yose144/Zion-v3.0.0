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

    // Also test the full CN hash
    let input: [u8; 64] = {
        let hex = "ca7a536a9e1ef913108ce12efbc9714077562e8877dfa90d0391cab10751fcf4e0e215422c85e3d2a313d770c642a3b32b34f7909236c67696f38ca88eb481d9";
        let mut arr = [0u8; 64];
        let bytes = hex_to_bytes(hex);
        for i in 0..64 { arr[i] = bytes[i]; }
        arr
    };

    let (gpu_cn, gpu_debug_state) = gpu.ghostrider_cn_full_test(&input, 64, 524288, 164, 16384).unwrap();
    let cn_hex: String = gpu_cn.iter().map(|b| format!("{:02x}", b)).collect();
    // Iter 163 debug:
    // a[128..143], c[144..159], j2[160..163], sp[32..47], j1[176..179], t0[180..187], t1[188..195], hi[48..55], lo[56..63]
    let iter_a: String = gpu_debug_state[128..144].iter().map(|b| format!("{:02x}", b)).collect();
    let iter_c: String = gpu_debug_state[144..160].iter().map(|b| format!("{:02x}", b)).collect();
    let iter_j2 = u32::from_le_bytes([gpu_debug_state[160], gpu_debug_state[161], gpu_debug_state[162], gpu_debug_state[163]]);
    let iter_sp: String = gpu_debug_state[32..48].iter().map(|b| format!("{:02x}", b)).collect();
    let iter_j1 = u32::from_le_bytes([gpu_debug_state[176], gpu_debug_state[177], gpu_debug_state[178], gpu_debug_state[179]]);
    let iter_t0 = u64::from_le_bytes([gpu_debug_state[180], gpu_debug_state[181], gpu_debug_state[182], gpu_debug_state[183], gpu_debug_state[184], gpu_debug_state[185], gpu_debug_state[186], gpu_debug_state[187]]);
    let iter_t1 = u64::from_le_bytes([gpu_debug_state[188], gpu_debug_state[189], gpu_debug_state[190], gpu_debug_state[191], gpu_debug_state[192], gpu_debug_state[193], gpu_debug_state[194], gpu_debug_state[195]]);
    let iter_hi = u64::from_le_bytes([gpu_debug_state[48], gpu_debug_state[49], gpu_debug_state[50], gpu_debug_state[51], gpu_debug_state[52], gpu_debug_state[53], gpu_debug_state[54], gpu_debug_state[55]]);
    let iter_lo = u64::from_le_bytes([gpu_debug_state[56], gpu_debug_state[57], gpu_debug_state[58], gpu_debug_state[59], gpu_debug_state[60], gpu_debug_state[61], gpu_debug_state[62], gpu_debug_state[63]]);
    println!("\nGPU cn_hash_full(step10, CNDarklite): {}", cn_hex);
    println!("CPU step 11 first 32B:               34ef29701dffa8d743432c5abf6088d2c6926d4b76aa27c799fd617fe5008511");
    println!("\nGPU iter163 a:   {}", iter_a);
    println!("GPU iter163 c:   {}", iter_c);
    println!("GPU iter163 j1:  {}", iter_j1);
    println!("GPU iter163 sp:  {}", iter_sp);
    println!("GPU iter163 j2:  {}", iter_j2);
    println!("GPU iter163 t0:  {:016x}", iter_t0);
    println!("GPU iter163 t1:  {:016x}", iter_t1);
    println!("GPU iter163 hi:  {:016x}", iter_hi);
    println!("GPU iter163 lo:  {:016x}", iter_lo);
    let gpu_tweak = u64::from_le_bytes([gpu_debug_state[64], gpu_debug_state[65], gpu_debug_state[66], gpu_debug_state[67], gpu_debug_state[68], gpu_debug_state[69], gpu_debug_state[70], gpu_debug_state[71]]);
    let gpu_input_part = u64::from_le_bytes([gpu_debug_state[72], gpu_debug_state[73], gpu_debug_state[74], gpu_debug_state[75], gpu_debug_state[76], gpu_debug_state[77], gpu_debug_state[78], gpu_debug_state[79]]);
    let gpu_state_part = u64::from_le_bytes([gpu_debug_state[80], gpu_debug_state[81], gpu_debug_state[82], gpu_debug_state[83], gpu_debug_state[84], gpu_debug_state[85], gpu_debug_state[86], gpu_debug_state[87]]);
    println!("GPU tweak1_2:    {:016x}", gpu_tweak);
    println!("GPU input_part:  {:016x}", gpu_input_part);
    println!("GPU state_part:  {:016x}", gpu_state_part);
    let gpu_gpart = u64::from_le_bytes([gpu_debug_state[88], gpu_debug_state[89], gpu_debug_state[90], gpu_debug_state[91], gpu_debug_state[92], gpu_debug_state[93], gpu_debug_state[94], gpu_debug_state[95]]);
    println!("GPU global_part: {:016x}", gpu_gpart);
    // Individual bytes from cn_full_test (at offsets 112..119, not overwritten by cn_hash_full)
    println!("GPU input[0]:    {:02x} (expected ca)", gpu_debug_state[112]);
    println!("GPU input[1]:    {:02x} (expected 7a)", gpu_debug_state[113]);
    println!("GPU input[34]:   {:02x} (expected 15)", gpu_debug_state[114]);
    println!("GPU input[35]:   {:02x} (expected 42)", gpu_debug_state[115]);
    println!("GPU input[36]:   {:02x} (expected 2c)", gpu_debug_state[116]);
    println!("GPU input[42]:   {:02x} (expected d7)", gpu_debug_state[117]);
    println!("GPU input[43]:   {:02x} (expected 70)", gpu_debug_state[118]);
    println!("GPU input[63]:   {:02x} (expected d9)", gpu_debug_state[119]);
    // cn_hash_full saves input[35..42] to debug_state[96..103] at its very start
    let gpu_inp35_private = u64::from_le_bytes([gpu_debug_state[96], gpu_debug_state[97], gpu_debug_state[98], gpu_debug_state[99], gpu_debug_state[100], gpu_debug_state[101], gpu_debug_state[102], gpu_debug_state[103]]);
    println!("GPU inp35 priv:  {:016x} (expected 422c85e3d2a313d7)", gpu_inp35_private);

    // Call CPU CNDarklite hash directly to get debug output
    #[cfg(feature = "native-ghostrider")]
    {
        println!("\n--- Calling CPU CNDarklite hash for debug comparison ---");
        let _cpu_cn = ghostrider::cn_darklite_debug(&input);
        let cpu_hex: String = _cpu_cn.iter().map(|b| format!("{:02x}", b)).collect();
        println!("CPU cn_darklite output: {}", cpu_hex);
    }
}
