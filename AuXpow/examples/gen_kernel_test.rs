use zion_auxpow::progpow_codegen;

fn main() {
    let params = progpow_codegen::PROGPOWZ_PARAMS;
    let block_height: u64 = 0; // period 0
    let random_math = progpow_codegen::gen_zano_progpow_random_math(&params, block_height);
    let progpow_loop = progpow_codegen::gen_zano_progpow_loop(&params, block_height);
    println!("=== RANDOM_MATH ===");
    println!("{}", random_math);
    println!("=== PROGPOW_LOOP ===");
    println!("{}", progpow_loop);
}
