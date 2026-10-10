# -*- coding: utf-8 -*-
"""
core/config.py
Configuración global, rutas de archivos, gestión de UAC y logging para DBHDV Suite.
"""
import os
import sys
import json
import datetime
import threading

# Configurar salida UTF-8 inmediata en Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

# Asegurar directorio de caché seguro para Scapy/Pip
if "XDG_CACHE_HOME" not in os.environ:
    _local_cache = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "cache")
    try:
        os.makedirs(_local_cache, exist_ok=True)
        os.environ["XDG_CACHE_HOME"] = _local_cache
    except Exception:
        pass

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

# Rutas y archivos base
SUITE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if "__file__" in globals() else os.getcwd()
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

SNIFFER_LOG_LOCK = threading.Lock()

MAX_LOG_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def _rotate_file_if_needed(file_path):
    try:
        if os.path.exists(file_path) and os.path.getsize(file_path) > MAX_LOG_FILE_SIZE:
            backup_path = f"{file_path}.1"
            if os.path.exists(backup_path):
                os.remove(backup_path)
            os.rename(file_path, backup_path)
    except Exception:
        pass

def log_diagnostic(msg, payload_sample=None):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}\n"
    if payload_sample:
        line += f"        Payload sample (hex): {payload_sample.hex()[:80]}...\n"
    try:
        _rotate_file_if_needed(DIAGNOSTIC_LOG)
        with open(DIAGNOSTIC_LOG, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass

def log_sniffer_event(module, msg, payload=None, extra=None):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"[{ts}] [{module.upper()}] {msg}\n"
    body = ""
    if extra:
        body += f"        Detalles: {extra}\n"
    if payload:
        raw_hex = payload.hex() if isinstance(payload, (bytes, bytearray)) else str(payload)
        preview = raw_hex[:120] + ("..." if len(raw_hex) > 120 else "")
        body += f"        Payload ({len(payload)} bytes): {preview}\n"
    entry = header + body
    with SNIFFER_LOG_LOCK:
        try:
            _rotate_file_if_needed(SNIFFER_LOG)
            with open(SNIFFER_LOG, "a", encoding="utf-8") as f:
                f.write(entry)
        except Exception:
            pass

def init_session_log(session_type="TODO-EN-UNO"):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    banner = (
        f"\n{'=' * 75}\n"
        f"  INICIO DE SESIÓN DE CAPTURA [{session_type}] - {ts}\n"
        f"{'=' * 75}\n"
    )
    with SNIFFER_LOG_LOCK:
        try:
            with open(SNIFFER_LOG, "a", encoding="utf-8") as f:
                f.write(banner)
        except Exception:
            pass

def load_keymap():
    if os.path.exists(KEYMAP_FILE):
        try:
            with open(KEYMAP_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            pass
    return {}

def save_keymap_entry(key_name, token_val):
    km = load_keymap()
    km[key_name] = token_val
    try:
        with open(KEYMAP_FILE, "w", encoding="utf-8") as f:
            json.dump(km, f, indent=4)
        return True
    except Exception:
        return False
