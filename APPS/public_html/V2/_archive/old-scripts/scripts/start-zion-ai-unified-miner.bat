@echo off
REM 🚀 ZION AI Unified Miner - Windows Start Script
REM Revolutionary AI-powered multi-algorithm mining launcher

echo 🚀 ZION AI UNIFIED MINER 2025 🚀
echo GPU/Autolykos v2 + CPU/RandomX + CPU/Yescrypt with AI Afterburner
echo =================================================================

REM Set script directory
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set MINER_SCRIPT=%PROJECT_ROOT%\mining\zion_ai_unified_miner.py

REM Configuration
set DEFAULT_POOL=127.0.0.1:3333
set DEFAULT_WALLET=Z3NDN97SeT1Apeb4t3z1TFhBb7qr58pTQTjm9PWKFmhQWNWfeFKdEhVj6x2QDATBsuxYzUTKnS4Y42kXArkzJU5X2Vj1NMBc6Y
set DEFAULT_WORKER=zion-ai-unified

REM Functions
:print_header
echo.
echo 🔥 %~1 🔥
echo ============================================================
goto :eof

:print_success
echo ✅ %~1
goto :eof

:print_warning  
echo ⚠️  %~1
goto :eof

:print_error
echo ❌ %~1
goto :eof

:print_info
echo ℹ️  %~1
goto :eof

:check_dependencies
call :print_header "Checking Dependencies"

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Python not found!"
    exit /b 1
)
call :print_success "Python found"

REM Check required packages
python -c "import psutil, numpy" >nul 2>&1
if %errorlevel% neq 0 (
    call :print_warning "Installing required Python packages..."
    pip install psutil numpy gputil
)
call :print_success "Required Python packages available"

REM Check miner files
if not exist "%MINER_SCRIPT%" (
    call :print_error "ZION AI Unified Miner script not found!"
    exit /b 1
)
call :print_success "ZION AI Unified Miner found"

goto :eof

:show_profiles
call :print_header "Available Mining Profiles"
echo.
echo 1. Eco Champion - Yescrypt focus, 15%% eco-bonus, 80W power
echo 2. Profit Maximizer - All algorithms, maximum hashrate
echo 3. Balanced Hybrid - CPU + GPU, balanced performance
echo 4. CPU Only - Yescrypt optimized, ultra-efficient
echo 5. GPU Only - Autolykos v2, high hashrate
echo 6. Low Power - Under 100W, maximum efficiency
echo.
goto :eof

:get_profile_config
set PROFILE_NUM=%~1
if "%PROFILE_NUM%"=="1" (
    set AI_MODE=eco_bonus
    set POWER_LIMIT=150
    set PROFILE_NAME=Eco Champion
) else if "%PROFILE_NUM%"=="2" (
    set AI_MODE=profit_first
    set POWER_LIMIT=400
    set PROFILE_NAME=Profit Maximizer
) else if "%PROFILE_NUM%"=="3" (
    set AI_MODE=balanced
    set POWER_LIMIT=250
    set PROFILE_NAME=Balanced Hybrid
) else if "%PROFILE_NUM%"=="4" (
    set AI_MODE=efficiency_first
    set POWER_LIMIT=120
    set PROFILE_NAME=CPU Only
    set AFTERBURNER_OPTS=--no-afterburner
) else if "%PROFILE_NUM%"=="5" (
    set AI_MODE=profit_first
    set POWER_LIMIT=200
    set PROFILE_NAME=GPU Only
) else if "%PROFILE_NUM%"=="6" (
    set AI_MODE=efficiency_first
    set POWER_LIMIT=100
    set PROFILE_NAME=Low Power
) else (
    set AI_MODE=balanced
    set POWER_LIMIT=250
    set PROFILE_NAME=Balanced (Default)
)
goto :eof

:interactive_setup
call :print_header "Interactive Setup"

REM Show profiles
call :show_profiles

REM Profile selection
set /p PROFILE_CHOICE="Select mining profile (1-6) [3]: "
if "%PROFILE_CHOICE%"=="" set PROFILE_CHOICE=3
call :get_profile_config %PROFILE_CHOICE%

REM Pool configuration
echo.
call :print_info "Pool Configuration"
set /p POOL_INPUT="Pool address [%DEFAULT_POOL%]: "
if "%POOL_INPUT%"=="" set POOL=%DEFAULT_POOL%
if not "%POOL_INPUT%"=="" set POOL=%POOL_INPUT%

