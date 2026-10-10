# -*- coding: utf-8 -*-
"""
core/protobuf_decoder.py
Decodificación de varints y estructuras protobuf de Dofus Unity 3.6.
"""
import struct
import re
from core.items_db import get_item_name

def decode_varint(buf, offset=0):
    val = 0
    shift = 0
    pos = offset
    while pos < len(buf):
        b = buf[pos]
        val |= (b & 0x7F) << shift
        pos += 1
        if not (b & 0x80):
            return val, pos - offset
        shift += 7
        if shift >= 64:
            break
    return 0, 0

def decode_packed_varints(data):
    nums = []
    off = 0
    while off < len(data):
        v, r = decode_varint(data, off)
        if r == 0:
            break
        nums.append(v)
        off += r
    return nums

def clean_ladder(raw_list):
    if not raw_list:
        return []
    cl = [int(p) for p in raw_list if p is not None]
    if not cl:
        return []

    # 1. Prefijo de conteo exacto de Dofus Unity (len == count + 1)
    if len(cl) > 1 and 1 <= cl[0] <= 10 and len(cl) == cl[0] + 1:
        cl = cl[1:]
    # 2. Prefijo SuperTypeId / Categoría (ej: [6, 1370, 13486, 135900, 1398990])
    elif len(cl) == 5 and cl[0] <= 100:
        if cl[0] <= 20 or (cl[1] > 0 and cl[2] >= cl[1]):
            cl = cl[1:]

    # En Dofus los recursos tienen MÁXIMO 4 escalas: x1, x10, x100, x1000
    cleaned = []
    for x in cl[:4]:
        if x == 0 or 50 <= x <= 2_000_000_000:
            cleaned.append(x)
        else:
            cleaned.append(0)
    while cleaned and cleaned[-1] == 0:
        cleaned.pop()
    return cleaned

def extract_type_tokens(buf):
    tokens = []
    for m in re.finditer(rb'type\.ankama\.com/([a-z0-9]+(?:\.[a-z0-9]+)*)', buf):
        tok = m.group(1).decode("ascii", errors="ignore")
        tokens.append((tok, m.start()))
    return tokens

def parse_dofus_item_submessage(sub):
    off = 0
    sub_fields = {}
    inner_item = None
    while off < len(sub):
        t, r = decode_varint(sub, off)
        if r == 0:
            break
        off += r
        fn = t >> 3
        wt = t & 7
        if wt == 0:
            v, r2 = decode_varint(sub, off)
            off += r2
            sub_fields[fn] = v
        elif wt == 2:
            l, r2 = decode_varint(sub, off)
            if r2 == 0 or off + r2 + l > len(sub):
                break
            off += r2
            inner_bytes = sub[off:off + l]
            off += l
            if fn in (1, 4, 5) and len(inner_bytes) >= 8:
                res = parse_dofus_item_submessage(inner_bytes)
                if res:
                    inner_item = res
        elif wt == 1:
            off += 8
        elif wt == 5:
            off += 4
        else:
            break

    # Si hay un ObjectItem anidado dentro de un wrapper de slot (Field 1), ese es el objeto real
    if inner_item:
        return inner_item

    # Dofus Unity 3.6: Field 4 es GID, Field 3 es Qty, Field 5 es UID
    if 4 in sub_fields and 10 <= sub_fields[4] <= 70000 and 5 in sub_fields:
        gid = sub_fields[4]
        qty = sub_fields.get(3, 1)
        uid = sub_fields.get(5, 0)
        return (gid, qty, uid)

    # Legacy: Field 5 es GID, Field 2 es Qty, Field 1 es UID
    if 5 in sub_fields and 10 <= sub_fields[5] <= 70000 and 1 in sub_fields:
        gid = sub_fields[5]
        qty = sub_fields.get(2, sub_fields.get(3, 1))
        uid = sub_fields.get(1, 0)
        return (gid, qty, uid)

    # Alternate: Field 1 es GID, Field 3 es Qty
    if 1 in sub_fields and 10 <= sub_fields[1] <= 70000 and 3 in sub_fields:
        gid = sub_fields[1]
        qty = sub_fields.get(3, 1)
        uid = sub_fields.get(5, 0)
        return (gid, qty, uid)

    return None

def extract_items_recursive(buf):
    items = []
    seen_keys = set()

    def walk(b, depth=0):
        if depth > 6 or len(b) < 6:
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
            fnum = tag >> 3
            wtype = tag & 7

            if wtype == 2:
                length, r2 = decode_varint(b, off)
                if r2 == 0:
                    off += 1
                    continue
                off += r2
                if off + length <= len(b):
                    sub_data = b[off:off + length]
                    off += length
                else:
                    sub_data = b[off:]
                    off = len(b)

                item = parse_dofus_item_submessage(sub_data)
                if item:
                    gid, qty, uid = item
                    key = uid if uid > 0 else (gid, len(items))
                    if key not in seen_keys:
                        seen_keys.add(key)
                        items.append(item)
                    else:
                        # Si ya existe pero el nuevo tiene mayor cantidad (ej. total unificado que incluye banco)
                        for idx_it, prev_it in enumerate(items):
                            if (prev_it[2] == uid and uid > 0) or (prev_it[0] == gid and uid == 0):
                                if qty > prev_it[1]:
                                    items[idx_it] = item
                                break
                else:
                    walk(sub_data, depth + 1)
            elif wtype == 0:
                _, r2 = decode_varint(b, off)
                off += r2
            elif wtype == 1:
                off += 8
            elif wtype == 5:
                off += 4
            else:
                off += 1

    walk(buf)
    return items

