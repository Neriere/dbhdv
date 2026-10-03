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

# Asegurar directorio de caché seguro para Scapy/Pip (evita PermissionError en ~/.cache en Windows)
if "XDG_CACHE_HOME" not in os.environ:
    _local_cache = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "cache")
    try:
        os.makedirs(_local_cache, exist_ok=True)
        os.environ["XDG_CACHE_HOME"] = _local_cache
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
    if "--no-uac" in sys.argv or os.environ.get("NO_UAC"):
        return
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
    try:
        input("\nPresiona Enter para salir...")
    except Exception:
        pass
    sys.exit(1)
except Exception as e:
    print(f"\n[Error cargando Scapy / Npcap]: {e}")
    print("Asegúrate de que Npcap esté instalado en modo WinPcap compatible (https://npcap.com).")
    try:
        input("\nPresiona Enter para salir...")
    except Exception:
        pass
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
QUOTATIONS_OUTPUT = os.path.join(DATA_DIR, "cotizaciones_capturadas.json")

LAST_MARKET_ITEM_ID = 0
ITEM_SALES_VOLUME = {}
QUOTATION_BUFFERS = {}
QUOTATION_LOCK = threading.Lock()

ITEMS_DB_FILE = (
    os.path.join(CONFIG_DIR, "items_db.json") if os.path.exists(os.path.join(CONFIG_DIR, "items_db.json"))
    else os.path.join(SUITE_DIR, "items_db.json") if os.path.exists(os.path.join(SUITE_DIR, "items_db.json"))
    else os.path.join(PROJECT_ROOT, "scripts", "items_db.json")
)
STATIC_DICT_FILE = os.path.join(PROJECT_ROOT, "src", "data", "staticItemsDictionary.json")

VIEWER_HTML = os.path.join(VIEWER_DIR, "visor_almacen.html")
GENERATOR_SCRIPT = os.path.join(VIEWER_DIR, "generar_visor_almacen.py")
SALES_VIEWER_HTML = os.path.join(VIEWER_DIR, "visor_historial.html")
SALES_GENERATOR_SCRIPT = os.path.join(VIEWER_DIR, "generar_visor_historial.py")

DEFAULT_API_URL = os.environ.get("DBHDV_API_URL", "https://dbhdv.vercel.app")

# Inicialización garantizada de logs desde el arranque
try:
    if not os.path.exists(SNIFFER_LOG):
        with open(SNIFFER_LOG, "w", encoding="utf-8") as f:
            f.write(f"=== DBHDV SUITE LOG INICIALIZADO ({datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===\n\n")
    if not os.path.exists(DIAGNOSTIC_LOG):
        with open(DIAGNOSTIC_LOG, "w", encoding="utf-8") as f:
            f.write(f"=== DBHDV DIAGNOSTICO INICIALIZADO ({datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===\n\n")
except Exception:
    pass

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

    for cand_db in [
        os.path.join(CONFIG_DIR, "items_db.json"),
        os.path.join(SUITE_DIR, "items_db.json"),
        os.path.join(PROJECT_ROOT, "scripts", "items_db.json"),
        ITEMS_DB_FILE
    ]:
        if os.path.exists(cand_db):
            try:
                with open(cand_db, "r", encoding="utf-8") as f:
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

    # Sanitizar colisiones corruptas históricas de "Puré pic-feil" (solo 35089 y 666 son legítimos)
    corrupt_keys = [k for k, v in list(ITEMS_NAME_MAP.items()) if str(v).strip().lower() == "puré pic-feil" and k not in (35089, 666)]
    for k in corrupt_keys:
        del ITEMS_NAME_MAP[k]

def get_item_name(item_id):
    load_items_dictionary()
    if item_id in ITEMS_NAME_MAP:
        val = ITEMS_NAME_MAP[item_id]
        if str(val).strip().lower() == "puré pic-feil" and item_id not in (35089, 666):
            del ITEMS_NAME_MAP[item_id]
        else:
            return val
    return f"Objeto #{item_id}"

SNIFFER_LOG_LOCK = threading.Lock()

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

def log_sniffer_event(module, msg, payload=None, extra=None):
    """
    Registra eventos detallados de captura en sniffer/logs/sniffer.log y
    mantiene trazabilidad con volcado hexadecimal para diagnóstico.
    """
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [f"[{ts}] [{module}] {msg}"]
    if extra:
        lines.append(f"  Detalle: {extra}")
    if payload and isinstance(payload, (bytes, bytearray)):
        plen = len(payload)
        hex_preview = payload[:64].hex(" ").upper()
        lines.append(f"  Longitud: {plen} bytes | Hex: {hex_preview}")
    entry = "\n".join(lines) + "\n"

    with SNIFFER_LOG_LOCK:
        try:
            if os.path.exists(SNIFFER_LOG) and os.path.getsize(SNIFFER_LOG) > 5 * 1024 * 1024:
                with open(SNIFFER_LOG, "w", encoding="utf-8") as f:
                    f.write(f"=== LOG ROTADO ({ts}) ===\n")
            with open(SNIFFER_LOG, "a", encoding="utf-8") as f:
                f.write(entry)
        except Exception:
            pass

    log_diagnostic(f"[{module}] {msg}", payload_sample=payload[:32].hex() if payload else None)

def init_session_log(session_type="TODO-EN-UNO"):
    """Inicializa y escribe cabecera en el archivo de log al arrancar una nueva sesión de captura"""
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = [
        "=" * 80,
        f"  DBHDV UNIFIED SUITE -> REGISTRO DE SESION ACTIVA [{session_type}]",
        f"  Inicio de sesión : {ts}",
        f"  Ruta log         : {SNIFFER_LOG}",
        "=" * 80,
        ""
    ]
    with SNIFFER_LOG_LOCK:
        try:
            with open(SNIFFER_LOG, "a", encoding="utf-8") as f:
                f.write("\n".join(header) + "\n")
        except Exception:
            pass
    log_diagnostic(f"Sesión iniciada: {session_type}")

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

def clean_ladder(raw_list):
    if not raw_list:
        return []
    cl = [int(p) for p in raw_list if p is not None]
    if not cl:
        return []

    # 1. Prefijo de conteo exacto de Dofus Unity (len == count + 1)
    if len(cl) > 1 and 1 <= cl[0] <= 10 and len(cl) == cl[0] + 1:
        cl = cl[1:]
    # 2. Prefijo SuperTypeId / Categoría (ej: [6, 1370, 13486, 135900, 1398990])
    elif len(cl) == 5 and cl[0] <= 100:
        if cl[0] <= 20 or (cl[1] > 0 and cl[2] >= cl[1]):
            cl = cl[1:]

    # En Dofus los recursos tienen MÁXIMO 4 escalas: x1, x10, x100, x1000
    cleaned = []
    for x in cl[:4]:
        if x == 0 or 50 <= x <= 2_000_000_000:
            cleaned.append(x)
        else:
            cleaned.append(0)
    while cleaned and cleaned[-1] == 0:
        cleaned.pop()
    return cleaned

def extract_type_tokens(buf):
    tokens = []
    for m in re.finditer(rb'type\.ankama\.com/([a-z0-9]+(?:\.[a-z0-9]+)*)', buf):
        tok = m.group(1).decode("ascii", errors="ignore")
        tokens.append((tok, m.start()))
    return tokens

def parse_dofus_item_submessage(sub):
    off = 0
    sub_fields = {}
    inner_item = None
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
            if r2 == 0 or off + r2 + l > len(sub):
                break
            off += r2
            inner_bytes = sub[off:off + l]
            off += l
            if fn in (4, 5):
                res = parse_dofus_item_submessage(inner_bytes)
                if res:
                    inner_item = res
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
    if inner_item:
        return inner_item
    return None

