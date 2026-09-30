/**
 * ===============================================================================
 *   RECOLECTOR ASISTIDO DE COEFICIENTES DOFUS / DOFOCUS PARA DBHDV
 * ===============================================================================
 *   Instrucciones de uso:
 *   1. Abre en tu navegador (Chrome / Edge / Firefox) la página del mercadillo:
 *      https://dofocus.fr/hdv/Draconiros?categories=equipment&page=1
 *      (Asegúrate de haber iniciado sesión con tu cuenta de Google en DoFocus).
 *   2. Abre la consola de desarrollador presionando F12 -> pestaña "Console".
 *   3. Pega este código completo y presiona Enter.
 *   4. Aparecerá un panel flotante que irá avanzando página por página (85 páginas)
 *      a ritmo humano (2.2 a 3.4 seg por página, ~3.5 minutos en total).
 *   5. Al terminar, descargará automáticamente el archivo:
 *      dofocus_coeficientes_<Servidor>_<Fecha>.json
 *   6. Ve a DBHDV -> Rompimiento / Coeficientes -> Sincronizar -> Importar JSON,
 *      ¡y tus miles de coeficientes se actualizarán al instante!
 * ===============================================================================
 */

(() => {
  // 1. Verificación de ubicación
  if (!window.location.hostname.includes("dofocus.fr") || !window.location.pathname.includes("hdv")) {
    alert("⚠️ Este script debe ejecutarse dentro de https://dofocus.fr/hdv");
    return;
  }

  // Detectar servidor actual
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const currentServer = (pathParts[1] || "Draconiros").trim();

  // Memoria de coeficientes recolectados
  const collectedCoeffs = {};
  let isPaused = false;
  let isRunning = true;
  let currentPage = 1;
  let totalPages = 85;

  // 2. Crear Dashboard Flotante en pantalla
  const existingPanel = document.getElementById("dbhdv-collector-panel");
  if (existingPanel) existingPanel.remove();

  const panel = document.createElement("div");
  panel.id = "dbhdv-collector-panel";
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: rgba(15, 23, 42, 0.96);
    border: 2px solid #f59e0b;
    border-radius: 16px;
    padding: 16px;
    width: 330px;
    box-shadow: 0 20px 45px rgba(0,0,0,0.7);
    color: #e2e8f0;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    backdrop-filter: blur(10px);
  `;

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <strong style="color:#fbbf24; font-size:14px; display:flex; align-items:center; gap:6px;">
        <span>⚡ Recolector DBHDV</span>
      </strong>
      <span style="font-size:11px; background:#1e293b; padding:2px 8px; border-radius:12px; color:#38bdf8; border:1px solid #334155; font-weight:bold;">
        ${currentServer}
      </span>
    </div>
    <div style="background:#090d16; padding:10px 12px; border-radius:10px; margin-bottom:12px; border:1px solid #1e293b;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:#94a3b8;">Progreso:</span>
        <span id="col-progress" style="font-weight:bold; color:#fff;">Página 1 de ...</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:#94a3b8;">Coeficientes válidos:</span>
        <span id="col-count" style="font-weight:bold; color:#10b981;">0</span>
      </div>
      <div id="col-status" style="margin-top:6px; font-size:11px; color:#fbbf24; font-style:italic;">
        Iniciando recolección...
      </div>
    </div>
    <div style="display:flex; gap:8px;">
      <button id="col-pause-btn" style="flex:1; padding:8px; background:#334155; border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer;">
        ⏸️ Pausar
      </button>
      <button id="col-download-btn" style="flex:1; padding:8px; background:#f59e0b; border:none; border-radius:8px; color:#0f172a; font-weight:bold; cursor:pointer;">
        💾 Descargar
      </button>
    </div>
  `;

  document.body.appendChild(panel);

  const statusEl = document.getElementById("col-status");
  const progressEl = document.getElementById("col-progress");
  const countEl = document.getElementById("col-count");
  const pauseBtn = document.getElementById("col-pause-btn");
  const downloadBtn = document.getElementById("col-download-btn");

  pauseBtn.onclick = () => {
    isPaused = !isPaused;
    pauseBtn.innerText = isPaused ? "▶️ Reanudar" : "⏸️ Pausar";
    pauseBtn.style.background = isPaused ? "#10b981" : "#334155";
    statusEl.innerText = isPaused ? "En pausa (esperando reanudar)" : "Reanudando...";
  };

  function downloadJson() {
    const list = Object.values(collectedCoeffs);
    if (list.length === 0) {
      alert("No se recolectó ningún coeficiente aún.");
      return;
    }
    const exportData = {
      server: currentServer,
      timestamp: Date.now(),
      total: list.length,
      coefficients: list
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `dofocus_coeficientes_${currentServer}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    statusEl.innerText = `¡Descargados ${list.length} coeficientes!`;
  }

  downloadBtn.onclick = downloadJson;

  // 3. Extraer celdas de la página actual
  function scrapeCurrentPage() {
    const coeffCells = document.querySelectorAll('td.df-market-coefficient-column[data-market-coefficient]');
    let addedOnThisPage = 0;

    coeffCells.forEach(cell => {
      const idStr = cell.getAttribute("data-market-coefficient");
      const itemId = Number(idStr);
      if (!itemId || isNaN(itemId)) return;

      const rawText = cell.textContent.trim();
      // Formato típico: "414 %", "15 %", o "Desconocido" / "—"
      if (rawText && !rawText.includes("Desconocido") && !rawText.includes("—")) {
        const cleanNumber = rawText.replace(/[^\d.,]/g, "").replace(",", ".");
        const coeffVal = parseFloat(cleanNumber);
        if (!isNaN(coeffVal) && coeffVal > 0) {
          const row = cell.closest("tr");
          let dateStr = "";
          if (row) {
            const dateCell = row.querySelector(".df-market-date-column");
            if (dateCell) dateStr = dateCell.textContent.trim();
          }

          collectedCoeffs[itemId] = {
            itemId: itemId,
            coefficient: coeffVal,
            dateUpdated: dateStr || "< 1 mes"
          };
          addedOnThisPage++;
        }
      }
    });

    // Detectar paginación (ej: "1 / 85")
    const pagDiv = document.querySelector(".df-market-pagination");
    if (pagDiv) {
      const match = pagDiv.textContent.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        currentPage = parseInt(match[1]);
        totalPages = parseInt(match[2]);
      }
    }

    progressEl.innerText = `Página ${currentPage} de ${totalPages}`;
    countEl.innerText = Object.keys(collectedCoeffs).length.toLocaleString();
    return addedOnThisPage;
  }

  // 4. Bucle principal con tiempos humanos
  async function runCollector() {
    while (isRunning) {
      if (isPaused) {
        await new Promise(r => setTimeout(r, 800));
        continue;
      }

      statusEl.innerText = `Leyendo página ${currentPage}...`;
      scrapeCurrentPage();

      if (currentPage >= totalPages) {
        statusEl.innerText = "¡Recolección completada al 100%! 🎉";
        isRunning = false;
        pauseBtn.disabled = true;
        setTimeout(() => downloadJson(), 1500);
        break;
      }

      const nextBtn = document.querySelector('button.df-market-page-button[data-shattering-page="next"]');
      if (!nextBtn || nextBtn.disabled) {
        statusEl.innerText = "Esperando que cargue la tabla...";
        await new Promise(r => setTimeout(r, 1500));
        const retryNext = document.querySelector('button.df-market-page-button[data-shattering-page="next"]');
        if (!retryNext || retryNext.disabled) {
          statusEl.innerText = "Fin del catálogo alcanzado.";
          isRunning = false;
          setTimeout(() => downloadJson(), 1000);
          break;
        }
      }

      // Tiempo de espera entre 2200ms y 3300ms
      const delay = Math.floor(Math.random() * 1100) + 2200;
      statusEl.innerText = `Pausando ${(delay / 1000).toFixed(1)}s (ritmo humano)...`;
      await new Promise(r => setTimeout(r, delay));

      if (isPaused) continue;

      const buttonToClick = document.querySelector('button.df-market-page-button[data-shattering-page="next"]');
      if (buttonToClick && !buttonToClick.disabled) {
        buttonToClick.click();
        await new Promise(r => setTimeout(r, 800));
      } else {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  runCollector();
})();
