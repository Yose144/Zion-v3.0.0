#!/usr/bin/env python3
"""Patch gpu_backend.rs: separate NPU buffer creation from data writes.
AMD gfx900 driver deadlocks when clCreateBuffer is called while clEnqueueWriteBuffer is pending."""

path = '/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs'
with open(path, 'r') as f:
    code = f.read()

# Find the current NPU section (from v3.0.4b patch)
old_npu = '''            // Create NPU buffers WITHOUT copy_host_slice (AMD gfx900 driver bug workaround)
            let npu_weights = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.weights.len().max(1)).build()?;
            if !packed.weights.is_empty() {
                npu_weights.write(&packed.weights).enq()?;
            }
            println!("npu: weights_buf ok len={}", packed.weights.len()); let _ = std::io::stdout().flush();

            let npu_biases = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.biases.len().max(1)).build()?;
            if !packed.biases.is_empty() {
                npu_biases.write(&packed.biases).enq()?;
            }
            println!("npu: biases_buf ok len={}", packed.biases.len()); let _ = std::io::stdout().flush();

            let npu_scales = Buffer::<i16>::builder()
                .queue(q.clone()).len(packed.scales.len().max(1)).build()?;
            if !packed.scales.is_empty() {
                npu_scales.write(&packed.scales).enq()?;
            }
            println!("npu: scales_buf ok len={}", packed.scales.len()); let _ = std::io::stdout().flush();

            let npu_meta = Buffer::<u32>::builder()
                .queue(q.clone()).len(packed.meta.len()).build()?;
            npu_meta.write(&packed.meta).enq()?;
            println!("npu: meta_buf ok len={}", packed.meta.len()); let _ = std::io::stdout().flush();'''

new_npu = '''            // AMD gfx900 workaround: create all buffers first, then write data, then flush
            println!("npu: creating buffers..."); let _ = std::io::stdout().flush();
            let npu_weights = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.weights.len().max(1)).build()?;
            println!("npu: weights_buf created"); let _ = std::io::stdout().flush();
            let npu_biases = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.biases.len().max(1)).build()?;
            println!("npu: biases_buf created"); let _ = std::io::stdout().flush();
            let npu_scales = Buffer::<i16>::builder()
                .queue(q.clone()).len(packed.scales.len().max(1)).build()?;
            println!("npu: scales_buf created"); let _ = std::io::stdout().flush();
            let npu_meta = Buffer::<u32>::builder()
                .queue(q.clone()).len(packed.meta.len()).build()?;
            println!("npu: meta_buf created"); let _ = std::io::stdout().flush();

            // Now write data to all buffers
            println!("npu: writing data..."); let _ = std::io::stdout().flush();
            if !packed.weights.is_empty() {
                npu_weights.write(&packed.weights).enq()?;
            }
            if !packed.biases.is_empty() {
                npu_biases.write(&packed.biases).enq()?;
            }
            if !packed.scales.is_empty() {
                npu_scales.write(&packed.scales).enq()?;
            }
            npu_meta.write(&packed.meta).enq()?;
            q.finish()?;
            println!("npu: all data written ok"); let _ = std::io::stdout().flush();'''

if old_npu in code:
    code = code.replace(old_npu, new_npu, 1)
    print("Replaced: separate creation from writes")
else:
    print("ERROR: could not find old NPU block to replace")
    # Debug: show what's around the NPU section
    idx = code.find('npu: weights_buf ok')
    if idx >= 0:
        print("Found npu: weights_buf at position", idx)
        print(repr(code[idx-200:idx+400]))
    else:
        print("npu: weights_buf not found at all")

with open(path, 'w') as f:
    f.write(code)

# Verify
with open(path, 'r') as f:
    c = f.read()
checks = [
    ('npu: creating buffers', 'creation phase'),
    ('npu: writing data', 'write phase'),
    ('q.finish()', 'queue flush'),
    ('npu: all data written ok', 'completion print'),
]
for s, desc in checks:
    print(f"  {desc}: {'OK' if s in c else 'MISSING'}")

print("Patch v3.0.5b complete")
