# HISTORIAL Y ARQUITECTURA DEL SNIFFER DE ALMACÉN, BANCO E INVENTARIO (LOCAL)

> **Documento Privado de Desarrollo e Inspección:**  
> Este documento registra la arquitectura técnica, estructura de paquetes en Dofus Unity, heurísticas de extracción, funcionamiento de la interfaz local secundaria y notas de depuración para futuras correcciones del Sniffer de Almacenamiento (Inventario, Banco y Merkasako).  
> **Estado:** 100% Local, Privado y Protegido en `.gitignore`.

---

## 1. Propósito y Objetivo Fundamental

El objetivo de este componente es permitir al jugador **capturar de forma automática y pasiva la totalidad de recursos y objetos que posee en su inventario, banco y cofre de merkasako**, generando un archivo JSON estándar compatible con la plataforma web **Dofus Craft & Market Explorer (DofusDB HDV)**.

### Beneficios Directos:
1. **Eliminación de Carga Manual:** No es necesario ingresar o pegar listas de texto de recursos uno por uno.
2. **Cálculo Inmediato de Rentabilidad:** Permite cruzar el inventario real contra el catálogo de recetas (`BankCraftingView.tsx`) para identificar qué recetas se pueden fabricar con coste cero o inversión mínima, cruzándolas con las ventas diarias (`salesVolumeService.ts`) para maximizar la ganancia en kamas.
3. **Privacidad Total (Aislamiento Local):** A diferencia del sniffer de mercadillo (cuyos precios son públicos y van al servidor), el inventario del jugador **nunca se envía a internet ni a ningún servidor externo**. Se procesa y almacena 100% de manera local en la máquina del usuario.
4. **Verificación Visual Autónoma:** Incorpora un servidor web local (`http://127.0.0.1:5560`) con un dashboard interactivo que abre automáticamente el navegador para que el usuario pueda confirmar la exactitud de los objetos y cantidades capturadas antes de usarlos en la calculadora.

---

## 2. Arquitectura de Archivos del Sniffer de Almacén

```
d:\dbhdv/
├── scripts/
│   ├── storage_sniffer.py          # Script principal: captura TCP Scapy + decodificador Protobuf + servidor web local
│   ├── ejecutar_sniffer_almacen.bat # Launcher para Windows con elevación UAC y auto-instalación de dependencias
│   ├── items_db.json               # Diccionario local ID -> Nombre en español
│   └── ...
├── src/data/
│   └── staticItemsDictionary.json  # Catálogo estático de más de 10,000 ítems indexados
├── banco_inventario_capturado.json # Archivo JSON generado automáticamente listo para "Mi Banco"
├── storage_inspection.txt          # Volcados hexadecimales y números para depuración de paquetes
├── storage_sniffer.log             # Registro cronológico de capturas de la sesión
└── HISTORIAL_SNIFFER_ALMACEN.md    # Este documento técnico
```

Todos estos archivos están estrictamente protegidos en `.gitignore` para garantizar que no se sincronicen al repositorio de GitHub.

---

## 3. Protocolo de Red de Dofus Unity para Almacenamiento

### 3.1. Cuándo se Transmiten los Paquetes
- **Inventario del Personaje:** Se envía al ingresar al mundo, cambiar de mapa o tras combates/intercambios.
- **Banco:** Se transmite como una ráfaga masiva de paquetes TCP en el momento exacto en que el jugador habla con el PNJ Banquero y se abre la interfaz gráfica del banco.
- **Cofre de Merkasako:** Se transmite al hacer clic en el cofre dentro del merkasako.

### 3.2. Fragmentación TCP (TCP Stream Reassembly)
Un banco típico de un jugador contiene entre 300 y 2,000 tipos de recursos diferentes, lo que genera payloads de **20 KB a más de 150 KB**.
- Dado que el MTU estándar de red es de ~1,460 a 1,500 bytes, el sistema operativo recibe este mensaje dividido en **15 a 100 paquetes TCP fragmentados**.
- **Solución implementada:** `storage_sniffer.py` mantiene un búfer de reensamblado por flujo TCP (`flow_key = ip:sport -> ip:dport`). Concatena los fragmentos entrantes hasta que se completan las estructuras de submensajes Protobuf, evitando la pérdida de objetos por corte de paquete.

### 3.3. Estructura Protobuf de los Objetos (`ObjectItem`)
En los paquetes de almacenamiento de Dofus Unity, cada ítem se codifica como un submensaje Protobuf delimitado por longitud (`wire_type == 2`):

```protobuf
message ObjectItem {
  uint32 objectUID = 1;     // ID único de instancia del objeto en la cuenta
  uint32 objectGID = 2;     // ID oficial del objeto en la enciclopedia (ej: 289 = Trigo)
  uint32 quantity = 3;      // Cantidad de unidades (varint >= 1)
  uint32 position = 4;      // Posición (63 = inventario general, 0 = almacén/banco)
  repeated Effect ...       // Efectos/stats (solo presente en equipables)
}
```

