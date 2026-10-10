# -*- coding: utf-8 -*-
"""
sniffers/sales_sniffer.py
Captura de historial de transacciones y ventas finalizadas.
"""
import os
import sys
import time
import json
import threading
from scapy.all import sniff, TCP, Raw, IP

from core.config import (
    SALES_OUTPUT,
    log_sniffer_event,
    load_keymap,
)
from core.items_db import (
    load_items_dictionary,
    get_item_name,
)
from core.protobuf_decoder import (
    decode_varint,
)
from exporters.html_viewer import (
    open_sales_viewer,
)

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
                        print(f"\n  ✅ Guardado exitosamente en: data/historial_ventas_capturado.json")
                        print("  (Dashboard disponible en la opción [6] del menú)")
                    except Exception as e:
                        print(f"  [Error guardando]: {e}")

                    print("\nContinuando escucha en segundo plano (CTRL+C para salir al menú)...")
    except KeyboardInterrupt:
        print("\n[Deteniendo sniffer de historial...]")
    finally:
        if sniffer.running:
            sniffer.stop()

