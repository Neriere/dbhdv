#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import time
import json
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from scapy.all import AsyncSniffer, TCP, Raw
except ImportError:
    print("Scapy no esta instalado.")
    sys.exit(1)

OUTPUT_RAW = "sniffer/data/raw_sales_stream.bin"
OUTPUT_ANALYSIS = "sniffer/data/sales_fields_analysis.json"

def decode_varint(buf, offset=0):
    val = 0
    shift = 0
    pos = offset
    while pos < len(buf):
        b = buf[pos]
        pos += 1
        val |= (b & 0x7F) << shift
        if not (b & 0x80):
            return val, pos - offset
        shift += 7
        if shift >= 64:
            break
    return 0, 0

print("=" * 70)
print("  CAPTURA Y ANALISIS DE RAFAGA CRUDA DE VENTAS (DOFUS UNITY 3.6)")
print("=" * 70)
print("  Esperando rafaga de ventas del juego...")
print("  -> Desconecta tu personaje y vuelve a entrar (/desconectar o seleccion de personaje)")
print("     o abre Mercadillo -> pestana VENTA.")
print("-" * 70)

burst_stream = bytearray()
burst_active = False
last_pkt_time = 0.0
pkt_count = 0

def on_packet(packet):
    global burst_stream, burst_active, last_pkt_time, pkt_count
    if not packet.haslayer(TCP) or not packet.haslayer(Raw):
        return
    if packet[TCP].sport != 5555:
        return

    payload = bytes(packet[Raw].load)
    if len(payload) < 8:
        return

    now = time.time()
    if b"type.ankama.com/kyo" in payload:
        burst_active = True
        burst_stream.clear()
        pkt_count = 0
        print("\n  [DETECTADO] Cabecera 'type.ankama.com/kyo' detectada. Acumulando paquetes...")

    if burst_active:
        burst_stream.extend(payload)
        pkt_count += 1
        last_pkt_time = now

sniffer = AsyncSniffer(filter="tcp port 5555", prn=on_packet, store=False)
sniffer.start()

try:
    while True:
        time.sleep(0.05)
        now = time.time()
        if burst_active:
            sys.stdout.write(f"\r  [Acumulando] {len(burst_stream):,} bytes en {pkt_count} paquetes TCP...   ")
            sys.stdout.flush()

            if now - last_pkt_time >= 1.2 and len(burst_stream) >= 500:
                raw_bytes = bytes(burst_stream)
                print(f"\n\n  [OK] Rafaga completa recibida: {len(raw_bytes):,} bytes.")
                break
finally:
    if sniffer.running:
        sniffer.stop()

# Guardar ráfaga cruda completa
os.makedirs("sniffer/data", exist_ok=True)
with open(OUTPUT_RAW, "wb") as f:
    f.write(raw_bytes)
print(f"  * Archivo binario guardado en: {OUTPUT_RAW}")

# Análisis detallado de campos protobuf
print("\n" + "=" * 70)
print("  ANALIZANDO CAMPOS PROTOBUF EN LA RÁFAGA...")
print("=" * 70)

# Localizar kyo
idx = raw_bytes.find(b"type.ankama.com/kyo")
start_pos = 0
if idx != -1:
    off = idx + len(b"type.ankama.com/kyo")
    if off < len(raw_bytes) and raw_bytes[off] == 0x12:
        off += 1
        msg_len, r = decode_varint(raw_bytes, off)
        off += r
        start_pos = off
        end_pos = min(len(raw_bytes), off + msg_len)
    else:
        end_pos = len(raw_bytes)
else:
    end_pos = len(raw_bytes)

print(f"  Cuerpo de mensaje: inicio={start_pos}, fin={end_pos}, longitud={end_pos - start_pos}")

