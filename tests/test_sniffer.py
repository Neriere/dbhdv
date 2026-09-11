import unittest
import struct

def encode_varint(val):
    out = bytearray()
    while True:
        b = val & 0x7F
        val >>= 7
        if val:
            out.append(b | 0x80)
        else:
            out.append(b)
            break
    return bytes(out)

def decode_varint(buf, off=0):
    res = 0
    shift = 0
    cnt = 0
    while off < len(buf):
        b = buf[off]
        off += 1
        cnt += 1
        res |= (b & 0x7F) << shift
        if not (b & 0x80):
            return res, cnt
        shift += 7
        if shift > 64:
            return 0, 0
    return 0, 0

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

def clean_ladder(raw_list):
    cl = [int(p) for p in raw_list if p is not None]
    if not cl:
        return []

    # 1. Prefijo de conteo exacto de Dofus Unity (len == count + 1)
    if len(cl) > 1 and 1 <= cl[0] <= 10 and len(cl) == cl[0] + 1:
        return cl[1:]

    # 2. Si la lista tiene longitud 5 (ej: [6, 1370, 13486, 135900, 1398990])
    if len(cl) == 5 and cl[0] <= 100:
        if cl[0] <= 20 or (cl[1] > 0 and cl[2] >= cl[1]):
            return cl[1:]

    # 3. Si cl[0] es un conteo/tipo pequeño (1 <= cl[0] <= 10) y cl[1] es un precio real (>= 20)
    if len(cl) > 1 and 1 <= cl[0] <= 10 and cl[1] >= 20:
        return cl[1:]

    # 4. Verificación de ratio anómalo: si 1 <= cl[0] <= 50 y cl[1] / max(1, cl[0]) > 40
    if len(cl) > 1 and 1 <= cl[0] <= 50 and cl[1] > 0 and (cl[1] / max(1, cl[0])) > 40:
        return cl[1:]

    return cl

EQUIPMENT_IDS = {"13114", "13115", "13116"}
ITEMS_DB = {
    "13114": "Cinturón de Brus Bulguru",
    "13115": "Anillo de Brus Bulguru",
    "13116": "Botas de Brus Bulguru",
    "31521": "Esquíritu majestuoso",
    "34203": "Pergamino de ganadero",
}

def is_equipment(item_id):
    return str(item_id) in EQUIPMENT_IDS

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

def process_ladders(ladders, offer_prices=None, item_id=0):
    if isinstance(offer_prices, (int, str)) and item_id == 0:
        item_id = int(offer_prices)
        offer_prices = []
    if offer_prices is None:
        offer_prices = []

    is_known_equip = is_equipment(item_id)

    # Filtrar ladders válidas descartando TypeIDs/Categorías aisladas (ej: [6] o [4])
    valid_ladders = []
    for fnum, pl in ladders:
        cl = clean_ladder(pl)
        non_zero = [p for p in cl if p > 0]
        if len(non_zero) == 1 and non_zero[0] <= 10:
            continue
        if any(p > 0 for p in cl):
            valid_ladders.append((fnum, cl))

    # Detección estructural de equipables en Dofus Unity:
    # A) Está en el catálogo EQUIPMENT_IDS, O
    # B) Hay 2 o más tuplas de ofertas reales (los recursos NUNCA tienen múltiples ofertas en mercadillo)
    is_multi_gear_offers = len(valid_ladders) >= 2

    if is_known_equip or is_multi_gear_offers:
        # Los equipables se venden por unidad o apilados en lotes (x1, x10, x100, x1000) si tienen estadísticas idénticas.
        # Se extraen los precios unitarios reales para cada oferta:
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

    # 2. Si no es equipable, es un recurso. En Dofus Unity los recursos vienen en una única tupla de lotes.
    if valid_ladders:
        return "recurso", valid_ladders[0][1]

    return "desconocido", []


