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
    "Ombre"
  ];

  const STORAGE_KEY = "dbhdv_collector_active_session";

  // 1. Detectar servidor desde URL o storage
  const detectServerFromUrl = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const raw = parts[1] || "";
    const found = DOFUS_SERVERS.find((s) => s.toLowerCase() === raw.toLowerCase());
    return found || "Draconiros";
  };

  // 2. Cargar estado persistente de sessionStorage
  const loadState = () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    } catch {}
  };

  let state = loadState();
  // Sincronizar servidor si la URL contiene uno explícito
  const urlServer = detectServerFromUrl();
  if (window.location.pathname.includes("/hdv/") && urlServer) {
    state.server = urlServer;
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
          <span style="font-size:11px;opacity:0.8;">[${totalCount}]</span>
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
      saveState(state);
      // Navegar a la página 1 del nuevo servidor si es diferente
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

  // 4. Extracción de la página actual con NOMBRE DEL ÍTEM
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

              // Atributo title directo o en hijos (span, time, abbr, div)
              const titleNode = dateCell.hasAttribute("title") ? dateCell : dateCell.querySelector("[title]");
              if (titleNode && titleNode.getAttribute("title")) {
                exactDate = titleNode.getAttribute("title").trim();
              }

              // 2. Elemento <time datetime="...">
              if (!exactDate) {
                const timeNode = dateCell.querySelector("time");
                if (timeNode) {
                  exactDate = timeNode.getAttribute("datetime") || timeNode.getAttribute("title") || "";
                }
              }

              // 3. Atributos data-* de tooltips (Tippy, Bootstrap, Radix, Tailwind, etc.)
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

              // 4. Propiedades JS en el nodo (_tippy, etc.)
              if (!exactDate) {
                const candidateNodes = [dateCell, ...Array.from(dateCell.querySelectorAll("*"))];
                for (const node of candidateNodes) {
                  if (node._tippy?.props?.content) {
                    const c = node._tippy.props.content;
                    exactDate = typeof c === "string" ? c.trim() : (c.textContent || "").trim();
                    if (exactDate) break;
                  }
                }
              }

              // 5. Simular hover (mouseenter) si es un tooltip perezoso
              if (!exactDate) {
                try {
                  dateCell.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
                  const afterTitle = dateCell.getAttribute("title") || dateCell.querySelector("[title]")?.getAttribute("title");
                  if (afterTitle && afterTitle.trim() !== dateStr) {
                    exactDate = afterTitle.trim();
                  }
                } catch {}
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
      // Intentar leer de los parámetros de URL
      const urlParams = new URLSearchParams(window.location.search);
      const p = parseInt(urlParams.get("page") || "1");
      if (p) currentPage = p;
    }

    saveState(state);
    updateUI();
    return addedCount;
  }

  // 5. Motor de Avance Automático
  async function processCurrentPageAndAdvance() {
    if (isStepInProgress) return;
    isStepInProgress = true;

    try {
      if (!state.isRunning || state.isPaused) {
        isStepInProgress = false;
        return;
      }

      setStatus(`Leyendo página ${currentPage} de ${totalPages}...`);
      scrapeCurrentPage();

      const totalCount = Object.keys(state.items || {}).length;

      // Si llegamos a la última página
      if (currentPage >= totalPages) {
        setStatus(`¡Catálogo completado! (${totalCount.toLocaleString()} ítems en total) 🎉`);
        state.isRunning = false;
        state.isPaused = false;
        saveState(state);
        updateUI();
        setTimeout(() => downloadConsolidatedJson(true), 1200);
        isStepInProgress = false;
        return;
      }

      // Tiempo de espera entre 2200ms y 3200ms (ritmo humano para no saturar)
      const delay = Math.floor(Math.random() * 1000) + 2200;
      setStatus(`Esperando ${(delay / 1000).toFixed(1)}s antes de la página ${currentPage + 1}...`);
      await new Promise((r) => setTimeout(r, delay));

      if (!state.isRunning || state.isPaused) {
        isStepInProgress = false;
        return;
      }

      const nextPage = currentPage + 1;
      const targetUrl = `https://dofocus.fr/hdv/${encodeURIComponent(state.server)}?categories=equipment&page=${nextPage}`;

      // Intentar hacer clic en el botón siguiente
      const nextBtn =
        document.querySelector('button.df-market-page-button[data-shattering-page="next"]') ||
        document.querySelector('button[aria-label="Next page"]') ||
        document.querySelector('button[aria-label="Page suivante"]') ||
        document.querySelector('button[aria-label="Página siguiente"]') ||
        document.querySelector('.df-market-pagination button:last-of-type');

      const startPage = currentPage;
      if (nextBtn && !nextBtn.disabled) {
        nextBtn.click();
      } else {
        // Si no hay botón clickeable en el DOM, navegar por URL
        window.location.href = targetUrl;
        return;
      }

      // Vigilante activo de cambio de página (maneja transiciones SPA sin recarga total)
      let elapsed = 0;
      const pollTimer = setInterval(() => {
        elapsed += 400;
        const pagDiv = document.querySelector(".df-market-pagination");
        let detectedPage = startPage;
        if (pagDiv) {
          const match = pagDiv.textContent.match(/(\d+)\s*\/\s*(\d+)/);
          if (match) detectedPage = parseInt(match[1]);
        }
        const urlP = parseInt(new URLSearchParams(window.location.search).get("page") || "0");

        // Si la página avanzó en la SPA
        if (detectedPage === nextPage || urlP === nextPage) {
          clearInterval(pollTimer);
          currentPage = nextPage;
          updateUI();
          setTimeout(() => {
            processCurrentPageAndAdvance();
          }, 800);
          return;
        }

        // Si pasaron más de 3.2 segundos y no cambió, forzar navegación directa por URL
        if (elapsed >= 3200) {
          clearInterval(pollTimer);
          if (currentPage !== nextPage) {
            window.location.href = targetUrl;
          }
        }
      }, 400);

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

  // 6. Descarga de UN SOLO archivo JSON consolidado
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

  // 7. Sincronización directa con DBHDV local (localhost:3000)
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

  // Si la extracción automática ya estaba en curso al cargar la página, continuar automáticamente
  if (state.isRunning && !state.isPaused) {
    setTimeout(processCurrentPageAndAdvance, 1000);
  }

  // Observador de cambios en el DOM para cuando DoFocus actualiza la tabla mediante SPA
  const observer = new MutationObserver(() => {
    if (state.isRunning && !state.isPaused && !isStepInProgress) {
      const pagDiv = document.querySelector(".df-market-pagination");
      if (pagDiv) {
        const match = pagDiv.textContent.match(/(\d+)\s*\/\s*(\d+)/);
        if (match && parseInt(match[1]) !== currentPage) {
          processCurrentPageAndAdvance();
        }
      }
    }
  });

  const tableContainer = document.querySelector("table") || document.body;
  observer.observe(tableContainer, { childList: true, subtree: true });
})();
