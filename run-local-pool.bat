@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

:: ============================================================================
::  ZION Lokalni Pool — testovaci pool na loopback
::  Vyzaduje bezici node na 127.0.0.1:8443
::
::  Multi-algo: pool validuje kazdy share podle algoritmu klienta (session-based).
::  Nepotrebujes nastavovat algoritmus na poolu — miner ho posila v Hello zprave.
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"
if not exist "logs" mkdir logs

:: ── Sit ───────────────────────────────────────────────────────────────────────
set ZION_POOL_BIND=127.0.0.1:8444
set ZION_NODE_RPC_ADDR=127.0.0.1:8443
set ZION_POOL_LOOP_COUNT=1000000

:: ── Nonce okna: CPU mineri pouzivaji 4096, GPU mineri 262144 ─────────────────
set ZION_NONCE_COUNT=4096
set ZION_NONCE_COUNT_GPU=262144
set ZION_NONCE_STRIDE=1024

:: ── VarDiff ───────────────────────────────────────────────────────────────────
set ZION_JOB_TTL_MS=15000
set ZION_VARDIFF_START_DIFF=1
set ZION_VARDIFF_TARGET_SECS=10

:: ── Penazenky ─────────────────────────────────────────────────────────────────
set ZION_POOL_WALLET=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
set ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702

echo ===========================================================
echo  ZION Lokalni Pool :: 127.0.0.1:8444
echo  Node RPC : 127.0.0.1:8443
echo  Nonce    : CPU=%ZION_NONCE_COUNT%  GPU=%ZION_NONCE_COUNT_GPU%
echo ===========================================================
echo.

V3\target\release\server.exe >> logs\pool.log 2>&1
echo [EXIT] Pool skoncil s kodem %ERRORLEVEL% v %TIME%
pause
endlocal
