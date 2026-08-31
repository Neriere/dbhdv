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
} from 'lucide-react';
import { PriceProfile } from '../types';

interface MarketSnifferModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile?: PriceProfile;
  onPriceUpdated?: () => void;
}

export const MarketSnifferModal: React.FC<MarketSnifferModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
  onPriceUpdated,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedBat, setCopiedBat] = useState(false);
  const [activeTab, setActiveTab] = useState<'instructions' | 'bat' | 'script'>('instructions');
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const apiUrl = `${currentOrigin}/api/market/update`;
  const serverName = activeProfile?.name || 'Draconiros';

  const pythonScript = `#!/usr/bin/env python3
"""
===============================================================================
  DOFUS UNITY -> MERCADILLO LIVE SYNC (AUTOMATIC PACKET SNIFFER)
===============================================================================
  Instalación inicial de requisitos (Solo 1 vez en tu PC):
    pip install scapy requests

  Ejecución (abrir terminal o CMD como Administrador):
    python sniffer_standalone.py
===============================================================================
"""

import sys
import requests
from datetime import datetime

try:
    from scapy.all import sniff, TCP, Raw
except ImportError:
    print("[ERROR] Falta la librería 'scapy' o Npcap en Windows.")
    print("Instala las dependencias ejecutando: pip install scapy requests")
    print("Descarga el driver Npcap desde: https://npcap.com/#download")
    sys.exit(1)

# ==================== CONFIGURACIÓN ====================
VERCEL_API_URL = "${apiUrl}"
API_SECRET_KEY = ""  # Opcional
SERVER_NAME = "${serverName}"
DOFUS_PORTS = "tcp port 5555"
# =======================================================

NAME_CACHE = {}

def get_item_name(item_id):
    if item_id in NAME_CACHE:
        return NAME_CACHE[item_id]
    try:
        r = requests.get(f"https://api.dofusdb.fr/items/{item_id}?$select[]=name", timeout=2.0)
        if r.status_code == 200:
            data = r.json()
            name = (data.get("name", {}).get("es") or 
                    data.get("name", {}).get("fr") or 
                    data.get("name", {}).get("en") or 
                    f"Item #{item_id}")
            NAME_CACHE[item_id] = name
            return name
    except Exception:
        pass
    return f"Item #{item_id}"

def decode_varint(buf, off):
    val, shift, read = 0, 0, 0
    while off + read < len(buf):
        b = buf[off + read]
        read += 1
        val |= (b & 0x7F) << shift
        if (b & 0x80) == 0:
            break
        shift += 7
    return val, read

def parse_kbt(buf):
    """
    Decodifica el mensaje protobuf de mercadillo (type.ankama.com/kbt...)
    """
    try:
        idx = buf.find(b'type.ankama.com/kbt')
        if idx == -1:
            idx = buf.find(b'kbt')
            if idx == -1:
                return None, []
            idx = idx - 16
        
        off = idx + 19
        if off < len(buf) and buf[off] == 0x12:
            off += 1
            payload_len, br = decode_varint(buf, off)
            off += br
            payload = buf[off:off + payload_len]

            p_off = 0
            item_id = 0
            prices = []

            while p_off < len(payload):
                tag = payload[p_off]
                p_off += 1
                field = tag >> 3
                wire = tag & 7

                if wire == 0:
                    val, br = decode_varint(payload, p_off)
                    p_off += br
                    if field == 2:
                        item_id = val
                elif wire == 2:
                    sub_len, br = decode_varint(payload, p_off)
                    p_off += br
                    sub = payload[p_off:p_off + sub_len]
                    p_off += sub_len

                    s_off = 0
                    while s_off < len(sub):
                        s_tag = sub[s_off]
                        s_off += 1
                        s_field = s_tag >> 3
                        s_wire = s_tag & 7
                        if s_wire == 0:
                            s_val, s_br = decode_varint(sub, s_off)
                            s_off += s_br
                            if s_field in (2, 5):
                                item_id = s_val
                        elif s_wire == 2:
                            in_len, s_br = decode_varint(sub, s_off)
                            s_off += s_br
                            inner = sub[s_off:s_off + in_len]
                            s_off += in_len
                            if s_field == 6:
                                i_off = 0
                                while i_off < len(inner):
                                    pv, pbr = decode_varint(inner, i_off)
                                    i_off += pbr
                                    if pv > 0:
                                        prices.append(pv)
                        else:
                            break
            return item_id, prices
    except Exception:
        pass
    return None, []

def process_packet(pkt):
    if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
        return

    payload = bytes(pkt[Raw].load)
    if b'kbt' in payload or b'type.ankama.com/kbt' in payload:
        item_id, prices = parse_kbt(payload)
        if item_id and prices:
            name = get_item_name(item_id)
            is_equipment = len(prices) > 4
            
            body = {
                "item_id": item_id,
                "item_name": name,
                "type": "equipable" if is_equipment else "recurso",
                "server": SERVER_NAME,
                "source": "sniffer"
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

            headers = {"Content-Type": "application/json"}
            if API_SECRET_KEY:
                headers["x-market-secret"] = API_SECRET_KEY

            try:
                res = requests.post(VERCEL_API_URL, json=body, headers=headers, timeout=4.0)
                now_str = datetime.now().strftime("%H:%M:%S")
                if res.status_code == 200:
                    data = res.json()
                    calc_price = data.get('calculated_price', 0)
                    item_type = data.get('type', body['type'])
                    print(f"[{now_str}]  [{item_type.upper()}] {name} (#{item_id}) -> Guardado en Turso: {calc_price:,} k ({SERVER_NAME})")
                else:
                    print(f"[{now_str}] ⚠️ Error {res.status_code}: {res.text}")
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Error enviando precio: {e}")

if __name__ == "__main__":
    print("=" * 65)
    print("  DOFUS UNITY -> MERCADILLO LIVE SYNC")
    print(f"  Destino API : {VERCEL_API_URL}")
    print(f"  Servidor    : {SERVER_NAME}")
    print("=" * 65)
    print("🟢 Escuchando mercadillo en segundo plano...")
    print("💡 Haz clic en los objetos del mercadillo en Dofus para actualizar precios.")
    sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
`;

  const batContent = `@echo off
setlocal EnableDelayedExpansion
title Dofus Unity - Sincronizador de Mercadillo (${serverName})

:: Auto-elevacion a Administrador si no tiene permisos
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador para capturar paquetes...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
cls
echo =====================================================================
echo       DOFUS UNITY - MERCADILLO AUTO-SYNC (${serverName.toUpperCase()})
echo =====================================================================
echo.

python -c "
import sys, requests
from datetime import datetime

try:
    from scapy.all import sniff, TCP, Raw
except ImportError:
    print('[ERROR] Falta Scapy o Npcap en Windows.')
    print('1. Asegurate de haber instalado las dependencias: pip install scapy requests')
    print('2. Descarga e instala Npcap desde: https://npcap.com/#download')
    sys.exit(1)

VERCEL_API_URL = '${apiUrl}'
API_SECRET_KEY = ''
SERVER_NAME = '${serverName}'
DOFUS_PORTS = 'tcp port 5555'

print('=================================================================')
print('  DOFUS UNITY -> MERCADILLO AUTO-SYNC')
print(f'  Destino API : {VERCEL_API_URL}')
print(f'  Servidor    : {SERVER_NAME}')
print('=================================================================')
print('🟢 Escuchando mercadillo en segundo plano...')
print('💡 Haz clic en los objetos del mercadillo en Dofus para sincronizar.')
print('Presiona Ctrl+C para detener.\\n')

NAME_CACHE = {}

def get_item_name(item_id):
    if item_id in NAME_CACHE:
        return NAME_CACHE[item_id]
    try:
        r = requests.get(f'https://api.dofusdb.fr/items/{item_id}?$select[]=name', timeout=2.0)
        if r.status_code == 200:
            data = r.json()
            name = (data.get('name', {}).get('es') or data.get('name', {}).get('fr') or data.get('name', {}).get('en') or f'Item #{item_id}')
            NAME_CACHE[item_id] = name
            return name
    except Exception:
        pass
    return f'Item #{item_id}'

def decode_varint(buf, off):
    val, shift, read = 0, 0, 0
    while off + read < len(buf):
        b = buf[off + read]
        read += 1
        val |= (b & 0x7F) << shift
        if (b & 0x80) == 0:
            break
        shift += 7
    return val, read

def parse_kbt(buf):
    try:
        idx = buf.find(b'type.ankama.com/kbt')
        if idx == -1:
            idx = buf.find(b'kbt')
            if idx == -1:
                return None, []
            idx = idx - 16
        off = idx + 19
        if off < len(buf) and buf[off] == 0x12:
            off += 1
            payload_len, br = decode_varint(buf, off)
            off += br
            payload = buf[off:off + payload_len]
            p_off = 0
            item_id = 0
            prices = []
            while p_off < len(payload):
                tag = payload[p_off]
                p_off += 1
                field = tag >> 3
                wire = tag & 7
                if wire == 0:
                    val, br = decode_varint(payload, p_off)
                    p_off += br
                    if field == 2:
                        item_id = val
                elif wire == 2:
                    sub_len, br = decode_varint(payload, p_off)
                    p_off += br
                    sub = payload[p_off:p_off + sub_len]
                    p_off += sub_len
                    s_off = 0
                    while s_off < len(sub):
                        s_tag = sub[s_off]
                        s_off += 1
                        s_field = s_tag >> 3
                        s_wire = s_tag & 7
                        if s_wire == 0:
                            s_val, s_br = decode_varint(sub, s_off)
                            s_off += s_br
                            if s_field in (2, 5):
                                item_id = s_val
                        elif s_wire == 2:
                            in_len, s_br = decode_varint(sub, s_off)
                            s_off += s_br
                            inner = sub[s_off:s_off + in_len]
                            s_off += in_len
                            if s_field == 6:
                                i_off = 0
                                while i_off < len(inner):
                                    pv, pbr = decode_varint(inner, i_off)
                                    i_off += pbr
                                    if pv > 0:
                                        prices.append(pv)
                        else:
                            break
            return item_id, prices
    except Exception:
        pass
    return None, []

def process_packet(pkt):
    if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
        return
    payload = bytes(pkt[Raw].load)
    if b'kbt' in payload or b'type.ankama.com/kbt' in payload:
        item_id, prices = parse_kbt(payload)
        if item_id and prices:
            name = get_item_name(item_id)
            is_equipment = len(prices) > 4
            body = {
                'item_id': item_id,
                'item_name': name,
                'type': 'equipable' if is_equipment else 'recurso',
                'server': SERVER_NAME,
                'source': 'sniffer-bat'
            }
            if is_equipment:
                body['precios'] = prices
            else:
                body['precios'] = {
                    '1': prices[0] if len(prices) > 0 else 0,
                    '10': prices[1] if len(prices) > 1 else 0,
                    '100': prices[2] if len(prices) > 2 else 0,
                    '1000': prices[3] if len(prices) > 3 else 0,
                }
            headers = {'Content-Type': 'application/json'}
            try:
                res = requests.post(VERCEL_API_URL, json=body, headers=headers, timeout=4.0)
                now_str = datetime.now().strftime('%H:%M:%S')
                if res.status_code == 200:
                    data = res.json()
                    calc_price = data.get('calculated_price', 0)
                    item_type = data.get('type', body['type'])
                    print(f'[{now_str}]  [{item_type.upper()}] {name} (#{item_id}) -> Guardado en Turso: {calc_price:,} k ({SERVER_NAME})')
                else:
                    print(f'[{now_str}] [Error {res.status_code}] {res.text}')
            except Exception as e:
                print(f'[{datetime.now().strftime(\"%H:%M:%S\")}] [Error]: {e}')

try:
    sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
except KeyboardInterrupt:
    print('\\nSincronizador detenido por el usuario.')
except Exception as e:
    print(f'\\n[Error]: {e}')
"
pause
`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(apiUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyBat = () => {
    navigator.clipboard.writeText(batContent);
    setCopiedBat(true);
    setTimeout(() => setCopiedBat(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([pythonScript], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sniffer_standalone.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBat = () => {
    const filename = `sincronizar_mercadillo_${serverName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.bat`;

    // 1. Trigger server download endpoint
    try {
      const directUrl = `/api/market/download-bat?server=${encodeURIComponent(serverName)}`;
      const link = document.createElement('a');
      link.href = directUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.warn("Direct link download failed, trying blob fallback:", e);
    }

    // 2. Client-side fallback blob creation
    try {
      const blob = new Blob([batContent], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.warn("Blob download failed:", e);
    }

    setDownloadSuccessToast(
      'Descarga iniciada. Si tu navegador bloquea archivos .bat por seguridad, puedes copiar el código con el botón "Copiar Código .BAT".'
    );
    setTimeout(() => setDownloadSuccessToast(null), 6000);
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
                  Turso / Vercel Ready
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Envía precios automáticamente a tu base de datos mientras recorres el juego, sin necesidad de abrir la web.
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-300 text-xs sm:text-sm">
          {activeTab === 'instructions' && (
            <div className="space-y-5">
              {/* Endpoint Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-amber-400" /> Endpoint de Actualización (Vercel / Turso)
                  </span>
                  <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Servidor: {serverName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={apiUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? '¡Copiado!' : 'Copiar URL'}
                  </button>
                </div>
              </div>

              {/* Requirement Cards */}
              <div className="bg-slate-950 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 text-amber-400">
                  <ShieldCheck className="w-4 h-4" /> Requisitos iniciales (Solo 1 vez en tu PC)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-white block">1. Python y librerías</span>
                    <p className="text-slate-400 text-[11px]">
                      Descarga Python desde <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5">python.org <ExternalLink className="w-2.5 h-2.5" /></a> (marcando <em>"Add Python to PATH"</em>).
                    </p>
                    <p className="text-slate-300 text-[11px]">
                      Luego abre tu terminal/CMD e instala las librerías una única vez:
                    </p>
                    <div className="bg-slate-950 p-2 rounded-lg font-mono text-amber-300 text-[11px] border border-slate-800 flex items-center justify-between">
                      <code>pip install scapy requests</code>
                    </div>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="font-bold text-white block">2. Controlador de Red Npcap</span>
                    <p className="text-slate-400 text-[11px]">
                      Requerido por Windows para que Python pueda capturar los paquetes de red del juego.
                    </p>
                    <p className="text-slate-300 text-[11px]">
                      Descárgalo gratis e instálalo desde:
                    </p>
                    <a
                      href="https://npcap.com/#download"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs hover:underline mt-1"
                    >
                      npcap.com/#download <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Formula Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <Layers className="w-4 h-4" /> Recursos e Ingredientes (Lotes)
                  </div>
                  <p className="text-xs text-slate-300">
                    Calcula automáticamente el valor unitario de cada lote disponible (x1, x10, x100, x1000) y toma la
                    <strong> media aritmética</strong> de los lotes activos.
                  </p>
                  <div className="bg-slate-900 p-2.5 rounded-xl text-[11px] font-mono text-emerald-300 border border-emerald-500/20">
                    p_unit = [p1, p10/10, p100/100, p1000/1000]<br />
                    Precio Guardado = round(∑ p_unit / N)
                  </div>
                </div>

                <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" /> Equipables (Filtro de Outliers & Exos)
                  </div>
                  <p className="text-xs text-slate-300">
                    Descarta precios troles o exo-magias (que superen 2.2x el precio base).
                    Promedia el cluster base: <strong>60% precio mínimo + 40% media normalizada</strong>.
                  </p>
                  <div className="bg-slate-900 p-2.5 rounded-xl text-[11px] font-mono text-amber-300 border border-amber-500/20">
                    ofertas_validas = [p for p in ofertas if p &le; min*2.2]<br />
                    Precio Guardado = round(min * 0.6 + media(validas) * 0.4)
                  </div>
                </div>
              </div>

              {/* Step by step guide */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    ¿Cómo ejecutarlo o pasárselo a un amigo? (2 Opciones)
                  </h4>
                  <button
                    onClick={handleDownloadBat}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-md shadow-amber-500/20"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar Lanzador .bat
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      ⚡ Opción A: Archivo .BAT (1 Clic)
                    </span>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                      <li>Tener instalados <strong>Python</strong>, <strong>Npcap</strong> y las librerías (<code className="text-amber-300 font-mono">pip install scapy requests</code>).</li>
                      <li>Descarga el archivo <strong>.bat</strong> o cópialo desde la pestaña Lanzador.</li>
                      <li>Hazle doble clic: solicita permisos de Administrador y se pone a escuchar directamente el mercadillo sin demoras.</li>
                    </ol>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      🐍 Opción B: Script Python (.py)
                    </span>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                      <li>Instala los requisitos: <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">pip install scapy requests</code></li>
                      <li>Abre PowerShell/CMD como <strong>Administrador</strong>.</li>
                      <li>Ejecuta: <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">python sniffer_standalone.py</code></li>
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
                    <FileCode className="w-4 h-4 text-amber-400" /> Lanzador por Lotes para Windows (.BAT)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ejecución limpia y directa. Simplemente haz doble clic y comenzará a capturar.
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

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <strong>¿Tu navegador o Windows bloquea la descarga del archivo .bat?</strong>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Es normal: los navegadores advierten al descargar scripts ejecutables. Puedes simplemente hacer clic en <strong>"Copiar Código .BAT"</strong>, crear un archivo de texto nuevo en tu bloc de notas, pegar el código y guardarlo como <code className="text-amber-300 font-mono">sincronizar.bat</code>.
                  </p>
                </div>
              </div>

              <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[360px] select-all leading-relaxed">
                {batContent}
              </pre>
            </div>
          )}

          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-slate-400">
                  Script listo para usar. Incluye decodificación de paquetes Protobuf de Dofus Unity y envío a tu API.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyScript}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? '¡Copiado!' : 'Copiar Código'}
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar .py
                  </button>
                  <button
                    onClick={handleDownloadBat}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
                    title="Doble clic y listo para Windows"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar Lanzador (.bat)
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
          <span>Servidor activo: <strong className="text-slate-300">{serverName}</strong></span>
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