# Analizar todas las entradas y registrar tags contenedores y campos
entries = []
off = start_pos
while off < end_pos - 4:
    tag, r = decode_varint(raw_bytes, off)
    if r == 0:
        off += 1
        continue
    fn = tag >> 3
    wt = tag & 7

    if wt == 2:
        entry_len, r2 = decode_varint(raw_bytes, off + r)
        if r2 > 0 and 6 <= entry_len <= 400 and (off + r + r2 + entry_len <= len(raw_bytes)):
            entry_bytes = raw_bytes[off + r + r2 : off + r + r2 + entry_len]
            
            # Decodificar campos internos
            fields = {"_container_tag": tag, "_container_fn": fn, "_entry_len": entry_len}
            e_off = 0
            while e_off < len(entry_bytes):
                etag, er = decode_varint(entry_bytes, e_off)
                if er == 0: break
                e_off += er
                efn = etag >> 3
                ewt = etag & 7
                if ewt == 0:
                    v, er2 = decode_varint(entry_bytes, e_off)
                    e_off += er2
                    fields[f"f_{efn}"] = v
                elif ewt == 2:
                    el, er2 = decode_varint(entry_bytes, e_off)
                    if er2 == 0 or e_off + er2 + el > len(entry_bytes): break
                    e_off += er2
                    sub_d = entry_bytes[e_off : e_off + el]
                    e_off += el
                    if efn == 2:
                        try:
                            fields["date_str"] = sub_d.decode("utf-8")
                        except Exception:
                            fields[f"f_{efn}_raw"] = sub_d.hex()
                    elif efn == 4:
                        # Submensaje item
                        item_fields = {}
                        ioff = 0
                        while ioff < len(sub_d):
                            itag, ir = decode_varint(sub_d, ioff)
                            if ir == 0: break
                            ioff += ir
                            ifn = itag >> 3
                            iwt = itag & 7
                            if iwt == 0:
                                iv, ir2 = decode_varint(sub_d, ioff)
                                ioff += ir2
                                item_fields[f"sub_{ifn}"] = iv
                            elif iwt == 2:
                                il, ir2 = decode_varint(sub_d, ioff)
                                if ir2 == 0 or ioff + ir2 + il > len(sub_d): break
                                ioff += ir2
                                item_fields[f"sub_{ifn}_hex"] = sub_d[ioff:ioff+il].hex()
                                ioff += il
                            else:
                                break
                        fields["item"] = item_fields
                    else:
                        fields[f"f_{efn}_hex"] = sub_d.hex()
                elif ewt == 1:
                    e_off += 8
                elif ewt == 5:
                    e_off += 4
                else:
                    break

            entries.append(fields)
            off += r + r2 + entry_len
            continue
    off += 1

print(f"  Entradas decodificadas: {len(entries)}")

# Agrupar por tag contenedor
tags_found = {}
for e in entries:
    cfn = e.get("_container_fn")
    tags_found[cfn] = tags_found.get(cfn, 0) + 1

print("\n  Distribucion por campo contenedor en 'kyo':")
for cfn, count in sorted(tags_found.items()):
    print(f"    - Campo {cfn} (tag {cfn << 3 | 2:#x}): {count} entradas")

# Buscar objetivos no vendidos conocidos
targets = [
    ("Turmalina", 666666),
    ("Turmalina", 676767),
    ("Mandibula", 99698),
    ("Kuakua", 5499),
    ("Doctobz", 837),
    ("Cuadrabz", 9108),
    ("Blopinturon", 76147),
    ("Aventador", 40147)
]

print("\n" + "=" * 70)
print("  COMPARACION DE CAMPOS ENTRE OBJETOS ESPECIFICOS:")
print("=" * 70)

for label, target_price in targets:
    for e in entries:
        if e.get("f_5") == target_price:
            print(f"\n  [TARGET] [{label}] Precio: {target_price:,} K")
            print(f"     Container Fn: {e.get('_container_fn')} (Tag: {e.get('_container_tag'):#x})")
            print(f"     Date        : {e.get('date_str')}")
            print(f"     Field 1     : {e.get('f_1')}")
            print(f"     Field 3     : {e.get('f_3')}")
            print(f"     Field 6     : {e.get('f_6')}")
            print(f"     Item fields : {e.get('item')}")
            # Imprimir todas las claves de e
            print(f"     Todos los campos: {json.dumps({k: v for k, v in e.items() if not k.startswith('_')})}")
            break

# Guardar análisis en json
with open(OUTPUT_ANALYSIS, "w", encoding="utf-8") as f:
    json.dump(entries, f, indent=2, ensure_ascii=False)
print(f"\n  ✓ Análisis completo guardado en: {OUTPUT_ANALYSIS}")
