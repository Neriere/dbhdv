# -*- coding: utf-8 -*-
"""
sniffers/market_sniffer.py
Captura de precios y cotizaciones de mercadillo en tiempo real.
"""
import os
import sys
import time
import json
import datetime
import threading
import urllib.request
from collections import defaultdict

from core.config import (
    QUOTATIONS_OUTPUT,
    log_sniffer_event,
    load_keymap,
)

from scapy.all import sniff, TCP, Raw, IP
from core.items_db import (
    load_items_dictionary,
    get_item_name,
    is_valid_market_item,
    is_valid_market_ladder,
)
from core.protobuf_decoder import (
    decode_varint,
    decode_packed_varints,
    clean_ladder,
    extract_type_tokens,
)

LAST_MARKET_ITEM_ID = 0
ITEM_SALES_VOLUME = {}
QUOTATION_BUFFERS = {}
QUOTATION_LOCK = threading.Lock()

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
                    if fnum in (1, 2) and (10 <= v <= 65000):
                        if is_valid_market_item(v) or item_id == 0:
                            item_id = v
                    elif fnum == 5 and (10 <= v <= 65000) and (item_id == 0 or not is_valid_market_item(item_id)):
                        item_id = v
                if depth == 1 and fnum in (2, 3, 4) and 50 <= v <= 2_000_000_000 and v != item_id:
                    offer_prices.append(v)
            elif wtype == 2:
                length, r = decode_varint(b, off)
                off += r
                if off + length > len(b):
                    break
                data = b[off:off + length]
                off += length
                if depth < 3:
                    walk(data, depth + 1)
                if depth <= 1:
                    p_ints = decode_packed_varints(data)
                    cl = clean_ladder(p_ints)
                    if 1 <= len(cl) <= 4 and all(p >= 0 for p in cl) and any(p > 10 for p in cl):
                        if is_valid_market_ladder([(fnum, cl)]):
                            ladders.append((fnum, cl))
            elif wtype == 1:
                off += 8
            elif wtype == 5:
                off += 4
            else:
                break
    walk(buf)
    return item_id, ladders, offer_prices

def parse_market_message(buf, market_token="jzn"):
    """
    Decodifica ÚNICAMENTE paquetes que contienen el TypeURL de mercadillo verificado.
    Localiza la sub-estructura protobuf (tag 0x12) tras el TypeURL para aislar
    los datos reales del objeto e ignorar ruido de envoltorio u otros paquetes.
    """
    if not market_token or market_token == "No calibrado":
        market_token = "jzn"
    t_bytes = f"type.ankama.com/{market_token}".encode("ascii")

    # 1. Búsqueda directa por token principal calibrado
    if t_bytes in buf:
        pos = 0
        while True:
            found = buf.find(t_bytes, pos)
            if found == -1:
                break
            tok_end = found + len(t_bytes)
            pos = tok_end

            off_12 = buf.find(bytes([0x12]), tok_end, min(len(buf), tok_end + 30))
            if off_12 == -1:
                sub_payload = buf[tok_end:]
            else:
                off = off_12 + 1
                if off >= len(buf):
                    continue
                payload_len, br = decode_varint(buf, off)
                if br == 0 or off + br + payload_len > len(buf):
                    sub_payload = buf[tok_end:]
                else:
                    off += br
                    sub_payload = buf[off : off + payload_len]

            item_id, ladders, offer_prices = extract_market_universal(sub_payload)
            if item_id >= 10 and (ladders or offer_prices):
                if is_valid_market_item(item_id):
                    global LAST_MARKET_ITEM_ID
                    LAST_MARKET_ITEM_ID = item_id
                    return item_id, ladders, offer_prices


    return 0, [], []


