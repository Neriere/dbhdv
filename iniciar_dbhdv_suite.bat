@echo off
chcp 65001 >nul
cd /d "%~dp0sniffer"
call iniciar_sniffer.bat
if %errorlevel% neq 0 (
    echo.
    echo [Aviso] El proceso finalizo con codigo %errorlevel%.
    pause
)
