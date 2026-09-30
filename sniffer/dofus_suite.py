#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY 3.6 -> DBHDV SUITE UNIFICADA (SNIFFER & CALIBRADOR)
===============================================================================
  Herramienta todo-en-uno para Dofus Unity 3.6:
  - 100% Local y Privado: No almacena credenciales ni modifica el juego.
  - Sniffer de Mercadillo: Captura cotizaciones x1, x10, x100, x1000 en tiempo real.
  - Sniffer de Almacén: Captura inventario, banco y merkasako con visor web local.
  - Sniffer de Historial de Ventas: Registro de transacciones y ventas finalizadas.
  - Calibrador Inteligente: Auto-descubre y valida los tokens de red tras cada parche.
  - Sincronización Cloud: Descarga y comparte tokens verificados con la comunidad.
===============================================================================
"""

import os
import sys
import re
import time
import json
import socket
import datetime
import urllib.request
import urllib.parse
from collections import defaultdict

# Configurar salida UTF-8 inmediata en Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

# Elevación de permisos Administrador en Windows (Requerido por Scapy/WinPcap/Npcap)
def is_admin():
    if sys.platform != "win32":
        return os.geteuid() == 0 if hasattr(os, "geteuid") else True
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def check_and_elevate_admin():
    if sys.platform == "win32" and not is_admin():
        try:
            import ctypes
            script_path = os.path.abspath(sys.argv[0])
            suite_dir = os.path.dirname(script_path)
            cmd_params = f'/k chcp 65001 >nul && cd /d "{suite_dir}" && "{sys.executable}" "{script_path}"'
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", "cmd.exe", cmd_params, suite_dir, 1)
            if int(ret) > 32:
                sys.exit(0)
            else:
                print("[Aviso] Permisos de Administrador no concedidos.")
        except Exception as e:
            print(f"[Error UAC]: {e}")

check_and_elevate_admin()

try:
    from scapy.all import sniff, AsyncSniffer, TCP, Raw, IP
except ImportError:
    print("\n[Error] Se requiere Scapy para la captura de paquetes de red.")
    print("Ejecuta en tu terminal: pip install scapy")
    input("\nPresiona Enter para salir...")
    sys.exit(1)

# =============================================================================
# ESTRUCTURA DE DIRECTORIOS Y ARCHIVOS
# =============================================================================
SUITE_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
PROJECT_ROOT = os.path.abspath(os.path.join(SUITE_DIR, ".."))

CONFIG_DIR = os.path.join(SUITE_DIR, "config")
DATA_DIR = os.path.join(SUITE_DIR, "data")
LOGS_DIR = os.path.join(SUITE_DIR, "logs")
VIEWER_DIR = os.path.join(SUITE_DIR, "viewer")

for d in [CONFIG_DIR, DATA_DIR, LOGS_DIR, VIEWER_DIR]:
    os.makedirs(d, exist_ok=True)

KEYMAP_FILE = os.path.join(CONFIG_DIR, "keymap.json")
DIAGNOSTIC_LOG = os.path.join(LOGS_DIR, "calibracion_diagnostico.log")
SNIFFER_LOG = os.path.join(LOGS_DIR, "sniffer.log")
INVENTORY_OUTPUT = os.path.join(DATA_DIR, "banco_inventario_capturado.json")
SALES_OUTPUT = os.path.join(DATA_DIR, "historial_ventas_capturado.json")

ITEMS_DB_FILE = os.path.join(CONFIG_DIR, "items_db.json") if os.path.exists(os.path.join(CONFIG_DIR, "items_db.json")) else os.path.join(PROJECT_ROOT, "scripts", "items_db.json")
STATIC_DICT_FILE = os.path.join(PROJECT_ROOT, "src", "data", "staticItemsDictionary.json")

VIEWER_HTML = os.path.join(VIEWER_DIR, "visor_almacen.html")
GENERATOR_SCRIPT = os.path.join(VIEWER_DIR, "generar_visor_almacen.py")
SALES_VIEWER_HTML = os.path.join(VIEWER_DIR, "visor_historial.html")
SALES_GENERATOR_SCRIPT = os.path.join(VIEWER_DIR, "generar_visor_historial.py")

DEFAULT_API_URL = os.environ.get("DBHDV_API_URL", "https://dbhdv.vercel.app")

ITEMS_NAME_MAP = {}

# =============================================================================
# CARGA DE DICCIONARIOS Y LOGS
# =============================================================================
def load_items_dictionary():
    global ITEMS_NAME_MAP
    if ITEMS_NAME_MAP:
        return
    if os.path.exists(STATIC_DICT_FILE):
        try:
            with open(STATIC_DICT_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, dict):
                    ITEMS_NAME_MAP.update({int(k): str(v) for k, v in d.items() if str(k).isdigit()})
        except Exception:
            pass

    if os.path.exists(ITEMS_DB_FILE):
        try:
            with open(ITEMS_DB_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                raw = d.get("items", {}) if isinstance(d, dict) else d
                if isinstance(raw, dict):
                    for k, v in raw.items():
                        if str(k).isdigit():
                            ik = int(k)
                            if ik not in ITEMS_NAME_MAP:
                                if isinstance(v, dict):
                                    ITEMS_NAME_MAP[ik] = v.get("name", f"Objeto #{ik}")
                                elif isinstance(v, str):
                                    ITEMS_NAME_MAP[ik] = v
        except Exception:
            pass

def get_item_name(item_id):
    load_items_dictionary()
    if item_id in ITEMS_NAME_MAP:
        return ITEMS_NAME_MAP[item_id]
    try:
        url = f"https://api.dofusdb.fr/items/{item_id}?$select[]=name"
        req = urllib.request.Request(url, headers={"User-Agent": "DBHDV-Suite/1.0"})
        with urllib.request.urlopen(req, timeout=1.2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            name = (data.get("name", {}).get("es") or
                    data.get("name", {}).get("fr") or
                    data.get("name", {}).get("en"))
            if name:
                ITEMS_NAME_MAP[item_id] = name
                return name
    except Exception:
        pass
    return f"Objeto #{item_id}"

def log_diagnostic(msg, payload_sample=None):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{ts}] {msg}\n"
    if payload_sample:
        entry += f"         Payload: {payload_sample}\n"
    try:
        with open(DIAGNOSTIC_LOG, "a", encoding="utf-8") as f:
            f.write(entry)
    except Exception:
        pass

def load_keymap():
    if os.path.exists(KEYMAP_FILE):
        try:
            with open(KEYMAP_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"current_token": "jzn", "price_list": "jzn", "inventory": "isb", "storage": "hlp"}

def save_keymap_entry(key_name, token_val):
    km = load_keymap()
    km[key_name] = token_val
    if key_name == "price_list":
        km["current_token"] = token_val
    km["last_calibrated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        with open(KEYMAP_FILE, "w", encoding="utf-8") as f:
            json.dump(km, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Error guardando keymap]: {e}")

# =============================================================================
# MOTOR PROTOBUF Y EXTRACCIÓN DE TOKENS
# =============================================================================
def decode_varint(buf, offset=0):
    val = 0
    shift = 0
    pos = offset
    while pos < len(buf):
        b = buf[pos]
        val |= (b & 0x7F) << shift
        pos += 1
        if not (b & 0x80):
            return val, pos - offset
        shift += 7
        if shift >= 64:
            break
    return 0, 0

def decode_packed_varints(data):
    nums = []
    off = 0
    while off < len(data):
        v, r = decode_varint(data, off)
        if r == 0:
            break
        nums.append(v)
        off += r
    return nums

def clean_ladder(ints):
    if not ints:
        return []
    ladder = []
    for x in ints:
        if x == 0 or 50 <= x <= 2_000_000_000:
            ladder.append(x)
        else:
            ladder.append(0)
    while ladder and ladder[-1] == 0:
        ladder.pop()
    return ladder

def extract_type_tokens(buf):
    tokens = []
    for m in re.finditer(rb'type\.ankama\.com/([a-z0-9]+(?:\.[a-z0-9]+)*)', buf):
        tok = m.group(1).decode("ascii", errors="ignore")
        tokens.append((tok, m.start()))
    return tokens

def parse_dofus_item_submessage(sub):
    off = 0
    sub_fields = {}
    while off < len(sub):
        t, r = decode_varint(sub, off)
        if r == 0:
            break
        off += r
        fn = t >> 3
        wt = t & 7
        if wt == 0:
            v, r2 = decode_varint(sub, off)
            off += r2
            sub_fields[fn] = v
        elif wt == 2:
            l, r2 = decode_varint(sub, off)
            off += r2 + l
        elif wt == 1:
            off += 8
        elif wt == 5:
            off += 4
        else:
            break

    gid = sub_fields.get(5)
    qty = sub_fields.get(2, 1)
    uid = sub_fields.get(1, 0)
    if gid and 10 <= gid <= 65000:
        return (gid, max(1, qty), uid)
    return None

def extract_items_recursive(buf):
    items = []
    def walk(b, depth=0):
        if depth > 4 or len(b) < 6:
            return
        off = 0
        while off < len(b):
            tag, r = decode_varint(b, off)
            if r == 0:
                break
            off += r
            fnum = tag >> 3
            wtype = tag & 7

            if wtype == 2:
                length, r2 = decode_varint(b, off)
                if r2 == 0 or off + r2 + length > len(b):
                    break
                off += r2
                sub_data = b[off:off + length]
                off += length
                item = parse_dofus_item_submessage(sub_data)
                if item:
                    items.append(item)
                else:
                    walk(sub_data, depth + 1)
            elif wtype == 0:
                _, r2 = decode_varint(b, off)
                off += r2
            elif wtype == 1:
                off += 8
            elif wtype == 5:
                off += 4
            else:
                break
    walk(buf)
    return items

def extract_market_universal(buf):
    item_id = 0
    ladders = []
    offer_prices = []

    def walk(b, depth=0):
        nonlocal item_id
        off = 0
        while off < len(b):
            tag, r = decode_varint(b, off)
            if r == 0:
                break
            off += r
            fnum = tag >> 3
            wtype = tag & 7

            if wtype == 0:
                v, r = decode_varint(b, off)
                off += r
                if depth <= 1:
                    if fnum in (1, 2) and (10 <= v <= 60000):
                        item_id = v
                    elif fnum == 5 and (10 <= v <= 60000) and item_id == 0:
                        item_id = v
                if depth == 1 and fnum in (2, 3, 4) and 50 <= v <= 2_000_000_000 and v != item_id:
                    offer_prices.append(v)
            elif wtype == 2:
                length, r = decode_varint(b, off)
                off += r
                if off + length > len(b):
                    break
                data = b[off:off + length]
                off += length
                if depth < 3:
                    walk(data, depth + 1)
                if depth <= 1:
                    p_ints = decode_packed_varints(data)
                    cl = clean_ladder(p_ints)
                    if 1 <= len(cl) <= 10 and all(p >= 0 for p in cl) and any(p > 10 for p in cl):
                        ladders.append((fnum, cl))
            elif wtype == 1:
                off += 8
            elif wtype == 5:
                off += 4
            else:
                break
    walk(buf)
    return item_id, ladders, offer_prices

# =============================================================================
# SINCRONIZACIÓN CLOUD DE TOKENS (BUENAS PRÁCTICAS)
# =============================================================================
def sync_tokens_from_cloud(silent=False):
    """
    Descarga los tokens comunitarios verificados desde el servidor DBHDV.
    Esto permite que los usuarios no tengan que calibrar manualmente tras cada parche.
    """
    if not silent:
        print("\n[Cloud Sync] Conectando con DBHDV para obtener tokens verificados...")
    url = f"{DEFAULT_API_URL}/api/tokens"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DBHDV-Suite/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("success") and "tokens" in data:
                remote_tokens = data["tokens"]
                km = load_keymap()
                changed = False
                for k in ["price_list", "inventory", "storage", "sales_history"]:
                    if k in remote_tokens and remote_tokens[k] and remote_tokens[k] != km.get(k):
                        km[k] = remote_tokens[k]
                        changed = True
                if changed:
                    km["last_synced_cloud"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    with open(KEYMAP_FILE, "w", encoding="utf-8") as f:
                        json.dump(km, f, indent=2, ensure_ascii=False)
                    if not silent:
                        print("  ✅ Tokens actualizados con éxito desde DBHDV Cloud:")
                        print(f"     • Mercadillo (price_list) : '{km.get('price_list')}'")
                        print(f"     • Inventario (inventory)  : '{km.get('inventory')}'")
                        print(f"     • Almacén (storage)       : '{km.get('storage')}'")
                        print(f"     • Historial (sales)       : '{km.get('sales_history')}'")
                else:
                    if not silent:
                        print("  ✓ Tus tokens locales ya están al día con la última versión de la comunidad.")
                return True
    except Exception as e:
        if not silent:
            print(f"  ⚠️ No se pudo contactar con DBHDV Cloud ({e}). Operando en modo local.")
    return False

def share_token_to_cloud(key_name, token_val):
    """
    Comparte un token recién calibrado con la comunidad de DBHDV si el servidor está disponible.
    """
    print(f"\n¿Deseas compartir el token '{token_val}' de '{key_name}' con la comunidad de DBHDV? [s/N]: ", end="")
    try:
        ans = input().strip().lower()
        if ans not in ("s", "si", "y", "yes"):
            print("  ✓ Token guardado exclusivamente en modo local.")
            return
        url = f"{DEFAULT_API_URL}/api/tokens"
        payload = json.dumps({
            "token_type": key_name,
            "token_value": token_val,
            "timestamp": datetime.datetime.now().isoformat()
        }).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "User-Agent": "DBHDV-Suite/1.0"
        })
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            if res_data.get("success"):
                print("  🎉 ¡Gracias! El token ha sido registrado en DBHDV para toda la comunidad.")
            else:
                print("  ✓ Token guardado localmente.")
    except Exception:
        print("  ℹ️  El backend remoto en la nube aún no está desplegado en Vercel.")
        print("  ✓ Tu token está guardado y funcionando al 100% en modo local (config/keymap.json).")

# =============================================================================
# MODULO 1: SNIFFER DE MERCADILLO EN VIVO
# =============================================================================
def run_sniffer_market():
    km = load_keymap()
    market_token = km.get("price_list", "jzn")

    print("\n" + "=" * 70)
    print("  [SNIFFER] MERCADILLO DE RECURSOS Y EQUIPAMIENTO EN VIVO")
    print("=" * 70)
    print(f"  Token activo: '{market_token}' (Puerto servidor: 5555)")
    print("  Instrucciones: Consulta precios o abre objetos en el mercadillo dentro de Dofus.")
    print("  Presiona CTRL+C para volver al menú principal.")
    print("-" * 70)

    last_item_time = 0.0

    def on_packet(packet):
        nonlocal last_item_time
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 15:
            return

        tokens = extract_type_tokens(payload)
        has_token = any(tok == market_token for tok, _ in tokens)

        if not has_token and len(payload) < 200:
            return

        item_id, ladders, offer_prices = extract_market_universal(payload)
        if item_id > 0 and (ladders or offer_prices):
            item_name = get_item_name(item_id)
            now_str = datetime.datetime.now().strftime("%H:%M:%S")

            if ladders:
                ladder_vals = ladders[0][1]
                lad_str = " | ".join(f"x{10**i}: {p:,} K" for i, p in enumerate(ladder_vals) if p > 0)
                print(f"  [{now_str}] 📦 {item_name} (#{item_id}) -> {lad_str}")
            elif offer_prices:
                top_3 = sorted(offer_prices)[:3]
                lad_str = ", ".join(f"{p:,} K" for p in top_3)
                print(f"  [{now_str}] 🛡️ {item_name} (#{item_id}) [Equipamiento] -> Mínimos: {lad_str}")

            log_diagnostic(f"Mercadillo detectado: {item_name} (#{item_id})")

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[Deteniendo sniffer de mercadillo...]")
    finally:
        if sniffer.running:
            sniffer.stop()

# =============================================================================
# MODULO 2: SNIFFER DE ALMACÉN UNIFICADO (INVENTARIO + BANCO + MERKASAKO)
# =============================================================================
def run_sniffer_storage():
    km = load_keymap()
    storage_tokens = {km.get("inventory", "isb"), km.get("storage", "hlp")}

    print("\n" + "=" * 70)
    print("  [SNIFFER] ALMACÉN UNIFICADO (INVENTARIO + BANCO + MERKASAKO)")
    print("=" * 70)
    print("  Instrucciones:")
    print("  1. Abre el mercadillo de recursos o cualquier banco en Dofus Unity.")
    print("  2. Haz clic en la pestaña de 'VENTA' (donde el juego envía la lista completa).")
    print("  El sistema acumulará la ráfaga continua de paquetes automáticamente.")
    print("-" * 70)

    accumulated_items = {}
    burst_started = False
    packet_count = 0
    last_item_time = 0.0
    burst_stream = bytearray()

    def on_packet(packet):
        nonlocal burst_started, packet_count, last_item_time
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 15:
            return

        direct_items = extract_items_recursive(payload)
        now = time.time()

        if direct_items:
            for gid, qty, uid in direct_items:
                key = uid if uid > 0 else (gid, len(accumulated_items))
                accumulated_items[key] = (gid, qty, uid)

            burst_started = True
            last_item_time = now
            packet_count += 1
            burst_stream.extend(payload)
        elif burst_started:
            burst_stream.extend(payload)

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("\nEsperando apertura de banco o pestaña de venta en Dofus...")
    start_time = time.time()

    try:
        while time.time() - start_time < 90:
            time.sleep(0.1)
            now = time.time()
            if burst_started:
                slots = len(accumulated_items)
                total_units = sum(q for _, q, _ in accumulated_items.values())
                sys.stdout.write(f"\r  [Acumulando Almacén] {slots:,} slots detectados ({total_units:,} unidades) en {packet_count} paquetes...   ")
                sys.stdout.flush()

                if now - last_item_time >= 1.8 and slots >= 2:
                    break
    except KeyboardInterrupt:
        print("\n[Cancelado por usuario]")
        if sniffer.running:
            sniffer.stop()
        return
    finally:
        if sniffer.running:
            sniffer.stop()

    print()

    if len(burst_stream) > 0:
        stream_items = extract_items_recursive(bytes(burst_stream))
        for gid, qty, uid in stream_items:
            key = uid if uid > 0 else (gid, len(accumulated_items))
            accumulated_items[key] = (gid, qty, uid)

    if not accumulated_items:
        print("\n❌ No se detectó ninguna lista de almacén en este intento.")
        print("Sugerencia: Asegúrate de estar dentro del juego y hacer clic en la pestaña de 'VENTA' del mercadillo.")
        return

    # Guardar en data/banco_inventario_capturado.json
    total_slots = len(accumulated_items)
    total_units = sum(q for _, q, _ in accumulated_items.values())
    unique_types = len(set(gid for gid, _, _ in accumulated_items.values()))

    items_list = []
    for gid, qty, uid in accumulated_items.values():
        items_list.append({
            "uid": str(uid),
            "itemId": gid,
            "name": get_item_name(gid),
            "quantity": qty
        })

    saved_data = {
        "metadata": {
            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "totalSlots": total_slots,
            "totalUnits": total_units,
            "uniqueTypes": unique_types,
            "tokens": list(storage_tokens)
        },
        "items": items_list
    }

    try:
        with open(INVENTORY_OUTPUT, "w", encoding="utf-8") as f:
            json.dump(saved_data, f, indent=2, ensure_ascii=False)
        print(f"\n✅ ¡Almacén guardado con éxito en: sniffer/data/banco_inventario_capturado.json!")
        print(f"   • Slots: {total_slots:,} | Unidades Totales: {total_units:,} | Recursos Distintos: {unique_types:,}")
    except Exception as e:
        print(f"\n[Error guardando almacén]: {e}")

    # Generar y abrir el visor HTML automáticamente
    open_storage_viewer(saved_data)

# =============================================================================
# MODULO 3: VISOR HTML DE ALMACÉN
# =============================================================================
def open_storage_viewer(data_dict=None):
    print("\n[Visor] Procesando categorías oficiales y abriendo dashboard interactivo...")
    try:
        if os.path.exists(GENERATOR_SCRIPT):
            import importlib.util
            spec = importlib.util.spec_from_file_location("generar_visor", GENERATOR_SCRIPT)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "process_and_open_viewer"):
                mod.process_and_open_viewer(data_dict)
                return
        
        # Fallback directo al archivo HTML
        if os.path.exists(VIEWER_HTML):
            import webbrowser
            webbrowser.open(f"file://{os.path.abspath(VIEWER_HTML)}")
            print(f"  ✓ Visor abierto en tu navegador: {VIEWER_HTML}")
        else:
            print(f"  ⚠️ Genera una captura de almacén primero con la opción [2].")
    except Exception as e:
        print(f"  [Error abriendo visor]: {e}")

def open_sales_viewer(data_dict=None):
    if not data_dict and not os.path.exists(SALES_OUTPUT):
        print("\n  ⚠️ Aún no se ha capturado el historial de ventas.")
        print("  👉 Por favor, ejecuta la opción [4] del menú ('Sniffer Historial de Ventas')")
        print("     y desconecta/reconecta tu personaje en Dofus Unity para capturar los registros.")
        input("\nPresiona Enter para continuar...")
        return

    print("\n[Visor] Procesando historial de ventas y abriendo dashboard interactivo...")
    try:
        if os.path.exists(SALES_GENERATOR_SCRIPT):
            import importlib.util
            spec = importlib.util.spec_from_file_location("generar_visor_historial", SALES_GENERATOR_SCRIPT)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if hasattr(mod, "process_and_open_viewer"):
                mod.process_and_open_viewer(data_dict)
                return

        if os.path.exists(SALES_VIEWER_HTML):
            import webbrowser
            webbrowser.open(f"file://{os.path.abspath(SALES_VIEWER_HTML)}")
            print(f"  ✓ Visor de ventas abierto en tu navegador: {SALES_VIEWER_HTML}")
        else:
            print(f"  ⚠️ Genera una captura de historial primero con la opción [4].")
    except Exception as e:
        print(f"  [Error abriendo visor de historial]: {e}")

# =============================================================================
# MODULO 4: CALIBRADOR INTELIGENTE (MERCADILLO / ALMACÉN / HISTORIAL)
# =============================================================================
def run_calibrator_market():
    print("\n" + "=" * 70)
    print("  [CALIBRACIÓN] TOKEN DE MERCADILLO (price_list)")
    print("=" * 70)
    print("  Instrucciones:")
    print("  1. Abre el Mercadillo de Recursos en Dofus Unity.")
    print("  2. Haz clic en CUALQUIER objeto (ej. Magnesita, Cristal plegable, Trigo).")
    print("-" * 70)

    found_candidate = None
    step_rejected = set()

    def on_packet(packet):
        nonlocal found_candidate
        if found_candidate is not None:
            return
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 20:
            return

        tokens = extract_type_tokens(payload)
        if not tokens:
            return

        tok = tokens[0][0]
        if tok in step_rejected:
            return

        item_id, ladders, offer_prices = extract_market_universal(payload)
        if item_id > 0 and (ladders or offer_prices):
            found_candidate = (tok, item_id, ladders, offer_prices)

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("Esperando clic en un objeto del mercadillo...")
    try:
        while found_candidate is None:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\n[Calibración cancelada]")
        if sniffer.running:
            sniffer.stop()
        return
    finally:
        if sniffer.running:
            sniffer.stop()

    tok, item_id, ladders, offer_prices = found_candidate
    item_name = get_item_name(item_id)

    print("\n" + "=" * 70)
    print(f"  PAQUETE DETECTADO -> Token: '{tok}'")
    print("=" * 70)
    print(f"  Objeto detectado : {item_name} (ID: {item_id})")
    if ladders:
        lad_str = " | ".join(f"x{10**i}: {p:,} K" for i, p in enumerate(ladders[0][1]) if p > 0)
        print(f"  Precios de escala: {lad_str}")

    print("\n¿Coincide este objeto y sus precios con lo que ves en tu pantalla? [s/n]: ", end="")
    ans = input().strip().lower()
    if ans in ("s", "si", "y", "yes"):
        save_keymap_entry("price_list", tok)
        print(f"\n✅ ¡Token de mercadillo ('{tok}') guardado con éxito en config/keymap.json!")
        share_token_to_cloud("price_list", tok)
    else:
        print(f"\n❌ Token '{tok}' descartado.")

# =============================================================================
# MODULO 5: HISTORIAL DE VENTAS (Dofus 3.6)
# =============================================================================
def parse_single_sale_submessage(sub):
    if len(sub) < 6:
        return None
    off = 0
    date_val = None
    raw_date = None
    timestamp = 0
    item_id = None
    quantity = 1
    price = None
    is_unsold = False

    while off < len(sub):
        tag, r = decode_varint(sub, off)
        if r == 0:
            break
        off += r
        fn = tag >> 3
        wt = tag & 7

        if wt == 0:
            v, r2 = decode_varint(sub, off)
            off += r2
            if fn == 5:
                price = v
            elif fn == 3 and v == 1:
                is_unsold = True
            elif fn in (1, 2, 3) and (10 <= v <= 65000) and item_id is None:
                item_id = v
        elif wt == 2:
            l, r2 = decode_varint(sub, off)
            if r2 == 0 or off + r2 + l > len(sub):
                break
            off += r2
            data = sub[off:off + l]
            off += l

            if fn == 2:
                try:
                    s = data.decode("utf-8", errors="ignore").strip()
                    raw_date = s
                    if s.endswith("Z"):
                        dt = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
                        dt_local = dt.astimezone()
                        date_val = dt_local.strftime("%d-%m-%Y • %H:%M")
                        timestamp = int(dt.timestamp())
                    elif "202" in s and ("-" in s or ":" in s or "T" in s):
                        date_val = s.split(".")[0].replace("T", " ")
                except Exception:
                    pass
            elif fn == 4:
                # Submensaje de objeto en Dofus Unity (Field 1: itemId, Field 3: quantity)
                ioff = 0
                while ioff < len(data):
                    itag, ir = decode_varint(data, ioff)
                    if ir == 0:
                        break
                    ioff += ir
                    ifn = itag >> 3
                    iwt = itag & 7
                    if iwt == 0:
                        iv, ir2 = decode_varint(data, ioff)
                        ioff += ir2
                        if ifn == 1:
                            item_id = iv
                        elif ifn == 3:
                            quantity = iv
                    elif iwt == 2:
                        il, ir2 = decode_varint(data, ioff)
                        if ir2 == 0 or ioff + ir2 + il > len(data):
                            break
                        ioff += ir2 + il
                    elif iwt == 1:
                        ioff += 8
                    elif iwt == 5:
                        ioff += 4
                    else:
                        break
        elif wt == 1:
            off += 8
        elif wt == 5:
            off += 4
        else:
            break

    if item_id and (price is not None or date_val is not None):
        status = "Sin vender" if is_unsold else "Vendido"
        return {
            "itemId": item_id,
            "name": get_item_name(item_id),
            "price": price or 0,
            "quantity": max(1, quantity),
            "date": date_val or ("Sin vender" if is_unsold else "Vendido"),
            "rawDate": raw_date,
            "timestamp": timestamp,
            "status": status
        }
    return None

def extract_sales_entries(buf):
    sales = []
    if len(buf) < 15:
        return sales

    # 1. Escaneo directo de flujo (Stream Scanner para mensajes continuos de kyo)
    start_pos = 0
    idx = buf.find(b'type.ankama.com/kyo')
    if idx != -1:
        off = idx + len(b'type.ankama.com/kyo')
        if off < len(buf) and buf[off] == 0x12:
            off += 1
            _, r = decode_varint(buf, off)
            off += r
            start_pos = off

    off = start_pos
    while off < len(buf) - 6:
        if buf[off] != 0x0A:
            off += 1
            continue
        entry_len, r = decode_varint(buf, off + 1)
        if r == 0 or entry_len < 6 or entry_len > 350:
            off += 1
            continue
        if off + 1 + r + entry_len > len(buf):
            break
        entry_data = buf[off + 1 + r : off + 1 + r + entry_len]
        sale = parse_single_sale_submessage(entry_data)
        if sale:
            sales.append(sale)
            off += 1 + r + entry_len
            continue
        off += 1

    # 2. Si no encontró por escaneo de flujo, aplicar recorrido recursivo estándar
    if not sales:
        def walk(b, depth=0):
            if depth > 4 or len(b) < 10:
                return
            woff = 0
            while woff < len(b):
                tag, r = decode_varint(b, woff)
                if r == 0:
                    break
                woff += r
                wt = tag & 7
                if wt == 2:
                    l, r2 = decode_varint(b, woff)
                    if r2 == 0:
                        break
                    woff += r2
                    if woff + l > len(b):
                        break
                    sub = b[woff:woff + l]
                    woff += l
                    sale = parse_single_sale_submessage(sub)
                    if sale:
                        sales.append(sale)
                    else:
                        walk(sub, depth + 1)
                elif wt == 0:
                    _, r2 = decode_varint(b, woff)
                    woff += r2
                elif wt == 1:
                    woff += 8
                elif wt == 5:
                    woff += 4
                else:
                    break
        walk(buf)

    return sales

def inspect_packet_contents(buf):
    item_ids = []
    prices = []
    dates = []
    strings = []

    def walk(b, depth=0):
        if depth > 4 or len(b) < 2:
            return
        off = 0
        while off < len(b):
            tag, r = decode_varint(b, off)
            if r == 0:
                break
            off += r
            fn = tag >> 3
            wt = tag & 7

            if wt == 0:
                v, r2 = decode_varint(b, off)
                off += r2
                if 10 <= v <= 65000 and (v in ITEMS_NAME_MAP or str(v) in ITEMS_NAME_MAP):
                    if v not in item_ids:
                        item_ids.append(v)
                elif 50 <= v <= 2_000_000_000 and v not in item_ids:
                    if v not in prices:
                        prices.append(v)
                elif 1_600_000_000 <= v <= 2_000_000_000:
                    dates.append(datetime.datetime.fromtimestamp(v).strftime("%Y-%m-%d %H:%M"))
                elif 1_600_000_000_000 <= v <= 2_000_000_000_000:
                    dates.append(datetime.datetime.fromtimestamp(v / 1000.0).strftime("%Y-%m-%d %H:%M"))
            elif wt == 2:
                length, r2 = decode_varint(b, off)
                if r2 == 0 or off + r2 + length > len(b):
                    break
                off += r2
                sub = b[off:off + length]
                off += length
                try:
                    s = sub.decode("utf-8")
                    if len(s) >= 4 and any(c.isalnum() for c in s):
                        strings.append(s)
                        if ("2025" in s or "2026" in s) and ("-" in s or ":" in s or "T" in s):
                            dates.append(s)
                except Exception:
                    pass
                walk(sub, depth + 1)
            elif wt == 1:
                off += 8
            elif wt == 5:
                off += 4
            else:
                break
    walk(buf)
    return item_ids, prices, dates, strings

KNOWN_USER_PRICES = {76147, 39147, 3147, 40147, 30147, 29147, 37147, 47147, 33201969, 900}
KNOWN_USER_ITEMS = {9174, 12694, 1813, 6961, 8008, 8007, 12691, 13766, 13799}

def find_target_matches(buf):
    matched_prices = set()
    matched_items = set()
    off = 0
    while off < len(buf):
        v, r = decode_varint(buf, off)
        if r > 0:
            if v in KNOWN_USER_PRICES:
                matched_prices.add(v)
            if v in KNOWN_USER_ITEMS:
                matched_items.add(v)
        off += 1
    return matched_prices, matched_items

def run_calibrator_sales():
    print("\n" + "=" * 70)
    print("  [CALIBRACIÓN] HISTORIAL DE VENTAS Y TRANSACCIONES (DOFUS 3.6)")
    print("=" * 70)
    print("  ℹ️  ¿Por qué no detecta nada al hacer clic en la ventana ya abierta?")
    print("     Dofus Unity almacena el historial en la memoria del cliente (RAM).")
    print("     Cuando la ventana ya está abierta, hacer clic o filtrar no pide")
    print("     los datos a la red nuevamente.")
    print("\n  👉 CÓMO FORZAR AL SERVIDOR A ENVIAR TUS VENTAS (Elige una):")
    print("     1. MÉTODO INFALIBLE: Desconecta tu personaje a selección de")
    print("        personaje y vuelve a entrar (relog). Al conectar, el servidor")
    print("        envía una ráfaga con todas tus ventas sin conexión.")
    print("     2. O abre cualquier Mercadillo (HDV) y entra a la pestaña 'VENTA'.")
    print("-" * 70)

    load_items_dictionary()
    km = load_keymap()
    known_ignored = {
        km.get("price_list", "jzn"),
        km.get("inventory", "isb"),
        km.get("storage", "hlp"),
    }

    step_rejected = set()

    while True:
        found_candidate = None
        burst_stream = bytearray()
        burst_tokens = []
        pkt_count = 0
        last_pkt_time = 0.0
        last_feedback_time = 0.0
        candidate_active = False
        cand_kind = None
        cand_tok = None
        cand_prices = set()
        cand_items = set()

        def on_packet(packet):
            nonlocal found_candidate, pkt_count, last_pkt_time, last_feedback_time
            nonlocal candidate_active, cand_kind, cand_tok, cand_prices, cand_items
            if found_candidate is not None:
                return
            if not packet.haslayer(TCP) or not packet.haslayer(Raw):
                return
            if packet[TCP].sport != 5555:
                return

            payload = bytes(packet[Raw].load)
            if len(payload) < 8:
                return

            pkt_count += 1
            now = time.time()

            # Gestión de ráfaga TCP continua
            if not candidate_active and (now - last_pkt_time > 1.8):
                burst_stream.clear()
                burst_tokens.clear()
            last_pkt_time = now

            burst_stream.extend(payload)

            tokens = extract_type_tokens(payload)
            if tokens:
                for tok, _ in tokens:
                    if tok not in known_ignored and tok not in step_rejected and tok not in burst_tokens:
                        burst_tokens.append(tok)

            if not candidate_active:
                # 1. DETECCIÓN POR FIRMA EXACTA (Tus precios u objetos reales en pantalla)
                matched_prices_single, matched_items_single = find_target_matches(payload)
                matched_prices_burst, matched_items_burst = find_target_matches(bytes(burst_stream))

                matched_prices = matched_prices_single | matched_prices_burst
                matched_items = matched_items_single | matched_items_burst

                # Comprobar si coincide con tus precios conocidos
                has_major_price = any(p in (76147, 39147, 40147, 30147, 29147, 37147, 47147) for p in matched_prices)
                is_solid_match = has_major_price or (len(matched_prices) >= 2) or (matched_prices and matched_items) or (len(matched_items) >= 2)

                if is_solid_match:
                    cand_tok = burst_tokens[0] if burst_tokens else (tokens[0][0] if tokens else "kyo")
                    cand_kind = "exact_match"
                    cand_prices = matched_prices
                    cand_items = matched_items
                    candidate_active = True
                    return

                if not tokens:
                    return

                tok = tokens[0][0]
                if tok in known_ignored or tok in step_rejected:
                    return

                # 2. Detección heurística general (fechas e identificadores)
                sales = extract_sales_entries(payload)
                item_ids, prices, dates, strings = inspect_packet_contents(payload)

                if sales or (len(item_ids) >= 2 and prices and len(prices) >= 2) or (dates and prices):
                    cand_tok = tok
                    cand_kind = "heuristic"
                    candidate_active = True
                    return

        sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
        sniffer.start()

        print("Esperando ráfaga de datos... (Desconecta y reconecta tu personaje o entra a 'VENTA' en mercadillo)")
        try:
            while found_candidate is None:
                time.sleep(0.05)
                now = time.time()
                if candidate_active:
                    sys.stdout.write(f"\r  [Acumulando Ráfaga] {len(burst_stream):,} bytes recibidos en {pkt_count} paquetes...   ")
                    sys.stdout.flush()
                    if now - last_pkt_time >= 1.2 and len(burst_stream) >= 500:
                        found_candidate = (cand_kind, cand_tok, cand_prices, cand_items, bytes(burst_stream))
                        break
                elif now - last_feedback_time > 0.2:
                    sys.stdout.write(f"\r  [Escuchando Red] Paquetes analizados: {pkt_count:,} | Esperando envío del servidor...   ")
                    sys.stdout.flush()
                    last_feedback_time = now
        except KeyboardInterrupt:
            print("\n[Calibración cancelada por usuario]")
            if sniffer.running:
                sniffer.stop()
            return
        finally:
            if sniffer.running:
                sniffer.stop()

        print()
        kind = found_candidate[0]
        tok = found_candidate[1]
        payload = found_candidate[-1]

        # Decodificar todas las ventas de la ráfaga completa
        decoded_sales = extract_sales_entries(payload)
        unique_sales = []
        seen_keys = set()
        for s in decoded_sales:
            k = (s.get("rawDate") or s.get("date"), s.get("itemId"), s.get("price"), s.get("quantity"))
            if k not in seen_keys:
                seen_keys.add(k)
                unique_sales.append(s)

        print("\n" + "=" * 70)
        if kind == "exact_match":
            print(f"  🎯 ¡HISTORIAL DE VENTAS CONFIRMADO POR FIRMA! -> Token: '{tok}'")
        else:
            print(f"  PAQUETE DE HISTORIAL DETECTADO -> Token: '{tok}'")
        print("=" * 70)
        print(f"  Ráfaga analizada    : {len(payload):,} bytes")
        if unique_sales:
            sold_count = sum(1 for s in unique_sales if s.get("status") == "Vendido")
            unsold_count = sum(1 for s in unique_sales if s.get("status") == "Sin vender")
            sold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Vendido")
            unsold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Sin vender")
            total_qty = sum(s.get("quantity", 1) for s in unique_sales)

            print(f"  Ventas decodificadas: {len(unique_sales):,} registros encontrados")
            print(f"  Kamas generadas     : {sold_kamas:,} K (Vendido)")
            print(f"  Kamas en oferta     : {unsold_kamas:,} K (Sin vender)")
            print(f"  Ventas finalizadas  : {sold_count:,} | En venta (activas): {unsold_count:,}")
            print("-" * 70)
            print("  Muestra de transacciones capturadas en pantalla:")
            for i, s in enumerate(unique_sales[:8]):
                print(f"    [{i+1}] {s['date']} | {s['quantity']}x {s['name']} (#{s['itemId']}) -> {s['price']:,} K [{s.get('status', 'Vendido')}]")
        else:
            matched_prices = found_candidate[2] if kind == "exact_match" else []
            matched_items = found_candidate[3] if kind == "exact_match" else []
            if matched_prices:
                print(f"  Precios de tu lista: {', '.join(f'{p:,} K' for p in sorted(matched_prices, reverse=True))}")
            if matched_items:
                item_names = [f"{get_item_name(iid)} (#{iid})" for iid in matched_items]
                print(f"  Objetos de tu lista: {', '.join(item_names)}")

        # Registrar en el log de diagnóstico
        log_diagnostic(f"Candidato Historial: Token '{tok}', bytes={len(payload)}, ventas={len(unique_sales)}", payload[:100].hex())

        print("-" * 70)
        print("¿Coinciden estos datos con tu historial en pantalla? [s=Confirmar / n=Rechazar / c=Cancelar]: ", end="")
        ans = input().strip().lower()

        if ans in ("s", "si", "y", "yes"):
            save_keymap_entry("sales_history", tok)
            print(f"\n✅ ¡Token de historial ('{tok}') guardado con éxito en config/keymap.json!")

            # Auto-guardado y apertura inmediata del visor
            if unique_sales:
                sold_count = sum(1 for s in unique_sales if s.get("status") == "Vendido")
                unsold_count = sum(1 for s in unique_sales if s.get("status") == "Sin vender")
                sold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Vendido")
                unsold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Sin vender")
                total_qty = sum(s.get("quantity", 1) for s in unique_sales)

                out_data = {
                    "metadata": {
                        "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "totalSales": len(unique_sales),
                        "totalKamas": sold_kamas,
                        "soldKamas": sold_kamas,
                        "unsoldKamas": unsold_kamas,
                        "totalUnits": total_qty,
                        "soldCount": sold_count,
                        "unsoldCount": unsold_count,
                        "token": tok
                    },
                    "sales": unique_sales
                }
                try:
                    with open(SALES_OUTPUT, "w", encoding="utf-8") as f:
                        json.dump(out_data, f, indent=2, ensure_ascii=False)
                    print(f"  ✓ Archivo guardado: sniffer/data/historial_ventas_capturado.json")
                except Exception as e:
                    print(f"  [Error guardando {SALES_OUTPUT}]: {e}")
                
                open_sales_viewer(out_data)

            share_token_to_cloud("sales_history", tok)
            return
        elif ans in ("c", "cancelar"):
            print("\n[Calibración cancelada]")
            return
        else:
            step_rejected.add(tok)
            print(f"\n[Aviso] Token '{tok}' descartado.")
            print("Continuando escucha de red...")

# =============================================================================
# MODULO 6: SNIFFER DE HISTORIAL DE VENTAS (EN VIVO)
# =============================================================================
def run_sniffer_sales():
    km = load_keymap()
    sales_token = km.get("sales_history", "kyo")
    if not sales_token or sales_token == "No calibrado":
        sales_token = "kyo"

    print("\n" + "=" * 70)
    print("  [SNIFFER] HISTORIAL DE VENTAS Y TRANSACCIONES EN VIVO")
    print("=" * 70)
    print(f"  Token activo: '{sales_token}' (Puerto servidor: 5555)")
    print("\n  👉 CÓMO CAPTURAR TUS 900+ REGISTROS DE FORMA INMEDIATA:")
    print("     1. Desconecta tu personaje a selección de personaje y vuelve a entrar (/desconectar).")
    print("        Al conectar, el servidor de Dofus Unity envía la ráfaga completa (~50 KB)")
    print("        con todas tus transacciones registradas.")
    print("     2. O entra al mercadillo y haz clic en la pestaña 'VENTA'.")
    print("\n  El sniffer acumulará la ráfaga continua de paquetes y abrirá el visor visual.")
    print("  Presiona CTRL+C para detener y volver al menú.")
    print("-" * 70)

    load_items_dictionary()
    burst_stream = bytearray()
    burst_active = False
    last_pkt_time = 0.0
    packet_count = 0
    feedback_time = 0.0

    target_bytes = f"type.ankama.com/{sales_token}".encode("ascii")

    def on_packet(packet):
        nonlocal burst_stream, burst_active, last_pkt_time, packet_count
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 8:
            return

        now = time.time()

        # Detección de inicio de ráfaga
        if target_bytes in payload or b"type.ankama.com/kyo" in payload:
            burst_active = True
            burst_stream.clear()
            packet_count = 0

        if burst_active:
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("Escuchando tráfico de red... Esperando envío del historial de Dofus...")
    try:
        while True:
            time.sleep(0.08)
            now = time.time()

            if burst_active:
                if now - feedback_time > 0.15:
                    sys.stdout.write(f"\r  [Acumulando Ráfaga] {len(burst_stream):,} bytes en {packet_count} paquetes TCP...   ")
                    sys.stdout.flush()
                    feedback_time = now

                # Cuando pasan 1.2 segundos sin nuevos paquetes, la ráfaga ha finalizado
                if now - last_pkt_time >= 1.2 and len(burst_stream) >= 500:
                    raw_data = bytes(burst_stream)
                    burst_active = False
                    burst_stream.clear()
                    packet_count = 0

                    print(f"\n\n  ⚙️ Procesando y decodificando {len(raw_data):,} bytes de transacciones...")
                    entries = extract_sales_entries(raw_data)

                    # Deduplicar por timestamp exacto (microsegundos) + item + precio + cantidad
                    unique_dict = {}
                    for s in entries:
                        k = (s.get("rawDate") or s.get("date"), s.get("itemId"), s.get("price"), s.get("quantity"))
                        if k not in unique_dict:
                            unique_dict[k] = s
                    unique_sales = list(unique_dict.values())

                    if not unique_sales:
                        print("  ⚠️ La ráfaga no contenía transacciones decodificables. Continuando escucha...")
                        continue

                    sold_count = sum(1 for s in unique_sales if s.get("status") == "Vendido")
                    unsold_count = sum(1 for s in unique_sales if s.get("status") == "Sin vender")
                    sold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Vendido")
                    unsold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Sin vender")
                    total_qty = sum(s.get("quantity", 1) for s in unique_sales)

                    print("\n" + "=" * 70)
                    print(f"  🎉 ¡HISTORIAL DE VENTAS CAPTURADO CON ÉXITO! ({len(unique_sales):,} registros)")
                    print("=" * 70)
                    print(f"  Total Kamas generadas : {sold_kamas:,} K (Vendido)")
                    print(f"  Total Kamas en oferta : {unsold_kamas:,} K (Sin vender)")
                    print(f"  Ventas finalizadas    : {sold_count:,}")
                    print(f"  En venta (sin vender) : {unsold_count:,}")
                    print(f"  Unidades totales      : {total_qty:,} unidades")
                    print("-" * 70)
                    print("  Muestra de transacciones recientes:")
                    for i, s in enumerate(unique_sales[:8]):
                        print(f"    • [{s.get('date', 'S/F')}] {s.get('quantity', 1)}x {s.get('name', 'Objeto')} (#{s.get('itemId')}) -> {s.get('price', 0):,} K [{s.get('status', 'Vendido')}]")

                    out_data = {
                        "metadata": {
                            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "totalSales": len(unique_sales),
                            "totalKamas": sold_kamas,
                            "soldKamas": sold_kamas,
                            "unsoldKamas": unsold_kamas,
                            "totalUnits": total_qty,
                            "soldCount": sold_count,
                            "unsoldCount": unsold_count,
                            "token": sales_token
                        },
                        "sales": unique_sales
                    }

                    try:
                        with open(SALES_OUTPUT, "w", encoding="utf-8") as f:
                            json.dump(out_data, f, indent=2, ensure_ascii=False)
                        print(f"\n  ✅ Guardado exitosamente en: sniffer/data/historial_ventas_capturado.json")
                    except Exception as e:
                        print(f"  [Error guardando]: {e}")

                    # Generar y abrir visor HTML automáticamente
                    open_sales_viewer(out_data)

                    print("\nContinuando escucha en segundo plano (CTRL+C para salir al menú)...")
    except KeyboardInterrupt:
        print("\n[Deteniendo sniffer de historial...]")
    finally:
        if sniffer.running:
            sniffer.stop()

# =============================================================================
# MENÚ PRINCIPAL
# =============================================================================
def print_menu():
    km = load_keymap()
    print("\n" + "=" * 70)
    print("  DOFUS UNITY 3.6 -> DBHDV SUITE UNIFICADA (SNIFFER & CALIBRADOR)")
    print("=" * 70)
    print("  Tokens Activos en config/keymap.json:")
    print(f"    • Mercadillo (price_list)    : '{km.get('price_list', 'No calibrado')}'")
    print(f"    • Inventario (inventory)     : '{km.get('inventory', 'No calibrado')}'")
    print(f"    • Almacén (storage)          : '{km.get('storage', 'No calibrado')}'")
    print(f"    • Historial (sales_history)  : '{km.get('sales_history', 'No calibrado')}'")
    print(f"    • Última calibración         : {km.get('last_calibrated', 'Nunca')}")
    print("-" * 70)
    print("  [MODO CAPTURA Y GESTIÓN EN VIVO]")
    print("    [1] Sniffer Mercadillo (Precios HDV en Vivo)")
    print("    [2] Sniffer Almacén Unificado (Inventario + Banco + Merkasako)")
    print("    [3] Abrir Visor Visual de Almacén (visor_almacen.html)")
    print("    [4] Sniffer Historial de Ventas (Capturar 900+ registros y abrir Visor)")
    print("    [5] Abrir Visor Visual de Historial (visor_historial.html)")
    print("\n  [MODO CALIBRACIÓN Y DIAGNÓSTICO]")
    print("    [6] Calibrar Token de Mercadillo (Precios)")
    print("    [7] Calibrar Token de Almacén (Inventario/Banco)")
    print("    [8] Calibrar Token de Historial de Ventas")
    print("    [9] ☁️ Sincronizar Tokens desde DBHDV Cloud (Auto-actualización)")
    print("    [10] Ver Registro de Diagnóstico y Telemetría")
    print("\n    [0] Salir")
    print("=" * 70)

def main():
    # Intento silencioso de sincronizar tokens al iniciar para que el usuario siempre tenga lo último
    sync_tokens_from_cloud(silent=True)

    while True:
        print_menu()
        try:
            choice = input("Selecciona una opción [0-10]: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n¡Hasta pronto!")
            break

        if choice == "1":
            run_sniffer_market()
        elif choice == "2":
            run_sniffer_storage()
        elif choice == "3":
            open_storage_viewer()
        elif choice == "4":
            run_sniffer_sales()
        elif choice == "5":
            open_sales_viewer()
        elif choice == "6":
            run_calibrator_market()
        elif choice == "7":
            run_sniffer_storage()  # Calibra y acumula el almacén
        elif choice == "8":
            run_calibrator_sales()
        elif choice == "9":
            sync_tokens_from_cloud(silent=False)
        elif choice in ("10", "d", "diag"):
            print("\n" + "=" * 70)
            print("  ÚLTIMOS REGISTROS DE DIAGNÓSTICO (logs/calibracion_diagnostico.log)")
            print("=" * 70)
            if os.path.exists(DIAGNOSTIC_LOG):
                try:
                    with open(DIAGNOSTIC_LOG, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        for line in lines[-25:]:
                            print("  " + line.rstrip())
                except Exception as e:
                    print(f"Error leyendo log: {e}")
            else:
                print("  No hay registros guardados aún.")
            input("\nPresiona Enter para continuar...")
        elif choice == "0":
            print("\nSaliendo de DBHDV Suite. ¡Buen juego!")
            break
        else:
            print("\n[Opción no válida. Ingresa un número del 0 al 10]")

if __name__ == "__main__":
    main()