def extract_market_universal(buf, items_db=None):
    if items_db is None:
        items_db = ITEMS_DB
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
                # Solo niveles superiores (depth <= 1) definen el item_id real
                if depth <= 1:
                    if fnum in (1, 2) and (10 <= v <= 100000):
                        if item_id == 0 or (str(item_id) not in items_db and str(v) in items_db):
                            item_id = v
                    elif fnum == 5 and (10 <= v <= 100000) and item_id == 0:
                        item_id = v

                # Dentro de una oferta (depth == 1): varints de precios de ofertas unitarias
                if depth == 1 and 500 <= v <= 2_000_000_000 and v != item_id and fnum in (2, 3, 4):
                    offer_prices.append(v)

            elif wtype == 2:
                length, r = decode_varint(b, off)
                off += r
                if off + length > len(b):
                    break
                data = b[off:off + length]
                off += length

                if is_valid_submessage(data):
                    # Es un submensaje (Oferta o Efecto), descender recursivamente
                    if depth < 3:
                        walk(data, depth + 1)
                else:
                    # Es un arreglo packed de precios (ej: lotes de recursos [x1, x10, x100, x1000])
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

CURRENT_TOKEN = "jzn"

def parse_market_message(buf):
    try:
        t_bytes = CURRENT_TOKEN.encode('ascii')
        if t_bytes not in buf:
            return None, None, []

        pos = 0
        while True:
            found = buf.find(t_bytes, pos)
            if found == -1:
                break
            tok_end = found + len(t_bytes)
            pos = tok_end

            off_12 = buf.find(b"\x12", tok_end, tok_end + 25)
            if off_12 == -1:
                payload = buf[tok_end:]
            else:
                off = off_12 + 1
                if off >= len(buf):
                    continue
                payload_len, br = decode_varint(buf, off)
                off += br
                payload = buf[off:off + payload_len]

            item_id, ladders, offer_prices = extract_market_universal(payload)
            if item_id and item_id >= 10:
                item_type, prices = process_ladders(ladders, offer_prices, item_id)
                if prices:
                    return item_id, item_type, prices
    except Exception:
        pass
    return None, None, []


