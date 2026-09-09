import React, { useState, useEffect } from 'react';
import {
  Radio,
  X,
  Copy,
  Check,
  Download,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Server,
  Layers,
  FileCode,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { PriceProfile } from '../types';
import { triggerLivePriceSync } from '../services/dofusDbService';

interface MarketSnifferModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile?: PriceProfile;
  onPriceUpdated?: () => void;
}

const PRESET_SERVERS = [
  { name: 'Draconiros', category: 'Monocuenta Clásico' },
  { name: 'Kourial', category: 'Monocuenta Pionero' },
  { name: 'Mikhal', category: 'Monocuenta Pionero' },
  { name: 'Dakal', category: 'Monocuenta Pionero' },
  { name: 'Brial', category: 'Multicuenta Pionero' },
  { name: 'Rafal', category: 'Multicuenta Pionero' },
  { name: 'Salar', category: 'Multicuenta Pionero' },
  { name: 'Tal Kasha', category: 'Multicuenta Clásico' },
  { name: 'Hell Mina', category: 'Multicuenta Clásico' },
  { name: 'Imagiro', category: 'Multicuenta Clásico' },
  { name: 'Orukam', category: 'Multicuenta Clásico' },
  { name: 'Tylezia', category: 'Multicuenta Clásico' },
  { name: 'Shadow', category: 'Sombra (Épico)' },
];

