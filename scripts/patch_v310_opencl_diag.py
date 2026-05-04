#!/usr/bin/env python3
"""
patch_v310_opencl_diag.py — Create a standalone OpenCL diagnostic binary
that tests every GPU operation individually on the Vega gfx900.

Deploys as zion-miner-v3.1.0 (diagnostic) on the Prague server.
"""

import subprocess, sys, textwrap, os

SERVER = "root@91.98.122.165"
REMOTE_SRC = "/root/zion-2.9.6/V3/L1/miner/src"

# ── Minimal OpenCL test source ──────────────────────────────────────────────

OPENCL_DIAG_RS = textwrap.dedent(r'''
//! Standalone OpenCL diagnostic — tests each GPU operation independently.
//! Build: cargo build --release --features gpu-opencl --bin opencl-diag
use ocl::{Buffer, Device, Kernel, Platform, ProQue, Queue};
use std::time::Instant;

const TINY_KERNEL: &str = r#"
__kernel void add_one(__global uint* data, uint count) {
    uint gid = get_global_id(0);
    if (gid < count) {
        data[gid] = data[gid] + 1u;
    }
}
"#;

const BLAKE3_STUB: &str = r#"
__kernel void blake3_stub(
    __global const uint* cv,
    __global const uchar* tail,
    __global uint* results,
    uint nonce_start
) {
    uint gid = get_global_id(0);
    uint nonce = nonce_start + gid;
    // Minimal work: XOR nonce with CV words
    uint h = cv[0] ^ cv[1] ^ cv[2] ^ cv[3] ^ nonce;
    // Always store to results[0] (atomic not needed for diag)
    if (h == 0u) {
        results[0] = nonce;
    }
}
"#;

fn main() {
    println!("=== ZION OpenCL Diagnostic v3.1.0 ===");
    println!();

    // Step 1: Platform & Device enumeration
    println!("[1/10] Enumerating OpenCL platforms...");
    let platforms = Platform::list();
    println!("  Found {} platform(s)", platforms.len());
    for (i, p) in platforms.iter().enumerate() {
        let name = p.name().unwrap_or_default();
        let vendor = p.vendor().unwrap_or_default();
        let version = p.version().unwrap_or_default();
        println!("  Platform {}: {} ({}) — {}", i, name, vendor, version);
    }
    println!();

    // Step 2: GPU devices
    println!("[2/10] Listing GPU devices...");
    let platform = Platform::default();
    let devices = Device::list(platform, Some(ocl::flags::DeviceType::GPU))
        .expect("Failed to list GPU devices");
    if devices.is_empty() {
        println!("  ERROR: No GPU devices found!");
        std::process::exit(1);
    }
    for (i, d) in devices.iter().enumerate() {
        let name = d.name().unwrap_or_default();
        let vendor = d.vendor().unwrap_or_default();
        let version = d.version().unwrap_or_default();
        let driver = d.info(ocl::enums::DeviceInfo::DriverVersion)
            .map(|v| format!("{}", v)).unwrap_or_default();
        let max_cu = d.info(ocl::enums::DeviceInfo::MaxComputeUnits)
            .map(|v| format!("{}", v)).unwrap_or_default();
        let max_wg = d.info(ocl::enums::DeviceInfo::MaxWorkGroupSize)
            .map(|v| format!("{}", v)).unwrap_or_default();
        let global_mem = d.info(ocl::enums::DeviceInfo::GlobalMemSize)
            .map(|v| format!("{}", v)).unwrap_or_default();
        println!("  GPU {}: {} ({}) driver={} CU={} maxWG={} globalMem={}",
            i, name, vendor, driver, max_cu, max_wg, global_mem);
    }
    println!();

    let device = devices[0];
    let dev_name = device.name().unwrap_or_default();
    println!("  Using: {}", dev_name);

    // Step 3: Compile trivial kernel
    println!("[3/10] Compiling trivial 'add_one' kernel...");
    let t = Instant::now();
    let pro_que = match ProQue::builder()
        .platform(platform)
        .device(device)
        .src(TINY_KERNEL)
        .dims(64)
        .build()
    {
        Ok(pq) => { println!("  OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0); pq },
        Err(e) => { println!("  FAIL: {}", e); std::process::exit(1); }
    };
    println!();

    // Step 4: Create buffer
    println!("[4/10] Creating GPU buffer (256 u32)...");
    let t = Instant::now();
    let buf = match Buffer::<u32>::builder()
        .queue(pro_que.queue().clone())
        .len(256)
        .build()
    {
        Ok(b) => { println!("  OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0); b },
        Err(e) => { println!("  FAIL: {}", e); std::process::exit(1); }
    };
    println!();

    // Step 5: Write to buffer
    println!("[5/10] Writing data to GPU buffer...");
    let data: Vec<u32> = (0..256).collect();
    let t = Instant::now();
    match buf.write(&data).enq() {
        Ok(_) => println!("  OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0),
        Err(e) => { println!("  FAIL: {}", e); std::process::exit(1); }
    }
    println!();

    // Step 6: Queue finish (test sync)
    println!("[6/10] Queue finish (sync)...");
    let t = Instant::now();
    match pro_que.queue().finish() {
        Ok(_) => println!("  OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0),
        Err(e) => { println!("  FAIL: {}", e); std::process::exit(1); }
    }
    println!();

    // Step 7: Build and run kernel
    println!("[7/10] Running 'add_one' kernel (64 work-items)...");
    let t = Instant::now();
    let kernel = pro_que.kernel_builder("add_one")
        .arg(&buf)
        .arg(256u32)
        .build()
        .expect("kernel build failed");
    unsafe {
        match kernel.cmd().global_work_size(64).enq() {
            Ok(_) => println!("  Enqueued OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0),
            Err(e) => { println!("  FAIL: {}", e); std::process::exit(1); }
        }
    }
    match pro_que.queue().finish() {
        Ok(_) => println!("  Finished OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0),
        Err(e) => { println!("  FAIL: {}", e); std::process::exit(1); }
    }
    println!();

    // Step 8: Read back results
    println!("[8/10] Reading results back from GPU...");
    let mut result = vec![0u32; 256];
    let t = Instant::now();
    match buf.read(&mut result).enq() {
        Ok(_) => {
            pro_que.queue().finish().ok();
            println!("  OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0);
            let ok = result.iter().enumerate().take(64).all(|(i, &v)| v == (i as u32 + 1));
            let unchanged = result.iter().skip(64).take(10).all(|&v| v >= 64);
            println!("  First 8 values: {:?}", &result[..8]);
            if ok {
                println!("  VERIFIED: add_one kernel produced correct results!");
            } else {
                println!("  WARNING: Results don't match expected pattern");
            }
        },
        Err(e) => { println!("  FAIL: {}", e); std::process::exit(1); }
    }
    println!();

    // Step 9: Compile Blake3-like stub
    println!("[9/10] Compiling blake3_stub kernel (tests complex build)...");
    let t = Instant::now();
    let pq2 = match ProQue::builder()
        .platform(platform)
        .device(device)
        .src(BLAKE3_STUB)
        .dims(1024)
        .build()
    {
        Ok(pq) => { println!("  OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0); pq },
        Err(e) => { println!("  FAIL: {}", e); std::process::exit(1); }
    };

    let cv_buf = Buffer::<u32>::builder().queue(pq2.queue().clone()).len(8).build().unwrap();
    let tail_buf = Buffer::<u8>::builder().queue(pq2.queue().clone()).len(52).build().unwrap();
    let res_buf = Buffer::<u32>::builder().queue(pq2.queue().clone()).len(4).build().unwrap();

    let cv_data = [1u32, 2, 3, 4, 5, 6, 7, 8];
    cv_buf.write(&cv_data as &[u32]).enq().unwrap();
    tail_buf.write(&vec![0u8; 52]).enq().unwrap();
    res_buf.write(&vec![0u32; 4]).enq().unwrap();
    pq2.queue().finish().unwrap();
    println!("  Buffers written OK");

    let k2 = pq2.kernel_builder("blake3_stub")
        .arg(&cv_buf)
        .arg(&tail_buf)
        .arg(&res_buf)
        .arg(0u32)
        .build()
        .unwrap();
    let t = Instant::now();
    unsafe {
        match k2.cmd().global_work_size(1024).enq() {
            Ok(_) => println!("  Enqueued 1024 work-items OK"),
            Err(e) => { println!("  FAIL dispatch: {}", e); std::process::exit(1); }
        }
    }
    match pq2.queue().finish() {
        Ok(_) => println!("  Finished OK ({:.1}ms)", t.elapsed().as_secs_f64()*1000.0),
        Err(e) => { println!("  FAIL finish: {}", e); std::process::exit(1); }
    }
    println!();

    // Step 10: Stress test — increasing work sizes
    println!("[10/10] Stress test — increasing work sizes...");
    for &ws in &[64, 256, 1024, 4096, 16384, 65536, 262144] {
        let pq3 = ProQue::builder()
            .platform(platform)
            .device(device)
            .src(TINY_KERNEL)
            .dims(ws)
            .build()
            .unwrap();
        let buf3 = Buffer::<u32>::builder().queue(pq3.queue().clone()).len(ws).build().unwrap();
        let d3: Vec<u32> = (0..ws as u32).collect();
        buf3.write(&d3).enq().unwrap();
        pq3.queue().finish().unwrap();

        let k3 = pq3.kernel_builder("add_one").arg(&buf3).arg(ws as u32).build().unwrap();
        let t = Instant::now();
        unsafe { k3.cmd().global_work_size(ws).enq().unwrap(); }
        pq3.queue().finish().unwrap();
        let elapsed = t.elapsed();
        println!("  work_size={:>7}: {:.2}ms", ws, elapsed.as_secs_f64()*1000.0);
    }
    println!();

    println!("=== OpenCL Diagnostic COMPLETE ===");
    println!("GPU {} is functional for basic OpenCL operations.", dev_name);
}
''').strip()

