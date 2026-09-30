@echo off
chcp 65001 >nul
title DOFUS UNITY 3.6 - DBHDV SUITE UNIFICADA
cd /d "%~dp0"

set PYTHONUNBUFFERED=1

echo ===============================================================================
echo   INICIANDO DBHDV SUITE UNIFICADA (DOFUS UNITY 3.6)
echo ===============================================================================
echo.

where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 dofus_suite.py
    goto :fin
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    python dofus_suite.py
    goto :fin
)

where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 dofus_suite.py
    goto :fin
)

echo ===============================================================================
echo  [ERROR] No se ha detectado Python en tu sistema.
echo ===============================================================================
echo  1. Descarga Python gratis desde: https://www.python.org/downloads/
echo  2. IMPORTANTE: En el instalador marca la casilla:
echo     [X] "Add Python to PATH"
echo ===============================================================================
pause
exit /b 1

:fin
echo.
pause
