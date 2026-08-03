// Eaglesong OpenCL kernel for Nervos Network (CKB) mining.
//
// Full implementation of the Eaglesong proof-of-work hash function as
// specified in Nervos RFC 0010:
//   https://nervosnetwork.github.io/rfcs/rfcs/0010-eaglesong/0010-eaglesong.html
//
// Eaglesong is a sponge-based hash function built on a custom ARX
// (Addition-Rotation-XOR) permutation.  The sponge parameters are:
//   rate      = 256 bits  (32 bytes = 8 uint32 words)
//   capacity  = 256 bits  (32 bytes = 8 uint32 words)
//   state     = 512 bits  (64 bytes = 16 uint32 words)
//   delimiter = 0x06
//   rounds    = 43
//
// The permutation F maps the 16-word (512-bit) state through 43 rounds.
// Each round applies four layers:
//   1. Bit-matrix multiplication  — a 16×16 binary matrix over GF(2)
//   2. Circulant multiplication   — per-word rotation + XOR (linear diffusion)
//   3. Injection of constants      — XOR with round-dependent constants
//   4. Addition-Rotation-Addition  — non-linear ARX layer on word pairs
//
// The hash function (EaglesongHash):
//   - Appends the delimiter byte 0x06 to the input
//   - Pads with zeros to a multiple of the rate (32 bytes)
//   - Absorbs each 32-byte block: XOR into state[0..7], then apply F
//   - Squeezes 32 bytes from state[0..7] (one rate block)
//
// For CKB mining, the input is the 80-byte block header with the 8-byte
// nonce injected at offset 32 (little-endian).  The 32-byte hash output
// is compared against the target as a big-endian 256-bit integer.
//
// Reference implementation:
//   https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0010-eaglesong/eaglesong.c
//
// Kernel arguments:
//   header      — 80-byte CKB block header template (nonce field zeroed)
//   header_len  — length of header (typically 80)
//   base_nonce  — first nonce in this batch
//   output_hash — 32-byte buffer for the winning hash
//   found_flag  — atomic flag: 0 = not found, 1 = found
//   target      — 32-byte target (big-endian byte comparison)

// ── Eaglesong parameters ─────────────────────────────────────────────

#define EAGLESONG_NUM_ROUNDS  43
#define EAGLESONG_RATE_BITS   256
#define EAGLESONG_RATE_BYTES  32    // rate / 8
#define EAGLESONG_RATE_WORDS  8     // rate / 32
#define EAGLESONG_STATE_WORDS 16    // (rate + capacity) / 32
#define EAGLESONG_DELIMITER   0x06u

// ── Bit matrix (16×16 binary matrix over GF(2)) ──────────────────────
//
// The bit matrix is stored row-major: bit_matrix[k*16 + j] indicates
// whether input word k contributes to output word j.  Since entries are
// 0 or 1, the "multiplication" is just conditional XOR.
//
// For GPU efficiency, we store 16 column masks (one per output word j).
// Bit k of column_mask[j] is set iff bit_matrix[k*16 + j] == 1, meaning
// state[k] is XORed into new_state[j].

__constant const uint BIT_MATRIX_COL[16] = {
    0x90F1u, 0xB113u, 0xF2D7u, 0x755Fu,
    0xEABEu, 0x458Du, 0x8B1Au, 0x86C5u,
    0x9D7Bu, 0xAA07u, 0xC4FFu, 0x190Fu,
    0x321Eu, 0x643Cu, 0xC878u, 0x8FAFu
};

// ── Circulant multiplication rotation amounts ────────────────────────
//
// For each state word j, the circulant multiplication computes:
//   state[j] = state[j] ^ rotl(state[j], rot1[j]) ^ rotl(state[j], rot2[j])
//
// The original coefficients array is [0, rot1, rot2] per word; the leading
// 0 corresponds to the identity (state[j] itself), which is the initial
// XOR term.  We store only the two non-zero rotation amounts.

__constant const uchar CIRC_ROT1[16] = {
    2, 13,  4,  3, 27,  3, 17,  3,
   18, 12,  4,  4, 12,  7,  7,  1
};

