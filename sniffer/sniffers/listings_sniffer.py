# -*- coding: utf-8 -*-
"""
sniffers/listings_sniffer.py
Captura de lotes actualmente puestos en venta en el mercadillo.
"""
import os
import sys
import time
import json
import threading
from collections import defaultdict
from scapy.all import sniff, TCP, Raw, IP

from core.config import (
    ACTIVE_LISTINGS_OUTPUT,
    log_sniffer_event,
    load_keymap,
)
from core.items_db import (
    load_items_dictionary,
    get_item_name,
    load_item_categories,
    classify_batch_market,
)
from core.protobuf_decoder import (
    decode_varint,
)

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

        # Detección estricta de inicio de ráfaga: presencia del token ket
        has_token = target_bytes in payload or b"type.ankama.com/ket" in payload
        if has_token:
            if not burst_active or (now - last_pkt_time > 2.0):
                burst_stream.clear()
                burst_active = True
                packet_count = 0
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now
        elif burst_active:
            # Paquetes TCP de continuación de la misma ráfaga
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


