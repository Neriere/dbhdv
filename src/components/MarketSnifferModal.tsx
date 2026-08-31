import React, { useState } from 'react';
import {
  Radio,
  X,
  Copy,
  Check,
  Download,
  Terminal,
  Zap,
  ShieldCheck,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Server,
  Layers,
  Sparkles,
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
  const [activeTab, setActiveTab] = useState<'instructions' | 'script' | 'simulator'>('instructions');

  // Simulator state
  const [testType, setTestType] = useState<'recurso' | 'equipable'>('recurso');
  const [testItemId, setTestItemId] = useState<number>(289); // Trigo
  const [testItemName, setTestItemName] = useState<string>('Trigo');
  const [testP1, setTestP1] = useState<number>(150);
  const [testP10, setTestP10] = useState<number>(1400);
  const [testP100, setTestP100] = useState<number>(12000);
  const [testP1000, setTestP1000] = useState<number>(110000);
  const [testEquipPrices, setTestEquipPrices] = useState<string>('450000, 480000, 520000, 2500000');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const apiUrl = `${currentOrigin}/api/market/update`;
  const serverName = activeProfile?.name || 'Draconiros';

  const pythonScript = `#!/usr/bin/env python3
"""
===============================================================================
  DOFUS UNITY -> MERCADILLO LIVE SYNC (AUTOMATIC PACKET SNIFFER)
===============================================================================
  Instalación:
    pip install scapy requests

  Ejecución (en Windows abrir terminal como Administrador):
    python sniffer_standalone.py
===============================================================================
"""

import sys
import requests
from datetime import datetime

try:
    from scapy.all import sniff, TCP, Raw
except ImportError:
    print("[ERROR] Falta la librería 'scapy'. Instálala ejecutando: pip install scapy requests")
    sys.exit(1)

# ==================== CONFIGURACIÓN ====================
VERCEL_API_URL = "${apiUrl}"
API_SECRET_KEY = ""  # Pon tu MARKET_SNIFFER_SECRET si configuraste una clave
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
            name = (
                data.get("name", {}).get("es")
                or data.get("name", {}).get("fr")
                or data.get("name", {}).get("en")
                or f"Item #{item_id}"
            )
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
    try:
        idx = buf.find(b"type.ankama.com/kbt")
        if idx == -1:
            idx = buf.find(b"kbt")
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

            headers = {"Content-Type": "application/json"}
            if API_SECRET_KEY:
                headers["x-api-key"] = API_SECRET_KEY

            try:
                res = requests.post(VERCEL_API_URL, json=body, headers=headers, timeout=3.0)
                now_str = datetime.now().strftime("%H:%M:%S")
                if res.status_code == 200:
                    data = res.json()
                    calc_price = data.get("calculated_price", 0)
                    item_type = data.get("type", body["type"])
                    print(f"[{now_str}]  [{item_type.upper()}] {name} (#{item_id}) -> Guardado en Turso: {calc_price:,} k (Servidor: {SERVER_NAME})")
                else:
                    print(f"[{now_str}] [Error {res.status_code}] {res.text}")
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [Error de conexión]: {e}")

if __name__ == "__main__":
    print("=" * 65)
    print("  DOFUS UNITY -> MERCADILLO AUTO-SYNC")
    print(f"  Destino API : {VERCEL_API_URL}")
    print(f"  Servidor    : {SERVER_NAME}")
    print("=" * 65)
    print("🟢 Escuchando mercadillo en segundo plano...")
    print("💡 Haz clic en los objetos del mercadillo en Dofus para actualizar precios.")
    sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
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
    const batContent = `@echo off
setlocal EnableDelayedExpansion
title Dofus Unity - Sincronizador de Mercadillo (HDV)

:: Auto-elevacion a Administrador si no tiene permisos
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
cls
echo =====================================================================
echo       DOFUS UNITY - MERCADILLO AUTO-SYNC (${serverName.toUpperCase()})
echo =====================================================================
echo.

python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Python no esta instalado o no se anadio al PATH de Windows.
    echo Descargalo desde: https://www.python.org/downloads/
    echo Recuerda marcar 'Add Python to PATH' durante la instalacion.
    echo.
    pause
    exit /b 1
)

echo Verificando librerias de Python (scapy, requests)...
python -c "import scapy, requests" >nul 2>&1
if %errorLevel% neq 0 (
    echo Instalando librerias scapy y requests automaticamente...
    pip install scapy requests
    echo.
)

