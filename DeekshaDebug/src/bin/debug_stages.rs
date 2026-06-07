/// Stage-by-stage GPU vs CPU debug for DeekshaLite v1
///
/// Runs a minimal OpenCL kernel that outputs s1 (step1 keccak output)
/// so we can isolate where CPU and GPU first diverge.

use ocl::{ProQue, Buffer, MemFlags};
use deeksha_debug::deeksha_lite::deeksha_lite_debug;

fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{:02x}", x)).collect() }

// Kernel that only runs step1 (keccak256 of header||nonce) and outputs s1
const STAGE1_KERNEL: &str = r#"
typedef union { ulong u[25]; uchar b[200]; } kst_t;
#define ROL64(x,n) (((ulong)(x)<<(n))|((ulong)(x)>>(64u-(n))))
__constant ulong KRC[24]={
    0x0000000000000001UL,0x0000000000008082UL,0x800000000000808AUL,0x8000000080008000UL,
    0x000000000000808BUL,0x0000000080000001UL,0x8000000080008081UL,0x8000000000008009UL,
    0x000000000000008AUL,0x0000000000000088UL,0x0000000080008009UL,0x000000008000000AUL,
    0x000000008000808BUL,0x800000000000008BUL,0x8000000000008089UL,0x8000000000008003UL,
    0x8000000000008002UL,0x8000000000000080UL,0x000000000000800AUL,0x800000008000000AUL,
    0x8000000080008081UL,0x8000000000008080UL,0x0000000080000001UL,0x8000000080008008UL,
};
void kf(__private ulong *s){
    ulong b0,b1,b2,b3,b4,t;
    for(int r=0;r<24;r++){
        b0=s[0]^s[5]^s[10]^s[15]^s[20]; b1=s[1]^s[6]^s[11]^s[16]^s[21];
        b2=s[2]^s[7]^s[12]^s[17]^s[22]; b3=s[3]^s[8]^s[13]^s[18]^s[23];
        b4=s[4]^s[9]^s[14]^s[19]^s[24];
        t=b4^ROL64(b1,1);s[0]^=t;s[5]^=t;s[10]^=t;s[15]^=t;s[20]^=t;
        t=b0^ROL64(b2,1);s[1]^=t;s[6]^=t;s[11]^=t;s[16]^=t;s[21]^=t;
        t=b1^ROL64(b3,1);s[2]^=t;s[7]^=t;s[12]^=t;s[17]^=t;s[22]^=t;
        t=b2^ROL64(b4,1);s[3]^=t;s[8]^=t;s[13]^=t;s[18]^=t;s[23]^=t;
        t=b3^ROL64(b0,1);s[4]^=t;s[9]^=t;s[14]^=t;s[19]^=t;s[24]^=t;
        t=s[1];
        s[1]=ROL64(s[6],44);s[6]=ROL64(s[9],20);s[9]=ROL64(s[22],61);
        s[22]=ROL64(s[14],39);s[14]=ROL64(s[20],18);s[20]=ROL64(s[2],62);
        s[2]=ROL64(s[12],43);s[12]=ROL64(s[13],25);s[13]=ROL64(s[19],56);
        s[19]=ROL64(s[23],27);s[23]=ROL64(s[15],36);s[15]=ROL64(s[4],28);
        s[4]=ROL64(s[24],21);s[24]=ROL64(s[21],15);s[21]=ROL64(s[8],14);
        s[8]=ROL64(s[16],45);s[16]=ROL64(s[5],8);s[5]=ROL64(s[3],55);
        s[3]=ROL64(s[18],3);s[18]=ROL64(s[17],10);s[17]=ROL64(s[11],39);
        s[11]=ROL64(s[7],41);s[7]=ROL64(s[10],2);s[10]=ROL64(t,1);
        t=s[0];s[0]^=(~s[1])&s[2];s[1]^=(~s[2])&s[3];s[2]^=(~s[3])&s[4];s[3]^=(~s[4])&t;s[4]^=(~s[0])&s[1];
        t=s[5];s[5]^=(~s[6])&s[7];s[6]^=(~s[7])&s[8];s[7]^=(~s[8])&s[9];s[8]^=(~s[9])&t;s[9]^=(~s[5])&s[6];
        t=s[10];s[10]^=(~s[11])&s[12];s[11]^=(~s[12])&s[13];s[12]^=(~s[13])&s[14];s[13]^=(~s[14])&t;s[14]^=(~s[10])&s[11];
        t=s[15];s[15]^=(~s[16])&s[17];s[16]^=(~s[17])&s[18];s[17]^=(~s[18])&s[19];s[18]^=(~s[19])&t;s[19]^=(~s[15])&s[16];
        t=s[20];s[20]^=(~s[21])&s[22];s[21]^=(~s[22])&s[23];s[22]^=(~s[23])&s[24];s[23]^=(~s[24])&t;s[24]^=(~s[20])&s[21];
        s[0]^=KRC[r];
    }
}
void k256(__private const uchar *in,uint inlen,__private uchar out[32]){
    kst_t s; for(int i=0;i<25;i++)s.u[i]=0;
    uint pos=0;
    for(uint i=0;i<inlen;i++){s.b[pos]^=in[i];if(++pos==136){kf(s.u);pos=0;}}
    s.b[pos]^=0x01; s.b[135]^=0x80; kf(s.u);
    for(int i=0;i<32;i++)out[i]=s.b[i];
}
__kernel void stage1_only(
    __global const uchar *header, uint hlen, ulong nonce_base, uint ncount,
    __global uchar *out_s1)
{
    uint tid=get_global_id(0); if(tid>=ncount)return;
    ulong nonce=nonce_base+(ulong)tid;
    uchar inp[88]; for(int i=0;i<88;i++)inp[i]=0;
    uint hl=min(hlen,(uint)80);
    for(uint i=0;i<hl;i++)inp[i]=header[i];
    for(int i=0;i<8;i++)inp[80+i]=(uchar)(nonce>>(i*8));
    uchar s1[32]; k256(inp,88,s1);
    __global uchar *slot=out_s1+(ulong)tid*32;
    for(int i=0;i<32;i++)slot[i]=s1[i];
}
"#;

