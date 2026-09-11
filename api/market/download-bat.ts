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

  const snifferScriptUrl = `${baseUrl}/api/market/sniffer-script?server=${encodeURIComponent(server)}`;
  const calibratorScriptUrl = `${baseUrl}/api/market/calibrator-script`;
  const itemsDbDownloadUrl = `${baseUrl}/api/market/download-items-db`;

  const batContent = `@echo off
chcp 65001 >nul
title Dofus Unity - Sincronizador y Calibrador de Mercadillo (${server})
cd /d "%~dp0"

:: Forzar salida inmediata en tiempo real sin almacenamiento en búfer
set PYTHONUNBUFFERED=1

echo ===================================================================
echo       DOFUS UNITY - SINCRONIZADOR DE MERCADILLO
echo       Servidor: ${server}
echo ===================================================================
echo.

echo [1/3] Descargando dofus_sniffer.py...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${snifferScriptUrl}" -o "dofus_sniffer.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${snifferScriptUrl}' -OutFile 'dofus_sniffer.py' -UseBasicParsing } catch { Write-Host $_.Exception.Message; exit 1 }"
)
if not exist "dofus_sniffer.py" (
    echo [Error] No se pudo descargar dofus_sniffer.py.
    goto :error
)

echo [2/3] Descargando calibrar_token.py...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${calibratorScriptUrl}" -o "calibrar_token.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${calibratorScriptUrl}' -OutFile 'calibrar_token.py' -UseBasicParsing } catch { }"
)

echo [3/3] Verificando items_db.json...
if not exist "items_db.json" (
    where curl >nul 2>&1
    if %errorlevel% equ 0 (
        curl -fsSL "${itemsDbDownloadUrl}" -o "items_db.json"
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${itemsDbDownloadUrl}' -OutFile 'items_db.json' -UseBasicParsing } catch { Write-Host $_.Exception.Message }"
    )
)

echo.
echo ===================================================================
echo  Selecciona una opcion:
echo ===================================================================
echo  [1] Iniciar Sniffer de Mercadillo
echo  [2] Calibrar Token
echo  [3] Salir
echo ===================================================================
set /p opt="Opcion [1-3] (Presiona ENTER para Iniciar Sniffer): "
if "%opt%"=="" set opt=1
if "%opt%"=="1" goto :run_sniffer
if "%opt%"=="2" goto :run_calibrator
if "%opt%"=="3" goto :fin
goto :run_sniffer

:run_sniffer
echo.
echo ===================================================================
echo  Iniciando Sniffer de Mercadillo...
echo ===================================================================
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 dofus_sniffer.py --server "${server}"
    goto :fin
)
where python >nul 2>&1
if %errorlevel% equ 0 (
    python dofus_sniffer.py --server "${server}"
    goto :fin
)
where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 dofus_sniffer.py --server "${server}"
    goto :fin
)
goto :no_python

:run_calibrator
echo.
echo ===================================================================
echo  Iniciando Calibrador de Token...
echo ===================================================================
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 calibrar_token.py
    goto :fin
)
where python >nul 2>&1
if %errorlevel% equ 0 (
    python calibrar_token.py
    goto :fin
)
where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 calibrar_token.py
    goto :fin
)
goto :no_python

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

  const safeFilename = `sincronizar_mercadillo_${server.toLowerCase().replace(/[^a-z0-9]/g, "_")}.bat`;
  const crlfBat = batContent.replace(/\r?\n/g, "\r\n");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeFilename}"`,
  );
  res.setHeader("Content-Type", "application/x-bat; charset=utf-8");
  res.status(200).send(crlfBat);
}
