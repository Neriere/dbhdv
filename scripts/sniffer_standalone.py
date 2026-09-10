#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY -> MERCADILLO ULTRA-FAST LIVE SNIFFER (HIGH PERFORMANCE)
===============================================================================
  - Búfer Asíncrono Multihilo: captura de paquetes sin latencia ni cuellos de botella.
  - Base de Datos Local (items_db.json): resolución de nombres en 0.001 ms (sin llamadas a DofusDB).
  - Micro-Batching con HTTP Keep-Alive hacia tu servidor Turso/Vercel.
  
  Dependencias requeridas:
    pip install scapy requests

  Ejecutar como Administrador:
    python dofus_sniffer.py
===============================================================================
"""

import os
import sys
import re
import time
import json
import queue
import argparse
import threading
import traceback
import subprocess
import urllib.request
from datetime import datetime

# UTF-8 y Line-Buffering en Windows + Desactivar QuickEdit Mode para evitar pausas al hacer clic en la consola
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

LOG_FILE = "sniffer.log"
INSPECTION_FILE = "cotizaciones_inspeccion.txt"

class SessionPacketLogger:
    def __init__(self, log_path=LOG_FILE, server_name=None, current_token=None):
        self.log_path = log_path
        self.lock = threading.Lock()
        self.packet_count = 0
        self.max_size_bytes = 3 * 1024 * 1024
        srv = server_name or globals().get("SERVER_NAME", "Desconocido")
        tok = current_token or globals().get("CURRENT_TOKEN", "jzn")
        header_lines = [
            "=" * 80,
            "  DOFUS UNITY SNIFFER -> REGISTRO DE PAQUETES (SESION ACTIVA)",
            f"  Inicio de sesion : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"  Servidor destino : {srv}",
            f"  Token calibrado  : '{tok}'",
            "  (Este log se reinicia al abrir el sniffer y registra los paquetes inspeccionados)",
            "=" * 80,
            "",
            "",
        ]
        try:
            with open(self.log_path, "w", encoding="utf-8") as f:
                f.write("\n".join(header_lines))
        except Exception:
            pass

    def log_packet(self, item_id, item_name, is_equip, raw_ladders, offer_prices, resolved_prices, hex_summary, api_result=""):
        with self.lock:
            self.packet_count += 1
            now = datetime.now().strftime("%H:%M:%S")
            cat_label = "EQUIPABLE" if is_equip else "RECURSO"
            lines = [
                "=" * 80,
                f"[{now}] PAQUETE #{self.packet_count} | [{cat_label}] {item_name} (#{item_id})",
                f"  Payload Hex (64b)              : {hex_summary}",
                f"  Ladders brutos decodificados   : {raw_ladders}",
            ]

            if is_equip:
                raw_offers = [int(p) for p in (resolved_prices if isinstance(resolved_prices, list) else (offer_prices if offer_prices else [])) if isinstance(p, (int, float)) and p >= 50]
                sorted_offers = sorted(raw_offers)
                count = len(sorted_offers)
                lines.append(f"  Total ofertas capturadas       : {count} oferta(s)")
                lines.append(f"  LISTA COMPLETA DE PRECIOS      : {sorted_offers}")
                if count > 0:
                    min_p = sorted_offers[0]
                    max_p = sorted_offers[-1]
                    med_p = sorted_offers[count // 2]
                    avg_p = round(sum(sorted_offers) / count)
                    lines.append(f"  Estadísticas de mercado        : Mín: {min_p:,} k | Mediana: {med_p:,} k | Media: {avg_p:,} k | Máx: {max_p:,} k")
            else:
                if isinstance(resolved_prices, dict):
                    p1 = resolved_prices.get("1", 0)
                    p10 = resolved_prices.get("10", 0)
                    p100 = resolved_prices.get("100", 0)
                    p1000 = resolved_prices.get("1000", 0)
                    lines.append(f"  Lotes asignados                : x1: {p1:,} k | x10: {p10:,} k | x100: {p100:,} k | x1000: {p1000:,} k")
                    u_parts = []
                    if p1 > 0: u_parts.append(f"x1: {p1:,} k/u")
                    if p10 > 0: u_parts.append(f"x10: {round(p10/10):,} k/u")
                    if p100 > 0: u_parts.append(f"x100: {round(p100/100):,} k/u")
                    if p1000 > 0: u_parts.append(f"x1000: {round(p1000/1000):,} k/u")
                    if u_parts:
                        lines.append(f"  Precios unitarios por lote     : {' | '.join(u_parts)}")

            lines.append(f"  Precios enviados a API / BD    : {resolved_prices}")
            if api_result:
                lines.append(f"  Respuesta API / DB             : {api_result}")
            lines.append("=" * 80)
            lines.append("")

            try:
                # Evitar expansión infinita: si supera 3MB, reiniciar conservando aviso
                if os.path.exists(self.log_path) and os.path.getsize(self.log_path) > self.max_size_bytes:
                    with open(self.log_path, "w", encoding="utf-8") as f:
                        f.write(f"=== LOG ROTADO (Sesion activa continua - {now}) ===\n\n")

                with open(self.log_path, "a", encoding="utf-8") as f:
                    f.write("\n".join(lines) + "\n")
            except Exception:
                pass


class SalesInspectionLogger:
    def __init__(self, log_path=INSPECTION_FILE):
        self.log_path = log_path
        self.lock = threading.Lock()
        self.packet_count = 0
        header_lines = [
            "=" * 90,
            "  DOFUS UNITY -> REGISTRO ESPECIAL DE INSPECCION DE COTIZACIONES Y HISTORIAL DE VENTAS",
            f"  Inicio de sesion : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"  Archivo destino  : {self.log_path}",
            "  (Usa este log para encontrar los numeros exactos de 24h, 7d y 30d de ventas)",
            "=" * 90,
            "",
            "",
        ]
        try:
            with open(self.log_path, "w", encoding="utf-8") as f:
                f.write("\n".join(header_lines))
        except Exception:
            pass

    def inspect_packet(self, payload, item_id=0, item_name=""):
        with self.lock:
            self.packet_count += 1
            now = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            all_numbers = []
            tree_lines = []

            def walk_tree(b, depth=0):
                off = 0
                while off < len(b):
                    tag, r = decode_varint(b, off)
                    if r == 0:
                        break
                    off += r
                    fnum = tag >> 3
                    wtype = tag & 7
                    indent = "  " * depth

                    if wtype == 0:
                        v, r2 = decode_varint(b, off)
                        off += r2
                        all_numbers.append(v)
                        tree_lines.append(f"{indent}  • [Depth {depth}] Campo #{fnum} (Varint) = {v:,} (0x{v:X})")
                    elif wtype == 2:
                        length, r2 = decode_varint(b, off)
                        off += r2
                        if off + length > len(b):
                            break
                        data = b[off:off + length]
                        off += length
                        if is_valid_submessage(data):
                            tree_lines.append(f"{indent}  ▸ [Depth {depth}] Campo #{fnum} (Submensaje {length} bytes):")
                            if depth < 4:
                                walk_tree(data, depth + 1)
                        else:
                            p_ints = decode_packed_varints(data)
                            if p_ints and all(x >= 0 for x in p_ints):
                                for x in p_ints:
                                    all_numbers.append(x)
                                tree_lines.append(f"{indent}  • [Depth {depth}] Campo #{fnum} (Packed Varints, {len(p_ints)} valores) = {p_ints}")
                            else:
                                try:
                                    txt = data.decode("utf-8")
                                    tree_lines.append(f"{indent}  • [Depth {depth}] Campo #{fnum} (Texto) = '{txt}'")
                                except Exception:
                                    tree_lines.append(f"{indent}  • [Depth {depth}] Campo #{fnum} (Bytes {length}b) = {data.hex()[:40]}...")
                    elif wtype == 1:
                        off += 8
                    elif wtype == 5:
                        off += 4
                    else:
                        break

            try:
                walk_tree(payload)
            except Exception:
                pass

            unique_candidates = sorted(list(set([v for v in all_numbers if v > 0])))
            hex_lines = []
            for i in range(0, min(len(payload), 512), 16):
                chunk = payload[i:i+16]
                hex_part = " ".join(f"{b:02X}" for b in chunk)
                ascii_part = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
                hex_lines.append(f"    {i:04X}: {hex_part:<48}  |{ascii_part}|")

            name_disp = f"{item_name} (#{item_id})" if item_id else "Desconocido / Sin resolver"
            lines = [
                "=" * 90,
                f"[{now}] PAQUETE INSPECCIONADO #{self.packet_count} | Longitud: {len(payload)} bytes | Objeto detectado: {name_disp}",
                "-" * 90,
                "NUMEROS / VARINTS DETECTADOS EN ESTE PAQUETE (Busca aqui tus numeros de ventas 24h, 7d, 30d):",
                f"  {unique_candidates}",
                "-" * 90,
                "ESTRUCTURA PROTOBUF:",
            ]
            if tree_lines:
                lines.extend(tree_lines)
            else:
                lines.append("  (No se decodifico estructura de campos estandar)")
            lines.append("-" * 90)
            lines.append("VOLCADO HEXADECIMAL:")
            lines.extend(hex_lines)
            lines.append("=" * 90)
            lines.append("")

            try:
                with open(self.log_path, "a", encoding="utf-8") as f:
                    f.write("\n".join(lines) + "\n")
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
    if sys.platform == "win32" and not is_admin():
        print("[UAC] Solicitando permisos de Administrador...")
        try:
            import ctypes
            script_path = os.path.abspath(sys.argv[0])
            params = f'"{script_path}" ' + " ".join([f'"{a}"' for a in sys.argv[1:]])
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
            if int(ret) > 32:
                sys.exit(0)
            else:
                print("[Aviso] Permisos de Administrador no concedidos.")
        except Exception as e:
            print(f"[Error UAC]: {e}")

check_and_elevate_admin()

def ensure_dependencies():
    packages = []
    try:
        import requests
    except ImportError:
        packages.append("requests")
    try:
        import scapy
    except ImportError:
        packages.append("scapy")

    if packages:
        print(f"[Instalador] Instalando dependencias: {', '.join(packages)}")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", *packages])
        except Exception as e:
            print(f"[Error] No se pudieron instalar dependencias: {e}")
            input("\nPresiona Enter para salir...")
            sys.exit(1)

ensure_dependencies()

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
try:
    from scapy.all import sniff, TCP, Raw
except Exception as e:
    print("\n" + "=" * 70)
    print(" [CONTROLADOR DE RED NPCAP REQUERIDO EN WINDOWS]")
    print(f" Detalle: {e}")
    print("=" * 70)
    print(" Para capturar paquetes de red en Windows:")
    print(" 1. Descarga el instalador gratuito de Npcap:")
    print("    https://npcap.com/#download")
    print(" 2. Durante la instalacion MARCA la casilla:")
    print("    'Install Npcap in WinPcap API-compatible Mode'")
    print("=" * 70)
    input("\nPresiona Enter para salir...")
    sys.exit(1)

# Argumentos de línea de comandos para permitir cambiar el servidor y el token dinámicamente
parser = argparse.ArgumentParser(description="Dofus Unity Market Sniffer")
parser.add_argument("--server", type=str, default="Tal Kasha", help="Nombre del servidor Dofus")
parser.add_argument("--token", type=str, default=None, help="Token calibrado a usar (por defecto jzn o desde keymap.json)")
cli_args, _ = parser.parse_known_args()

# ==================== CONFIGURACIÓN ====================
API_BATCH_URL = "https://dbhdv.vercel.app/api/market/batch-update"
API_UPDATE_URL = "https://dbhdv.vercel.app/api/market/update"
API_DICT_URL = "https://dbhdv.vercel.app/api/market/items-dictionary"
API_SECRET_KEY = ""
SERVER_NAME = (cli_args.server or "Tal Kasha").strip()
DOFUS_PORTS = "tcp port 5555"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
LOCAL_DB_FILE = os.path.join(SCRIPT_DIR, "items_db.json")
KEYMAP_FILE = os.path.join(SCRIPT_DIR, "keymap.json")

def load_calibrated_token():
    if cli_args.token:
        return cli_args.token.strip().lower()
    if os.path.exists(KEYMAP_FILE):
        try:
            with open(KEYMAP_FILE, "r", encoding="utf-8") as f:
                km = json.load(f)
                tok = km.get("current_token") or km.get("price_list")
                if tok and isinstance(tok, str) and tok.strip():
                    return tok.strip().lower()
        except Exception:
            pass
    return "jzn"

CURRENT_TOKEN = load_calibrated_token()
packet_logger = SessionPacketLogger(LOG_FILE, server_name=SERVER_NAME, current_token=CURRENT_TOKEN)
sales_inspector = SalesInspectionLogger(INSPECTION_FILE)
# =======================================================

# Catálogo precargado de todas las Runas oficiales de Dofus Unity
DEFAULT_RUNES_DB = {
    "1519": "Runa Fu", "1521": "Runa Sa", "1522": "Runa Inte", "1523": "Runa Vi", "1524": "Runa Agi", "1525": "Runa Sue",
    "1545": "Runa Bu Fu", "1546": "Runa Bu Sa", "1547": "Runa Bu Inte", "1548": "Runa Bu Vi", "1549": "Runa Bu Agi",
    "1550": "Runa Bu Sue", "1551": "Runa Su Fu", "1552": "Runa Su Sa", "1553": "Runa Su Inte", "1554": "Runa Su Vi",
    "1555": "Runa Su Agi", "1556": "Runa Su Sue", "1557": "Runa Ga PA", "1558": "Runa Ga PM", "7433": "Runa Cri",
    "7434": "Runa Cu", "7435": "Runa Da", "7436": "Runa Pot", "7437": "Runa Da Reen", "7438": "Runa Al",
    "7442": "Runa Invo", "7443": "Runa Pod", "7444": "Runa Bu Pod", "7445": "Runa Su Pod", "7446": "Runa Da Tram",
    "7447": "Runa Por Tram", "7448": "Runa Ini", "7449": "Runa Bu Ini", "7450": "Runa Su Ini", "7451": "Runa Prospe",
    "7452": "Runa Re Fuego", "7453": "Runa Re Aire", "7454": "Runa Re Agua", "7455": "Runa Re Tierra", "7456": "Runa Re Neutral",
    "7457": "Runa Re Fuego Por", "7458": "Runa Re Aire Por", "7459": "Runa Re Tierra Por", "7460": "Runa Re Neutral Por",
    "7508": "Runa de firma", "7560": "Runa Re Agua Por", "10057": "Runa de caza", "10613": "Runa Bu Da Tram",
    "10615": "Runa Bu Por Tram", "10616": "Runa Su Por Tram", "10618": "Runa Bu Pot", "10619": "Runa Su Pot",
    "10662": "Runa Bu Prospe", "11637": "Runa Hui", "11638": "Runa Bu Hui", "11639": "Runa Pla", "11640": "Runa Bu Pla",
    "11641": "Runa Re PA", "11642": "Runa Bu Re PA", "11643": "Runa Re PM", "11644": "Runa Bu Re PM", "11645": "Runa Ret PA",
    "11646": "Runa Bu Ret PA", "11647": "Runa Ret PM", "11648": "Runa Bu Ret PM", "11649": "Runa Da Emp", "11650": "Runa Bu Da Emp",
    "11651": "Runa Re Emp", "11652": "Runa Bu Re Emp", "11653": "Runa Da Cri", "11654": "Runa Bu Da Cri", "11655": "Runa Re Cri",
    "11656": "Runa Bu Re Cri", "11657": "Runa Da Tierra", "11658": "Runa Bu Da Tierra", "11659": "Runa Da Fuego",
    "11660": "Runa Bu Da Fuego", "11661": "Runa Da Agua", "11662": "Runa Bu Da Agua", "11663": "Runa Da Aire",
    "11664": "Runa Bu Da Aire", "11665": "Runa Da Neutral", "11666": "Runa Bu Da Neutral", "18719": "Runa Da Por CC",
    "18720": "Runa Da Por Di", "18721": "Runa Da Por Ar", "18722": "Runa Da Por He", "18723": "Runa Re Por CC",
    "18724": "Runa Re Por Di", "19337": "Runa Bu Cu", "19338": "Runa Bu Re Aire", "19339": "Runa Bu Re Agua",
    "19340": "Runa Bu Re Fuego", "19341": "Runa Bu Re Neutral", "19342": "Runa Bu Re Tierra", "20492": "Runa Ta Inte",
    "20556": "Runa Buta Inte", "20557": "Runa Suta Inte", "20558": "Runa Ta Fu", "20559": "Runa Buta Fu", "20560": "Runa Suta Fu",
    "20561": "Runa Ta Agi", "20562": "Runa Buta Agi", "20563": "Runa Suta Agi", "20564": "Runa Ta Sue", "20565": "Runa Buta Sue",
    "20566": "Runa Suta Sue", "20567": "Runa Ta Vi", "20568": "Runa Buta Vi", "20569": "Runa Suta Vi", "20570": "Runa Ta Ini",
    "20571": "Runa Buta Ini", "20572": "Runa Suta Ini", "20573": "Runa Ta Pod", "20574": "Runa Buta Pod", "20575": "Runa Suta Pod",
    "20576": "Runa Ta Pot", "20577": "Runa Buta Pot", "20578": "Runa Suta Pot", "20579": "Runa Ta Re Emp", "20580": "Runa Buta Re Emp",
    "20581": "Runa Ta Re Cri", "20582": "Runa Buta Re Cri", "20583": "Runa Ta Da Emp", "20584": "Runa Buta Da Emp",
    "20585": "Runa Ta Da Cri", "20586": "Runa Buta Da Cri", "20596": "Runa Ta Da Tierra", "20597": "Runa Buta Da Tierra",
    "20598": "Runa Suta Da Tierra", "20599": "Runa Ta Da Fuego", "20600": "Runa Buta Da Fuego", "20601": "Runa Suta Da Fuego",
    "20602": "Runa Ta Da Agua", "20603": "Runa Buta Da Agua", "20604": "Runa Suta Da Agua", "20605": "Runa Ta Da Aire",
    "20606": "Runa Buta Da Aire", "20607": "Runa Suta Da Aire", "20608": "Runa Ta Da Neutral", "20609": "Runa Buta Da Neutral",
    "20610": "Runa Suta Da Neutral", "20611": "Runa Ta Re Por Di", "20612": "Runa Ta Re Por Di", "20613": "Runa Ta Da Por He",
    "20614": "Runa Ta Da Por Ar", "20615": "Runa Ta Da Por Di", "20616": "Runa Ta Da Por CC", "20617": "Runa Ta Hui",
    "20618": "Runa Buta Hui", "20619": "Runa Suta Hui", "20620": "Runa Ta Pla", "20621": "Runa Buta Pla", "20622": "Runa Suta Pla",
    "20623": "Runa Ta Re PA", "20624": "Runa Buta Re PA", "20625": "Runa Suta Re PA", "20626": "Runa Ta Re PM",
    "20627": "Runa Buta Re PM", "20628": "Runa Suta Re PM", "20629": "Runa Ta Ret PA", "20630": "Runa Buta Ret PA",
    "20631": "Runa Suta Ret PA", "20632": "Runa Ta Ret PM", "20633": "Runa Buta Ret PM", "20634": "Runa Suta Ret PM",
    "20635": "Runa Ta Re Por Tierra", "20636": "Runa Ta Re Por Fuego", "20637": "Runa Ta Re Por Agua", "20638": "Runa Ta Re Por Aire",
    "20639": "Runa Ta Re Por Neutral", "20640": "Runa Ta Cri", "20641": "Runa Buta Cri", "20642": "Runa Ta He",
    "20643": "Runa Buta He", "20644": "Runa Suta He", "21964": "Runa astral menor", "21965": "Runa astral media",
    "21966": "Runa astral mayor", "21967": "Runa astral asombrosa", "21968": "Runa astral legendaria",
    "21969": "Runa astral maravillosa", "25809": "Runa de armonía", "29683": "Runa Su Re Emp", "29684": "Runa Su Da Emp",
    "30695": "Runa Su Re Tierra", "30696": "Runa Su Re Neutral", "30697": "Runa Su Re Fuego", "30698": "Runa Su Re Agua",
    "30699": "Runa Su Re Cri", "30700": "Runa Su Re Aire", "30942": "Runa Bu Da Reen"
}

ITEMS_DB = dict(DEFAULT_RUNES_DB)
EQUIPMENT_IDS = set()
packet_queue = queue.Queue(maxsize=2000)

# Configurar sesión HTTP robusta con keep-alive y reintentos automáticos
http_session = requests.Session()
retries = Retry(
    total=3,
    backoff_factor=0.3,
    status_forcelist=[500, 502, 503, 504],
    raise_on_status=False
)
adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=20)
http_session.mount("http://", adapter)
http_session.mount("https://", adapter)

def is_item_equipment(item_id):
    s_id = str(item_id)
    return s_id in EQUIPMENT_IDS or item_id in EQUIPMENT_IDS

def load_or_download_items_db(force=False):
    global ITEMS_DB, EQUIPMENT_IDS
    need_download = force or not os.path.exists(LOCAL_DB_FILE) or os.path.getsize(LOCAL_DB_FILE) < 100
    if not need_download:
        try:
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict) and "items" in loaded:
                ITEMS_DB.update(loaded["items"])
                if "equipmentIds" in loaded and isinstance(loaded["equipmentIds"], list):
                    EQUIPMENT_IDS.update(str(x) for x in loaded["equipmentIds"])
            elif isinstance(loaded, dict):
                ITEMS_DB.update(loaded)
            ITEMS_DB.update(DEFAULT_RUNES_DB)

            # Sanitizar colisiones corruptas históricas
            corrupt_keys = [k for k, v in ITEMS_DB.items() if v == "Puré pic-feil" and k not in ("35089", "666")]
            for k in corrupt_keys:
                del ITEMS_DB[k]

            if "1550" not in ITEMS_DB or len(EQUIPMENT_IDS) == 0:
                need_download = True
            else:
                print(f"[DB Local] Cargados {len(ITEMS_DB):,} nombres ({len(EQUIPMENT_IDS):,} equipables) desde items_db.json")
                return
        except Exception:
            need_download = True

    print(f"[DB Local] Descargando base de datos actualizada desde el servidor ({API_DICT_URL}?v=2)...")
    try:
        r = http_session.get(API_DICT_URL + "?v=2", timeout=15.0)
        if r.status_code == 200:
            downloaded = r.json()
            if isinstance(downloaded, dict) and "items" in downloaded:
                ITEMS_DB.update(downloaded["items"])
                if "equipmentIds" in downloaded and isinstance(downloaded["equipmentIds"], list):
                    EQUIPMENT_IDS.update(str(x) for x in downloaded["equipmentIds"])
            elif isinstance(downloaded, dict):
                ITEMS_DB.update(downloaded)
            ITEMS_DB.update(DEFAULT_RUNES_DB)

            # Sanitizar colisiones corruptas
            corrupt_keys = [k for k, v in ITEMS_DB.items() if v == "Puré pic-feil" and k not in ("35089", "666")]
            for k in corrupt_keys:
                del ITEMS_DB[k]

            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump({"items": ITEMS_DB, "equipmentIds": list(EQUIPMENT_IDS)}, f, ensure_ascii=False)
            print(f"[DB Local] OK Base de datos guardada ({len(ITEMS_DB):,} objetos, {len(EQUIPMENT_IDS):,} equipables listos en memoria).")
        else:
            print(f"[DB Local] Error HTTP {r.status_code} al descargar base de items.")
    except Exception as e:
        print(f"[DB Local] Advertencia de descarga: {e}. Se usarán las runas y base en memoria.")

def get_item_name(item_id):
    if not item_id:
        return "Objeto"
    s_id = str(item_id)
    if s_id in ITEMS_DB:
        val = ITEMS_DB[s_id]
        if val == "Puré pic-feil" and s_id not in ("35089", "666"):
            del ITEMS_DB[s_id]
        else:
            return val
    if s_id in DEFAULT_RUNES_DB:
        ITEMS_DB[s_id] = DEFAULT_RUNES_DB[s_id]
        return DEFAULT_RUNES_DB[s_id]
    if item_id in ITEMS_DB:
        return ITEMS_DB[item_id]
    # Auto-resolución en vivo desde DofusDB con query exacto por ID
    try:
        r = http_session.get(f"https://api.dofusdb.fr/items?id={item_id}&lang=es", timeout=2.0)
        if r.status_code == 200:
            res_json = r.json()
            items_list = res_json.get("data", [])
            if items_list and len(items_list) > 0:
                first_item = items_list[0]
                if str(first_item.get("id")) == s_id:
                    n = first_item.get("name")
                    name_val = n.get("es") or n.get("fr") or n.get("en") if isinstance(n, dict) else (n if isinstance(n, str) else "")
                    if name_val and name_val.strip():
                        clean_n = name_val.strip()
                        if clean_n.lower() == "puré pic-feil" and s_id not in ("35089", "666"):
                            return f"Objeto #{item_id}"
                        ITEMS_DB[s_id] = clean_n
                        type_id = first_item.get("typeId") or (first_item.get("type", {}).get("id") if isinstance(first_item.get("type"), dict) else 0)
                        if type_id in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23, 81, 82, 90, 97, 120, 121, 151, 169, 170, 187, 188, 189, 190, 196, 207, 220, 333):
                            EQUIPMENT_IDS.add(s_id)
                        return clean_n
    except Exception:
        pass
    return f"Objeto #{item_id}"

def decode_varint(buf, off):
    val, shift, read = 0, 0, 0
    while off + read < len(buf):
        b = buf[off + read]
        read += 1
        val |= (b & 0x7F) << shift
        if (b & 0x80) == 0:
            break
        shift += 7
    return val, read

def decode_packed_varints(buf):
    vals = []
    off = 0
    while off < len(buf):
        v, r = decode_varint(buf, off)
        if r == 0:
            break
        off += r
        vals.append(v)
    return vals

def is_valid_submessage(b):
    if not b or len(b) < 2:
        return False
    off = 0
    valid_fields = 0
    while off < len(b):
        v, r = decode_varint(b, off)
        if r == 0:
            return False
        off += r
        wtype = v & 7
        fnum = v >> 3
        if fnum == 0 or wtype not in (0, 1, 2, 5):
            return False
        if wtype == 0:
            _, r2 = decode_varint(b, off)
            if r2 == 0:
                return False
            off += r2
            valid_fields += 1
        elif wtype == 2:
            l_val, r2 = decode_varint(b, off)
            if r2 == 0 or off + r2 + l_val > len(b):
                return False
            off += r2 + l_val
            valid_fields += 1
        elif wtype == 1:
            off += 8
            if off > len(b):
                return False
            valid_fields += 1
        elif wtype == 5:
            off += 4
            if off > len(b):
                return False
            valid_fields += 1
        else:
            return False
    return valid_fields >= 1 and off == len(b)

def extract_market_universal(buf):
    """Inspecciona recursivamente el mensaje Protobuf discriminando submensajes de arreglos de precios"""
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
                # Solo los niveles principales definen el ID real del objeto
                if depth <= 1:
                    if fnum in (1, 2) and (10 <= v <= 100000):
                        if item_id == 0 or (str(item_id) not in ITEMS_DB and str(v) in ITEMS_DB):
                            item_id = v
                    elif fnum == 5 and (10 <= v <= 100000) and item_id == 0:
                        item_id = v

                # En ofertas individuales (depth == 1): varints de precios de ofertas unitarias (fnum in (2, 3, 4), >= 500)
                # Nunca capturar a depth == 2 donde residen estadísticas de efectos (PA, PM, Sab, Fo) ni fnum == 5 (ID de lote)
                if depth == 1 and fnum in (2, 3, 4) and 500 <= v <= 2_000_000_000 and v != item_id:
                    offer_prices.append(v)

            elif wtype == 2:
                length, r = decode_varint(b, off)
                off += r
                if off + length > len(b):
                    break
                data = b[off:off + length]
                off += length

                if is_valid_submessage(data):
                    # Es una sub-estructura (oferta individual o contenedor de efectos), inspeccionar recursivamente
                    if depth < 3:
                        walk(data, depth + 1)
                else:
                    # Es un arreglo packed de varints (precios por lotes x1, x10, x100, x1000)
                    if depth <= 1:
                        p_ints = decode_packed_varints(data)
                        if 1 <= len(p_ints) <= 100 and all(p >= 0 for p in p_ints) and any(p > 10 for p in p_ints):
                            ladders.append((fnum, p_ints))

            elif wtype == 1:
                off += 8
            elif wtype == 5:
                off += 4
            else:
                break

    walk(buf)
    return item_id, ladders, offer_prices

def clean_ladder(raw_list):
    cl = [int(p) for p in raw_list if p is not None]
    if not cl:
        return []

    # 1. Prefijo de conteo exacto de Dofus Unity (len == count + 1)
    # ej: [4, p1, p10, p100, p1000] -> len 5 == 4 + 1
    # ej: [3, p1, p10, p100] -> len 4 == 3 + 1
    # ej: [2, p1, p10] -> len 3 == 2 + 1
    # ej: [1, p1] -> len 2 == 1 + 1
    # ej: [5, ...] -> len 6 == 5 + 1
    # ej: [6, ...] -> len 7 == 6 + 1
    if len(cl) > 1 and 1 <= cl[0] <= 10 and len(cl) == cl[0] + 1:
        return cl[1:]

    # 2. Si la lista tiene longitud 5 (ej: [6, 1370, 13486, 135900, 1398990])
    # donde cl[0] es SuperTypeId/TypeId/Categoría (como 6=Consumibles/Esquíritu, 4=Pergamino)
    # y los 4 siguientes son los lotes reales x1, x10, x100, x1000
    if len(cl) == 5 and cl[0] <= 100:
        if cl[0] <= 20 or (cl[1] > 0 and cl[2] >= cl[1]):
            return cl[1:]

    # 3. Si cl[0] es un conteo/tipo pequeño (1 <= cl[0] <= 10) y cl[1] es un precio real (>= 20)
    if len(cl) > 1 and 1 <= cl[0] <= 10 and cl[1] >= 20:
        return cl[1:]

    # 4. Verificación de ratio anómalo: si 1 <= cl[0] <= 50 y cl[1] / max(1, cl[0]) > 40
    # (en Dofus ningún lote 10 cuesta 40 veces más que el lote 1)
    if len(cl) > 1 and 1 <= cl[0] <= 50 and cl[1] > 0 and (cl[1] / max(1, cl[0])) > 40:
        return cl[1:]

    return cl

def process_ladders(ladders, offer_prices=None, item_id=0):
    if isinstance(offer_prices, (int, str)) and item_id == 0:
        item_id = int(offer_prices)
        offer_prices = []
    if offer_prices is None:
        offer_prices = []

    is_known_equip = is_item_equipment(item_id)

    # Filtrar ladders válidas descartando TypeIDs/Categorías aisladas (ej: [6] o [4])
    valid_ladders = []
    for fnum, pl in ladders:
        cl = clean_ladder(pl)
        non_zero = [p for p in cl if p > 0]
        if len(non_zero) == 1 and non_zero[0] <= 10:
            continue
        if any(p > 0 for p in cl):
            valid_ladders.append((fnum, cl))

    # Detección estructural de equipables en Dofus Unity:
    # A) Está en el catálogo EQUIPMENT_IDS, O
    # B) Hay 2 o más tuplas de ofertas reales (los recursos NUNCA tienen múltiples ofertas en mercadillo)
    is_multi_gear_offers = len(valid_ladders) >= 2

    if is_known_equip or is_multi_gear_offers:
        # Los equipables se venden por unidad o apilados en lotes (x1, x10, x100, x1000) si tienen estadísticas idénticas.
        # Se extraen los precios unitarios reales para cada oferta:
        if valid_ladders:
            unit_prices = []
            for _, pl in valid_ladders:
                if not pl:
                    continue
                if len(pl) >= 1 and pl[0] and pl[0] >= 50:
                    unit_prices.append(int(pl[0]))
                if len(pl) >= 2 and pl[1] and pl[1] >= 50:
                    unit_prices.append(int(round(pl[1] / 10.0)))
                if len(pl) >= 3 and pl[2] and pl[2] >= 50:
                    unit_prices.append(int(round(pl[2] / 100.0)))
                if len(pl) >= 4 and pl[3] and pl[3] >= 50:
                    unit_prices.append(int(round(pl[3] / 1000.0)))
            valid_prices = sorted(unit_prices)
        else:
            valid_prices = sorted([int(p) for p in offer_prices if p >= 50])

        if valid_prices:
            return "equipable", valid_prices
        return "equipable", []

    # 2. Si no es equipable, es un recurso. En Dofus Unity los recursos vienen en una única tupla de lotes.
    if valid_ladders:
        return "recurso", valid_ladders[0][1]

    return "desconocido", []


def parse_market_message(buf):
    """Decodifica UNICAMENTE paquetes que contienen el token calibrado (ej: jzn)"""
    try:
        t_bytes = CURRENT_TOKEN.encode('ascii')
        if t_bytes not in buf:
            return None, None, [], {}

        pos = 0
        while True:
            found = buf.find(t_bytes, pos)
            if found == -1:
                break
            tok_end = found + len(t_bytes)
            pos = tok_end

            off_12 = buf.find(b"", tok_end, tok_end + 25)
            if off_12 == -1:
                payload = buf[tok_end:]
            else:
                off = off_12 + 1
                if off >= len(buf):
                    continue
                payload_len, br = decode_varint(buf, off)
                off += br
                payload = buf[off:off + payload_len]

            item_id, ladders, offer_prices = extract_market_universal(payload)
            if item_id and item_id >= 10:
                item_type, prices = process_ladders(ladders, offer_prices, item_id)
                if prices:
                    debug_info = {
                        "ladders": [(fn, list(pl)) for fn, pl in ladders],
                        "offers": list(offer_prices),
                    }
                    return item_id, item_type, prices, debug_info
    except Exception:
        pass
    return None, None, [], {}

def async_worker():
    """Hilo en segundo plano: envía los precios por lotes sin frenar el sniffer"""
    headers = {"Content-Type": "application/json"}
    if API_SECRET_KEY:
        headers["x-api-key"] = API_SECRET_KEY

    while True:
        items_batch = []
        try:
            first_item = packet_queue.get(timeout=0.15)
            items_batch.append(first_item)
            packet_queue.task_done()

            start_collect = time.time()
            while len(items_batch) < 35 and (time.time() - start_collect) < 0.04:
                try:
                    next_item = packet_queue.get_nowait()
                    items_batch.append(next_item)
                    packet_queue.task_done()
                except queue.Empty:
                    break
        except queue.Empty:
            continue
        except Exception:
            continue

        if not items_batch:
            continue

        now_str = datetime.now().strftime("%H:%M:%S")

        # Enriquecer los datos en segundo plano (para no congelar la captura de Scapy)
        prepared_items = []
        for raw in items_batch:
            iid = raw["item_id"]
            name = get_item_name(iid)
            is_equip = raw["is_equipment"]
            prices = raw["prices"]

            body = {
                "item_id": iid,
                "item_name": name,
                "type": "equipable" if is_equip else "recurso",
                "server": raw["server"],
                "source": "sniffer",
            }
            if is_equip:
                body["precios"] = [int(p) for p in prices if p >= 50]
            else:
                clean_p = clean_ladder(prices)
                p1 = clean_p[0] if len(clean_p) > 0 else 0
                p10 = clean_p[1] if len(clean_p) > 1 else 0
                p100 = clean_p[2] if len(clean_p) > 2 else 0
                p1000 = clean_p[3] if len(clean_p) > 3 else 0

                body["precios"] = {
                    "1": int(p1),
                    "10": int(p10),
                    "100": int(p100),
                    "1000": int(p1000),
                }
            prepared_items.append((body, raw))

        try:
            if len(prepared_items) == 1:
                item, raw = prepared_items[0]
                res = http_session.post(API_UPDATE_URL, json=item, headers=headers, timeout=5.0)
                api_log_msg = ""
                if res.status_code == 200:
                    data = res.json()
                    c_price = data.get("calculated_price", 0)
                    is_anti_troll = data.get("anti_troll_triggered", False)
                    outliers = data.get("filtered_outliers", 0)
                    extra = ""
                    if is_anti_troll:
                        extra = " (Protegido contra precio atipico)"
                    elif outliers > 0:
                        extra = f" (Filtro {outliers} cebo/outlier)"
                    print(f"[{now_str}]  [{item['type'].upper()}] {item['item_name']} (#{item['item_id']}) -> {c_price:,} k (Guardado{extra})", flush=True)
                    api_log_msg = f"OK 200 | Precio: {c_price:,} k{extra}"
                else:
                    print(f"[{now_str}]  Error {res.status_code}: {res.text}", flush=True)
                    api_log_msg = f"Error {res.status_code}: {res.text}"

                # Registro forense en sniffer.log para la sesión activa
                packet_logger.log_packet(
                    item_id=item["item_id"],
                    item_name=item["item_name"],
                    is_equip=item["type"] == "equipable",
                    raw_ladders=raw.get("raw_debug", {}).get("ladders", []),
                    offer_prices=item["precios"] if item["type"] == "equipable" else raw.get("raw_debug", {}).get("offers", []),
                    resolved_prices=item["precios"],
                    hex_summary=raw.get("hex_summary", ""),
                    api_result=api_log_msg,
                )
            else:
                items_only = [p[0] for p in prepared_items]
                res = http_session.post(API_BATCH_URL, json={"items": items_only}, headers=headers, timeout=8.0)
                batch_msg = ""
                if res.status_code == 200:
                    data = res.json()
                    tot = data.get("total_processed", len(items_only))
                    print(f"[{now_str}]  [LOTE PROCESADO] {tot} objetos sincronizados con Turso", flush=True)
                    batch_msg = f"OK 200 | Lote de {tot} items procesado"
                else:
                    print(f"[{now_str}]  Error de lote {res.status_code}: {res.text}", flush=True)
                    batch_msg = f"Error {res.status_code}: {res.text}"

                for item, raw in prepared_items:
                    packet_logger.log_packet(
                        item_id=item["item_id"],
                        item_name=item["item_name"],
                        is_equip=item["type"] == "equipable",
                        raw_ladders=raw.get("raw_debug", {}).get("ladders", []),
                        offer_prices=item["precios"] if item["type"] == "equipable" else raw.get("raw_debug", {}).get("offers", []),
                        resolved_prices=item["precios"],
                        hex_summary=raw.get("hex_summary", ""),
                        api_result=batch_msg,
                    )
        except requests.exceptions.RequestException as req_err:
            try:
                time.sleep(0.3)
                items_only = [p[0] for p in prepared_items]
                if len(items_only) == 1:
                    http_session.post(API_UPDATE_URL, json=items_only[0], headers=headers, timeout=6.0)
                else:
                    http_session.post(API_BATCH_URL, json={"items": items_only}, headers=headers, timeout=10.0)
            except Exception:
                pass
        except Exception as e:
            print(f"[{now_str}] [Aviso]: {e}", flush=True)

def process_packet(pkt):
    try:
        if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
            return
        # Ignorar paquetes que salen del cliente hacia el puerto 5555 para evitar procesar nuestras propias peticiones
        if pkt[TCP].sport != 5555 and pkt[TCP].dport == 5555:
            return

        payload = bytes(pkt[Raw].load)
        if len(payload) < 4:
            return

        item_id, item_type, prices, debug_info = parse_market_message(payload)
        item_name = get_item_name(item_id) if item_id else ""

        # Registrar en cotizaciones_inspeccion.txt para descubrir los números de cotización / 24h / 7d / 30d
        sales_inspector.inspect_packet(payload, item_id=item_id, item_name=item_name)

        if item_id and prices:
            # Forzar tipo equipable si está catalogado en EQUIPMENT_IDS
            is_equipment = item_type == "equipable" or is_item_equipment(item_id) or len(prices) > 4
            raw_entry = {
                "item_id": item_id,
                "is_equipment": is_equipment,
                "prices": prices,
                "server": SERVER_NAME,
                "raw_debug": debug_info,
                "hex_summary": payload[:48].hex(),
            }
            try:
                packet_queue.put_nowait(raw_entry)
            except queue.Full:
                pass
    except Exception:
        pass

def main():
    print("=" * 70, flush=True)
    print("      DOFUS UNITY -> MERCADILLO LIVE SNIFFER (MODO ESTRICTO)", flush=True)
    print(f"  Servidor Destino : {SERVER_NAME}", flush=True)
    print(f"  Token Calibrado  : '{CURRENT_TOKEN}' (filtrado estricto, sin basura)", flush=True)
    print(f"  Base de Datos    : Turso / LibSQL Cloud", flush=True)
    try:
        from scapy.all import conf
        if_desc = getattr(conf.iface, 'name', str(conf.iface))
        print(f"  Interfaz de Red  : {if_desc}", flush=True)
    except Exception:
        pass
    print("=" * 70, flush=True)

    load_or_download_items_db()

    worker_thread = threading.Thread(target=async_worker, daemon=True)
    worker_thread.start()

    print("\nEscuchando paquetes en tiempo real...", flush=True)
    print("Abre el mercadillo en Dofus Unity e inspecciona los objetos.", flush=True)
    print("Presiona Ctrl+C para salir.\n", flush=True)

    try:
        sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
    except KeyboardInterrupt:
        print("\n\nSincronizador detenido por el usuario.", flush=True)
    except Exception as e:
        print(f"\n[Error Sniffer]: {e}", flush=True)
        traceback.print_exc()
        input("\nPresiona Enter para cerrar...")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR CRITICO NO CONTROLADO]: {e}", flush=True)
        traceback.print_exc()
        input("\nPresiona Enter para cerrar...")
