/*
 * ============================================================================
 *  GhostRider hash — Raptoreum (RTM)
 *
 *  This implementation matches the reference Raptoreum daemon, xmrig, and
 *  cpuminer-gr-avx2 (the miners that pools actually validate against).
 *
 *  Key points:
 *    - Algorithm selection reads the previous-block hash bytes in forward
 *      order, low nibble first (low nibble, then high nibble of each byte).
 *      This is exactly what Raptoreum's HashSelection does when it calls
 *      GetNibble(i) with i counting down from 63 to 0.
 *    - After each CryptoNight stage, the upper 32 bytes of the 64-byte hash
 *      buffer are zeroed, matching the daemon's uint512 and cpuminer-gr/xmrig.
 *    - 6 CN variants: CNDark, CNDarklite, CNFast, CNLite, CNTurtle,
 *      CNTurtlelite.
 *    - 15 core algos: BLAKE..WHIRLPOOL.
 *    - 3 CN positions: indices 5, 11, 17 in the 18-iteration loop.
 *
 *  GhostRider algorithm: 15 core hash functions + 6 CryptoNight variants,
 *  selected dynamically based on previous block hash.
 *  3 stages: 5 core + 1 CN + 5 core + 1 CN + 5 core + 1 CN = 18 iterations.
 * ============================================================================
 */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include "sph/extra.h"
#include "sph/sph_blake.h"
#include "sph/sph_bmw.h"
#include "sph/sph_groestl.h"
#include "sph/sph_jh.h"
#include "sph/sph_keccak.h"
#include "sph/sph_skein.h"
#include "sph/sph_luffa.h"
#include "sph/sph_cubehash.h"
#include "sph/sph_shavite.h"
#include "sph/sph_simd.h"
#include "sph/sph_echo.h"
#include "sph/sph_hamsi.h"
#include "sph/sph_fugue.h"
#include "sph/sph_shabal.h"
#include "sph/sph_whirlpool.h"
#include "sph/sph_sha2.h"
#include "sph/sph_haval.h"
#include "sph/sph_tiger.h"
#include "sph/lyra2.h"
#include "sph/gost_streebog.h"
#include "cryptonote/cryptonight_dark.h"
#include "cryptonote/cryptonight_dark_lite.h"
#include "cryptonote/cryptonight_fast.h"
#include "cryptonote/cryptonight.h"
#include "cryptonote/cryptonight_lite.h"
#include "cryptonote/cryptonight_soft_shell.h"
#include "cryptonote/cryptonight_turtle.h"
#include "cryptonote/cryptonight_turtle_lite.h"
#include <stdio.h>

enum Algo {
        BLAKE = 0,
        BMW,
        GROESTL,
        JH,
        KECCAK,
        SKEIN,
        LUFFA,
        CUBEHASH,
        SHAVITE,
        SIMD,
        ECHO,
        HAMSI,
        FUGUE,
        SHABAL,
        WHIRLPOOL,
        HASH_FUNC_COUNT
};

/* 6 CN variants — matches daemon, xmrig and cpuminer-gr. */
enum CNAlgo {
	CNDark = 0,
	CNDarklite,
	CNFast,
	CNLite,
	CNTurtle,
	CNTurtlelite,
	CN_HASH_FUNC_COUNT
};

static void selectAlgo(unsigned char nibble, bool* selectedAlgos,
                       uint8_t* selectedIndex, int algoCount,
                       int* currentCount) {
  uint8_t algoDigit = (nibble & 0x0F) % algoCount;
  if (!selectedAlgos[algoDigit]) {
    selectedAlgos[algoDigit] = true;
    selectedIndex[currentCount[0]] = algoDigit;
    currentCount[0] = currentCount[0] + 1;
  }
  algoDigit = (nibble >> 4) % algoCount;
  if (!selectedAlgos[algoDigit]) {
    selectedAlgos[algoDigit] = true;
    selectedIndex[currentCount[0]] = algoDigit;
    currentCount[0] = currentCount[0] + 1;
  }
}

static void getAlgoString(void *mem, unsigned int size,
                          uint8_t* selectedAlgoOutput, int algoCount) {
  unsigned char *p = (unsigned char *)mem;
  unsigned int len = size / 2;
  /* MSVC does not support VLA (C99 variable-length arrays).
     Use a fixed-size array — algoCount is at most 15 (HASH_FUNC_COUNT). */
  bool selectedAlgo[15];
  for (int z = 0; z < algoCount && z < 15; z++) {
    selectedAlgo[z] = false;
  }
  int selectedCount = 0;
  for (unsigned int i = 0; i < len; i++) {
    selectAlgo(p[i], selectedAlgo, selectedAlgoOutput, algoCount,
               &selectedCount);
    if (selectedCount == algoCount) {
      break;
    }
  }
  if (selectedCount < algoCount) {
    for (uint8_t i = 0; i < algoCount; i++) {
      if (!selectedAlgo[i]) {
        selectedAlgoOutput[selectedCount] = i;
        selectedCount++;
      }
    }
  }
}

