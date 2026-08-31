#!/usr/bin/env python3
"""
===============================================================================
  DOFUS UNITY -> MERCADILLO LIVE SYNC (AUTOMATIC PACKET SNIFFER)
===============================================================================
  Escucha en segundo plano los paquetes del mercadillo (HDV) en Dofus Unity,
  calcula las medias unitarias (lotes para recursos, filtro de sobremagueo
  para equipables) y envía las actualizaciones directamente a tu servidor Turso/Vercel.

  Instalación de dependencias requeridas en tu PC:
    pip install scapy requests

  Ejecución (en Windows abrir terminal como Administrador):
    python scripts/sniffer_standalone.py
===============================================================================
"""

import sys
import os
import requests
from datetime import datetime

try:
    from scapy.all import sniff, TCP, Raw
except ImportError:
    print("[ERROR] Falta la librería 'scapy'. Instálala ejecutando: pip install scapy requests")
    sys.exit(1)

# ==================== CONFIGURACIÓN ====================
# Cambia esta URL por la de tu proyecto desplegado en Vercel (o localhost si lo pruebas en tu PC)
# Ejemplo: "https://tu-proyecto.vercel.app/api/market/update"
VERCEL_API_URL = os.environ.get("VERCEL_API_URL", "http://localhost:3000/api/market/update")

# Clave secreta configurada en tu Vercel (MARKET_SNIFFER_SECRET). Si no pusiste clave, déjalo vacío ""
API_SECRET_KEY = os.environ.get("MARKET_SNIFFER_SECRET", "")

# Servidor de Dofus en el que juegas (Draconiros, Hell Mina, Tal Kasha, Kourial, Mikhal, Dakal, etc.)
SERVER_NAME = os.environ.get("DOFUS_SERVER_NAME", "Draconiros")

# Puerto estándar de conexión del juego Dofus Unity
DOFUS_PORTS = "tcp port 5555"
# =======================================================

NAME_CACHE = {}

def get_item_name(item_id):
    if item_id in NAME_CACHE:
        return NAME_CACHE[item_id]
    try:
        r = requests.get(f"https://api.dofusdb.fr/items/{item_id}?$select[]=name", timeout=2.0)
        if r.status_code == 200:
            data = r.json()
            name = (
                data.get("name", {}).get("es")
                or data.get("name", {}).get("fr")
                or data.get("name", {}).get("en")
                or f"Item #{item_id}"
            )
            NAME_CACHE[item_id] = name
            return name
    except Exception:
        pass
    return f"Item #{item_id}"

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
    """Extrae ItemID y precios del paquete Protobuf kbt de Dofus Unity"""
    try:
        idx = buf.find(b"type.ankama.com/kbt")
        if idx == -1:
            idx = buf.find(b"kbt")
            if idx == -1:
                return None, []
            idx = idx - 16

        off = idx + 19
        if off < len(buf) and buf[off] == 0x12:
            off += 1
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

            headers = {"Content-Type": "application/json"}
            if API_SECRET_KEY:
                headers["x-api-key"] = API_SECRET_KEY

            try:
                res = requests.post(VERCEL_API_URL, json=body, headers=headers, timeout=3.0)
                now_str = datetime.now().strftime("%H:%M:%S")
                if res.status_code == 200:
                    data = res.json()
                    calc_price = data.get("calculated_price", 0)
                    item_type = data.get("type", body["type"])
                    print(f"[{now_str}]  [{item_type.upper()}] {name} (#{item_id}) -> Guardado en Turso: {calc_price:,} k (Servidor: {SERVER_NAME})")
                else:
                    print(f"[{now_str}] [Error {res.status_code}] {res.text}")
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [Error de conexión con la API]: {e}")

if __name__ == "__main__":
    print("=" * 65)
    print("  DOFUS UNITY -> MERCADILLO AUTO-SYNC")
    print(f"  Destino API : {VERCEL_API_URL}")
    print(f"  Servidor    : {SERVER_NAME}")
    print("=" * 65)
    print("🟢 Escuchando mercadillo en segundo plano...")
    print("💡 Haz clic en los objetos del mercadillo en Dofus para actualizar precios.")
    sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
