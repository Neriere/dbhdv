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

:: Verificar permisos de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ===============================================================================
    echo   Solicitando permisos de Administrador para captura de red (Npcap/Scapy)...
    echo ===============================================================================
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ===================================================================
echo       DOFUS UNITY 3.6 - DBHDV SUITE UNIFICADA
echo       Servidor: ${server}
echo       Backend : ${baseUrl}
echo ===================================================================
echo.

echo [1/3] Descargando / Actualizando dofus_suite.py...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${suiteScriptUrl}" -o "dofus_suite.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${suiteScriptUrl}' -OutFile 'dofus_suite.py' -UseBasicParsing } catch { Write-Host $_.Exception.Message; exit 1 }"
)
if not exist "dofus_suite.py" (
    echo [Error] No se pudo descargar dofus_suite.py. Verifica tu conexion a internet.
    goto :error
)

echo [2/3] Verificando base de datos de items...
if not exist "items_db.json" (
    where curl >nul 2>&1
    if %errorlevel% equ 0 (
        curl -fsSL "${itemsDbDownloadUrl}" -o "items_db.json"
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${itemsDbDownloadUrl}' -OutFile 'items_db.json' -UseBasicParsing } catch { Write-Host $_.Exception.Message }"
    )
)

echo [3/3] Verificando dependencias requeridas (Scapy)...
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 -c "import scapy" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [Info] Instalando paquete 'scapy'...
        py -3 -m pip install --quiet scapy
    )
    goto :run_py
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    python -c "import scapy" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [Info] Instalando paquete 'scapy'...
        python -m pip install --quiet scapy
    )
    goto :run_python
)

where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 -c "import scapy" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [Info] Instalando paquete 'scapy'...
        python3 -m pip install --quiet scapy
    )
    goto :run_python3
)

goto :no_python

:run_py
echo.
echo ===================================================================
echo  Iniciando DBHDV Suite Unificada...
echo ===================================================================
py -3 dofus_suite.py
goto :fin

:run_python
echo.
echo ===================================================================
echo  Iniciando DBHDV Suite Unificada...
echo ===================================================================
python dofus_suite.py
goto :fin

:run_python3
echo.
echo ===================================================================
echo  Iniciando DBHDV Suite Unificada...
echo ===================================================================
python3 dofus_suite.py
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
