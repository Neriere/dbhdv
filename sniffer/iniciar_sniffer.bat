@echo off
chcp 65001 >nul
title DOFUS UNITY 3.6 - DBHDV SUITE UNIFICADA
cd /d "%~dp0"

:: Forzar salida inmediata en tiempo real sin almacenamiento en búfer
set PYTHONUNBUFFERED=1

:: Verificar permisos de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ===============================================================================
    echo   Solicitando permisos de Administrador para captura de red (Npcap/Scapy)...
    echo ===============================================================================
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ===============================================================================
echo   INICIANDO DBHDV SUITE UNIFICADA (DOFUS UNITY 3.6)
echo ===============================================================================
echo.

:: Verificar dependencias requeridas (Scapy)
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 -c "import scapy" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [Info] Instalando paquete requerido 'scapy'...
        py -3 -m pip install --quiet scapy
    )
    py -3 dofus_suite.py
    goto :fin
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    python -c "import scapy" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [Info] Instalando paquete requerido 'scapy'...
        python -m pip install --quiet scapy
    )
    python dofus_suite.py
    goto :fin
)

where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 -c "import scapy" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [Info] Instalando paquete requerido 'scapy'...
        python3 -m pip install --quiet scapy
    )
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
