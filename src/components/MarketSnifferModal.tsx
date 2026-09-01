import React, { useState } from 'react';
import {
  Radio,
  X,
  Copy,
  Check,
  Download,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Server,
  Layers,
  FileCode,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { PriceProfile } from '../types';

interface MarketSnifferModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile?: PriceProfile;
  onPriceUpdated?: () => void;
}

const PRESET_SERVERS = [
  { name: 'Draconiros', category: 'Monocuenta Clásico' },
  { name: 'Kourial', category: 'Monocuenta Pionero' },
  { name: 'Mikhal', category: 'Monocuenta Pionero' },
  { name: 'Dakal', category: 'Monocuenta Pionero' },
  { name: 'Brial', category: 'Multicuenta Pionero' },
  { name: 'Rafal', category: 'Multicuenta Pionero' },
  { name: 'Salar', category: 'Multicuenta Pionero' },
  { name: 'Tal Kasha', category: 'Multicuenta Clásico' },
  { name: 'Hell Mina', category: 'Multicuenta Clásico' },
  { name: 'Imagiro', category: 'Multicuenta Clásico' },
  { name: 'Orukam', category: 'Multicuenta Clásico' },
  { name: 'Tylezia', category: 'Multicuenta Clásico' },
  { name: 'Shadow', category: 'Sombra (Épico)' },
];

export const MarketSnifferModal: React.FC<MarketSnifferModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
}) => {
  const [selectedServer, setSelectedServer] = useState<string>(activeProfile?.name || 'Draconiros');
  const [isCustomServer, setIsCustomServer] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedBat, setCopiedBat] = useState(false);
  const [activeTab, setActiveTab] = useState<'instructions' | 'bat' | 'script'>('instructions');
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const batchApiUrl = `${currentOrigin}/api/market/batch-update`;
  const updateApiUrl = `${currentOrigin}/api/market/update`;
  const dictApiUrl = `${currentOrigin}/api/market/items-dictionary`;
  const activeServerTarget = (selectedServer || activeProfile?.name || 'Draconiros').trim();

  const pythonScript = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  DOFUS UNITY -> MERCADILLO ULTRA-FAST LIVE SNIFFER (HIGH PERFORMANCE)
===============================================================================
  - Búfer Asíncrono Multihilo: captura de paquetes sin latencia ni cuellos de botella.
  - Base de Datos Local (items_db.json): resolución de nombres en 0.001 ms.
  - Micro-Batching con HTTP Keep-Alive hacia tu servidor Turso/Vercel.
  - Auto-Elevación en Windows y Auto-Instalación de dependencias.
