# -*- coding: utf-8 -*-
"""
calibrator/cloud_sync.py
Sincronización de tokens con DBHDV Cloud API.
"""
import urllib.request
import urllib.parse
import json
from core.config import (
    DEFAULT_API_URL,
    load_keymap,
    save_keymap_entry,
)

def sync_tokens_from_cloud(silent=False):
    """
    Descarga los tokens comunitarios verificados desde el servidor DBHDV.
    Esto permite que los usuarios no tengan que calibrar manualmente tras cada parche.
    """
    if not silent:
        print("\n[Cloud Sync] Conectando con DBHDV para obtener tokens verificados...")
    url = f"{DEFAULT_API_URL}/api/tokens"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DBHDV-Suite/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("success") and "tokens" in data:
                remote_tokens = data["tokens"]
                km = load_keymap()
                changed = False
                for k in ["price_list", "quotations", "inventory", "storage", "sales_history", "active_listings"]:
                    if k in remote_tokens and remote_tokens[k] and remote_tokens[k] != km.get(k):
                        km[k] = remote_tokens[k]
                        changed = True
                if changed:
                    km["last_synced_cloud"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    with open(KEYMAP_FILE, "w", encoding="utf-8") as f:
                        json.dump(km, f, indent=2, ensure_ascii=False)
                    if not silent:
                        print("  [OK] Tokens actualizados con exito desde DBHDV Cloud:")
                        print(f"     * Mercadillo (price_list)    : '{km.get('price_list')}'")
                        print(f"     * Cotizaciones (quotations)  : '{km.get('quotations')}'")
                        print(f"     * Inventario (inventory)     : '{km.get('inventory')}'")
                        print(f"     * Almacen (storage)          : '{km.get('storage')}'")
                        print(f"     * Historial (sales_history)  : '{km.get('sales_history')}'")
                        print(f"     * En Venta (active_listings) : '{km.get('active_listings')}'")
                else:
                    if not silent:
                        print("  [OK] Tus tokens locales ya estan al dia con la ultima version comunitaria.")
                return True
    except Exception as e:
        if not silent:
            print(f"  [Aviso] No se pudo contactar con DBHDV Cloud ({e}). Operando en modo local.")
    return False

def share_token_to_cloud(key_name, token_val):
    """
    Comparte un token recien calibrado con la comunidad de DBHDV si el servidor esta disponible.
    """
    print(f"\nDeseas compartir el token '{token_val}' de '{key_name}' con la comunidad de DBHDV? [s/N]: ", end="")
    try:
        ans = input().strip().lower()
        if ans not in ("s", "si", "y", "yes"):
            print("  [OK] Token guardado exclusivamente en modo local.")
            return
        url = f"{DEFAULT_API_URL}/api/tokens"
        payload = json.dumps({
            "token_type": key_name,
            "token_value": token_val,
            "timestamp": datetime.datetime.now().isoformat()
        }).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "User-Agent": "DBHDV-Suite/1.0"
        })
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            if res_data.get("success"):
                print("  [OK] Gracias. El token ha sido registrado en DBHDV para toda la comunidad.")
            else:
                print("  [OK] Token guardado localmente.")
    except Exception:
        print("  [Info] El backend remoto en la nube no esta accesible actualmente.")
        print("  [OK] Tu token esta guardado y funcionando al 100% en modo local (config/keymap.json).")

