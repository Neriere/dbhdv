/**
 * Script recolector para ejecutar en la consola del navegador (F12) dentro de https://dofocus.fr/hdv
 * Incluye extracción de nombres de objetos, memoria persistente entre páginas y descarga de archivo único consolidado.
 */
export const DOFUS_BROWSER_COLLECTOR_SCRIPT = `(() => {
  if (!window.location.pathname.includes("/hdv")) {
    alert("⚠️ Este script debe ejecutarse en https://dofocus.fr/hdv");
    return;
  }

  const DOFUS_SERVERS = [
    "Draconiros", "Dakal", "Mikhal", "Kourial", "Brial", "Rafal", "Salar",
    "TalKasha", "HellMina", "Imagiro", "Orukam", "Tylezia", "Ombre"
  ];
  const STORAGE_KEY = "dbhdv_collector_active_session";

  const detectServer = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const raw = parts[1] || "";
    const found = DOFUS_SERVERS.find(s => s.toLowerCase() === raw.toLowerCase());
    return found || "Draconiros";
  };

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { isRunning: false, isPaused: false, server: detectServer(), items: {} };
  };

  const saveState = (st) => {
    try {
      const j = JSON.stringify(st);
      localStorage.setItem(STORAGE_KEY, j);
      sessionStorage.setItem(STORAGE_KEY, j);
    } catch {}
  };

  let state = loadState();
  let currentPage = 1;
  let totalPages = 85;

  const existingPanel = document.getElementById("dbhdv-collector-panel");
  if (existingPanel) existingPanel.remove();

  const panel = document.createElement("div");
  panel.id = "dbhdv-collector-panel";
  panel.style.cssText = "position:fixed;top:20px;right:20px;z-index:999999;background:rgba(15,23,42,0.96);border:2px solid #f59e0b;border-radius:16px;padding:16px;width:330px;box-shadow:0 20px 45px rgba(0,0,0,0.7);color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;font-size:13px;backdrop-filter:blur(10px);";
  
  const serverOptions = DOFUS_SERVERS.map(s => '<option value="' + s + '" ' + (s === state.server ? 'selected' : '') + '>' + s + '</option>').join("");
  panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong style="color:#fbbf24;font-size:14px;">⚡ Recolector DBHDV</strong><select id="col-server-sel" style="background:#1e293b;color:#38bdf8;border:1px solid #334155;border-radius:8px;padding:2px 6px;font-weight:bold;font-size:11px;">' + serverOptions + '</select></div><div style="background:#090d16;padding:10px 12px;border-radius:10px;margin-bottom:12px;border:1px solid #1e293b;"><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#94a3b8;">Progreso:</span><span id="col-progress" style="font-weight:bold;color:#fff;">Página 1...</span></div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#94a3b8;">Total acumulado:</span><span id="col-count" style="font-weight:bold;color:#10b981;">0 ítems</span></div><div id="col-status" style="margin-top:6px;font-size:11px;color:#fbbf24;font-style:italic;">Listo para iniciar</div></div><div style="display:flex;gap:8px;"><button id="col-start-btn" style="flex:1;padding:8px;background:#f59e0b;border:none;border-radius:8px;color:#0f172a;font-weight:bold;cursor:pointer;">🚀 Iniciar Auto (1-85)</button><button id="col-download-btn" style="flex:1;padding:8px;background:#334155;border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;">💾 Descargar</button></div>';
  document.body.appendChild(panel);

  const statusEl = document.getElementById("col-status");
  const progressEl = document.getElementById("col-progress");
  const countEl = document.getElementById("col-count");
  const startBtn = document.getElementById("col-start-btn");
  const downloadBtn = document.getElementById("col-download-btn");
  const serverSel = document.getElementById("col-server-sel");

  serverSel.onchange = (e) => {
    state.server = e.target.value;
    saveState(state);
    window.location.href = "https://dofocus.fr/hdv/" + encodeURIComponent(state.server) + "?categories=equipment&page=1";
  };

  function updateDisplay() {
    const total = Object.keys(state.items || {}).length;
    progressEl.innerText = "Página " + currentPage + " / " + totalPages;
    countEl.innerText = total.toLocaleString() + " ítems";
    if (state.isRunning) {
      startBtn.innerText = state.isPaused ? "▶️ Reanudar" : "⏸️ Pausar";
      startBtn.style.background = state.isPaused ? "#10b981" : "#475569";
      startBtn.style.color = "#fff";
    } else {
      startBtn.innerText = "🚀 Iniciar Auto (1-85)";
      startBtn.style.background = "#f59e0b";
      startBtn.style.color = "#0f172a";
    }
  }

  function downloadJson(isFinal = false) {
    const list = Object.values(state.items || {});
    if (list.length === 0) { alert("No hay coeficientes recolectados aún."); return; }
    list.sort((a, b) => a.itemId - b.itemId);
    const exportData = { server: state.server, timestamp: Date.now(), total: list.length, coefficients: list };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "dofocus_coeficientes_" + state.server + "_" + dateStr + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    statusEl.innerText = "¡Descargado archivo con " + list.length + " ítems!";
  }

  downloadBtn.onclick = () => downloadJson(false);

  function scrapePage() {
    const cells = document.querySelectorAll("td.df-market-coefficient-column[data-market-coefficient]");
    cells.forEach(cell => {
      const itemId = Number(cell.getAttribute("data-market-coefficient"));
      if (!itemId || isNaN(itemId)) return;
      const rawText = cell.textContent.trim();
      if (rawText && !rawText.includes("Desconocido") && !rawText.includes("—")) {
        const coeffVal = parseFloat(rawText.replace(/[^\\d.,]/g, "").replace(",", "."));
        if (!isNaN(coeffVal) && coeffVal > 0) {
          const row = cell.closest("tr");
          let itemName = "";
          let dateStr = "";
          if (row) {
            const itemBox = row.querySelector(".df-market-item") || row.querySelector("th");
            if (itemBox) {
              const span = itemBox.querySelector("span");
              if (span && span.textContent.trim()) itemName = span.textContent.trim();
              else {
                const img = itemBox.querySelector("img[alt]");
                if (img && img.getAttribute("alt") && !img.getAttribute("alt").includes("http")) itemName = img.getAttribute("alt").trim();
              }
            }
            if (!itemName) {
              const nameEl = row.querySelector("input[aria-label]");
              if (nameEl) itemName = nameEl.getAttribute("aria-label").replace(/^(?:Precio para|Prix pour|Price for)\\s+/i, "").trim();
            }
            if (!itemName) {
              const shatterLink = row.querySelector("a.df-market-shatter[aria-label]");
              if (shatterLink) itemName = shatterLink.getAttribute("aria-label").replace(/^(?:Romper|Briser l'objet|Shatter)\\s+/i, "").trim();
            }
            if (!itemName) {
              const firstCell = row.querySelector("th") || row.querySelector("td");
              if (firstCell) {
                const clone = firstCell.cloneNode(true);
                clone.querySelectorAll("small, button, input, svg, img").forEach(el => el.remove());
                const txt = clone.textContent.trim();
                if (txt && !txt.startsWith("http")) itemName = txt;
              }
            }
            let exactDate = "";
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
              if (titleNode && titleNode.getAttribute("title")) exactDate = titleNode.getAttribute("title").trim();
            }
              if (!exactDate) {
                const timeNode = dateCell.querySelector("time");
                if (timeNode) exactDate = timeNode.getAttribute("datetime") || timeNode.getAttribute("title") || "";
              }
              if (!exactDate) {
                const candidateNodes = [dateCell, ...Array.from(dateCell.querySelectorAll("*"))];
                for (const node of candidateNodes) {
                  const val = node.getAttribute("data-tippy-content") || node.getAttribute("data-tooltip") || node.getAttribute("data-tip") || node.getAttribute("data-bs-title") || node.getAttribute("data-date") || node.getAttribute("aria-label");
                  if (val && val.trim() && val.trim() !== dateStr) { exactDate = val.trim(); break; }
                }
              }
              if (!exactDate) {
                try {
                  dateCell.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
                  const afterTitle = dateCell.getAttribute("title") || dateCell.querySelector("[title]")?.getAttribute("title");
                  if (afterTitle && afterTitle.trim() !== dateStr) exactDate = afterTitle.trim();
                } catch {}
              }
            }
            const itemData = { itemId, name: itemName || ("Objeto #" + itemId), coefficient: coeffVal, dateUpdated: dateStr || "< 1 mes" };
            if (exactDate) itemData.exactDate = exactDate;
            state.items[itemId] = itemData;
          }
        }
      }
    });

    const pagDiv = document.querySelector(".df-market-pagination");
    if (pagDiv) {
      const match = pagDiv.textContent.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
      if (match) { currentPage = parseInt(match[1]); totalPages = parseInt(match[2]); }
    }
    saveState(state);
    updateDisplay();
  }

  async function waitForPageRows(expectedPage, previousFirstItemId = null, timeoutMs = 12000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (!state.isRunning || state.isPaused) return false;
      const pagDiv = document.querySelector(".df-market-pagination");
      let domPage = 0;
      if (pagDiv) {
        const match = pagDiv.textContent.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
        if (match) domPage = parseInt(match[1]);
      }
      const urlPage = parseInt(new URLSearchParams(window.location.search).get("page") || "1");
      const pageMatch = domPage === expectedPage || urlPage === expectedPage || domPage === 0;
      const cells = document.querySelectorAll("td.df-market-coefficient-column[data-market-coefficient]");
      if (cells.length > 0 && pageMatch) {
        const currentFirstId = cells[0].getAttribute("data-market-coefficient");
        if (!previousFirstItemId || currentFirstId !== previousFirstItemId) {
          await new Promise(r => setTimeout(r, 600));
          return true;
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  let isStepInProgress = false;

  async function stepAndAdvance() {
    if (isStepInProgress) return;
    isStepInProgress = true;

    try {
      while (state.isRunning && !state.isPaused) {
        const pagDiv = document.querySelector(".df-market-pagination");
        if (pagDiv) {
          const match = pagDiv.textContent.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
          if (match) { currentPage = parseInt(match[1]); totalPages = parseInt(match[2]); }
        }
        statusEl.innerText = "Cargando página " + currentPage + "...";
        await waitForPageRows(currentPage);
        scrapePage();

        if (currentPage >= totalPages) {
          statusEl.innerText = "¡Completado 100%! 🎉 Descargando...";
          state.isRunning = false;
          saveState(state);
          updateDisplay();
          setTimeout(() => downloadJson(true), 1200);
          break;
        }

        const delay = Math.floor(Math.random() * 1000) + 2200;
        statusEl.innerText = "Pausa " + (delay / 1000).toFixed(1) + "s antes de pág. " + (currentPage + 1) + "...";
        await new Promise(r => setTimeout(r, delay));

        if (!state.isRunning || state.isPaused) break;

        const currentCells = document.querySelectorAll("td.df-market-coefficient-column[data-market-coefficient]");
        const currentFirstId = currentCells.length > 0 ? currentCells[0].getAttribute("data-market-coefficient") : null;

        const nextPage = currentPage + 1;
        const targetUrl = "https://dofocus.fr/hdv/" + encodeURIComponent(state.server) + "?categories=equipment&page=" + nextPage;

        const nextBtn = document.querySelector('button.df-market-page-button[data-shattering-page="next"]') ||
          document.querySelector('button[aria-label="Next page"]') ||
          document.querySelector('button[aria-label="Page suivante"]') ||
          document.querySelector('button[aria-label="Página siguiente"]') ||
          document.querySelector('.df-market-pagination button:last-of-type');

        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
        } else {
          window.location.href = targetUrl;
          return;
        }

        statusEl.innerText = "Cargando página " + nextPage + "...";
        const loaded = await waitForPageRows(nextPage, currentFirstId, 10000);
        if (loaded) {
          currentPage = nextPage;
          updateDisplay();
        } else {
          window.location.href = targetUrl;
          return;
        }
      }
    } finally {
      isStepInProgress = false;
    }
  }

  startBtn.onclick = () => {
    if (!state.isRunning) {
      state.isRunning = true;
      state.isPaused = false;
      saveState(state);
      updateDisplay();
      stepAndAdvance();
    } else {
      state.isPaused = !state.isPaused;
      saveState(state);
      updateDisplay();
      if (!state.isPaused) stepAndAdvance();
    }
  };

  scrapePage();
  updateDisplay();
  if (state.isRunning && !state.isPaused) {
    setTimeout(stepAndAdvance, 1000);
  }
})();`;
