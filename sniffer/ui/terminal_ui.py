# -*- coding: utf-8 -*-
"""
ui/terminal_ui.py
Menú interactivo y presentación por terminal.
"""
from core.config import load_keymap

def print_menu():
    km = load_keymap()
    print("\n" + "=" * 70)
    print("  DOFUS UNITY 3.6 -> DBHDV SUITE UNIFICADA (SNIFFER & CALIBRADOR)")
    print("=" * 70)
    print("  Tokens Activos en config/keymap.json:")
    print(f"    • Mercadillo (price_list)    : '{km.get('price_list', 'No calibrado')}'")
    print(f"    • Cotizaciones (quotations)  : '{km.get('quotations', 'No calibrado')}'")
    print(f"    • Inventario (inventory)     : '{km.get('inventory', 'No calibrado')}'")
    print("    • Almacén (storage)          : '" + str(km.get('storage', 'No calibrado')) + "'")
    print("    • Historial (sales_history)  : '" + str(km.get('sales_history', 'No calibrado')) + "'")
    print("    • En Venta (active_listings) : '" + str(km.get('active_listings', 'No calibrado')) + "'")
    print("    • Última calibración         : " + str(km.get('last_calibrated', 'Nunca')))
    print("-" * 70)
    print("  [MODO CAPTURA Y GESTIÓN EN VIVO]")
    print("    [1] Sniffer Mercadillo Dual (Precios HDV en Vivo + Cotizaciones)")
    print("    [2] Sniffer Almacén Unificado (Inventario + Banco + Merkasako)")
    print("    [3] Sniffer Historial de Ventas (Transacciones y Caducidades)")
    print("    [4] Sniffer Listings ACTIVOS en Venta (Recursos, Equipos, Consumibles)")
    print("    [5] Abrir Visor Visual de Almacén (visor_almacen.html)")
    print("    [6] Abrir Visor Visual de Historial (visor_historial.html)")
    print("    [S] (Opcional) Sniffer de Sesión Completa Todo-en-Uno")
    print("\n  [MODO CALIBRACIÓN Y DIAGNÓSTICO]")
    print("    [7] Calibrar Token de Mercadillo (price_list)")
    print("    [8] Calibrar Token de Cotizaciones de Mercado (quotations)")
    print("    [9] Calibrar Token de Almacén (inventory / storage)")
    print("    [10] Calibrar Token de Historial de Ventas (sales_history)")
    print("    [11] Calibrar Token de Listings ACTIVOS en Venta (active_listings)")
    print("    [12] Sincronizar Tokens desde DBHDV Cloud")
    print("    [13] Ver Registro de Diagnóstico y Telemetría")
    print("\n    [0] Salir")
    print("=" * 70)

