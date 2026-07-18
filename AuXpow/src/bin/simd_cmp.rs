use zion_auxpow::gpu_miner::GpuMiner;
use zion_auxpow::gpu_backend::GpuBackend;

fn main() {
    let mut header = [0u8; 80];
    header[0] = 0x01;
    for i in 4..68 { header[i] = ((i * 7 + 13) & 0xFF) as u8; }

    let mut gpu = GpuMiner::new().unwrap();

    // Test 1: First compression only (128-byte input = data+0x80)
    let mut input1 = [0u8; 128];
    input1[..80].copy_from_slice(&header);
    input1[80] = 0x80;
    let gpu_state1 = gpu.simd_debug(&input1).unwrap();

    let cpu_state1: [u32; 32] = [
        0x65cf97e4, 0x1b99cf55, 0x489fd965, 0x3d04bc2f,
        0x85d95795, 0xd20ed6e8, 0xbee2664a, 0x462bd872,
        0xff9dccad, 0x6fc62fba, 0xf3acd6b4, 0x0197b4c5,
        0xf014b396, 0x3f6d2f42, 0x632661f6, 0x35ae313c,
        0x67b3c4c0, 0x93ba5b12, 0xc9e4d955, 0x917de297,
        0x2d94daea, 0x73b45cf4, 0xb8e565c8, 0xef93a87f,
        0x643cfa2e, 0x823d64e4, 0x3db1509e, 0x1f68841a,
        0x9ff04026, 0xfbdea921, 0x5f12e922, 0xa6f7ba8b,
    ];

    println!("=== Test 1: State after 1st compression ===");
    let mut mm = 0;
    for i in 0..32 {
        let ok = gpu_state1[i] == cpu_state1[i];
        if !ok { mm += 1; }
        println!("  [{:2}] CPU={:08x} GPU={:08x} {}", i, cpu_state1[i], gpu_state1[i], if ok {"OK"} else {"MISMATCH"});
    }
    println!("Mismatches: {}/32\n", mm);

    // Test 2: 2nd compression ONE_ROUND_BIG only (STEP_BIG disabled in both CPU and GPU)
    let gpu_state2 = gpu.simd_debug2(&header, 80).unwrap();

    // CPU reference: state after ONE_ROUND_BIG in 2nd compression (no STEP_BIG)
    let cpu_state2: [u32; 32] = [
        0xecd6e543, 0x0244df1d, 0x2aac0e51, 0x83586df3,
        0xecd3783e, 0x7ba504fb, 0x59dd1cb7, 0x51761a43,
        0xb005351c, 0xbd4e1a5b, 0x2fc40c44, 0xbfe8b1f8,
        0xd22406ee, 0xfed5063b, 0x4fa4c4b1, 0x82ad7b33,
        0x6b467875, 0xda7f3fe9, 0xf8e7c8ef, 0x72b5f190,
        0xe81beea8, 0xf50a0610, 0xa9389753, 0xc42486d7,
        0x66f9127b, 0x8baa7675, 0x0066b6cd, 0x20f2b993,
        0xf7f96593, 0x136fca8e, 0x5068cdda, 0x595f3f9d,
    ];

    println!("=== Test 2: State after 2nd ONE_ROUND_BIG (no STEP_BIG) ===");
    let mut mm2 = 0;
    for i in 0..32 {
        let ok = gpu_state2[i] == cpu_state2[i];
        if !ok { mm2 += 1; }
        println!("  [{:2}] CPU={:08x} GPU={:08x} {}", i, cpu_state2[i], gpu_state2[i], if ok {"OK"} else {"MISMATCH"});
    }
    println!("Mismatches: {}/32", mm2);
}
