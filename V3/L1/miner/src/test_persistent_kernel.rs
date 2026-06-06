use ocl::{Platform, Device, Context, Queue, Program, Kernel, Buffer, MemFlags};
use std::time::{Duration, Instant};

const KERNEL_SRC: &str = r#"
typedef struct {
    volatile uint valid;
    uint data;
} Cmd;

typedef struct {
    volatile uint ready;
    uint result;
} Resp;

__kernel void persistent_counter(
    __global Cmd  *cmd,
    __global Resp *resp
) {
    uint tid = get_global_id(0);
    if (tid != 0) return;

    uint iteration = 0;
    while (1) {
        while (cmd->valid == 0) {
            __builtin_amdgcn_s_sleep(100);
        }

        uint val = cmd->data;
        cmd->valid = 0;

        resp->result = val + 1;
        resp->ready  = 1;
        iteration++;

        if (iteration >= 1000) break;
    }
}
"#;

#[repr(C)]
#[derive(Debug, Clone, Copy, Default, PartialEq)]
struct Cmd { valid: u32, data: u32 }
unsafe impl ocl::OclPrm for Cmd {}

#[repr(C)]
#[derive(Debug, Clone, Copy, Default, PartialEq)]
struct Resp { ready: u32, result: u32 }
unsafe impl ocl::OclPrm for Resp {}

fn main() {
    println!("=== Persistent Kernel Smoke Test (ocl crate) ===\n");

    // ── 1. Find AMD GPU ──
    let platform = Platform::default();
    let devices = Device::list_all(&platform).expect("no devices");
    let mut target: Option<Device> = None;
    for d in &devices {
        let name = d.name().unwrap_or_default();
        println!("Device: {}", name);
        if name.to_ascii_lowercase().contains("gfx10") {
            target = Some(*d);
        }
    }
    let device = target.expect("no gfx10 device found");
    println!("\nSelected: {}\n", device.name().unwrap_or_default());

    // ── 2. Context + Queue ──
    let context = Context::builder()
        .platform(platform)
        .devices(&vec![device])
        .build()
        .expect("context failed");
    let queue = Queue::new(&context, device, None)
        .expect("queue failed");
    let write_queue = Queue::new(&context, device, None)
        .expect("write queue failed");

    // ── 3. Build program ──
    let program = Program::builder()
        .src(KERNEL_SRC)
        .devices(device)
        .build(&context)
        .expect("program build failed");
    // ── 4. Buffers (host I/O on separate queue so writes don't block behind kernel) ──
    let cmd_buf = Buffer::<Cmd>::builder()
        .queue(write_queue.clone())
        .len(1)
        .flags(MemFlags::new().read_write())
        .build()
        .expect("cmd buffer failed");

    let resp_buf = Buffer::<Resp>::builder()
        .queue(write_queue.clone())
        .len(1)
        .flags(MemFlags::new().read_write())
        .build()
        .expect("resp buffer failed");

    let kernel = Kernel::builder()
        .program(&program)
        .name("persistent_counter")
        .queue(queue.clone())
        .global_work_size(256usize)
        .local_work_size(256usize)
        .arg(&cmd_buf)
        .arg(&resp_buf)
        .build()
        .expect("kernel build failed");

    // Init
    let init_cmd = vec![Cmd { valid: 0, data: 0 }];
    let init_resp = vec![Resp { ready: 0, result: 0 }];
    cmd_buf.write(&init_cmd).enq().unwrap();
    resp_buf.write(&init_resp).enq().unwrap();
    write_queue.finish().unwrap();

    // ── 5. Launch kernel (NON-BLOCKING) ──
    println!("Launching persistent kernel (non-blocking)...");
    let launch_t0 = Instant::now();
    unsafe {
        kernel.cmd()
            .enq()
            .expect("enqueue failed");
    }
    // FLUSH — do NOT finish.  GPU now runs in background.
    queue.flush().expect("flush failed");
    println!("Kernel launched in {:?} (GPU running in background)\n", launch_t0.elapsed());

    // ── 6. CPU loop: write command → poll response ──
    let iterations = 10usize;
    let mut times = Vec::new();

    for i in 0..iterations {
        // Write command
        let cmd = vec![Cmd { valid: 1, data: i as u32 }];
        cmd_buf.write(&cmd).enq().unwrap();
        write_queue.flush().unwrap();

        // Poll response
        let poll_t0 = Instant::now();
        let mut resp = vec![Resp { ready: 0, result: 0 }];
        let timeout = Duration::from_secs(5);
        while resp[0].ready == 0 && poll_t0.elapsed() < timeout {
            resp_buf.read(&mut resp).enq().unwrap();
            write_queue.finish().expect("finish failed");
        }
        let elapsed = poll_t0.elapsed();

        if resp[0].ready == 1 {
            println!("iter={:2} result={:3} elapsed={:?}", i, resp[0].result, elapsed);
            times.push(elapsed);

            // Clear response for next round
            let clear = vec![Resp { ready: 0, result: 0 }];
            resp_buf.write(&clear).enq().unwrap();
            write_queue.finish().unwrap();
        } else {
            println!("iter={:2} TIMEOUT — kernel may have been killed by TDR", i);
            break;
        }
    }

    // ── 7. Stop kernel ──
    let stop = vec![Cmd { valid: 1, data: 0xFFFFFFFF }];
    cmd_buf.write(&stop).enq().unwrap();
    write_queue.finish().expect("finish failed");
    println!("\nKernel stopped.");

    if !times.is_empty() {
        let total: Duration = times.iter().sum();
        let avg = total / times.len() as u32;
        println!("\nAverage round-trip: {:?}", avg);
        println!("Min: {:?}", times.iter().min().unwrap());
        println!("Max: {:?}", times.iter().max().unwrap());

        if avg < Duration::from_millis(50) {
            println!("\nSUCCESS: Persistent kernel achieves <50 ms round-trip!");
            println!("This confirms the 850 ms launch overhead can be eliminated.");
        } else if avg > Duration::from_millis(500) {
            println!("\nWARNING: Round-trip is still high — GPU may be serialising operations.");
        }
    }
}
