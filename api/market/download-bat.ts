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
  const itemsDbDownloadUrl = `${baseUrl}/api/market/download-items-db`;

  const batContent = `@echo off
chcp 65001 >nul
title Dofus Unity - Sincronizador de Mercadillo (${server})
cd /d "%~dp0"

echo ===================================================================
echo       DOFUS UNITY - SINCRONIZADOR DE MERCADILLO
echo       Servidor: ${server}
echo ===================================================================
echo.

:: 1. Descargar/actualizar dofus_sniffer.py desde el servidor
echo [1/2] Descargando dofus_sniffer.py...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${snifferScriptUrl}" -o "dofus_sniffer.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${snifferScriptUrl}' -OutFile 'dofus_sniffer.py' -UseBasicParsing } catch { Write-Host $_.Exception.Message; exit 1 }"
)
if not exist "dofus_sniffer.py" (
    echo [ERROR] No se pudo descargar dofus_sniffer.py. Verifica tu conexion a internet.
    goto :error
)

:: 2. Descargar/actualizar la base de nombres de objetos items_db.json
echo [2/2] Descargando items_db.json...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${itemsDbDownloadUrl}" -o "items_db.json"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${itemsDbDownloadUrl}' -OutFile 'items_db.json' -UseBasicParsing } catch { Write-Host $_.Exception.Message }"
)
if not exist "items_db.json" (
    echo [Aviso] No se pudo descargar items_db.json ahora mismo. El script la descargara automaticamente al iniciar.
)

echo.
echo ===================================================================
echo  Archivos listos. Iniciando sincronizador...
echo ===================================================================
echo.

:: 3. Ejecutar con Python (el script maneja permisos de Admin automaticamente)
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