def extract_items_recursive(buf):
    items = []
    seen_keys = set()

    def walk(b, depth=0):
        if depth > 6 or len(b) < 6:
            return
        off = 0
        while off < len(b):
            if b[off:off+16] == b"type.ankama.com/":
                space_or_tag = off + 16
                while space_or_tag < min(len(b), off + 30) and 0x61 <= b[space_or_tag] <= 0x7A:
                    space_or_tag += 1
                off = space_or_tag
                if off < len(b) and b[off] == 0x12:
                    off += 1
                    _, r = decode_varint(b, off)
                    off += r
                continue

            tag, r = decode_varint(b, off)
            if r == 0:
                off += 1
                continue
            off += r
            fnum = tag >> 3
            wtype = tag & 7

            if wtype == 2:
                length, r2 = decode_varint(b, off)
                if r2 == 0:
                    off += 1
                    continue
                off += r2
                if off + length <= len(b):
                    sub_data = b[off:off + length]
                    off += length
                else:
                    sub_data = b[off:]
                    off = len(b)

                item = parse_dofus_item_submessage(sub_data)
                if item:
                    gid, qty, uid = item
                    key = uid if uid > 0 else (gid, len(items))
                    if key not in seen_keys:
                        seen_keys.add(key)
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
                off += 1

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
                    if 1 <= len(cl) <= 4 and all(p >= 0 for p in cl) and any(p > 10 for p in cl):
                        ladders.append((fnum, cl))
            elif wtype == 1:
                off += 8
            elif wtype == 5:
                off += 4
            else:
                break
    walk(buf)
    return item_id, ladders, offer_prices

def parse_market_message(buf, market_token="jzn"):
    """
    Decodifica ÚNICAMENTE paquetes que contienen el TypeURL de mercadillo verificado.
    Localiza la sub-estructura protobuf (tag 0x12) tras el TypeURL para aislar
    los datos reales del objeto e ignorar ruido de envoltorio u otros paquetes.
    """
    if not market_token or market_token == "No calibrado":
        market_token = "jzn"
    t_bytes = f"type.ankama.com/{market_token}".encode("ascii")

    # 1. Búsqueda directa por token principal calibrado
    if t_bytes in buf:
        pos = 0
        while True:
            found = buf.find(t_bytes, pos)
            if found == -1:
                break
            tok_end = found + len(t_bytes)
            pos = tok_end

            off_12 = buf.find(bytes([0x12]), tok_end, min(len(buf), tok_end + 30))
            if off_12 == -1:
                sub_payload = buf[tok_end:]
            else:
                off = off_12 + 1
                if off >= len(buf):
                    continue
                payload_len, br = decode_varint(buf, off)
                if br == 0 or off + br + payload_len > len(buf):
                    sub_payload = buf[tok_end:]
                else:
                    off += br
                    sub_payload = buf[off : off + payload_len]

            item_id, ladders, offer_prices = extract_market_universal(sub_payload)
            if item_id >= 10 and (ladders or offer_prices):
                global LAST_MARKET_ITEM_ID
                LAST_MARKET_ITEM_ID = item_id
                return item_id, ladders, offer_prices


    return 0, [], []


