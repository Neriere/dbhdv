# -*- coding: utf-8 -*-
"""
test_sniffer_simulation.py
Simulador exhaustivo de tráfico de paquetes TCP para verificar la captura concurrente
de los 4 sniffers de Dofus Unity 3.6:
  1. Mercadillo (price_list - 'jzn')
  2. Cotizaciones (sales_volume - 'iuk')
  3. Almacén / Inventario / Banco (inventory/storage - 'isb' / 'hlp')
  4. Listings Activos en Venta (active_listings - 'ket')
  5. Historial de Ventas (sales_history - 'kyo')
"""
import os
import sys
import time
import json
import threading

sys.path.insert(0, os.path.dirname(__file__))

from dofus_suite import (
    load_items_dictionary,
    load_item_categories,
    decode_varint,
    extract_active_listings,
    extract_items_recursive,
    extract_sales_entries,
    parse_market_message,
    parse_quotation_message,
    extract_type_tokens,
    get_item_name
)

class MockLayer:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

class MockPacket:
    def __init__(self, payload, sport=5555, dport=12345, src="127.0.0.1", dst="127.0.0.1"):
        self.payload = payload
        self._layers = {
            "IP": MockLayer(src=src, dst=dst),
            "TCP": MockLayer(sport=sport, dport=dport),
            "Raw": MockLayer(load=payload)
        }
    def haslayer(self, layer_type):
        name = getattr(layer_type, "__name__", str(layer_type))
        return name in self._layers or str(layer_type) in self._layers
    def __getitem__(self, layer_type):
        name = getattr(layer_type, "__name__", str(layer_type))
        return self._layers.get(name) or self._layers.get(str(layer_type)) or self._layers["Raw"]


