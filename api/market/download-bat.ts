export default function handler(req: any, res: any) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-ssl"] === "on" ? "https" : "https");
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.headers["host"] ||
    "dbhdv.vercel.app";
  const baseUrl = `${proto}://${host}`;
  const server = (req.query.server as string) || "Draconiros";

  const suiteScriptUrl = `${baseUrl}/api/market/suite-script`;
  const itemsDbDownloadUrl = `${baseUrl}/api/market/download-items-db`;

  const batContent = `@echo off
chcp 65001 >nul
title Dofus Unity 3.6 - DBHDV Suite Unificada (${server})
cd /d "%~dp0"

:: Forzar salida inmediata en tiempo real sin almacenamiento en búfer
set PYTHONUNBUFFERED=1
set DBHDV_API_URL=${baseUrl}

:: Configurar directorio de caché seguro para Scapy/Pip (evita errores de permisos en Windows ~/.cache)
if not defined XDG_CACHE_HOME set "XDG_CACHE_HOME=%LOCALAPPDATA%\\cache"
if not exist "%LOCALAPPDATA%\\cache" mkdir "%LOCALAPPDATA%\\cache" >nul 2>&1

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
        echo    1. Haz clic derecho sobre este archivo .bat
        echo    2. Selecciona "Ejecutar como administrador"
        echo ===============================================================================
        echo.
        pause
    )
    exit /b
)

echo ===================================================================
echo       DOFUS UNITY 3.6 - DBHDV SUITE UNIFICADA
echo       Servidor: ${server}
echo       Backend : ${baseUrl}
echo ===================================================================
echo.

echo [1/3] Descargando / Actualizando dofus_suite.py...
set "DOWNLOADED="
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${suiteScriptUrl}" -o "dofus_suite.py.tmp" 2>nul
    if exist "dofus_suite.py.tmp" (
        move /y "dofus_suite.py.tmp" "dofus_suite.py" >nul
        set "DOWNLOADED=1"
    )
)
if not defined DOWNLOADED (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${suiteScriptUrl}' -OutFile 'dofus_suite.py' -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
)
if not exist "dofus_suite.py" (
    echo [Error] No se pudo descargar dofus_suite.py y no existe una copia local.
    echo Verifica tu conexion a internet o la disponibilidad del backend.
    goto :error
)

echo [2/3] Verificando base de datos de items...
if not exist "items_db.json" (
    where curl >nul 2>&1
    if %errorlevel% equ 0 (
        curl -fsSL "${itemsDbDownloadUrl}" -o "items_db.json" 2>nul
    )
    if not exist "items_db.json" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${itemsDbDownloadUrl}' -OutFile 'items_db.json' -UseBasicParsing } catch { exit 0 }" >nul 2>&1
    )
)

if not exist "viewer\\generar_visor_almacen.py" (
    if not exist "viewer" mkdir "viewer" >nul 2>&1
    where curl >nul 2>&1
    if %errorlevel% equ 0 (
        curl -fsSL "https://raw.githubusercontent.com/Neriere/dbhdv/main/sniffer/viewer/generar_visor_almacen.py" -o "viewer\\generar_visor_almacen.py" 2>nul
        curl -fsSL "https://raw.githubusercontent.com/Neriere/dbhdv/main/sniffer/viewer/generar_visor_historial.py" -o "viewer\\generar_visor_historial.py" 2>nul
    )
)

echo [3/3] Verificando dependencias requeridas (Scapy)...
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

for /d %%D in ("%LOCALAPPDATA%\\Programs\\Python\\Python*") do (
    if exist "%%D\\python.exe" (
        set "PY_CMD=\\"%%D\\python.exe\\""
        goto :check_scapy
    )
)

goto :no_python

:check_scapy
%PY_CMD% -c "import scapy" >nul 2>&1
if %errorlevel% neq 0 (
    echo [Info] Instalando paquete 'scapy'...
    %PY_CMD% -m pip install --quiet scapy
)

echo.
echo ===================================================================
echo  Iniciando DBHDV Suite Unificada...
echo ===================================================================
%PY_CMD% dofus_suite.py
goto :fin

:no_python
echo.
echo ===================================================================
echo  [ERROR] No se ha detectado Python en tu sistema.
echo ===================================================================
echo  1. Descarga Python gratis desde: https://www.python.org/downloads/
echo  2. IMPORTANTE: En el instalador marca la casilla:
echo     [X] "Add Python to PATH"
echo ===================================================================
goto :fin

:error
echo.
echo ===================================================================
echo  El proceso se detuvo por un error de descarga.
echo ===================================================================

:fin
echo.
echo ===================================================================
echo  Proceso finalizado.
echo ===================================================================
pause
`;

  const safeFilename = `dbhdv_suite_${server.toLowerCase().replace(/[^a-z0-9]/g, "_")}.bat`;
  const crlfBat = batContent.replace(/\r?\n/g, "\r\n");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeFilename}"`,
  );
  res.setHeader("Content-Type", "application/x-bat; charset=utf-8");
  return res.send(crlfBat);
}