__constant const uchar CIRC_ROT2[16] = {
    4, 22, 19, 14, 31,  8, 26, 12,
   22, 18,  7, 31, 27, 17,  8, 13
};

// ── Injection constants (43 rounds × 16 words = 688 values) ──────────
//
// Round i XORs injection_constants[i*16 + j] into state[j].

__constant const uint INJECTION_CONSTANTS[688] = {
    0x6e9e40aeu, 0x71927c02u, 0x9a13d3b1u, 0xdaec32adu, 0x3d8951cfu, 0xe1c9fe9au, 0xb806b54cu, 0xacbbf417u,
    0xd3622b3bu, 0xa082762au, 0x9edcf1c0u, 0xa9bada77u, 0x7f91e46cu, 0xcb0f6e4fu, 0x265d9241u, 0xb7bdeab0u,
    0x6260c9e6u, 0xff50dd2au, 0x9036aa71u, 0xce161879u, 0xd1307cdfu, 0x89e456dfu, 0xf83133e2u, 0x65f55c3du,
    0x94871b01u, 0xb5d204cdu, 0x583a3264u, 0x5e165957u, 0x4cbda964u, 0x675fca47u, 0xf4a3033eu, 0x2a417322u,
    0x3b61432fu, 0x7f5532f2u, 0xb609973bu, 0x1a795239u, 0x31b477c9u, 0xd2949d28u, 0x78969712u, 0x0eb87b6eu,
    0x7e11d22du, 0xccee88bdu, 0xeed07eb8u, 0xe5563a81u, 0xe7cb6bcfu, 0x25de953eu, 0x4d05653au, 0x0b831557u,
    0x94b9cd77u, 0x13f01579u, 0x794b4a4au, 0x67e7c7dcu, 0xc456d8d4u, 0x59689c9bu, 0x668456d7u, 0x22d2a2e1u,
    0x38b3a828u, 0x0315ac3cu, 0x438d681eu, 0xab7109c5u, 0x97ee19a8u, 0xde062b2eu, 0x2c76c47bu, 0x0084456fu,
    0x908f0fd3u, 0xa646551fu, 0x3e826725u, 0xd521788eu, 0x9f01c2b0u, 0x93180cdcu, 0x92ea1df8u, 0x431a9aaeu,
    0x7c2ea356u, 0xda33ad03u, 0x46926893u, 0x66bde7d7u, 0xb501cc75u, 0x1f6e8a41u, 0x685250f4u, 0x3bb1f318u,
    0xaf238c04u, 0x974ed2ecu, 0x5b159e49u, 0xd526f8bfu, 0x12085626u, 0x3e2432a9u, 0x6bd20c48u, 0x1f1d59dau,
    0x18ab1068u, 0x80f83cf8u, 0x2c8c11c0u, 0x7d548035u, 0x0ff675c3u, 0xfed160bfu, 0x74bbbb24u, 0xd98e006bu,
    0xdeaa47ebu, 0x05f2179eu, 0x437b0b71u, 0xa7c95f8fu, 0x00a99d3bu, 0x3fc3c444u, 0x72686f8eu, 0x00fd01a9u,
    0xdedc0787u, 0xc6af7626u, 0x7012fe76u, 0xf2a5f7ceu, 0x9a7b2edau, 0x5e57fcf2u, 0x4da0d4adu, 0x5c63b155u,
    0x34117375u, 0xd4134c11u, 0x2ea77435u, 0x5278b6deu, 0xab522c4cu, 0xbc8fc702u, 0xc94a09e4u, 0xebb93a9eu,
    0x91ecb65eu, 0x4c52ecc6u, 0x8703bb52u, 0xcb2d60aau, 0x30a0538au, 0x1514f10bu, 0x157f6329u, 0x3429dc3du,
    0x5db73eb2u, 0xa7a1a969u, 0x7286bd24u, 0x0df6881eu, 0x3785ba5fu, 0xcd04623au, 0x02758170u, 0xd827f556u,
    0x99d95191u, 0x84457eb1u, 0x58a7fb22u, 0xd2967c5fu, 0x4f0c33f6u, 0x4a02099au, 0xe0904821u, 0x94124036u,
    0x496a031bu, 0x780b69c4u, 0xcf1a4927u, 0x87a119b8u, 0xcdfaf4f8u, 0x4cf9cd0fu, 0x27c96a84u, 0x6d11117eu,
    0x7f8cf847u, 0x74ceede5u, 0xc88905e6u, 0x60215841u, 0x7172875au, 0x736e993au, 0x010aa53cu, 0x43d53c2bu,
    0xf0d91a93u, 0x0d983b56u, 0xf816663cu, 0xe5d13363u, 0x0a61737cu, 0x09d51150u, 0x83a5ac2fu, 0x3e884905u,
    0x7b01aeb5u, 0x600a6ea7u, 0xb7678f7bu, 0x72b38977u, 0x068018f2u, 0xce6ae45bu, 0x29188aa8u, 0xe5a0b1e9u,
    0xc04c2b86u, 0x8bd14d75u, 0x648781f3u, 0xdbae1e0au, 0xddcdd8aeu, 0xab4d81a3u, 0x446baabau, 0x1cc0c19du,
    0x17be4f90u, 0x82c0e65du, 0x676f9c95u, 0x5c708db2u, 0x6fd4c867u, 0xa5106ef0u, 0x19dde49du, 0x78182f95u,
    0xd089cd81u, 0xa32e98feu, 0xbe306c82u, 0x6cd83d8cu, 0x037f1bdeu, 0x0b15722du, 0xeddc1e22u, 0x93c76559u,
    0x8a2f571bu, 0x92cc81b4u, 0x021b7477u, 0x67523904u, 0xc95dbcccu, 0xac17ee9du, 0x944e46bcu, 0x0781867eu,
    0xc854dd9du, 0x26e2c30cu, 0x858c0416u, 0x6d397708u, 0xebe29c58u, 0xc80ced86u, 0xd496b4abu, 0xbe45e6f5u,
    0x10d24706u, 0xacf8187au, 0x96f523cbu, 0x2227e143u, 0x78c36564u, 0x4643adc2u, 0x4729d97au, 0xcff93e0du,
    0x25484bbdu, 0x91c6798eu, 0x95f773f4u, 0x44204675u, 0x2eda57bau, 0x06d313efu, 0xeeaa4466u, 0x2dfa7530u,
    0xa8af0c9bu, 0x39f1535eu, 0x0cc2b7bdu, 0x38a76c0eu, 0x4f41071du, 0xcdaf2475u, 0x49a6eff8u, 0x01621748u,
    0x36ebacabu, 0xbd6d9a29u, 0x44d1cd65u, 0x40815dfdu, 0x55fa5a1au, 0x87cce9e9u, 0xae559b45u, 0xd76b4c26u,
    0x637d60adu, 0xde29f5f9u, 0x97491cbbu, 0xfb350040u, 0xffe7f997u, 0x201c9dcdu, 0xe61320e9u, 0xa90987a3u,
    0xe24afa83u, 0x61c1e6fcu, 0xcc87ff62u, 0xf1c9d8fau, 0x4fd04546u, 0x90ecc76eu, 0x46e456b9u, 0x305dceb8u,
    0xf627e68cu, 0x2d286815u, 0xc705bbfdu, 0x101b6df3u, 0x892dae62u, 0xd5b7fb44u, 0xea1d5c94u, 0x5332e3cbu,
    0xf856f88au, 0xb341b0e9u, 0x28408d9du, 0x5421bc17u, 0xeb9af9bcu, 0x602371c5u, 0x67985a91u, 0xd774907fu,
    0x7c4d697du, 0x9370b0b8u, 0x6ff5cebbu, 0x7d465744u, 0x674ceac0u, 0xea9102fcu, 0x0de94784u, 0xc793de69u,
    0xfe599bb1u, 0xc6ad952fu, 0x6d6ca9c3u, 0x928c3f91u, 0xf9022f05u, 0x24a164dcu, 0xe5e98cd3u, 0x7649efdbu,
    0x6df3bcdbu, 0x5d1e9ff1u, 0x17f5d010u, 0xe2686ea1u, 0x6eac77feu, 0x7bb5c585u, 0x88d90cbbu, 0x18689163u,
    0x67c9efa5u, 0xc0b76d9bu, 0x960efbabu, 0xbd872807u, 0x70f4c474u, 0x56c29d20u, 0xd1541d15u, 0x88137033u,
    0xe3f02b3eu, 0xb6d9b28du, 0x53a077bau, 0xeedcd29eu, 0xa50a6c1du, 0x12c2801eu, 0x52ba335bu, 0x35984614u,
    0xe2599aa8u, 0xaf94ed1du, 0xd90d4767u, 0x202c7d07u, 0x77bec4f4u, 0xfa71bc80u, 0xfc5c8b76u, 0x8d0fbbfcu,
    0xda366dc6u, 0x8b32a0c7u, 0x1b36f7fcu, 0x6642dcbcu, 0x6fe7e724u, 0x8b5fa782u, 0xc4227404u, 0x3a7d1da7u,
    0x517ed658u, 0x8a18df6du, 0x3e5c9b23u, 0x1fbd51efu, 0x1470601du, 0x3400389cu, 0x676b065du, 0x8864ad80u,
    0xea6f1a9cu, 0x2db484e1u, 0x608785f0u, 0x8dd384afu, 0x69d26699u, 0x409c4e16u, 0x77f9986au, 0x7f491266u,
    0x883ea6cfu, 0xeaa06072u, 0xfa2e5db5u, 0x352594b4u, 0x9156bb89u, 0xa2fbbbfbu, 0xac3989c7u, 0x6e2422b1u,
    0x581f3560u, 0x1009a9b5u, 0x7e5ad9cdu, 0xa9fc0a6eu, 0x43e5998eu, 0x7f8778f9u, 0xf038f8e1u, 0x5415c2e8u,
    0x6499b731u, 0xb82389aeu, 0x05d4d819u, 0x0f06440eu, 0xf1735aa0u, 0x986430eeu, 0x47ec952cu, 0xbf149cc5u,
    0xb3cb2cb6u, 0x3f41e8c2u, 0x271ac51bu, 0x48ac5dedu, 0xf76a0469u, 0x717bba4du, 0x4f5c90d6u, 0x3b74f756u,
    0x1824110au, 0xa4fd43e3u, 0x1eb0507cu, 0xa9375c08u, 0x157c59a7u, 0x0cad8f51u, 0xd66031a0u, 0xabb5343fu,
    0xe533fa43u, 0x1996e2bbu, 0xd7953a71u, 0xd2529b94u, 0x58f0fa07u, 0x4c9b1877u, 0x057e990du, 0x8bfe19c4u,
    0xa8e2c0c9u, 0x99fcaadau, 0x69d2aacau, 0xdc1c4642u, 0xf4d22307u, 0x7fe27e8cu, 0x1366aa07u, 0x1594e637u,
    0xce1066bfu, 0xdb922552u, 0x9930b52au, 0xaeaa9a3eu, 0x31ff7eb4u, 0x5e1f945au, 0x150ac49cu, 0x0ccdac2du,
    0xd8a8a217u, 0xb82ea6e5u, 0xd6a74659u, 0x67b7e3e6u, 0x836eef4au, 0xb6f90074u, 0x7fa3ea4bu, 0xcb038123u,
    0xbf069f55u, 0x1fa83fc4u, 0xd6ebdb23u, 0x16f0a137u, 0x19a7110du, 0x5ff3b55fu, 0xfb633868u, 0xb466f845u,
    0xbce0c198u, 0x88404296u, 0xddbdd88bu, 0x7fc52546u, 0x63a553f8u, 0xa728405au, 0x378a2bceu, 0x6862e570u,
    0xefb77e7du, 0xc611625eu, 0x32515c15u, 0x6984b765u, 0xe8405976u, 0x9ba386fdu, 0xd4eed4d9u, 0xf8fe0309u,
    0x0ce54601u, 0xbaf879c2u, 0xd8524057u, 0x1d8c1d7au, 0x72c0a3a9u, 0x5a1ffbdeu, 0x82f33a45u, 0x5143f446u,
    0x29c7e182u, 0xe536c32fu, 0x5a6f245bu, 0x44272adbu, 0xcb701d9cu, 0xf76137ecu, 0x0841f145u, 0xe7042eccu,
    0xf1277dd7u, 0x745cf92cu, 0xa8fe65feu, 0xd3e2d7cfu, 0x54c513efu, 0x6079bc2du, 0xb66336b0u, 0x101e383bu,
    0xbcd75753u, 0x25be238au, 0x56a6f0beu, 0xeeffcc17u, 0x5ea31f3du, 0x0ae772f5u, 0xf76de3deu, 0x1bbecdadu,
    0xc9107d43u, 0xf7e38dceu, 0x618358cdu, 0x5c833f04u, 0xf6975906u, 0xde4177e5u, 0x67d314dcu, 0xb4760f3eu,
    0x56ce5888u, 0x0e8345a8u, 0xbff6b1bfu, 0x78dfb112u, 0xf1709c1eu, 0x7bb8ed8bu, 0x902402b9u, 0xdaa64ae0u,
    0x46b71d89u, 0x7eee035fu, 0xbe376509u, 0x99648f3au, 0x0863ea1fu, 0x49ad8887u, 0x79bdecc5u, 0x3c10b568u,
    0x5f2e4baeu, 0x04ef20abu, 0x72f8ce7bu, 0x521e1ebeu, 0x14525535u, 0x2e8af95bu, 0x9094ccfdu, 0xbcf36713u,
    0xc73953efu, 0xd4b91474u, 0x6554ec2du, 0xe3885c96u, 0x03dc73b7u, 0x931688a9u, 0xcbbef182u, 0x2b77cfc9u,
    0x632a32bdu, 0xd2115dccu, 0x1ae5533du, 0x32684e13u, 0x4cc5a004u, 0x13321bdeu, 0x62cbd38du, 0x78383a3bu,
    0xd00686f1u, 0x9f601ee7u, 0x7eaf23deu, 0x3110c492u, 0x9c351209u, 0x7eb89d52u, 0x6d566eacu, 0xc2efd226u,
    0x32e9fac5u, 0x52227274u, 0x09f84725u, 0xb8d0b605u, 0x72291f02u, 0x71b5c34bu, 0x3dbfcbb8u, 0x04a02263u,
    0x55ba597fu, 0xd4e4037du, 0xc813e1beu, 0xffddeefau, 0xc3c058f3u, 0x87010f2eu, 0x1dfcf55fu, 0xc694eeebu,
    0xa9c01a74u, 0x98c2fc6bu, 0xe57e1428u, 0xdd265a71u, 0x836b956du, 0x7e46ab1au, 0x5835d541u, 0x50b32505u,
    0xe640913cu, 0xbb486079u, 0xfe496263u, 0x113c5b69u, 0x93cd6620u, 0x5efe823bu, 0x2d657b40u, 0xb46dfc6cu,
    0x57710c69u, 0xfe9fadebu, 0xb5f8728au, 0xe3224170u, 0xca28b751u, 0xfdabae56u, 0x5ab12c3cu, 0xa697c457u,
    0xd28fa2b7u, 0x056579f2u, 0x9fd9d810u, 0xe3557478u, 0xd88d89abu, 0xa72a9422u, 0x6d47abd0u, 0x405bcbd9u,
    0x6f83ebafu, 0x13caec76u, 0xfceb9ee2u, 0x2e922df7u, 0xce9856dfu, 0xc05e9322u, 0x2772c854u, 0xb67f2a32u,
    0x6d1af28du, 0x3a78cf77u, 0xdff411e4u, 0x61c74ca9u, 0xed8b842eu, 0x72880845u, 0x6e857085u, 0xc6404932u,
    0xee37f6bcu, 0x27116f48u, 0x5e9ec45au, 0x8ea2a51fu, 0xa5573db7u, 0xa746d036u, 0x486b4768u, 0x5b438f3bu,
    0x18c54a5cu, 0x64fcf08eu, 0xe993cdc1u, 0x35c1ead3u, 0x9de07de7u, 0x321b841cu, 0x87423c5eu, 0x071aa0f6u,
    0x962eb75bu, 0xbb06bdd2u, 0xdcdb5363u, 0x389752f2u, 0x83d9cc88u, 0xd014adc6u, 0xc71121bbu, 0x2372f938u,
    0xcaff2650u, 0x62be8951u, 0x56dccaffu, 0xac4084c0u, 0x09712e95u, 0x1d3c288fu, 0x1b085744u, 0xe1d3cfefu,
    0x5c9a812eu, 0x6611fd59u, 0x85e46044u, 0x1981d885u, 0x5a4c903fu, 0x43f30d4bu, 0x7d1d601bu, 0xdd3c3391u,
    0x030ec65eu, 0xc12878cdu, 0x72e795feu, 0xd0c76abdu, 0x1ec085dbu, 0x7cbb61fau, 0x93e8dd1eu, 0x8582eb06u,
    0x73563144u, 0x049d4e7eu, 0x5fd5aefeu, 0x7b842a00u, 0x75ced665u, 0xbb32d458u, 0x4e83bba7u, 0x8f15151fu,
    0x7795a125u, 0xf0842455u, 0x499af99du, 0x565cc7fau, 0xa3b1278du, 0x3f27ce74u, 0x96ca058eu, 0x8a497443u,
    0xa6fb8caeu, 0xc115aa21u, 0x17504923u, 0xe4932402u, 0xaea886c2u, 0x8eb79af5u, 0xebd5ea6bu, 0xc7980d3bu,
    0x71369315u, 0x796e6a66u, 0x3a7ec708u, 0xb05175c8u, 0xe02b74e7u, 0xeb377ad3u, 0x6c8c1f54u, 0xb980c374u,
    0x59aee281u, 0x449cb799u, 0xe01f5605u, 0xed0e085eu, 0xc9a1a3b4u, 0xaac481b1u, 0xc935c39cu, 0xb7d8ce7fu
};

