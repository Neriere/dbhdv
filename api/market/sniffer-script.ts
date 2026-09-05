export default function handler(req: any, res: any) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-ssl"] === "on" ? "https" : "https");
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.headers["host"] ||
    "dbhdv.vercel.app";
  const baseUrl = `${proto}://${host}`;
  const batchApiUrl = `${baseUrl}/api/market/batch-update`;
  const updateApiUrl = `${baseUrl}/api/market/update`;
  const dictUrl = `${baseUrl}/api/market/items-dictionary`;
  const server = (req.query.server as string) || "Draconiros";
  const secretKey = (process.env.MARKET_SNIFFER_SECRET || "").trim();

  const scriptContent = `#!/usr/bin/env python3
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
import time
import json
import queue
import argparse
import threading
import traceback
import subprocess
import urllib.request
from datetime import datetime

# 0. FORZAR UTF-8 EN CONSOLA DE WINDOWS (evita texto ilegible con tildes/ñ)
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 1. AUTO-ELEVACION ADMINISTRADOR EN WINDOWS
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
        print("[UAC] Solicitando permisos de Administrador a Windows para captura de paquetes...")
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

# 2. AUTO-INSTALACION DE DEPENDENCIAS (requests, scapy)
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
        print("=" * 70)
        print(f" [INSTALADOR] Instalando librerias necesarias: {', '.join(packages)}")
        print("=" * 70)
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", *packages])
            print("[OK] Librerias instaladas con exito.\\n")
        except Exception as e:
            print(f"[ERROR PIP] No se pudieron instalar dependencias automaticamente: {e}")
            print(f"Ejecuta en tu consola: pip install {' '.join(packages)}")
            input("\\nPresiona Enter para salir...")
            sys.exit(1)

ensure_dependencies()

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
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

# Argumentos de línea de comandos para permitir cambiar el servidor dinámicamente
parser = argparse.ArgumentParser(description="Dofus Unity Market Sniffer")
parser.add_argument("--server", type=str, default="${server}", help="Nombre del servidor Dofus")
cli_args, _ = parser.parse_known_args()

# ==================== CONFIGURACIÓN ====================
API_BATCH_URL = "${batchApiUrl}"
API_UPDATE_URL = "${updateApiUrl}"
API_DICT_URL = "${dictUrl}"
API_SECRET_KEY = "${secretKey}"
SERVER_NAME = (cli_args.server or "${server}").strip()
DOFUS_PORTS = "tcp port 5555"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
LOCAL_DB_FILE = os.path.join(SCRIPT_DIR, "items_db.json")
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

def load_or_download_items_db(force=False):
    global ITEMS_DB
    ITEMS_DB = dict(DEFAULT_RUNES_DB)
    need_download = force or not os.path.exists(LOCAL_DB_FILE) or os.path.getsize(LOCAL_DB_FILE) < 100
    if not need_download:
        try:
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            # Detectar si el archivo local está desactualizado o corrupto
            if len(loaded) < 10800 or loaded.get("7436") != "Runa Pot" or loaded.get("1525") != "Runa Sue":
                need_download = True
            else:
                ITEMS_DB.update(loaded)
                print(f"[DB Local] Cargados {len(ITEMS_DB):,} nombres de objetos desde items_db.json")
                return
        except Exception as e:
            need_download = True

    print(f"[DB Local] Descargando base de nombres actualizada desde el servidor ({API_DICT_URL})...")
    try:
        r = http_session.get(API_DICT_URL, timeout=15.0)
        if r.status_code == 200:
            downloaded = r.json()
            ITEMS_DB.update(downloaded)
            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(ITEMS_DB, f, ensure_ascii=False)
            print(f"[DB Local] OK Base de datos guardada ({len(ITEMS_DB):,} objetos listos en memoria).")
        else:
            print(f"[DB Local] Error HTTP {r.status_code} al descargar base de items.")
    except Exception as e:
        print(f"[DB Local] Advertencia de descarga: {e}. Se usarán las runas y base en memoria.")

def get_item_name(item_id):
    if not item_id:
        return "Objeto"
    s_id = str(item_id)
    if s_id in ITEMS_DB:
        return ITEMS_DB[s_id]
    if item_id in ITEMS_DB:
        return ITEMS_DB[item_id]
    if s_id in DEFAULT_RUNES_DB:
        return DEFAULT_RUNES_DB[s_id]
    # Auto-resolución en vivo desde DofusDB para cualquier objeto no catalogado
    try:
        r = http_session.get(f"https://api.dofusdb.fr/items/{item_id}?lang=es", timeout=2.0)
        if r.status_code == 200:
            data = r.json()
            n = data.get("name")
            name_val = n.get("es") or n.get("fr") or n.get("en") if isinstance(n, dict) else (n if isinstance(n, str) else "")
            if name_val and name_val.strip():
                clean_n = name_val.strip()
                ITEMS_DB[s_id] = clean_n
                try:
                    with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                        json.dump(ITEMS_DB, f, ensure_ascii=False)
                except Exception:
                    pass
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

def parse_kbt(buf):
    """Extrae ItemID y precios del paquete Protobuf kbt de Dofus Unity con detección dinámica de offset"""
    try:
        idx = buf.find(b"kbt")
        if idx == -1:
            return None, []

        off_12 = buf.find(b"\\x12", idx, idx + 20)
        if off_12 == -1:
            return None, []

        off = off_12 + 1
        if off >= len(buf):
            return None, []

        payload_len, br = decode_varint(buf, off)
        off += br
        payload = buf[off:off + payload_len]

        p_off = 0
        item_id = 0
        prices = []

        while p_off < len(payload):
            tag = payload[p_off]
            p_off += 1
            field = tag >> 3
            wire = tag & 7

            if wire == 0:
                val, br = decode_varint(payload, p_off)
                p_off += br
                if field == 2:
                    item_id = val
            elif wire == 2:
                sub_len, br = decode_varint(payload, p_off)
                p_off += br
                sub = payload[p_off:p_off + sub_len]
                p_off += sub_len

                s_off = 0
                while s_off < len(sub):
                    s_tag = sub[s_off]
                    s_off += 1
                    s_field = s_tag >> 3
                    s_wire = s_tag & 7
                    if s_wire == 0:
                        s_val, s_br = decode_varint(sub, s_off)
                        s_off += s_br
                        if s_field in (2, 5):
                            item_id = s_val
                    elif s_wire == 2:
                        in_len, s_br = decode_varint(sub, s_off)
                        s_off += s_br
                        inner = sub[s_off:s_off + in_len]
                        s_off += in_len
                        if s_field == 6:
                            i_off = 0
                            while i_off < len(inner):
                                pv, pbr = decode_varint(inner, i_off)
                                i_off += pbr
                                if pv > 0:
                                    prices.append(pv)
                    else:
                        break
        return item_id, prices
    except Exception:
        pass
    return None, []

def async_worker():
    """Hilo en segundo plano: envía los precios por lotes sin frenar el sniffer"""
    headers = {"Content-Type": "application/json"}
    if API_SECRET_KEY:
        headers["x-api-key"] = API_SECRET_KEY

    while True:
        items_batch = []
        try:
            first_item = packet_queue.get(timeout=1.0)
            items_batch.append(first_item)
            packet_queue.task_done()

            start_collect = time.time()
            while len(items_batch) < 35 and (time.time() - start_collect) < 0.08:
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

        try:
            if len(items_batch) == 1:
                item = items_batch[0]
                res = http_session.post(API_UPDATE_URL, json=item, headers=headers, timeout=5.0)
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
                    print(f"[{now_str}]  [{item['type'].upper()}] {item['item_name']} (#{item['item_id']}) -> {c_price:,} k (Guardado{extra})")
                else:
                    print(f"[{now_str}]  Error {res.status_code}: {res.text}")
            else:
                res = http_session.post(API_BATCH_URL, json={"items": items_batch}, headers=headers, timeout=8.0)
                if res.status_code == 200:
                    data = res.json()
                    tot = data.get("total_processed", len(items_batch))
                    print(f"[{now_str}]  [LOTE PROCESADO] {tot} objetos sincronizados con Turso")
                else:
                    print(f"[{now_str}]  Error de lote {res.status_code}: {res.text}")
        except requests.exceptions.RequestException as req_err:
            try:
                time.sleep(0.3)
                if len(items_batch) == 1:
                    http_session.post(API_UPDATE_URL, json=items_batch[0], headers=headers, timeout=6.0)
                else:
                    http_session.post(API_BATCH_URL, json={"items": items_batch}, headers=headers, timeout=10.0)
            except Exception:
                pass
        except Exception as e:
            print(f"[{now_str}] [Aviso]: {e}")

def process_packet(pkt):
    if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
        return
    payload = bytes(pkt[Raw].load)

    if b"kbt" in payload or b"type.ankama.com/kbt" in payload:
        item_id, prices = parse_kbt(payload)
        if item_id and prices:
            name = get_item_name(item_id)
            is_equipment = len(prices) > 4

            body = {
                "item_id": item_id,
                "item_name": name,
                "type": "equipable" if is_equipment else "recurso",
                "server": SERVER_NAME,
                "source": "sniffer",
            }

            if is_equipment:
                body["precios"] = prices
            else:
                body["precios"] = {
                    "1": prices[0] if len(prices) > 0 else 0,
                    "10": prices[1] if len(prices) > 1 else 0,
                    "100": prices[2] if len(prices) > 2 else 0,
                    "1000": prices[3] if len(prices) > 3 else 0,
                }

            try:
                packet_queue.put_nowait(body)
            except queue.Full:
                pass

def main():
    print("=" * 70)
    print("      DOFUS UNITY -> MERCADILLO LIVE SNIFFER (ULTRA-RAPIDO)")
    print(f"  Servidor Destino : {SERVER_NAME}")
    print(f"  Base de Datos    : Turso / LibSQL Cloud")
    print("=" * 70)

    load_or_download_items_db()

    worker_thread = threading.Thread(target=async_worker, daemon=True)
    worker_thread.start()

    print("\\n Escuchando paquetes en tiempo real...")
    print("Abre el mercadillo en Dofus Unity e inspecciona los objetos.")
    print("Presiona Ctrl+C para salir.\\n")

    try:
        sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
    except KeyboardInterrupt:
        print("\\n\\nSincronizador detenido por el usuario.")
    except Exception as e:
        print(f"\\n[Error Sniffer]: {e}")
        traceback.print_exc()
        input("\\nPresiona Enter para cerrar...")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\\n[ERROR CRITICO NO CONTROLADO]: {e}")
        traceback.print_exc()
        input("\\nPresiona Enter para cerrar...")
`;

  res.setHeader("Content-Disposition", "attachment; filename=dofus_sniffer.py");
  res.setHeader("Content-Type", "text/x-python; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  res.status(200).send(scriptContent);
}
