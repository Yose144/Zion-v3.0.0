@echo off

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"

if not exist "logs" mkdir logs

echo ===========================================================
echo  ZION Dashboard :: http://127.0.0.1:8766
echo ===========================================================
echo.

python ZION_OS\dashboard\app.py
