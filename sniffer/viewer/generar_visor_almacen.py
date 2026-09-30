#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  VISOR Y GESTOR VISUAL DE ALMACÉN / INVENTARIO / BANCO - DOFUS UNITY 3.6
===============================================================================
  Genera un dashboard interactivo moderno (HTML local autónomo) para:
  - Visualizar los 1,500+ slots del banco e inventario organizados por categoría.
  - Identificar y filtrar automáticamente OBJETOS DE MISIÓN (no comerciables).
  - Identificar almas de archimonstruos (Cosecha Eterna) con nombres reales.
  - Búsqueda en vivo por ID o nombre.
  - Seleccionar qué ítems incluir/excluir para subir a la web.
  - Exportar un JSON limpio ('almacen_filtrado_web.json') listo para la web.
===============================================================================
"""

import os
import sys
import json
import webbrowser
import datetime
from collections import defaultdict

VIEWER_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
SNIFFER_DIR = os.path.abspath(os.path.join(VIEWER_DIR, ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(SNIFFER_DIR, ".."))

CONFIG_DIR = os.path.join(SNIFFER_DIR, "config")
DATA_DIR = os.path.join(SNIFFER_DIR, "data")

STATIC_DICT_FILE = os.path.join(PROJECT_ROOT, "src", "data", "staticItemsDictionary.json")
ITEMS_DB_FILE = os.path.join(CONFIG_DIR, "items_db.json") if os.path.exists(os.path.join(CONFIG_DIR, "items_db.json")) else os.path.join(PROJECT_ROOT, "scripts", "items_db.json")
INVENTORY_JSON = os.path.join(DATA_DIR, "banco_inventario_capturado.json") if os.path.exists(os.path.join(DATA_DIR, "banco_inventario_capturado.json")) else os.path.join(PROJECT_ROOT, "banco_inventario_capturado.json")
VIEWER_HTML = os.path.join(VIEWER_DIR, "visor_almacen.html")
ITEMS_TYPE_FILE = os.path.join(CONFIG_DIR, "items_type_db.json") if os.path.exists(os.path.join(CONFIG_DIR, "items_type_db.json")) else os.path.join(PROJECT_ROOT, "scripts", "items_type_db.json")
ITEMS_SUPER_TYPE_FILE = os.path.join(CONFIG_DIR, "items_super_type_db.json") if os.path.exists(os.path.join(CONFIG_DIR, "items_super_type_db.json")) else os.path.join(PROJECT_ROOT, "scripts", "items_super_type_db.json")
CRAFT_INGREDIENTS_FILE = os.path.join(CONFIG_DIR, "craft_ingredients_ids.json") if os.path.exists(os.path.join(CONFIG_DIR, "craft_ingredients_ids.json")) else os.path.join(PROJECT_ROOT, "src", "data", "craftIngredientsIds.json")

KNOWN_QUEST_ITEM_IDS = {
    10272, 10223, 2151, 9312, 9968, 9979, 9980, 9981, 9982, 9983,
    10030, 10031, 10041, 10046, 10064, 10065, 10070, 10083, 10204,
    10285, 11701, 17442, 17443, 17444, 17460, 17772, 17774, 17777,
    17781, 17785, 17792, 18113, 18203, 18208, 18348, 18741, 18742,
    18743, 18836, 19415, 19693, 21713, 21727, 21752, 21753, 21754,
    21755, 420, 1001, 1461, 28431, 28432, 28444, 28445, 28446, 28447,
    28448, 28449, 28450, 28451, 28452, 28453, 28455, 30049, 30088
}

QUEST_KEYWORDS = [
    "(misión)", "(mision)", "objeto de misión", "objeto de mision",
    "de la misión", "de la mision", "llave de misión", "llave de mision",
    "documento de", "carta de", "orden de ejecución",
    "orden de ejecucion", "nota de", "pergamino de misión", "ficticia",
    "falso dofus", "muestra de", "recompensa de la misión"
]

EQUIPMENT_SUPER_TYPES = {
    'Amuleto', 'Arma', 'Anillo', 'Cinturón', 'Cinturon', 'Botas', 'Bota', 'Escudo', 'Sombrero', 'Capa'
}
EQUIPMENT_TYPES = {
    'Espada', 'Amuleto', 'Arco', 'Daga', 'Anillo', 'Bota', 'Botas', 'Varita', 'Bastón', 'Baston',
    'Martillo', 'Pala', 'Cinturón', 'Cinturon', 'Sombrero', 'Capa', 'Escudo', 'Hacha', 'Guadaña', 'Guadana',
    'Lanza', 'Pico', 'Dofus', 'Trofeo', 'Herramienta', 'Compañero', 'Mascota', 'Mascotura', 'Hombrera', 'Hombreras'
}
CONSUMABLE_TYPES = {
    'Carne comestible', 'Pescado comestible', 'Pan', 'Pócima', 'Pocima',
    'Pócima de teletransportación', 'Pocima de teletransportacion', 'Cerveza',
    'Golosina', 'Bebida', 'Pergamino de experiencia', 'Pergamino de característica',
    'Pergamino con un hechizo', 'Alimento boost', 'Objeto utilizable', 'Pócima de conquista',
    'Hada artificial', 'Peluche', 'Regalo'
}
QUEST_TYPES = {
    'Documento', 'Ídolos de misiones', 'Objeto de mutación', 'Objeto de dones',
    'Alineamiento', 'Fichas', 'Fichas de evento', 'Krosmoz', 'Isla de Frigost', 'Pandala', 'Diversos'
}

def load_items_map():
    items_map = {}
    if os.path.exists(STATIC_DICT_FILE):
        try:
            with open(STATIC_DICT_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, dict):
                    items_map.update({str(k): str(v) for k, v in d.items()})
        except Exception:
            pass

    if os.path.exists(ITEMS_DB_FILE):
        try:
            with open(ITEMS_DB_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                raw = d.get("items", {}) if isinstance(d, dict) else d
                if isinstance(raw, dict):
                    for k, v in raw.items():
                        if isinstance(v, dict):
                            items_map[str(k)] = v.get("name", str(k))
                        elif isinstance(v, str):
                            items_map[str(k)] = v
        except Exception:
            pass
    return items_map

def load_type_maps():
    type_db = {}
    super_db = {}
    if os.path.exists(ITEMS_TYPE_FILE):
        try:
            with open(ITEMS_TYPE_FILE, "r", encoding="utf-8") as f:
                type_db = json.load(f)
        except Exception:
            pass
    if os.path.exists(ITEMS_SUPER_TYPE_FILE):
        try:
            with open(ITEMS_SUPER_TYPE_FILE, "r", encoding="utf-8") as f:
                super_db = json.load(f)
        except Exception:
            pass
    return type_db, super_db

def load_craft_ingredients():
    if os.path.exists(CRAFT_INGREDIENTS_FILE):
        try:
            with open(CRAFT_INGREDIENTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return set(int(x) for x in data if str(x).isdigit())
                elif isinstance(data, dict):
                    return set(int(k) for k in data.keys() if str(k).isdigit())
        except Exception:
            pass
    return set()

def classify_item(item_id, item_name, type_db=None, super_db=None, craft_set=None):
    iid = int(item_id) if str(item_id).isdigit() else 0
    sid = str(iid)
    t = type_db.get(sid, '') if type_db else ''
    st = super_db.get(sid, '') if super_db else ''
    name_lower = item_name.lower()
    t_lower = t.lower()
    st_lower = st.lower()

    # 1. Almas de Archimonstruos y Jefes (Cosecha Eterna)
    # IMPORTANTE: Excluir piedras de alma vacías (son consumibles crafteables, no almas)
    is_empty_stone = (
        ("piedra de alma" in name_lower or "pierre d'âme" in name_lower) and
        not any(k in name_lower for k in ["capturada", "llena:", ":"]) and
        iid not in range(33820, 34126)
    )
    is_captured_soul = not is_empty_stone and (
        (33820 <= iid <= 34125) or
        "alma capturada:" in name_lower or
        "âme capturée" in name_lower or
        t in ("Alma de archimonstruo", "Piedra de alma llena")
    )

    if is_captured_soul:
        return {
            "category": "Archimonstruos",
            "badgeColor": "purple",
            "isQuest": False,
            "isSellable": True,
            "defaultInclude": False,  # No incluir en el banco de crafteo por defecto (tienen botón CSV Metamob)
            "icon": "👻"
        }

    # 2. Fragmentos de mapa (Búsqueda y Caza / BYC)
    # Por petición del usuario: no vale la pena subirlos al banco de crafteo ya que uno decide si vender los fragmentos o el mapa entero
    is_map_frag = (
        ("fragmento" in name_lower and "mapa" in name_lower) or
        ("trozo de mapa" in name_lower) or
        ("fragment" in name_lower and "carte" in name_lower) or
        t in ("Fragmento de mapa", "Fragment de carte")
    )
    if is_map_frag:
        return {
            "category": "Mapas / BYC",
            "badgeColor": "cyan",
            "isQuest": False,
            "isSellable": True,
            "defaultInclude": False,  # No subir fragmentos de mapa por defecto
            "icon": "🗺️"
        }

    # 3. Runas de Forjamagia
    if name_lower.startswith("runa ") or name_lower.startswith("runa de ") or t in ("Runa de forjamagia", "Runa"):
        return {
            "category": "Runas",
            "badgeColor": "cyan",
            "isQuest": False,
            "isSellable": True,
            "defaultInclude": True,
            "icon": "🔮"
        }

    # 4. Objetos de Misión (No comerciables / Quest items)
    if st == "Objeto de misión" or "misión" in st_lower or "mision" in st_lower or t in QUEST_TYPES or iid in KNOWN_QUEST_ITEM_IDS or any(k in name_lower for k in QUEST_KEYWORDS):
        return {
            "category": "Misión",
            "badgeColor": "red",
            "isQuest": True,
            "isSellable": False,
            "defaultInclude": False,
            "icon": "📜"
        }

    # 5. Equipamiento (Sets, armas, dofus, trofeos, escudos)
    if st in EQUIPMENT_SUPER_TYPES or t in EQUIPMENT_TYPES or any(name_lower.startswith(p) for p in ["dofus ", "dokoko", "dofawa", "dolmanax", "dorigami", "domakuro", "trofeo "]):
        is_craft_ingredient = (craft_set is not None and iid in craft_set)
        if is_craft_ingredient:
            return {
                "category": "Equipamiento (Crafteo)",
                "badgeColor": "emerald",
                "isQuest": False,
                "isSellable": True,
                "defaultInclude": True,  # Forma parte de una receta de crafteo
                "icon": "🛡️"
            }
        else:
            return {
                "category": "Equipamiento",
                "badgeColor": "amber",
                "isQuest": False,
                "isSellable": True,
                "defaultInclude": False,  # Equipamiento normal NO crafteable -> No exportar al banco
                "icon": "🛡️"
            }

    # 6. Consumibles (Comestibles/bebidas/pociones/pergaminos/piedras vacías)
    if t in CONSUMABLE_TYPES or is_empty_stone:
        is_craft_ingredient = (craft_set is not None and iid in craft_set)
        if is_craft_ingredient:
            return {
                "category": "Consumibles (Crafteo)",
                "badgeColor": "emerald",
                "isQuest": False,
                "isSellable": True,
                "defaultInclude": True,  # Forma parte de una receta de crafteo
                "icon": "🧪"
            }
        else:
            return {
                "category": "Consumibles",
                "badgeColor": "blue",
                "isQuest": False,
                "isSellable": True,
                "defaultInclude": False,  # Consumible NO usado en crafteo -> No exportar al banco
                "icon": "🧪"
            }

    # 7. Recursos por defecto (Todo material, carne de cazador, pescado crudo, mineral, madera, drop)
    return {
        "category": "Recursos",
        "badgeColor": "emerald",
        "isQuest": False,
        "isSellable": True,
        "defaultInclude": True,
        "icon": "🌾"
    }

def generate_viewer_html(items_list, meta=None):
    if meta is None:
        meta = {
            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "tokens": ["isb", "hlp"]
        }

    items_json_str = json.dumps(items_list, ensure_ascii=False)

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visor de Almacén e Inventario | Dofus Unity 3.6</title>
  <style>
    :root {{
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f293d;
      --text: #f3f4f6;
      --text-muted: #94a3b8;
      --accent: #f59e0b;
      --emerald: #10b981;
      --purple: #a855f7;
      --cyan: #06b6d4;
      --blue: #3b82f6;
      --red: #ef4444;
      --amber: #f59e0b;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      line-height: 1.5;
    }}
    .container {{
      max-width: 1400px;
      margin: 0 auto;
    }}
    header {{
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
    }}
    .title-box h1 {{
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #f59e0b, #fbbf24);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }}
    .title-box p {{
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-top: 4px;
    }}
    .actions-box {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    button {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }}
    .btn-primary {{
      background: #f59e0b;
      color: #000;
    }}
    .btn-primary:hover {{
      background: #d97706;
      box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
    }}
    .btn-secondary {{
      background: #1e293b;
      color: var(--text);
      border-color: #334155;
    }}
    .btn-secondary:hover {{
      background: #334155;
    }}
    .btn-danger {{
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.3);
    }}
    .btn-danger:hover {{
      background: rgba(239, 68, 68, 0.25);
    }}
    .btn-metamob {{
      background: rgba(168, 85, 247, 0.15);
      color: #d8b4fe;
      border-color: rgba(168, 85, 247, 0.35);
    }}
    .btn-metamob:hover {{
      background: rgba(168, 85, 247, 0.25);
      box-shadow: 0 0 15px rgba(168, 85, 247, 0.35);
    }}

    /* KPI Cards */
    .kpi-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }}
    .kpi-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px;
      position: relative;
      overflow: hidden;
    }}
    .kpi-card::before {{
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
    }}
    .kpi-card.amber::before {{ background: var(--amber); }}
    .kpi-card.emerald::before {{ background: var(--emerald); }}
    .kpi-card.purple::before {{ background: var(--purple); }}
    .kpi-card.red::before {{ background: var(--red); }}
    .kpi-card.cyan::before {{ background: var(--cyan); }}
    .kpi-card.blue::before {{ background: var(--blue); }}
    .kpi-title {{
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }}
    .kpi-val {{
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
      font-family: monospace;
    }}
    .kpi-sub {{
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 4px;
    }}

    /* Controls Toolbar */
    .toolbar {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }}
    .search-row {{
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }}
    .search-input-box {{
      flex: 1;
      min-width: 260px;
      position: relative;
    }}
    .search-input {{
      width: 100%;
      background: #090d16;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px 14px 10px 38px;
      color: #fff;
      font-size: 0.95rem;
      outline: none;
    }}
    .search-input:focus {{
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
    }}
    .search-icon {{
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }}
    .select-box {{
      background: #090d16;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 0.875rem;
      outline: none;
      cursor: pointer;
    }}

    .tabs-row {{
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      overflow-x: auto;
    }}
    .tab-btn {{
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 0.8125rem;
      font-weight: 600;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid transparent;
      cursor: pointer;
    }}
    .tab-btn:hover {{
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }}
    .tab-btn.active {{
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent);
      border-color: rgba(245, 158, 11, 0.3);
    }}

    /* Table */
    .table-container {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }}
    th {{
      background: #162032;
      padding: 12px 16px;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.5px;
    }}
    td {{
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: middle;
    }}
    tr:hover td {{
      background: rgba(255, 255, 255, 0.02);
    }}
    tr.excluded td {{
      opacity: 0.45;
    }}
    tr.is-quest td {{
      background: rgba(239, 68, 68, 0.03);
    }}

    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }}
    .badge-emerald {{ background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }}
    .badge-purple  {{ background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }}
    .badge-amber   {{ background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }}
    .badge-red     {{ background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }}
    .badge-cyan    {{ background: rgba(6, 182, 212, 0.15); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.3); }}
    .badge-blue    {{ background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }}

    .item-id {{
      font-family: monospace;
      color: var(--text-muted);
      font-size: 0.8125rem;
    }}
    .item-name {{
      font-weight: 600;
      color: #fff;
    }}
    .item-qty {{
      font-family: monospace;
      font-weight: 700;
      font-size: 0.9375rem;
    }}
    .toggle-checkbox {{
      width: 18px;
      height: 18px;
      accent-color: var(--accent);
      cursor: pointer;
    }}
    .empty-state {{
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-box">
        <h1>📦 Visor de Almacén e Inventario | Dofus 3.6</h1>
        <p>Capturado: <strong>{meta.get("capturedAt")}</strong> | Tokens: <code>{", ".join(meta.get("tokens", []))}</code></p>
      </div>
      <div class="actions-box">
        <button class="btn-metamob" onclick="exportMetamobCsv()" title="Genera CSV compatible con Metamob (Nombre,Cantidad) con tus archis y jefes capturados">👻 Exportar CSV Metamob</button>
        <button class="btn-danger" onclick="excludeAllQuestItems()">🚫 Excluir Todos los de Misión</button>
        <button class="btn-secondary" onclick="selectAll(true)">✅ Marcar Todo</button>
        <button class="btn-secondary" onclick="selectAll(false)">❌ Desmarcar Todo</button>
        <button class="btn-primary" onclick="exportCleanJson()">📥 Guardar JSON para Mi Banco</button>
      </div>
    </header>

    <!-- KPI Summary Grid -->
    <div class="kpi-grid">
      <div class="kpi-card amber">
        <div class="kpi-title">Total Slots</div>
        <div class="kpi-val" id="kpi-total-slots">0</div>
        <div class="kpi-sub">Puestos de inventario</div>
      </div>
      <div class="kpi-card emerald">
        <div class="kpi-title">Unidades Totales</div>
        <div class="kpi-val" id="kpi-total-units">0</div>
        <div class="kpi-sub">Recursos acumulados</div>
      </div>
      <div class="kpi-card emerald">
        <div class="kpi-title">🌾 Recursos HDV</div>
        <div class="kpi-val" id="kpi-recursos">0</div>
        <div class="kpi-sub">100% comerciables</div>
      </div>
      <div class="kpi-card emerald">
        <div class="kpi-title">🔨 Crafteo (Equip/Cons)</div>
        <div class="kpi-val" id="kpi-craftables">0</div>
        <div class="kpi-sub">Ingredientes de recetas</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-title">🛡️ Equipamiento</div>
        <div class="kpi-val" id="kpi-equip">0</div>
        <div class="kpi-sub">No crafteo (Excluido)</div>
      </div>
      <div class="kpi-card cyan">
        <div class="kpi-title">🗺️ Mapas / BYC</div>
        <div class="kpi-val" id="kpi-mapas">0</div>
        <div class="kpi-sub">Fragmentos (Excluido)</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-title">👻 Archimonstruos</div>
        <div class="kpi-val" id="kpi-archis">0</div>
        <div class="kpi-sub">CSV Metamob</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-title">📜 Objetos de Misión</div>
        <div class="kpi-val" id="kpi-quest">0</div>
        <div class="kpi-sub">No comerciables (Excluido)</div>
      </div>
    </div>

    <!-- Toolbar Filters -->
    <div class="toolbar">
      <div class="search-row">
        <div class="search-input-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="searchInput" class="search-input" placeholder="Buscar por nombre o ID (ej: Magnesita, Maxilubo, 34093)..." oninput="applyFilters()">
        </div>
        <select id="uploadFilter" class="select-box" onchange="applyFilters()">
          <option value="all">Filtro de Selección: Todos</option>
          <option value="included" selected>Solo Incluidos para Web</option>
          <option value="excluded">Solo Excluidos / Misión</option>
        </select>
        <select id="sortFilter" class="select-box" onchange="applyFilters()">
          <option value="qty-desc">Ordenar: Mayor Cantidad</option>
          <option value="qty-asc">Ordenar: Menor Cantidad</option>
          <option value="name-asc">Ordenar: Nombre A-Z</option>
          <option value="id-asc">Ordenar: ID Numérico</option>
        </select>
        <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.875rem; color: #f59e0b; cursor: pointer; user-select: none; padding: 4px 8px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.25);">
          <input type="checkbox" id="consolidateCheck" class="toggle-checkbox" onchange="applyFilters()">
          <span>⚡ Consolidar pilas duplicadas (sumar cantidades para Mi Banco)</span>
        </label>
      </div>

      <div class="tabs-row" id="categoryTabs">
        <!-- Dynamic Tabs -->
      </div>
    </div>

    <!-- Table Container -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 80px; text-align: center;">Subir</th>
            <th style="width: 100px;">ID</th>
            <th>Nombre del Objeto</th>
            <th style="width: 160px;">Categoría</th>
            <th style="width: 140px; text-align: right;">Cantidad</th>
            <th style="width: 150px;">Estado Web</th>
          </tr>
        </thead>
        <tbody id="itemsTableBody">
          <!-- Rendered via JS -->
        </tbody>
      </table>
      <div id="emptyState" class="empty-state" style="display: none;">
        No se encontraron objetos con los filtros aplicados.
      </div>
    </div>
  </div>

  <script>
    // Embedded Data
    const RAW_ITEMS = {items_json_str};

    let activeCategory = "all";
    let userSelections = {{}}; // uid -> boolean

    // Init selections
    RAW_ITEMS.forEach(it => {{
      userSelections[it.uid] = it.defaultInclude;
    }});

    function updateKPIs() {{
      const totalSlots = RAW_ITEMS.length;
      const totalUnits = RAW_ITEMS.reduce((sum, it) => sum + it.quantity, 0);
      const recursos = RAW_ITEMS.filter(it => it.category === "Recursos").length;
      const craftables = RAW_ITEMS.filter(it => it.category === "Equipamiento (Crafteo)" || it.category === "Consumibles (Crafteo)").length;
      const equip = RAW_ITEMS.filter(it => it.category === "Equipamiento").length;
      const mapas = RAW_ITEMS.filter(it => it.category === "Mapas / BYC").length;
      const archis = RAW_ITEMS.filter(it => it.category === "Archimonstruos").length;
      const quest = RAW_ITEMS.filter(it => it.category === "Misión").length;

      document.getElementById("kpi-total-slots").innerText = totalSlots.toLocaleString();
      document.getElementById("kpi-total-units").innerText = totalUnits.toLocaleString();
      document.getElementById("kpi-recursos").innerText = recursos.toLocaleString();
      document.getElementById("kpi-craftables").innerText = craftables.toLocaleString();
      document.getElementById("kpi-equip").innerText = equip.toLocaleString();
      document.getElementById("kpi-mapas").innerText = mapas.toLocaleString();
      document.getElementById("kpi-archis").innerText = archis.toLocaleString();
      document.getElementById("kpi-quest").innerText = quest.toLocaleString();
    }}

    function renderTabs() {{
      const counts = {{ all: RAW_ITEMS.length }};
      RAW_ITEMS.forEach(it => {{
        counts[it.category] = (counts[it.category] || 0) + 1;
      }});

      const tabsContainer = document.getElementById("categoryTabs");
      const categories = [
        {{ id: "all", label: "Todos", count: counts.all }},
        {{ id: "Recursos", label: "🌾 Recursos", count: counts["Recursos"] || 0 }},
        {{ id: "Equipamiento (Crafteo)", label: "🛡️ Equipamiento (Crafteo)", count: counts["Equipamiento (Crafteo)"] || 0 }},
        {{ id: "Consumibles (Crafteo)", label: "🧪 Consumibles (Crafteo)", count: counts["Consumibles (Crafteo)"] || 0 }},
        {{ id: "Equipamiento", label: "🛡️ Equipamiento (Excluido)", count: counts["Equipamiento"] || 0 }},
        {{ id: "Consumibles", label: "🧪 Consumibles (Excluido)", count: counts["Consumibles"] || 0 }},
        {{ id: "Mapas / BYC", label: "🗺️ Mapas / BYC (Excluido)", count: counts["Mapas / BYC"] || 0 }},
        {{ id: "Runas", label: "🔮 Runas", count: counts["Runas"] || 0 }},
        {{ id: "Archimonstruos", label: "👻 Archimonstruos", count: counts["Archimonstruos"] || 0 }},
        {{ id: "Misión", label: "📜 Misión", count: counts["Misión"] || 0 }},
      ].filter(cat => cat.id === "all" || cat.count > 0);

      tabsContainer.innerHTML = categories.map(cat => `
        <button class="tab-btn ${{activeCategory === cat.id ? 'active' : ''}}" onclick="setCategory('${{cat.id}}')">
          ${{cat.label}} (${{cat.count.toLocaleString()}})
        </button>
      `).join("");
    }}

    function setCategory(catId) {{
      activeCategory = catId;
      renderTabs();
      applyFilters();
    }}

    function toggleItem(uid) {{
      userSelections[uid] = !userSelections[uid];
      applyFilters();
    }}

    function selectAll(state) {{
      const query = document.getElementById("searchInput").value.toLowerCase().trim();
      RAW_ITEMS.forEach(it => {{
        if (activeCategory === "all" || it.category === activeCategory) {{
          if (!query || it.name.toLowerCase().includes(query) || String(it.itemId).includes(query)) {{
            userSelections[it.uid] = state;
          }}
        }}
      }});
      applyFilters();
    }}

    function excludeAllQuestItems() {{
      RAW_ITEMS.forEach(it => {{
        if (it.isQuest || it.category === "Misión") {{
          userSelections[it.uid] = false;
        }}
      }});
      applyFilters();
      alert("Se han desmarcado todos los objetos de misión de la subida a la web.");
    }}

    function toggleConsolidated(uids) {{
      const currentState = uids.some(u => userSelections[u]);
      uids.forEach(u => {{
        userSelections[u] = !currentState;
      }});
      applyFilters();
    }}

    function applyFilters() {{
      const query = document.getElementById("searchInput").value.toLowerCase().trim();
      const uploadFilter = document.getElementById("uploadFilter").value;
      const sortFilter = document.getElementById("sortFilter").value;
      const consolidate = document.getElementById("consolidateCheck") ? document.getElementById("consolidateCheck").checked : false;

      let filtered = RAW_ITEMS.filter(it => {{
        if (activeCategory !== "all" && it.category !== activeCategory) return false;
        if (query && !it.name.toLowerCase().includes(query) && !String(it.itemId).includes(query)) return false;
        if (uploadFilter === "included" && !userSelections[it.uid]) return false;
        if (uploadFilter === "excluded" && userSelections[it.uid]) return false;
        return true;
      }});

      let displayList = filtered;
      if (consolidate) {{
        const merged = {{}};
        filtered.forEach(it => {{
          if (!merged[it.itemId]) {{
            merged[it.itemId] = {{
              ...it,
              quantity: 0,
              stacks: [],
              uids: []
            }};
          }}
          merged[it.itemId].quantity += it.quantity;
          merged[it.itemId].stacks.push(it.quantity);
          merged[it.itemId].uids.push(it.uid);
        }});
        displayList = Object.values(merged);
      }}

      // Sort
      if (sortFilter === "qty-desc") displayList.sort((a, b) => b.quantity - a.quantity);
      else if (sortFilter === "qty-asc") displayList.sort((a, b) => a.quantity - b.quantity);
      else if (sortFilter === "name-asc") displayList.sort((a, b) => a.name.localeCompare(b.name));
      else if (sortFilter === "id-asc") displayList.sort((a, b) => a.itemId - b.itemId);

      const tbody = document.getElementById("itemsTableBody");
      const emptyState = document.getElementById("emptyState");

      if (displayList.length === 0) {{
        tbody.innerHTML = "";
        emptyState.style.display = "block";
        return;
      }}
      emptyState.style.display = "none";

      tbody.innerHTML = displayList.map(it => {{
        const isConsolidated = it.stacks && it.stacks.length > 1;
        const isSelected = isConsolidated
          ? it.uids.some(u => userSelections[u])
          : userSelections[it.uid];
        const toggleHandler = isConsolidated
          ? `toggleConsolidated([${{it.uids.map(u => `'${{u}}'`).join(',')}}])`
          : `toggleItem('${{it.uid}}')`;

        return `
          <tr class="${{isSelected ? '' : 'excluded'}} ${{it.isQuest ? 'is-quest' : ''}}">
            <td style="text-align: center;">
              <input type="checkbox" class="toggle-checkbox" ${{isSelected ? 'checked' : ''}} onchange="${{toggleHandler}}">
            </td>
            <td><span class="item-id">#${{it.itemId}}</span></td>
            <td>
              <span class="item-name">${{it.name}}</span>
              ${{isConsolidated ? `<span class="badge badge-amber" style="margin-left: 8px;">⚡ ${{it.stacks.length}} pilas (${{it.stacks.join('u + ')}}u)</span>` : ''}}
              ${{it.isQuest ? '<span class="badge badge-red" style="margin-left: 8px;">Misión</span>' : ''}}
            </td>
            <td>
              <span class="badge badge-${{it.badgeColor}}">${{it.icon}} ${{it.category}}</span>
            </td>
            <td style="text-align: right;">
              <span class="item-qty">${{it.quantity.toLocaleString()}}</span> <span style="color: var(--text-muted); font-size: 0.8rem;">u</span>
            </td>
            <td>
              ${{isSelected
                ? '<span style="color: #34d399; font-weight: 600;">✅ Incluido</span>'
                : '<span style="color: #94a3b8;">❌ Excluido</span>'}}
            </td>
          </tr>
        `;
      }}).join("");
    }}

    function exportCleanJson() {{
      // Consolidar automáticamente por itemId para "Mi Banco"
      const consolidated = {{}};
      RAW_ITEMS.filter(it => userSelections[it.uid]).forEach(it => {{
        if (!consolidated[it.itemId]) {{
          consolidated[it.itemId] = {{
            itemId: it.itemId,
            name: it.name,
            quantity: 0,
            category: it.category,
            stacksCount: 0
          }};
        }}
        consolidated[it.itemId].quantity += it.quantity;
        consolidated[it.itemId].stacksCount += 1;
      }});

      const approvedItems = Object.values(consolidated);
      approvedItems.sort((a, b) => a.name.localeCompare(b.name));

      const blob = new Blob([JSON.stringify(approvedItems, null, 2)], {{ type: "application/json" }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "almacen_filtrado_web.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`¡Archivo exportado con éxito!\nContiene ${{approvedItems.length.toLocaleString()}} objetos consolidados (cantidades sumadas listas para 'Mi Banco').`);
    }}

    function exportMetamobCsv() {{
      // 1. Filtrar solo almas capturadas (archimonstruos y jefes de mazmorra)
      const souls = RAW_ITEMS.filter(it => {{
        const name = (it.name || "").toLowerCase();
        const iid = it.itemId;
        const isSoulId = (iid >= 33820 && iid <= 34125);
        const isSoulName = name.includes("alma capturada") || name.includes("âme capturée");
        return isSoulId || isSoulName || it.category === "Archimonstruos";
      }});

      if (souls.length === 0) {{
        alert("No se encontraron piedras de alma con monstruos capturados en este almacén.");
        return;
      }}

      // 2. Limpiar el nombre del monstruo y consolidar cantidades
      const mobCounts = {{}};
      souls.forEach(s => {{
        let mobName = s.name || "";
        // Remover prefijos "Alma capturada: ", "Alma de ", "Piedra de alma de ", etc.
        mobName = mobName
          .replace(/^Alma\\s+capturada:\\s*/i, "")
          .replace(/^Piedra\\s+de\\s+alma\\s+(?:llena:\\s*|de\\s+)/i, "")
          .replace(/^Alma\\s+de\\s+/i, "")
          .replace(/^Âme\\s+capturée:\\s*/i, "")
          .trim();

        // Ignorar piedras de alma vacías (consumibles)
        if (!mobName || mobName.toLowerCase().startsWith("piedra de alma") || mobName.toLowerCase().startsWith("pierre d'âme")) {{
          return;
        }}

        mobCounts[mobName] = (mobCounts[mobName] || 0) + (s.quantity || 1);
      }});

      const sortedMobs = Object.keys(mobCounts).sort((a, b) => a.localeCompare(b));
      if (sortedMobs.length === 0) {{
        alert("No se encontraron nombres de monstruos válidos para exportar a Metamob.");
        return;
      }}

      // 3. Formato Metamob: Nombre,Cantidad
      let csvContent = "";
      for (const mob of sortedMobs) {{
        csvContent += `${{mob}},${{mobCounts[mob]}}\\n`;
      }}

      const totalSouls = Object.values(mobCounts).reduce((a, b) => a + b, 0);
      const blob = new Blob(["\\uFEFF" + csvContent], {{ type: "text/csv;charset=utf-8;" }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `metamob_almas_${{new Date().toISOString().slice(0, 10)}}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`¡CSV de Metamob exportado con éxito!\\n\\nContiene ${{sortedMobs.length.toLocaleString()}} monstruos/archis (${{totalSouls.toLocaleString()}} almas en total) en formato listo para subir a metamob.fr:\\nNombre,Cantidad`);
    }}

    // Init
    updateKPIs();
    renderTabs();
    applyFilters();
  </script>
</body>
</html>
"""
    with open(VIEWER_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)
    return VIEWER_HTML

