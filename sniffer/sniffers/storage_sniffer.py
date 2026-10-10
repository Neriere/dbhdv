# -*- coding: utf-8 -*-
"""
sniffers/storage_sniffer.py
Captura de almacén, inventario, banco y merkasako.
"""
import os
import sys
import time
import json
import threading
from scapy.all import sniff, TCP, Raw, IP

from core.config import (
    INVENTORY_OUTPUT,
    log_sniffer_event,
    load_keymap,
)
from core.items_db import (
    load_items_dictionary,
    get_item_name,
)
from core.protobuf_decoder import (
    extract_items_recursive,
)
from exporters.html_viewer import (
    open_storage_viewer,
    launch_html_file,
)

def run_sniffer_storage():
    km = load_keymap()
    inv_tok = km.get("inventory", "irl")
    storage_tok = km.get("storage", "irl")
    target_tokens = (
        f"type.ankama.com/{inv_tok}".encode("ascii"),
        f"type.ankama.com/{storage_tok}".encode("ascii"),
        b"type.ankama.com/irl",
        b"type.ankama.com/isb",
        b"type.ankama.com/hlp",
    )

    print("\n" + "=" * 70)
    print("  [SNIFFER] ALMACÉN UNIFICADO (INVENTARIO + BANCO + MERKASAKO)")
    print("=" * 70)
    print(f"  • Tokens de Almacén : '{inv_tok}' / '{storage_tok}' (Filtro Estricto Activo)")
    print("  Instrucciones:")
    print("  1. Habla con el banquero ('Consultar tu banco') o abre tu inventario.")
    print("  2. El sniffer capturará la ráfaga continua sin aceptar paquetes espurios.")
    print("  3. Al completar el guardado se detendrá automáticamente y volverá al menú.")
    print("  Presiona CTRL+C para cancelar en cualquier momento.")
    print("-" * 70)

    init_session_log("ALMACEN")
    load_items_dictionary()

    burst_started = False
    packet_count = 0
    last_item_time = 0.0
    burst_stream = bytearray()
    storage_lock = threading.Lock()

    def on_packet(packet):
        nonlocal burst_started, packet_count, last_item_time
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 8:
            return

        now = time.time()
        is_storage_token = any(tok in payload for tok in target_tokens)

        # ÚNICAMENTE iniciar la ráfaga si contiene explícitamente el token de inventario o banco
        if is_storage_token:
            with storage_lock:
                if not burst_started or (now - last_item_time > 2.0):
                    burst_stream.clear()
                    burst_started = True
                    packet_count = 0
                burst_stream.extend(payload)
                packet_count += 1
                last_item_time = now
        elif burst_started:
            # Paquetes TCP de continuación de la misma ráfaga de almacenamiento
            if b"type.ankama.com/" in payload:
                if any(tok in payload for tok in target_tokens):
                    with storage_lock:
                        burst_stream.extend(payload)
                        packet_count += 1
                        last_item_time = now
            else:
                with storage_lock:
                    burst_stream.extend(payload)
                    packet_count += 1
                    last_item_time = now

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("\nEscuchando puerto 5555... Abre tu Banco o Inventario en Dofus Unity...")

    captured_successfully = False
    try:
        while True:
            time.sleep(0.08)
            now = time.time()

            if burst_started:
                with storage_lock:
                    curr_bytes = len(burst_stream)
                    curr_pkts = packet_count

                sys.stdout.write(f"\r  [Capturando Almacén] {curr_bytes:,} bytes en {curr_pkts} paquetes TCP...   ")
                sys.stdout.flush()

                # Tras 1.2 segundos sin nuevos fragmentos, la ráfaga completa ha terminado
                if (now - last_item_time >= 1.2) and curr_bytes >= 200:
                    with storage_lock:
                        raw_data = bytes(burst_stream)
                        burst_stream.clear()
                        burst_started = False

                    print(f"\n\n  ⚙️ Decodificando {len(raw_data):,} bytes de almacenamiento...")
                    raw_items = extract_items_recursive(raw_data)

                    accumulated_items = {}
                    for gid, qty, uid in raw_items:
                        if gid and 10 <= gid <= 70000 and 1 <= qty <= 200_000_000:
                            key = uid if uid > 0 else (gid, len(accumulated_items))
                            if key not in accumulated_items or qty > accumulated_items[key][1]:
                                accumulated_items[key] = (gid, qty, uid)

                    items_snapshot = list(accumulated_items.values())
                    if not items_snapshot:
                        print("  ⚠️ La ráfaga no contenía slots válidos. Continuando escucha...")
                        continue

                    total_slots = len(items_snapshot)
                    total_units = sum(q for _, q, _ in items_snapshot)
                    unique_types = len(set(gid for gid, _, _ in items_snapshot))

                    items_list = [
                        {"uid": str(uid), "itemId": gid, "name": get_item_name(gid), "quantity": qty}
                        for gid, qty, uid in items_snapshot
                    ]

                    saved_data = {
                        "metadata": {
                            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "totalSlots": total_slots,
                            "totalUnits": total_units,
                            "uniqueTypes": unique_types,
                            "tokens": [inv_tok, storage_tok]
                        },
                        "items": items_list
                    }

                    try:
                        with open(INVENTORY_OUTPUT, "w", encoding="utf-8") as f:
                            json.dump(saved_data, f, indent=2, ensure_ascii=False)
                        now_str = datetime.datetime.now().strftime("%H:%M:%S")
                        print("\n" + "=" * 70)
                        print(f"  [{now_str}] 🎉 ¡ALMACÉN CAPTURADO Y GUARDADO CON ÉXITO!")
                        print("=" * 70)
                        print(f"  • Slots detectados   : {total_slots:,}")
                        print(f"  • Unidades totales   : {total_units:,}")
                        print(f"  • Recursos distintos : {unique_types:,}")
                        print(f"  • Guardado en        : data/banco_inventario_capturado.json")
                        print("=" * 70)
                        log_sniffer_event("ALMACEN_GUARDADO", f"{total_slots} slots ({total_units:,} unidades) guardados en {INVENTORY_OUTPUT}")
                        captured_successfully = True
                        break  # Termina aquí: captura y vuelve al menú sin capturar tráfico pasivo
                    except Exception as e:
                        print(f"\n[Error guardando almacén]: {e}")
                        break

    except KeyboardInterrupt:
        print("\n\n[Operación cancelada por el usuario]")
    finally:
        if sniffer.running:
            sniffer.stop()

    if captured_successfully:
        try:
            ans = input("\n¿Deseas abrir el visor interactivo de almacén en tu navegador? [S/n]: ").strip().lower()
            if ans in ("", "s", "si", "y", "yes"):
                open_storage_viewer(saved_data)
                return
        except Exception:
            pass
        input("\nPresiona Enter para volver al menú principal...")

