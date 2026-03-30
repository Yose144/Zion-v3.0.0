#!/usr/bin/env python3
"""Patch mine_batch: skip all buffer writes, just run kernel with zeroed data.
Test if clEnqueueNDRangeKernel works or also deadlocks after clBuildProgram."""

path = '/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs'
with open(path, 'r') as f:
    code = f.read()

# Find the mine_batch function and replace with minimal diagnostic version
old_mine = '''        fn mine_batch(
            &mut self,
            header: MiningHeader,
            target: DifficultyTarget,
            nonce_start: u64,
            batch_size: u64,
        ) -> Result<GpuBatchResult> {
            let header_bytes = header.to_bytes();
            self.header_buf.write(&header_bytes[..]).queue(&self.transfer_queue).enq()?;
            self.transfer_queue.finish()?;'''

new_mine = '''        fn mine_batch(
            &mut self,
            header: MiningHeader,
            target: DifficultyTarget,
            nonce_start: u64,
            batch_size: u64,
        ) -> Result<GpuBatchResult> {
            use std::io::Write;
            let header_bytes = header.to_bytes();
            println!("mine_batch: start nonce={} batch={}", nonce_start, batch_size);
            let _ = std::io::stdout().flush();

            // AMD gfx900 diagnostic: skip header write, test kernel execution directly
            println!("mine_batch: skipping header write (AMD diag)");
            let _ = std::io::stdout().flush();'''

if old_mine in code:
    code = code.replace(old_mine, new_mine, 1)
    print("OK: replaced mine_batch header write")
else:
    print("ERROR: mine_batch pattern not found")
    # Try to find it
    idx = code.find('fn mine_batch(')
    if idx > 0:
        snippet = code[idx:idx+500]
        print("Found mine_batch at", idx)
        print(repr(snippet[:300]))

# Also skip sentinel write and add diagnostic before kernel dispatch
old_sentinel = '''                // Reset sentinel
                let sentinel_slice: [u64; 1] = [SENTINEL];
                self.result_nonce_buf.write(&sentinel_slice[..]).queue(&self.transfer_queue).enq()?;
                self.transfer_queue.finish()?;'''

new_sentinel = '''                // Skip sentinel write (AMD diag)
                println!("mine_batch: chunk={} global={} local={}", chunk, global_size, local_size);
                let _ = std::io::stdout().flush();'''

if old_sentinel in code:
    code = code.replace(old_sentinel, new_sentinel, 1)
    print("OK: replaced sentinel write")
else:
    print("ERROR: sentinel pattern not found")

# Add diagnostic before kernel enqueue
old_kernel_enq = '''                unsafe {
                    self.kernel.cmd()
                        .global_work_size(global_size)
                        .local_work_size(local_size)
                        .enq()?;
                }'''

new_kernel_enq = '''                println!("mine_batch: kernel dispatch...");
                let _ = std::io::stdout().flush();
                unsafe {
                    self.kernel.cmd()
                        .global_work_size(global_size)
                        .local_work_size(local_size)
                        .enq()?;
                }
                println!("mine_batch: kernel enqueued ok");
                let _ = std::io::stdout().flush();'''

if old_kernel_enq in code:
    code = code.replace(old_kernel_enq, new_kernel_enq, 1)
    print("OK: added kernel dispatch diagnostic")

# Skip result read too - use dummy values
old_read = '''                // Read result
                let mut nonce_out = vec![SENTINEL];
                self.result_nonce_buf.read(&mut nonce_out).queue(&self.transfer_queue).enq()?;
                self.transfer_queue.finish()?;'''

new_read = '''                // Skip result read (AMD diag) - just report and continue
                println!("mine_batch: kernel dispatch complete, skipping read");
                let _ = std::io::stdout().flush();
                let nonce_out = vec![SENTINEL]; // dummy: no solution found'''

if old_read in code:
    code = code.replace(old_read, new_read, 1)
    print("OK: replaced result read")
else:
    print("ERROR: read pattern not found")

with open(path, 'w') as f:
    f.write(code)

print("Patch v3.1.0-diag complete")
