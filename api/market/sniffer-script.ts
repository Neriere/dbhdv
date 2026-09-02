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

ITEMS_DB = {}
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
    need_download = force or not os.path.exists(LOCAL_DB_FILE) or os.path.getsize(LOCAL_DB_FILE) < 100
    if not need_download:
        try:
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                ITEMS_DB = json.load(f)
            if "1519" not in ITEMS_DB or "1522" not in ITEMS_DB or "15379" not in ITEMS_DB or "32194" not in ITEMS_DB:
                need_download = True
            else:
                print(f"[DB Local] Cargados {len(ITEMS_DB):,} nombres de objetos desde items_db.json")
                return
        except Exception as e:
            need_download = True

    print(f"[DB Local] Descargando base de nombres actualizada desde el servidor ({API_DICT_URL})...")
    try:
        r = http_session.get(API_DICT_URL, timeout=15.0)
        if r.status_code == 200:
            ITEMS_DB = r.json()
            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(ITEMS_DB, f, ensure_ascii=False)
            print(f"[DB Local] OK Base de datos guardada ({len(ITEMS_DB):,} objetos listos en memoria).")
        else:
            print(f"[DB Local] Error HTTP {r.status_code} al descargar base de items.")
    except Exception as e:
        print(f"[DB Local] Advertencia de descarga: {e}. Se usarán identificadores numéricos.")

def get_item_name(item_id):
    s_id = str(item_id)
    if s_id in ITEMS_DB:
        return ITEMS_DB[s_id]
    if item_id in ITEMS_DB:
        return ITEMS_DB[item_id]
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
                    print(f"[{now_str}]  [{item['type'].upper()}] {item['item_name']} (#{item['item_id']}) -> {c_price:,} k (Guardado)")
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
