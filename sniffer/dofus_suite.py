#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY 3.6 -> DBHDV SUITE UNIFICADA (SNIFFER & CALIBRADOR)
===============================================================================
  Punto de entrada orquestador para la Suite Modular de Captura y Calibración.
===============================================================================
"""
import os
import sys

# Asegurar importación de submódulos locales
SUITE_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
if SUITE_DIR not in sys.path:
    sys.path.insert(0, SUITE_DIR)

from core.config import (
    is_admin,
    check_and_elevate_admin,
    SUITE_DIR,
    PROJECT_ROOT,
    CONFIG_DIR,
    DATA_DIR,
    LOGS_DIR,
    VIEWER_DIR,
    KEYMAP_FILE,
    DIAGNOSTIC_LOG,
    SNIFFER_LOG,
    INVENTORY_OUTPUT,
    SALES_OUTPUT,
    ACTIVE_LISTINGS_OUTPUT,
    QUOTATIONS_OUTPUT,
    ITEMS_DB_FILE,
    STATIC_DICT_FILE,
    VIEWER_HTML,
    GENERATOR_SCRIPT,
    SALES_VIEWER_HTML,
    SALES_GENERATOR_SCRIPT,
    DEFAULT_API_URL,
    log_diagnostic,
    log_sniffer_event,
    init_session_log,
    load_keymap,
    save_keymap_entry,
)

check_and_elevate_admin()

from core.items_db import (
    ITEMS_NAME_MAP,
    load_items_dictionary,
    get_item_name,
    is_valid_market_item,
    is_valid_market_ladder,
    ITEM_CATEGORIES_FILE,
    ITEM_CATEGORIES_MAP,
    load_item_categories,
    classify_item,
    classify_batch_market,
)

from core.protobuf_decoder import (
    decode_varint,
    decode_packed_varints,
    clean_ladder,
    extract_type_tokens,
    parse_dofus_item_submessage,
    extract_items_recursive,
)

from calibrator.cloud_sync import (
    sync_tokens_from_cloud,
    share_token_to_cloud,
)

from exporters.html_viewer import (
    launch_html_file,
    ensure_viewer_generator,
    generate_fallback_storage_html,
    open_storage_viewer,
    open_sales_viewer,
)

from sniffers.market_sniffer import (
    LAST_MARKET_ITEM_ID,
    ITEM_SALES_VOLUME,
    QUOTATION_BUFFERS,
    QUOTATION_LOCK,
    extract_market_universal,
    parse_market_message,
    calculate_quick_price,
    save_captured_quotation,
    _decode_quotation_payload,
    parse_quotation_request,
    parse_quotation_message,
    process_packet,
    run_sniffer_market,
)

from sniffers.storage_sniffer import (
    run_sniffer_storage,
)

from sniffers.sales_sniffer import (
    parse_single_sale_submessage,
    extract_sales_entries,
    run_sniffer_sales,
)

from sniffers.listings_sniffer import (
    parse_active_listing_entry,
    extract_active_listings,
    run_sniffer_active_listings,
)

from calibrator.calibrator import (
    run_calibrator_market,
    run_calibrator_quotations,
    run_calibrator_storage,
    inspect_packet_contents,
    find_target_matches,
    run_calibrator_sales,
    run_calibrator_active_listings,
)

from sniffers.bundle_sniffer import (
    run_sniffer_session_bundle,
)

from ui.terminal_ui import (
    print_menu,
)

def main():
    sync_tokens_from_cloud(silent=True)

    mode_arg = None
    for i, a in enumerate(sys.argv):
        if a == "--mode" and i + 1 < len(sys.argv):
            mode_arg = sys.argv[i + 1].strip().lower()
            break
        elif a.startswith("--mode="):
            mode_arg = a.split("=", 1)[1].strip().lower()
            break

    if mode_arg:
        if mode_arg in ("s", "sesion", "bundle", "all"):
            run_sniffer_session_bundle()
            return
        elif mode_arg == "1":
            run_sniffer_market()
            return
        elif mode_arg == "2":
            run_sniffer_storage()
            return
        elif mode_arg == "3":
            run_sniffer_sales()
            return
        elif mode_arg == "4":
            run_sniffer_active_listings()
            return
        elif mode_arg == "9":
            run_calibrator_storage()
            return

    while True:
        print_menu()
        try:
            choice = input("Selecciona una opción [1-6, 7-13, 0]: ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print("\n¡Hasta pronto!")
            break

        if choice in ("s", "sesion", "bundle", "all"):
            run_sniffer_session_bundle()
        elif choice == "1":
            run_sniffer_market()
        elif choice == "2":
            run_sniffer_storage()
        elif choice == "3":
            run_sniffer_sales()
        elif choice == "4":
            run_sniffer_active_listings()
        elif choice == "5":
            open_storage_viewer()
        elif choice == "6":
            open_sales_viewer()
        elif choice == "7":
            run_calibrator_market()
        elif choice == "8":
            run_calibrator_quotations()
        elif choice == "9":
            run_calibrator_storage()
        elif choice == "10":
            run_calibrator_sales()
        elif choice == "11":
            run_calibrator_active_listings()
        elif choice == "12":
            sync_tokens_from_cloud(silent=False)
        elif choice in ("13", "12", "d", "diag"):
            print("\n" + "=" * 70)
            print("  REGISTRO DE DIAGNÓSTICO Y TELEMETRÍA")
            print("=" * 70)
            print("  [1] Ver log de calibración y eventos (logs/calibracion_diagnostico.log)")
            print("  [2] Ver log detallado de paquetes y tráfico (logs/sniffer.log)")
            print("  [Enter] Ver últimos registros combinados")
            diag_choice = input("\nSelecciona [1/2/Enter]: ").strip()

            if diag_choice == "1":
                print("\n--- REGISTRO DE CALIBRACIÓN Y DIAGNÓSTICO ---")
                if os.path.exists(DIAGNOSTIC_LOG):
                    try:
                        with open(DIAGNOSTIC_LOG, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-40:]:
                                print("  " + line.rstrip())
                    except Exception as e:
                        print(f"  Error: {e}")
                else:
                    print("  No hay registros aún.")
            elif diag_choice == "2":
                print("\n--- REGISTRO DETALLADO DE PAQUETES (SNIFFER.LOG) ---")
                if os.path.exists(SNIFFER_LOG):
                    try:
                        with open(SNIFFER_LOG, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-40:]:
                                print("  " + line.rstrip())
                    except Exception as e:
                        print(f"  Error: {e}")
                else:
                    print("  No hay registros aún.")
            else:
                print("\n--- ÚLTIMOS EVENTOS DE CAPTURA (logs/sniffer.log) ---")
                if os.path.exists(SNIFFER_LOG):
                    try:
                        with open(SNIFFER_LOG, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-25:]:
                                print("  " + line.rstrip())
                    except Exception as e:
                        print(f"  Error leyendo sniffer.log: {e}")
                else:
                    print("  (Aún no se han capturado paquetes en la sesión actual)")

                print("\n--- ÚLTIMOS EVENTOS DE CALIBRACIÓN (logs/calibracion_diagnostico.log) ---")
                if os.path.exists(DIAGNOSTIC_LOG):
                    try:
                        with open(DIAGNOSTIC_LOG, "r", encoding="utf-8") as f:
                            lines = f.readlines()
                            for line in lines[-15:]:
                                print("  " + line.rstrip())
                    except Exception as e:
                        print(f"  Error leyendo calibracion_diagnostico.log: {e}")
                else:
                    print("  (Sin eventos de calibración)")

            input("\nPresiona Enter para continuar...")
        elif choice == "0":
            print("\nSaliendo de DBHDV Suite. ¡Buen juego!")
            break
        else:
            print("\n[Opción no válida. Ingresa un número del 0 al 12]")

import types

class _DofusSuiteModule(types.ModuleType):
    @property
    def LAST_MARKET_ITEM_ID(self):
        import sniffers.market_sniffer as ms
        return ms.LAST_MARKET_ITEM_ID
    @LAST_MARKET_ITEM_ID.setter
    def LAST_MARKET_ITEM_ID(self, val):
        import sniffers.market_sniffer as ms
        ms.LAST_MARKET_ITEM_ID = val

    @property
    def QUOTATION_BUFFERS(self):
        import sniffers.market_sniffer as ms
        return ms.QUOTATION_BUFFERS
    @QUOTATION_BUFFERS.setter
    def QUOTATION_BUFFERS(self, val):
        import sniffers.market_sniffer as ms
        ms.QUOTATION_BUFFERS = val

    @property
    def ITEM_SALES_VOLUME(self):
        import sniffers.market_sniffer as ms
        return ms.ITEM_SALES_VOLUME
    @ITEM_SALES_VOLUME.setter
    def ITEM_SALES_VOLUME(self, val):
        import sniffers.market_sniffer as ms
        ms.ITEM_SALES_VOLUME = val

    @property
    def QUOTATION_LOCK(self):
        import sniffers.market_sniffer as ms
        return ms.QUOTATION_LOCK
    @QUOTATION_LOCK.setter
    def QUOTATION_LOCK(self, val):
        import sniffers.market_sniffer as ms
        ms.QUOTATION_LOCK = val

sys.modules[__name__].__class__ = _DofusSuiteModule

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nSaliendo de DBHDV Suite. ¡Buen juego!")
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        print(f"\n[ERROR CRÍTICO NO CONTROLADO]: {e}", flush=True)
        print(tb_str)
        try:
            log_sniffer_event("CRASH_FATAL", f"{e}\n{tb_str}")
        except Exception:
            pass
        try:
            input("\nPresiona Enter para cerrar...")
        except Exception:
            pass