fn main() {
    let header     = b"ZION_DEEKSHA_LITE_TEST_HEADER";
    let nonce_base = 0x123456789ABCDEF0u64;
    let ncount     = 4u32;

    println!("=== Stage-by-Stage Debug ===");
    println!("Testing {} nonces starting at {:#018x}", ncount, nonce_base);
    println!();

    // CPU intermediate values
    println!("CPU intermediate values:");
    for i in 0..ncount as u64 {
        let nonce = nonce_base + i;
        let (s1, s2, s3, s4) = deeksha_lite_debug(header, nonce);
        println!("  nonce {:#018x}:", nonce);
        println!("    s1={}", hex(&s1));
        println!("    s2={}", hex(&s2));
        println!("    s3={}", hex(&s3));
        println!("    s4={}", hex(&s4));
    }
    println!();

    // GPU: only step1
    println!("GPU step1 (keccak256) output:");
    let pro_que = ProQue::builder()
        .src(STAGE1_KERNEL)
        .dims(ncount as usize)
        .build()
        .expect("Failed to build stage1 kernel");

    println!("  Device: {}", pro_que.device().name().unwrap_or("?".into()));

    let mut hpad = [0u8; 88];
    hpad[..header.len()].copy_from_slice(header);

    let hbuf: Buffer<u8> = Buffer::builder()
        .queue(pro_que.queue().clone())
        .flags(MemFlags::READ_ONLY)
        .len(88)
        .copy_host_slice(&hpad)
        .build().unwrap();

    let out_s1: Buffer<u8> = Buffer::builder()
        .queue(pro_que.queue().clone())
        .len((ncount as usize) * 32)
        .build().unwrap();

    let k = pro_que.kernel_builder("stage1_only")
        .arg(&hbuf)
        .arg(header.len() as u32)
        .arg(nonce_base)
        .arg(ncount)
        .arg(&out_s1)
        .build().unwrap();

    unsafe { k.enq().unwrap(); }
    pro_que.queue().finish().unwrap();

    let mut s1_data = vec![0u8; (ncount as usize) * 32];
    out_s1.read(&mut s1_data).enq().unwrap();

    for i in 0..ncount as usize {
        let nonce = nonce_base + i as u64;
        let gpu_s1 = &s1_data[i * 32..(i + 1) * 32];
        let (cpu_s1, _, _, _) = deeksha_lite_debug(header, nonce);
        let ok = gpu_s1 == cpu_s1.as_slice();
        println!("  nonce {:#018x}: s1 {} {}",
            nonce,
            if ok { "MATCH " } else { "MISMATCH" },
            hex(gpu_s1));
        if !ok {
            println!("    CPU s1={}", hex(&cpu_s1));
        }
    }
}