// ── Helper macros ────────────────────────────────────────────────────

#define ROTL32(x, n) (((x) << (n)) | ((x) >> (32 - (n))))

// ── Eaglesong permutation (43 rounds) ────────────────────────────────
//
// Transforms the 16-word state in place.  Each round applies:
//   1. Bit-matrix multiplication over GF(2)
//   2. Circulant multiplication (per-word rotation + XOR)
//   3. Injection of round constants
//   4. Addition-Rotation-Addition (ARX) on word pairs

void eaglesong_permutation(uint state[16]) {
    uint new_state[16];

    for (int round = 0; round < EAGLESONG_NUM_ROUNDS; round++) {
        // ── Layer 1: Bit-matrix multiplication ──
        // For each output word j, XOR together all input words state[k]
        // where bit k of BIT_MATRIX_COL[j] is set.  This is a linear
        // diffusion layer over GF(2).
        #pragma unroll
        for (int j = 0; j < 16; j++) {
            uint acc = 0;
            uint mask = BIT_MATRIX_COL[j];
            #pragma unroll
            for (int k = 0; k < 16; k++) {
                if (mask & (1u << k))
                    acc ^= state[k];
            }
            new_state[j] = acc;
        }
        #pragma unroll
        for (int j = 0; j < 16; j++)
            state[j] = new_state[j];

        // ── Layer 2: Circulant multiplication ──
        // For each word j:
        //   state[j] = state[j] ^ rotl(state[j], rot1) ^ rotl(state[j], rot2)
        // This applies a circulant matrix (defined by the polynomial
        // 1 + x^rot1 + x^rot2) over GF(2) to each word independently.
        #pragma unroll
        for (int j = 0; j < 16; j++) {
            uint s = state[j];
            uint r1 = CIRC_ROT1[j];
            uint r2 = CIRC_ROT2[j];
            state[j] = s ^ ROTL32(s, r1) ^ ROTL32(s, r2);
        }

        // ── Layer 3: Injection of constants ──
        // XOR round-dependent constants into each state word.
        #pragma unroll
        for (int j = 0; j < 16; j++) {
            state[j] ^= INJECTION_CONSTANTS[round * 16 + j];
        }

        // ── Layer 4: Addition-Rotation-Addition (ARX) ──
        // Process words in pairs (2i, 2i+1):
        //   a = a + b          (mod 2^32)
        //   a = rotl(a, 8)     (rotate left by 8)
        //   b = rotl(b, 24)    (rotate left by 24 = rotate right by 8)
        //   b = a + b          (mod 2^32)
        // This is the only non-linear layer; the additions provide
        // diffusion across bit positions within each word pair.
        #pragma unroll
        for (int j = 0; j < 16; j += 2) {
            state[j]     = state[j] + state[j + 1];
            state[j]     = ROTL32(state[j], 8);
            state[j + 1] = ROTL32(state[j + 1], 24);
            state[j + 1] = state[j] + state[j + 1];
        }
    }
}

