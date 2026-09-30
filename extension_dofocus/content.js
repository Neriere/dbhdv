/**
 * DBHDV — DoFocus Coeficientes Sync (Content Script V2)
 * Extracción totalmente automática con nombres de objetos, selector de servidor y memoria persistente entre páginas.
 */

(() => {
  if (!window.location.pathname.includes("/hdv")) return;
  if (document.getElementById("dbhdv-sync-widget")) return;

  const DOFUS_SERVERS = [
    "Draconiros",
    "Dakal",
    "Mikhal",
    "Kourial",
    "Brial",
    "Rafal",
    "Salar",
    "TalKasha",
    "HellMina",
    "Imagiro",
    "Orukam",
    "Tylezia",
    "Ombre",
  ];

  const STORAGE_KEY = "dbhdv_collector_active_session";

  // 1. Detectar servidor desde URL o storage
  const detectServerFromUrl = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const raw = parts[1] || "";
    const found = DOFUS_SERVERS.find((s) => s.toLowerCase() === raw.toLowerCase());
    return found || "Draconiros";
  };

  // 2. Cargar estado persistente de localStorage y sessionStorage (máxima durabilidad)
  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      isRunning: false,
      isPaused: false,
      server: detectServerFromUrl(),
      items: {},
    };
  };

  const saveState = (st) => {
    try {
      const json = JSON.stringify(st);
      localStorage.setItem(STORAGE_KEY, json);
      sessionStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      console.warn("[DBHDV] Storage error:", e);
    }
  };

  let state = loadState();
  const urlServer = detectServerFromUrl();
  if (window.location.pathname.includes("/hdv/") && urlServer) {
    if (state.server && state.server.toLowerCase() !== urlServer.toLowerCase()) {
      state.server = urlServer;
      state.items = {};
      state.isRunning = false;
      state.isPaused = false;
      saveState(state);
    } else {
      state.server = urlServer;
    }
  }

  let currentPage = 1;
  let totalPages = 85;
  let isMinimized = false;
  let isStepInProgress = false;

  // 3. Crear Widget Flotante
  const widget = document.createElement("div");
  widget.id = "dbhdv-sync-widget";

  const renderWidget = () => {
    const totalCount = Object.keys(state.items || {}).length;

    if (isMinimized) {
      widget.innerHTML = `
        <div class="dbhdv-minimized-pill" id="dbhdv-expand-btn" title="Expandir sincronizador de DBHDV">
          <span>⚡ DBHDV Sync (${state.server})</span>
          <span style="font-size:11px;opacity:0.8;">[${totalCount.toLocaleString()}]</span>
        </div>
      `;
      document.getElementById("dbhdv-expand-btn")?.addEventListener("click", () => {
        isMinimized = false;
        renderWidget();
      });
      return;
    }

    const pct = totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0;

    const serverOptions = DOFUS_SERVERS.map(
      (s) => `<option value="${s}" ${s === state.server ? "selected" : ""}>${s}</option>`
    ).join("");

    widget.innerHTML = `
      <div class="dbhdv-panel">
        <div class="dbhdv-header">
          <div class="dbhdv-title">
            <span>⚡ DBHDV Sync</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <select id="dbhdv-server-select" class="dbhdv-server-select" ${state.isRunning ? "disabled" : ""}>
              ${serverOptions}
            </select>
            <button id="dbhdv-minimize-btn" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:2px 4px;" title="Minimizar">_</button>
          </div>
        </div>

        <div class="dbhdv-stats-card">
          <div class="dbhdv-stat-row">
            <span class="dbhdv-stat-label">Progreso Catálogo:</span>
            <span class="dbhdv-stat-val" id="dbhdv-page-val">Pág. ${currentPage} / ${totalPages}</span>
          </div>
          <div class="dbhdv-stat-row">
            <span class="dbhdv-stat-label">Total Acumulado:</span>
            <span class="dbhdv-stat-val highlight" id="dbhdv-count-val">${totalCount.toLocaleString()} ítems</span>
          </div>
          <div class="dbhdv-progress-bar-bg">
            <div class="dbhdv-progress-bar-fill" id="dbhdv-bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="dbhdv-status-msg" id="dbhdv-status-text">
            ${
              state.isRunning
                ? (state.isPaused ? "⏸️ Extracción en pausa" : "🚀 Extrayendo páginas automáticamente...")
                : "Listo para iniciar extracción automática"
            }
          </div>
        </div>

        <div class="dbhdv-actions">
          <div class="dbhdv-btn-row">
            <button class="dbhdv-btn ${state.isRunning ? "dbhdv-btn-secondary" : "dbhdv-btn-primary"}" id="dbhdv-start-btn">
              ${
                state.isRunning
                  ? (state.isPaused ? "▶️ Reanudar" : "⏸️ Pausar")
                  : "🚀 Iniciar Auto-Extracción (1 a 85)"
              }
            </button>
            <button class="dbhdv-btn dbhdv-btn-secondary" id="dbhdv-download-btn" title="Descargar archivo JSON único con todo lo acumulado hasta ahora">
              💾 Descargar JSON
            </button>
          </div>

          <div class="dbhdv-btn-row">
            <button class="dbhdv-btn dbhdv-btn-direct" id="dbhdv-direct-sync-btn" title="Envía directamente a tu servidor local DBHDV (localhost:3000)">
              ⚡ Enviar directo a DBHDV Local
            </button>
            ${
              totalCount > 0 && !state.isRunning
                ? `<button class="dbhdv-btn dbhdv-btn-danger" id="dbhdv-reset-btn" title="Reiniciar memoria y empezar de 0">🗑️</button>`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    // Eventos
    document.getElementById("dbhdv-minimize-btn")?.addEventListener("click", () => {
      isMinimized = true;
      renderWidget();
    });

    document.getElementById("dbhdv-server-select")?.addEventListener("change", (e) => {
      const newServer = e.target.value;
      state.server = newServer;
      state.items = {};
      saveState(state);
      const targetUrl = `https://dofocus.fr/hdv/${encodeURIComponent(newServer)}?categories=equipment&page=1`;
      window.location.href = targetUrl;
    });

    document.getElementById("dbhdv-start-btn")?.addEventListener("click", () => {
      if (!state.isRunning) {
        startAutoExtraction();
      } else {
        state.isPaused = !state.isPaused;
        saveState(state);
        updateUI();
        if (!state.isPaused) {
          processCurrentPageAndAdvance();
        }
      }
    });

    document.getElementById("dbhdv-download-btn")?.addEventListener("click", () => {
      downloadConsolidatedJson(false);
    });

    document.getElementById("dbhdv-direct-sync-btn")?.addEventListener("click", directSyncToDBHDV);

    document.getElementById("dbhdv-reset-btn")?.addEventListener("click", () => {
      if (confirm("¿Deseas vaciar la memoria de ítems acumulados y reiniciar?")) {
        state.items = {};
        state.isRunning = false;
        state.isPaused = false;
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        updateUI();
        renderWidget();
      }
    });
  };

  document.body.appendChild(widget);

  const updateUI = () => {
    if (isMinimized) {
      renderWidget();
      return;
    }
    const totalCount = Object.keys(state.items || {}).length;
    const pageEl = document.getElementById("dbhdv-page-val");
    const countEl = document.getElementById("dbhdv-count-val");
    const fillEl = document.getElementById("dbhdv-bar-fill");
    const statusEl = document.getElementById("dbhdv-status-text");
    const startBtn = document.getElementById("dbhdv-start-btn");

    if (pageEl) pageEl.innerText = `Pág. ${currentPage} / ${totalPages}`;
    if (countEl) countEl.innerText = `${totalCount.toLocaleString()} ítems`;
    if (fillEl) {
      const pct = totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0;
      fillEl.style.width = `${pct}%`;
    }
    if (startBtn) {
      startBtn.innerText = state.isRunning
        ? (state.isPaused ? "▶️ Reanudar" : "⏸️ Pausar")
        : "🚀 Iniciar Auto-Extracción (1 a 85)";
      startBtn.className = `dbhdv-btn ${state.isRunning ? "dbhdv-btn-secondary" : "dbhdv-btn-primary"}`;
    }
  };

  const setStatus = (msg) => {
    const el = document.getElementById("dbhdv-status-text");
    if (el) el.innerText = msg;
  };

  // 4. Extracción de la página actual con NOMBRE DEL ÍTEM y FECHA EXACTA
  function scrapeCurrentPage() {
    const coeffCells = document.querySelectorAll("td.df-market-coefficient-column[data-market-coefficient]");
    let addedCount = 0;

    coeffCells.forEach((cell) => {
      const idStr = cell.getAttribute("data-market-coefficient");
      const itemId = Number(idStr);
      if (!itemId || isNaN(itemId)) return;

      const rawText = cell.textContent.trim();
      // Omitir ítems con coeficiente desconocido o guión
      if (rawText && !rawText.includes("Desconocido") && !rawText.includes("—")) {
        const cleanNumber = rawText.replace(/[^\d.,]/g, "").replace(",", ".");
        const coeffVal = parseFloat(cleanNumber);
        if (!isNaN(coeffVal) && coeffVal > 0) {
          const row = cell.closest("tr");
          let itemName = "";
          let dateStr = "";

          if (row) {
            // 1. Selector principal del contenedor de ítem
            const itemBox = row.querySelector(".df-market-item") || row.querySelector("th");
            if (itemBox) {
              const span = itemBox.querySelector("span");
              if (span && span.textContent.trim()) {
                itemName = span.textContent.trim();
              } else {
                const img = itemBox.querySelector("img[alt]");
                if (img && img.getAttribute("alt") && !img.getAttribute("alt").includes("http")) {
                  itemName = img.getAttribute("alt").trim();
                }
              }
            }

            // 2. Si no se encontró, probar con el input de precio
            if (!itemName) {
              const priceInput = row.querySelector("input[aria-label]");
              if (priceInput && priceInput.getAttribute("aria-label")) {
                itemName = priceInput
                  .getAttribute("aria-label")
                  .replace(/^(?:Precio para|Prix pour|Price for)\s+/i, "")
                  .trim();
              }
            }

            // 3. Fallback con el botón de romper
            if (!itemName) {
              const shatterLink = row.querySelector("a.df-market-shatter[aria-label]");
              if (shatterLink && shatterLink.getAttribute("aria-label")) {
                itemName = shatterLink
                  .getAttribute("aria-label")
                  .replace(/^(?:Romper|Briser l'objet|Shatter)\s+/i, "")
                  .trim();
              }
            }

            // 4. Fallback con texto de la celda th o td (limpiando sub-etiquetas)
            if (!itemName) {
              const firstCell = row.querySelector("th") || row.querySelector("td");
              if (firstCell) {
                const clone = firstCell.cloneNode(true);
                clone.querySelectorAll("small, button, input, svg, img").forEach((el) => el.remove());
                const txt = clone.textContent.trim();
                if (txt && !txt.startsWith("http")) itemName = txt;
              }
            }

            let exactDate = "";

            // 1. Selector específico oficial de DoFocus: <span class="df-market-freshness" title="...">
            const freshnessSpan = row.querySelector(".df-market-freshness");
            if (freshnessSpan) {
              dateStr = freshnessSpan.textContent.trim();
              if (freshnessSpan.hasAttribute("title") && freshnessSpan.getAttribute("title")) {
                exactDate = freshnessSpan.getAttribute("title").trim();
              }
            }

            const dateCell = row.querySelector(".df-market-date-column") || row.querySelector("td:nth-last-child(2)");
            if (dateCell && !exactDate) {
              if (!dateStr) dateStr = dateCell.textContent.trim();

              const titleNode = dateCell.hasAttribute("title") ? dateCell : dateCell.querySelector("[title]");
              if (titleNode && titleNode.getAttribute("title")) {
                exactDate = titleNode.getAttribute("title").trim();
              }

              if (!exactDate) {
                const timeNode = dateCell.querySelector("time");
                if (timeNode) {
                  exactDate = timeNode.getAttribute("datetime") || timeNode.getAttribute("title") || "";
                }
              }

              if (!exactDate) {
                const candidateNodes = [dateCell, ...Array.from(dateCell.querySelectorAll("*"))];
                for (const node of candidateNodes) {
                  const val =
                    node.getAttribute("data-tippy-content") ||
                    node.getAttribute("data-tooltip") ||
                    node.getAttribute("data-tip") ||
                    node.getAttribute("data-bs-title") ||
                    node.getAttribute("data-bs-original-title") ||
                    node.getAttribute("data-original-title") ||
                    node.getAttribute("data-date") ||
                    node.getAttribute("data-timestamp") ||
                    node.getAttribute("data-time") ||
                    node.getAttribute("aria-label");
                  if (val && val.trim() && val.trim() !== dateStr) {
                    exactDate = val.trim();
                    break;
                  }
                }
              }
            }

            // Guardar en el pool acumulado
            const itemData = {
              itemId: itemId,
              name: itemName || `Objeto #${itemId}`,
              coefficient: coeffVal,
              dateUpdated: dateStr || "< 1 mes",
            };
            if (exactDate) {
              itemData.exactDate = exactDate;
            }
            state.items[itemId] = itemData;
            addedCount++;
          }
        }
      }
    });

    // Detectar página actual y total desde el DOM
    const pagDiv = document.querySelector(".df-market-pagination");
    if (pagDiv) {
      const match = pagDiv.textContent.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        currentPage = parseInt(match[1]);
        totalPages = parseInt(match[2]);
      }
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const p = parseInt(urlParams.get("page") || "1");
      if (p) currentPage = p;
    }

    saveState(state);
    return addedCount;
  }

  // 5. Esperar activamente a que las filas de la tabla carguen
  async function waitForPageRows(expectedPage, previousFirstItemId = null, timeoutMs = 12000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (!state.isRunning || state.isPaused) return false;

      // 1. Verificar número de página en la paginación del DOM
      const pagDiv = document.querySelector(".df-market-pagination");
      let domPage = 0;
      if (pagDiv) {
        const match = pagDiv.textContent.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) domPage = parseInt(match[1]);
      }
      const urlPage = parseInt(new URLSearchParams(window.location.search).get("page") || "1");
      const pageMatch = domPage === expectedPage || urlPage === expectedPage || domPage === 0;

      // 2. Verificar celdas de coeficientes en el DOM
      const cells = document.querySelectorAll("td.df-market-coefficient-column[data-market-coefficient]");

      // 3. Si hay celdas cargadas y la página coincide
      if (cells.length > 0 && pageMatch) {
        const currentFirstId = cells[0].getAttribute("data-market-coefficient");
        // Si teníamos un ID previo, verificar que haya cambiado (es decir, nuevos datos reales en la tabla)
        if (!previousFirstItemId || currentFirstId !== previousFirstItemId) {
          // Pausa de 700ms para asegurar que React termine de pintar todas las 50 filas
          await new Promise((r) => setTimeout(r, 700));
          return true;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }

  // 6. Motor de Avance Automático con bucle continuo
  async function processCurrentPageAndAdvance() {
    if (isStepInProgress) return;
    isStepInProgress = true;

    try {
      while (state.isRunning && !state.isPaused) {
        // Sincronizar número de página actual
        const pagDiv = document.querySelector(".df-market-pagination");
        if (pagDiv) {
          const match = pagDiv.textContent.match(/(\d+)\s*\/\s*(\d+)/);
          if (match) {
            currentPage = parseInt(match[1]);
            totalPages = parseInt(match[2]);
          }
        } else {
          const urlParams = new URLSearchParams(window.location.search);
          const p = parseInt(urlParams.get("page") || "1");
          if (p) currentPage = p;
        }

        setStatus(`Leyendo página ${currentPage} de ${totalPages}...`);
        await waitForPageRows(currentPage);

        const added = scrapeCurrentPage();
        const totalCount = Object.keys(state.items || {}).length;
        setStatus(`Pág. ${currentPage} leída (+${added} en esta pág, total acumulado: ${totalCount.toLocaleString()})`);
        updateUI();

        // Si llegamos al final del catálogo
        if (currentPage >= totalPages) {
          setStatus(`¡Catálogo completado! (${totalCount.toLocaleString()} ítems en total) 🎉`);
          state.isRunning = false;
          state.isPaused = false;
          saveState(state);
          updateUI();
          setTimeout(() => downloadConsolidatedJson(true), 1200);
          break;
        }

        // Delay humano (2.2s a 3.2s) para no saturar DoFocus
        const delay = Math.floor(Math.random() * 1000) + 2200;
        setStatus(`Pausa de ${(delay / 1000).toFixed(1)}s antes de la página ${currentPage + 1}...`);
        await new Promise((r) => setTimeout(r, delay));

        if (!state.isRunning || state.isPaused) break;

        // Guardar el primer ID para verificar el cambio de página
        const currentCells = document.querySelectorAll("td.df-market-coefficient-column[data-market-coefficient]");
        const currentFirstId = currentCells.length > 0 ? currentCells[0].getAttribute("data-market-coefficient") : null;

        const nextPage = currentPage + 1;
        const targetUrl = `https://dofocus.fr/hdv/${encodeURIComponent(state.server)}?categories=equipment&page=${nextPage}`;

        // Intentar clic en el botón siguiente
        const nextBtn =
          document.querySelector('button.df-market-page-button[data-shattering-page="next"]') ||
          document.querySelector('button[aria-label="Next page"]') ||
          document.querySelector('button[aria-label="Page suivante"]') ||
          document.querySelector('button[aria-label="Página siguiente"]') ||
          document.querySelector('.df-market-pagination button:last-of-type');

        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
        } else {
          // Si no hay botón clickeable, navegar por URL
          window.location.href = targetUrl;
          return; // La página se recargará
        }

        // Esperar activamente a que las NUEVAS filas aparezcan en el DOM
        setStatus(`Cargando página ${nextPage}...`);
        const loaded = await waitForPageRows(nextPage, currentFirstId, 10000);
        if (loaded) {
          currentPage = nextPage;
          updateUI();
          // Continúa a la siguiente iteración del while
        } else {
          // Si la SPA no cargó las filas en 10s, navegar por URL completa
          window.location.href = targetUrl;
          return; // La página se recargará
        }
      }
    } finally {
      isStepInProgress = false;
    }
  }

  function startAutoExtraction() {
    state.isRunning = true;
    state.isPaused = false;
    saveState(state);
    updateUI();
    processCurrentPageAndAdvance();
  }

  // 7. Descarga de UN SOLO archivo JSON consolidado
  function downloadConsolidatedJson(isFinished = false) {
    const list = Object.values(state.items || {});
    if (list.length === 0) {
      alert("No hay coeficientes recolectados todavía. Pulsa 'Iniciar Auto-Extracción'.");
      return;
    }

    // Ordenar por ID para máxima legibilidad
    list.sort((a, b) => a.itemId - b.itemId);

    const exportData = {
      server: state.server,
      timestamp: Date.now(),
      total: list.length,
      coefficients: list,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `dofocus_coeficientes_${state.server}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus(`¡Descargado archivo unificado con ${list.length.toLocaleString()} ítems! ✅`);
    if (isFinished) {
      alert(
        `🎉 ¡Extracción completada con éxito!\n\nSe ha descargado el archivo consolidado:\n"dofocus_coeficientes_${state.server}_${dateStr}.json"\ncon ${list.length.toLocaleString()} equipamientos y sus nombres.\n\nAhora puedes cargarlo en DBHDV -> Gestor de Coeficientes.`
      );
    }
  }

  // 8. Sincronización directa con DBHDV local (localhost:3000)
  async function directSyncToDBHDV() {
    const list = Object.values(state.items || {});
    if (list.length === 0) {
      alert("No hay coeficientes para enviar. Inicia la extracción primero.");
      return;
    }

    setStatus("Enviando a DBHDV local (localhost:3000)...");
    try {
      const response = await fetch("http://localhost:3000/api/local-db/coefficients/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server: state.server,
          coefficients: list,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const resData = await response.json();
      setStatus(`¡Sincronizado con éxito! (${resData.updatedCount || list.length} ítems en DBHDV) ✅`);
      alert(
        `¡Éxito! Se actualizaron ${resData.updatedCount || list.length} coeficientes de ${state.server} directamente en tu DBHDV local.`
      );
    } catch (err) {
      console.warn("DBHDV local sync error:", err);
      setStatus("No se pudo conectar a localhost:3000. Descargando archivo JSON...");
      downloadConsolidatedJson(false);
      alert(
        "Aviso: DBHDV local no parece estar corriendo en http://localhost:3000.\n\nSe ha descargado el archivo JSON consolidado para que puedas importarlo en DBHDV cuando lo abras."
      );
    }
  }

  // Inicializar UI
  renderWidget();
  scrapeCurrentPage();
  updateUI();

  // Si la extracción automática ya estaba en curso al cargar la página, continuar automáticamente
  if (state.isRunning && !state.isPaused) {
    const urlP = parseInt(new URLSearchParams(window.location.search).get("page") || "1");
    if (urlP) currentPage = urlP;
    updateUI();
    setTimeout(processCurrentPageAndAdvance, 800);
  }
})();