def calculate_quick_price(is_equip, prices):
    """
    Calcula el precio de referencia rápido a partir de la lista de ofertas o escalas del mercadillo.
    """
    if is_equip:
        valid = [int(p) for p in prices if isinstance(p, (int, float)) and p >= 50]
        if not valid:
            return 0
        valid.sort()
        if len(valid) == 1:
            return valid[0]
        elif len(valid) == 2:
            return round((valid[0] + valid[1]) / 2)
        else:
            std = [p for p in valid if p <= valid[0] * 1.8]
            use = std if std else valid
            low = use[:min(3, len(use))]
            low_avg = sum(low) / len(low)
            med = use[len(use) // 2]
            return round(low_avg * 0.7 + med * 0.3)
    else:
        cl = clean_ladder(prices)
        p1 = cl[0] if len(cl) > 0 else 0
        p10 = cl[1] if len(cl) > 1 else 0
        p100 = cl[2] if len(cl) > 2 else 0
        p1000 = cl[3] if len(cl) > 3 else 0
        lots = []
        if p1 > 0: lots.append((p1, 0.40))
        if p10 > 0: lots.append((round(p10 / 10.0), 0.30))
        if p100 > 0: lots.append((round(p100 / 100.0), 0.20))
        if p1000 > 0: lots.append((round(p1000 / 1000.0), 0.10))
        if not lots:
            return 0
        tot_w = sum(w for _, w in lots)
        return round(sum(u * w for u, w in lots) / tot_w)


def save_captured_quotation(item_id, item_name, quotation_data):
    """
    Guarda o actualiza la cotización capturada de un ítem en data/cotizaciones_capturadas.json
    """
    try:
        data = {}
        if os.path.exists(QUOTATIONS_OUTPUT):
            try:
                with open(QUOTATIONS_OUTPUT, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        if not isinstance(data, dict) or "items" not in data:
            data = {
                "metadata": {
                    "lastUpdated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "totalItems": 0
                },
                "items": {}
            }
        data["items"][str(item_id)] = {
            "itemId": item_id,
            "name": item_name,
            "capturedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            **quotation_data
        }
        data["metadata"]["totalItems"] = len(data["items"])
        data["metadata"]["lastUpdated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(QUOTATIONS_OUTPUT, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def _decode_quotation_payload(payload_data, now_ts=None):
    entries_24h = []
    entries_30d = []
    item_id_found = 0

    p_off = 0
    while p_off < len(payload_data):
        tag_e, r_e = decode_varint(payload_data, p_off)
        if r_e == 0:
            break
        p_off += r_e
        fnum_e = tag_e >> 3
        wtype_e = tag_e & 7

        if wtype_e == 0:
            v_val, r_v = decode_varint(payload_data, p_off)
            if r_v == 0:
                break
            p_off += r_v
            if is_valid_market_item(v_val):
                item_id_found = v_val
            continue
        elif wtype_e == 2:
            len_e, r_len_e = decode_varint(payload_data, p_off)
            if r_len_e == 0 or p_off + r_len_e + len_e > len(payload_data):
                break
            p_off += r_len_e
            entry_buf = payload_data[p_off:p_off + len_e]
            p_off += len_e
        elif wtype_e == 1:
            p_off += 8
            continue
        elif wtype_e == 5:
            p_off += 4
            continue
        else:
            break

        e_off = 0
        varints = {}
        strings = {}
        while e_off < len(entry_buf):
            t_f, r_f = decode_varint(entry_buf, e_off)
            if r_f == 0:
                break
            e_off += r_f
            f_num = t_f >> 3
            w_type = t_f & 7
            if w_type == 0:
                v_val, r_v = decode_varint(entry_buf, e_off)
                if r_v == 0:
                    break
                e_off += r_v
                varints[f_num] = v_val
            elif w_type == 2:
                l_str, r_s = decode_varint(entry_buf, e_off)
                if r_s == 0 or e_off + r_s + l_str > len(entry_buf):
                    break
                e_off += r_s
                strings[f_num] = entry_buf[e_off:e_off + l_str].decode("utf-8", errors="ignore")
                e_off += l_str
            elif w_type == 1:
                e_off += 8
            elif w_type == 5:
                e_off += 4
            else:
                break

        # Distinción de protocolo Dofus 3.6 legacy vs Dofus 3.7 oficial
        # En Dofus 3.7 oficial (token ire):
        #   f_num 1 (varint) = price
        #   f_num 2 (varint) = item_id
        #   f_num 3 (string) = date_str (ISO)
        #   f_num 4 (varint) = volume
        if 3 in strings:
            price = varints.get(1, 0)
            iid = varints.get(2, 0)
            date_str = strings.get(3, "")
            vol = varints.get(4, 1)
            if iid > 0 and is_valid_market_item(iid):
                item_id_found = iid
            ts = 0
            if date_str and any(c.isdigit() for c in date_str):
                try:
                    cleaned = date_str.split(".")[0].replace("Z", "+00:00")
                    ts = datetime.datetime.fromisoformat(cleaned).timestamp()
                except Exception:
                    pass
            entry = {"date": date_str, "price": price, "volume": vol, "item_id": iid, "ts": ts}
        elif 2 in strings:
            vol = varints.get(1, 1)
            date_str = strings.get(2, "")
            price = varints.get(3, 0)
            iid = varints.get(4, 0)
            if price == 0 and 4 in varints and not is_valid_market_item(varints[4]):
                price = varints[4]
                iid = 0
            if iid > 0:
                item_id_found = iid
            ts = 0
            if date_str and any(c.isdigit() for c in date_str):
                try:
                    cleaned = date_str.split(".")[0].replace("Z", "+00:00")
                    ts = datetime.datetime.fromisoformat(cleaned).timestamp()
                except Exception:
                    pass
            entry = {"date": date_str, "price": price, "volume": vol, "item_id": iid, "ts": ts}
        else:
            price = varints.get(1, 0)
            v2 = varints.get(2, 0)
            v3 = varints.get(3, 0)
            raw_date = varints.get(4, 0)
            date_str = strings.get(4, "") or strings.get(5, "") or strings.get(2, "")

            if item_id_found > 0:
                if v2 == item_id_found:
                    iid = v2
                    vol = v3 if v3 > 0 else 1
                else:
                    iid = item_id_found
                    vol = v2 if v2 > 0 else 1
            else:
                if is_valid_market_item(v2):
                    iid = v2
                    vol = v3 if v3 > 0 else 1
                    item_id_found = iid
                elif is_valid_market_item(v3):
                    iid = v3
                    vol = v2 if v2 > 0 else 1
                    item_id_found = iid
                else:
                    iid = v2
                    vol = v3 if v3 > 0 else 1
                    if iid > 0:
                        item_id_found = iid

            ts = 0
            if raw_date > 0:
                if raw_date > 1_000_000_000_000:
                    ts = raw_date / 1000.0
                elif raw_date > 1_000_000_000:
                    ts = float(raw_date)
            if ts == 0 and date_str and any(c.isdigit() for c in date_str):
                try:
                    cleaned = date_str.split(".")[0].replace("Z", "+00:00")
                    ts = datetime.datetime.fromisoformat(cleaned).timestamp()
                except Exception:
                    pass
            entry = {"date": date_str, "price": price, "volume": vol, "item_id": iid, "ts": ts}

        if entry and (entry["price"] > 0 or entry["volume"] > 0):
            if fnum_e == 1:
                entries_24h.append(entry)
            elif fnum_e == 2:
                entries_30d.append(entry)
            else:
                entries_30d.append(entry)

    if not entries_24h and not entries_30d:
        return 0, None, None

    if not entries_30d and len(entries_24h) > 24:
        entries_30d = entries_24h
        entries_24h = []

    if entries_24h:
        entries_24h.sort(key=lambda e: e.get("ts", 0))
    if entries_30d:
        entries_30d.sort(key=lambda e: e.get("ts", 0))

    all_ts = [e["ts"] for e in (entries_24h + entries_30d) if e.get("ts", 0) > 0]
    max_ts = max(all_ts) if all_ts else 0

    ref_now = now_ts if now_ts is not None else (max_ts if max_ts > 0 else time.time())
    cutoff_7d = ref_now - (7 * 86400 + 3600)
    cutoff_24h = ref_now - (24 * 3600 + 1800)

    def calculate_weighted_median(items):
        sorted_items = sorted(items, key=lambda x: x[0])
        total_vol = sum(x[1] for x in sorted_items)
        if total_vol == 0:
            return 0
        half_vol = total_vol / 2.0
        cum_vol = 0
        for p, v in sorted_items:
            cum_vol += v
            if cum_vol >= half_vol:
                return p
        return sorted_items[-1][0] if sorted_items else 0

    # 1. Pestaña 24 Horas (Día)
    calc_24h = entries_24h[-22:] if len(entries_24h) >= 22 else entries_24h
    sales24h = sum(e["volume"] for e in calc_24h)
    w_sum_24 = sum(e["price"] * e["volume"] for e in calc_24h)
    price24h = (w_sum_24 // sales24h) if sales24h > 0 else 0
    pairs_24 = [(e["price"], e["volume"]) for e in calc_24h if e["price"] > 0 and e["volume"] > 0]
    median24h = calculate_weighted_median(pairs_24) if pairs_24 else price24h

    # 2. Pestaña 30 Días (Mes)
    sales30d = sum(e["volume"] for e in entries_30d)
    w_sum_30 = sum(e["price"] * e["volume"] for e in entries_30d)
    price30d = (w_sum_30 // sales30d) if sales30d > 0 else 0
    pairs_30 = [(e["price"], e["volume"]) for e in entries_30d if e["price"] > 0 and e["volume"] > 0]
    median30d = calculate_weighted_median(pairs_30) if pairs_30 else price30d

    # 3. Pestaña 7 Días (Semana) - Filtrada de las entradas de 30 días
    if len(entries_30d) >= 28:
        entries_7d = entries_30d[-8:]
    elif any(e.get("ts", 0) > 0 for e in entries_30d):
        entries_7d = [e for e in entries_30d if e.get("ts", 0) >= cutoff_7d]
    else:
        entries_7d = entries_30d[-8:] if len(entries_30d) >= 8 else entries_30d

    sales7d = sum(e["volume"] for e in entries_7d)
    w_sum_7 = sum(e["price"] * e["volume"] for e in entries_7d)
    price7d = (w_sum_7 // sales7d) if sales7d > 0 else 0
    pairs_7 = [(e["price"], e["volume"]) for e in entries_7d if e["price"] > 0 and e["volume"] > 0]
    median7d = calculate_weighted_median(pairs_7) if pairs_7 else price7d

    if sales24h > sales7d:
        sales7d = sales24h
        if price7d == 0 and price24h > 0:
            price7d = price24h
            median7d = median24h
    if sales7d > sales30d:
        sales30d = sales7d
        if price30d == 0 and price7d > 0:
            price30d = price7d
            median30d = median7d

    if sales24h == 0 and sales7d == 0:
        avg_daily = 0.0
    elif sales30d > 0:
        avg_daily = round(sales30d / 30.0, 1)
    elif sales7d > 0:
        avg_daily = round(sales7d / 7.0, 1)
    else:
        avg_daily = float(sales24h)

    def get_robust_period_price(price, median, vol=0):
        if median > 0 and price > 0:
            if price > median * 1.8:
                return median
            if vol >= 2 and median < price:
                return round(median * 0.70 + price * 0.30)
            if price < median * 0.5:
                return median
            return price
        return median if median > 0 else price

    p24_rep = get_robust_period_price(price24h, median24h, sales24h) if (sales24h > 0 and (price24h > 0 or median24h > 0)) else 0
    p7_rep = get_robust_period_price(price7d, median7d, sales7d) if (sales7d > 0 and (price7d > 0 or median7d > 0)) else 0
    p30_rep = get_robust_period_price(price30d, median30d, sales30d) if (sales30d > 0 and (price30d > 0 or median30d > 0)) else 0

    is_active_downtrend = sales24h >= 3 and p24_rep > 0 and p7_rep > 0 and p24_rep < p7_rep * 0.65

    vol_periods = []
    if p24_rep > 0:
        w24 = 0.80 if is_active_downtrend else 0.45
        vol_periods.append({"w": w24, "p": p24_rep})
    if p7_rep > 0:
        w7 = 0.15 if is_active_downtrend else 0.35
        vol_periods.append({"w": w7, "p": p7_rep})
    if p30_rep > 0:
        w30 = 0.05 if is_active_downtrend else 0.20
        vol_periods.append({"w": w30, "p": p30_rep})

    if vol_periods:
        tot_w = sum(vp["w"] for vp in vol_periods)
        suggested_price = int(round(sum(vp["p"] * vp["w"] for vp in vol_periods) / tot_w))
        if is_active_downtrend and suggested_price > p24_rep * 1.4:
            suggested_price = int(round(p24_rep * 1.4))
    else:
        suggested_price = p24_rep or p7_rep or p30_rep or 0

    sales_data = {
        "sales24h": sales24h,
        "price24h": price24h if sales24h > 0 else 0,
        "median24h": median24h if sales24h > 0 else 0,
        "sales7d": sales7d,
        "price7d": price7d if sales7d > 0 else 0,
        "median7d": median7d if sales7d > 0 else 0,
        "sales30d": sales30d,
        "price30d": price30d if sales30d > 0 else 0,
        "median30d": median30d if sales30d > 0 else 0,
        "avgDailySales": avg_daily,
        "suggestedPrice": suggested_price,
        "medianPrice": median24h or median7d or median30d or 0,
        "updatedAt": int(time.time() * 1000)
    }

    if not item_id_found and LAST_MARKET_ITEM_ID:
        item_id_found = LAST_MARKET_ITEM_ID

    return item_id_found, sales_data, entries_30d or entries_24h

def parse_quotation_request(payload):
    """
    Decodifica peticiones salientes (cliente -> servidor) de cotizaciones ('type.ankama.com/iqp').
    Extrae de forma anticipada el item_id solicitado por el usuario antes de recibir la respuesta 'ire'.
    """
    if not payload or b"type.ankama.com/iqp" not in payload:
        return 0
    idx = payload.find(b"type.ankama.com/iqp")
    after = payload[idx + len(b"type.ankama.com/iqp"):]
    off = 0
    while off < len(after):
        tag, r = decode_varint(after, off)
        if r == 0:
            off += 1
            continue
        off += r
        wt = tag & 7
        if wt == 0:
            val, r2 = decode_varint(after, off)
            off += r2
            if val > 0 and is_valid_market_item(val):
                return val
        elif wt == 2:
            sub_len, r2 = decode_varint(after, off)
            off += r2
            sub_buf = after[off:off + sub_len]
            off += sub_len
            s_off = 0
            while s_off < len(sub_buf):
                s_tag, sr = decode_varint(sub_buf, s_off)
                if sr == 0:
                    s_off += 1
                    continue
                s_off += sr
                s_wt = s_tag & 7
                if s_wt == 0:
                    s_val, sr2 = decode_varint(sub_buf, s_off)
                    s_off += sr2
                    if s_val > 0 and is_valid_market_item(s_val):
                        return s_val
                elif s_wt == 2:
                    s_l, sr2 = decode_varint(sub_buf, s_off)
                    s_off += sr2 + s_l
                elif s_wt == 1:
                    s_off += 8
                elif s_wt == 5:
                    s_off += 4
                else:
                    s_off += 1
        elif wt == 1:
            off += 8
        elif wt == 5:
            off += 4
        else:
            off += 1
    return 0

def parse_quotation_message(payload, quotation_token=None, now_ts=None):
    """
    Decodifica paquetes Ankama Protobuf Any de la ventana de Cotizaciones del Mercado.
    Descubrimiento 100% neutral y dinámico sin asumir ningún token previo.
    Extrae simultáneamente las series temporales completas de 24 Horas, 30 Días y 7 Días.
    """
    if not payload:
        return 0, None, None, ""

    candidate_headers = []
    if quotation_token and quotation_token != "No calibrado":
        candidate_headers = [f"type.ankama.com/{quotation_token}".encode("ascii")]
    else:
        # Auto-descubrimiento completamente genérico de cualquier TypeURL presente en el payload
        for tok, _ in extract_type_tokens(payload):
            hdr = f"type.ankama.com/{tok}".encode("ascii")
            if hdr not in candidate_headers:
                candidate_headers.append(hdr)

    for target_header in candidate_headers:
        if target_header not in payload:
            continue
        try:
            tok_name = target_header.decode("ascii", errors="ignore").replace("type.ankama.com/", "")
            idx = payload.find(target_header)
            tok_end = idx + len(target_header)

            off_12 = payload.find(bytes([0x12]), tok_end, min(len(payload), tok_end + 32))
            if off_12 != -1:
                off = off_12 + 1
                len2, r2_len = decode_varint(payload, off)
                off += r2_len
                payload_data = payload[off:off + len2] if len2 > 0 else payload[off:]
            else:
                tag2, r2 = decode_varint(payload, tok_end)
                off = tok_end + r2
                len2, r2_len = decode_varint(payload, off)
                off += r2_len
                payload_data = payload[off:off + len2] if len2 > 0 else payload[off:]

            if len(payload_data) < 10:
                continue

            item_id_found, sales_data, raw_entries = _decode_quotation_payload(payload_data, now_ts)
            if sales_data and (sales_data.get("sales24h", 0) > 0 or sales_data.get("sales30d", 0) > 0 or sales_data.get("price24h", 0) > 0 or sales_data.get("price30d", 0) > 0):
                return item_id_found, sales_data, raw_entries, tok_name
        except Exception:
            continue

    return 0, None, None, ""


def process_packet(pkt):
    """
    Procesa un paquete de red para pruebas unitarias y motor de eventos.
    Soporta reensamblado de fragmentos TCP de cotizaciones ('type.ankama.com/iuk' o 'ive').
    """
    global LAST_MARKET_ITEM_ID
    try:
        if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
            return
        raw_load = bytes(pkt[Raw].load)
        if len(raw_load) == 0:
            return

        # Peticiones salientes cliente -> servidor (iqp)
        if pkt[TCP].dport == 5555:
            if b"type.ankama.com/iqp" in raw_load:
                req_id = parse_quotation_request(raw_load)
                if req_id > 0:
                    LAST_MARKET_ITEM_ID = req_id
            return

        km = load_keymap()
        market_tok = km.get("price_list", "jzs")
        quote_tok = km.get("quotations", "ire")
        if f"type.ankama.com/{market_tok}".encode("ascii") in raw_load:
            item_id, ladders, offer_prices = parse_market_message(raw_load, market_tok)
            if item_id > 0:
                LAST_MARKET_ITEM_ID = item_id

        target_quote_hdr = f"type.ankama.com/{quote_tok}".encode("ascii") if quote_tok != "No calibrado" else None
        has_quote = (
            (target_quote_hdr and target_quote_hdr in raw_load) or
            b"type.ankama.com/ire" in raw_load or
            b"type.ankama.com/iuk" in raw_load or
            b"type.ankama.com/ive" in raw_load
        )
        if pkt.haslayer(IP):
            conn_key = (pkt[IP].src, pkt[TCP].sport, pkt[IP].dst, pkt[TCP].dport)
        else:
            conn_key = pkt[TCP].sport

        with QUOTATION_LOCK:
            in_buffer = conn_key in QUOTATION_BUFFERS

        if in_buffer or has_quote:
            now_t = time.time()
            with QUOTATION_LOCK:
                existing = QUOTATION_BUFFERS.get(conn_key)
                if existing and (now_t - existing.get("ts", 0)) > 4.0:
                    existing = None

                if existing:
                    buf = existing["buf"] + raw_load
                else:
                    found_hdr = None
                    if target_quote_hdr and target_quote_hdr in raw_load:
                        found_hdr = target_quote_hdr
                    elif b"type.ankama.com/ire" in raw_load:
                        found_hdr = b"type.ankama.com/ire"
                    elif b"type.ankama.com/iuk" in raw_load:
                        found_hdr = b"type.ankama.com/iuk"
                    else:
                        found_hdr = b"type.ankama.com/ive"
                    idx = raw_load.find(found_hdr)
                    buf = raw_load[idx:] if idx != -1 else b""

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
                                quotation_payload = buf[idx:total_needed]
                                QUOTATION_BUFFERS.pop(conn_key, None)
                                q_id, s_data, _, _ = parse_quotation_message(quotation_payload)
                                target_id = q_id or LAST_MARKET_ITEM_ID
                                if target_id and s_data:
                                    ITEM_SALES_VOLUME[target_id] = s_data
                            else:
                                if len(buf) < 500000:
                                    QUOTATION_BUFFERS[conn_key] = {"buf": buf, "ts": now_t}
                                else:
                                    QUOTATION_BUFFERS.pop(conn_key, None)
                        else:
                            QUOTATION_BUFFERS[conn_key] = {"buf": buf, "ts": now_t}
                    else:
                        QUOTATION_BUFFERS[conn_key] = {"buf": buf, "ts": now_t}
                else:
                    QUOTATION_BUFFERS.pop(conn_key, None)
    except Exception:
        pass


def run_sniffer_market():
    km = load_keymap()
    market_token = km.get("price_list", "jzs")
    quotation_token = km.get("quotations", "No calibrado")
    server_slug = os.environ.get("DOFUS_SERVER", "draconiros").strip().lower()

    print("\n" + "=" * 70)
    print("  [SNIFFER DUAL] MERCADILLO Y COTIZACIONES EN VIVO")
    print("=" * 70)
    print(f"  • Token Mercadillo  : '{market_token}' -> Envío directo a DBHDV")
    print(f"  • Token Cotizaciones: '{quotation_token}' (Auto-detección activa) -> Envío a DBHDV")
    print(f"  • Servidor Activo   : {server_slug.capitalize()} (Puerto: 5555)")
    print("  Instrucciones:")
    print("  1. Abre el Mercadillo en Dofus Unity y busca objetos en la pestaña 'COMPRAR'.")
    print("  2. Haz clic en el icono de gráfico (📈) de cotizaciones para capturar tendencias.")
    print("  3. Presiona CTRL+C para volver al menú principal en cualquier momento.")
    print("-" * 70)

    init_session_log("MERCADILLO_DUAL")
    load_items_dictionary()

    session_market_updates = 0
    session_quotations_count = 0
    market_sent_count = 0

    market_queue = queue.Queue()

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

    def on_packet(packet):
        nonlocal session_market_updates, session_quotations_count, quotation_token
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

        now_str = datetime.datetime.now().strftime("%H:%M:%S")

        # 1. Precios de Mercadillo (jzn)
        item_id, ladders, offer_prices = parse_market_message(payload, market_token)
        if item_id > 0 and (ladders or offer_prices):
            item_name = get_item_name(item_id)
            payload_dict = {
                "item_id": item_id,
                "server": server_slug,
            }
            if ladders:
                ladder_vals = ladders[0][1][:4]
                lad_dict = {str(10**i): p for i, p in enumerate(ladder_vals) if p > 0}
                payload_dict["ladders"] = lad_dict
                payload_dict["prices"] = lad_dict
                payload_dict["precios"] = lad_dict
                lad_str = " | ".join(f"x{k}: {v:,} K" for k, v in lad_dict.items())
                print(f"  [{now_str}] 📦 {item_name} (#{item_id}) -> {lad_str}")
                log_sniffer_event("MERCADILLO", f"{item_name} (#{item_id}) -> {lad_str}", payload=payload)
            elif offer_prices:
                top_5 = sorted(offer_prices)[:5]
                payload_dict["prices"] = top_5
                top_3 = top_5[:3]
                lad_str = ", ".join(f"{p:,} K" for p in top_3)
                print(f"  [{now_str}] 🛡️ {item_name} (#{item_id}) [Equipamiento] -> Mínimos: {lad_str}")
                log_sniffer_event("MERCADILLO_EQUIPO", f"{item_name} (#{item_id}) -> Mínimos: {lad_str}", payload=payload)

            market_queue.put(payload_dict)
            session_market_updates += 1

        # 2. Cotizaciones del Mercado con reensamblado TCP
        target_quote_hdr = f"type.ankama.com/{quotation_token}".encode("ascii") if quotation_token != "No calibrado" else None
        has_quotation = False
        if target_quote_hdr and target_quote_hdr in payload:
            has_quotation = True
        elif b"type.ankama.com/ire" in payload or b"type.ankama.com/iuk" in payload or b"type.ankama.com/ive" in payload:
            has_quotation = True
        elif len(payload) > 80 and b"type.ankama.com/" in payload:
            for tok, _ in extract_type_tokens(payload):
                if tok != market_token and tok not in (km.get("inventory"), km.get("storage")):
                    has_quotation = True
                    break

        conn_key = (packet[IP].src, packet[TCP].sport, packet[IP].dst, packet[TCP].dport) if packet.haslayer(IP) else packet[TCP].sport
        with QUOTATION_LOCK:
            in_quote_buf = conn_key in QUOTATION_BUFFERS

        if in_quote_buf or has_quotation:
            quote_complete_payload = None
            now = time.time()
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
                    elif b"type.ankama.com/ive" in payload:
                        found_hdr = b"type.ankama.com/ive"
                    else:
                        for tok, _ in extract_type_tokens(payload):
                            if tok != market_token and tok not in (km.get("inventory"), km.get("storage")):
                                found_hdr = f"type.ankama.com/{tok}".encode("ascii")
                                break
                    idx = payload.find(found_hdr) if found_hdr else -1
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
                else:
                    for tok, _ in extract_type_tokens(buf):
                        if tok != market_token and tok not in (km.get("inventory"), km.get("storage")):
                            found_hdr = f"type.ankama.com/{tok}".encode("ascii")
                            break

                if buf and found_hdr:
                    idx = buf.find(found_hdr)
                    tok_end = idx + len(found_hdr)
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
                q_id, s_data, _, decoded_tok = parse_quotation_message(quote_complete_payload, quotation_token=quotation_token)
                target_id = q_id or LAST_MARKET_ITEM_ID
                if target_id > 0 and s_data:
                    if quotation_token == "No calibrado" and decoded_tok:
                        quotation_token = decoded_tok
                        save_keymap_entry("quotations", decoded_tok)
                        print(f"  [Auto-Calibración] Token de cotizaciones guardado: '{decoded_tok}'")
                    target_name = get_item_name(target_id)
                    s24 = s_data.get("sales24h", 0)
                    p24 = s_data.get("price24h", 0)
                    s7 = s_data.get("sales7d", 0)
                    p7 = s_data.get("price7d", 0)
                    s30 = s_data.get("sales30d", 0)
                    p30 = s_data.get("price30d", 0)
                    sug_p = s_data.get("suggestedPrice", 0)
                    print(f"\n  [{now_str}] 📈 [Cotización] {target_name} (#{target_id})")
                    print(f"       • 24h: {s24:,} ventas ({p24:,} K) | 7d: {s7:,} ventas ({p7:,} K) | 30d: {s30:,} ventas ({p30:,} K)")
                    print(f"       • Sugerido : {sug_p:,} K\n")
                    log_sniffer_event("COTIZACION", f"{target_name} (#{target_id}) -> 24h:{s24}v | 7d:{s7}v | 30d:{s30}v | Sug:{sug_p}K", payload=quote_complete_payload)

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

    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n\n" + "=" * 70)
        print("  RESUMEN DE SESIÓN DE MERCADILLO FINALIZADA")
        print("=" * 70)
        print(f"  • Precios capturados en vivo : {session_market_updates} ({market_sent_count} sincronizados con DBHDV)")
        print(f"  • Cotizaciones capturadas     : {session_quotations_count} (guardadas en data/cotizaciones_capturadas.json)")
        print("=" * 70)
    finally:
        if sniffer.running:
            sniffer.stop()
        market_queue.put(None)