REM Wallet configuration
set /p WALLET_INPUT="ZION wallet address [default]: "
if "%WALLET_INPUT%"=="" set WALLET=%DEFAULT_WALLET%
if not "%WALLET_INPUT%"=="" set WALLET=%WALLET_INPUT%

REM Worker name
set /p WORKER_INPUT="Worker name [%DEFAULT_WORKER%]: "
if "%WORKER_INPUT%"=="" set WORKER=%DEFAULT_WORKER%
if not "%WORKER_INPUT%"=="" set WORKER=%WORKER_INPUT%

REM Advanced options
echo.
set /p MONITORING="Enable advanced monitoring? (y/N): "
if /i "%MONITORING%"=="y" set MONITORING_OPTS=--monitoring

echo.
call :print_success "Configuration complete!"
echo Profile: %PROFILE_NAME%
echo Pool: %POOL%
echo AI Mode: %AI_MODE%
echo Power Limit: %POWER_LIMIT%W
echo.
goto :eof

:start_mining
call :print_header "Starting ZION AI Unified Miner"

REM Build command
set CMD=python "%MINER_SCRIPT%"
set CMD=%CMD% --pool %POOL%
set CMD=%CMD% --wallet %WALLET%
set CMD=%CMD% --worker %WORKER%
set CMD=%CMD% --ai-mode %AI_MODE%
set CMD=%CMD% --power-limit %POWER_LIMIT%

if not "%AFTERBURNER_OPTS%"=="" set CMD=%CMD% %AFTERBURNER_OPTS%
if not "%MONITORING_OPTS%"=="" set CMD=%CMD% %MONITORING_OPTS%

call :print_info "Executing: %CMD%"
echo.

REM Change to project directory
cd /d "%PROJECT_ROOT%"

REM Start mining
%CMD%
goto :eof

:quick_start
set PROFILE=%~1
if "%PROFILE%"=="" set PROFILE=balanced

call :print_header "Quick Start - %PROFILE% Profile"

if "%PROFILE%"=="eco" call :get_profile_config 1
if "%PROFILE%"=="profit" call :get_profile_config 2
if "%PROFILE%"=="balanced" call :get_profile_config 3
if "%PROFILE%"=="cpu" call :get_profile_config 4
if "%PROFILE%"=="gpu" call :get_profile_config 5
if "%PROFILE%"=="low" call :get_profile_config 6

set POOL=%DEFAULT_POOL%
set WALLET=%DEFAULT_WALLET%
set WORKER=%DEFAULT_WORKER%

call :print_success "Using %PROFILE_NAME% profile"
call :start_mining
goto :eof

:show_stats
call :print_header "ZION AI Unified Miner Statistics"
cd /d "%PROJECT_ROOT%"
python "%MINER_SCRIPT%" --stats-only
goto :eof

:show_help
call :print_header "ZION AI Unified Miner Help"
echo.
echo Usage: %~nx0 [OPTION]
echo.
echo Options:
echo   start                   Interactive setup and start mining
echo   quick [profile]         Quick start with profile (eco^|profit^|balanced^|cpu^|gpu^|low)
echo   stats                   Show mining statistics
echo   profiles               Show available profiles
echo   deps                   Check dependencies
echo   help                   Show this help
echo.
echo Examples:
echo   %~nx0 start               # Interactive setup
echo   %~nx0 quick eco           # Quick start eco-friendly mining
echo   %~nx0 quick profit        # Quick start profit maximization
echo   %~nx0 stats               # Show current stats
echo.
echo Algorithms supported:
echo   🖥️  RandomX (CPU) - 1.0x eco-bonus
echo   ⚡ Yescrypt (CPU) - 1.15x eco-bonus (CHAMPION!)
echo   🎮 Autolykos v2 (GPU) - 1.2x eco-bonus
echo.
goto :eof

REM Main execution
set ACTION=%~1
if "%ACTION%"=="" set ACTION=start

if "%ACTION%"=="start" (
    call :check_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :interactive_setup
    call :start_mining
) else if "%ACTION%"=="quick" (
    call :check_dependencies
    if %errorlevel% neq 0 exit /b 1
    call :quick_start %~2
) else if "%ACTION%"=="stats" (
    call :show_stats
) else if "%ACTION%"=="profiles" (
    call :show_profiles
    pause
) else if "%ACTION%"=="deps" (
    call :check_dependencies
    pause
) else if "%ACTION%"=="help" (
    call :show_help
    pause
) else (
    call :print_error "Unknown option: %ACTION%"
    call :show_help
    pause
)