export const MarketSnifferModal: React.FC<MarketSnifferModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
}) => {
  const [selectedServer, setSelectedServer] = useState<string>(activeProfile?.name || 'Draconiros');
  const [isCustomServer, setIsCustomServer] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedBat, setCopiedBat] = useState(false);
  const [activeTab, setActiveTab] = useState<'instructions' | 'bat' | 'script'>('instructions');
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void triggerLivePriceSync(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const batchApiUrl = `${currentOrigin}/api/market/batch-update`;
  const updateApiUrl = `${currentOrigin}/api/market/update`;
  const dictApiUrl = `${currentOrigin}/api/market/items-dictionary`;
  const activeServerTarget = (selectedServer || activeProfile?.name || 'Draconiros').trim();

  const pythonScript = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY -> MERCADILLO ULTRA-FAST LIVE SNIFFER (HIGH PERFORMANCE)
===============================================================================
  - Búfer Asíncrono Multihilo: captura de paquetes sin latencia ni cuellos de botella.
  - Base de Datos Local (items_db.json): resolución de nombres en 0.001 ms.
  - Micro-Batching con HTTP Keep-Alive hacia tu servidor Turso/Vercel.
  - Auto-Elevación en Windows y Auto-Instalación de dependencias.
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
    try:
        # Desactivar QuickEdit Mode en Windows (evita que hacer clic en la ventana congele el programa hasta pulsar Enter)
        import ctypes
        kernel32 = ctypes.windll.kernel32
        hStdin = kernel32.GetStdHandle(-10)  # STD_INPUT_HANDLE = -10
        mode = ctypes.c_ulong()
        if kernel32.GetConsoleMode(hStdin, ctypes.byref(mode)):
            # Quitar 0x0040 (ENABLE_QUICK_EDIT_MODE) y añadir 0x0080 (ENABLE_EXTENDED_FLAGS)
            new_mode = (mode.value & ~0x0040) | 0x0080
            kernel32.SetConsoleMode(hStdin, ctypes.c_ulong(new_mode))
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
                print("[Aviso] No se concedieron permisos de Administrador.")
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
        print(f"[Instalador] Instalando librerias: {', '.join(packages)}")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", *packages])
        except Exception as e:
            print(f"[Error] No se pudieron instalar dependencias: {e}")
            input("\\nPresiona Enter para salir...")
            sys.exit(1)

ensure_dependencies()

import requests
try:
    from scapy.all import sniff, TCP, Raw
except Exception as e:
    print("\\n" + "=" * 70)
    print(" [CONTROLADOR DE RED NPCAP REQUERIDO EN WINDOWS]")
    print(f" Detalle: {e}")
    print("=" * 70)
    print(" Para capturar paquetes de red en Windows:")
    print(" 1. Descarga el instalador gratuito de Npcap:")
    print("    https://npcap.com/#download")
    print(" 2. Durante la instalacion MARCA la casilla:")
    print("    'Install Npcap in WinPcap API-compatible Mode'")
    print("=" * 70)
    input("\\nPresiona Enter para salir...")
    sys.exit(1)

# Argumentos de línea de comandos para cambiar el servidor dinámicamente
parser = argparse.ArgumentParser(description="Dofus Unity Market Sniffer")
parser.add_argument("--server", type=str, default="${activeServerTarget}", help="Nombre del servidor Dofus")
parser.add_argument("--token", type=str, default="", help="Token de 3 letras de la sesión (ej: jzn)")
parser.add_argument("--no-auto-detect", action="store_true", help="Desactivar detección automática de token")
cli_args, _ = parser.parse_known_args()

# ==================== CONFIGURACIÓN ====================
API_BATCH_URL = "${batchApiUrl}"
API_UPDATE_URL = "${updateApiUrl}"
API_DICT_URL = "${dictApiUrl}"
API_DOWNLOAD_URL = "${currentOrigin}/api/market/download-items-db"
API_SECRET_KEY = ""
SERVER_NAME = (cli_args.server or "${activeServerTarget}").strip()
DOFUS_PORTS = "tcp port 5555"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in locals() else os.getcwd()
LOCAL_DB_FILE = os.path.join(SCRIPT_DIR, "items_db.json")
KEYMAP_FILE = os.path.join(SCRIPT_DIR, "keymap.json")

# Tokens conocidos de Dofus Unity para mercadillo
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
# =======================================================

# Diccionario nativo integrado con las 105 Runas oficiales de Dofus (resolución 0ms sin esperas)
DEFAULT_RUNES_DB = {
    "1519": "Runa Fu", "1521": "Runa Sa", "1522": "Runa Inte", "1523": "Runa Vi", "1524": "Runa Agi", "1525": "Runa Sue",
    "1545": "Runa Bu Fu", "1546": "Runa Bu Sa", "1547": "Runa Bu Inte", "1548": "Runa Bu Vi", "1549": "Runa Bu Agi", "1550": "Runa Bu Sue",
    "1551": "Runa Su Fu", "1552": "Runa Su Sa", "1553": "Runa Su Inte", "1554": "Runa Su Vi", "1555": "Runa Su Agi", "1556": "Runa Su Sue",
    "1557": "Runa Ga PA", "1558": "Runa Ga PM", "7433": "Runa Cri", "7434": "Runa Cu", "7435": "Runa Da", "7436": "Runa Pot",
    "7437": "Runa Da Reen", "7438": "Runa Al", "7442": "Runa Invo", "7443": "Runa Pod", "7444": "Runa Bu Pod", "7445": "Runa Su Pod",
    "7446": "Runa Da Tram", "7447": "Runa Por Tram", "7448": "Runa Ini", "7449": "Runa Bu Ini", "7450": "Runa Su Ini",
    "7451": "Runa Prospe", "7452": "Runa Re Fuego", "7453": "Runa Re Aire", "7454": "Runa Re Agua", "7455": "Runa Re Tierra",
    "7456": "Runa Re Neutral", "7457": "Runa Re Fuego Por", "7458": "Runa Re Aire Por", "7459": "Runa Re Tierra Por",
    "7460": "Runa Re Neutral Por", "7508": "Runa de firma", "7560": "Runa Re Agua Por", "10057": "Runa de caza",
    "10613": "Runa Bu Da Tram", "10615": "Runa Bu Por Tram", "10616": "Runa Su Por Tram", "10618": "Runa Bu Pot",
    "10619": "Runa Su Pot", "10662": "Runa Bu Prospe", "11637": "Runa Hui", "11638": "Runa Bu Hui", "11639": "Runa Pla",
    "11640": "Runa Bu Pla", "11641": "Runa Re PA", "11642": "Runa Bu Re PA", "11643": "Runa Re PM", "11644": "Runa Bu Re PM",
    "11645": "Runa Ret PA", "11646": "Runa Bu Ret PA", "11647": "Runa Ret PM", "11648": "Runa Bu Ret PM", "11649": "Runa Da Emp",
    "11650": "Runa Bu Da Emp", "11651": "Runa Re Emp", "11652": "Runa Bu Re Emp", "11653": "Runa Da Cri", "11654": "Runa Bu Da Cri",
    "11655": "Runa Re Cri", "11656": "Runa Bu Re Cri", "11657": "Runa Da Tierra", "11658": "Runa Bu Da Tierra",
    "11659": "Runa Da Fuego", "11660": "Runa Bu Da Fuego", "11661": "Runa Da Agua", "11662": "Runa Bu Da Agua",
    "11663": "Runa Da Aire", "11664": "Runa Bu Da Aire", "11665": "Runa Da Neutral", "11666": "Runa Bu Da Neutral",
    "18719": "Runa Da Por CC", "18720": "Runa Da Por Di", "18721": "Runa Da Por Ar", "18722": "Runa Da Por He",
    "18723": "Runa Re Por CC", "18724": "Runa Re Por Di", "19337": "Runa Bu Cu", "19338": "Runa Bu Re Aire",
    "19339": "Runa Bu Re Agua", "19340": "Runa Bu Re Fuego", "19341": "Runa Bu Re Neutral", "19342": "Runa Bu Re Tierra",
    "29683": "Runa Su Re Emp", "29684": "Runa Su Da Emp", "30695": "Runa Su Re Tierra", "30696": "Runa Su Re Neutral",
    "30697": "Runa Su Re Fuego", "30698": "Runa Su Re Agua", "30699": "Runa Su Re Cri", "30700": "Runa Su Re Aire",
    "30942": "Runa Bu Da Reen"
}

ITEMS_DB = dict(DEFAULT_RUNES_DB)
EQUIPMENT_IDS = set()
packet_queue = queue.Queue(maxsize=2000)
http_session = requests.Session()
_db_dirty = False
_db_lock = threading.Lock()

def is_item_equipment(item_id):
    s_id = str(item_id)
    return s_id in EQUIPMENT_IDS or item_id in EQUIPMENT_IDS

def save_local_db():
    global _db_dirty
    with _db_lock:
        if not _db_dirty or not ITEMS_DB:
            return
        try:
            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump({"items": ITEMS_DB, "equipmentIds": list(EQUIPMENT_IDS)}, f, ensure_ascii=False)
            _db_dirty = False
        except Exception:
            pass

def load_or_download_items_db():
    global ITEMS_DB, EQUIPMENT_IDS, _db_dirty
    need_download = not os.path.exists(LOCAL_DB_FILE) or os.path.getsize(LOCAL_DB_FILE) < 500
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
            if "1550" not in ITEMS_DB or len(EQUIPMENT_IDS) == 0:
                need_download = True
            elif len(ITEMS_DB) > 50:
                print(f"[DB Local] OK Cargados {len(ITEMS_DB):,} nombres ({len(EQUIPMENT_IDS):,} equipables) desde items_db.json")
                return
        except Exception:
            need_download = True

    print(f"[DB Local] Descargando base de nombres de objetos...")
    downloaded = False
    for target_url in [API_DICT_URL + "?v=2", API_DOWNLOAD_URL]:
        try:
            req = urllib.request.Request(target_url, headers={"User-Agent": "DofusSniffer/2.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status == 200:
                    data = resp.read().decode("utf-8")
                    if data.strip().startswith("{"):
                        parsed = json.loads(data)
                        if isinstance(parsed, dict) and "items" in parsed:
                            ITEMS_DB.update(parsed["items"])
                            if "equipmentIds" in parsed and isinstance(parsed["equipmentIds"], list):
                                EQUIPMENT_IDS.update(str(x) for x in parsed["equipmentIds"])
                        elif isinstance(parsed, dict) and len(parsed) > 50:
                            ITEMS_DB.update(parsed)
                        ITEMS_DB.update(DEFAULT_RUNES_DB)
                        with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                            json.dump({"items": ITEMS_DB, "equipmentIds": list(EQUIPMENT_IDS)}, f, ensure_ascii=False)
                        print(f"[DB Local] OK Base de datos guardada ({len(ITEMS_DB):,} objetos, {len(EQUIPMENT_IDS):,} equipables listos en memoria).")
                        downloaded = True
                        break
        except Exception:
            continue

    if not downloaded:
        print("[DB Local] Aviso: Servidor en modo diferido. Se usarán las runas y base en memoria.")

def get_item_name(item_id):
    global _db_dirty
    if not item_id:
        return "Objeto"
    
    str_id = str(item_id)
    if str_id in ITEMS_DB:
        return ITEMS_DB[str_id]
    if str_id in DEFAULT_RUNES_DB:
        ITEMS_DB[str_id] = DEFAULT_RUNES_DB[str_id]
        return DEFAULT_RUNES_DB[str_id]

    # Auto-resolución en vivo desde DofusDB oficial
    try:
        req = urllib.request.Request(
            f"https://api.dofusdb.fr/items?id={item_id}&lang=es",
            headers={"User-Agent": "DofusSniffer/2.0"}
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            if resp.status == 200:
                res_json = json.loads(resp.read().decode("utf-8"))
                items_list = res_json.get("data", [])
                if items_list and len(items_list) > 0:
                    first_item = items_list[0]
                    name_obj = first_item.get("name")
                    name_val = ""
                    if isinstance(name_obj, dict):
                        name_val = name_obj.get("es") or name_obj.get("fr") or name_obj.get("en") or ""
                    elif isinstance(name_obj, str):
                        name_val = name_obj
                    
                    if name_val and name_val.strip():
                        clean_name = name_val.strip()
                        with _db_lock:
                            ITEMS_DB[str_id] = clean_name
                            type_id = first_item.get("typeId") or (first_item.get("type", {}).get("id") if isinstance(first_item.get("type"), dict) else 0)
                            if type_id in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23, 81, 82, 90, 97, 120, 121, 151, 169, 170, 187, 188, 189, 190, 196, 207, 220, 333):
                                EQUIPMENT_IDS.add(str_id)
                            _db_dirty = True
                        return clean_name
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

def decode_packed_varints(data):
    nums, off = [], 0
    while off < len(data):
        v, r = decode_varint(data, off)
        if r == 0:
            break
        nums.append(v)
        off += r
    return nums

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
            return None, None, []

        pos = 0
        while True:
            found = buf.find(t_bytes, pos)
            if found == -1:
                break
            tok_end = found + len(t_bytes)
            pos = tok_end

            off_12 = buf.find(b"\x12", tok_end, tok_end + 25)
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
                    return item_id, item_type, prices
    except Exception:
        pass
    return None, None, []

def async_worker():
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "DofusSniffer/2.0"
    }

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

        # Enriquecer datos en segundo plano sin congelar la captura de red
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
                body["precios"] = prices
            else:
                clean_p = clean_ladder(prices)
                body["precios"] = {
                    "1": clean_p[0] if len(clean_p) > 0 else 0,
                    "10": clean_p[1] if len(clean_p) > 1 else 0,
                    "100": clean_p[2] if len(clean_p) > 2 else 0,
                    "1000": clean_p[3] if len(clean_p) > 3 else 0,
                }
            prepared_items.append(body)

        try:
            if len(prepared_items) == 1:
                item = prepared_items[0]
                res = http_session.post(API_UPDATE_URL, json=item, headers=headers, timeout=5.0)
                if res.status_code == 200:
                    data = res.json()
                    c_price = data.get("calculated_price", 0)
                    resp_type = data.get("type", item.get("type", "desconocido"))
                    outlier_note = ""
                    if data.get("filtered_outliers", 0) > 0:
                        outlier_note = f" (Filtro {data['filtered_outliers']} cebo/outlier)"
                    print(f"[{now_str}]  [{resp_type.upper()}] {item['item_name']} (#{item['item_id']}) -> {c_price:,} k (Guardado{outlier_note})", flush=True)
                else:
                    print(f"[{now_str}]  Error {res.status_code}: {res.text}", flush=True)
            else:
                res = http_session.post(API_BATCH_URL, json={"items": prepared_items}, headers=headers, timeout=8.0)
                if res.status_code == 200:
                    data = res.json()
                    tot = data.get("total_processed", len(prepared_items))
                    print(f"[{now_str}]  [LOTE PROCESADO] {tot} objetos sincronizados con Turso", flush=True)
                else:
                    print(f"[{now_str}]  Error de lote {res.status_code}: {res.text}", flush=True)
        except Exception as e:
            print(f"[{now_str}] [Aviso Conexion]: {e}", flush=True)

def process_packet(pkt):
    try:
        if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
            return
        if pkt[TCP].sport != 5555 and pkt[TCP].dport == 5555:
            return
        payload = bytes(pkt[Raw].load)

        item_id, item_type, prices = parse_market_message(payload)
        if item_id and prices:
            is_equipment = item_type == "equipable" or is_item_equipment(item_id) or len(prices) > 4
            raw_entry = {
                "item_id": item_id,
                "is_equipment": is_equipment,
                "prices": prices,
                "server": SERVER_NAME,
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

    print("\\n Escuchando paquetes en tiempo real...", flush=True)
    print("Abre el mercadillo en Dofus Unity e inspecciona los objetos.", flush=True)
    print("Presiona Ctrl+C para salir.\\n", flush=True)

    try:
        sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
    except KeyboardInterrupt:
        print("\\n\\nSincronizador detenido por el usuario.", flush=True)
    except Exception as e:
        print(f"\\n[Error Sniffer]: {e}", flush=True)
        traceback.print_exc()
        input("\\nPresiona Enter para cerrar...")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\\n[ERROR CRITICO NO CONTROLADO]: {e}", flush=True)
        traceback.print_exc()
        input("\\nPresiona Enter para cerrar...")
`;

  const snifferScriptUrl = `${currentOrigin}/api/market/sniffer-script?server=${encodeURIComponent(activeServerTarget)}`;
  const calibratorScriptUrl = `${currentOrigin}/api/market/calibrator-script`;
  const itemsDbDownloadUrl = `${currentOrigin}/api/market/download-items-db`;

  const batContent = `@echo off
chcp 65001 >nul
title Dofus Unity - Sincronizador y Calibrador de Mercadillo (${activeServerTarget})
cd /d "%~dp0"

:: Forzar salida inmediata en tiempo real sin almacenamiento en búfer
set PYTHONUNBUFFERED=1

echo ===================================================================
echo       DOFUS UNITY - SINCRONIZADOR DE MERCADILLO
echo       Servidor: ${activeServerTarget}
echo ===================================================================
echo.

echo [1/3] Descargando dofus_sniffer.py...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${snifferScriptUrl}" -o "dofus_sniffer.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${snifferScriptUrl}' -OutFile 'dofus_sniffer.py' -UseBasicParsing } catch { Write-Host $_.Exception.Message; exit 1 }"
)
if not exist "dofus_sniffer.py" (
    echo [Error] No se pudo descargar dofus_sniffer.py.
    goto :error
)

echo [2/3] Descargando calibrar_token.py...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -fsSL "${calibratorScriptUrl}" -o "calibrar_token.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${calibratorScriptUrl}' -OutFile 'calibrar_token.py' -UseBasicParsing } catch { }"
)

echo [3/3] Verificando items_db.json...
if not exist "items_db.json" (
    where curl >nul 2>&1
    if %errorlevel% equ 0 (
        curl -fsSL "${itemsDbDownloadUrl}" -o "items_db.json"
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${itemsDbDownloadUrl}' -OutFile 'items_db.json' -UseBasicParsing } catch { Write-Host $_.Exception.Message }"
    )
)

echo.
echo ===================================================================
echo  Selecciona una opcion:
echo ===================================================================
echo  [1] Iniciar Sniffer de Mercadillo
echo  [2] Calibrar Token
echo  [3] Salir
echo ===================================================================
set /p opt="Opcion [1-3] (Presiona ENTER para Iniciar Sniffer): "
if "%opt%"=="" set opt=1
if "%opt%"=="1" goto :run_sniffer
if "%opt%"=="2" goto :run_calibrator
if "%opt%"=="3" goto :fin
goto :run_sniffer

:run_sniffer
echo.
echo ===================================================================
echo  Iniciando Sniffer de Mercadillo...
echo ===================================================================
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 -u dofus_sniffer.py --server "${activeServerTarget}"
    goto :fin
)
where python >nul 2>&1
if %errorlevel% equ 0 (
    python -u dofus_sniffer.py --server "${activeServerTarget}"
    goto :fin
)
where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 -u dofus_sniffer.py --server "${activeServerTarget}"
    goto :fin
)
goto :no_python

