use deeksha_debug::deeksha_lite;

fn main() {
    println!("=== DeekshaLite v1 — Simplified ASIC-resistant algorithm ===");
    println!();

    // Self-test
    println!("Running self-test...");
    if deeksha_lite::deeksha_lite_self_test() {
        println!("Self-test PASSED");
    } else {
        println!("Self-test FAILED");
        std::process::exit(1);
    }

    println!();

    // Benchmark
    println!("Running benchmark...");
    let hps = deeksha_lite::benchmark(1000);

    println!();
    println!("Throughput: {:.0} H/s (single-thread CPU)", hps);
}