# ── Deploy script ───────────────────────────────────────────────────────────

def run(cmd, **kw):
    print(f"  $ {cmd}")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)
    if r.stdout.strip():
        print(r.stdout.strip())
    if r.returncode != 0 and r.stderr.strip():
        print(f"  ERR: {r.stderr.strip()}")
    return r

def main():
    print("=== Deploying OpenCL Diagnostic v3.1.0 ===\n")

    # 1. Upload diagnostic source
    print("[1] Uploading opencl_diag.rs to server...")
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.rs', delete=False) as f:
        f.write(OPENCL_DIAG_RS)
        tmp = f.name
    run(f'scp {tmp} {SERVER}:{REMOTE_SRC}/opencl_diag.rs')
    os.unlink(tmp)

    # 2. Add bin entry to Cargo.toml if not present
    print("\n[2] Adding opencl-diag binary to Cargo.toml...")
    check = run(f'ssh {SERVER} "grep -c opencl-diag /root/zion-2.9.6/V3/L1/miner/Cargo.toml"')
    if check.stdout.strip() == "0":
        run(f'''ssh {SERVER} "cat >> /root/zion-2.9.6/V3/L1/miner/Cargo.toml << 'CARGO_EOF'

[[bin]]
name = \\"opencl-diag\\"
path = \\"src/opencl_diag.rs\\"
CARGO_EOF"''')
    else:
        print("  Already present")

    # 3. Build
    print("\n[3] Building opencl-diag...")
    r = run(f'ssh {SERVER} "cd /root/zion-2.9.6/V3 && source ~/.cargo/env && cargo build --release -p zion-miner --bin opencl-diag --features gpu-opencl 2>&1 | tail -5"')
    if r.returncode != 0:
        print("BUILD FAILED")
        return 1

    # 4. Package for SMOS
    print("\n[4] Packaging zion-miner-v3.1.0 (OpenCL diag)...")
    run(f'''ssh {SERVER} "rm -rf /tmp/zion-miner-v3.1.0 && mkdir -p /tmp/zion-miner-v3.1.0 && cp /root/zion-2.9.6/V3/target/release/opencl-diag /tmp/zion-miner-v3.1.0/miner && chmod +x /tmp/zion-miner-v3.1.0/miner && cd /tmp && rm -f /opt/zion/downloads/zion-miner-v3.1.0.zip && zip -r /opt/zion/downloads/zion-miner-v3.1.0.zip zion-miner-v3.1.0/"''')

    print("\n=== zion-miner-v3.1.0 (OpenCL diag) ready ===")
    print("URL: https://zionterranova.com/downloads/zion-miner-v3.1.0.zip")
    return 0

if __name__ == "__main__":
    sys.exit(main())
''')