def process_and_open_viewer(inventory_data=None):
    items_map = load_items_map()
    type_db, super_db = load_type_maps()
    craft_set = load_craft_ingredients()

    # Si no nos pasan datos directamente, leer de banco_inventario_capturado.json
    if inventory_data is None:
        if not os.path.exists(INVENTORY_JSON):
            print(f"[Aviso] No existe aún el archivo: {INVENTORY_JSON}")
            return None
        try:
            with open(INVENTORY_JSON, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                if isinstance(raw_data, dict) and "items" in raw_data:
                    inventory_data = raw_data["items"]
                elif isinstance(raw_data, list):
                    inventory_data = raw_data
                else:
                    inventory_data = []
        except Exception as e:
            print(f"[Error leyendo inventario]: {e}")
            return None

    # Enriquecer ítems con clasificaciones oficiales
    enriched_items = []
    category_counts = defaultdict(int)

    for i, it in enumerate(inventory_data):
        iid = it.get("itemId", 0)
        existing_name = it.get("name", "")
        if not existing_name or existing_name.startswith("Objeto #"):
            name = items_map.get(str(iid), existing_name or f"Objeto #{iid}")
        else:
            name = existing_name
        qty = it.get("quantity", 1)
        uid = it.get("uid") or f"uid_{iid}_{i}"

        classification = classify_item(iid, name, type_db, super_db, craft_set)
        category_counts[classification["category"]] += 1

        enriched_items.append({
            "uid": str(uid),
            "itemId": iid,
            "name": name,
            "quantity": qty,
            "category": classification["category"],
            "badgeColor": classification["badgeColor"],
            "isQuest": classification["isQuest"],
            "isSellable": classification["isSellable"],
            "defaultInclude": classification["defaultInclude"],
            "icon": classification["icon"]
        })

    # Guardar versión enriquecida en banco_inventario_capturado.json
    try:
        full_export = {
            "metadata": {
                "generatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "totalSlots": len(enriched_items),
                "totalUnits": sum(it["quantity"] for it in enriched_items),
                "categories": dict(category_counts)
            },
            "items": enriched_items
        }
        with open(INVENTORY_JSON, "w", encoding="utf-8") as f:
            json.dump(full_export, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Error guardando JSON enriquecido]: {e}")

    # Generar el HTML interactivo
    viewer_path = generate_viewer_html(enriched_items, {
        "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "tokens": ["isb", "hlp"]
    })

    print(f"\n[Éxito] Visor de Almacén generado en:\n        {viewer_path}")
    
    # Abrir en navegador
    try:
        webbrowser.open(f"file:///{os.path.abspath(viewer_path).replace(os.sep, '/')}")
    except Exception:
        pass

    return viewer_path

if __name__ == "__main__":
    process_and_open_viewer()