def calculate_quick_price(is_equip, prices):
    """
    Calcula el precio de referencia rápido a partir de la lista de ofertas o escalas del mercadillo.
    """
    if is_equip:
        valid = [int(p) for p in prices if isinstance(p, (int, float)) and p >= 50]
        if not valid:
            return 0
        valid.sort()
        if len(valid) == 1:
            return valid[0]
        elif len(valid) == 2:
            return round((valid[0] + valid[1]) / 2)
        else:
            std = [p for p in valid if p <= valid[0] * 1.8]
            use = std if std else valid
            low = use[:min(3, len(use))]
            low_avg = sum(low) / len(low)
            med = use[len(use) // 2]
            return round(low_avg * 0.7 + med * 0.3)
    else:
        cl = clean_ladder(prices)
        p1 = cl[0] if len(cl) > 0 else 0
        p10 = cl[1] if len(cl) > 1 else 0
        p100 = cl[2] if len(cl) > 2 else 0
        p1000 = cl[3] if len(cl) > 3 else 0
        lots = []
        if p1 > 0: lots.append((p1, 0.40))
        if p10 > 0: lots.append((round(p10 / 10.0), 0.30))
        if p100 > 0: lots.append((round(p100 / 100.0), 0.20))
        if p1000 > 0: lots.append((round(p1000 / 1000.0), 0.10))
        if not lots:
            return 0
        tot_w = sum(w for _, w in lots)
        return round(sum(u * w for u, w in lots) / tot_w)


def save_captured_quotation(item_id, item_name, quotation_data):
    """
    Guarda o actualiza la cotización capturada de un ítem en data/cotizaciones_capturadas.json
    """
    try:
        data = {}
        if os.path.exists(QUOTATIONS_OUTPUT):
            try:
                with open(QUOTATIONS_OUTPUT, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        if not isinstance(data, dict) or "items" not in data:
            data = {
                "metadata": {
                    "lastUpdated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "totalItems": 0
                },
                "items": {}
            }
        data["items"][str(item_id)] = {
            "itemId": item_id,
            "name": item_name,
            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            **quotation_data
        }
        data["metadata"]["totalItems"] = len(data["items"])
        data["metadata"]["lastUpdated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(QUOTATIONS_OUTPUT, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def parse_quotation_message(payload, now_ts=None):
    """
    Decodifica paquetes Ankama Protobuf Any ('type.ankama.com/iuk' o 'type.ankama.com/ive')
    de la ventana de Cotizaciones del Mercado. Extrae simultáneamente las series temporales
    completas de 24 Horas (Campo #1), 30 Días (Campo #2) y 7 Días (últimos 7 días).
    """
    if not payload:
        return 0, None, None, ""

    target_header = None
    if b"type.ankama.com/iuk" in payload:
        target_header = b"type.ankama.com/iuk"
    elif b"type.ankama.com/ive" in payload:
        target_header = b"type.ankama.com/ive"
    else:
        return 0, None, None, ""

    try:
        idx = payload.find(target_header)
        tok_end = idx + len(target_header)

        off_12 = payload.find(bytes([0x12]), tok_end, min(len(payload), tok_end + 32))
        if off_12 != -1:
            off = off_12 + 1
            len2, r2_len = decode_varint(payload, off)
            off += r2_len
            payload_data = payload[off:off + len2] if len2 > 0 else payload[off:]
        else:
            tag2, r2 = decode_varint(payload, tok_end)
            off = tok_end + r2
            len2, r2_len = decode_varint(payload, off)
            off += r2_len
            payload_data = payload[off:off + len2] if len2 > 0 else payload[off:]

        entries_24h = []
        entries_30d = []
        item_id_found = 0

        p_off = 0
        while p_off < len(payload_data):
            tag_e, r_e = decode_varint(payload_data, p_off)
            if r_e == 0:
                break
            p_off += r_e
            fnum_e = tag_e >> 3
            len_e, r_len_e = decode_varint(payload_data, p_off)
            p_off += r_len_e
            entry_buf = payload_data[p_off:p_off + len_e]
            p_off += len_e

            e_off = 0
            vol, date_str, price, iid = 0, "", 0, 0
            while e_off < len(entry_buf):
                t_f, r_f = decode_varint(entry_buf, e_off)
                if r_f == 0:
                    break
                e_off += r_f
                f_num = t_f >> 3
                w_type = t_f & 7
                if w_type == 0:
                    v_val, r_v = decode_varint(entry_buf, e_off)
                    e_off += r_v
                    if f_num == 1:
                        vol = v_val
                    elif f_num == 3:
                        price = v_val
                    elif f_num == 4:
                        iid = v_val
                        if iid >= 10:
                            item_id_found = iid
                elif w_type == 2:
                    l_str, r_s = decode_varint(entry_buf, e_off)
                    e_off += r_s
                    date_str = entry_buf[e_off:e_off + l_str].decode("utf-8", errors="ignore")
                    e_off += l_str
                else:
                    break

            if date_str:
                ts = 0
                try:
                    cleaned = date_str.split(".")[0].replace("Z", "+00:00")
                    ts = datetime.datetime.fromisoformat(cleaned).timestamp()
                except Exception:
                    pass
                entry = {"date": date_str, "price": price, "volume": vol, "item_id": iid, "ts": ts}
                if fnum_e == 1:
                    entries_24h.append(entry)
                elif fnum_e == 2:
                    entries_30d.append(entry)
                else:
                    entries_30d.append(entry)

        if not entries_24h and not entries_30d:
            return 0, None, None, ""

        if not entries_30d and len(entries_24h) > 24:
            entries_30d = entries_24h
            entries_24h = []

        if entries_24h:
            entries_24h.sort(key=lambda e: e.get("ts", 0))
        if entries_30d:
            entries_30d.sort(key=lambda e: e.get("ts", 0))

        all_ts = [e["ts"] for e in (entries_24h + entries_30d) if e.get("ts", 0) > 0]
        max_ts = max(all_ts) if all_ts else 0

        ref_now = now_ts if now_ts is not None else (max_ts if max_ts > 0 else time.time())
        cutoff_7d = ref_now - (7 * 86400 + 3600)
        cutoff_24h = ref_now - (24 * 3600 + 1800)

        def calculate_weighted_median(items):
            sorted_items = sorted(items, key=lambda x: x[0])
            total_vol = sum(x[1] for x in sorted_items)
            half_vol = total_vol / 2.0
            cum_vol = 0
            for p, v in sorted_items:
                cum_vol += v
                if cum_vol >= half_vol:
                    return p
            return sorted_items[-1][0] if sorted_items else 0

        # 1. Métricas 24 Horas (últimos 22 intervalos horarios de la UI)
        calc_24h = entries_24h[-22:] if len(entries_24h) >= 22 else entries_24h
        sales24h = sum(e["volume"] for e in calc_24h)
        w_sum_24 = sum(e["price"] * e["volume"] for e in calc_24h)
        price24h = (w_sum_24 // sales24h) if sales24h > 0 else 0
        pairs_24 = [(e["price"], e["volume"]) for e in calc_24h if e["price"] > 0 and e["volume"] > 0]
        median24h = calculate_weighted_median(pairs_24) if pairs_24 else price24h

        # 2. Métricas 30 Días
        sales30d = sum(e["volume"] for e in entries_30d)
        w_sum_30 = sum(e["price"] * e["volume"] for e in entries_30d)
        price30d = (w_sum_30 // sales30d) if sales30d > 0 else 0
        pairs_30 = [(e["price"], e["volume"]) for e in entries_30d if e["price"] > 0 and e["volume"] > 0]
        median30d = calculate_weighted_median(pairs_30) if pairs_30 else price30d

        # 3. Métricas 7 Días (últimos 8 puntos diarios si la serie >= 28 días)
        if len(entries_30d) >= 28:
            entries_7d = entries_30d[-8:]
        elif any(e.get("ts", 0) > 0 for e in entries_30d):
            entries_7d = [e for e in entries_30d if e.get("ts", 0) >= cutoff_7d]
        else:
            entries_7d = entries_30d[-8:] if len(entries_30d) >= 8 else entries_30d

        sales7d = sum(e["volume"] for e in entries_7d)
        w_sum_7 = sum(e["price"] * e["volume"] for e in entries_7d)
        price7d = (w_sum_7 // sales7d) if sales7d > 0 else 0
        pairs_7 = [(e["price"], e["volume"]) for e in entries_7d if e["price"] > 0 and e["volume"] > 0]
        median7d = calculate_weighted_median(pairs_7) if pairs_7 else price7d

        # Invariante temporal matemática: 24h ⊆ 7d ⊆ 30d
        if sales24h > sales7d:
            sales7d = sales24h
            if price7d == 0 and price24h > 0:
                price7d = price24h
                median7d = median24h
        if sales7d > sales30d:
            sales30d = sales7d
            if price30d == 0 and price7d > 0:
                price30d = price7d
                median30d = median7d

        # Estimación promedio diario
        if sales24h == 0 and sales7d == 0:
            avg_daily = 0.0
        elif sales30d > 0:
            avg_daily = round(sales30d / 30.0, 1)
        elif sales7d > 0:
            avg_daily = round(sales7d / 7.0, 1)
        else:
            avg_daily = float(sales24h)

        def get_robust_period_price(price, median, vol=0):
            if median > 0 and price > 0:
                if price > median * 1.8:
                    return median
                if vol >= 2 and median < price:
                    return round(median * 0.70 + price * 0.30)
                if price < median * 0.5:
                    return median
                return price
            return median if median > 0 else price

        p24_rep = get_robust_period_price(price24h, median24h, sales24h) if (sales24h > 0 and (price24h > 0 or median24h > 0)) else 0
        p7_rep = get_robust_period_price(price7d, median7d, sales7d) if (sales7d > 0 and (price7d > 0 or median7d > 0)) else 0
        p30_rep = get_robust_period_price(price30d, median30d, sales30d) if (sales30d > 0 and (price30d > 0 or median30d > 0)) else 0

        is_active_downtrend = sales24h >= 3 and p24_rep > 0 and p7_rep > 0 and p24_rep < p7_rep * 0.65

        vol_periods = []
        if p24_rep > 0:
            w24 = 0.80 if is_active_downtrend else 0.45
            vol_periods.append({"w": w24, "p": p24_rep})
        if p7_rep > 0:
            w7 = 0.15 if is_active_downtrend else 0.35
            vol_periods.append({"w": w7, "p": p7_rep})
        if p30_rep > 0:
            w30 = 0.05 if is_active_downtrend else 0.20
            vol_periods.append({"w": w30, "p": p30_rep})

        if vol_periods:
            tot_w = sum(vp["w"] for vp in vol_periods)
            suggested_price = int(round(sum(vp["p"] * vp["w"] for vp in vol_periods) / tot_w))
            if is_active_downtrend and suggested_price > p24_rep * 1.4:
                suggested_price = int(round(p24_rep * 1.4))
        else:
            suggested_price = p24_rep or p7_rep or p30_rep or 0

        sales_data = {
            "sales24h": sales24h,
            "price24h": price24h if sales24h > 0 else 0,
            "median24h": median24h if sales24h > 0 else 0,
            "sales7d": sales7d,
            "price7d": price7d if sales7d > 0 else 0,
            "median7d": median7d if sales7d > 0 else 0,
            "sales30d": sales30d,
            "price30d": price30d if sales30d > 0 else 0,
            "median30d": median30d if sales30d > 0 else 0,
            "avgDailySales": avg_daily,
            "suggestedPrice": suggested_price,
            "medianPrice": median24h or median7d or median30d or 0,
            "updatedAt": int(time.time() * 1000)
        }

        return item_id_found, sales_data, entries_30d or entries_24h, "all"
    except Exception:
        return 0, None, None, ""


def process_packet(pkt):
    """
    Procesa un paquete de red para pruebas unitarias y motor de eventos.
    Soporta reensamblado de fragmentos TCP de cotizaciones ('type.ankama.com/iuk' o 'ive').
    """
    global LAST_MARKET_ITEM_ID
    try:
        if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
            return
        if pkt[TCP].sport != 5555 and pkt[TCP].dport == 5555:
            return

        raw_load = bytes(pkt[Raw].load)
        if len(raw_load) == 0:
            return

        km = load_keymap()
        market_tok = km.get("price_list", "jzn")
        if f"type.ankama.com/{market_tok}".encode("ascii") in raw_load:
            item_id, ladders, offer_prices = parse_market_message(raw_load, market_tok)
            if item_id > 0:
                LAST_MARKET_ITEM_ID = item_id

        has_iuk = b"type.ankama.com/iuk" in raw_load or b"type.ankama.com/ive" in raw_load
        if pkt.haslayer(IP):
            conn_key = (pkt[IP].src, pkt[TCP].sport, pkt[IP].dst, pkt[TCP].dport)
        else:
            conn_key = pkt[TCP].sport

        with QUOTATION_LOCK:
            in_buffer = conn_key in QUOTATION_BUFFERS

        if in_buffer or has_iuk:
            now_t = time.time()
            with QUOTATION_LOCK:
                existing = QUOTATION_BUFFERS.get(conn_key)
                if existing and (now_t - existing.get("ts", 0)) > 4.0:
                    existing = None

                if existing:
                    buf = existing["buf"] + raw_load
                else:
                    target_hdr = b"type.ankama.com/iuk" if b"type.ankama.com/iuk" in raw_load else b"type.ankama.com/ive"
                    idx = raw_load.find(target_hdr)
                    buf = raw_load[idx:] if idx != -1 else b""

                target_hdr = b"type.ankama.com/iuk" if b"type.ankama.com/iuk" in buf else (b"type.ankama.com/ive" if b"type.ankama.com/ive" in buf else None)

                if buf and target_hdr:
                    idx = buf.find(target_hdr)
                    tok_end = idx + len(target_hdr)

                    off_12 = buf.find(bytes([0x12]), tok_end, min(len(buf), tok_end + 16))
                    off = (off_12 + 1) if off_12 != -1 else (tok_end + 1)

                    if len(buf) > off:
                        len2, r2_len = decode_varint(buf, off)
                        if r2_len > 0:
                            off += r2_len
                            total_needed = off + len2
                            if len(buf) >= total_needed:
                                quotation_payload = buf[idx:total_needed]
                                QUOTATION_BUFFERS.pop(conn_key, None)
                                q_id, s_data, _, _ = parse_quotation_message(quotation_payload)
                                target_id = q_id or LAST_MARKET_ITEM_ID
                                if target_id and s_data:
                                    ITEM_SALES_VOLUME[target_id] = s_data
                            else:
                                if len(buf) < 500000:
                                    QUOTATION_BUFFERS[conn_key] = {"buf": buf, "ts": now_t}
                                else:
                                    QUOTATION_BUFFERS.pop(conn_key, None)
                        else:
                            QUOTATION_BUFFERS[conn_key] = {"buf": buf, "ts": now_t}
                    else:
                        QUOTATION_BUFFERS[conn_key] = {"buf": buf, "ts": now_t}
                else:
                    QUOTATION_BUFFERS.pop(conn_key, None)
    except Exception:
        pass

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

        # Verificación estricta: ÚNICAMENTE procesar si contiene el TypeURL de mercadillo verificado
        item_id, ladders, offer_prices = parse_market_message(payload, market_token)
        if item_id > 0 and (ladders or offer_prices):
            item_name = get_item_name(item_id)
            now_str = datetime.datetime.now().strftime("%H:%M:%S")

            if ladders:
                ladder_vals = ladders[0][1][:4]
                lad_str = " | ".join(f"x{10**i}: {p:,} K" for i, p in enumerate(ladder_vals) if p > 0)
                print(f"  [{now_str}] 📦 {item_name} (#{item_id}) -> {lad_str}")
                log_sniffer_event("MERCADILLO", f"{item_name} (#{item_id}) -> {lad_str}", payload=payload)
            elif offer_prices:
                top_3 = sorted(offer_prices)[:3]
                lad_str = ", ".join(f"{p:,} K" for p in top_3)
                print(f"  [{now_str}] 🛡️ {item_name} (#{item_id}) [Equipamiento] -> Mínimos: {lad_str}")
                log_sniffer_event("MERCADILLO_EQUIPO", f"{item_name} (#{item_id}) -> Mínimos: {lad_str}", payload=payload)

        # Cotizaciones del Mercado (type.ankama.com/iuk o ive)
        if b"type.ankama.com/iuk" in payload or b"type.ankama.com/ive" in payload:
            q_id, s_data, _, _ = parse_quotation_message(payload)
            target_id = q_id or LAST_MARKET_ITEM_ID
            if target_id > 0 and s_data:
                target_name = get_item_name(target_id)
                now_str = datetime.datetime.now().strftime("%H:%M:%S")
                s24 = s_data.get("sales24h", 0)
                p24 = s_data.get("price24h", 0)
                s7 = s_data.get("sales7d", 0)
                p7 = s_data.get("price7d", 0)
                s30 = s_data.get("sales30d", 0)
                p30 = s_data.get("price30d", 0)
                sug_p = s_data.get("suggestedPrice", 0)
                print(f"\n  [{now_str}] 📈 [Cotización] {target_name} (#{target_id})")
                print(f"       • 24h: {s24:,} ventas ({p24:,} K) | 7d: {s7:,} ventas ({p7:,} K) | 30d: {s30:,} ventas ({p30:,} K)")
                print(f"       • Sugerido : {sug_p:,} K\n")
                log_sniffer_event("COTIZACION", f"{target_name} (#{target_id}) -> 24h:{s24}v | 7d:{s7}v | 30d:{s30}v | Sug:{sug_p}K", payload=payload)
                save_captured_quotation(target_id, target_name, s_data)

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

    init_session_log("ALMACEN")
    storage_lock = threading.Lock()
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
            with storage_lock:
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
                with storage_lock:
                    items_snapshot = list(accumulated_items.values())
                slots = len(items_snapshot)
                total_units = sum(q for _, q, _ in items_snapshot)
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
        with storage_lock:
            for gid, qty, uid in stream_items:
                key = uid if uid > 0 else (gid, len(accumulated_items))
                accumulated_items[key] = (gid, qty, uid)

    with storage_lock:
        items_snapshot = list(accumulated_items.values())

    if not items_snapshot:
        print("\n❌ No se detectó ninguna lista de almacén en este intento.")
        print("Sugerencia: Asegúrate de estar dentro del juego y hacer clic en la pestaña de 'VENTA' del mercadillo.")
        return

    # Guardar en data/banco_inventario_capturado.json
    total_slots = len(items_snapshot)
    total_units = sum(q for _, q, _ in items_snapshot)
    unique_types = len(set(gid for gid, _, _ in items_snapshot))

    items_list = []
    for gid, qty, uid in items_snapshot:
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
        tok_end = idx + len(b'type.ankama.com/kyo')
        off_12 = buf.find(bytes([0x12]), tok_end, min(len(buf), tok_end + 16))
        if off_12 != -1:
            off = off_12 + 1
            _, r = decode_varint(buf, off)
            start_pos = off + r
        else:
            start_pos = tok_end

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

    # 2. Si no encontró por escaneo de flujo, aplicar recorrido recursivo tolerante
    if not sales:
        seen_keys = set()
        def walk(b, depth=0):
            if depth > 4 or len(b) < 10:
                return
            woff = 0
            while woff < len(b):
                if b[woff:woff+16] == b"type.ankama.com/":
                    space_or_tag = woff + 16
                    while space_or_tag < min(len(b), woff + 30) and 0x61 <= b[space_or_tag] <= 0x7A:
                        space_or_tag += 1
                    woff = space_or_tag
                    if woff < len(b) and b[woff] == 0x12:
                        woff += 1
                        _, r = decode_varint(b, woff)
                        woff += r
                    continue

                tag, r = decode_varint(b, woff)
                if r == 0:
                    woff += 1
                    continue
                woff += r
                wt = tag & 7
                if wt == 2:
                    l, r2 = decode_varint(b, woff)
                    if r2 == 0:
                        woff += 1
                        continue
                    woff += r2
                    if woff + l <= len(b):
                        sub = b[woff:woff + l]
                        woff += l
                    else:
                        sub = b[woff:]
                        woff = len(b)
                    sale = parse_single_sale_submessage(sub)
                    if sale:
                        sk = (sale.get("rawDate") or sale.get("date"), sale.get("itemId"), sale.get("price"), sale.get("quantity"))
                        if sk not in seen_keys:
                            seen_keys.add(sk)
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
                    woff += 1
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
        tok_end = pos + len(target_bytes)
        off_12 = buf.find(bytes([0x12]), tok_end, min(len(buf), tok_end + 16))
        if off_12 != -1:
            off = off_12 + 1
            length, r2 = decode_varint(buf, off)
            off += r2
            msg_bytes = buf[off:off + length] if off + length <= len(buf) else buf[off:]
        else:
            msg_bytes = buf[tok_end:]

        moff = 0
        while moff < len(msg_bytes):
            mtag, mr = decode_varint(msg_bytes, moff)
            if mr == 0:
                moff += 1
                continue
            moff += mr
            mfn = mtag >> 3
            mwt = mtag & 7
            if mwt == 2:
                ml, mr2 = decode_varint(msg_bytes, moff)
                if mr2 == 0:
                    moff += 1
                    continue
                moff += mr2
                if moff + ml <= len(msg_bytes):
                    entry_bytes = msg_bytes[moff:moff + ml]
                    moff += ml
                else:
                    entry_bytes = msg_bytes[moff:]
                    moff = len(msg_bytes)
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
                moff += 1

    if listings:
        return listings

    # Escaneo recursivo de respaldo
    def walk(b, depth=0):
        if depth > 4 or len(b) < 6:
            return
        off = 0
        while off < len(b):
            if b[off:off+16] == b"type.ankama.com/":
                space_or_tag = off + 16
                while space_or_tag < min(len(b), off + 30) and 0x61 <= b[space_or_tag] <= 0x7A:
                    space_or_tag += 1
                off = space_or_tag
                if off < len(b) and b[off] == 0x12:
                    off += 1
                    _, r = decode_varint(b, off)
                    off += r
                continue

            tag, r = decode_varint(b, off)
            if r == 0:
                off += 1
                continue
            off += r
            fn = tag >> 3
            wt = tag & 7
            if wt == 2:
                length, r2 = decode_varint(b, off)
                if r2 == 0:
                    off += 1
                    continue
                off += r2
                if off + length <= len(b):
                    sub = b[off:off + length]
                    off += length
                else:
                    sub = b[off:]
                    off = len(b)
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
                off += 1

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
    inv_token = km.get("inventory", "isb")
    storage_token = km.get("storage", "hlp")
    target_bytes_market = f"type.ankama.com/{market_token}".encode("ascii")
    target_bytes_sales = f"type.ankama.com/{sales_token}".encode("ascii")
    target_bytes_active = f"type.ankama.com/{active_token}".encode("ascii")
    target_bytes_inv = f"type.ankama.com/{inv_token}".encode("ascii")
    target_bytes_storage = f"type.ankama.com/{storage_token}".encode("ascii")
    server_slug = os.environ.get("DOFUS_SERVER", "draconiros").strip().lower()

    print("\n" + "=" * 70)
    print("  [SNIFFER SESION COMPLETA] CAPTURA UNIFICADA EN TIEMPO REAL")
    print("=" * 70)
    print("  Tokens Activos en Paralelo:")
    print(f"    * Mercadillo (price_list)    : '{market_token}' -> Envio directo a DBHDV")
    print(f"    * Cotizaciones (sales_volume): 'iuk' / 'ive' -> Envio directo a DBHDV y cotizaciones_capturadas.json")
    print(f"    * Almacen (inventory/storage): '{inv_token}' / '{storage_token}' -> banco_inventario_capturado.json")
    print(f"    * Historial (sales_history)  : '{sales_token}' -> historial_ventas_capturado.json")
    print(f"    * En Venta (active_listings) : '{active_token}' -> listings_en_venta_capturado.json")
    print("-" * 70)
    print("  Instrucciones para captura en vivo en Dofus Unity 3.6:")
    print("  1. Mercadillo  : En pestana 'COMPRAR', escribe y busca objetos en el buscador")
    print("                   (o cierra y vuelve a abrir el mercadillo para forzar la red).")
    print("  2. Cotizaciones: Haz clic en el icono de grafico de cotizacion de un objeto.")
    print("  3. Banco       : Ve al edificio del Banco y habla con el Banquero ('Consultar tu banco').")
    print("  4. Historial   : En el mercadillo, abre la pestana 'HISTORIAL' de ventas.")
    print("  5. En Venta    : En el mercadillo, abre la pestana 'VENTA' para capturar tus lotes activos.")
    print("  6. Presiona CTRL+C cuando desees finalizar la sesion.")
    print("-" * 70)

    load_items_dictionary()
    load_item_categories()

    init_session_log("SESION_COMPLETA")
    log_sniffer_event("SESION_INICIADA", f"Servidor={server_slug} | Tokens: market='{market_token}', inv='{inv_token}', storage='{storage_token}', sales='{sales_token}', active='{active_token}'")

    bank_lock = threading.Lock()
    sales_lock = threading.Lock()
    listings_lock = threading.Lock()

    accumulated_bank = {}
    bank_burst_stream = bytearray()
    bank_expected_len = 0
    bank_burst_active = False
    bank_dirty = False
    last_bank_pkt = 0.0

    unique_sales_dict = {}
    sales_burst_active = False
    sales_burst_stream = bytearray()
    sales_expected_len = 0
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
    listings_expected_len = 0
    listings_burst_active = False
    last_listings_pkt = 0.0

    session_market_updates = 0
    session_quotations_count = 0
    session_bank_saved_slots = 0
    session_sales_saved_count = 0
    session_listings_saved_lots = 0

    market_queue = queue.Queue()
    market_sent_count = 0

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

    def save_bank_snapshot(items_snapshot):
        if not items_snapshot:
            return False
        try:
            total_slots = len(items_snapshot)
            total_units = sum(q for _, q, _ in items_snapshot)
            items_list = [
                {"uid": str(uid), "itemId": gid, "name": get_item_name(gid), "quantity": qty}
                for gid, qty, uid in items_snapshot
            ]
            saved_bank_data = {
                "metadata": {
                    "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "totalSlots": total_slots,
                    "totalUnits": total_units,
                    "uniqueTypes": len(set(gid for gid, _, _ in items_snapshot)),
                },
                "items": items_list
            }
            with open(INVENTORY_OUTPUT, "w", encoding="utf-8") as f:
                json.dump(saved_bank_data, f, indent=2, ensure_ascii=False)
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"\n  [{now_str}] 📦 [Guardado Almacén/Inventario] {total_slots:,} slots ({total_units:,} unidades) -> data/banco_inventario_capturado.json")
            log_sniffer_event("ALMACEN_GUARDADO", f"{total_slots} slots ({total_units:,} unidades) guardados en {INVENTORY_OUTPUT}")
            nonlocal session_bank_saved_slots
            session_bank_saved_slots = total_slots
            return True
        except Exception as e:
            print(f"\n  [Error guardando banco]: {e}")
            log_sniffer_event("ERROR_BANCO", f"Fallo al guardar banco: {e}")
            return False

    def save_sales_snapshot(sales_list):
        if not sales_list:
            return False
        try:
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
            with open(SALES_OUTPUT, "w", encoding="utf-8") as f:
                json.dump(saved_sales_data, f, indent=2, ensure_ascii=False)
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"\n  [{now_str}] 📜 [Guardado Historial] {len(sales_list):,} ventas registradas -> data/historial_ventas_capturado.json")
            log_sniffer_event("HISTORIAL_GUARDADO", f"{len(sales_list):,} ventas guardadas en {SALES_OUTPUT}")
            nonlocal session_sales_saved_count
            session_sales_saved_count = len(sales_list)
            return True
        except Exception as e:
            print(f"\n  [Error guardando historial]: {e}")
            log_sniffer_event("ERROR_HISTORIAL", f"Fallo al guardar historial: {e}")
            return False

    def save_listings_snapshot(new_listings):
        if not new_listings:
            return False
        try:
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

            with listings_lock:
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
            with open(ACTIVE_LISTINGS_OUTPUT, "w", encoding="utf-8") as f:
                json.dump(saved_listings_data, f, indent=2, ensure_ascii=False)
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"\n  [{now_str}] 🏷️ [Guardado En Venta] {len(all_listings)} lotes activos ({market_key}) -> data/listings_en_venta_capturado.json")
            log_sniffer_event("LISTINGS_GUARDADO", f"{len(all_listings)} lotes activos ({market_key}) guardados en {ACTIVE_LISTINGS_OUTPUT}")
            nonlocal session_listings_saved_lots
            session_listings_saved_lots = len(all_listings)
            return True
        except Exception as e:
            print(f"\n  [Error guardando listings]: {e}")
            log_sniffer_event("ERROR_LISTINGS", f"Fallo al guardar listings: {e}")
            return False

    def flush_bank():
        nonlocal bank_burst_active, bank_expected_len, bank_dirty
        items_to_save = []
        with bank_lock:
            if not bank_burst_active and not bank_burst_stream and not bank_dirty:
                return
            bank_burst_active = False
            bank_expected_len = 0
            if bank_burst_stream:
                stream_items = extract_items_recursive(bytes(bank_burst_stream))
                if stream_items:
                    for gid, qty, uid in stream_items:
                        k = uid if uid > 0 else (gid, len(accumulated_bank))
                        accumulated_bank[k] = (gid, qty, uid)
                    bank_dirty = True
                bank_burst_stream.clear()
            if bank_dirty and accumulated_bank:
                items_to_save = list(accumulated_bank.values())
                bank_dirty = False
        if items_to_save:
            save_bank_snapshot(items_to_save)

    def flush_sales():
        nonlocal sales_burst_active, sales_expected_len
        raw_b = None
        with sales_lock:
            if not sales_burst_active and not sales_burst_stream:
                return
            sales_burst_active = False
            sales_expected_len = 0
            if sales_burst_stream:
                raw_b = bytes(sales_burst_stream)
                sales_burst_stream.clear()
        if raw_b and len(raw_b) >= 20:
            entries = extract_sales_entries(raw_b)
            if entries:
                with sales_lock:
                    for s in entries:
                        k = (s.get("rawDate") or s.get("date"), s.get("itemId"), s.get("price"), s.get("quantity"))
                        if k not in unique_sales_dict:
                            unique_sales_dict[k] = s
                    sales_list = list(unique_sales_dict.values())
                save_sales_snapshot(sales_list)
            else:
                log_sniffer_event("HISTORIAL_INSPECCION", f"Ráfaga de {len(raw_b)}b no generó ventas parseadas", payload=raw_b[:64])

    def flush_listings():
        nonlocal listings_burst_active, listings_expected_len
        raw_b = None
        with listings_lock:
            if not listings_burst_active and not listings_burst_stream:
                return
            listings_burst_active = False
            listings_expected_len = 0
            if listings_burst_stream:
                raw_b = bytes(listings_burst_stream)
                listings_burst_stream.clear()
        if raw_b and len(raw_b) >= 20:
            new_listings = extract_active_listings(raw_b)
            if new_listings:
                save_listings_snapshot(new_listings)
            else:
                log_sniffer_event("LISTINGS_INSPECCION", f"Ráfaga de {len(raw_b)}b no generó listings parseados", payload=raw_b[:64])

    def flush_all_pending():
        flush_bank()
        flush_sales()
        flush_listings()

    seen_tokens_session = set()

    def on_packet(packet):
        nonlocal bank_burst_active, bank_expected_len, last_bank_pkt
        nonlocal sales_burst_active, sales_expected_len, last_sales_pkt
        nonlocal listings_burst_active, listings_expected_len, last_listings_pkt
        nonlocal session_market_updates, session_quotations_count

        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 8:
            return

        now = time.time()

        # Telemetría de tokens vistos en la sesión
        raw_tokens = extract_type_tokens(payload)
        for tok, _ in raw_tokens:
            if tok not in seen_tokens_session:
                seen_tokens_session.add(tok)
                log_sniffer_event("TOKEN_TRAFICO", f"TypeURL en tráfico: 'type.ankama.com/{tok}' (longitud paquete: {len(payload)}b)")

        has_type_url = b"type.ankama.com/" in payload
        is_listings_hdr = (target_bytes_active in payload or b"type.ankama.com/ket" in payload)
        is_sales_hdr = (target_bytes_sales in payload or b"type.ankama.com/kyo" in payload)
        is_market_hdr = (target_bytes_market in payload or b"type.ankama.com/jzn" in payload)
        is_quotation_hdr = (b"type.ankama.com/iuk" in payload or b"type.ankama.com/ive" in payload)
        is_storage_hdr = (not (is_listings_hdr or is_sales_hdr or is_market_hdr or is_quotation_hdr)) and (
            target_bytes_inv in payload or target_bytes_storage in payload or
            b"type.ankama.com/isb" in payload or b"type.ankama.com/hlp" in payload
        )

        # 1. Mercadillo (estricto por TypeURL y submensaje 0x12)
        if len(payload) >= 15:
            item_id, ladders, offer_prices = parse_market_message(payload, market_token)
            if item_id > 0 and (ladders or offer_prices):
                item_name = get_item_name(item_id)
                now_str = datetime.datetime.now().strftime("%H:%M:%S")

                payload_dict = {
                    "item_id": item_id,
                    "server": server_slug,
                }
                if ladders:
                    ladder_vals = ladders[0][1][:4]
                    lad_dict = {}
                    for i, p in enumerate(ladder_vals):
                        if p > 0:
                            lad_dict[str(10**i)] = p
                    payload_dict["ladders"] = lad_dict
                    lad_str = " | ".join(f"x{k}: {v:,} K" for k, v in lad_dict.items())
                    print(f"  [{now_str}] [Mercadillo] {item_name} (#{item_id}) -> {lad_str}")
                    log_sniffer_event("MERCADILLO", f"{item_name} (#{item_id}) -> {lad_str}", payload=payload)
                elif offer_prices:
                    payload_dict["prices"] = sorted(offer_prices)[:5]
                    top_3 = sorted(offer_prices)[:3]
                    lad_str = ", ".join(f"{p:,} K" for p in top_3)
                    print(f"  [{now_str}] [Mercadillo Equipos] {item_name} (#{item_id}) -> Minimos: {lad_str}")
                    log_sniffer_event("MERCADILLO_EQUIPO", f"{item_name} (#{item_id}) -> Minimos: {lad_str}", payload=payload)

                market_queue.put(payload_dict)
                session_market_updates += 1

        # 2. Listings Activos en Venta (ket)
        completed_listings = False
        if is_listings_hdr:
            with listings_lock:
                idx = payload.find(target_bytes_active)
                if idx == -1:
                    idx = payload.find(b"type.ankama.com/ket")
                tok_len = len(target_bytes_active) if (idx != -1 and payload[idx:idx+len(target_bytes_active)] == target_bytes_active) else len(b"type.ankama.com/ket")
                tok_end = idx + tok_len
                off_12 = payload.find(bytes([0x12]), tok_end, min(len(payload), tok_end + 16))
                if off_12 != -1:
                    off = off_12 + 1
                    msg_len, r2 = decode_varint(payload, off)
                    off += r2
                    listings_expected_len = (off - idx) + msg_len
                else:
                    listings_expected_len = 0

                listings_burst_stream.clear()
                listings_burst_stream.extend(payload[idx:] if idx != -1 else payload)
                listings_burst_active = True
                last_listings_pkt = now
                if listings_expected_len > 0 and len(listings_burst_stream) >= listings_expected_len:
                    completed_listings = True
            log_sniffer_event("LISTINGS_DETECTADO", f"Inicio de captura ({len(payload)}b, esperado={listings_expected_len}b)", payload=payload)
            if completed_listings:
                flush_listings()
        elif listings_burst_active and not has_type_url:
            with listings_lock:
                if listings_expected_len > 0:
                    needed = listings_expected_len - len(listings_burst_stream)
                    listings_burst_stream.extend(payload[:needed])
                    if len(listings_burst_stream) >= listings_expected_len:
                        completed_listings = True
                else:
                    listings_burst_stream.extend(payload)
                last_listings_pkt = now
            if completed_listings:
                flush_listings()

        # 3. Historial de Ventas (kyo)
        completed_sales = False
        if is_sales_hdr:
            with sales_lock:
                idx = payload.find(target_bytes_sales)
                if idx == -1:
                    idx = payload.find(b"type.ankama.com/kyo")
                tok_len = len(target_bytes_sales) if (idx != -1 and payload[idx:idx+len(target_bytes_sales)] == target_bytes_sales) else len(b"type.ankama.com/kyo")
                tok_end = idx + tok_len
                off_12 = payload.find(bytes([0x12]), tok_end, min(len(payload), tok_end + 16))
                if off_12 != -1:
                    off = off_12 + 1
                    msg_len, r2 = decode_varint(payload, off)
                    off += r2
                    sales_expected_len = (off - idx) + msg_len
                else:
                    sales_expected_len = 0

                sales_burst_stream.clear()
                sales_burst_stream.extend(payload[idx:] if idx != -1 else payload)
                sales_burst_active = True
                last_sales_pkt = now
                if sales_expected_len > 0 and len(sales_burst_stream) >= sales_expected_len:
                    completed_sales = True
            log_sniffer_event("HISTORIAL_DETECTADO", f"Inicio de captura ({len(payload)}b, esperado={sales_expected_len}b)", payload=payload)
            if completed_sales:
                flush_sales()
        elif sales_burst_active and not has_type_url:
            with sales_lock:
                if sales_expected_len > 0:
                    needed = sales_expected_len - len(sales_burst_stream)
                    sales_burst_stream.extend(payload[:needed])
                    if len(sales_burst_stream) >= sales_expected_len:
                        completed_sales = True
                else:
                    sales_burst_stream.extend(payload)
                last_sales_pkt = now
            if completed_sales:
                flush_sales()

        # 4. Almacén / Banco / Inventario (isb / hlp)
        completed_bank = False
        if is_storage_hdr:
            with bank_lock:
                if not bank_burst_active or (now - last_bank_pkt > 2.0):
                    bank_burst_stream.clear()
                    bank_burst_active = True
                    bank_expected_len = 0

                idx = -1
                cand_hdr = None
                for cand in (target_bytes_inv, target_bytes_storage, b"type.ankama.com/isb", b"type.ankama.com/hlp"):
                    if cand in payload:
                        c_idx = payload.find(cand)
                        if idx == -1 or c_idx < idx:
                            idx = c_idx
                            cand_hdr = cand

                if idx != -1 and cand_hdr:
                    tok_end = idx + len(cand_hdr)
                    off_12 = payload.find(bytes([0x12]), tok_end, min(len(payload), tok_end + 16))
                    if off_12 != -1:
                        off = off_12 + 1
                        msg_len, r2 = decode_varint(payload, off)
                        off += r2
                        bank_expected_len = max(bank_expected_len, (off - idx) + msg_len)

                bank_burst_stream.extend(payload[idx:] if idx != -1 else payload)
                last_bank_pkt = now
                if bank_expected_len > 0 and len(bank_burst_stream) >= bank_expected_len:
                    completed_bank = True
            d_items = extract_items_recursive(payload)
            if d_items:
                with bank_lock:
                    for gid, qty, uid in d_items:
                        k = uid if uid > 0 else (gid, len(accumulated_bank))
                        accumulated_bank[k] = (gid, qty, uid)
                    bank_dirty = True
            log_sniffer_event("ALMACEN_DETECTADO", f"Captura ({len(payload)}b, exp={bank_expected_len}b, acum={len(bank_burst_stream)}b, slots={len(accumulated_bank)})", payload=payload)
            if completed_bank:
                flush_bank()
        elif bank_burst_active and not has_type_url:
            with bank_lock:
                bank_burst_stream.extend(payload)
                last_bank_pkt = now
                if bank_expected_len > 0 and len(bank_burst_stream) >= bank_expected_len:
                    completed_bank = True
            d_items = extract_items_recursive(payload)
            if d_items:
                with bank_lock:
                    for gid, qty, uid in d_items:
                        k = uid if uid > 0 else (gid, len(accumulated_bank))
                        accumulated_bank[k] = (gid, qty, uid)
                    bank_dirty = True
            if completed_bank:
                flush_bank()

        # 5. Cotizaciones de Mercado (type.ankama.com/iuk o ive)
        has_quotation = (b"type.ankama.com/iuk" in payload or b"type.ankama.com/ive" in payload)
        conn_key = (packet[IP].src, packet[TCP].sport, packet[IP].dst, packet[TCP].dport) if packet.haslayer(IP) else packet[TCP].sport

        with QUOTATION_LOCK:
            in_quote_buf = conn_key in QUOTATION_BUFFERS

        if in_quote_buf or has_quotation:
            quote_complete_payload = None
            with QUOTATION_LOCK:
                existing = QUOTATION_BUFFERS.get(conn_key)
                if existing and (now - existing.get("ts", 0)) > 4.0:
                    existing = None

                if existing:
                    buf = existing["buf"] + payload
                else:
                    target_hdr = b"type.ankama.com/iuk" if b"type.ankama.com/iuk" in payload else b"type.ankama.com/ive"
                    idx = payload.find(target_hdr)
                    buf = payload[idx:] if idx != -1 else b""

                target_hdr = b"type.ankama.com/iuk" if b"type.ankama.com/iuk" in buf else (b"type.ankama.com/ive" if b"type.ankama.com/ive" in buf else None)
                if buf and target_hdr:
                    idx = buf.find(target_hdr)
                    tok_end = idx + len(target_hdr)
                    off_12 = buf.find(bytes([0x12]), tok_end, min(len(buf), tok_end + 16))
                    off = (off_12 + 1) if off_12 != -1 else (tok_end + 1)
                    if len(buf) > off:
                        len2, r2_len = decode_varint(buf, off)
                        if r2_len > 0:
                            off += r2_len
                            total_needed = off + len2
                            if len(buf) >= total_needed:
                                quote_complete_payload = buf[idx:total_needed]
                                QUOTATION_BUFFERS.pop(conn_key, None)
                            else:
                                if len(buf) < 500000:
                                    QUOTATION_BUFFERS[conn_key] = {"buf": buf, "ts": now}
                                else:
                                    QUOTATION_BUFFERS.pop(conn_key, None)
                        else:
                            quote_complete_payload = buf[idx:]
                            QUOTATION_BUFFERS.pop(conn_key, None)
                    else:
                        QUOTATION_BUFFERS[conn_key] = {"buf": buf, "ts": now}
                else:
                    QUOTATION_BUFFERS.pop(conn_key, None)

            if quote_complete_payload:
                q_id, s_data, _, _ = parse_quotation_message(quote_complete_payload)
                target_id = q_id or LAST_MARKET_ITEM_ID
                if target_id > 0 and s_data:
                    ITEM_SALES_VOLUME[target_id] = s_data
                    target_name = get_item_name(target_id)
                    now_str = datetime.datetime.now().strftime("%H:%M:%S")

                    s24 = s_data.get("sales24h", 0)
                    p24 = s_data.get("price24h", 0)
                    m24 = s_data.get("median24h", 0)
                    s7 = s_data.get("sales7d", 0)
                    p7 = s_data.get("price7d", 0)
                    m7 = s_data.get("median7d", 0)
                    s30 = s_data.get("sales30d", 0)
                    p30 = s_data.get("price30d", 0)
                    m30 = s_data.get("median30d", 0)
                    sug_p = s_data.get("suggestedPrice", 0)
                    avg_d = s_data.get("avgDailySales", 0.0)

                    print(f"\n  [{now_str}] 📈 [Cotización de Mercado] {target_name} (#{target_id})")
                    print(f"       • 24 Horas : {s24:,} ventas | Medio: {p24:,} K | Mediana: {m24:,} K")
                    print(f"       • 7 Días   : {s7:,} ventas | Medio: {p7:,} K | Mediana: {m7:,} K")
                    print(f"       • 30 Días  : {s30:,} ventas | Medio: {p30:,} K | Mediana: {m30:,} K")
                    print(f"       • Sugerido : {sug_p:,} K | Ritmo: {avg_d:.1f} u/día\n")

                    summary_log = f"{target_name} (#{target_id}) -> 24h:{s24}v/{p24}K | 7d:{s7}v/{p7}K | 30d:{s30}v/{p30}K | Sug:{sug_p}K"
                    log_sniffer_event("COTIZACION", summary_log, payload=quote_complete_payload)

                    market_queue.put({
                        "server": server_slug,
                        "salesVolume": {
                            str(target_id): s_data
                        }
                    })

                    save_captured_quotation(target_id, target_name, s_data)
                    session_quotations_count += 1

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("\n[Sesion Iniciada] Escuchando trafico en puerto 5555...")
    print("Realiza tus acciones en Dofus Unity (presiona CTRL+C para guardar y finalizar).\n")

    try:
        while True:
            time.sleep(0.1)
            now = time.time()

            if bank_burst_active and (now - last_bank_pkt >= 1.5):
                flush_bank()

            if sales_burst_active and (now - last_sales_pkt >= 1.2):
                flush_sales()

            if listings_burst_active and (now - last_listings_pkt >= 1.2):
                flush_listings()

    except KeyboardInterrupt:
        print("\n\n" + "=" * 70)
        print("  RESUMEN DE SESION COMPLETA FINALIZADA")
        print("=" * 70)
        flush_all_pending()
        with bank_lock:
            bank_count = len(accumulated_bank)
        with sales_lock:
            sales_count = len(unique_sales_dict)
        with listings_lock:
            tot_lots = sum(len(v) for v in mercadillos.values())

        # Mercadillo y Cotizaciones
        print(f"  * Mercadillo   : {session_market_updates} actualizaciones capturadas en vivo ({market_sent_count} enviadas a DBHDV)")
        print(f"  * Cotizaciones : {session_quotations_count} cotizaciones capturadas en vivo")

        # Banco / Inventario
        if session_bank_saved_slots > 0:
            print(f"  * Almacén/Banco: {session_bank_saved_slots:,} slots capturados y guardados en esta sesión")
        else:
            print(f"  * Almacén/Banco: No se abrió el banco en esta sesión ({bank_count:,} slots previos en disco)")

        # Historial
        if session_sales_saved_count > 0:
            print(f"  * Historial    : {session_sales_saved_count:,} ventas capturadas y guardadas en esta sesión")
        else:
            print(f"  * Historial    : No se abrió la pestaña 'HISTORIAL' en esta sesión ({sales_count:,} previas en disco)")

        # Listings
        if session_listings_saved_lots > 0:
            print(f"  * En Venta     : {session_listings_saved_lots:,} lotes capturados y guardados en esta sesión")
        else:
            print(f"  * En Venta     : No se abrió la pestaña 'VENTA' en esta sesión ({tot_lots:,} lotes previos en disco)")

        print("-" * 70)
        print("  Puedes importar estos archivos JSON en DBHDV > Mi Banco.")
        print("=" * 70)
        log_sniffer_event("SESION_FINALIZADA", f"Mercadillo={session_market_updates}, Cotizaciones={session_quotations_count}, Banco={session_bank_saved_slots}, Historial={session_sales_saved_count}, Listings={session_listings_saved_lots}")
    finally:
        flush_all_pending()
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

    mode_arg = None
    for i, a in enumerate(sys.argv):
        if a == "--mode" and i + 1 < len(sys.argv):
            mode_arg = sys.argv[i + 1].strip().lower()
            break
        elif a.startswith("--mode="):
            mode_arg = a.split("=", 1)[1].strip().lower()
            break

    if mode_arg:
        if mode_arg in ("s", "sesion", "bundle", "all"):
            run_sniffer_session_bundle()
            return
        elif mode_arg == "1":
            run_sniffer_market()
            return
        elif mode_arg == "2":
            run_sniffer_storage()
            return
        elif mode_arg == "3":
            run_sniffer_sales()
            return
        elif mode_arg == "4":
            run_sniffer_active_listings()
            return

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
            print("  REGISTRO DE DIAGNÓSTICO Y TELEMETRÍA")
            print("=" * 70)
            print("  [1] Ver log de calibración y eventos (logs/calibracion_diagnostico.log)")
            print("  [2] Ver log detallado de paquetes y tráfico (logs/sniffer.log)")
            print("  [Enter] Ver últimos registros combinados")
            diag_choice = input("\nSelecciona [1/2/Enter]: ").strip()

            if diag_choice == "1":
                print("\n--- REGISTRO DE CALIBRACIÓN Y DIAGNÓSTICO ---")
                if os.path.exists(DIAGNOSTIC_LOG):
                    try:
                        with open(DIAGNOSTIC_LOG, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-40:]:
                                print("  " + line.rstrip())
                    except Exception as e:
                        print(f"  Error: {e}")
                else:
                    print("  No hay registros aún.")
            elif diag_choice == "2":
                print("\n--- REGISTRO DETALLADO DE PAQUETES (SNIFFER.LOG) ---")
                if os.path.exists(SNIFFER_LOG):
                    try:
                        with open(SNIFFER_LOG, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-40:]:
                                print("  " + line.rstrip())
                    except Exception as e:
                        print(f"  Error: {e}")
                else:
                    print("  No hay registros aún.")
            else:
                print("\n--- ÚLTIMOS EVENTOS DE CAPTURA (logs/sniffer.log) ---")
                if os.path.exists(SNIFFER_LOG):
                    try:
                        with open(SNIFFER_LOG, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-25:]:
                                print("  " + line.rstrip())
                    except Exception as e:
                        print(f"  Error leyendo sniffer.log: {e}")
                else:
                    print("  (Aún no se han capturado paquetes en la sesión actual)")

                print("\n--- ÚLTIMOS EVENTOS DE CALIBRACIÓN (logs/calibracion_diagnostico.log) ---")
                if os.path.exists(DIAGNOSTIC_LOG):
                    try:
                        with open(DIAGNOSTIC_LOG, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-15:]:
                                print("  " + line.rstrip())
                    except Exception as e:
                        print(f"  Error leyendo calibracion_diagnostico.log: {e}")
                else:
                    print("  (Sin eventos de calibración)")

            input("\nPresiona Enter para continuar...")
        elif choice == "0":
            print("\nSaliendo de DBHDV Suite. ¡Buen juego!")
            break
        else:
            print("\n[Opción no válida. Ingresa un número del 0 al 12]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nSaliendo de DBHDV Suite. ¡Buen juego!")
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        print(f"\n[ERROR CRÍTICO NO CONTROLADO]: {e}", flush=True)
        print(tb_str)
        try:
            log_sniffer_event("CRASH_FATAL", f"{e}\n{tb_str}")
        except Exception:
            pass
        try:
            input("\nPresiona Enter para cerrar...")
        except Exception:
            pass
