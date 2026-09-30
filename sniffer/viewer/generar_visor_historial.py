#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  VISOR Y DASHBOARD DE HISTORIAL DE VENTAS Y TRANSACCIONES - DOFUS UNITY 3.6
===============================================================================
  Genera una interfaz interactiva de alta fidelidad para:
  - Visualizar los 900+ registros del historial de ventas de Dofus Unity.
  - Filtros en tiempo real: Estado (Vendidos / Sin vender), Categoría, Fechas, Búsqueda.
  - Métricas económicas clave: Total Kamas, Ventas del día, Ticket promedio.
  - Exportación a CSV, Excel y JSON limpio.
===============================================================================
"""

import os
import sys
import json
import webbrowser
import datetime

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

VIEWER_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
SNIFFER_DIR = os.path.abspath(os.path.join(VIEWER_DIR, ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(SNIFFER_DIR, ".."))

CONFIG_DIR = os.path.join(SNIFFER_DIR, "config")
DATA_DIR = os.path.join(SNIFFER_DIR, "data")

SALES_JSON = os.path.join(DATA_DIR, "historial_ventas_capturado.json")
VIEWER_HTML = os.path.join(VIEWER_DIR, "visor_historial.html")

ITEMS_TYPE_FILE = os.path.join(CONFIG_DIR, "items_type_db.json")
ITEMS_SUPER_TYPE_FILE = os.path.join(CONFIG_DIR, "items_super_type_db.json")

EQUIPMENT_TYPES = {
    'Espada', 'Amuleto', 'Arco', 'Daga', 'Anillo', 'Bota', 'Botas', 'Varita', 'Bastón', 'Baston',
    'Martillo', 'Pala', 'Cinturón', 'Cinturon', 'Sombrero', 'Capa', 'Escudo', 'Trofeo',
    'Mascota', 'Mascotura', 'Montura', 'Ropaje', 'Dofus', 'Prisma'
}

CONSUMABLE_TYPES = {
    'Poción', 'Pocion', 'Pan', 'Carne', 'Carne comestible', 'Pescado comestible',
    'Comida para mascota', 'Caramelo', 'Bebida', 'Fruta', 'Dulce', 'Consumible'
}

def get_item_category_name(item_id, item_name="", type_map=None, super_type_map=None):
    if not type_map:
        type_map = {}
        if os.path.exists(ITEMS_TYPE_FILE):
            try:
                with open(ITEMS_TYPE_FILE, "r", encoding="utf-8") as f:
                    type_map = json.load(f)
            except Exception:
                pass

    if not super_type_map:
        super_type_map = {}
        if os.path.exists(ITEMS_SUPER_TYPE_FILE):
            try:
                with open(ITEMS_SUPER_TYPE_FILE, "r", encoding="utf-8") as f:
                    super_type_map = json.load(f)
            except Exception:
                pass

    sid = str(item_id)
    t_name = type_map.get(sid, "")
    st_name = super_type_map.get(sid, "")

    if "Runa" in item_name or t_name == "Runa de forjamagia":
        return "Runa"
    if t_name in EQUIPMENT_TYPES or st_name in ('Equipo', 'Mascota', 'Capa'):
        return "Equipo"
    if t_name in CONSUMABLE_TYPES or st_name == 'Consumibles':
        return "Consumible"
    if "Cosm" in st_name or "Cosm" in t_name:
        return "Cosmético"
    if "misión" in st_name.lower() or "mision" in st_name.lower():
        return "Misión"
    return "Recurso"

def generate_sales_html(sales_data):
    metadata = sales_data.get("metadata", {})
    sales_list = sales_data.get("sales", [])

    total_sales = metadata.get("totalSales", len(sales_list))
    captured_at = metadata.get("capturedAt", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    type_map = {}
    if os.path.exists(ITEMS_TYPE_FILE):
        try:
            with open(ITEMS_TYPE_FILE, "r", encoding="utf-8") as f:
                type_map = json.load(f)
        except Exception:
            pass

    super_type_map = {}
    if os.path.exists(ITEMS_SUPER_TYPE_FILE):
        try:
            with open(ITEMS_SUPER_TYPE_FILE, "r", encoding="utf-8") as f:
                super_type_map = json.load(f)
        except Exception:
            pass

    # Enriquecer categorías si no las tienen y normalizar status
    for s in sales_list:
        if not s.get("category"):
            s["category"] = get_item_category_name(s.get("itemId", 0), s.get("name", ""), type_map, super_type_map)
        if "status" not in s:
            s["status"] = "Sin vender" if s.get("isUnsold") else "Vendido"

    sold_count = sum(1 for s in sales_list if s.get("status") == "Vendido")
    unsold_count = sum(1 for s in sales_list if s.get("status") == "Sin vender")
    sold_kamas = sum(s.get("price", 0) for s in sales_list if s.get("status") == "Vendido")
    unsold_kamas = sum(s.get("price", 0) for s in sales_list if s.get("status") == "Sin vender")
    total_units = sum(s.get("quantity", 1) for s in sales_list)
    total_kamas = sold_kamas

    json_str = json.dumps(sales_list, ensure_ascii=False)

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DBHDV - Historial de Ventas (Dofus Unity 3.6)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg-dark: #0f131a;
      --card-bg: #161c27;
      --card-border: #263042;
      --primary: #f59e0b;
      --primary-light: #fbbf24;
      --kamas-gold: #f6c443;
      --text-main: #f3f4f6;
      --text-dim: #94a3b8;
      --accent-green: #10b981;
      --accent-blue: #38bdf8;
      --accent-purple: #c084fc;
      --table-header: #1a2233;
      --table-row-hover: #1e283d;
      --table-row-alt: #131822;
    }}

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      font-family: 'Inter', -apple-system, sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      min-height: 100vh;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}

    .container {{
      max-width: 1440px;
      margin: 0 auto;
      width: 100%;
    }}

    /* HEADER */
    .header {{
      background: linear-gradient(135deg, #1b2333 0%, #151b27 100%);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 24px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }}

    .title-area h1 {{
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .title-area p {{
      color: var(--text-dim);
      font-size: 13px;
      margin-top: 4px;
    }}

    .badge-pill {{
      background: rgba(245, 158, 11, 0.15);
      color: var(--primary-light);
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }}

    /* METRICS / STATS */
    .stats-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }}

    .stat-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
      overflow: hidden;
    }}

    .stat-card::after {{
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--primary);
    }}

    .stat-card.green::after {{ background: var(--accent-green); }}
    .stat-card.blue::after {{ background: var(--accent-blue); }}
    .stat-card.purple::after {{ background: var(--accent-purple); }}

    .stat-label {{
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      font-weight: 600;
    }}

    .stat-value {{
      font-family: 'Outfit', sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 6px;
    }}

    .kamas-icon {{
      color: var(--kamas-gold);
      font-weight: 800;
    }}

    /* FILTER BAR */
    .filter-panel {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 18px 22px;
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
      justify-content: space-between;
    }}

    .filter-group {{
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }}

    .search-input {{
      background: #0d1117;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 9px 14px;
      border-radius: 8px;
      font-size: 14px;
      width: 260px;
      outline: none;
      transition: border-color 0.2s;
    }}

    .search-input:focus {{
      border-color: var(--primary);
    }}

    .select-dropdown {{
      background: #0d1117;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 9px 14px;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      cursor: pointer;
    }}

    .btn {{
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      border: 1px solid transparent;
    }}

    .btn-primary {{
      background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
      color: #000;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
    }}

    .btn-primary:hover {{
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
    }}

    .btn-secondary {{
      background: #1f293d;
      color: var(--text-main);
      border-color: var(--card-border);
    }}

    .btn-secondary:hover {{
      background: #27354f;
    }}

    /* TABLE */
    .table-wrapper {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }}

    th {{
      background: var(--table-header);
      padding: 14px 18px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      font-weight: 700;
      border-bottom: 1px solid var(--card-border);
      cursor: pointer;
      user-select: none;
    }}

    th:hover {{
      color: var(--text-main);
    }}

    td {{
      padding: 13px 18px;
      font-size: 14px;
      border-bottom: 1px solid #1a2233;
    }}

    tr:nth-child(even) {{
      background: var(--table-row-alt);
    }}

    tr:hover {{
      background: var(--table-row-hover);
    }}

    .item-cell {{
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
    }}

    .item-icon {{
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: #0d1117;
      border: 1px solid #283548;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      overflow: hidden;
    }}

    .item-icon img {{
      width: 100%;
      height: 100%;
      object-fit: contain;
    }}

    .cat-badge {{
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }}

    .cat-equipo {{ background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }}
    .cat-consumible {{ background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }}
    .cat-recurso {{ background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }}
    .cat-runa {{ background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.3); }}

    .status-badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }}

    .status-vendido {{
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }}
    .status-sinvender {{
      background: rgba(220, 38, 38, 0.18);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.45);
    }}

    .price-tag {{
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      color: var(--kamas-gold);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 15px;
    }}

    .footer-bar {{
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--table-header);
      font-size: 13px;
      color: var(--text-dim);
    }}

    .empty-state {{
      padding: 48px;
      text-align: center;
      color: var(--text-dim);
      font-size: 15px;
    }}
  </style>
</head>
<body>

  <div class="container header">
    <div class="title-area">
      <h1>🪙 Historial de Ventas y Transacciones <span class="badge-pill">Dofus Unity 3.6</span></h1>
      <p>Registro completo decodificado en tiempo real • Captura: {captured_at}</p>
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-secondary" onclick="exportCSV()">📥 Exportar CSV</button>
      <button class="btn btn-primary" onclick="exportJSON()">💾 Descargar JSON</button>
    </div>
  </div>

  <div class="container stats-grid">
    <div class="stat-card">
      <span class="stat-label">Total Kamas Generadas</span>
      <span class="stat-value" id="kpi-kamas">{sold_kamas:,} <span class="kamas-icon">₭</span></span>
      <span style="font-size:11px; color:var(--text-dim); margin-top:2px;">+ {unsold_kamas:,} ₭ retenidas en oferta</span>
    </div>
    <div class="stat-card green">
      <span class="stat-label">Ventas Finalizadas</span>
      <span class="stat-value" id="kpi-sold">{sold_count:,}</span>
      <span style="font-size:11px; color:#34d399; margin-top:2px;">100% cobradas en banco</span>
    </div>
    <div class="stat-card blue" style="border-left: 3px solid #f87171;">
      <span class="stat-label">En Venta (Sin Vender)</span>
      <span class="stat-value" id="kpi-unsold" style="color:#f87171;">{unsold_count:,}</span>
      <span style="font-size:11px; color:var(--text-dim); margin-top:2px;">{unsold_kamas:,} ₭ en mercadillo</span>
    </div>
    <div class="stat-card purple">
      <span class="stat-label">Unidades Totales</span>
      <span class="stat-value" id="kpi-units">{total_units:,} u.</span>
      <span style="font-size:11px; color:var(--text-dim); margin-top:2px;">{total_sales:,} registros totales</span>
    </div>
  </div>

  <div class="container filter-panel">
    <div class="filter-group">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Buscar por nombre o ID..." oninput="applyFilters()">
      
      <select id="statusFilter" class="select-dropdown" onchange="applyFilters()">
        <option value="ALL">Vendidos y sin vender ({total_sales:,})</option>
        <option value="Vendido">Solo Vendidos ({sold_count:,})</option>
        <option value="Sin vender">Solo Sin vender ({unsold_count:,})</option>
      </select>

      <select id="categoryFilter" class="select-dropdown" onchange="applyFilters()">
        <option value="ALL">Todas las categorías</option>
        <option value="Equipo">Equipo</option>
        <option value="Consumible">Consumible</option>
        <option value="Recurso">Recurso</option>
        <option value="Runa">Runa</option>
      </select>
    </div>

    <div class="filter-group">
      <span id="filteredCountText" style="font-size:13px; color:var(--text-dim); font-weight:600;">Mostrando {total_sales:,} registros</span>
    </div>
  </div>

  <div class="container table-wrapper">
    <table>
      <thead>
        <tr>
          <th onclick="setSort('date')">Fecha ⬍</th>
          <th onclick="setSort('name')">Nombre ⬍</th>
          <th onclick="setSort('category')">Categoría ⬍</th>
          <th onclick="setSort('quantity')" style="text-align:center;">Cantidad ⬍</th>
          <th onclick="setSort('price')" style="text-align:right;">Precio ⬍</th>
          <th style="text-align:center;">Estado</th>
        </tr>
      </thead>
      <tbody id="tableBody">
      </tbody>
    </table>
    <div class="footer-bar">
      <span id="footerSummary">Total visible: {total_sales:,} registros</span>
      <span id="footerTotalKamas" style="font-weight:700; color:var(--kamas-gold);">Total: {total_kamas:,} ₭</span>
    </div>
  </div>

  <script>
    const ALL_SALES = {json_str};
    let currentFiltered = [...ALL_SALES];
    let sortField = 'date';
    let sortAsc = false;

    function renderTable() {{
      const tbody = document.getElementById("tableBody");
      tbody.innerHTML = "";

      if (currentFiltered.length === 0) {{
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No se encontraron ventas que coincidan con los filtros.</td></tr>`;
        return;
      }}

      let visibleKamas = 0;
      let visibleUnits = 0;
      let visibleSold = 0;
      let visibleUnsold = 0;

      const fragment = document.createDocumentFragment();
      for (const s of currentFiltered) {{
        visibleKamas += (s.price || 0);
        visibleUnits += (s.quantity || 1);
        if (s.status === "Vendido") visibleSold++;
        else visibleUnsold++;

        const tr = document.createElement("tr");

        let catClass = "cat-recurso";
        if (s.category === "Equipo") catClass = "cat-equipo";
        else if (s.category === "Consumible") catClass = "cat-consumible";
        else if (s.category === "Runa") catClass = "cat-runa";

        const statusClass = s.status === "Vendido" ? "status-vendido" : "status-sinvender";
        const iconUrl = `https://api.dofusdb.fr/img/items/${{s.itemId}}.png`;

        tr.innerHTML = `
          <td style="color:var(--text-dim); font-size:13px; font-variant-numeric: tabular-nums;">${{s.date || 'S/F'}}</td>
          <td>
            <div class="item-cell">
              <div class="item-icon">
                <img src="${{iconUrl}}" onerror="this.parentElement.innerHTML='📦'">
              </div>
              <div>
                <span>${{s.name || 'Objeto #' + s.itemId}}</span>
                <span style="font-size:11px; color:var(--text-dim); display:block;">ID: ${{s.itemId}}</span>
              </div>
            </div>
          </td>
          <td><span class="cat-badge ${{catClass}}">${{s.category || 'Recurso'}}</span></td>
          <td style="text-align:center; font-weight:600;">${{(s.quantity || 1).toLocaleString()}}</td>
          <td style="text-align:right;">
            <span class="price-tag">${{(s.price || 0).toLocaleString()}} <span class="kamas-icon">₭</span></span>
          </td>
          <td style="text-align:center;"><span class="status-badge ${{statusClass}}">${{s.status}}</span></td>
        `;
        fragment.appendChild(tr);
      }}

      tbody.appendChild(fragment);

      document.getElementById("filteredCountText").innerText = `Mostrando ${{currentFiltered.length.toLocaleString()}} de ${{ALL_SALES.length.toLocaleString()}} registros`;
      document.getElementById("footerSummary").innerText = `Mostrando ${{currentFiltered.length.toLocaleString()}} transacciones (${{visibleSold.toLocaleString()}} vendidas, ${{visibleUnsold.toLocaleString()}} sin vender) • ${{visibleUnits.toLocaleString()}} unidades`;
      document.getElementById("footerTotalKamas").innerHTML = `Total visible: ${{visibleKamas.toLocaleString()}} <span class="kamas-icon">₭</span>`;
    }}

    function applyFilters() {{
      const query = document.getElementById("searchInput").value.trim().toLowerCase();
      const status = document.getElementById("statusFilter").value;
      const category = document.getElementById("categoryFilter").value;

      currentFiltered = ALL_SALES.filter(s => {{
        if (query) {{
          const name = (s.name || "").toLowerCase();
          const sid = String(s.itemId || "");
          if (!name.includes(query) && !sid.includes(query)) return false;
        }}
        if (status !== "ALL" && s.status !== status) return false;
        if (category !== "ALL" && s.category !== category) return false;
        return true;
      }});

      sortData();
      renderTable();
    }}

    function setSort(field) {{
      if (sortField === field) {{
        sortAsc = !sortAsc;
      }} else {{
        sortField = field;
        sortAsc = field === 'name' || field === 'category';
      }}
      sortData();
      renderTable();
    }}

    function sortData() {{
      currentFiltered.sort((a, b) => {{
        if (sortField === 'date') {{
          let timeA = a.timestamp || (a.rawDate ? new Date(a.rawDate).getTime() : 0);
          let timeB = b.timestamp || (b.rawDate ? new Date(b.rawDate).getTime() : 0);
          return sortAsc ? timeA - timeB : timeB - timeA;
        }}

        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'price' || sortField === 'quantity' || sortField === 'itemId') {{
          valA = Number(valA || 0);
          valB = Number(valB || 0);
          return sortAsc ? valA - valB : valB - valA;
        }}

        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }});
    }}

    function exportJSON() {{
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentFiltered, null, 2));
      const a = document.createElement("a");
      a.setAttribute("href", dataStr);
      a.setAttribute("download", "historial_ventas_filtrado.json");
      document.body.appendChild(a);
      a.click();
      a.remove();
    }}

    function exportCSV() {{
      let csv = "Fecha,ID,Nombre,Categoria,Cantidad,Precio,Estado\\n";
      for (const s of currentFiltered) {{
        const row = [
          `"${{s.date || ''}}"`,
          s.itemId,
          `"${{(s.name || '').replace(/"/g, '""')}}"`,
          `"${{s.category || ''}}"`,
          s.quantity || 1,
          s.price || 0,
          `"${{s.status || ''}}"`
        ].join(",");
        csv += row + "\\n";
      }}
      const blob = new Blob(["\\uFEFF" + csv], {{ type: 'text/csv;charset=utf-8;' }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "historial_ventas.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }}

    // Inicio
    sortData();
    renderTable();
  </script>
</body>
</html>
"""
    return html_content

def process_and_open_viewer(data_dict=None):
    if not data_dict and os.path.exists(SALES_JSON):
        try:
            with open(SALES_JSON, "r", encoding="utf-8") as f:
                data_dict = json.load(f)
        except Exception as e:
            print(f"[Error leyendo {SALES_JSON}]: {e}")

    if not data_dict:
        data_dict = {
            "metadata": {
                "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "totalSales": 0,
                "totalKamas": 0,
                "totalUnits": 0
            },
            "sales": []
        }

    html = generate_sales_html(data_dict)
    with open(VIEWER_HTML, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"  ✓ Visor generado exitosamente en: {VIEWER_HTML}")
    webbrowser.open(f"file://{os.path.abspath(VIEWER_HTML)}")

if __name__ == "__main__":
    process_and_open_viewer()
