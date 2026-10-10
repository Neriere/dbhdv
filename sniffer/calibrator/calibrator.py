# -*- coding: utf-8 -*-
"""
calibrator/calibrator.py
Herramienta de auto-descubrimiento y calibración de tokens de red.
"""
import os
import sys
import time
import json
import socket
import datetime
from collections import defaultdict
from scapy.all import sniff, TCP, Raw, IP

from core.config import (
    log_diagnostic,
    log_sniffer_event,
    load_keymap,
    save_keymap_entry,
)
from core.items_db import (
    load_items_dictionary,
    get_item_name,
    is_valid_market_ladder,
)
from core.protobuf_decoder import (
    decode_varint,
    extract_type_tokens,
    clean_ladder,
    extract_items_recursive,
)
from calibrator.cloud_sync import (
    share_token_to_cloud,
)

def run_calibrator_market():
    print("\n" + "=" * 70)
    print("  [CALIBRACIÓN] TOKEN DE MERCADILLO (price_list) - DOFUS 3.7")
    print("=" * 70)
    print("  Instrucciones:")
    print("  1. Abre el Mercadillo de Recursos (o cualquier HDV) en Dofus Unity.")
    print("  2. Haz clic en CUALQUIER objeto con precio (ej. Magnesita, Trigo, Madera).")
    print("  3. El calibrador capturará la ráfaga de red, detectará TODOS los tokens")
    print("     enviados por el juego y los irá probando uno a uno en vivo.")
    print("  4. Si presionas 'n', se descartará el token y seguirá escuchando automáticamente.")
    print("  5. Presiona 'q' o CTRL+C para volver al menú principal en cualquier momento.")
    print("-" * 70)

    init_session_log("CALIBRADOR_MERCADILLO")
    load_items_dictionary()
    km = load_keymap()
    known_ignored = {
        km.get("inventory", "irl"),
        km.get("storage", "irl"),
        km.get("sales_history", "kyo"),
        km.get("active_listings", "ket"),
    }
    step_rejected = set()

    burst_stream = bytearray()
    burst_active = False
    last_pkt_time = 0.0
    packet_count = 0
    feedback_time = 0.0
    detected_tokens = []
    burst_lock = threading.Lock()

    def on_packet(packet):
        nonlocal burst_active, last_pkt_time, packet_count, detected_tokens
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 8:
            return

        now = time.time()
        tokens = extract_type_tokens(payload)
        if tokens:
            tok_names = [t[0] for t in tokens]
            log_diagnostic(f"[CALIBRACIÓN_HDV] Paquete {len(payload)}B sport={packet[TCP].sport} -> Tokens: {tok_names}", payload_sample=payload[:32].hex())

        new_tokens = [tok for tok, _ in tokens if tok not in known_ignored and tok not in step_rejected]

        with burst_lock:
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now
            burst_active = True
            for tok in new_tokens:
                if tok not in detected_tokens:
                    detected_tokens.append(tok)

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("📡 Escuchando tráfico TCP (puerto 5555). Haz clic en un objeto del mercadillo...\n")

    try:
        while True:
            time.sleep(0.08)
            now = time.time()

            if burst_active:
                if now - feedback_time > 0.2:
                    tok_str = ", ".join(detected_tokens) if detected_tokens else "analizando..."
                    sys.stdout.write(
                        f"\r  [Capturando ráfaga] {len(burst_stream):,} bytes ({packet_count} paquetes) | "
                        f"Tokens detectados: {tok_str}   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

                # Fin de ráfaga: silencio de 0.7s tras recibir datos
                if now - last_pkt_time >= 0.7 and len(burst_stream) >= 60:
                    with burst_lock:
                        raw_data = bytes(burst_stream)
                        burst_stream.clear()
                        burst_active = False
                        packet_count = 0
                        tokens_to_evaluate = list(detected_tokens)
                        detected_tokens.clear()

                    all_found_tokens = [tok for tok, _ in extract_type_tokens(raw_data)]
                    candidate_tokens = []
                    for t in (tokens_to_evaluate + all_found_tokens):
                        if t not in candidate_tokens and t not in known_ignored and t not in step_rejected:
                            candidate_tokens.append(t)

                    if not candidate_tokens:
                        for t in all_found_tokens:
                            if t not in candidate_tokens and t not in step_rejected:
                                candidate_tokens.append(t)

                    if candidate_tokens:
                        log_diagnostic(f"[CALIBRACIÓN_HDV] Ráfaga capturada: {len(raw_data)} bytes. Candidatos: {candidate_tokens}")

                    # Probar secuencialmente cada token candidato
                    for cand in candidate_tokens:
                        item_id, ladders, offer_prices = parse_market_message(raw_data, cand)

                        if item_id == 0 or (not ladders and not offer_prices):
                            t_bytes = f"type.ankama.com/{cand}".encode("ascii")
                            pos = raw_data.find(t_bytes)
                            if pos != -1:
                                sub = raw_data[pos + len(t_bytes):]
                                item_id, ladders, offer_prices = extract_market_universal(sub)

                        # Validación estricta: objeto debe existir en el catálogo y tener escala o precios coherentes
                        valid_item = is_valid_market_item(item_id)
                        valid_ladder = is_valid_market_ladder(ladders)
                        valid_offers = bool(offer_prices)

                        if not valid_item or (not valid_ladder and not valid_offers):
                            log_diagnostic(f"[CALIBRACIÓN_HDV] Token '{cand}' ignorado (no-mercadillo: item_id={item_id}, ladders={ladders}, offers={offer_prices})")
                            step_rejected.add(cand)
                            continue

                        item_name = get_item_name(item_id)
                        log_diagnostic(f"[CALIBRACIÓN_HDV] CANDIDATO VÁLIDO ENCONTRADO: '{cand}' -> {item_name} (#{item_id})")
                        print("\n" + "=" * 70)
                        print(f"  🎯 TOKEN CANDIDATO DETECTADO: '{cand}'")
                        print("=" * 70)
                        print(f"  Objeto detectado : {item_name} (ID: {item_id})")
                        if ladders:
                            lad_str = " | ".join(f"x{10**i}: {p:,} K" for i, p in enumerate(ladders[0][1]) if p > 0)
                            print(f"  Precios de escala: {lad_str}")
                        elif offer_prices:
                            top_few = [f"{p:,} K" for p in offer_prices[:4]]
                            print(f"  Precios unitarios: {' | '.join(top_few)}")

                        print("-" * 70)
                        print("¿Coincide este objeto y sus precios con lo que ves en tu pantalla?")
                        print("Opciones: [s] Confirmar y guardar  |  [n] Probar siguiente token  |  [q] Cancelar")
                        try:
                            ans = input("Selecciona [s / n / q]: ").strip().lower()
                        except (KeyboardInterrupt, EOFError):
                            ans = "q"

                        if ans in ("s", "si", "y", "yes"):
                            save_keymap_entry("price_list", cand)
                            print(f"\n✅ ¡Token de mercadillo ('{cand}') guardado con éxito en config/keymap.json!")
                            log_diagnostic(f"[CALIBRACIÓN_HDV] TOKEN GUARDADO: '{cand}' para price_list")
                            share_token_to_cloud("price_list", cand)
                            input("\nPresiona Enter para continuar...")
                            return
                        elif ans in ("q", "quit", "cancelar", "exit"):
                            print("\n[Calibración cancelada]")
                            return
                        else:
                            step_rejected.add(cand)
                            log_diagnostic(f"[CALIBRACIÓN_HDV] Usuario descartó token '{cand}'.")
                            print(f"\n❌ Token '{cand}' descartado por el usuario.")
                            print("🔄 Continuando calibración en vivo...")

                    print("\n⏳ Haz clic en otro objeto del mercadillo para capturar y probar nuevos tokens...")

    except KeyboardInterrupt:
        print("\n[Calibración cancelada por el usuario]")
    finally:
        if sniffer.running:
            sniffer.stop()

def run_calibrator_quotations():
    print("\n" + "=" * 70)
    print("  [CALIBRACIÓN] TOKEN DE COTIZACIONES DE MERCADO (TENDENCIAS Y VOLÚMENES)")
    print("=" * 70)
    print("  Instrucciones:")
    print("  1. Abre el Mercadillo en Dofus Unity 3.7.")
    print("  2. Busca cualquier objeto y haz clic en el icono de GRÁFICO (📈).")
    print("  3. El calibrador capturará la ráfaga TCP y buscará las series temporales")
    print("     (ventas de 24h, 7d y 30d con precios históricos y volúmenes).")
    print("  4. Si presionas 'n', se descartará el token y seguirá escuchando automáticamente.")
    print("  5. Presiona 'q' o CTRL+C para volver al menú principal en cualquier momento.")
    print("-" * 70)

    global LAST_MARKET_ITEM_ID
    LAST_MARKET_ITEM_ID = 0
    init_session_log("CALIBRADOR_COTIZACIONES")
    load_items_dictionary()
    km = load_keymap()
    known_ignored = {
        km.get("price_list", "jzs"),
        km.get("inventory", "irl"),
        km.get("storage", "irl"),
        km.get("sales_history", "kyo"),
        km.get("active_listings", "ket"),
    }
    step_rejected = set()

    burst_stream = bytearray()
    burst_active = False
    last_pkt_time = 0.0
    packet_count = 0
    feedback_time = 0.0
    detected_tokens = []
    burst_lock = threading.Lock()
    expected_total_len = 0

    def on_packet(packet):
        nonlocal burst_active, last_pkt_time, packet_count, detected_tokens, expected_total_len
        global LAST_MARKET_ITEM_ID
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return

        sport = packet[TCP].sport
        dport = packet[TCP].dport
        payload = bytes(packet[Raw].load)
        if len(payload) < 4:
            return

        now = time.time()

        # 1. Tráfico saliente cliente -> servidor (dport 5555): capturar ID del objeto consultado
        if dport == 5555:
            if b"type.ankama.com/iqp" in payload:
                req_id = parse_quotation_request(payload)
                if req_id > 0:
                    LAST_MARKET_ITEM_ID = req_id
                    log_diagnostic(f"[CALIBRACIÓN_COTIZACIONES] Petición cliente 'iqp' para item #{req_id} ({get_item_name(req_id)})")
            else:
                # Inspeccionar varints en la petición para detectar el item_id
                off_req = 0
                while off_req < min(len(payload), 40):
                    v_req, r_req = decode_varint(payload, off_req)
                    if r_req == 0:
                        off_req += 1
                        continue
                    off_req += r_req
                    if is_valid_market_item(v_req):
                        LAST_MARKET_ITEM_ID = v_req
                        break
            return

        if sport != 5555:
            return

        # 2. Si el servidor envía price_list (cuando el usuario hace clic en el objeto en la lista)
        if b"type.ankama.com/" in payload:
            for tok, _ in extract_type_tokens(payload):
                if tok == km.get("price_list", "jzs") or tok in ("jzs", "irl", "jzn"):
                    p_id, _, _ = parse_price_message(payload, price_token=tok)
                    if p_id and is_valid_market_item(p_id):
                        LAST_MARKET_ITEM_ID = p_id

        tokens = extract_type_tokens(payload)
        if tokens:
            tok_names = [t[0] for t in tokens]
            log_diagnostic(f"[CALIBRACIÓN_COTIZACIONES] Paquete {len(payload)}B sport={sport} -> Tokens: {tok_names}", payload_sample=payload[:32].hex())

        # Descartar paquetes diminutos que solo son keepalive/ping (< 50 bytes)
        new_tokens = [tok for tok, _ in tokens if tok not in known_ignored and tok not in step_rejected]

        with burst_lock:
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now
            burst_active = True
            for tok in new_tokens:
                if tok not in detected_tokens:
                    detected_tokens.append(tok)

            # Verificar dinámicamente si cualquier TypeURL detectado define un mensaje Protobuf Any
            for tok_candidate in new_tokens:
                target_hdr = f"type.ankama.com/{tok_candidate}".encode("ascii")
                idx_h = burst_stream.find(target_hdr)
                if idx_h != -1:
                    tok_end = idx_h + len(target_hdr)
                    off_12 = burst_stream.find(bytes([0x12]), tok_end, min(len(burst_stream), tok_end + 16))
                    if off_12 != -1:
                        off_l = off_12 + 1
                        l2, rl2 = decode_varint(burst_stream, off_l)
                        if rl2 > 0:
                            expected_total_len = off_l + rl2 + l2
                            break

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("📡 Escuchando tráfico TCP (puerto 5555).")
    print("💡 Consejo: Primero haz clic en el objeto en el mercadillo y luego haz clic en el icono de gráfico (📈)...\n")

    try:
        while True:
            time.sleep(0.04)
            now = time.time()

            if burst_active:
                if now - feedback_time > 0.15:
                    tok_str = ", ".join(detected_tokens) if detected_tokens else "analizando..."
                    sys.stdout.write(
                        f"\r  [Capturando ráfaga] {len(burst_stream):,} bytes ({packet_count} paquetes) | "
                        f"Tokens detectados: {tok_str}   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

                # Evaluar cuando el reensamblado esté completo o haya silencio TCP
                is_reassembled = expected_total_len > 0 and len(burst_stream) >= expected_total_len
                silence_timeout = (now - last_pkt_time >= 0.35 and len(burst_stream) >= 150)
                ready_to_eval = is_reassembled or silence_timeout

                if ready_to_eval:
                    with burst_lock:
                        raw_data = bytes(burst_stream)
                        burst_stream.clear()
                        burst_active = False
                        packet_count = 0
                        expected_total_len = 0
                        tokens_to_evaluate = list(detected_tokens)
                        detected_tokens.clear()

                    all_found_tokens = [tok for tok, _ in extract_type_tokens(raw_data)]
                    candidate_tokens = []
                    for t in (tokens_to_evaluate + all_found_tokens):
                        if t not in candidate_tokens and t not in known_ignored and t not in step_rejected:
                            candidate_tokens.append(t)

                    if not candidate_tokens:
                        for t in all_found_tokens:
                            if t not in candidate_tokens and t not in known_ignored and t not in step_rejected:
                                candidate_tokens.append(t)

                    # Priorizar tokens con payloads grandes (cotizaciones siempre tienen > 200 bytes)
                    candidate_tokens.sort(key=lambda tok: 0 if f"type.ankama.com/{tok}".encode("ascii") in raw_data and len(raw_data) >= 300 else 1)

                    for cand in candidate_tokens:
                        q_id, s_data, raw_entries, decoded_tok = parse_quotation_message(raw_data, quotation_token=cand)
                        if not s_data:
                            continue

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

                        # Filtro estricto contra paquetes de mapa, chat o pings:
                        # 1. Debe tener precio positivo en al menos un período
                        if p24 == 0 and p7 == 0 and p30 == 0:
                            log_diagnostic(f"[CALIBRACIÓN_COTIZACIONES] Token '{cand}' ignorado (precios todos en 0 K, no es cotización).")
                            continue
                        # 2. Ventas no pueden exceder 10 millones (identificadores de entidades de mapa)
                        if s24 > 5_000_000 or s7 > 5_000_000 or s30 > 10_000_000:
                            log_diagnostic(f"[CALIBRACIÓN_COTIZACIONES] Token '{cand}' ignorado (ventas astronómicas falsas {s24:,}).")
                            continue
                        # 3. Debe tener ventas en algún período
                        if s24 == 0 and s7 == 0 and s30 == 0:
                            continue

                        target_id = q_id or LAST_MARKET_ITEM_ID
                        target_name = get_item_name(target_id) if target_id else "Objeto en cotización"

                        log_diagnostic(f"[CALIBRACIÓN_COTIZACIONES] CANDIDATO DETECTADO: '{cand}' para {target_name} (#{target_id})")
                        print("\n" + "=" * 70)
                        print(f"  🎯 TOKEN DE COTIZACIONES DETECTADO: '{cand}'")
                        print("=" * 70)
                        print(f"  Objeto detectado : {target_name} (#{target_id})")
                        print(f"  Pestaña 24 Horas : {s24:,} artículos vendidos (Medio: {p24:,} K | Mediano: {m24:,} K)")
                        print(f"  Pestaña 7 Días   : {s7:,} artículos vendidos (Medio: {p7:,} K | Mediano: {m7:,} K)")
                        print(f"  Pestaña 30 Días  : {s30:,} artículos vendidos (Medio: {p30:,} K | Mediano: {m30:,} K)")
                        print(f"  Precio Sugerido  : {sug_p:,} K")
                        print("-" * 70)
                        print("¿Coinciden estas estadísticas con el gráfico en tu pantalla?")
                        print("Opciones: [s] Confirmar y guardar  |  [n] Probar siguiente token  |  [r] Limpiar descartados  |  [q] Cancelar")
                        try:
                            ans = input("Selecciona [s / n / r / q]: ").strip().lower()
                        except (KeyboardInterrupt, EOFError):
                            ans = "q"

                        if ans in ("s", "si", "y", "yes"):
                            save_keymap_entry("quotations", cand)
                            print(f"\n✅ ¡Token de cotizaciones ('{cand}') guardado con éxito en config/keymap.json!")
                            log_diagnostic(f"[CALIBRACIÓN_COTIZACIONES] TOKEN GUARDADO: '{cand}'")
                            save_captured_quotation(target_id, target_name, s_data)
                            share_token_to_cloud("quotations", cand)
                            input("\nPresiona Enter para continuar...")
                            return
                        elif ans in ("q", "quit", "cancelar", "exit"):
                            print("\n[Calibración cancelada]")
                            return
                        elif ans in ("r", "reset"):
                            step_rejected.clear()
                            print("\n🔄 Lista de tokens descartados reiniciada. Escuchando todos los tokens...")
                        else:
                            step_rejected.add(cand)
                            log_diagnostic(f"[CALIBRACIÓN_COTIZACIONES] Usuario descartó token '{cand}'.")
                            print(f"\n❌ Token '{cand}' descartado por el usuario.")
                            print("🔄 Continuando escucha en vivo...")

                    print("\n⏳ Haz clic en el icono de gráfico (📈) de otro objeto para probar...")

    except KeyboardInterrupt:
        print("\n[Calibración cancelada por el usuario]")
    finally:
        if sniffer.running:
            sniffer.stop()


# =============================================================================
# MODULO 4B: CALIBRADOR DE ALMACÉN, INVENTARIO Y MERKASAKO
# =============================================================================

def run_calibrator_storage():
    """
    Calibrador interactivo para descubrir y validar los tokens de inventario y almacenamiento
    (Banco, Inventario del personaje, Cofre de Merkasako o inventario en Mercadillo).
    Captura las ráfagas Protobuf y extrae los ObjectItem decodificados para confirmar antes de guardar.
    """
    print("\n" + "=" * 70)
    print("  [CALIBRACIÓN] TOKEN DE ALMACÉN, INVENTARIO Y MERKASAKO (DOFUS 3.7)")
    print("=" * 70)
    print("  Instrucciones:")
    print("  1. Abre el juego Dofus Unity.")
    print("  2. Realiza CUALQUIERA de estas acciones en el juego:")
    print("     • Abre tu Inventario ('I').")
    print("     • Consulta tu Banco con el banquero o abre el cofre de tu Merkasako.")
    print("     • Abre cualquier Mercadillo (ej. Recursos) en la pestaña 'VENTA'.")
    print("  3. El calibrador capturará la ráfaga TCP en el puerto 5555 y probará cada token")
    print("     buscando la lista de tus objetos reales (ID, cantidad, UID).")
    print("  4. Al detectar tus objetos podrás confirmar y guardarlo para tu Almacén Unificado.")
    print("  5. Presiona 'q' o CTRL+C para volver al menú principal en cualquier momento.")
    print("-" * 70)

    init_session_log("CALIBRADOR_ALMACEN")
    load_items_dictionary()
    km = load_keymap()
    known_ignored = {
        km.get("price_list", "jzs"),
        km.get("quotations", "ire"),
        km.get("sales_history", "kyo"),
        km.get("active_listings", "ket"),
    }
    step_rejected = set()

    burst_stream = bytearray()
    burst_active = False
    last_pkt_time = 0.0
    packet_count = 0
    feedback_time = 0.0
    detected_tokens = []
    burst_lock = threading.Lock()

    def on_packet(packet):
        nonlocal burst_active, last_pkt_time, packet_count, detected_tokens
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 8:
            return

        now = time.time()
        tokens = extract_type_tokens(payload)
        new_tokens = [tok for tok, _ in tokens if tok not in known_ignored and tok not in step_rejected]

        with burst_lock:
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now
            burst_active = True
            for tok in new_tokens:
                if tok not in detected_tokens:
                    detected_tokens.append(tok)

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("📡 Escuchando tráfico TCP (puerto 5555)...")
    print("👉 Abre tu Inventario, consulta tu Banco o abre el Mercadillo de Recursos...\n")

    try:
        while True:
            time.sleep(0.04)
            now = time.time()

            if burst_active:
                if now - feedback_time > 0.15:
                    tok_str = ", ".join(detected_tokens) if detected_tokens else "analizando..."
                    sys.stdout.write(
                        f"\r  [Capturando ráfaga] {len(burst_stream):,} bytes ({packet_count} paquetes) | "
                        f"Tokens detectados: {tok_str}   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

                # Evaluar ráfaga tras 0.6s de silencio
                if (now - last_pkt_time >= 0.6 and len(burst_stream) >= 60):
                    with burst_lock:
                        raw_data = bytes(burst_stream)
                        burst_stream.clear()
                        burst_active = False
                        packet_count = 0
                        tokens_to_evaluate = list(detected_tokens)
                        detected_tokens.clear()

                    all_found_tokens = [tok for tok, _ in extract_type_tokens(raw_data)]
                    candidate_tokens = []
                    for t in (tokens_to_evaluate + all_found_tokens):
                        if t not in candidate_tokens and t not in known_ignored and t not in step_rejected:
                            candidate_tokens.append(t)

                    if not candidate_tokens:
                        for t in all_found_tokens:
                            if t not in candidate_tokens and t not in known_ignored and t not in step_rejected:
                                candidate_tokens.append(t)

                    for cand in candidate_tokens:
                        cand_bytes = f"type.ankama.com/{cand}".encode("ascii")
                        pos = raw_data.find(cand_bytes)
                        if pos == -1:
                            continue

                        # Delimitar submensaje para este token específico (hasta el próximo TypeURL o final del búfer)
                        next_pos = raw_data.find(b"type.ankama.com/", pos + len(cand_bytes))
                        cand_slice = raw_data[pos:next_pos] if next_pos != -1 else raw_data[pos:]

                        raw_items = extract_items_recursive(raw_data)
                        if not raw_items:
                            raw_items = extract_items_recursive(cand_slice)

                        accumulated_items = {}
                        for gid, qty, uid in raw_items:
                            if gid and is_valid_market_item(gid) and 1 <= qty <= 200_000_000:
                                key = uid if uid > 0 else (gid, len(accumulated_items))
                                if key not in accumulated_items or qty > accumulated_items[key][1]:
                                    accumulated_items[key] = (gid, qty, uid)

                        valid_items = list(accumulated_items.values())
                        if len(valid_items) < 2:
                            step_rejected.add(cand)
                            continue

                        total_slots = len(valid_items)
                        total_units = sum(q for _, q, _ in valid_items)
                        unique_types = len(set(gid for gid, _, _ in valid_items))

                        print("\n" + "=" * 70)
                        print(f"  🎯 ¡TOKEN DE ALMACÉN / INVENTARIO DETECTADO: '{cand}'!")
                        print("=" * 70)
                        print(f"  • Ráfaga analizada  : {len(raw_data):,} bytes")
                        print(f"  • Slots detectados  : {total_slots:,} objetos")
                        print(f"  • Unidades totales  : {total_units:,} unidades")
                        print(f"  • Tipos de recursos : {unique_types:,} diferentes")
                        print("-" * 70)
                        print("  Muestra de objetos encontrados en tus pertenencias:")
                        for i, (gid, qty, uid) in enumerate(valid_items[:8]):
                            item_name = get_item_name(gid)
                            print(f"    [{i+1}] {item_name} (#{gid}) -> x{qty:,} unidades")
                        if len(valid_items) > 8:
                            print(f"    ... y {len(valid_items) - 8} objetos más.")
                        print("-" * 70)
                        print("¿Coinciden estos objetos con tus pertenencias en el juego?")
                        print("Opciones: [s] Confirmar y guardar Almacén Unificado (Inventario + Banco + Merkasako)")
                        print("          [n] Descartar y probar siguiente token")
                        print("          [q] Cancelar y volver al menú principal")
                        try:
                            ans = input("\nSelecciona [s / n / q] (Enter para Confirmar): ").strip().lower()
                        except (KeyboardInterrupt, EOFError):
                            ans = "q"

                        if ans in ("", "s", "si", "y", "yes", "1", "2", "3"):
                            save_keymap_entry("inventory", cand)
                            save_keymap_entry("storage", cand)
                            share_token_to_cloud("inventory", cand)
                            share_token_to_cloud("storage", cand)
                            print(f"\n✅ ¡Token de Almacén Unificado ('{cand}') guardado con éxito en config/keymap.json!")
                        elif ans in ("q", "quit", "cancelar", "exit"):
                            print("\n[Calibración cancelada]")
                            return
                        else:
                            step_rejected.add(cand)
                            print(f"\n❌ Token '{cand}' descartado. Continuando escucha...")
                            continue

                        # Guardar instantáneamente los objetos capturados
                        try:
                            items_list = [
                                {"uid": str(uid), "itemId": gid, "name": get_item_name(gid), "quantity": qty}
                                for gid, qty, uid in valid_items
                            ]
                            saved_data = {
                                "metadata": {
                                    "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                    "totalSlots": total_slots,
                                    "totalUnits": total_units,
                                    "uniqueTypes": unique_types,
                                    "tokens": [cand]
                                },
                                "items": items_list
                            }
                            with open(INVENTORY_OUTPUT, "w", encoding="utf-8") as f:
                                json.dump(saved_data, f, indent=2, ensure_ascii=False)
                            print(f"💾 Se guardaron {total_slots} slots en data/banco_inventario_capturado.json")
                        except Exception as e:
                            print(f"⚠️ No se pudo guardar snapshot local: {e}")

                        input("\nPresiona Enter para continuar...")
                        return

                    if burst_active:
                        print("\n⏳ Abre otro contenedor (Banco, Inventario o Mercadillo) para probar...")

    except KeyboardInterrupt:
        print("\n[Calibración cancelada por el usuario]")
    finally:
        if sniffer.running:
            sniffer.stop()

# =============================================================================
# MODULO 5: HISTORIAL DE VENTAS (Dofus 3.6)
# =============================================================================

def inspect_packet_contents(buf):
    item_ids = []
    prices = []
    dates = []
    strings = []

    def walk(b, depth=0):
        if depth > 4 or len(b) < 2:
            return
        off = 0
        while off < len(b):
            tag, r = decode_varint(b, off)
            if r == 0:
                break
            off += r
            fn = tag >> 3
            wt = tag & 7

            if wt == 0:
                v, r2 = decode_varint(b, off)
                off += r2
                if 10 <= v <= 65000 and (v in ITEMS_NAME_MAP or str(v) in ITEMS_NAME_MAP):
                    if v not in item_ids:
                        item_ids.append(v)
                elif 50 <= v <= 2_000_000_000 and v not in item_ids:
                    if v not in prices:
                        prices.append(v)
                elif 1_600_000_000 <= v <= 2_000_000_000:
                    dates.append(datetime.datetime.fromtimestamp(v).strftime("%Y-%m-%d %H:%M"))
                elif 1_600_000_000_000 <= v <= 2_000_000_000_000:
                    dates.append(datetime.datetime.fromtimestamp(v / 1000.0).strftime("%Y-%m-%d %H:%M"))
            elif wt == 2:
                length, r2 = decode_varint(b, off)
                if r2 == 0 or off + r2 + length > len(b):
                    break
                off += r2
                sub = b[off:off + length]
                off += length
                try:
                    s = sub.decode("utf-8")
                    if len(s) >= 4 and any(c.isalnum() for c in s):
                        strings.append(s)
                        if ("2025" in s or "2026" in s) and ("-" in s or ":" in s or "T" in s):
                            dates.append(s)
                except Exception:
                    pass
                walk(sub, depth + 1)
            elif wt == 1:
                off += 8
            elif wt == 5:
                off += 4
            else:
                break
    walk(buf)
    return item_ids, prices, dates, strings

KNOWN_USER_PRICES = {76147, 39147, 3147, 40147, 30147, 29147, 37147, 47147, 33201969, 900}
KNOWN_USER_ITEMS = {9174, 12694, 1813, 6961, 8008, 8007, 12691, 13766, 13799}

def find_target_matches(buf):
    matched_prices = set()
    matched_items = set()
    off = 0
    while off < len(buf):
        v, r = decode_varint(buf, off)
        if r > 0:
            if v in KNOWN_USER_PRICES:
                matched_prices.add(v)
            if v in KNOWN_USER_ITEMS:
                matched_items.add(v)
        off += 1
    return matched_prices, matched_items

def run_calibrator_sales():
    print("\n" + "=" * 70)
    print("  [CALIBRACIÓN] HISTORIAL DE VENTAS Y TRANSACCIONES (DOFUS 3.6)")
    print("=" * 70)
    print("  ℹ️  ¿Por qué no detecta nada al hacer clic en la ventana ya abierta?")
    print("     Dofus Unity almacena el historial en la memoria del cliente (RAM).")
    print("     Cuando la ventana ya está abierta, hacer clic o filtrar no pide")
    print("     los datos a la red nuevamente.")
    print("\n  👉 CÓMO FORZAR AL SERVIDOR A ENVIAR TUS VENTAS (Elige una):")
    print("     1. MÉTODO INFALIBLE: Desconecta tu personaje a selección de")
    print("        personaje y vuelve a entrar (relog). Al conectar, el servidor")
    print("        envía una ráfaga con todas tus ventas sin conexión.")
    print("     2. O abre cualquier Mercadillo (HDV) y entra a la pestaña 'VENTA'.")
    print("-" * 70)

    load_items_dictionary()
    km = load_keymap()
    known_ignored = {
        km.get("price_list", "jzn"),
        km.get("inventory", "irl"),
        km.get("storage", "irl"),
    }

    step_rejected = set()

    while True:
        found_candidate = None
        burst_stream = bytearray()
        burst_tokens = []
        pkt_count = 0
        last_pkt_time = 0.0
        last_feedback_time = 0.0
        candidate_active = False
        cand_kind = None
        cand_tok = None
        cand_prices = set()
        cand_items = set()

        def on_packet(packet):
            nonlocal found_candidate, pkt_count, last_pkt_time, last_feedback_time
            nonlocal candidate_active, cand_kind, cand_tok, cand_prices, cand_items
            if found_candidate is not None:
                return
            if not packet.haslayer(TCP) or not packet.haslayer(Raw):
                return
            if packet[TCP].sport != 5555:
                return

            payload = bytes(packet[Raw].load)
            if len(payload) < 8:
                return

            pkt_count += 1
            now = time.time()

            # Gestión de ráfaga TCP continua
            if not candidate_active and (now - last_pkt_time > 1.8):
                burst_stream.clear()
                burst_tokens.clear()
            last_pkt_time = now

            burst_stream.extend(payload)

            tokens = extract_type_tokens(payload)
            if tokens:
                for tok, _ in tokens:
                    if tok not in known_ignored and tok not in step_rejected and tok not in burst_tokens:
                        burst_tokens.append(tok)

            if not candidate_active:
                # 1. DETECCIÓN POR FIRMA EXACTA (Tus precios u objetos reales en pantalla)
                matched_prices_single, matched_items_single = find_target_matches(payload)
                matched_prices_burst, matched_items_burst = find_target_matches(bytes(burst_stream))

                matched_prices = matched_prices_single | matched_prices_burst
                matched_items = matched_items_single | matched_items_burst

                # Comprobar si coincide con tus precios conocidos
                has_major_price = any(p in (76147, 39147, 40147, 30147, 29147, 37147, 47147) for p in matched_prices)
                is_solid_match = has_major_price or (len(matched_prices) >= 2) or (matched_prices and matched_items) or (len(matched_items) >= 2)

                if is_solid_match:
                    cand_tok = burst_tokens[0] if burst_tokens else (tokens[0][0] if tokens else "kyo")
                    cand_kind = "exact_match"
                    cand_prices = matched_prices
                    cand_items = matched_items
                    candidate_active = True
                    return

                if not tokens:
                    return

                tok = tokens[0][0]
                if tok in known_ignored or tok in step_rejected:
                    return

                # 2. Detección heurística general (fechas e identificadores)
                sales = extract_sales_entries(payload)
                item_ids, prices, dates, strings = inspect_packet_contents(payload)

                if sales or (len(item_ids) >= 2 and prices and len(prices) >= 2) or (dates and prices):
                    cand_tok = tok
                    cand_kind = "heuristic"
                    candidate_active = True
                    return

        sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
        sniffer.start()

        print("Esperando ráfaga de datos... (Desconecta y reconecta tu personaje o entra a 'VENTA' en mercadillo)")
        try:
            while found_candidate is None:
                time.sleep(0.05)
                now = time.time()
                if candidate_active:
                    sys.stdout.write(f"\r  [Acumulando Ráfaga] {len(burst_stream):,} bytes recibidos en {pkt_count} paquetes...   ")
                    sys.stdout.flush()
                    if now - last_pkt_time >= 1.2 and len(burst_stream) >= 500:
                        found_candidate = (cand_kind, cand_tok, cand_prices, cand_items, bytes(burst_stream))
                        break
                elif now - last_feedback_time > 0.2:
                    sys.stdout.write(f"\r  [Escuchando Red] Paquetes analizados: {pkt_count:,} | Esperando envío del servidor...   ")
                    sys.stdout.flush()
                    last_feedback_time = now
        except KeyboardInterrupt:
            print("\n[Calibración cancelada por usuario]")
            if sniffer.running:
                sniffer.stop()
            return
        finally:
            if sniffer.running:
                sniffer.stop()

        print()
        kind = found_candidate[0]
        tok = found_candidate[1]
        payload = found_candidate[-1]

        # Decodificar todas las ventas de la ráfaga completa
        decoded_sales = extract_sales_entries(payload)
        unique_sales = []
        seen_keys = set()
        for s in decoded_sales:
            k = (s.get("rawDate") or s.get("date"), s.get("itemId"), s.get("price"), s.get("quantity"))
            if k not in seen_keys:
                seen_keys.add(k)
                unique_sales.append(s)

        print("\n" + "=" * 70)
        if kind == "exact_match":
            print(f"  🎯 ¡HISTORIAL DE VENTAS CONFIRMADO POR FIRMA! -> Token: '{tok}'")
        else:
            print(f"  PAQUETE DE HISTORIAL DETECTADO -> Token: '{tok}'")
        print("=" * 70)
        print(f"  Ráfaga analizada    : {len(payload):,} bytes")
        if unique_sales:
            sold_count = sum(1 for s in unique_sales if s.get("status") == "Vendido")
            unsold_count = sum(1 for s in unique_sales if s.get("status") == "Sin vender")
            sold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Vendido")
            unsold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Sin vender")
            total_qty = sum(s.get("quantity", 1) for s in unique_sales)

            print(f"  Ventas decodificadas: {len(unique_sales):,} registros encontrados")
            print(f"  Kamas generadas     : {sold_kamas:,} K (Vendido)")
            print(f"  Kamas en oferta     : {unsold_kamas:,} K (Sin vender)")
            print(f"  Ventas finalizadas  : {sold_count:,} | En venta (activas): {unsold_count:,}")
            print("-" * 70)
            print("  Muestra de transacciones capturadas en pantalla:")
            for i, s in enumerate(unique_sales[:8]):
                print(f"    [{i+1}] {s['date']} | {s['quantity']}x {s['name']} (#{s['itemId']}) -> {s['price']:,} K [{s.get('status', 'Vendido')}]")
        else:
            matched_prices = found_candidate[2] if kind == "exact_match" else []
            matched_items = found_candidate[3] if kind == "exact_match" else []
            if matched_prices:
                print(f"  Precios de tu lista: {', '.join(f'{p:,} K' for p in sorted(matched_prices, reverse=True))}")
            if matched_items:
                item_names = [f"{get_item_name(iid)} (#{iid})" for iid in matched_items]
                print(f"  Objetos de tu lista: {', '.join(item_names)}")

        # Registrar en el log de diagnóstico
        log_diagnostic(f"Candidato Historial: Token '{tok}', bytes={len(payload)}, ventas={len(unique_sales)}", payload[:100].hex())

        print("-" * 70)
        print("¿Coinciden estos datos con tu historial en pantalla? [s=Confirmar / n=Rechazar / c=Cancelar]: ", end="")
        ans = input().strip().lower()

        if ans in ("s", "si", "y", "yes"):
            save_keymap_entry("sales_history", tok)
            print(f"\n✅ ¡Token de historial ('{tok}') guardado con éxito en config/keymap.json!")

            # Auto-guardado y apertura inmediata del visor
            if unique_sales:
                sold_count = sum(1 for s in unique_sales if s.get("status") == "Vendido")
                unsold_count = sum(1 for s in unique_sales if s.get("status") == "Sin vender")
                sold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Vendido")
                unsold_kamas = sum(s.get("price", 0) for s in unique_sales if s.get("status") == "Sin vender")
                total_qty = sum(s.get("quantity", 1) for s in unique_sales)

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
                        "token": tok
                    },
                    "sales": unique_sales
                }
                try:
                    with open(SALES_OUTPUT, "w", encoding="utf-8") as f:
                        json.dump(out_data, f, indent=2, ensure_ascii=False)
                    print(f"  ✓ Archivo guardado: sniffer/data/historial_ventas_capturado.json")
                except Exception as e:
                    print(f"  [Error guardando {SALES_OUTPUT}]: {e}")
                
                open_sales_viewer(out_data)

            share_token_to_cloud("sales_history", tok)
            return
        elif ans in ("c", "cancelar"):
            print("\n[Calibración cancelada]")
            return
        else:
            step_rejected.add(tok)
            print(f"\n[Aviso] Token '{tok}' descartado.")
            print("Continuando escucha de red...")



def run_calibrator_active_listings():
    """
    Calibrador interactivo para descubrir y validar el token de listings activos
    (pestaña 'VENTA' del mercadillo), mostrando en consola el contenido decodificado
    de cada token candidato para confirmar visualmente antes de guardar.
    """
    print("\n" + "=" * 70)
    print("  [CALIBRACIÓN] LISTINGS ACTIVOS EN VENTA (PESTAÑA 'VENTA' DEL MERCADILLO)")
    print("=" * 70)
    print("  Instrucciones:")
    print("  1. Abre el juego Dofus Unity 3.6.")
    print("  2. Acude a cualquier Mercadillo (Recursos, Equipamiento o Consumibles).")
    print("  3. Abre el mercadillo y haz clic en la pestaña 'VENTA'.")
    print("  4. El calibrador capturará la ráfaga TCP y probará cada token")
    print("     mostrando en consola tus lotes en venta (objetos, precio y tiempo).")
    print("-" * 70)

    load_items_dictionary()
    km = load_keymap()
    known_ignored = {
        km.get("price_list", "jzn"),
        km.get("inventory", "irl"),
        km.get("storage", "irl"),
        km.get("sales_history", "kyo"),
    }
    step_rejected = set()

    burst_stream = bytearray()
    burst_active = False
    last_pkt_time = 0.0
    packet_count = 0
    feedback_time = 0.0
    detected_tokens = []

    def on_packet(packet):
        nonlocal burst_stream, burst_active, last_pkt_time, packet_count, detected_tokens
        if not packet.haslayer(TCP) or not packet.haslayer(Raw):
            return
        if packet[TCP].sport != 5555:
            return

        payload = bytes(packet[Raw].load)
        if len(payload) < 8:
            return

        now = time.time()
        tokens = extract_type_tokens(payload)

        new_tokens = [tok for tok, _ in tokens if tok not in known_ignored and tok not in step_rejected]
        if new_tokens or burst_active or len(payload) >= 150:
            burst_active = True
            burst_stream.extend(payload)
            packet_count += 1
            last_pkt_time = now
            for tok in new_tokens:
                if tok not in detected_tokens:
                    detected_tokens.append(tok)

    sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
    sniffer.start()

    print("\nEscuchando puerto 5555. Haz clic en la pestana 'VENTA' del mercadillo...")

    try:
        while True:
            time.sleep(0.08)
            now = time.time()

            if burst_active:
                if now - feedback_time > 0.2:
                    sys.stdout.write(
                        f"\r  [Capturando] {len(burst_stream):,} bytes en {packet_count} paquetes | "
                        f"Tokens: {', '.join(detected_tokens) if detected_tokens else 'analizando...'}   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

                # Fin de rafaga: 1.2s de silencio y tamano suficiente
                if now - last_pkt_time >= 1.2 and len(burst_stream) >= 200:
                    raw_data = bytes(burst_stream)
                    burst_stream.clear()
                    burst_active = False
                    packet_count = 0

                    all_tokens = extract_type_tokens(raw_data)
                    token_counts = defaultdict(int)
                    for tok, _ in all_tokens:
                        token_counts[tok] += 1

                    candidates = [tok for tok in token_counts.keys() if tok not in known_ignored and tok not in step_rejected]
                    if not candidates:
                        candidates = [tok for tok in token_counts.keys() if tok not in step_rejected]

                    # Probar candidatos que decodifiquen listings validos
                    found_any = False
                    for cand in candidates:
                        cand_listings = extract_active_listings(raw_data, token=cand)
                        if not cand_listings:
                            continue

                        found_any = True
                        total_value = sum(l["price"] for l in cand_listings)
                        print("\n\n" + "=" * 70)
                        print(f"  PAQUETE DE LISTINGS DETECTADO -> Token Candidato: '{cand}'")
                        print("=" * 70)
                        print(f"  Lotes encontrados  : {len(cand_listings)} lote(s) en venta")
                        print(f"  Valor total en HDV : {total_value:,} K")
                        print("-" * 70)
                        print("  Muestra de lotes decodificados en tu mercadillo:")
                        for i, entry in enumerate(cand_listings[:8], 1):
                            qty = entry.get("quantity", 1)
                            unit_str = f" ({entry.get('unitPrice', entry['price'] // qty):,} K/u)" if qty > 1 else ""
                            print(
                                f"    [{i}] {qty:2d}x {entry['name']} (#{entry['itemId']}) "
                                f"-> {entry['price']:,} K{unit_str} | Expira en: {entry.get('timeLabel', 'N/D')}"
                            )
                        if len(cand_listings) > 8:
                            print(f"    ... y {len(cand_listings) - 8} lotes adicionales.")

                        print("-" * 70)
                        print(f"Coinciden estos {len(cand_listings)} lotes con tus ofertas en mercadillo?")
                        print("Opciones: [s] Confirmar y guardar  |  [n] Probar siguiente token  |  [c] Cancelar")
                        try:
                            ans = input("Selecciona [s / n / c]: ").strip().lower()
                        except (KeyboardInterrupt, EOFError):
                            ans = "c"

                        if ans in ("s", "si", "y", "yes"):
                            save_keymap_entry("active_listings", cand)
                            print(f"\n[OK] Token de listings activos ('{cand}') guardado con exito en config/keymap.json")
                            share_token_to_cloud("active_listings", cand)
                            input("\nPresiona Enter para continuar...")
                            return
                        elif ans in ("c", "cancelar"):
                            print("\n[Calibracion cancelada]")
                            return
                        else:
                            step_rejected.add(cand)
                            print(f"\n[Aviso] Token '{cand}' descartado.")

                    if not found_any:
                        # Rafaga no contenia listings (movimiento, chat, etc.), continua escuchando
                        detected_tokens.clear()
                        continue

            else:
                if now - feedback_time > 0.4:
                    sys.stdout.write(
                        f"\r  [Escuchando puerto 5555] Haz clic en la pestana 'VENTA' del mercadillo...   "
                    )
                    sys.stdout.flush()
                    feedback_time = now

    except KeyboardInterrupt:
        print("\n\n[Calibracion cancelada por el usuario]")
    finally:
        if sniffer.running:
            sniffer.stop()

    input("\nPresiona Enter para volver al menu...")


