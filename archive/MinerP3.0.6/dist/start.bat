@echo off
REM ZION Public Miner v3.1.0 — one-click start for Windows
REM This binary auto-detects NVIDIA (CUDA), AMD/Intel (OpenCL) and CPU.

cd /d "%~dp0"
start /min "ZION Miner" zion-miner.exe %*