### 3.4. Heurística de Extracción Resiliente (`extract_object_item_candidate`)
Para asegurar compatibilidad incluso si Ankama altera los números de campo (`fnum`) en parches menores:
1. **Validación de GID:** Comprueba si alguno de los varints coincide con un ID válido presente en el diccionario local de 10,000+ objetos (`ITEMS_MAP`).
2. **Validación de Cantidad:** Identifica el varint que representa las unidades ($1 \le Q \le 2,000,000,000$).
3. **Agrupación y Detección de Ráfagas:** Si un paquete o bloque reensamblado contiene $\ge 3$ candidatos válidos, se clasifica inequívocamente como un evento de carga de almacén/inventario.

---

## 4. Funcionamiento de la Interfaz Secundaria Local (Dashboard)

El script inicia automáticamente un servidor HTTP ligero en el puerto local `http://127.0.0.1:5560` (o el siguiente puerto libre disponible) y abre el navegador del usuario.

### Capacidades del Dashboard Web:
1. **Monitor de Estado en Tiempo Real:** Polling automático cada 1.5 segundos. Cuando abres el banco en el juego, la pantalla cambia instantáneamente de *"Esperando apertura de banco..."* (ámbar) a *"¡Almacén Capturado!"* (verde esmeralda).
2. **Panel de Métricas Clave:**
   - **Objetos Únicos:** Contador de tipos de recursos diferentes en posesión.
   - **Total Unidades:** Suma acumulada de unidades (pods).
   - **Badges de Almacenes:** Distingue si los recursos provienen de Banco, Inventario o Merkasako.
   - **Hora de Captura:** Timestamp exacto de la última lectura.
3. **Buscador y Filtros Interactivos:**
   - Búsqueda instantánea por nombre (ej: "Trigo", "Hierro") o ID (#289, #312).
   - Filtro por contenedor: `Todo Consolidado`, `Solo Banco`, `Solo Inventario`, `Solo Merkasako`.
   - Ordenación por Mayor Cantidad, Menor Cantidad, Nombre A-Z o ID.
4. **Exportación con 1 Clic para la Plataforma Web:**
   - **Botón "Descargar JSON para Mi Banco":** Genera y descarga el archivo con la estructura exacta:
     ```json
     [
       { "itemId": 289, "quantity": 1450 },
       { "itemId": 312, "quantity": 300 }
     ]
     ```
   - **Botón "Copiar al Portapapeles":** Permite copiar el array JSON directamente para pegarlo.
   - **Guardado Automático en Disco:** Paralelamente, el sniffer guarda siempre en la raíz del proyecto el archivo `banco_inventario_capturado.json`.

---

## 5. Guía de Uso Paso a Paso

1. **Ejecución:**
   - En Windows, haz doble clic en `scripts\ejecutar_sniffer_almacen.bat` (o ejecuta en consola con permisos de Administrador: `python scripts/storage_sniffer.py`).
   - Se abrirá la consola negra con el sniffer activo y tu navegador abrirá `http://127.0.0.1:5560`.
2. **Captura en el Juego:**
   - Entra a Dofus Unity con tu personaje.
   - Habla con un banquero y abre el **Banco**.
   - (Opcional) Abre tu cofre del **Merkasako** o abre tu **Inventario**.
   - En la interfaz web verás cómo aparecen todos tus objetos con sus iconos oficiales, nombres y cantidades exactas.
3. **Importar a la Plataforma Web:**
   - En el dashboard local, haz clic en **"Descargar JSON para Mi Banco"** (o usa el archivo `banco_inventario_capturado.json` que ya se guardó automáticamente).
   - En tu aplicación web principal (`DofusDB HDV`), ve a la pestaña **"Mi Banco"** (`BankCraftingView`).
   - Haz clic en **"Importar JSON"**, selecciona el archivo y listo: todas tus recetas posibles, crafteos inversos y planificaciones de oficio se actualizarán al 100% con los recursos que realmente tienes.

---

## 6. Registro de Cambios y Notas de Depuración

### [Versión 1.0.0] - Implementación Inicial
- Creación de `scripts/storage_sniffer.py` con captura pasiva Scapy en `tcp port 5555`.
- Implementación del decodificador universal de `ObjectItem` con soporte para `staticItemsDictionary.json` y `items_db.json`.
- Servidor web local HTTP multihilo integrado en el puerto 5560 con apertura automática de navegador.
- Dashboard SPA responsivo con Tailwind CSS, búsqueda en tiempo real, ordenaciones y exportador directo JSON.
- Creación de `scripts/ejecutar_sniffer_almacen.bat` con auto-elevación UAC en Windows.
- Configuración de reglas estrictas en `.gitignore` para salvaguardar la privacidad de las capturas y no subir inventarios a GitHub.
