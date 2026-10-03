@echo off
chcp 65001 >nul
title DOFUS UNITY 3.6 - DBHDV SUITE UNIFICADA
cd /d "%~dp0"

:: Forzar salida inmediata en tiempo real sin almacenamiento en búfer
set PYTHONUNBUFFERED=1

:: Configurar directorio de caché seguro para Scapy/Pip (evita errores de permisos en Windows ~/.cache)
if not defined XDG_CACHE_HOME set "XDG_CACHE_HOME=%LOCALAPPDATA%\cache"
if not exist "%LOCALAPPDATA%\cache" mkdir "%LOCALAPPDATA%\cache" >nul 2>&1

:: Verificar permisos de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ===============================================================================
    echo   Solicitando permisos de Administrador para captura de red [Npcap/Scapy]...
    echo ===============================================================================
    set "BATCH_PATH=%~f0"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', ('call ' + [char]34 + $env:BATCH_PATH + [char]34)) -Verb RunAs" 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo ===============================================================================
        echo  [AVISO] No se pudo solicitar elevacion de Administrador automaticamente.
        echo  Para iniciar con permisos:
        echo    1. Haz clic derecho sobre 'iniciar_sniffer.bat' o 'iniciar_dbhdv_suite.bat'
        echo    2. Selecciona "Ejecutar como administrador"
        echo ===============================================================================
        echo.
        pause
    )
    exit /b
)

echo ===============================================================================
echo   INICIANDO DBHDV SUITE UNIFICADA (DOFUS UNITY 3.6)
echo ===============================================================================
echo.

:: Detectar ejecutable de Python
set "PY_CMD="

where py >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=py -3"
    goto :check_scapy
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=python"
    goto :check_scapy
)

where python3 >nul 2>&1
if %errorlevel% equ 0 (
    set "PY_CMD=python3"
    goto :check_scapy
)

:: Búsqueda en rutas conocidas de usuario si Python no está en PATH de Administrador
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python*") do (
    if exist "%%D\python.exe" (
        set "PY_CMD=\"%%D\python.exe\""
        goto :check_scapy
    )
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

:check_scapy
:: Verificar scapy con entorno seguro
%PY_CMD% -c "import scapy" >nul 2>&1
if %errorlevel% neq 0 (
    echo [Info] Instalando paquete requerido 'scapy'...
    %PY_CMD% -m pip install --quiet scapy
)

%PY_CMD% dofus_suite.py

:fin
echo.
pause
