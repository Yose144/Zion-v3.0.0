/*
 * ============================================================================
 *  GhostRider hash — Raptoreum (RTM)
 *
 *  This implementation matches the official yiimp-ghostrider stratum server
 *  (Raptor3um/yiimp-ghostrider) and cpuminer-opt's gr_hash exactly.
 *
 *  Key points (verified against yiimp source 2026-07-20):
 *    - getAlgoString reverses byte order: b = (63 - j) >> 1, alternating
 *      low/high nibble extraction based on j parity.
 *    - 6 CN variants only: CNDark, CNDarklite, CNFast, CNLite, CNTurtle,
 *      CNTurtlelite (NOT 14).
 *    - NO post-CN memset zeroing of hash[8..40].
 *    - 15 core algos: BLAKE..WHIRLPOOL (same as before).
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

/* 6 CN variants — matches yiimp-ghostrider exactly. */
enum CNAlgo {
	CNDark = 0,
	CNDarklite,
	CNFast,
	CNLite,
	CNTurtle,
	CNTurtlelite,
	CN_HASH_FUNC_COUNT
};

/*
 * getAlgoString — select algorithm ordering from prev-hash bytes.
 *
 * This matches the official cpuminer-gr-avx2 (WyvernTKC) and npq7721/gr_hash
 * implementations exactly:
 *   - Iterates forward over the 32 bytes starting at prevblock[0].
 *   - For each byte, extracts the LOW nibble first, then the HIGH nibble.
 *   - selectAlgo: (nibble & 0x0F) % algoCount, then (nibble >> 4) % algoCount.
 *   - Skips already-selected algos.
 *   - Fills remaining unselected algos in ascending order at the end.
 *
 * The previous version of this function used REVERSED byte order
 * (b = (63 - j) >> 1) and HIGH nibble first, which produced a DIFFERENT
 * algorithm sequence and thus wrong hashes, causing "Invalid share" (error 25)
 * rejections from yiimp/zpool.
 */
static void selectAlgo(unsigned char nibble, bool* selectedAlgos, uint8_t* selectedIndex, int algoCount, int* currentCount) {
	uint8_t algoDigit = (nibble & 0x0F) % algoCount;
	if(!selectedAlgos[algoDigit]) {
		selectedAlgos[algoDigit] = true;
		selectedIndex[*currentCount] = algoDigit;
		(*currentCount)++;
	}
	algoDigit = (nibble >> 4) % algoCount;
	if(!selectedAlgos[algoDigit]) {
		selectedAlgos[algoDigit] = true;
		selectedIndex[*currentCount] = algoDigit;
		(*currentCount)++;
	}
}

static void getAlgoString(const uint8_t* prevblock, char *output, int algoCount) {
	bool selectedAlgo[algoCount];
	for(int z = 0; z < algoCount; z++) {
		selectedAlgo[z] = false;
	}
	uint8_t selectedIndex[algoCount];
	int selectedCount = 0;

	/* Iterate forward over 32 bytes (64 nibbles), low nibble first. */
	for (int i = 0; i < 32; i++) {
		selectAlgo(prevblock[i], selectedAlgo, selectedIndex, algoCount, &selectedCount);
		if (selectedCount == algoCount) {
			break;
		}
	}

	/* Fill remaining unselected algos in ascending order. */
	if (selectedCount < algoCount) {
		for (uint8_t i = 0; i < algoCount; i++) {
			if (!selectedAlgo[i]) {
				selectedIndex[selectedCount] = i;
				selectedCount++;
			}
		}
	}

	/* Convert indices to char string: 0-9 as '0'-'9', 10+ as 'A'+. */
	char *sptr = output;
	for (int i = 0; i < algoCount; i++) {
		uint8_t algoDigit = selectedIndex[i];
		if (algoDigit >= 10)
			sprintf(sptr, "%c", 'A' + (algoDigit - 10));
		else
			sprintf(sptr, "%u", (uint32_t)algoDigit);
		sptr++;
	}
	*sptr = '\0';
}

void gr_hash(const char* input, char* output) {
	uint32_t hash[64/4];
	char hashOrder[16] = { 0};
	char cnHashOrder[7] = { 0};
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
	getAlgoString((const uint8_t*)&input[4], hashOrder, 15);
	getAlgoString((const uint8_t*)&input[4], cnHashOrder, 6);
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
			const char elem = hashOrder[coreSelection];
			algo = elem >= 'A' ? elem - 'A' + 10 : elem - '0';
		} else {
			algo = 16; // skip core hashing for this loop iteration
		}
		if(cnSelection >=0) {
			const char cnElem = cnHashOrder[cnSelection];
			cnAlgo = cnElem >= 'A' ? cnElem - 'A' + 10 : cnElem - '0';
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
		in = (void*) hash;
		size = 64;
	}
	memcpy(output, hash, 32);
}
