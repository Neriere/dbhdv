@echo off
setlocal EnableDelayedExpansion
title Dofus Unity - Sincronizador de Mercadillo (HDV)

:: Auto-elevacion de permisos a Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
cls
echo =====================================================================
echo       DOFUS UNITY - MERCADILLO AUTO-SYNC (DBHDV)
echo =====================================================================
echo.

:: 1. Comprobar si Python esta instalado
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Python no esta instalado o no se anadio al PATH.
    echo.
    echo Por favor descarga e instala Python desde: https://www.python.org/downloads/
    echo Recuerda marcar la casilla: 'Add Python to PATH' durante la instalacion.
    echo.
    pause
    exit /b 1
)

:: 2. Instalar dependencias requeridas automaticamente si faltan
echo Verificando librerias de Python (scapy, requests)...
python -c "import scapy, requests" >nul 2>&1
if %errorLevel% neq 0 (
    echo Instalando librerias necesarias, un momento por favor...
    pip install scapy requests
    if %errorLevel% neq 0 (
        echo.
        echo [ERROR] Hubo un problema al instalar las dependencias con pip.
        pause
        exit /b 1
    )
    echo Librerias instaladas con exito.
    echo.
)

:: 3. Ejecutar el sincronizador
echo Iniciando sincronizador de paquetes...
echo.

if exist "dofus_sniffer.py" (
    python dofus_sniffer.py
) else if exist "..\dofus_sniffer.py" (
    python ..\dofus_sniffer.py
) else if exist "sniffer_standalone.py" (
    python sniffer_standalone.py
) else (
    echo [Aviso] Ejecutando scripts\sniffer_standalone.py...
    python scripts\sniffer_standalone.py
)

echo.
pause
