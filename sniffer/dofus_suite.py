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
import threading
import queue
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
ACTIVE_LISTINGS_OUTPUT = os.path.join(DATA_DIR, "listings_en_venta_capturado.json")

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
                for k in ["price_list", "inventory", "storage", "sales_history", "active_listings"]:
                    if k in remote_tokens and remote_tokens[k] and remote_tokens[k] != km.get(k):
                        km[k] = remote_tokens[k]
                        changed = True
                if changed:
                    km["last_synced_cloud"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    with open(KEYMAP_FILE, "w", encoding="utf-8") as f:
                        json.dump(km, f, indent=2, ensure_ascii=False)
                    if not silent:
                        print("  [OK] Tokens actualizados con exito desde DBHDV Cloud:")
                        print(f"     * Mercadillo (price_list)    : '{km.get('price_list')}'")
                        print(f"     * Inventario (inventory)     : '{km.get('inventory')}'")
                        print(f"     * Almacen (storage)          : '{km.get('storage')}'")
                        print(f"     * Historial (sales_history)  : '{km.get('sales_history')}'")
                        print(f"     * En Venta (active_listings) : '{km.get('active_listings')}'")
                else:
                    if not silent:
                        print("  [OK] Tus tokens locales ya estan al dia con la ultima version comunitaria.")
                return True
    except Exception as e:
        if not silent:
            print(f"  [Aviso] No se pudo contactar con DBHDV Cloud ({e}). Operando en modo local.")
    return False

def share_token_to_cloud(key_name, token_val):
    """
    Comparte un token recien calibrado con la comunidad de DBHDV si el servidor esta disponible.
    """
    print(f"\nDeseas compartir el token '{token_val}' de '{key_name}' con la comunidad de DBHDV? [s/N]: ", end="")
    try:
        ans = input().strip().lower()
        if ans not in ("s", "si", "y", "yes"):
            print("  [OK] Token guardado exclusivamente en modo local.")
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
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            if res_data.get("success"):
                print("  [OK] Gracias. El token ha sido registrado en DBHDV para toda la comunidad.")
            else:
                print("  [OK] Token guardado localmente.")
    except Exception:
        print("  [Info] El backend remoto en la nube no esta accesible actualmente.")
        print("  [OK] Tu token esta guardado y funcionando al 100% en modo local (config/keymap.json).")

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
# MODULO 5B: CALIBRADOR DE VENTAS ACTIVAS (LISTINGS EN MERCADILLO)
# =============================================================================

def run_calibrator_active_listings():
    """
    Calibrador interactivo para descubrir y validar el token de listings activos
    (pestaña 'VENTA' del mercadillo), mostrando en consola el contenido decodificado
    de cada token candidato para confirmar visualmente antes de guardar.
    """
    print("\n" + "=" * 70)
    print("  [CALIBRACIÓN] LISTINGS ACTIVOS EN VENTA (PESTAÑA 'VENTA' DEL MERCADILLO)")
    print("=" * 70)
    print("  Instrucciones:")
    print("  1. Abre el juego Dofus Unity 3.6.")
    print("  2. Acude a cualquier Mercadillo (Recursos, Equipamiento o Consumibles).")
    print("  3. Abre el mercadillo y haz clic en la pestaña 'VENTA'.")
    print("  4. El calibrador capturará la ráfaga TCP y probará cada token")
    print("     mostrando en consola tus lotes en venta (objetos, precio y tiempo).")
    print("-" * 70)

    load_items_dictionary()
    km = load_keymap()
    known_ignored = {
        km.get("price_list", "jzn"),
        km.get("inventory", "isb"),
        km.get("storage", "hlp"),
        km.get("sales_history", "kyo"),
    }
    step_rejected = set()

    burst_stream = bytearray()
    burst_active = False
    last_pkt_time = 0.0
    packet_count = 0
    feedback_time = 0.0
    detected_tokens = []

    def on_packet(packet):
        nonlocal burst_stream, burst_active, last_pkt_time, packet_count, detected_tokens
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 8:
            return

        now = time.time()
        tokens = extract_type_tokens(payload)

        new_tokens = [tok for tok, _ in tokens if tok not in known_ignored and tok not in step_rejected]
        if new_tokens or burst_active or len(payload) >= 150:
            burst_active = True
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now
            for tok in new_tokens:
                if tok not in detected_tokens:
                    detected_tokens.append(tok)

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("\nEscuchando puerto 5555. Haz clic en la pestana 'VENTA' del mercadillo...")

    try:
        while True:
            time.sleep(0.08)
            now = time.time()

            if burst_active:
                if now - feedback_time > 0.2:
                    sys.stdout.write(
                        f"\r  [Capturando] {len(burst_stream):,} bytes en {packet_count} paquetes | "
                        f"Tokens: {', '.join(detected_tokens) if detected_tokens else 'analizando...'}   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

                # Fin de rafaga: 1.2s de silencio y tamano suficiente
                if now - last_pkt_time >= 1.2 and len(burst_stream) >= 200:
                    raw_data = bytes(burst_stream)
                    burst_stream.clear()
                    burst_active = False
                    packet_count = 0

                    all_tokens = extract_type_tokens(raw_data)
                    token_counts = defaultdict(int)
                    for tok, _ in all_tokens:
                        token_counts[tok] += 1

                    candidates = [tok for tok in token_counts.keys() if tok not in known_ignored and tok not in step_rejected]
                    if not candidates:
                        candidates = [tok for tok in token_counts.keys() if tok not in step_rejected]

                    # Probar candidatos que decodifiquen listings validos
                    found_any = False
                    for cand in candidates:
                        cand_listings = extract_active_listings(raw_data, token=cand)
                        if not cand_listings:
                            continue

                        found_any = True
                        total_value = sum(l["price"] for l in cand_listings)
                        print("\n\n" + "=" * 70)
                        print(f"  PAQUETE DE LISTINGS DETECTADO -> Token Candidato: '{cand}'")
                        print("=" * 70)
                        print(f"  Lotes encontrados  : {len(cand_listings)} lote(s) en venta")
                        print(f"  Valor total en HDV : {total_value:,} K")
                        print("-" * 70)
                        print("  Muestra de lotes decodificados en tu mercadillo:")
                        for i, entry in enumerate(cand_listings[:8], 1):
                            qty = entry.get("quantity", 1)
                            unit_str = f" ({entry.get('unitPrice', entry['price'] // qty):,} K/u)" if qty > 1 else ""
                            print(
                                f"    [{i}] {qty:2d}x {entry['name']} (#{entry['itemId']}) "
                                f"-> {entry['price']:,} K{unit_str} | Expira en: {entry.get('timeLabel', 'N/D')}"
                            )
                        if len(cand_listings) > 8:
                            print(f"    ... y {len(cand_listings) - 8} lotes adicionales.")

                        print("-" * 70)
                        print(f"Coinciden estos {len(cand_listings)} lotes con tus ofertas en mercadillo?")
                        print("Opciones: [s] Confirmar y guardar  |  [n] Probar siguiente token  |  [c] Cancelar")
                        try:
                            ans = input("Selecciona [s / n / c]: ").strip().lower()
                        except (KeyboardInterrupt, EOFError):
                            ans = "c"

                        if ans in ("s", "si", "y", "yes"):
                            save_keymap_entry("active_listings", cand)
                            print(f"\n[OK] Token de listings activos ('{cand}') guardado con exito en config/keymap.json")
                            share_token_to_cloud("active_listings", cand)
                            input("\nPresiona Enter para continuar...")
                            return
                        elif ans in ("c", "cancelar"):
                            print("\n[Calibracion cancelada]")
                            return
                        else:
                            step_rejected.add(cand)
                            print(f"\n[Aviso] Token '{cand}' descartado.")

                    if not found_any:
                        # Rafaga no contenia listings (movimiento, chat, etc.), continua escuchando
                        detected_tokens.clear()
                        continue

            else:
                if now - feedback_time > 0.4:
                    sys.stdout.write(
                        f"\r  [Escuchando puerto 5555] Haz clic en la pestana 'VENTA' del mercadillo...   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

    except KeyboardInterrupt:
        print("\n\n[Calibracion cancelada por el usuario]")
    finally:
        if sniffer.running:
            sniffer.stop()

    input("\nPresiona Enter para volver al menu...")


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
# MODULO 7: SNIFFER DE LISTINGS ACTIVOS EN VENTA (PESTAÑA VENTA DEL MERCADILLO)
# =============================================================================
def parse_active_listing_entry(sub):
    """
    Parsea un submensaje de listing activo en el mercadillo (pestaña VENTA).
    Estructura Protobuf confirmada (token 'ket'):
      fn 1 (submessage):
        fn 1 (varint): listingUid
        fn 2 (varint): itemId (GID del objeto)
        fn 3 (varint): quantity / tamaño de lote (1, 10, 100)
      fn 2 (varint): price en kamas del lote
      fn 3 (varint): secondsRemaining hasta la expiración
    """
    off = 0
    item_id = None
    quantity = 1
    price = 0
    seconds_remaining = 0
    listing_uid = None

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
            if fn == 2 and 50 <= v <= 2_000_000_000:
                price = v
            elif fn == 3 and 0 <= v <= 2_592_000:
                seconds_remaining = v
            elif fn == 1 and 10 <= v <= 65000 and item_id is None:
                item_id = v
            elif fn == 4 and 0 <= v <= 2_592_000 and seconds_remaining == 0:
                seconds_remaining = v
        elif wt == 2:
            l, r2 = decode_varint(sub, off)
            if r2 == 0 or off + r2 + l > len(sub):
                break
            off += r2
            inner = sub[off:off + l]
            off += l
            if fn == 1:
                ioff = 0
                while ioff < len(inner):
                    itag, ir = decode_varint(inner, ioff)
                    if ir == 0:
                        break
                    ioff += ir
                    ifn = itag >> 3
                    iwt = itag & 7
                    if iwt == 0:
                        iv, ir2 = decode_varint(inner, ioff)
                        ioff += ir2
                        if ifn == 1:
                            listing_uid = iv
                        elif ifn == 2 and 10 <= iv <= 65000:
                            item_id = iv
                        elif ifn == 3 and iv in (1, 10, 100, 1000):
                            quantity = iv
                    elif iwt == 2:
                        il, ir2 = decode_varint(inner, ioff)
                        if ir2 == 0 or ioff + ir2 + il > len(inner):
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

    if item_id and price > 0:
        days = seconds_remaining // 86400
        hours = (seconds_remaining % 86400) // 3600
        qty = quantity if quantity > 0 else 1
        unit_price = round(price / qty, 2)
        return {
            "uid": listing_uid,
            "itemId": item_id,
            "name": get_item_name(item_id),
            "quantity": qty,
            "price": price,
            "unitPrice": unit_price,
            "secondsRemaining": seconds_remaining,
            "timeLabel": f"{days}d {hours}h" if days > 0 else f"{hours}h",
        }
    return None


def extract_active_listings(buf, token=None):
    """
    Extrae listings activos desde el buffer TCP buscando el token activo ('ket')
    y parseando las entradas repetidas (fn=2). También soporta escaneo recursivo.
    """
    listings = []
    seen_keys = set()
    km = load_keymap()
    target_token = token or km.get("active_listings", "ket")
    target_bytes = f"type.ankama.com/{target_token}".encode("ascii")

    pos = buf.find(target_bytes)
    if pos != -1:
        off = pos + len(target_bytes)
        tag, r = decode_varint(buf, off)
        if tag >> 3 == 2:
            off += r
            length, r2 = decode_varint(buf, off)
            off += r2
            msg_bytes = buf[off:off + length]
        else:
            msg_bytes = buf[off:off + 50000]

        moff = 0
        while moff < len(msg_bytes):
            mtag, mr = decode_varint(msg_bytes, moff)
            if mr == 0:
                break
            moff += mr
            mfn = mtag >> 3
            mwt = mtag & 7
            if mwt == 2:
                ml, mr2 = decode_varint(msg_bytes, moff)
                if mr2 == 0 or moff + mr2 + ml > len(msg_bytes):
                    break
                moff += mr2
                entry_bytes = msg_bytes[moff:moff + ml]
                moff += ml
                if mfn == 2:
                    parsed = parse_active_listing_entry(entry_bytes)
                    if parsed:
                        key = parsed.get("uid") or (parsed["itemId"], parsed["quantity"], parsed["price"], len(listings))
                        if key not in seen_keys:
                            seen_keys.add(key)
                            listings.append(parsed)
            elif mwt == 0:
                _, mr2 = decode_varint(msg_bytes, moff)
                moff += mr2
            elif mwt == 1:
                moff += 8
            elif mwt == 5:
                moff += 4
            else:
                break

    if listings:
        return listings

    # Escaneo recursivo de respaldo
    def walk(b, depth=0):
        if depth > 4 or len(b) < 6:
            return
        off = 0
        while off < len(b):
            tag, r = decode_varint(b, off)
            if r == 0:
                break
            off += r
            fn = tag >> 3
            wt = tag & 7
            if wt == 2:
                length, r2 = decode_varint(b, off)
                if r2 == 0 or off + r2 + length > len(b):
                    break
                off += r2
                sub = b[off:off + length]
                off += length
                entry = parse_active_listing_entry(sub)
                if entry and entry["price"] > 0:
                    key = entry.get("uid") or (entry["itemId"], entry["quantity"], entry["price"], len(listings))
                    if key not in seen_keys:
                        seen_keys.add(key)
                        listings.append(entry)
                else:
                    walk(sub, depth + 1)
            elif wt == 0:
                _, r2 = decode_varint(b, off)
                off += r2
            elif wt == 1:
                off += 8
            elif wt == 5:
                off += 4
            else:
                break

    walk(buf)
    return listings


# =============================================================================
# CLASIFICACIÓN DE MERCADILLOS (RECURSOS, EQUIPAMIENTO, CONSUMIBLES)
# =============================================================================

ITEM_CATEGORIES_FILE = os.path.join(CONFIG_DIR, "item_categories.json")
ITEM_CATEGORIES_MAP = {}

def load_item_categories():
    global ITEM_CATEGORIES_MAP
    if ITEM_CATEGORIES_MAP:
        return
    if os.path.exists(ITEM_CATEGORIES_FILE):
        try:
            with open(ITEM_CATEGORIES_FILE, "r", encoding="utf-8") as f:
                ITEM_CATEGORIES_MAP = json.load(f)
        except Exception:
            pass

def classify_item(item_id, item_name="", quantity=1):
    """
    Clasifica un objeto en: 'recursos', 'equipamiento' o 'consumibles'.
    Utiliza primero la base de datos de tipos oficiales y luego reglas heurísticas.
    """
    load_item_categories()
    str_id = str(item_id)
    if str_id in ITEM_CATEGORIES_MAP:
        return ITEM_CATEGORIES_MAP[str_id]

    # En Dofus el equipamiento nunca se vende en lotes > 1
    if quantity > 1:
        name_l = (item_name or "").lower()
        if any(w in name_l for w in ("pergamino", "pócima", "pocion", "pan", "pescado", "carne")):
            return "consumibles"
        return "recursos"

    name_l = (item_name or "").lower()
    if any(w in name_l for w in ("pergamino", "pócima", "pocion", "pan", "pescado comestible", "carne comestible", "golosina", "bebida", "poción")):
        return "consumibles"
    if any(w in name_l for w in ("amuleto", "anillo", "bota", "sombrero", "capa", "cinturón", "cinturon", "escudo", "trofeo", "espada", "daga", "pala", "varita", "bastón", "baston", "hacha", "martillo", "arco", "lanza", "dofus", "mascota")):
        return "equipamiento"

    return "recursos"

def classify_batch_market(batch):
    """
    Determina a qué mercadillo pertenece la ráfaga analizando los objetos decodificados.
    Retorna: 'recursos', 'equipamiento' o 'consumibles'.
    """
    if not batch:
        return "recursos"
    votes = {"equipamiento": 0, "consumibles": 0, "recursos": 0}
    for item in batch:
        cat = classify_item(item.get("itemId"), item.get("name", ""), item.get("quantity", 1))
        votes[cat] += 1
    return max(votes, key=votes.get)


def run_sniffer_active_listings():
    """
    Captura los listings activos de la pestana 'VENTA' del mercadillo.
    Modo multi-mercadillo inteligente:
    - Mantiene separados los 3 mercadillos: 'recursos', 'equipamiento', 'consumibles'.
    - Al abrir un mercadillo, actualiza unicamente los lotes vigentes de esa categoria.
    - Si se produce una venta y se vuelve a abrir el mismo mercadillo, la lista se sincroniza.
    - Exporta un JSON estructurado con categorias individuales y lista consolidada.
    """
    print("\n" + "=" * 70)
    print("  [SNIFFER] LISTINGS ACTIVOS POR MERCADILLO (RECURSOS, EQUIPOS, CONSUMIBLES)")
    print("=" * 70)
    print("  Instrucciones:")
    print("  1. Abre el Mercadillo que desees en Dofus Unity (Recursos, Equipos o Consumibles).")
    print("  2. Haz clic en la pestana 'VENTA' para que el servidor envie los lotes activos.")
    print("  3. El sniffer identificara el tipo de mercadillo y actualizara sus lotes.")
    print("  4. Puedes visitar los otros mercadillos en la misma sesion sin perder datos.")
    print("  5. Presiona CTRL+C para finalizar la captura cuando hayas terminado.")
    print("-" * 70)

    load_items_dictionary()
    load_item_categories()

    mercadillos = {
        "recursos": [],
        "equipamiento": [],
        "consumibles": []
    }

    # Cargar estado previo persistente
    if os.path.exists(ACTIVE_LISTINGS_OUTPUT):
        try:
            with open(ACTIVE_LISTINGS_OUTPUT, "r", encoding="utf-8") as f:
                prev_data = json.load(f)
                if isinstance(prev_data, dict):
                    if "mercadillos" in prev_data and isinstance(prev_data["mercadillos"], dict):
                        for m_key in ("recursos", "equipamiento", "consumibles"):
                            m_sec = prev_data["mercadillos"].get(m_key, {})
                            if isinstance(m_sec, dict) and "listings" in m_sec:
                                mercadillos[m_key] = m_sec["listings"]
                            elif isinstance(m_sec, list):
                                mercadillos[m_key] = m_sec
                    elif "listings" in prev_data and isinstance(prev_data["listings"], list):
                        # Migracion desde formato plano previo
                        for l in prev_data["listings"]:
                            cat = l.get("market") or classify_item(l.get("itemId"), l.get("name", ""), l.get("quantity", 1))
                            if cat in mercadillos:
                                mercadillos[cat].append(l)
        except Exception:
            pass

    total_prev = sum(len(v) for v in mercadillos.values())
    if total_prev > 0:
        print("  [Memoria de Mercadillos cargada]:")
        print(f"    • Recursos     : {len(mercadillos['recursos'])} lotes")
        print(f"    • Equipamiento : {len(mercadillos['equipamiento'])} lotes")
        print(f"    • Consumibles  : {len(mercadillos['consumibles'])} lotes")
        print(f"    Total consolidado : {total_prev} lotes activos")
        print("  Opciones: [Enter] Mantener y sincronizar por mercadillo  |  [r] Reiniciar desde cero")
        try:
            init_choice = input("  Selecciona [Enter / r]: ").strip().lower()
            if init_choice in ("r", "reset", "reiniciar"):
                for k in mercadillos:
                    mercadillos[k] = []
                print("  [Reinicio] Memoria limpiada. Capturando desde cero...")
            else:
                print("  [Modo sincronizacion activo] Cada mercadillo se actualizara independientemente.")
        except (KeyboardInterrupt, EOFError):
            print("\n[Operacion cancelada]")
            return

    burst_stream = bytearray()
    burst_active = False
    last_pkt_time = 0.0
    packet_count = 0
    feedback_time = 0.0

    km = load_keymap()
    target_token = km.get("active_listings", "ket")
    target_bytes = f"type.ankama.com/{target_token}".encode("ascii")

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

        # Deteccion de rafaga: presencia de token ket, submensaje de items o paquete grande de Dofus
        has_token = target_bytes in payload or b"type.ankama.com/ket" in payload
        if has_token or burst_active:
            burst_active = True
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now
        elif len(payload) >= 150:
            # Paquete de datos del servidor mientras esperamos apertura de mercadillo
            burst_active = True
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("\nEscuchando puerto 5555. Abre la pestana 'VENTA' de cualquier mercadillo...")
    print("Presiona CTRL+C en cualquier momento para finalizar y guardar.\n")

    try:
        while True:
            time.sleep(0.08)
            now = time.time()

            if burst_active:
                if now - feedback_time > 0.15:
                    sys.stdout.write(
                        f"\r  [Acumulando Rafaga] {len(burst_stream):,} bytes en {packet_count} paquetes TCP...   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

                # Fin de rafaga: 1.2s de silencio y buffer suficiente
                if now - last_pkt_time >= 1.2 and len(burst_stream) >= 200:
                    raw_data = bytes(burst_stream)
                    burst_stream.clear()
                    burst_active = False
                    packet_count = 0

                    new_listings = extract_active_listings(raw_data)

                    if not new_listings:
                        # No eran listings de mercadillo (trafico no relacionado de Dofus)
                        continue

                    # Identificar categoria de mercadillo
                    market_key = classify_batch_market(new_listings)
                    market_names = {
                        "recursos": "MERCADILLO DE RECURSOS",
                        "equipamiento": "MERCADILLO DE EQUIPAMIENTO",
                        "consumibles": "MERCADILLO DE CONSUMIBLES"
                    }
                    market_display = market_names.get(market_key, market_key.upper())

                    now_ts = int(time.time())
                    for entry in new_listings:
                        secs = entry.get("secondsRemaining", 0)
                        if secs > 0:
                            expiry_ts = now_ts + secs
                            expiry_dt = datetime.datetime.fromtimestamp(expiry_ts)
                            entry["expiresAt"] = expiry_dt.strftime("%Y-%m-%d %H:%M:%S")
                            days = secs // 86400
                            hours = (secs % 86400) // 3600
                            entry["timeLabel"] = f"{days}d {hours}h" if days > 0 else f"{hours}h"
                        else:
                            entry["expiresAt"] = None
                            entry["timeLabel"] = "Desconocido"
                        entry["market"] = market_key

                    # Actualizacion atomica del mercadillo correspondiente
                    mercadillos[market_key] = new_listings

                    # Consolidar todos los lotes
                    all_listings = (
                        mercadillos["recursos"] +
                        mercadillos["equipamiento"] +
                        mercadillos["consumibles"]
                    )
                    total_lots = len(all_listings)
                    total_value = sum(e["price"] for e in all_listings)

                    batch_value = sum(e["price"] for e in new_listings)

                    print("\n" + "=" * 70)
                    print(f"  [ACTUALIZACION: {market_display}]")
                    print("=" * 70)
                    print(f"  Lotes vigentes en este mercadillo : {len(new_listings)} ({batch_value:,} K)")
                    print("-" * 70)
                    print("  Estado consolidado por mercadillo:")
                    for mk, label in [("recursos", "Recursos"), ("equipamiento", "Equipamiento"), ("consumibles", "Consumibles")]:
                        m_cnt = len(mercadillos[mk])
                        m_val = sum(e["price"] for e in mercadillos[mk])
                        marker = "  <-- Actualizado ahora" if mk == market_key else ""
                        print(f"    * {label:12s} : {m_cnt:2d} lotes | {m_val:11,d} K{marker}")
                    print("-" * 70)
                    print(f"  Total activo en venta : {total_lots} lotes | {total_value:,} K")
                    print("-" * 70)
                    print("  Muestra de lotes de este mercadillo:")
                    for entry in new_listings[:5]:
                        qty = entry.get("quantity", 1)
                        unit_str = f" ({entry.get('unitPrice', entry['price'] // qty):,} K/u)" if qty > 1 else ""
                        print(
                            f"    - {qty}x {entry['name']} (#{entry['itemId']}) "
                            f"-> {entry['price']:,} K{unit_str} | Expira en: {entry['timeLabel']}"
                        )
                    if len(new_listings) > 5:
                        print(f"    ... y {len(new_listings) - 5} lotes mas")

                    # Estructura JSON completa con separacion de mercadillos y compatibilidad retroactiva
                    out_data = {
                        "metadata": {
                            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "totalLots": total_lots,
                            "totalValue": total_value,
                            "counts": {
                                "recursos": len(mercadillos["recursos"]),
                                "equipamiento": len(mercadillos["equipamiento"]),
                                "consumibles": len(mercadillos["consumibles"])
                            }
                        },
                        "mercadillos": {
                            "recursos": {
                                "totalLots": len(mercadillos["recursos"]),
                                "totalValue": sum(e["price"] for e in mercadillos["recursos"]),
                                "lastUpdated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S") if market_key == "recursos" else None,
                                "listings": mercadillos["recursos"]
                            },
                            "equipamiento": {
                                "totalLots": len(mercadillos["equipamiento"]),
                                "totalValue": sum(e["price"] for e in mercadillos["equipamiento"]),
                                "lastUpdated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S") if market_key == "equipamiento" else None,
                                "listings": mercadillos["equipamiento"]
                            },
                            "consumibles": {
                                "totalLots": len(mercadillos["consumibles"]),
                                "totalValue": sum(e["price"] for e in mercadillos["consumibles"]),
                                "lastUpdated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S") if market_key == "consumibles" else None,
                                "listings": mercadillos["consumibles"]
                            }
                        },
                        "listings": all_listings
                    }

                    try:
                        with open(ACTIVE_LISTINGS_OUTPUT, "w", encoding="utf-8") as f:
                            json.dump(out_data, f, indent=2, ensure_ascii=False)
                        print(f"\n  [Guardado OK] {total_lots} lotes consolidados en:")
                        print(f"  sniffer/data/listings_en_venta_capturado.json")
                    except Exception as e:
                        print(f"  [Error guardando]: {e}")

                    print("\n  -> Puedes abrir otro mercadillo (o el mismo tras una venta) para actualizar.")
                    print("  -> Presiona CTRL+C para finalizar la sesion y volver al menu principal.\n")

            else:
                if now - feedback_time > 0.3:
                    rec_c = len(mercadillos["recursos"])
                    eq_c = len(mercadillos["equipamiento"])
                    con_c = len(mercadillos["consumibles"])
                    sys.stdout.write(
                        f"\r  [Escuchando puerto 5555] R:{rec_c} | E:{eq_c} | C:{con_c} | "
                        f"Abre la pestana 'VENTA' de cualquier mercadillo en Dofus...   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

    except KeyboardInterrupt:
        print("\n\n[Finalizando captura de listings activos]")
        all_listings = (
            mercadillos["recursos"] +
            mercadillos["equipamiento"] +
            mercadillos["consumibles"]
        )
        total_lots = len(all_listings)
        total_value = sum(e["price"] for e in all_listings)
        print("=" * 70)
        print(f"  RESUMEN FINAL DE LISTINGS ACTIVOS: {total_lots} lotes")
        print("=" * 70)
        print(f"    • Recursos     : {len(mercadillos['recursos']):2d} lotes")
        print(f"    • Equipamiento : {len(mercadillos['equipamiento']):2d} lotes")
        print(f"    • Consumibles  : {len(mercadillos['consumibles']):2d} lotes")
        print("-" * 70)
        print(f"  Total lotes guardados : {total_lots}")
        print(f"  Valor total en venta  : {total_value:,} K")
        print(f"  Archivo guardado      : sniffer/data/listings_en_venta_capturado.json")
        print("=" * 70)
        print("  Importa este archivo en DBHDV > Mi Mercadillo para ver tu inventario activo.")
    finally:
        if sniffer.running:
            sniffer.stop()

    input("\nPresiona Enter para continuar...")


def run_sniffer_session_bundle():
    """
    MODO SESIÓN COMPLETA (TODO-EN-UNO):
    Captura simultáneamente:
    - Precios de Mercadillo: enviados en tiempo real a la API de DBHDV.
    - Inventario y Banco: guardados en data/banco_inventario_capturado.json.
    - Historial de Ventas: guardado en data/historial_ventas_capturado.json.
    - Listings Activos en Venta: guardados en data/listings_en_venta_capturado.json.
    """
    km = load_keymap()
    market_token = km.get("price_list", "jzn")
    sales_token = km.get("sales_history", "kyo")
    active_token = km.get("active_listings", "ket")

    print("\n" + "=" * 70)
    print("  [SNIFFER SESION COMPLETA] CAPTURA UNIFICADA EN TIEMPO REAL")
    print("=" * 70)
    print("  Tokens Activos en Paralelo:")
    print(f"    * Mercadillo (price_list)    : '{market_token}' -> Envio directo a DBHDV")
    print(f"    * Almacen (inventory/storage): '{km.get('inventory', 'isb')}' / '{km.get('storage', 'hlp')}' -> banco_inventario_capturado.json")
    print(f"    * Historial (sales_history)  : '{sales_token}' -> historial_ventas_capturado.json")
    print(f"    * En Venta (active_listings) : '{active_token}' -> listings_en_venta_capturado.json")
    print("-" * 70)
    print("  Instrucciones:")
    print("  1. Juega normalmente en Dofus Unity 3.6.")
    print("  2. Consulta mercadillos, abre tu banco o la pestana de ventas.")
    print("  3. El sistema actualiza cada archivo JSON por separado en sniffer/data/.")
    print("  4. Presiona CTRL+C cuando desees finalizar la sesion.")
    print("-" * 70)

    load_items_dictionary()
    load_item_categories()

    accumulated_bank = {}
    bank_burst_active = False
    last_bank_pkt = 0.0

    unique_sales_dict = {}
    sales_burst_active = False
    sales_burst_stream = bytearray()
    last_sales_pkt = 0.0

    mercadillos = {"recursos": [], "equipamiento": [], "consumibles": []}
    if os.path.exists(ACTIVE_LISTINGS_OUTPUT):
        try:
            with open(ACTIVE_LISTINGS_OUTPUT, "r", encoding="utf-8") as f:
                prev_d = json.load(f)
                if isinstance(prev_d, dict) and "mercadillos" in prev_d:
                    for mk in ("recursos", "equipamiento", "consumibles"):
                        sec = prev_d["mercadillos"].get(mk, {})
                        if isinstance(sec, dict) and "listings" in sec:
                            mercadillos[mk] = sec["listings"]
                        elif isinstance(sec, list):
                            mercadillos[mk] = sec
        except Exception:
            pass

    listings_burst_stream = bytearray()
    listings_burst_active = False
    last_listings_pkt = 0.0

    market_queue = queue.Queue()
    market_sent_count = 0
    server_slug = os.environ.get("DOFUS_SERVER", "draconiros").strip().lower()

    def http_market_worker():
        nonlocal market_sent_count
        while True:
            item_payload = market_queue.get()
            if item_payload is None:
                break
            try:
                url = f"{DEFAULT_API_URL}/api/market/update"
                body_bytes = json.dumps(item_payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=body_bytes,
                    headers={"Content-Type": "application/json", "User-Agent": "DBHDV-UnifiedSniffer/1.0"}
                )
                with urllib.request.urlopen(req, timeout=4.0) as resp:
                    if resp.status == 200:
                        market_sent_count += 1
            except Exception:
                pass
            finally:
                market_queue.task_done()

    worker_thread = threading.Thread(target=http_market_worker, daemon=True)
    worker_thread.start()

    target_bytes_sales = f"type.ankama.com/{sales_token}".encode("ascii")
    target_bytes_active = f"type.ankama.com/{active_token}".encode("ascii")

    def on_packet(packet):
        nonlocal bank_burst_active, last_bank_pkt
        nonlocal sales_burst_active, last_sales_pkt
        nonlocal listings_burst_active, last_listings_pkt

        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 8:
            return

        now = time.time()

        # 1. Mercadillo
        if len(payload) >= 15:
            tokens = extract_type_tokens(payload)
            has_market_token = any(tok == market_token for tok, _ in tokens)
            if has_market_token or len(payload) >= 200:
                item_id, ladders, offer_prices = extract_market_universal(payload)
                if item_id > 0 and (ladders or offer_prices):
                    item_name = get_item_name(item_id)
                    now_str = datetime.datetime.now().strftime("%H:%M:%S")

                    payload_dict = {
                        "item_id": item_id,
                        "server": server_slug,
                    }
                    if ladders:
                        ladder_vals = ladders[0][1]
                        lad_dict = {}
                        for i, p in enumerate(ladder_vals):
                            if p > 0:
                                lad_dict[str(10**i)] = p
                        payload_dict["ladders"] = lad_dict
                        lad_str = " | ".join(f"x{k}: {v:,} K" for k, v in lad_dict.items())
                        print(f"  [{now_str}] [Mercadillo] {item_name} (#{item_id}) -> {lad_str}")
                    elif offer_prices:
                        payload_dict["prices"] = sorted(offer_prices)[:5]
                        top_3 = sorted(offer_prices)[:3]
                        lad_str = ", ".join(f"{p:,} K" for p in top_3)
                        print(f"  [{now_str}] [Mercadillo Equipos] {item_name} (#{item_id}) -> Minimos: {lad_str}")

                    market_queue.put(payload_dict)

        # 2. Almacen / Banco
        if len(payload) >= 15:
            direct_items = extract_items_recursive(payload)
            if direct_items:
                for gid, qty, uid in direct_items:
                    k = uid if uid > 0 else (gid, len(accumulated_bank))
                    accumulated_bank[k] = (gid, qty, uid)
                bank_burst_active = True
                last_bank_pkt = now

        # 3. Historial de Ventas
        if target_bytes_sales in payload or b"type.ankama.com/kyo" in payload:
            sales_burst_active = True
            sales_burst_stream.clear()

        if sales_burst_active:
            sales_burst_stream.extend(payload)
            last_sales_pkt = now

        # 4. Listings Activos
        if target_bytes_active in payload or b"type.ankama.com/ket" in payload or (listings_burst_active and len(payload) >= 150):
            listings_burst_active = True
            listings_burst_stream.extend(payload)
            last_listings_pkt = now

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("\n[Sesion Iniciada] Escuchando trafico en puerto 5555...")
    print("Realiza tus acciones en Dofus Unity (presiona CTRL+C para guardar y finalizar).\n")

    try:
        while True:
            time.sleep(0.1)
            now = time.time()

            # Guardado del Banco al finalizar rafaga
            if bank_burst_active and now - last_bank_pkt >= 1.8 and len(accumulated_bank) >= 2:
                bank_burst_active = False
                total_slots = len(accumulated_bank)
                total_units = sum(q for _, q, _ in accumulated_bank.values())
                items_list = [
                    {"uid": str(uid), "itemId": gid, "name": get_item_name(gid), "quantity": qty}
                    for gid, qty, uid in accumulated_bank.values()
                ]
                saved_bank_data = {
                    "metadata": {
                        "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "totalSlots": total_slots,
                        "totalUnits": total_units,
                        "uniqueTypes": len(set(gid for gid, _, _ in accumulated_bank.values())),
                    },
                    "items": items_list
                }
                try:
                    with open(INVENTORY_OUTPUT, "w", encoding="utf-8") as f:
                        json.dump(saved_bank_data, f, indent=2, ensure_ascii=False)
                    print(f"\n  [Guardado Banco] {total_slots} slots ({total_units:,} unidades) -> data/banco_inventario_capturado.json")
                except Exception as e:
                    print(f"\n  [Error guardando banco]: {e}")

            # Guardado de Historial al finalizar rafaga
            if sales_burst_active and now - last_sales_pkt >= 1.2 and len(sales_burst_stream) >= 300:
                raw_sales_bytes = bytes(sales_burst_stream)
                sales_burst_active = False
                sales_burst_stream.clear()
                entries = extract_sales_entries(raw_sales_bytes)
                if entries:
                    for s in entries:
                        k = (s.get("rawDate") or s.get("date"), s.get("itemId"), s.get("price"), s.get("quantity"))
                        if k not in unique_sales_dict:
                            unique_sales_dict[k] = s
                    sales_list = list(unique_sales_dict.values())
                    sold_k = sum(s.get("price", 0) for s in sales_list if s.get("status") == "Vendido")
                    unsold_k = sum(s.get("price", 0) for s in sales_list if s.get("status") == "Sin vender")
                    saved_sales_data = {
                        "metadata": {
                            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "totalSales": len(sales_list),
                            "totalKamas": sold_k,
                            "soldKamas": sold_k,
                            "unsoldKamas": unsold_k,
                            "soldCount": sum(1 for s in sales_list if s.get("status") == "Vendido"),
                            "unsoldCount": sum(1 for s in sales_list if s.get("status") == "Sin vender"),
                        },
                        "sales": sales_list
                    }
                    try:
                        with open(SALES_OUTPUT, "w", encoding="utf-8") as f:
                            json.dump(saved_sales_data, f, indent=2, ensure_ascii=False)
                        print(f"\n  [Guardado Historial] {len(sales_list):,} ventas registradas -> data/historial_ventas_capturado.json")
                    except Exception as e:
                        print(f"\n  [Error guardando historial]: {e}")

            # Guardado de Listings Activos al finalizar rafaga
            if listings_burst_active and now - last_listings_pkt >= 1.2 and len(listings_burst_stream) >= 200:
                raw_listings_bytes = bytes(listings_burst_stream)
                listings_burst_active = False
                listings_burst_stream.clear()
                new_listings = extract_active_listings(raw_listings_bytes)
                if new_listings:
                    market_key = classify_batch_market(new_listings)
                    now_ts = int(time.time())
                    for entry in new_listings:
                        secs = entry.get("secondsRemaining", 0)
                        if secs > 0:
                            entry["expiresAt"] = datetime.datetime.fromtimestamp(now_ts + secs).strftime("%Y-%m-%d %H:%M:%S")
                            days = secs // 86400
                            hours = (secs % 86400) // 3600
                            entry["timeLabel"] = f"{days}d {hours}h" if days > 0 else f"{hours}h"
                        else:
                            entry["expiresAt"] = None
                            entry["timeLabel"] = "Desconocido"
                        entry["market"] = market_key

                    mercadillos[market_key] = new_listings
                    all_listings = mercadillos["recursos"] + mercadillos["equipamiento"] + mercadillos["consumibles"]
                    saved_listings_data = {
                        "metadata": {
                            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "totalLots": len(all_listings),
                            "totalValue": sum(e["price"] for e in all_listings),
                        },
                        "mercadillos": {
                            "recursos": {"totalLots": len(mercadillos["recursos"]), "totalValue": sum(e["price"] for e in mercadillos["recursos"]), "listings": mercadillos["recursos"]},
                            "equipamiento": {"totalLots": len(mercadillos["equipamiento"]), "totalValue": sum(e["price"] for e in mercadillos["equipamiento"]), "listings": mercadillos["equipamiento"]},
                            "consumibles": {"totalLots": len(mercadillos["consumibles"]), "totalValue": sum(e["price"] for e in mercadillos["consumibles"]), "listings": mercadillos["consumibles"]},
                        },
                        "listings": all_listings
                    }
                    try:
                        with open(ACTIVE_LISTINGS_OUTPUT, "w", encoding="utf-8") as f:
                            json.dump(saved_listings_data, f, indent=2, ensure_ascii=False)
                        print(f"\n  [Guardado En Venta] {len(all_listings)} lotes activos ({market_key}) -> data/listings_en_venta_capturado.json")
                    except Exception as e:
                        print(f"\n  [Error guardando listings]: {e}")

    except KeyboardInterrupt:
        print("\n\n" + "=" * 70)
        print("  RESUMEN DE SESION COMPLETA FINALIZADA")
        print("=" * 70)
        print(f"  * Mercadillo : {market_sent_count} actualizaciones enviadas en vivo a DBHDV")
        print(f"  * Banco      : {len(accumulated_bank)} slots en sniffer/data/banco_inventario_capturado.json")
        print(f"  * Historial  : {len(unique_sales_dict)} ventas en sniffer/data/historial_ventas_capturado.json")
        tot_lots = sum(len(v) for v in mercadillos.values())
        print(f"  * En Venta   : {tot_lots} lotes en sniffer/data/listings_en_venta_capturado.json")
        print("-" * 70)
        print("  Puedes importar estos 3 archivos JSON a la vez en DBHDV > Mi Banco.")
        print("=" * 70)
    finally:
        if sniffer.running:
            sniffer.stop()
        market_queue.put(None)

    input("\nPresiona Enter para volver al menu...")


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
    print("    • Almacén (storage)          : '" + str(km.get('storage', 'No calibrado')) + "'")
    print("    • Historial (sales_history)  : '" + str(km.get('sales_history', 'No calibrado')) + "'")
    print("    • En Venta (active_listings) : '" + str(km.get('active_listings', 'No calibrado')) + "'")
    print("    • Última calibración         : " + str(km.get('last_calibrated', 'Nunca')))
    print("-" * 70)
    print("  [MODO CAPTURA Y GESTIÓN EN VIVO]")
    print("    [S] Sniffer de Sesión Completa Todo-en-Uno (Mercadillo Cloud + Banco + Historial + Listings)")
    print("    [1] Sniffer Mercadillo (Precios HDV en Vivo)")
    print("    [2] Sniffer Almacén Unificado (Inventario + Banco + Merkasako)")
    print("    [3] Sniffer Historial de Ventas (Transacciones y Caducidades)")
    print("    [4] Sniffer Listings ACTIVOS en Venta (Lotes puestos en HDV)")
    print("    [5] Abrir Visor Visual de Almacén (visor_almacen.html)")
    print("    [6] Abrir Visor Visual de Historial (visor_historial.html)")
    print("\n  [MODO CALIBRACIÓN Y DIAGNÓSTICO]")
    print("    [7] Calibrar Token de Mercadillo (price_list)")
    print("    [8] Calibrar Token de Almacén (inventory / storage)")
    print("    [9] Calibrar Token de Historial de Ventas (sales_history)")
    print("    [10] Calibrar Token de Listings ACTIVOS en Venta (active_listings)")
    print("    [11] Sincronizar Tokens desde DBHDV Cloud")
    print("    [12] Ver Registro de Diagnóstico y Telemetría")
    print("\n    [0] Salir")
    print("=" * 70)

def main():
    sync_tokens_from_cloud(silent=True)

    while True:
        print_menu()
        try:
            choice = input("Selecciona una opción [0-12 / S]: ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print("\n¡Hasta pronto!")
            break

        if choice in ("s", "sesion", "bundle", "all"):
            run_sniffer_session_bundle()
        elif choice == "1":
            run_sniffer_market()
        elif choice == "2":
            run_sniffer_storage()
        elif choice == "3":
            run_sniffer_sales()
        elif choice == "4":
            run_sniffer_active_listings()
        elif choice == "5":
            open_storage_viewer()
        elif choice == "6":
            open_sales_viewer()
        elif choice == "7":
            run_calibrator_market()
        elif choice == "8":
            run_sniffer_storage()
        elif choice == "9":
            run_calibrator_sales()
        elif choice == "10":
            run_calibrator_active_listings()
        elif choice == "11":
            sync_tokens_from_cloud(silent=False)
        elif choice in ("12", "d", "diag"):
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
            print("\n[Opción no válida. Ingresa un número del 0 al 12]")

if __name__ == "__main__":
    main()
