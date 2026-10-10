import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const snifferDir = path.join(root, "sniffer");
const targetTs = path.join(root, "api", "market", "suite-script.ts");

const moduleFiles = [
  "core/config.py",
  "core/items_db.py",
  "core/protobuf_decoder.py",
  "calibrator/cloud_sync.py",
  "exporters/html_viewer.py",
  "sniffers/market_sniffer.py",
  "sniffers/storage_sniffer.py",
  "sniffers/sales_sniffer.py",
  "sniffers/listings_sniffer.py",
  "calibrator/calibrator.py",
  "sniffers/bundle_sniffer.py",
  "ui/terminal_ui.py",
];

const mainCode = `
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
            print("\\n¡Hasta pronto!")
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
            print("\\n" + "=" * 70)
            print("  REGISTRO DE DIAGNÓSTICO Y TELEMETRÍA")
            print("=" * 70)
            print("  [1] Ver log de calibración y eventos (logs/calibracion_diagnostico.log)")
            print("  [2] Ver log detallado de paquetes y tráfico (logs/sniffer.log)")
            print("  [Enter] Ver últimos registros combinados")
            diag_choice = input("\\nSelecciona [1/2/Enter]: ").strip()

            if diag_choice == "1":
                print("\\n--- REGISTRO DE CALIBRACIÓN Y DIAGNÓSTICO ---")
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
                print("\\n--- REGISTRO DETALLADO DE PAQUETES (SNIFFER.LOG) ---")
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
                print("\\n--- ÚLTIMOS EVENTOS DE CAPTURA (logs/sniffer.log) ---")
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

                print("\\n--- ÚLTIMOS EVENTOS DE CALIBRACIÓN (logs/calibracion_diagnostico.log) ---")
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

            input("\\nPresiona Enter para continuar...")
        elif choice == "0":
            print("\\nSaliendo de DBHDV Suite. ¡Buen juego!")
            break
        else:
            print("\\n[Opción no válida. Ingresa un número del 0 al 12]")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\\n\\nSaliendo de DBHDV Suite. ¡Buen juego!")
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        print(f"\\n[ERROR CRÍTICO NO CONTROLADO]: {e}", flush=True)
        print(tb_str)
        try:
            log_sniffer_event("CRASH_FATAL", f"{e}\\n{tb_str}")
        except Exception:
            pass
        try:
            input("\\nPresiona Enter para cerrar...")
        except Exception:
            pass
`;

const assembledSections = [];
assembledSections.push(`#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY 3.6 -> DBHDV SUITE UNIFICADA (SNIFFER & CALIBRADOR)
===============================================================================
  Suite unificada autónoma generada automáticamente para distribución.
===============================================================================
"""
`);

for (const rel of moduleFiles) {
  const p = path.join(snifferDir, rel);
  if (!fs.existsSync(p)) continue;
  const code = fs.readFileSync(p, "utf8");

  const lines = code.split(/\r?\n/);
  const filtered = [];
  let inMultiLineDoc = false;
  let inImportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (i < 5 && (trimmed.startsWith("#!/") || trimmed.startsWith("# -*- coding:"))) {
      continue;
    }

    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      if (!inMultiLineDoc) {
        if (trimmed.length > 3 && (trimmed.endsWith('"""') || trimmed.endsWith("'''"))) {
          continue;
        }
        inMultiLineDoc = true;
        continue;
      } else {
        inMultiLineDoc = false;
        continue;
      }
    }
    if (inMultiLineDoc) continue;

    if (
      trimmed.startsWith("from core.") ||
      trimmed.startsWith("from sniffers.") ||
      trimmed.startsWith("from calibrator.") ||
      trimmed.startsWith("from exporters.") ||
      trimmed.startsWith("from ui.")
    ) {
      if (trimmed.endsWith("(")) {
        inImportBlock = true;
      }
      continue;
    }
    if (inImportBlock) {
      if (trimmed.endsWith(")")) {
        inImportBlock = false;
      }
      continue;
    }

    filtered.push(line);
  }

  assembledSections.push(`\n# --- Module: ${rel} ---\n` + filtered.join("\n"));
}

assembledSections.push(mainCode);

const bundledPy = assembledSections.join("\n");
const content = `// Auto-generated by scripts/syncSuiteContent.js - DO NOT EDIT MANUALLY
export default function handler(req: any, res: any) {
  const scriptContent = ${JSON.stringify(bundledPy)};

  res.setHeader("Content-Type", "text/x-python; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="dofus_suite.py"');
  return res.status(200).send(scriptContent);
}
`;

fs.writeFileSync(targetTs, content, "utf-8");
console.log("✓ Synchronized api/market/suite-script.ts from modular sniffer suite");