void gr_hash(const char* input, char* output) {
	uint32_t hash[64/4];
	uint8_t selectedAlgoOutput[15] = {0};
	uint8_t selectedCNAlgoOutput[6] = {0};
	sph_blake512_context ctx_blake;
	sph_bmw512_context ctx_bmw;
	sph_groestl512_context ctx_groestl;
	sph_jh512_context ctx_jh;
	sph_keccak512_context ctx_keccak;
	sph_skein512_context ctx_skein;
	sph_luffa512_context ctx_luffa;
	sph_cubehash512_context ctx_cubehash;
	sph_shavite512_context ctx_shavite;
	sph_simd512_context ctx_simd;
	sph_echo512_context ctx_echo;
	sph_hamsi512_context ctx_hamsi;
	sph_fugue512_context ctx_fugue;
	sph_shabal512_context ctx_shabal;
	sph_whirlpool_context ctx_whirlpool;
	sph_haval256_5_context ctx_haval;
	sph_tiger_context ctx_tiger;
	sph_gost512_context ctx_gost;
	sph_sha256_context ctx_sha;

	void *in = (void*) input;
	int size = 80;

	getAlgoString(&input[4], 64, selectedAlgoOutput, 15);
	getAlgoString(&input[4], 64, selectedCNAlgoOutput, 6);
	int i;
	for (i = 0; i < 18; i++) {
		uint8_t algo;
		uint8_t cnAlgo;
		int coreSelection;
		int cnSelection = -1;
		if(i < 5) {
			coreSelection = i;
		} else if(i < 11) {
			coreSelection = i-1;
		} else {
			coreSelection = i-2;
		}
		if(i==5) {
			coreSelection = -1;
			cnSelection = 0;
		}
		if(i==11) {
			coreSelection = -1;
			cnSelection = 1;
		}
		if(i==17) {
			coreSelection = -1;
			cnSelection = 2;
		}
		if(coreSelection >= 0) {
			algo = selectedAlgoOutput[(uint8_t)coreSelection];
		} else {
			algo = 16; // skip core hashing for this loop iteration
		}
		if(cnSelection >=0) {
			cnAlgo = selectedCNAlgoOutput[(uint8_t)cnSelection];
		} else {
			cnAlgo = 14; // skip cn hashing for this loop iteration
		}
		//selection cnAlgo. if a CN algo is selected then core algo will not be selected
		switch(cnAlgo)
		{
		 case CNDark:
			cryptonightdark_hash(in, (char*)hash, size, 1);
			break;
		 case CNDarklite:
			cryptonightdarklite_hash(in, (char*)hash, size, 1);
			break;
		 case CNFast:
			cryptonightfast_hash(in, (char*)hash, size, 1);
			break;
		 case CNLite:
			cryptonightlite_hash(in, (char*)hash, size, 1);
			break;
		 case CNTurtle:
			cryptonightturtle_hash(in, (char*)hash, size, 1);
			break;
		 case CNTurtlelite:
			cryptonightturtlelite_hash(in, (char*)hash, size, 1);
			break;
		}
		//selection core algo
		switch (algo) {
		case BLAKE:
				sph_blake512_init(&ctx_blake);
				sph_blake512(&ctx_blake, in, size);
				sph_blake512_close(&ctx_blake, hash);
				break;
		case BMW:
				sph_bmw512_init(&ctx_bmw);
				sph_bmw512(&ctx_bmw, in, size);
				sph_bmw512_close(&ctx_bmw, hash);
				break;
		case GROESTL:
				sph_groestl512_init(&ctx_groestl);
				sph_groestl512(&ctx_groestl, in, size);
				sph_groestl512_close(&ctx_groestl, hash);
				break;
		case JH:
				sph_jh512_init(&ctx_jh);
				sph_jh512(&ctx_jh, in, size);
				sph_jh512_close(&ctx_jh, hash);
				break;
		case KECCAK:
				sph_keccak512_init(&ctx_keccak);
				sph_keccak512(&ctx_keccak, in, size);
				sph_keccak512_close(&ctx_keccak, hash);
				break;
		case SKEIN:
				sph_skein512_init(&ctx_skein);
				sph_skein512(&ctx_skein, in, size);
				sph_skein512_close(&ctx_skein, hash);
				break;
		case LUFFA:
				sph_luffa512_init(&ctx_luffa);
				sph_luffa512(&ctx_luffa, in, size);
				sph_luffa512_close(&ctx_luffa, hash);
				break;
		case CUBEHASH:
				sph_cubehash512_init(&ctx_cubehash);
				sph_cubehash512(&ctx_cubehash, in, size);
				sph_cubehash512_close(&ctx_cubehash, hash);
				break;
		case SHAVITE:
				sph_shavite512_init(&ctx_shavite);
				sph_shavite512(&ctx_shavite, in, size);
				sph_shavite512_close(&ctx_shavite, hash);
				break;
		case SIMD:
				sph_simd512_init(&ctx_simd);
				sph_simd512(&ctx_simd, in, size);
				sph_simd512_close(&ctx_simd, hash);
				break;
		case ECHO:
				sph_echo512_init(&ctx_echo);
				sph_echo512(&ctx_echo, in, size);
				sph_echo512_close(&ctx_echo, hash);
				break;
		case HAMSI:
				sph_hamsi512_init(&ctx_hamsi);
				sph_hamsi512(&ctx_hamsi, in, size);
				sph_hamsi512_close(&ctx_hamsi, hash);
				break;
		case FUGUE:
				sph_fugue512_init(&ctx_fugue);
				sph_fugue512(&ctx_fugue, in, size);
				sph_fugue512_close(&ctx_fugue, hash);
				break;
		case SHABAL:
				sph_shabal512_init(&ctx_shabal);
				sph_shabal512(&ctx_shabal, in, size);
				sph_shabal512_close(&ctx_shabal, hash);
				break;
		case WHIRLPOOL:
				sph_whirlpool_init(&ctx_whirlpool);
				sph_whirlpool(&ctx_whirlpool, in, size);
				sph_whirlpool_close(&ctx_whirlpool, hash);
				break;
		}
		if (cnSelection >= 0) {
			/* CryptoNight writes 32 bytes; zero the upper half so the next
			   64-byte core input is well-defined (matches daemon/xmrig). */
			memset(&hash[8], 0, 32);
		}
		in = (void*) hash;
		size = 64;
	}
	memcpy(output, hash, 32);
}
