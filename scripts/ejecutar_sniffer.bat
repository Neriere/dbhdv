@echo off
setlocal EnableDelayedExpansion
title Dofus Unity - Sincronizador de Mercadillo (HDV)

:: =====================================================================
:: Auto-elevacion de permisos a Administrador
:: =====================================================================
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
cls
echo =====================================================================
echo       DOFUS UNITY - MERCADILLO AUTO-SYNC (DBHDV)
echo =====================================================================
echo.

:: =====================================================================
:: 1. Comprobar si Python esta instalado
:: =====================================================================
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Python no esta instalado o no se anadio al PATH.
    echo.
    echo Por favor descarga e instala Python desde: https://www.python.org/downloads/
    echo Recuerda marcar la casilla: 'Add Python to PATH' durante la instalacion.
    echo.
    pause
    exit /b 1
)

:: =====================================================================
:: 2. Instalar dependencias requeridas automaticamente si faltan
:: =====================================================================
echo Verificando librerias de Python (scapy, requests)...
python -c "import scapy, requests" >nul 2>&1
if %errorLevel% neq 0 (
    echo Instalando librerias necesarias, un momento por favor...
    pip install scapy requests
    if %errorLevel% neq 0 (
        echo.
        echo [ERROR] Hubo un problema al instalar las dependencias con pip.
        pause
        exit /b 1
    )
    echo Librerias instaladas con exito.
    echo.
)

:: =====================================================================
:: 3. Ejecutar el script sniffer embebido
:: =====================================================================
echo Iniciando sincronizador de paquetes...
echo.

python -c "
import sys, re, json, time, requests
from datetime import datetime

try:
    from scapy.all import sniff, TCP, Raw
except ImportError:
    print('[ERROR] Falta Scapy o Npcap en Windows.')
    print('Descarga Npcap desde: https://npcap.com/#download')
    sys.exit(1)

# ==================== CONFIGURACION ====================
VERCEL_API_URL = 'https://dbhdv.vercel.app/api/market/update'
API_SECRET_KEY = ''
SERVER_NAME = 'Draconiros'
DOFUS_PORTS = 'tcp port 5555'
# =======================================================

print('=================================================================')
print('  DOFUS UNITY -> MERCADILLO AUTO-SYNC')
print(f'  Destino API : {VERCEL_API_URL}')
print(f'  Servidor    : {SERVER_NAME}')
print('=================================================================')
print('🟢 Escuchando mercadillo en segundo plano...')
print('💡 Abre Dofus Unity y haz clic en los objetos del mercadillo.')
print('Presiona Ctrl+C para detener.\n')

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

    # 1. Recursos (lotes)
    if 'prices' in text or 'quantities' in text or 'objects' in text:
        match_resource = re.search(r'\"(?:itemId|objectGID|id)\":\s*(\d+).*?\"prices\":\s*\[(.*?)\]', text)
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
                    send_price_update(item_id=item_id, item_name=f'Objeto #{item_id}', p_type='recurso', precios=lot_map)
                    return

    # 2. Equipables
    match_equip = re.search(r'\"(?:itemId|objectGID|id)\":\s*(\d+).*?\"offers\":\s*\[(.*?)\]', text)
    if match_equip:
        item_id = int(match_equip.group(1))
        offers_str = match_equip.group(2)
        price_matches = re.findall(r'\"price\":\s*(\d+)', offers_str)
        if price_matches:
            numeric_prices = [int(p) for p in price_matches if int(p) > 0]
            if numeric_prices:
                send_price_update(item_id=item_id, item_name=f'Objeto #{item_id}', p_type='equipable', precios=numeric_prices)
                return

def send_price_update(item_id, item_name, p_type, precios):
    payload = {
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
        res = requests.post(VERCEL_API_URL, json=payload, headers=headers, timeout=5)
        now_str = datetime.now().strftime('%H:%M:%S')
        if res.status_code == 200:
            data = res.json()
            p_calc = data.get('calculated_price', 0)
            name = data.get('name', item_name)
            t_label = 'RECURSO' if p_type == 'recurso' else 'EQUIPABLE'
            print(f'[{now_str}]  [{t_label}] {name} (#{item_id}) -> Guardado en Turso: {p_calc:,} k (Servidor: {SERVER_NAME})')
        else:
            print(f'[{now_str}] ⚠️ Error {res.status_code}: {res.text}')
    except Exception as e:
        now_str = datetime.now().strftime('%H:%M:%S')
        print(f'[{now_str}] ❌ Error de conexion con Vercel: {e}')

try:
    sniff(filter=DOFUS_PORTS, prn=handle_packet, store=0)
except KeyboardInterrupt:
    print('\nSincronizador detenido por el usuario.')
except Exception as e:
    print(f'\nError durante la captura de paquetes: {e}')
    print('Asegurate de tener Npcap instalado: https://npcap.com/#download')
"

echo.
pause