def run_full_simulation_test():
    print("=" * 70)
    print("  INICIANDO SIMULACIÓN DE PAQUETES DE DOFUS UNITY 3.6")
    print("=" * 70)

    load_items_dictionary()
    load_item_categories()

    # Cargar datos reales capturados
    bin_listings_path = os.path.join(os.path.dirname(__file__), "data", "debug_active_listings_raw.bin")
    bin_sales_path = os.path.join(os.path.dirname(__file__), "data", "raw_sales_stream.bin")

    with open(bin_listings_path, "rb") as f:
        raw_listings_data = f.read()

    with open(bin_sales_path, "rb") as f:
        raw_sales_data = f.read()

    # Hex real de Mercadillo y Cotización
    market_hex = "37 12 35 1A 33 0A 13 74 79 70 65 2E 61 6E 6B 61 6D 61 2E 63 6F 6D 2F 6A 7A 6E 12 1C 08 EC 13 12 14 10 EC 13 18 B7 01 28 AE 60 32 09 C2 26 8B FD 02 F8 F3 1D 00 18 B7 01"
    raw_market_packet = bytes.fromhex(market_hex)

    # 1. Test unitario de decodificación individual
    print("\n--- TEST 1: Validar decodificación directa de cada stream real ---")
    
    # Listings
    ket_idx = raw_listings_data.find(b"type.ankama.com/ket")
    listings_extracted = extract_active_listings(raw_listings_data[ket_idx:])
    print(f"  [OK] Listings ('ket') extraídos directamente: {len(listings_extracted)} lotes (Esperado: 44)")
    assert len(listings_extracted) == 44, f"Fallo: se esperaban 44 y se obtuvieron {len(listings_extracted)}"

    # Sales
    sales_extracted = extract_sales_entries(raw_sales_data)
    print(f"  [OK] Historial ('kyo') extraído directamente: {len(sales_extracted)} ventas (Esperado: 1000)")
    assert len(sales_extracted) == 1000, f"Fallo: se esperaban 1000 y se obtuvieron {len(sales_extracted)}"

    # Almacén / Inventario (isb)
    isb_idx = raw_listings_data.find(b"type.ankama.com/isb")
    bank_items_extracted = extract_items_recursive(raw_listings_data[isb_idx:isb_idx+50599])
    print(f"  [OK] Almacén ('isb') extraído directamente: {len(bank_items_extracted)} slots (Esperado: >1000)")
    assert len(bank_items_extracted) > 1000, f"Fallo en inventario"

    # Mercadillo
    item_id, ladders, _ = parse_market_message(raw_market_packet, "jzn")
    print(f"  [OK] Mercadillo ('jzn') extraído: Item #{item_id} ({get_item_name(item_id)}) con ladders: {len(ladders)}")
    assert item_id == 2540, "Fallo en mercadillo"

    print("\n--- TEST 2: Simulación de Fragmentación TCP y Concurrencia Cruzada ---")
    print("  Dividiendo tráfico en paquetes TCP estándar (MTU 1412 bytes) e intercalando...")

    # Generar paquetes fragmentados para cada módulo
    chunk_size = 1412

    # Fragmentos de listings (ket) fragmentado en 2 paquetes TCP (350b y 744b)
    ket_full = raw_listings_data[ket_idx:ket_idx+1094]
    ket_packets = [ket_full[:350], ket_full[350:]]

    # Fragmentos de ventas (kyo)
    sales_packets = [raw_sales_data[i:i+chunk_size] for i in range(0, len(raw_sales_data), chunk_size)]

    # Fragmentos de almacén (isb)
    isb_full = raw_listings_data[isb_idx:isb_idx+50599]
    isb_packets = [isb_full[i:i+chunk_size] for i in range(0, len(isb_full), chunk_size)]

    print(f"  Paquetes generados: Listings={len(ket_packets)}, Ventas={len(sales_packets)}, Almacén={len(isb_packets)}")

    # Simulación del motor sniffer idéntico a on_packet de dofus_suite.py
    captured_market = []
    captured_listings = []
    captured_sales = []
    captured_bank = {}

    bank_lock = threading.Lock()
    sales_lock = threading.Lock()
    listings_lock = threading.Lock()

    bank_burst_stream = bytearray()
    bank_expected_len = 0
    bank_burst_active = False

    sales_burst_stream = bytearray()
    sales_expected_len = 0
    sales_burst_active = False

    listings_burst_stream = bytearray()
    listings_expected_len = 0
    listings_burst_active = False

    target_bytes_market = b"type.ankama.com/jzn"
    target_bytes_sales = b"type.ankama.com/kyo"
    target_bytes_active = b"type.ankama.com/ket"
    target_bytes_inv = b"type.ankama.com/isb"
    target_bytes_storage = b"type.ankama.com/hlp"

    def flush_bank():
        nonlocal bank_burst_active, bank_expected_len
        with bank_lock:
            if not bank_burst_active and not bank_burst_stream:
                return
            bank_burst_active = False
            bank_expected_len = 0
            if bank_burst_stream:
                stream_items = extract_items_recursive(bytes(bank_burst_stream))
                for gid, qty, uid in stream_items:
                    k = uid if uid > 0 else (gid, len(captured_bank))
                    captured_bank[k] = (gid, qty, uid)
                bank_burst_stream.clear()

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
                captured_sales.extend(entries)

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
                captured_listings.extend(new_listings)

    def sim_on_packet(packet):
        nonlocal bank_burst_active, bank_expected_len
        nonlocal sales_burst_active, sales_expected_len
        nonlocal listings_burst_active, listings_expected_len

        payload = bytes(packet["Raw"].load)
        if len(payload) < 8:
            return

        has_type_url = b"type.ankama.com/" in payload
        is_listings_hdr = (target_bytes_active in payload or b"type.ankama.com/ket" in payload)
        is_sales_hdr = (target_bytes_sales in payload or b"type.ankama.com/kyo" in payload)
        is_market_hdr = (target_bytes_market in payload or b"type.ankama.com/jzn" in payload)
        is_quotation_hdr = (b"type.ankama.com/iuk" in payload or b"type.ankama.com/ive" in payload)
        is_storage_hdr = (not (is_listings_hdr or is_sales_hdr or is_market_hdr or is_quotation_hdr)) and (
            target_bytes_inv in payload or target_bytes_storage in payload or
            b"type.ankama.com/isb" in payload or b"type.ankama.com/hlp" in payload
        )

        # 1. Mercadillo
        if is_market_hdr:
            item_id, ladders, _ = parse_market_message(payload, "jzn")
            if item_id > 0:
                captured_market.append((item_id, ladders))

        # 2. Listings Activos
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
                if listings_expected_len > 0 and len(listings_burst_stream) >= listings_expected_len:
                    completed_listings = True
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
            if completed_listings:
                flush_listings()

        # 3. Historial de Ventas
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
                if sales_expected_len > 0 and len(sales_burst_stream) >= sales_expected_len:
                    completed_sales = True
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
            if completed_sales:
                flush_sales()

        # 4. Almacén / Inventario / Banco
        completed_bank = False
        if is_storage_hdr:
            with bank_lock:
                if not bank_burst_active:
                    bank_burst_stream.clear()
                    bank_burst_active = True
                    bank_expected_len = 0

                idx = -1
                cand_hdr = None
                for cand in (target_bytes_inv, target_bytes_storage, b"type.ankama.com/isb", b"type.ankama.com/hlp"):
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
                if bank_expected_len > 0 and len(bank_burst_stream) >= bank_expected_len:
                    completed_bank = True
            d_items = extract_items_recursive(payload)
            if d_items:
                with bank_lock:
                    for gid, qty, uid in d_items:
                        k = uid if uid > 0 else (gid, len(captured_bank))
                        captured_bank[k] = (gid, qty, uid)
            if completed_bank:
                flush_bank()
        elif bank_burst_active and not has_type_url:
            with bank_lock:
                bank_burst_stream.extend(payload)
                if bank_expected_len > 0 and len(bank_burst_stream) >= bank_expected_len:
                    completed_bank = True
            d_items = extract_items_recursive(payload)
            if d_items:
                with bank_lock:
                    for gid, qty, uid in d_items:
                        k = uid if uid > 0 else (gid, len(captured_bank))
                        captured_bank[k] = (gid, qty, uid)
            if completed_bank:
                flush_bank()

    # Ejecutar simulación intercalando paquetes en orden caótico / realista
    # 1. Llega consulta de mercadillo
    sim_on_packet(MockPacket(raw_market_packet))

    # 2. Llega ráfaga de listings
    for p in ket_packets:
        sim_on_packet(MockPacket(p))

    # 3. Llega otra consulta de mercadillo
    sim_on_packet(MockPacket(raw_market_packet))

    # 4. Llega ráfaga de historial de ventas
    for p in sales_packets:
        sim_on_packet(MockPacket(p))

    # 5. Llega ráfaga de banco / inventario
    for p in isb_packets:
        sim_on_packet(MockPacket(p))

    # Flush final (simulando fin de sesión)
    flush_bank()
    flush_sales()
    flush_listings()

    print("\n" + "=" * 70)
    print("  RESULTADOS DE LA SIMULACIÓN COMPLETA:")
    print("=" * 70)
    print(f"  * Mercadillo : {len(captured_market)} consultas capturadas")
    print(f"  * Listings   : {len(captured_listings)} lotes capturados (Esperado: 44)")
    print(f"  * Historial  : {len(captured_sales)} ventas capturadas (Esperado: 1000)")
    print(f"  * Almacén    : {len(captured_bank)} slots capturados (Esperado: >1000)")
    print("=" * 70)

    assert len(captured_market) == 2, "Fallo en Mercadillo"
    assert len(captured_listings) == 44, f"Fallo en Listings: capturados {len(captured_listings)} en lugar de 44"
    assert len(captured_sales) == 1000, f"Fallo en Historial: capturados {len(captured_sales)} en lugar de 1000"
    assert len(captured_bank) > 1000, f"Fallo en Almacén: capturados {len(captured_bank)}"

    print("\n>>> TODAS LAS PRUEBAS DE SIMULACIÓN CONCURRENTE PASARON CON ÉXITO (100% OK) <<<")

if __name__ == "__main__":
    run_full_simulation_test()
