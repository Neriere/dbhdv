# -*- coding: utf-8 -*-
"""
core/items_db.py
Carga, consulta y categorización de ítems de Dofus.
"""
import os
import json
from core.config import (
    ITEMS_DB_FILE,
    STATIC_DICT_FILE,
    CONFIG_DIR,
    SUITE_DIR,
    PROJECT_ROOT,
    log_diagnostic,
)

ITEMS_NAME_MAP = {}
ITEM_CATEGORIES_FILE = os.path.join(CONFIG_DIR, "item_categories.json")
ITEM_CATEGORIES_MAP = {}

def load_items_dictionary():
    global ITEMS_NAME_MAP
    if ITEMS_NAME_MAP:
        return
    if os.path.exists(STATIC_DICT_FILE):
        try:
            with open(STATIC_DICT_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, dict):
                    ITEMS_NAME_MAP.update({int(k): str(v) for k, v in d.items() if str(k).isdigit()})
        except Exception:
            pass

    for cand_db in [
        os.path.join(CONFIG_DIR, "items_db.json"),
        os.path.join(SUITE_DIR, "items_db.json"),
        os.path.join(PROJECT_ROOT, "scripts", "items_db.json"),
        ITEMS_DB_FILE
    ]:
        if os.path.exists(cand_db):
            try:
                with open(cand_db, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    raw = d.get("items", {}) if isinstance(d, dict) else d
                    if isinstance(raw, dict):
                        for k, v in raw.items():
                            if str(k).isdigit():
                                ik = int(k)
                                if ik not in ITEMS_NAME_MAP:
                                    if isinstance(v, dict):
                                        ITEMS_NAME_MAP[ik] = v.get("name", f"Objeto #{ik}")
                                    elif isinstance(v, str):
                                        ITEMS_NAME_MAP[ik] = v
            except Exception:
                pass

    # Sanitizar colisiones corruptas históricas de "Puré pic-feil" (solo 35089 y 666 son legítimos)
    corrupt_keys = [k for k, v in list(ITEMS_NAME_MAP.items()) if str(v).strip().lower() == "puré pic-feil" and k not in (35089, 666)]
    for k in corrupt_keys:
        del ITEMS_NAME_MAP[k]

def get_item_name(item_id):
    load_items_dictionary()
    if item_id in ITEMS_NAME_MAP:
        val = ITEMS_NAME_MAP[item_id]
        if str(val).strip().lower() == "puré pic-feil" and item_id not in (35089, 666):
            del ITEMS_NAME_MAP[item_id]
        else:
            return val
    return f"Objeto #{item_id}"

def is_valid_market_item(item_id):
    """
    Verifica si un item_id corresponde a un objeto comercial legítimo del catálogo.
    Descarta celdas, IDs de mapa, actores o flags espurias del motor (ej. 10, 11, 54).
    """
    if not isinstance(item_id, int) or item_id < 50:
        return False
    load_items_dictionary()
    if item_id not in ITEMS_NAME_MAP:
        return False
    name = str(ITEMS_NAME_MAP.get(item_id, "")).strip()
    if not name or name.startswith("Objeto #"):
        return False
    if name.lower() == "puré pic-feil" and item_id not in (35089, 666):
        return False
    return True

def is_valid_market_ladder(ladders):
    """
    Verifica si una escala de precios de mercadillo (x1, x10, x100, x1000) es económicamente coherente.
    En Dofus, los lotes de mayor tamaño NUNCA cuestan menos kamas totales que los lotes menores.
    Descarta ráfagas de animación/mapa cuyos enteros decodificados son planos o decrecientes.
    """
    if not ladders:
        return False
    for _, lad in ladders:
        if not lad or not any(p > 0 for p in lad):
            continue
        valid_ladder = True
        prev = 0
        for p in lad:
            if p > 0:
                if prev > 0 and p < prev:
                    valid_ladder = False
                    break
                prev = p
        if valid_ladder and any(p >= 10 for p in lad):
            return True
    return False


def load_item_categories():
    global ITEM_CATEGORIES_MAP
    if ITEM_CATEGORIES_MAP:
        return
    for cand in [
        ITEM_CATEGORIES_FILE,
        os.path.join(CONFIG_DIR, "items_db.json"),
        os.path.join(SUITE_DIR, "items_db.json"),
        os.path.join(PROJECT_ROOT, "scripts", "items_db.json"),
    ]:
        if os.path.exists(cand):
            try:
                with open(cand, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        cats = data.get("categories", data)
                        if isinstance(cats, dict):
                            for k, v in cats.items():
                                if str(k).isdigit() and isinstance(v, str):
                                    v_low = v.strip().lower()
                                    if "equipo" in v_low:
                                        ITEM_CATEGORIES_MAP[str(k)] = "equipamiento"
                                    elif "consumible" in v_low:
                                        ITEM_CATEGORIES_MAP[str(k)] = "consumibles"
                                    else:
                                        ITEM_CATEGORIES_MAP[str(k)] = v_low
                if len(ITEM_CATEGORIES_MAP) > 1000:
                    break
            except Exception:
                pass

def classify_item(item_id, item_name="", quantity=1):
    """
    Clasifica un objeto en: 'recursos', 'equipamiento' o 'consumibles'.
    Utiliza primero la base de datos de tipos oficiales y luego reglas heurísticas.
    """
    load_item_categories()
    str_id = str(item_id)
    if str_id in ITEM_CATEGORIES_MAP:
        return ITEM_CATEGORIES_MAP[str_id]

    # En Dofus el equipamiento nunca se vende en lotes > 1
    if quantity > 1:
        name_l = (item_name or "").lower()
        if any(w in name_l for w in ("pergamino", "pócima", "pocion", "pan", "pescado", "carne")):
            return "consumibles"
        return "recursos"

    name_l = (item_name or "").lower()
    if any(w in name_l for w in ("pergamino", "pócima", "pocion", "pan", "pescado comestible", "carne comestible", "golosina", "bebida", "poción")):
        return "consumibles"

    EQUIPMENT_KEYWORDS = (
        "amuleto", "anillo", "bota", "botas", "zapato", "zapatos", "sandalia", "sandalias",
        "sombrero", "gorra", "casco", "corona", "diadema", "máscara", "mascara", "capucha",
        "yelmo", "tocado", "coif", "gorro", "boina",
        "capa", "cinturón", "cinturon", "escudo", "trofeo", "espada", "daga", "dagas", "pala", "varita",
        "bastón", "baston", "hacha", "martillo", "arco", "lanza", "guadaña", "guadana", "pico",
        "dofus", "mascota", "mascotura", "montura", "dragopavo", "mulagua", "vueloceronte", "suertudo", "robusto", "rabioso",
        "destructor", "iniciador", "bloqueador", "sabio", "vigoroso", "curador", "frenético", "frenetico",
        "avistador", "nómada", "nomada", "arrollador", "milagroso", "estudioso", "espabilador", "viajero",
        "pavoroso", "devastador", "implacable", "acróbata", "acrobata", "precursor", "hiperactivo",
        "turbulento", "temerario", "miraculoso", "doloroso", "furiador", "insidioso", "inquebrantable"
    )
    if any(w in name_l for w in EQUIPMENT_KEYWORDS):
        return "equipamiento"

    return "recursos"

def classify_batch_market(batch):
    """
    Determina a qué mercadillo pertenece la ráfaga analizando los objetos decodificados.
    Retorna: 'recursos', 'equipamiento' o 'consumibles'.
    """
    if not batch:
        return "recursos"

    has_stacks = any(item.get("quantity", 1) > 1 for item in batch)
    votes = {"equipamiento": 0, "consumibles": 0, "recursos": 0}
    for item in batch:
        cat = classify_item(item.get("itemId"), item.get("name", ""), item.get("quantity", 1))
        votes[cat] += 1

    # Si ningún lote es mayor a 1 y hay equipamiento detectado, es indiscutiblemente equipamiento
    if not has_stacks and votes["equipamiento"] > 0:
        if votes["equipamiento"] >= votes["consumibles"]:
            return "equipamiento"

    return max(votes, key=votes.get)