if not exist "sniffer_standalone.py" (
    echo Creando sniffer_standalone.py en este directorio...
)

python -c "
import sys, re, json, time, requests
from datetime import datetime

try:
    from scapy.all import sniff, TCP, Raw
except ImportError:
    print('[ERROR] Falta Scapy o Npcap en Windows.')
    print('Descarga Npcap desde: https://npcap.com/#download')
    sys.exit(1)

VERCEL_API_URL = '${apiUrl}'
API_SECRET_KEY = '${apiSecret}'
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

def clean_text(raw_bytes):
    try:
        return raw_bytes.decode('utf-8', errors='ignore')
    except Exception:
        return ''

def handle_packet(packet):
    if not packet.haslayer(Raw):
        return
    payload = packet[Raw].load
    text = clean_text(payload)
    if not text:
        return

    if 'prices' in text or 'quantities' in text or 'objects' in text:
        match_resource = re.search(r'\"(?:itemId|objectGID|id)\":\\s*(\\d+).*?\"prices\":\\s*\\[(.*?)\\]', text)
        if match_resource:
            item_id = int(match_resource.group(1))
            prices_str = match_resource.group(2)
            prices_list = [int(p.strip()) for p in prices_str.split(',') if p.strip().isdigit()]
            if prices_list:
                lot_map = {}
                lots = ['1', '10', '100', '1000']
                for idx, price in enumerate(prices_list[:4]):
                    if price > 0:
                        lot_map[lots[idx]] = price
                if lot_map:
                    send_price_update(item_id, f'Objeto #{item_id}', 'recurso', lot_map)
                    return

    match_equip = re.search(r'\"(?:itemId|objectGID|id)\":\\s*(\\d+).*?\"offers\":\\s*\\[(.*?)\\]', text)
    if match_equip:
        item_id = int(match_equip.group(1))
        offers_str = match_equip.group(2)
        price_matches = re.findall(r'\"price\":\\s*(\\d+)', offers_str)
        if price_matches:
            numeric_prices = [int(p) for p in price_matches if int(p) > 0]
            if numeric_prices:
                send_price_update(item_id, f'Objeto #{item_id}', 'equipable', numeric_prices)
                return

def send_price_update(item_id, item_name, p_type, precios):
    body = {
        'item_id': item_id,
        'item_name': item_name,
        'type': p_type,
        'server': SERVER_NAME,
        'precios': precios,
        'source': 'sniffer-bat'
    }
    headers = {'Content-Type': 'application/json'}
    if API_SECRET_KEY:
        headers['x-market-secret'] = API_SECRET_KEY
    try:
        res = requests.post(VERCEL_API_URL, json=body, headers=headers, timeout=5)
        now_str = datetime.now().strftime('%H:%M:%S')
        if res.status_code == 200:
            data = res.json()
            p_calc = data.get('calculated_price', 0)
            name = data.get('name', item_name)
            t_label = 'RECURSO' if p_type == 'recurso' else 'EQUIPABLE'
            print(f'[{now_str}]  [{t_label}] {name} (#{item_id}) -> Guardado en Turso: {p_calc:,} k ({SERVER_NAME})')
        else:
            print(f'[{now_str}] ⚠️ Error {res.status_code}: {res.text}')
    except Exception as e:
        print(f'[{datetime.now().strftime(\"%H:%M:%S\")}] ❌ Error de conexion: {e}')

try:
    sniff(filter=DOFUS_PORTS, prn=handle_packet, store=0)
except KeyboardInterrupt:
    print('\\nSincronizador detenido.')
except Exception as e:
    print(f'\\nError de captura: {e}')