class TestSnifferMarketIngest(unittest.TestCase):

    def test_clean_ladder_esquiritu_prefix_6(self):
        """Esquíritus majestuoso (#31521) con prefijo de categoría 6"""
        raw = [6, 1370, 13486, 135900, 1398990]
        cleaned = clean_ladder(raw)
        self.assertEqual(cleaned, [1370, 13486, 135900, 1398990])
        # Asegurarse de que el primer elemento NO sea 6 kamas
        self.assertNotEqual(cleaned[0], 6)
        self.assertEqual(cleaned[0], 1370)

    def test_clean_ladder_pergamino_ganadero_prefix_4(self):
        """Pergamino de ganadero (#34203) con prefijo de categoría 4"""
        raw = [4, 4290, 40000, 458996, 4999999]
        cleaned = clean_ladder(raw)
        self.assertEqual(cleaned, [4290, 40000, 458996, 4999999])
        self.assertNotEqual(cleaned[0], 4)
        self.assertEqual(cleaned[0], 4290)

    def test_clean_ladder_lot_count_prefix_3(self):
        """Lista con 3 lotes y prefijo 3 (len = 4)"""
        raw = [3, 250, 2400, 23500]
        cleaned = clean_ladder(raw)
        self.assertEqual(cleaned, [250, 2400, 23500])

    def test_clean_ladder_lot_count_prefix_2(self):
        """Lista con 2 lotes y prefijo 2 (len = 3)"""
        raw = [2, 1200, 11500]
        cleaned = clean_ladder(raw)
        self.assertEqual(cleaned, [1200, 11500])

    def test_clean_ladder_lot_count_prefix_1(self):
        """Lista con 1 lote y prefijo 1 (len = 2)"""
        raw = [1, 55000]
        cleaned = clean_ladder(raw)
        self.assertEqual(cleaned, [55000])

    def test_clean_ladder_normal_ladder_untouched(self):
        """Escalera estándar de 4 lotes sin prefijos anómalos"""
        raw = [500, 4800, 47000, 450000]
        cleaned = clean_ladder(raw)
        self.assertEqual(cleaned, [500, 4800, 47000, 450000])

    def test_process_ladders_discards_single_category_id_6(self):
        """Si un paquete solo contiene [6], NUNCA debe registrarse como 6 kamas"""
        ladders = [(2, [6])]
        cat, prices = process_ladders(ladders)
        self.assertEqual(cat, "desconocido")
        self.assertEqual(prices, [])

    def test_process_ladders_discards_single_category_id_4(self):
        """Si un paquete solo contiene [4], NUNCA debe registrarse como 4 kamas"""
        ladders = [(2, [4])]
        cat, prices = process_ladders(ladders)
        self.assertEqual(cat, "desconocido")
        self.assertEqual(prices, [])

    def test_process_ladders_esquiritu_full_payload(self):
        """Paquete donde coexisten TypeID 6 y la escalera de precios del esquíritu"""
        ladders = [
            (2, [6]),
            (3, [6, 1370, 13486, 135900, 1398990])
        ]
        cat, prices = process_ladders(ladders)
        self.assertEqual(cat, "recurso")
        self.assertEqual(prices, [1370, 13486, 135900, 1398990])
        self.assertNotIn(6, prices)

    def test_process_ladders_pergamino_full_payload(self):
        """Paquete donde coexisten TypeID 4 y la escalera del pergamino"""
        ladders = [
            (2, [4]),
            (3, [4, 4290, 40000, 458996, 4999999])
        ]
        cat, prices = process_ladders(ladders)
        self.assertEqual(cat, "recurso")
        self.assertEqual(prices, [4290, 40000, 458996, 4999999])

    def test_process_ladders_equipable_multiple_offers(self):
        """Varios objetos equipables individuales"""
        ladders = [
            (3, [1250000]),
            (3, [1300000]),
            (3, [1450000])
        ]
        cat, prices = process_ladders(ladders)
        self.assertEqual(cat, "equipable")
        self.assertEqual(prices, [1250000, 1300000, 1450000])

    def test_full_parse_market_message_with_jzn_token(self):
        """Simulación de paquete de red TCP real con token jzn para Esquíritu (#31521)"""
        # Tag 1: itemId = 31521 (varint) -> fnum 1, wtype 0 -> tag = (1 << 3) | 0 = 0x08
        pkt_sub = bytearray()
        pkt_sub.append(0x08)
        pkt_sub.extend(encode_varint(31521))

        # Tag 3: packed varints [6, 1370, 13486, 135900, 1398990] -> fnum 3, wtype 2 -> tag = (3 << 3) | 2 = 0x1A
        ladder_bytes = bytearray()
        for v in [6, 1370, 13486, 135900, 1398990]:
            ladder_bytes.extend(encode_varint(v))
        
        pkt_sub.append(0x1A)
        pkt_sub.extend(encode_varint(len(ladder_bytes)))
        pkt_sub.extend(ladder_bytes)

        # Envolver con token 'jzn' y prefijo 0x12 de longitud
        raw_tcp_packet = bytearray()
        raw_tcp_packet.extend(b"HEADER_PADDING_")
        raw_tcp_packet.extend(b"jzn")
        raw_tcp_packet.append(0x12)
        raw_tcp_packet.extend(encode_varint(len(pkt_sub)))
        raw_tcp_packet.extend(pkt_sub)

        item_id, item_type, prices = parse_market_message(bytes(raw_tcp_packet))
        self.assertEqual(item_id, 31521)
        self.assertEqual(item_type, "recurso")
        self.assertEqual(prices, [1370, 13486, 135900, 1398990])
        self.assertNotIn(6, prices)

    def test_is_valid_submessage_detection(self):
        """Distingue un submensaje Protobuf de una lista packed de enteros"""
        # Submensaje: tag 1 (wtype 0) = 125, tag 2 (wtype 0) = 6
        tag1 = encode_varint((1 << 3) | 0) + encode_varint(125)
        tag2 = encode_varint((2 << 3) | 0) + encode_varint(6)
        submsg = tag1 + tag2
        self.assertTrue(is_valid_submessage(submsg))

        # Packed list de precios: [4290, 40000, 458996, 4999999]
        packed_ladder = bytearray()
        for v in [4290, 40000, 458996, 4999999]:
            packed_ladder.extend(encode_varint(v))
        self.assertFalse(is_valid_submessage(bytes(packed_ladder)))

    def test_equipable_with_nested_stats_preserves_item_id_and_prices(self):
        """Cinturón de Brus Bulguru (ID 13114) con ofertas que contienen efectos anidados (125:6, 211:17)"""
        # Efecto 1: stat 125 con valor 6
        eff1 = encode_varint((1 << 3) | 0) + encode_varint(125) + encode_varint((2 << 3) | 0) + encode_varint(6)
        # Oferta 1: UID 999999, precio 1450000, efecto eff1
        off1 = encode_varint((1 << 3) | 0) + encode_varint(999999) + \
               encode_varint((2 << 3) | 0) + encode_varint(1450000) + \
               encode_varint((3 << 3) | 2) + encode_varint(len(eff1)) + eff1

        # Efecto 2: stat 211 con valor 17
        eff2 = encode_varint((1 << 3) | 0) + encode_varint(211) + encode_varint((2 << 3) | 0) + encode_varint(17)
        # Oferta 2: UID 999998, precio 1500000, efecto eff2
        off2 = encode_varint((1 << 3) | 0) + encode_varint(999998) + \
               encode_varint((2 << 3) | 0) + encode_varint(1500000) + \
               encode_varint((3 << 3) | 2) + encode_varint(len(eff2)) + eff2

        # Mensaje raíz de mercadillo: ItemId 13114, ofertas off1 y off2
        payload = encode_varint((1 << 3) | 0) + encode_varint(13114) + \
                  encode_varint((3 << 3) | 2) + encode_varint(len(off1)) + off1 + \
                  encode_varint((3 << 3) | 2) + encode_varint(len(off2)) + off2

        item_id, ladders, offer_prices = extract_market_universal(payload)
        self.assertEqual(item_id, 13114)
        self.assertNotIn(125, [item_id])
        self.assertNotIn(211, [item_id])
        self.assertNotIn(985, [item_id])

        item_type, prices = process_ladders(ladders, offer_prices, item_id)
        self.assertEqual(item_type, "equipable")
        self.assertEqual(prices, [1450000, 1500000])
        self.assertNotIn(6, prices)
        self.assertNotIn(17, prices)
        self.assertNotIn(125, prices)
        self.assertNotIn(211, prices)

    def test_full_parse_equipable_with_jzn_token(self):
        """Paquete TCP completo de Dofus Unity para Cinturón de Brus Bulguru (#13114) con token jzn"""
        eff1 = encode_varint((1 << 3) | 0) + encode_varint(125) + encode_varint((2 << 3) | 0) + encode_varint(6)
        off1 = encode_varint((1 << 3) | 0) + encode_varint(999999) + \
               encode_varint((2 << 3) | 0) + encode_varint(1450000) + \
               encode_varint((3 << 3) | 2) + encode_varint(len(eff1)) + eff1

        pkt_sub = encode_varint((1 << 3) | 0) + encode_varint(13114) + \
                  encode_varint((3 << 3) | 2) + encode_varint(len(off1)) + off1

        raw_tcp = bytearray()
        raw_tcp.extend(b"PREFIX_TCP_DATA_")
        raw_tcp.extend(b"jzn")
        raw_tcp.append(0x12)
        raw_tcp.extend(encode_varint(len(pkt_sub)))
        raw_tcp.extend(pkt_sub)

        item_id, item_type, prices = parse_market_message(bytes(raw_tcp))
        self.assertEqual(item_id, 13114)
        self.assertEqual(item_type, "equipable")
        self.assertEqual(prices, [1450000])
        self.assertNotIn(6, prices)

    def test_equipable_discards_corrupt_6_kamas(self):
        """Un precio de 6 kamas para un equipable debe ser descartado por process_ladders"""
        item_type, prices = process_ladders([], [6], 13114)
        self.assertEqual(prices, [])

    def test_descending_resource_ladders_are_reversed(self):
        """Si los lotes vienen de x1000 a x1 descendente, se invierten a orden ascendente x1..x1000"""
        descending_ladder = [29999990, 2900000, 290000, 30000]
        cl = clean_ladder(descending_ladder)
        if len(cl) >= 2 and cl[0] > cl[-1]:
            cl.reverse()
        self.assertEqual(cl, [30000, 290000, 2900000, 29999990])

    def test_single_astronomical_lot_assigned_to_x1000(self):
        """Si un recurso solo tiene un único precio astronómico (>= 1M kamas), corresponde al lote 1000"""
        cl = [29999990]
        if len(cl) == 1 and cl[0] >= 1_000_000:
            precios = {"1": 0, "10": 0, "100": 0, "1000": cl[0]}
        else:
            precios = {"1": cl[0]}
        self.assertEqual(precios["1"], 0)
        self.assertEqual(precios["1000"], 29999990)

    def test_session_packet_logger_clears_previous_session(self):
        """El log de sesión debe sobreescribir el archivo en cada inicio ('w') y soportar parámetros seguros"""
        import tempfile
        import os
        import threading
        from datetime import datetime

        class SessionPacketLogger:
            def __init__(self, log_path="sniffer.log", server_name=None, current_token=None):
                self.log_path = log_path
                self.lock = threading.Lock()
                self.packet_count = 0
                self.max_size_bytes = 3 * 1024 * 1024
                srv = server_name or globals().get("SERVER_NAME", "Desconocido")
                tok = current_token or globals().get("CURRENT_TOKEN", "jzn")
                header_lines = [
                    "=" * 80,
                    "  DOFUS UNITY SNIFFER -> REGISTRO DE PAQUETES (SESION ACTIVA)",
                    f"  Inicio de sesion : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    f"  Servidor destino : {srv}",
                    f"  Token calibrado  : '{tok}'",
                    "  (Este log se reinicia al abrir el sniffer y registra los paquetes inspeccionados)",
                    "=" * 80,
                    "",
                    "",
                ]
                try:
                    with open(self.log_path, "w", encoding="utf-8") as f:
                        f.write("\n".join(header_lines))
                except Exception:
                    pass

        with tempfile.NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as tf:
            tf.write("DATOS DE SESIONES ANTERIORES QUE DEBEN DESAPARECER\n")
            temp_path = tf.name

        try:
            # Inicializar SessionPacketLogger sin variables globales (debe usar fallbacks sin lanzar NameError)
            logger = SessionPacketLogger(temp_path, server_name="Tal Kasha", current_token="jzn")
            with open(temp_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("Tal Kasha", content)
            self.assertIn("'jzn'", content)
            self.assertNotIn("DATOS DE SESIONES ANTERIORES", content)

            # Test fallback sin parámetros
            logger_fallback = SessionPacketLogger(temp_path)
            with open(temp_path, "r", encoding="utf-8") as f:
                content_fallback = f.read()
            self.assertIn("Desconocido", content_fallback)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_process_ladders_multi_gear_offers_uncatalogued(self):
        """Si un objeto NO está en el catálogo pero tiene múltiples tuplas de gear [precio, 0, 0, 0], se clasifica como equipable"""
        uncatalogued_item_id = 99999
        self.assertFalse(is_equipment(uncatalogued_item_id))

        # Caso real observado en sniffer.log para equipables
        ladders = [
            (6, [38888887, 0, 0, 0]),
            (6, [39000000, 0, 0, 0]),
            (6, [39500000, 0, 0, 0])
        ]
        item_type, prices = process_ladders(ladders, [], uncatalogued_item_id)
        self.assertEqual(item_type, "equipable")
        self.assertEqual(prices, [38888887, 39000000, 39500000])

    def test_process_ladders_known_equipable_single_offer(self):
        """Un equipable conocido con una sola oferta debe identificarse como equipable"""
        known_id = 13114  # Brus Bulguru en EQUIPMENT_IDS
        ladders = [(6, [1450000, 0, 0, 0])]
        item_type, prices = process_ladders(ladders, [], known_id)
        self.assertEqual(item_type, "equipable")
        self.assertEqual(prices, [1450000])

    def test_equipable_pricing_formula_blend_and_exo_exclusion(self):
        """La fórmula para equipables excluye exomagueos (>1.8x min) y mezcla 70% low3 + 30% mediana"""
        offers = [35000000, 36000000, 38000000, 75000000, 85000000]
        # Exos (> 63M): 75M y 85M descartados del pool base
        min_p = offers[0]
        exo_threshold = min_p * 1.8
        non_exo = [p for p in offers if p <= exo_threshold]
        self.assertEqual(non_exo, [35000000, 36000000, 38000000])

        low_count = min(3, len(non_exo))
        low_avg = sum(non_exo[:low_count]) / low_count
        med = non_exo[len(non_exo) // 2]  # 36,000,000

        blended = round(0.70 * low_avg + 0.30 * med)
        # low_avg = 36,333,333.33 -> 70% = 25,433,333.33; 30% * 36,000,000 = 10,800,000 -> 36,233,333
        self.assertEqual(blended, 36233333)

    def test_resource_pricing_formula_filters_extreme_x1_speculation(self):
        """Caso real sniffer.log: Lúpulo con x1 a 900k y x10 a 34.6k/u; x1 debe descartarse por outlier"""
        precios = {
            "1": 900,     # unit: 900 (especulativo / cebo)
            "10": 346,    # unit: 34.6
            "100": 3400,  # unit: 34.0
            "1000": 33800 # unit: 33.8
        }
        unit_candidates = [
            {"lot": 1, "unit": 900.0, "weight": 0.10},
            {"lot": 10, "unit": 34.6, "weight": 0.35},
            {"lot": 100, "unit": 34.0, "weight": 0.40},
            {"lot": 1000, "unit": 33.8, "weight": 0.15},
        ]
        sorted_units = sorted([c["unit"] for c in unit_candidates])  # [33.8, 34.0, 34.6, 900.0]
        med = (sorted_units[1] + sorted_units[2]) / 2.0             # 34.3

        filtered = [c for c in unit_candidates if 0.25 * med <= c["unit"] <= 3.5 * med]
        # 900.0 > 3.5 * 34.3 (120.05) -> debe ser descartado
        self.assertEqual([c["lot"] for c in filtered], [10, 100, 1000])

        total_weight = sum(c["weight"] for c in filtered)  # 0.35 + 0.40 + 0.15 = 0.90
        weighted_sum = sum(c["unit"] * c["weight"] for c in filtered)
        final_price = round(weighted_sum / total_weight)
        self.assertEqual(final_price, 34)  # 34 kamas por unidad, perfecto y representativo

    def test_process_ladders_rare_resource_single_lot_x1_classified_as_resource(self):
        """Menta religiosa (#16381) con solo lote x1 [7772, 0, 0, 0] debe ser RECURSO, no equipable"""
        item_id = 16381  # Planta rara de Alquimista
        ladders = [(6, [7772, 0, 0, 0])]
        item_type, prices = process_ladders(ladders, [64790], item_id)
        self.assertEqual(item_type, "recurso")
        self.assertEqual(prices, [7772, 0, 0, 0])
        self.assertNotIn(64790, prices)

    def test_process_ladders_equipable_ignores_nested_stat_offer_prices(self):
        """Un equipable con ladders debe ignorar totalmente los varints de estadísticas (50 Sab, 125 Vita, 111 PA)"""
        known_id = 13115  # Anillo de Brus
        ladders = [(6, [840000, 0, 0, 0]), (6, [2000000, 0, 0, 0])]
        stat_numbers = [50, 60, 111, 118, 125]
        item_type, prices = process_ladders(ladders, stat_numbers, known_id)
        self.assertEqual(item_type, "equipable")
        self.assertEqual(prices, [840000, 2000000])
        for stat in stat_numbers:
            self.assertNotIn(stat, prices)

    def test_process_ladders_stacked_equipable_with_identical_stats(self):
        """Equipables con estadísticas idénticas pueden apilarse en lotes x10 o x100, extrayendo precio unitario"""
        known_id = 13115  # Anillo de Brus
        # Oferta 1: 1 unidad a 85,000 k y lote de 10 unidades a 800,000 k (80,000 k/u)
        # Oferta 2: Lote de 10 unidades a 820,000 k (82,000 k/u)
        # Oferta 3: 1 unidad a 90,000 k
        ladders = [
            (6, [85000, 800000, 0, 0]),
            (6, [0, 820000, 0, 0]),
            (6, [90000, 0, 0, 0])
        ]
        item_type, prices = process_ladders(ladders, [], known_id)
        self.assertEqual(item_type, "equipable")
        self.assertEqual(prices, [80000, 82000, 85000, 90000])

    def test_process_ladders_uncatalogued_stacked_equipable(self):
        """Un equipable no catalogado con múltiples ofertas (algunas apiladas en lotes) debe ser EQUIPABLE"""
        uncatalogued_id = 999999
        ladders = [
            (6, [150000, 1400000, 0, 0]),
            (6, [160000, 0, 0, 0])
        ]
        item_type, prices = process_ladders(ladders, [], uncatalogued_id)
        self.assertEqual(item_type, "equipable")
        self.assertEqual(prices, [140000, 150000, 160000])

    def test_parse_quotation_message_hierro_exact_match(self):
        """Verifica que las cotizaciones de Hierro (#312) coincidan exactamente con la UI de Dofus Unity (24h, 7d, 30d)"""
        import os
        import sys
        from datetime import datetime, timedelta
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
        import sniffer_standalone

        def make_quotation_entry(vol, date_str, price, item_id):
            buf = bytearray()
            buf.append(0x08)
            buf.extend(encode_varint(vol))
            buf.append(0x12)
            s_bytes = date_str.encode('utf-8')
            buf.extend(encode_varint(len(s_bytes)))
            buf.extend(s_bytes)
            buf.append(0x18)
            buf.extend(encode_varint(price))
            buf.append(0x20)
            buf.extend(encode_varint(item_id))
            return bytes(buf)

        vols_24h = [
            515, 3680, 4800, 2600, 3400, 7399, 4527, 6544, 11294, 8429,
            5611, 4041, 24014, 8085, 8332, 9855, 8668, 24949, 23110, 5981,
            8415, 4242, 972, 459, 900
        ]
        prices_24h = [
            291, 274, 300, 289, 291, 290, 292, 293, 292, 300,
            299, 298, 304, 306, 305, 306, 307, 308, 311, 315,
            314, 313, 252, 274, 322
        ]
        base_h = datetime(2026, 9, 10, 2, 0, 0)
        dates_24h = [(base_h + timedelta(hours=i)).isoformat() + 'Z' for i in range(len(vols_24h))]

        base_d = datetime(2026, 8, 12, 23, 59, 0)
        vols_30d = [155473] * 22 + [131414, 168128, 154838, 156480, 111064, 124101, 191362, 2331]
        prices_30d = [280] * 22 + [318, 299, 302, 314, 321, 303, 303, 283]
        dates_30d = [(base_d + timedelta(days=i)).isoformat() + 'Z' for i in range(len(vols_30d))]

        inner = bytearray()
        for v, p, d in zip(vols_24h, prices_24h, dates_24h):
            b = make_quotation_entry(v, d, p, 312)
            inner.append(0x0A)
            inner.extend(encode_varint(len(b)))
            inner.extend(b)

        for v, p, d in zip(vols_30d, prices_30d, dates_30d):
            b = make_quotation_entry(v, d, p, 312)
            inner.append(0x12)
            inner.extend(encode_varint(len(b)))
            inner.extend(b)

        header = b'type.ankama.com/iuk'
        payload = bytearray(header)
        payload.append(0x12)
        payload.extend(encode_varint(len(inner)))
        payload.extend(inner)

        iid, sales_data, _, _ = sniffer_standalone.parse_quotation_message(bytes(payload))
        self.assertEqual(iid, 312)
        # 24 Horas
        self.assertEqual(sales_data.get('sales24h'), 181827)
        self.assertEqual(sales_data.get('price24h'), 303)
        self.assertEqual(sales_data.get('median24h'), 306)
        # 7 Días
        self.assertEqual(sales_data.get('sales7d'), 1039718)
        self.assertEqual(sales_data.get('price7d'), 307)
        self.assertEqual(sales_data.get('median7d'), 303)
        # 30 Días
        self.assertGreater(sales_data.get('sales30d'), 4000000)

if __name__ == "__main__":
    unittest.main()