:run_calibrator
echo.
echo ===================================================================
echo  Iniciando Calibrador de Token...
echo ===================================================================
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 -u calibrar_token.py
    goto :fin
)
where python >nul 2>&1
if %errorlevel% equ 0 (
    python -u calibrar_token.py
    goto :fin
)
where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 -u calibrar_token.py
    goto :fin
)
goto :no_python

:no_python
echo.
echo ===================================================================
echo  [ERROR] No se ha detectado Python en tu sistema.
echo ===================================================================
echo  1. Descarga Python gratis desde: https://www.python.org/downloads/
echo  2. IMPORTANTE: En el instalador marca la casilla:
echo     [X] "Add Python to PATH"
echo ===================================================================
goto :fin

:error
echo.
echo ===================================================================
echo  El proceso se detuvo por un error de descarga.
echo ===================================================================

:fin
echo.
echo ===================================================================
echo  Proceso finalizado.
echo ===================================================================
pause
`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(updateApiUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyScript = async () => {
    try {
      const resp = await fetch(`/api/market/sniffer-script?server=${encodeURIComponent(activeServerTarget)}`);
      if (resp.ok) {
        const text = await resp.text();
        navigator.clipboard.writeText(text);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
        return;
      }
    } catch {
      // fallback
    }
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyBat = () => {
    const crlfBat = batContent.replace(/\r?\n/g, '\r\n');
    navigator.clipboard.writeText(crlfBat);
    setCopiedBat(true);
    setTimeout(() => setCopiedBat(false), 2000);
  };

  const handleDownloadScript = async () => {
    try {
      const resp = await fetch(`/api/market/sniffer-script?server=${encodeURIComponent(activeServerTarget)}`);
      if (resp.ok) {
        const text = await resp.text();
        const blob = new Blob([text], { type: 'text/x-python;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dofus_sniffer_${activeServerTarget.toLowerCase().replace(/[^a-z0-9]/g, '_')}.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // fallback
    }
    const blob = new Blob([pythonScript], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dofus_sniffer_${activeServerTarget.toLowerCase().replace(/[^a-z0-9]/g, '_')}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadItemsDb = async () => {
    try {
      const resp = await fetch('/api/market/download-items-db');
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'items_db.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Items DB download error:", e);
    }
  };

  const handleDownloadCalibrator = async () => {
    try {
      const resp = await fetch('/api/market/calibrator-script');
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const text = await resp.text();
      const blob = new Blob([text], { type: 'text/x-python;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'calibrar_token.py';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadSuccessToast('Descarga completada: calibrar_token.py');
      setTimeout(() => setDownloadSuccessToast(null), 4000);
    } catch (e) {
      console.error("Error al descargar calibrador:", e);
    }
  };

  const handleDownloadBat = async () => {
    try {
      const filename = `sincronizar_mercadillo_${activeServerTarget.toLowerCase().replace(/[^a-z0-9]/g, '_')}.bat`;
      let content = batContent;
      try {
        const resp = await fetch(`/api/market/download-bat?server=${encodeURIComponent(activeServerTarget)}`);
        if (resp.ok) {
          content = await resp.text();
        }
      } catch (e) {
        // Fallback a batContent
      }
      const crlfBat = content.replace(/\r?\n/g, '\r\n');
      const blob = new Blob([crlfBat], { type: 'application/x-bat;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccessToast(
        `Descarga completada: ${filename} (incluye Sniffer + Calibrador).`
      );
      setTimeout(() => setDownloadSuccessToast(null), 5000);
    } catch (e) {
      console.error("Error al descargar BAT:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Sincronización Automática de Mercadillo (Sniffer)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  Turso / LibSQL Ready
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Envía precios automáticamente a tu base de datos mientras recorres el juego.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Selector Bar */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-slate-300">Servidor de sincronización:</span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            {!isCustomServer ? (
              <div className="relative flex-1">
                <select
                  value={selectedServer}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomServer(true);
                    } else {
                      setSelectedServer(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 appearance-none pr-8 cursor-pointer"
                >
                  {PRESET_SERVERS.map((srv) => (
                    <option key={srv.name} value={srv.name}>
                      {srv.name} ({srv.category})
                    </option>
                  ))}
                  <option value="__custom__">+ Otro servidor (Escribir nombre)...</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={selectedServer}
                  onChange={(e) => setSelectedServer(e.target.value)}
                  placeholder="Nombre de servidor..."
                  className="flex-1 bg-slate-900 border border-amber-500 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCustomServer(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Lista
                </button>
              </div>
            )}

            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 shrink-0">
              {activeServerTarget}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-950/30 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'instructions'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Guía y Requisitos
          </button>
          <button
            onClick={() => setActiveTab('bat')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'bat'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            Lanzador Windows (.BAT)
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Script Python (.PY)
          </button>
        </div>

        {/* Download Toast Notification */}
        {downloadSuccessToast && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccessToast}</span>
            </div>
            <button
              onClick={() => setDownloadSuccessToast(null)}
              className="text-slate-400 hover:text-white ml-3"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-300 text-xs sm:text-sm">
          {activeTab === 'instructions' && (
            <div className="space-y-5">
              {/* Endpoint Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-amber-400" /> Endpoint de Actualización (Turso DB)
                  </span>
                  <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Servidor: {activeServerTarget}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={updateApiUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? '¡Copiado!' : 'Copiar URL'}
                  </button>
                  <button
                    onClick={handleDownloadItemsDb}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-500/20"
                    title="Descargar base de nombres de objetos (items_db.json)"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    items_db.json
                  </button>
                </div>
              </div>

              {/* Requirement Cards */}
              <div className="bg-slate-950 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 text-amber-400">
                  <ShieldCheck className="w-4 h-4" /> Requisitos iniciales (Solo 1 vez)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-white block">1. Python en tu PC</span>
                    <p className="text-slate-400 text-[11px]">
                      Descarga Python desde <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5">python.org <ExternalLink className="w-2.5 h-2.5" /></a> asegurándote de marcar la casilla <em>"Add Python to PATH"</em> en el instalador.
                    </p>
                    <p className="text-emerald-400 text-[11px] font-semibold">
                      Las dependencias (scapy, requests) se instalan automáticamente.
                    </p>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-white block">2. Controlador Npcap (Requerido en Windows)</span>
                    <p className="text-slate-400 text-[11px]">
                      Permite capturar los paquetes de red de Dofus Unity en tiempo real.
                    </p>
                    <a
                      href="https://npcap.com/#download"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs hover:underline mt-1"
                    >
                      Descargar Npcap (npcap.com) <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Step by step download card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Descargar para servidor: <span className="text-amber-400">{activeServerTarget}</span>
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleDownloadScript}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-md shadow-amber-500/20"
                    >
                      <Download className="w-3.5 h-3.5" /> dofus_sniffer.py
                    </button>
                    <button
                      onClick={handleDownloadCalibrator}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-indigo-500/40 shadow-sm"
                      title="Descargar script de calibración rápida de token"
                    >
                      <Download className="w-3.5 h-3.5" /> calibrar_token.py
                    </button>
                    <button
                      onClick={handleDownloadBat}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar .bat (Todo en Uno)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      Opción 1: Lanzador .BAT Todo en Uno (Recomendado)
                    </span>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                      <li>Descarga el archivo <strong>.bat</strong> y haz doble clic.</li>
                      <li>Descarga automáticamente <strong>dofus_sniffer.py</strong> y <strong>calibrar_token.py</strong>.</li>
                      <li>Te muestra un menú: presiona <strong>1</strong> para sincronizar o <strong>2</strong> para calibrar el token si Ankama actualizó el juego el martes.</li>
                    </ol>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      ¿Qué pasa cuando Ankama rota tokens (Mantenimiento semanal)?
                    </span>
                    <p className="text-xs text-slate-400">
                      El sniffer usa <strong className="text-white">keymap.json</strong> local. Si Ankama cambia el token de red, ejecuta la opción <strong>[2] Calibrar Token</strong> en el .bat o abre <strong className="text-white">calibrar_token.py</strong>. Haz clic en un recurso en el juego y se guardará el nuevo token automáticamente sin reinstalar nada.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bat' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" /> Lanzador Windows (.BAT) &mdash; {activeServerTarget}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ejecución directa en Windows. Configurado para sincronizar con {activeServerTarget}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyBat}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    {copiedBat ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedBat ? '¡Código Copiado!' : 'Copiar Código .BAT'}
                  </button>
                  <button
                    onClick={handleDownloadBat}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar .BAT
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[360px] select-all leading-relaxed">
                {batContent}
              </pre>
            </div>
          )}

          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" /> Código Fuente Python (dofus_sniffer.py) &mdash; {activeServerTarget}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Motor principal de captura en vivo, decodificación Protobuf y envío HTTP asíncrono a Turso.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyScript}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? '¡Código Copiado!' : 'Copiar Código .py'}
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar .py
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[380px] select-all leading-relaxed">
                {pythonScript}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>Servidor seleccionado: <strong className="text-amber-400">{activeServerTarget}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