// ── Eaglesong sponge hash (specialized for 80-byte input) ───────────
//
// Computes EaglesongHash(input) → 32-byte output using the sponge
// construction with rate=256 bits, capacity=256 bits, delimiter=0x06.
//
// The input is absorbed in 32-byte blocks (big-endian word loading):
//   - XOR each block into state[0..7] (the rate portion)
//   - Apply the permutation after each block
//
// The delimiter byte 0x06 is appended to the input, then the result is
// zero-padded to the next rate boundary.
//
// For squeezing, the first 32 bytes of state (state[0..7]) are read out
// in little-endian byte order.  Since we need exactly 32 bytes = one
// rate block, a single squeeze read suffices (no extra permutation).
//
// This function is specialized for exactly 80-byte inputs (the CKB block
// header size).  The 80 bytes + delimiter 0x06 = 81 bytes, padded to
// 96 bytes = 3 rate blocks of 32 bytes each:
//   Block 0: input bytes  0..31
//   Block 1: input bytes 32..63
//   Block 2: input bytes 64..79 + 0x06 delimiter + zero padding
//
// Specialization with compile-time-constant sizes avoids a bug in some
// OpenCL compilers (notably macOS) where variable-length absorb loops
// with data-dependent indexing produce incorrect code.

inline void eaglesong_hash_80(
    const uchar *input,             // 80-byte data to hash (private memory)
    uchar *output                   // 32-byte hash output (private memory)
) {
    uint state[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) state[i] = 0;

    // ── Absorb block 0: input bytes 0..31 → state[0..7] ──
    // Big-endian word loading: first byte is most significant.
    #pragma unroll
    for (int j = 0; j < EAGLESONG_RATE_WORDS; j++) {
        state[j] ^= ((uint)input[j * 4]     << 24)
                  | ((uint)input[j * 4 + 1] << 16)
                  | ((uint)input[j * 4 + 2] <<  8)
                  |  (uint)input[j * 4 + 3];
    }
    eaglesong_permutation(state);

    // ── Absorb block 1: input bytes 32..63 → state[0..7] ──
    #pragma unroll
    for (int j = 0; j < EAGLESONG_RATE_WORDS; j++) {
        state[j] ^= ((uint)input[32 + j * 4]     << 24)
                  | ((uint)input[32 + j * 4 + 1] << 16)
                  | ((uint)input[32 + j * 4 + 2] <<  8)
                  |  (uint)input[32 + j * 4 + 3];
    }
    eaglesong_permutation(state);

    // ── Absorb block 2: input bytes 64..79 + delimiter + padding ──
    // 16 bytes of input (4 words) + delimiter 0x06 at byte 80 + zeros.
    //
    // The reference implementation loads bytes big-endian but does NOT
    // shift the integer for positions beyond the delimiter.  So the
    // delimiter byte 0x06 at position 80 (first byte of word 4) becomes
    // 0x00000006, not 0x06000000.  Bytes 81..95 are simply not loaded
    // (the integer stays at 0x06 for word 4, and 0 for words 5..7).
    state[0] ^= ((uint)input[64] << 24) | ((uint)input[65] << 16)
              | ((uint)input[66] <<  8) |  (uint)input[67];
    state[1] ^= ((uint)input[68] << 24) | ((uint)input[69] << 16)
              | ((uint)input[70] <<  8) |  (uint)input[71];
    state[2] ^= ((uint)input[72] << 24) | ((uint)input[73] << 16)
              | ((uint)input[74] <<  8) |  (uint)input[75];
    state[3] ^= ((uint)input[76] << 24) | ((uint)input[77] << 16)
              | ((uint)input[78] <<  8) |  (uint)input[79];
    state[4] ^= EAGLESONG_DELIMITER;  // 0x06 — delimiter at first byte of word, no shift
    // state[5..7] remain 0 (no bytes loaded beyond delimiter)
    eaglesong_permutation(state);

    // ── Squeeze: read 32 bytes from state[0..7] (little-endian) ──
    // We need exactly 32 bytes = one rate block, so no additional
    // permutation is required after this read.
    #pragma unroll
    for (int j = 0; j < EAGLESONG_RATE_WORDS; j++) {
        output[j * 4 + 0] = (uchar)((state[j] >> 0) & 0xFF);
        output[j * 4 + 1] = (uchar)((state[j] >> 8) & 0xFF);
        output[j * 4 + 2] = (uchar)((state[j] >> 16) & 0xFF);
        output[j * 4 + 3] = (uchar)((state[j] >> 24) & 0xFF);
    }
}