"
pause
`;
    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sincronizar_mercadillo_${serverName.toLowerCase()}.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    setSimError(null);
    setSimResult(null);

    try {
      let body: any = {
        item_id: testItemId,
        item_name: testItemName,
        type: testType,
        server: serverName,
        source: 'sniffer_test',
      };

      if (testType === 'recurso') {
        body.precios = {
          '1': testP1,
          '10': testP10,
          '100': testP100,
          '1000': testP1000,
        };
      } else {
        const prices = testEquipPrices
          .split(',')
          .map((p) => parseInt(p.trim(), 10))
          .filter((n) => !isNaN(n) && n > 0);
        body.precios = prices;
      }

      const res = await fetch('/api/market/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setSimResult(data);
      if (onPriceUpdated) onPriceUpdated();
    } catch (err: any) {
      setSimError(err.message || 'Error al ejecutar simulación');
    } finally {
      setIsSimulating(false);
    }
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
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-950/30 text-xs font-bold">
          <button
            onClick={() => setActiveTab('instructions')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'instructions'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Guía y Fórmulas de Cálculo
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Script Python Standalone
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`pb-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            Simulador de Paquetes en Vivo
          </button>
        </div>

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
                    <ShieldCheck className="w-4 h-4" /> Equipables (Filtro Inteligente de Outliers & Exos)
                  </div>
                  <p className="text-xs text-slate-300">
                    Descarta ofertas con precios troles o exo-magias (que superen 2.2x el precio base o la mediana).
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
                      <li>Tener instalado <strong>Python</strong> y <strong>Npcap</strong> en Windows.</li>
                      <li>Descarga el archivo <strong>.bat</strong> y hazle doble clic.</li>
                      <li>Pide permisos de Administrador e instala librerías solo.</li>
                    </ol>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                      🐍 Opción B: Script Python (.py)
                    </span>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                      <li>Ejecuta: <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">pip install scapy requests</code></li>
                      <li>Abre PowerShell/CMD como <strong>Administrador</strong>.</li>
                      <li>Ejecuta: <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">python sniffer_standalone.py</code></li>
                    </ol>
                  </div>
                </div>
              </div>
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
                    title="Doble clic y listo para Windows (Auto-elevación a Administrador e instalación de librerías)"
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

          {activeTab === 'simulator' && (
            <div className="space-y-5">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" /> Probar Envío Directo a la API
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTestType('recurso');
                        setTestItemId(289);
                        setTestItemName('Trigo');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        testType === 'recurso'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🌾 Recurso (Lotes)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTestType('equipable');
                        setTestItemId(2469);
                        setTestItemName('Gelanillo');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        testType === 'equipable'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚔️ Equipable (Ofertas)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      ID del Objeto
                    </label>
                    <input
                      type="number"
                      value={testItemId}
                      onChange={(e) => setTestItemId(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={testItemName}
                      onChange={(e) => setTestItemName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {testType === 'recurso' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Lote x1</label>
                      <input
                        type="number"
                        value={testP1}
                        onChange={(e) => setTestP1(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Lote x10</label>
                      <input
                        type="number"
                        value={testP10}
                        onChange={(e) => setTestP10(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Lote x100</label>
                      <input
                        type="number"
                        value={testP100}
                        onChange={(e) => setTestP100(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Lote x1000</label>
                      <input
                        type="number"
                        value={testP1000}
                        onChange={(e) => setTestP1000(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Ofertas de Equipable (separadas por coma)
                    </label>
                    <input
                      type="text"
                      value={testEquipPrices}
                      onChange={(e) => setTestEquipPrices(e.target.value)}
                      placeholder="Ej: 450000, 480000, 520000, 2500000"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      El filtro de outliers elimina automáticamente valores extremos (como 1,000,000 o 2,500,000) si superan 2.2x el precio mínimo o el cluster base.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSimulating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isSimulating ? 'Enviando a API...' : 'Enviar Paquete de Prueba a Turso'}
                </button>
              </div>

              {simResult && (
                <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" /> ¡Precio calculado y guardado con éxito en Turso SQLite!
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                    <div className="bg-slate-900 p-2 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Precio Guardado:</span>
                      <span className="text-amber-300 font-mono font-bold text-sm">
                        {simResult.calculated_price?.toLocaleString()} k
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Precio Mínimo:</span>
                      <span className="text-slate-200 font-mono font-bold text-sm">
                        {simResult.min_price?.toLocaleString()} k
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Promedio General:</span>
                      <span className="text-slate-200 font-mono font-bold text-sm">
                        {simResult.raw_average?.toLocaleString()} k
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Servidor Asignado:</span>
                      <span className="text-slate-200 font-bold text-xs">{simResult.server}</span>
                    </div>
                  </div>
                </div>
              )}

              {simError && (
                <div className="bg-rose-950/50 border border-rose-500/30 rounded-2xl p-3 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{simError}</span>
                </div>
              )}
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