===============================================================================
"""

import os
import sys
import time
import json
import queue
import argparse
import threading
import traceback
import subprocess
import urllib.request
from datetime import datetime

# 1. AUTO-ELEVACIÓN ADMINISTRADOR EN WINDOWS (para captura con Scapy)
def is_admin():
    if sys.platform != "win32":
        return os.geteuid() == 0 if hasattr(os, "geteuid") else True
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def check_and_elevate_admin():
    if sys.platform == "win32" and not is_admin():
        print("[UAC] Solicitando permisos de Administrador a Windows para captura de paquetes...")
        try:
            import ctypes
            script_path = os.path.abspath(sys.argv[0])
            params = f'"{script_path}" ' + " ".join([f'"{a}"' for a in sys.argv[1:]])
            ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
            if int(ret) > 32:
                sys.exit(0)
            else:
                print("[Aviso] No se concedieron permisos de Administrador.")
        except Exception as e:
            print(f"[Error UAC]: {e}")

check_and_elevate_admin()

# 2. AUTO-INSTALACIÓN DE DEPENDENCIAS (requests, scapy)
def ensure_dependencies():
    packages = []
    try:
        import requests
    except ImportError:
        packages.append("requests")
    try:
        import scapy
    except ImportError:
        packages.append("scapy")

    if packages:
        print("=" * 70)
        print(f" [INSTALADOR] Instalando librerias necesarias: {', '.join(packages)}")
        print("=" * 70)
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", *packages])
            print("[OK] Librerias instaladas con exito.\\n")
        except Exception as e:
            print(f"[ERROR PIP] No se pudieron instalar dependencias automaticamente: {e}")
            print(f"Ejecuta en tu consola: pip install {' '.join(packages)}")
            input("\\nPresiona Enter para salir...")
            sys.exit(1)

ensure_dependencies()

import requests
try:
    from scapy.all import sniff, TCP, Raw
except Exception as e:
    print("\\n" + "=" * 70)
    print(" [CONTROLADOR DE RED NPCAP REQUERIDO EN WINDOWS]")
    print(f" Detalle: {e}")
    print("=" * 70)
    print(" Para capturar paquetes de red en Windows:")
    print(" 1. Descarga el instalador gratuito de Npcap:")
    print("    https://npcap.com/#download")
    print(" 2. Durante la instalacion MARCA la casilla:")
    print("    'Install Npcap in WinPcap API-compatible Mode'")
    print("=" * 70)
    input("\\nPresiona Enter para salir...")
    sys.exit(1)

# Argumentos de línea de comandos para cambiar el servidor dinámicamente
parser = argparse.ArgumentParser(description="Dofus Unity Market Sniffer")
parser.add_argument("--server", type=str, default="${activeServerTarget}", help="Nombre del servidor Dofus")
cli_args, _ = parser.parse_known_args()

# ==================== CONFIGURACIÓN ====================
API_BATCH_URL = "${batchApiUrl}"
API_UPDATE_URL = "${updateApiUrl}"
API_DICT_URL = "${dictApiUrl}"
API_SECRET_KEY = ""
SERVER_NAME = (cli_args.server or "${activeServerTarget}").strip()
DOFUS_PORTS = "tcp port 5555"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in locals() else os.getcwd()
LOCAL_DB_FILE = os.path.join(SCRIPT_DIR, "items_db.json")
# =======================================================

ITEMS_DB = {}
packet_queue = queue.Queue(maxsize=2000)
http_session = requests.Session()

def load_or_download_items_db():
    global ITEMS_DB
    if os.path.exists(LOCAL_DB_FILE) and os.path.getsize(LOCAL_DB_FILE) > 100:
        try:
            with open(LOCAL_DB_FILE, "r", encoding="utf-8") as f:
                ITEMS_DB = json.load(f)
            print(f"[DB Local] Cargados {len(ITEMS_DB):,} nombres de objetos desde items_db.json")
            return
        except Exception as e:
            print(f"[Aviso] Error leyendo items_db.json local: {e}. Re-descargando...")

    print(f"[DB Local] Descargando base de nombres desde {API_DICT_URL}...")
    try:
        req = urllib.request.Request(API_DICT_URL, headers={"User-Agent": "DofusSniffer/2.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read().decode("utf-8")
            ITEMS_DB = json.loads(data)
            with open(LOCAL_DB_FILE, "w", encoding="utf-8") as f:
                f.write(data)
            print(f"[DB Local] OK Base de datos guardada ({len(ITEMS_DB):,} objetos listos).")
    except Exception as e:
        print(f"[DB Local] Advertencia de descarga: {e}. Se usaran IDs numericos.")

def get_item_name(item_id):
    if not ITEMS_DB:
        load_or_download_items_db()
    
    str_id = str(item_id)
    if str_id in ITEMS_DB:
        return ITEMS_DB[str_id]

    return f"Objeto #{item_id}"

def parse_varint(data, offset):
    res = 0
    shift = 0
    while offset < len(data):
        b = data[offset]
        offset += 1
        res |= (b & 0x7F) << shift
        if not (b & 0x80):
            break
        shift += 7
    return res, offset

def parse_kbt(payload):
    idx = payload.find(b"kbt")
    if idx == -1:
        idx = payload.find(b"type.ankama.com/kbt")
        if idx != -1:
            idx += len(b"type.ankama.com/kbt")
        else:
            return None, None
    else:
        idx += 3

    item_id = None
    prices = []

    pos = idx
    while pos < len(payload):
        if pos + 2 > len(payload):
            break
        tag, pos = parse_varint(payload, pos)
        wire_type = tag & 0x07
        field_num = tag >> 3

        if wire_type == 0:
            val, pos = parse_varint(payload, pos)
            if field_num == 1:
                item_id = val
            elif field_num in (3, 4, 5, 6):
                prices.append(val)
        elif wire_type == 2:
            length, pos = parse_varint(payload, pos)
            sub_end = pos + length
            if sub_end > len(payload):
                break
            
            sub_pos = pos
            while sub_pos < sub_end:
                sub_tag, sub_pos = parse_varint(payload, sub_pos)
                s_wire = sub_tag & 0x07
                s_field = sub_tag >> 3
                if s_wire == 0:
                    s_val, sub_pos = parse_varint(payload, sub_pos)
                    if s_field in (3, 4, 5, 6, 7, 8):
                        prices.append(s_val)
                elif s_wire == 2:
                    s_len, sub_pos = parse_varint(payload, sub_pos)
                    sub_pos += s_len
                elif s_wire == 1:
                    sub_pos += 8
                elif s_wire == 5:
                    sub_pos += 4
                else:
                    break
            pos = sub_end
        elif wire_type == 1:
            pos += 8
        elif wire_type == 5:
            pos += 4
        else:
            break

    return item_id, prices

def async_worker():
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "DofusSniffer/2.0"
    }

    while True:
        try:
            first_item = packet_queue.get()
            if first_item is None:
                break

            items_batch = []
            items_batch.append(first_item)
            packet_queue.task_done()

            start_collect = time.time()
            while len(items_batch) < 35 and (time.time() - start_collect) < 0.08:
                try:
                    next_item = packet_queue.get_nowait()
                    items_batch.append(next_item)
                    packet_queue.task_done()
                except queue.Empty:
                    break

            now_str = datetime.now().strftime("%H:%M:%S")
            if len(items_batch) == 1:
                item = items_batch[0]
                res = http_session.post(API_UPDATE_URL, json=item, headers=headers, timeout=5.0)
                if res.status_code == 200:
                    data = res.json()
                    c_price = data.get("calculated_price", 0)
                    print(f"[{now_str}] 🟢 [{SERVER_NAME}] {item['item_name']} -> {c_price:,} kamas")
                else:
                    print(f"[{now_str}]  Error {res.status_code}: {res.text}")
            else:
                res = http_session.post(API_BATCH_URL, json={"items": items_batch}, headers=headers, timeout=8.0)
                if res.status_code == 200:
                    data = res.json()
                    tot = data.get("total_processed", len(items_batch))
                    print(f"[{now_str}]  [LOTE PROCESADO] {tot} objetos sincronizados con Turso")
                else:
                    print(f"[{now_str}]  Error de lote {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[{now_str}] [Aviso Conexion]: {e}")

def process_packet(pkt):
    if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
        return
    payload = bytes(pkt[Raw].load)

    if b"kbt" in payload or b"type.ankama.com/kbt" in payload:
        item_id, prices = parse_kbt(payload)
        if item_id and prices:
            name = get_item_name(item_id)
            is_equipment = len(prices) > 4

            body = {
                "item_id": item_id,
                "item_name": name,
                "type": "equipable" if is_equipment else "recurso",
                "server": SERVER_NAME,
                "source": "sniffer",
            }

            if is_equipment:
                body["precios"] = prices
            else:
                body["precios"] = {
                    "1": prices[0] if len(prices) > 0 else 0,
                    "10": prices[1] if len(prices) > 1 else 0,
                    "100": prices[2] if len(prices) > 2 else 0,
                    "1000": prices[3] if len(prices) > 3 else 0,
                }

            try:
                packet_queue.put_nowait(body)
            except queue.Full:
                pass

def main():
    print("=" * 70)
    print("      DOFUS UNITY -> MERCADILLO LIVE SNIFFER (ULTRA-RAPIDO)")
    print(f"  Servidor Destino : {SERVER_NAME}")
    print(f"  Base de Datos    : Turso / LibSQL Cloud")
    print("=" * 70)

    load_or_download_items_db()

    worker_thread = threading.Thread(target=async_worker, daemon=True)
    worker_thread.start()

    print("\\n Escuchando paquetes en tiempo real...")
    print("Abre el mercadillo en Dofus Unity e inspecciona los objetos.")
    print("Presiona Ctrl+C para salir.\\n")

    try:
        sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
    except KeyboardInterrupt:
        print("\\n\\nSincronizador detenido por el usuario.")
    except Exception as e:
        print(f"\\n[Error Sniffer]: {e}")
        traceback.print_exc()
        input("\\nPresiona Enter para cerrar...")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\\n[ERROR CRITICO NO CONTROLADO]: {e}")
        traceback.print_exc()
        input("\\nPresiona Enter para cerrar...")
`;

  const batContent = `@echo off
title Dofus Unity - Sincronizador de Mercadillo (${activeServerTarget})
cd /d "%~dp0"

echo ===================================================================
echo       DOFUS UNITY - SINCRONIZADOR DE MERCADILLO
echo       Servidor: ${activeServerTarget}
echo ===================================================================
echo.

:: 1. Descargar / Actualizar siempre la ultima version de dofus_sniffer.py
echo [DESCARGA] Sincronizando dofus_sniffer.py desde el servidor...
where curl >nul 2>&1
if %errorlevel% equ 0 (
    curl -s -L -f "${currentOrigin}/api/market/sniffer-script?server=${encodeURIComponent(activeServerTarget)}" -o "dofus_sniffer.py"
) else (
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('${currentOrigin}/api/market/sniffer-script?server=${encodeURIComponent(activeServerTarget)}', 'dofus_sniffer.py')"
)

:: 2. Ejecutar con Python (el script maneja permisos de Admin automaticamente)
where py >nul 2>&1
if %errorlevel% equ 0 (
    py -3 dofus_sniffer.py --server "${activeServerTarget}"
    goto :fin
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    python dofus_sniffer.py --server "${activeServerTarget}"
    goto :fin
)

where python3 >nul 2>&1
if %errorlevel% equ 0 (
    python3 dofus_sniffer.py --server "${activeServerTarget}"
    goto :fin
)

echo.
echo ===================================================================
echo  [ERROR] No se ha detectado Python en tu sistema.
echo ===================================================================
echo  1. Descarga Python gratis desde: https://www.python.org/downloads/
echo  2. IMPORTANTE: En el instalador marca la casilla:
echo     [X] "Add Python to PATH"
echo ===================================================================

:fin
echo.
echo ===================================================================
echo  Proceso finalizado.
echo ===================================================================
pause
`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(updateApiUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyBat = () => {
    const crlfBat = batContent.replace(/\r?\n/g, '\r\n');
    navigator.clipboard.writeText(crlfBat);
    setCopiedBat(true);
    setTimeout(() => setCopiedBat(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dofus_sniffer_${activeServerTarget.toLowerCase().replace(/[^a-z0-9]/g, '_')}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadItemsDb = () => {
    try {
      const link = document.createElement('a');
      link.href = '/api/market/download-items-db';
      link.download = 'items_db.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.warn("Items DB download error:", e);
    }
  };

  const handleDownloadBat = () => {
    const filename = `sincronizar_mercadillo_${activeServerTarget.toLowerCase().replace(/[^a-z0-9]/g, '_')}.bat`;

    // Descarga directa desde el endpoint del servidor
    const directUrl = `/api/market/download-bat?server=${encodeURIComponent(activeServerTarget)}`;
    const link = document.createElement('a');
    link.href = directUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccessToast(
      `Descarga iniciada para el servidor ${activeServerTarget}.`
    );
    setTimeout(() => setDownloadSuccessToast(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Sincronización Automática de Mercadillo (Sniffer)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  Turso / LibSQL Ready
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Envía precios automáticamente a tu base de datos mientras recorres el juego.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Selector Bar */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-slate-300">Servidor de sincronización:</span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            {!isCustomServer ? (
              <div className="relative flex-1">
                <select
                  value={selectedServer}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomServer(true);
                    } else {
                      setSelectedServer(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500 appearance-none pr-8 cursor-pointer"
                >
                  {PRESET_SERVERS.map((srv) => (
                    <option key={srv.name} value={srv.name}>
                      {srv.name} ({srv.category})
                    </option>
                  ))}
                  <option value="__custom__">+ Otro servidor (Escribir nombre)...</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={selectedServer}
                  onChange={(e) => setSelectedServer(e.target.value)}
                  placeholder="Nombre de servidor..."
                  className="flex-1 bg-slate-900 border border-amber-500 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCustomServer(false)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Lista
                </button>
              </div>
            )}

            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 shrink-0">
              {activeServerTarget}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-950/30 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'instructions'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Guía y Requisitos
          </button>
          <button
            onClick={() => setActiveTab('bat')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'bat'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            ⚡ Lanzador Windows (.BAT)
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Script Python (.PY)
          </button>
        </div>

        {/* Download Toast Notification */}
        {downloadSuccessToast && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccessToast}</span>
            </div>
            <button
              onClick={() => setDownloadSuccessToast(null)}
              className="text-slate-400 hover:text-white ml-3"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-300 text-xs sm:text-sm">
          {activeTab === 'instructions' && (
            <div className="space-y-5">
              {/* Endpoint Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-amber-400" /> Endpoint de Actualización (Turso DB)
                  </span>
                  <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Servidor: {activeServerTarget}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={updateApiUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? '¡Copiado!' : 'Copiar URL'}
                  </button>
                  <button
                    onClick={handleDownloadItemsDb}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-500/20"
                    title="Descargar base de nombres de objetos (items_db.json)"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    items_db.json
                  </button>
                </div>
              </div>

              {/* Requirement Cards */}
              <div className="bg-slate-950 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 text-amber-400">
                  <ShieldCheck className="w-4 h-4" /> Requisitos iniciales (Solo 1 vez)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-white block">1. Python en tu PC</span>
                    <p className="text-slate-400 text-[11px]">
                      Descarga Python desde <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5">python.org <ExternalLink className="w-2.5 h-2.5" /></a> asegurándote de marcar la casilla <em>"Add Python to PATH"</em> en el instalador.
                    </p>
                    <p className="text-emerald-400 text-[11px] font-semibold">
                      ✓ Las dependencias (scapy, requests) se instalan solas al ejecutar.
                    </p>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-white block">2. Controlador Npcap (Requerido en Windows)</span>
                    <p className="text-slate-400 text-[11px]">
                      Permite capturar los paquetes de red de Dofus Unity en tiempo real.
                    </p>
                    <a
                      href="https://npcap.com/#download"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs hover:underline mt-1"
                    >
                      Descargar Npcap (npcap.com) <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Step by step download card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Descargar para servidor: <span className="text-amber-400">{activeServerTarget}</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadScript}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-md shadow-amber-500/20"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar dofus_sniffer.py
                    </button>
                    <button
                      onClick={handleDownloadBat}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar .bat (Opcional)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      🐍 Opción Recomendada: Doble Clic en .py
                    </span>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                      <li>Descarga <strong className="text-white">dofus_sniffer.py</strong>.</li>
                      <li>Haz <strong>doble clic</strong> en el archivo.</li>
                      <li>Windows te pedirá confirmación de Administrador y el script se iniciará solo (auto-instalará librerías y descargará la base de nombres).</li>
                    </ol>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      ⚡ Opción Alternativa: Lanzador .BAT
                    </span>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                      <li>Descarga el archivo <strong>.bat</strong>.</li>
                      <li>Haz doble clic; descargará el script Python y lo ejecutará sin cerrarse si hay algún mensaje o error.</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bat' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" /> Lanzador Windows (.BAT) &mdash; {activeServerTarget}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ejecución directa en Windows. Configurado para sincronizar con {activeServerTarget}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyBat}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    {copiedBat ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedBat ? '¡Código Copiado!' : 'Copiar Código .BAT'}
                  </button>
                  <button
                    onClick={handleDownloadBat}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar .BAT
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[360px] select-all leading-relaxed">
                {batContent}
              </pre>
            </div>
          )}

          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" /> Código Fuente Python (dofus_sniffer.py) &mdash; {activeServerTarget}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Motor principal de captura en vivo, decodificación Protobuf y envío HTTP asíncrono a Turso.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyScript}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? '¡Código Copiado!' : 'Copiar Código .py'}
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar .py
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[380px] select-all leading-relaxed">
                {pythonScript}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>Servidor seleccionado: <strong className="text-amber-400">{activeServerTarget}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
