// Equihash 144,5 solver — vendored tromp equi_miner.c namespaced as eq144_*.
//
// The `equihash` crate already links a copy of this same C file (equitromp)
// built for 200,9, so every global symbol must be renamed to avoid duplicate
// definitions at link time.  Compiling a second translation unit with
// different -D params also keeps the two parameter sets cleanly separated.
//
// Params: WN=144 WK=5 RESTBITS=4 (the only RESTBITS implemented for WN=144).
#define WN 144
#define WK 5
#define RESTBITS 4

// Rename every file-scope symbol in equi_miner.c / equi.h.
#define compu32            eq144_compu32
#define errstr             eq144_errstr
#define tree_from_idx      eq144_tree_from_idx
#define tree_from_bid      eq144_tree_from_bid
#define getindex           eq144_getindex
#define bucketid           eq144_bucketid
#define slotid0            eq144_slotid0
#define slotid1            eq144_slotid1
#define minu32             eq144_minu32
#define htalloc_new        eq144_htalloc_new
#define htalloc_alloc      eq144_htalloc_alloc
#define htalloc_free       eq144_htalloc_free
#define alloctrees         eq144_alloctrees
#define dealloctrees       eq144_dealloctrees
#define equi_new           eq144_new
#define equi_free          eq144_free
#define equi_setstate      eq144_setstate
#define equi_clearslots    eq144_clearslots
#define getslot            eq144_getslot
#define getnslots          eq144_getnslots
#define orderindices       eq144_orderindices
#define listindices0       eq144_listindices0
#define listindices1       eq144_listindices1
#define candidate          eq144_candidate
#define showbsizes         eq144_showbsizes
#define htlayout_new       eq144_htlayout_new
#define getxhash0          eq144_getxhash0
#define getxhash1          eq144_getxhash1
#define htlayout_equal     eq144_htlayout_equal
#define equi_digit0        eq144_digit0
#define equi_digitodd      eq144_digitodd
#define equi_digiteven     eq144_digiteven
#define equi_digitK        eq144_digitK
#define equi_nsols         eq144_nsols
#define equi_sols          eq144_sols
#define worker             eq144_worker
#define hashsize           eq144_hashsize
#define hashwords          eq144_hashwords
#define getni              eq144_getni
#define listindices        eq144_listindices
#define printsol           eq144_printsol
#define collisiondata_clear eq144_collisiondata_clear
#define addslot            eq144_addslot
#define nextcollision      eq144_nextcollision
#define slot               eq144_slot

#include "equi_miner.c"
