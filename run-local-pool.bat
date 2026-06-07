@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"

if not exist "logs" mkdir logs

set ZION_POOL_BIND=127.0.0.1:8444
set ZION_NODE_RPC_ADDR=127.0.0.1:8443
set ZION_POOL_LOOP_COUNT=1000000
set ZION_NONCE_COUNT=4096
set ZION_NONCE_STRIDE=1024
set ZION_JOB_TTL_MS=15000
set ZION_VARDIFF_START_DIFF=1
set ZION_VARDIFF_TARGET_SECS=10

echo ===========================================================
echo  ZION Local Pool :: 127.0.0.1:8444
echo  Node RPC: 127.0.0.1:8443
echo ===========================================================
echo.

V3\target\release\server.exe
