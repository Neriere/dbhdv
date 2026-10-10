# -*- coding: utf-8 -*-
"""
exporters/html_viewer.py
Generación y apertura de visores HTML locales para almacén e historial de ventas.
"""
import os
import sys
import json
import subprocess
import urllib.request
from core.config import (
    VIEWER_DIR,
    VIEWER_HTML,
    GENERATOR_SCRIPT,
    SALES_VIEWER_HTML,
    SALES_GENERATOR_SCRIPT,
    INVENTORY_OUTPUT,
    SALES_OUTPUT,
    log_sniffer_event,
)

def launch_html_file(file_path):
    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        return False
    try:
        if sys.platform == "win32" and hasattr(os, "startfile"):
            os.startfile(abs_path)
            return True
        import webbrowser
        webbrowser.open(f"file:///{abs_path.replace(os.sep, '/')}")
        return True
    except Exception:
        try:
            import webbrowser
            webbrowser.open(f"file:///{abs_path.replace(os.sep, '/')}")
            return True
        except Exception:
            return False


def ensure_viewer_generator(generator_path, script_name):
    if os.path.exists(generator_path) and os.path.getsize(generator_path) > 1000:
        return True
    print(f"  [Descargando componente interactivo: {script_name}...] ")
    os.makedirs(os.path.dirname(generator_path), exist_ok=True)
    urls = [
        f"https://raw.githubusercontent.com/Neriere/dbhdv/main/sniffer/viewer/{script_name}",
        f"{DEFAULT_API_URL}/api/market/viewer-script?file={script_name}",
    ]
    import urllib.request
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DBHDV-Suite/3.6"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                content = resp.read()
                if len(content) > 1000:
                    with open(generator_path, "wb") as f_out:
                        f_out.write(content)
                    print(f"  ✓ {script_name} instalado correctamente.")
                    return True
        except Exception:
            pass
    return False

