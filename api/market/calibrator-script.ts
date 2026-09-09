export default function handler(req: any, res: any) {
  const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY -> CALIBRADOR GUIADO DE TOKEN DE MERCADILLO
===============================================================================
  Herramienta de diagnostico y auto-calibracion de tokens para Dofus Unity.
  Te pide el objeto objetivo (por defecto Cristal liquido o Cristal plegable),
  espera el clic exacto en ese objeto, muestra los precios reales,
  guarda keymap.json y SE CIERRA INMEDIATAMENTE para evitar sobrescrituras.
===============================================================================
"""

import sys
import os
import json
import re
import urllib.request
import urllib.parse

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from scapy.all import sniff, TCP, Raw
except ImportError:
    print("[Error] Se requiere scapy. Ejecuta: pip install scapy")
    input("\\nPresiona Enter para salir...")
    sys.exit(1)

PRESETS = {
    "1": ("Cristal liquido", 23902),
    "2": ("Cristal plegable", 23903),
    "3": ("Trigo", 289),
    "4": ("Hierro", 311),
}

def get_item_name_from_api(item_id):
    try:
        url = f"https://api.dofusdb.fr/items/{item_id}?$select[]=name"
        req = urllib.request.Request(url, headers={"User-Agent": "DofusSniffer/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            d = json.loads(resp.read().decode("utf-8"))
            return (
                d.get("name", {}).get("es")
                or d.get("name", {}).get("fr")
                or d.get("name", {}).get("en")
            )
    except Exception:
        return None

def resolve_target_item():
    print("=" * 70)
    print("  CALIBRADOR DE TOKEN DE MERCADILLO (Dofus Unity)")
    print("=" * 70)
    print("Selecciona el recurso con el que calibraras para evitar falsos positivos:")
    print("  [1] Cristal liquido (ID: 23902)  <- Recomendado")
    print("  [2] Cristal plegable (ID: 23903)")
    print("  [3] Trigo (ID: 289)")
    print("  [4] Hierro (ID: 311)")
    print("  [O escribe directamente el ID o nombre de cualquier otro recurso]")
    print("-" * 70)

    try:
        choice = input("Opcion [1-4 o ID] (Presiona Enter para 'Cristal liquido'): ").strip()
    except (EOFError, KeyboardInterrupt):
        choice = "1"

    if not choice or choice == "1":
        return PRESETS["1"]
    if choice in PRESETS:
        return PRESETS[choice]

    if choice.isdigit():
        target_id = int(choice)
        name = get_item_name_from_api(target_id) or f"Objeto #{target_id}"
        return (name, target_id)

    print(f"Buscando '{choice}' en la base de datos de Dofus...")
    try:
        query = urllib.parse.quote(choice)
        url = f"https://api.dofusdb.fr/items?$select[]=id&$select[]=name&name.es[$regex]={query}&$limit=1"
        req = urllib.request.Request(url, headers={"User-Agent": "DofusSniffer/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            items = data.get("data", [])
            if items:
                it = items[0]
                n = it.get("name", {}).get("es") or choice
                return (n, it["id"])
    except Exception:
        pass

    print("No se encontro, usando Cristal liquido por defecto.")
    return PRESETS["1"]

TARGET_NAME, TARGET_ID = resolve_target_item()

print("\\n" + "=" * 70)
print(f"  OBJETIVO FIJADO: '{TARGET_NAME}' (ID: {TARGET_ID})")
print(f"  ACCION: Abre el mercadillo en Dofus Unity y HAZ CLIC EN '{TARGET_NAME}'.")
print("   (El script esperara pacientemente y solo respondera a este objeto)")
print("=" * 70 + "\\n")

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

def is_item_equipment(item_id):
    return item_id in (2469, 2425)

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
                    if fnum in (1, 2) and (10 <= v <= 100000):
                        item_id = v
                    elif fnum == 5 and (10 <= v <= 100000) and item_id == 0:
                        item_id = v

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
                    if depth < 3:
                        walk(data, depth + 1)
                else:
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

    if len(cl) > 1 and 1 <= cl[0] <= 10 and len(cl) == cl[0] + 1:
        return cl[1:]

    if len(cl) == 5 and cl[0] <= 100:
        if cl[0] <= 20 or (cl[1] > 0 and cl[2] >= cl[1]):
            return cl[1:]

    if len(cl) > 1 and 1 <= cl[0] <= 10 and cl[1] >= 20:
        return cl[1:]

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

    valid_ladders = []
    for fnum, pl in ladders:
        cl = clean_ladder(pl)
        non_zero = [p for p in cl if p > 0]
        if len(non_zero) == 1 and non_zero[0] <= 10:
            continue
        if any(p > 0 for p in cl):
            valid_ladders.append((fnum, cl))

    is_multi_gear_offers = len(valid_ladders) >= 2

    if is_known_equip or is_multi_gear_offers:
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

    if valid_ladders:
        return "recurso", valid_ladders[0][1]

    return "desconocido", []

def process_pkt(pkt):
    if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
        return

    if pkt[TCP].sport != 5555:
        return

    payload = bytes(pkt[Raw].load)
    matches = list(re.finditer(rb"type\\.ankama\\.com/([a-zA-Z0-9]{3})", payload))
    if not matches:
        return

    for m in matches:
        token = m.group(1).decode('ascii')
        token_end = m.end()

        off_12 = payload.find(bytes([0x12]), token_end, token_end + 15)
        if off_12 == -1:
            msg_bytes = payload[token_end:]
        else:
            msg_len, r = decode_varint(payload, off_12 + 1)
            msg_bytes = payload[off_12 + 1 + r : off_12 + 1 + r + msg_len]

        item_id, ladders, offer_prices = extract_market_universal(msg_bytes)

        if item_id != TARGET_ID:
            continue

        item_type, prices = process_ladders(ladders, offer_prices, item_id)
        if not prices:
            continue

        print("\\n" + "=" * 70)
        print("  PAQUETE DEL OBJETIVO IDENTIFICADO!")
        print(f"  Token detectado    : '{token}'")
        print(f"  Objeto             : {TARGET_NAME} (ID: {TARGET_ID})")
        print(f"  Tipo               : {item_type.upper()}")

        if item_type == "recurso":
            p1 = f"{prices[0]:,} k" if len(prices) > 0 else "0 k"
            p10 = f"{prices[1]:,} k" if len(prices) > 1 else "0 k"
            p100 = f"{prices[2]:,} k" if len(prices) > 2 else "0 k"
            p1000 = f"{prices[3]:,} k" if len(prices) > 3 else "0 k"
            print(f"  Escalera de precios: x1 = {p1} | x10 = {p10} | x100 = {p100} | x1000 = {p1000}")
        else:
            formatted = [f"{p:,} k" for p in prices[:6]]
            print(f"  Precios de venta   : {', '.join(formatted)}")

        print("=" * 70)
        print(f"  TOKEN OFICIAL VERIFICADO!: '{token}'")

        keymap_data = {
            "price_list": token,
            "_comentario": f"Calibrado con {TARGET_NAME} (ID {TARGET_ID})"
        }
        try:
            with open("keymap.json", "w", encoding="utf-8") as f:
                json.dump(keymap_data, f, indent=2)
            print("  Archivo 'keymap.json' creado y fijado exitosamente.")
        except Exception as e:
            print(f"Error guardando keymap.json: {e}")

        print("\\n  CALIBRACION COMPLETADA AL 100%!")
        print("Ya puedes arrancar tu sniffer principal con la opcion 1 del archivo .bat")
        print("=" * 70)

        os._exit(0)

print(f"  Escuchando trafico del juego... Haz clic en '{TARGET_NAME}' en el mercadillo...")
sniff(filter="tcp port 5555", prn=process_pkt, store=False)
`;

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=calibrar_token.py`,
  );
  res.setHeader("Content-Type", "text/x-python; charset=utf-8");
  res.status(200).send(scriptContent);
}
