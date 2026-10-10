# -*- coding: utf-8 -*-
"""
sniffers/bundle_sniffer.py
Captura unificada multi-flujo (Todo-en-Uno) con concurrencia cruzada.
"""
import os
import sys
import time
import json
import datetime
import threading
from collections import defaultdict
from scapy.all import sniff, TCP, Raw, IP

from core.config import (
    init_session_log,
    log_sniffer_event,
    load_keymap,
    INVENTORY_OUTPUT,
    SALES_OUTPUT,
    ACTIVE_LISTINGS_OUTPUT,
    QUOTATIONS_OUTPUT,
)
from core.items_db import (
    load_items_dictionary,
    get_item_name,
    load_item_categories,
    classify_batch_market,
    is_valid_market_item,
    is_valid_market_ladder,
)
from core.protobuf_decoder import (
    decode_varint,
    clean_ladder,
    extract_items_recursive,
)
from sniffers.market_sniffer import (
    extract_market_universal,
    calculate_quick_price,
    save_captured_quotation,
    _decode_quotation_payload,
)
from sniffers.sales_sniffer import (
    extract_sales_entries,
)
from sniffers.listings_sniffer import (
    extract_active_listings,
)
from exporters.html_viewer import (
    open_storage_viewer,
    open_sales_viewer,
)

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
    inv_token = km.get("inventory", "irl")
    storage_token = km.get("storage", "irl")
    quotation_token = km.get("quotations", "ire")
    target_bytes_market = f"type.ankama.com/{market_token}".encode("ascii")
    target_bytes_sales = f"type.ankama.com/{sales_token}".encode("ascii")
    target_bytes_active = f"type.ankama.com/{active_token}".encode("ascii")
    target_bytes_inv = f"type.ankama.com/{inv_token}".encode("ascii")
    target_bytes_storage = f"type.ankama.com/{storage_token}".encode("ascii")
    target_bytes_quotation = f"type.ankama.com/{quotation_token}".encode("ascii") if quotation_token != "No calibrado" else None
    server_slug = os.environ.get("DOFUS_SERVER", "draconiros").strip().lower()

    print("\n" + "=" * 70)
    print("  [SNIFFER SESION COMPLETA] CAPTURA UNIFICADA EN TIEMPO REAL")
    print("=" * 70)
    print("  Tokens Activos en Paralelo:")
    print(f"    * Mercadillo (price_list)    : '{market_token}' -> Envio directo a DBHDV")
    print(f"    * Cotizaciones (sales_volume): '{quotation_token}' (Peticion: 'iqp') -> Envio directo a DBHDV y cotizaciones_capturadas.json")
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
                with urllib.request.urlopen(req, timeout=10.0) as resp:
                    if resp.status == 200:
                        market_sent_count += 1
                    else:
                        log_sniffer_event("ERROR_HTTP_MARKET", f"API retorno status {resp.status}")
            except Exception as e:
                log_sniffer_event("ERROR_HTTP_MARKET", f"Fallo al enviar mercadillo a la API: {e}")
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

        global LAST_MARKET_ITEM_ID
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 4:
            return

        # Peticiones salientes cliente -> servidor (iqp)
        if packet[TCP].dport == 5555:
            if b"type.ankama.com/iqp" in payload:
                req_id = parse_quotation_request(payload)
                if req_id > 0:
                    LAST_MARKET_ITEM_ID = req_id
                    log_sniffer_event("COTIZACION_PETICION", f"Peticion cliente de cotizacion para {get_item_name(req_id)} (#{req_id})", payload=payload)
            return

        if packet[TCP].sport != 5555:
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
        is_quotation_hdr = (
            (target_bytes_quotation and target_bytes_quotation in payload) or
            b"type.ankama.com/ire" in payload or
            b"type.ankama.com/iuk" in payload or
            b"type.ankama.com/ive" in payload
        )
        is_storage_hdr = (not (is_listings_hdr or is_sales_hdr or is_market_hdr or is_quotation_hdr)) and (
            target_bytes_inv in payload or target_bytes_storage in payload or
            b"type.ankama.com/irl" in payload or
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
                    payload_dict["prices"] = lad_dict
                    payload_dict["precios"] = lad_dict
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
                for cand in (target_bytes_inv, target_bytes_storage, b"type.ankama.com/irl", b"type.ankama.com/isb", b"type.ankama.com/hlp"):
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

        # 5. Cotizaciones de Mercado (type.ankama.com/ire, iuk o ive)
        quote_tok = km.get("quotations", "ire")
        target_quote_hdr = f"type.ankama.com/{quote_tok}".encode("ascii") if quote_tok != "No calibrado" else None
        has_quotation = (
            (target_quote_hdr and target_quote_hdr in payload) or
            b"type.ankama.com/ire" in payload or
            b"type.ankama.com/iuk" in payload or
            b"type.ankama.com/ive" in payload
        )
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
                    found_hdr = None
                    if target_quote_hdr and target_quote_hdr in payload:
                        found_hdr = target_quote_hdr
                    elif b"type.ankama.com/ire" in payload:
                        found_hdr = b"type.ankama.com/ire"
                    elif b"type.ankama.com/iuk" in payload:
                        found_hdr = b"type.ankama.com/iuk"
                    else:
                        found_hdr = b"type.ankama.com/ive"
                    idx = payload.find(found_hdr)
                    buf = payload[idx:] if idx != -1 else b""

                found_hdr = None
                if target_quote_hdr and target_quote_hdr in buf:
                    found_hdr = target_quote_hdr
                elif b"type.ankama.com/ire" in buf:
                    found_hdr = b"type.ankama.com/ire"
                elif b"type.ankama.com/iuk" in buf:
                    found_hdr = b"type.ankama.com/iuk"
                elif b"type.ankama.com/ive" in buf:
                    found_hdr = b"type.ankama.com/ive"
                target_hdr = found_hdr
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