def generate_fallback_storage_html(data_dict, output_html_path):
    os.makedirs(os.path.dirname(output_html_path), exist_ok=True)
    items_list = data_dict.get("items", []) if isinstance(data_dict, dict) else (data_dict if isinstance(data_dict, list) else [])
    meta = data_dict.get("metadata", {}) if isinstance(data_dict, dict) else {}
    captured_at = meta.get("capturedAt", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    total_slots = len(items_list)
    total_units = sum(it.get("quantity", 1) for it in items_list)
    unique_items = len(set(it.get("itemId", 0) for it in items_list))
    items_json = json.dumps(items_list, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visor de Almacén Unificado | Dofus Unity 3.6</title>
  <style>
    :root {{
      --bg: #0b0f19;
      --card-bg: #131b2e;
      --card-border: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --accent: #f59e0b;
      --emerald: #10b981;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
    body {{ background: var(--bg); color: var(--text); padding: 24px; }}
    .container {{ max-width: 1400px; margin: 0 auto; }}
    header {{ display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--card-border); }}
    h1 {{ font-size: 1.75rem; background: linear-gradient(135deg, #f59e0b, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
    .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }}
    .stat-card {{ background: var(--card-bg); border: 1px solid var(--card-border); padding: 18px; border-radius: 12px; }}
    .stat-val {{ font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 4px; }}
    .stat-lbl {{ font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }}
    .controls {{ display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }}
    .search-input {{ flex: 1; min-width: 280px; padding: 12px 16px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; color: #fff; font-size: 1rem; outline: none; }}
    .search-input:focus {{ border-color: var(--primary); }}
    .btn {{ padding: 12px 20px; background: var(--primary); border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; transition: 0.2s; }}
    .btn:hover {{ opacity: 0.9; }}
    .table-container {{ background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; overflow: hidden; }}
    table {{ width: 100%; border-collapse: collapse; text-align: left; }}
    th, td {{ padding: 14px 18px; border-bottom: 1px solid var(--card-border); }}
    th {{ background: rgba(0,0,0,0.2); color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; }}
    tr:hover td {{ background: rgba(255,255,255,0.02); }}
    .badge {{ display: inline-block; padding: 4px 10px; background: rgba(16, 185, 129, 0.15); color: var(--emerald); border-radius: 20px; font-weight: 700; font-size: 0.9rem; }}
    .item-id {{ color: var(--text-muted); font-size: 0.85rem; margin-left: 6px; }}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Dashboard de Almacén Unificado</h1>
        <p style="color:var(--text-muted); margin-top:4px;">Capturado el {captured_at} • DBHDV Suite Unificada</p>
      </div>
      <div>
        <button class="btn" onclick="exportJSON()">Exportar JSON</button>
      </div>
    </header>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-lbl">Slots de Almacén</div>
        <div class="stat-val">{total_slots:,}</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Unidades Totales</div>
        <div class="stat-val">{total_units:,}</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Recursos Únicos</div>
        <div class="stat-val">{unique_items:,}</div>
      </div>
    </div>

    <div class="controls">
      <input type="text" id="searchInput" class="search-input" placeholder="Buscar por nombre o ID de objeto..." oninput="renderTable()">
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 80px;">#</th>
            <th>Objeto</th>
            <th style="text-align: right; width: 180px;">Cantidad Total</th>
          </tr>
        </thead>
        <tbody id="itemsTable"></tbody>
      </table>
    </div>
  </div>

  <script>
    const allItems = {items_json};
    function renderTable() {{
      const query = document.getElementById('searchInput').value.toLowerCase().trim();
      const filtered = allItems.filter(it => {{
        if (!query) return true;
        const name = (it.name || '').toLowerCase();
        const id = String(it.itemId || '');
        return name.includes(query) || id.includes(query);
      }});

      const tbody = document.getElementById('itemsTable');
      tbody.innerHTML = filtered.map((it, idx) => `
        <tr>
          <td style="color:var(--text-muted);">${{idx + 1}}</td>
          <td><strong>${{it.name}}</strong> <span class="item-id">#${{it.itemId}}</span></td>
          <td style="text-align: right;"><span class="badge">x${{Number(it.quantity).toLocaleString()}}</span></td>
        </tr>
      `).join('');
    }}
    function exportJSON() {{
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allItems, null, 2));
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", "banco_inventario_exportado.json");
      document.body.appendChild(a);
      a.click();
      a.remove();
    }}
    renderTable();
  </script>
</body>
</html>"""
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html)
    return output_html_path

def open_storage_viewer(data_dict=None):
    if not data_dict and os.path.exists(INVENTORY_OUTPUT):
        try:
            with open(INVENTORY_OUTPUT, "r", encoding="utf-8") as f:
                data_dict = json.load(f)
        except Exception:
            pass

    if not data_dict and not os.path.exists(INVENTORY_OUTPUT):
        print("\n  ⚠️ Aún no se ha capturado el almacén.")
        print("  👉 Por favor, ejecuta la opción [2] del menú ('Sniffer Almacén Unificado')")
        print("     y abre tu Banco en Dofus Unity para capturar los slots.")
        input("\nPresiona Enter para continuar...")
        return

    print("\n[Visor] Procesando categorías y abriendo dashboard interactivo...")
    try:
        # Asegurar generador visual
        if not os.path.exists(GENERATOR_SCRIPT):
            ensure_viewer_generator(GENERATOR_SCRIPT, "generar_visor_almacen.py")

        if os.path.exists(GENERATOR_SCRIPT):
            import importlib.util
            spec = importlib.util.spec_from_file_location("generar_visor", GENERATOR_SCRIPT)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "process_and_open_viewer"):
                items_payload = data_dict.get("items", data_dict) if isinstance(data_dict, dict) else data_dict
                res_path = mod.process_and_open_viewer(items_payload)
                target_file = res_path if (res_path and os.path.exists(res_path)) else VIEWER_HTML
                launch_html_file(target_file)
                print(f"  ✓ Dashboard de almacén abierto en tu navegador: {target_file}")
                input("\nPresiona Enter para continuar...")
                return

        if os.path.exists(VIEWER_HTML):
            launch_html_file(VIEWER_HTML)
            print(f"  ✓ Visor abierto en tu navegador: {VIEWER_HTML}")
        else:
            fallback_file = generate_fallback_storage_html(data_dict, VIEWER_HTML)
            launch_html_file(fallback_file)
            print(f"  ✓ Dashboard de almacén generado y abierto en tu navegador: {fallback_file}")
    except Exception as e:
        print(f"  [Aviso]: Generando dashboard con motor autónomo ({e})...")
        try:
            fallback_file = generate_fallback_storage_html(data_dict, VIEWER_HTML)
            launch_html_file(fallback_file)
            print(f"  ✓ Dashboard de almacén generado y abierto en tu navegador: {fallback_file}")
        except Exception as e2:
            print(f"  [Error]: {e2}")
    input("\nPresiona Enter para continuar...")

def open_sales_viewer(data_dict=None):
    if not data_dict and os.path.exists(SALES_OUTPUT):
        try:
            with open(SALES_OUTPUT, "r", encoding="utf-8") as f:
                data_dict = json.load(f)
        except Exception:
            pass

    if not data_dict and not os.path.exists(SALES_OUTPUT):
        print("\n  ⚠️ Aún no se ha capturado el historial de ventas.")
        print("  👉 Por favor, ejecuta la opción [3] del menú ('Sniffer Historial de Ventas')")
        print("     y abre la pestaña 'HISTORIAL' en Dofus Unity para capturar las ventas.")
        input("\nPresiona Enter para continuar...")
        return

    print("\n[Visor] Procesando historial de ventas y abriendo dashboard interactivo...")
    try:
        if not os.path.exists(SALES_GENERATOR_SCRIPT):
            ensure_viewer_generator(SALES_GENERATOR_SCRIPT, "generar_visor_historial.py")

        if os.path.exists(SALES_GENERATOR_SCRIPT):
            import importlib.util
            spec = importlib.util.spec_from_file_location("generar_visor_historial", SALES_GENERATOR_SCRIPT)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "process_and_open_viewer"):
                res_path = mod.process_and_open_viewer(data_dict)
                target_file = res_path if (res_path and os.path.exists(res_path)) else SALES_VIEWER_HTML
                launch_html_file(target_file)
                print(f"  ✓ Dashboard de historial abierto en tu navegador: {target_file}")
                input("\nPresiona Enter para continuar...")
                return

        if os.path.exists(SALES_VIEWER_HTML):
            launch_html_file(SALES_VIEWER_HTML)
            print(f"  ✓ Visor de ventas abierto en tu navegador: {SALES_VIEWER_HTML}")
        else:
            print(f"  ⚠️ No se encontró el archivo del visor en {SALES_VIEWER_HTML}.")
    except Exception as e:
        print(f"  [Error abriendo visor de historial]: {e}")
    input("\nPresiona Enter para continuar...")