// ── Mining kernel ────────────────────────────────────────────────────
//
// Each work-item processes one nonce:
//   nonce = base_nonce + get_global_id(0)
//
// The nonce is injected as an 8-byte little-endian value at offset 32
// in the 80-byte CKB block header (the Eaglesong/CKB nonce position).
// The Eaglesong hash of the resulting 80-byte header is computed and
// compared against the target as a big-endian 256-bit integer.
//
// If hash ≤ target, found_flag[0] is atomically set to 1 and the hash
// is written to output_hash.

__kernel __attribute__((reqd_work_group_size(256, 1, 1)))
void eaglesong_mine(
    __global const uchar *header,       // 80-byte header template
    const uint header_len,              // length of header (typically 80)
    const ulong base_nonce,             // first nonce in this batch
    __global uchar *output_hash,        // 32-byte winning hash output
    __global uint *found_flag,          // atomic flag: 0 = not found, 1 = found
    __global const uchar *target        // 32-byte target (big-endian)
) {
    // Early exit: bail out if a solution was already found.
    if (*found_flag) return;

    ulong nonce = base_nonce + (ulong)get_global_id(0);

    // ── Load header into private memory with inline nonce injection ──
    // The CKB block header is 80 bytes.  We copy the template and inject
    // the nonce at offset 32 (8 bytes, little-endian) in a single pass.
    //
    // The nonce is injected during the copy loop (single write per byte)
    // rather than copy-then-modify.  This works around a bug in some
    // OpenCL compilers (notably macOS) where writing to a private array
    // after a copy loop causes incorrect optimization, corrupting the
    // subsequent hash computation.
    uchar hdr[80];
    uint copy_len = header_len < 80u ? header_len : 80u;
    #pragma unroll
    for (uint i = 0; i < 80u; i++) {
        if (i >= 32u && i < 40u) {
            // Inject nonce byte (little-endian) at offset 32..39
            hdr[i] = (uchar)((nonce >> ((uint)(i - 32u) * 8u)) & 0xFFu);
        } else if (i < copy_len) {
            hdr[i] = header[i];
        } else {
            hdr[i] = 0;
        }
    }

    // ── Compute Eaglesong hash of the 80-byte header ──
    uchar hash[32];
    eaglesong_hash_80(hdr, hash);

    // ── Compare hash against target (big-endian byte comparison) ──
    // hash[0] is the most significant byte.  The hash meets the target
    // if hash ≤ target when both are interpreted as big-endian 256-bit
    // integers.
    int meets = 1;
    for (int i = 0; i < 32; i++) {
        uchar h = hash[i];
        uchar t = target[i];
        if (h < t) { meets = 1; break; }
        if (h > t) { meets = 0; break; }
    }

    if (meets) {
        // Atomically claim the found flag so only one work-item writes.
        uint old = atomic_xchg(found_flag, 1u);
        if (old == 0u) {
            // Write the winning hash to the output buffer.
            #pragma unroll
            for (int i = 0; i < 32; i++)
                output_hash[i] = hash[i];
        }
    }
}
