# Dofus Craft & Market Explorer (DBHDV)

Plataforma de análisis económico, modelado de rentabilidad de recetas, simulación de forjamagia, gestión de almacenes e ingestión pasiva de tráfico de red para Dofus Unity.

---

## Descripción General

Dofus Craft es una aplicación web analítica construida con React 19, Node.js/Express, funciones serverless y una capa de persistencia relacional SQL (SQLite local / Turso LibSQL remoto). Su propósito es optimizar la toma de decisiones comerciales, el cálculo de costos de fabricación artesanal, la valoración de almacenes patrimoniales y la auditoría de ventas en economías de juego activas.

### Capacidades Principales
- **Análisis de Rentabilidad y Subcrafteo**: Cálculo del costo directo y óptimo mediante resolución recursiva de ingredientes.
- **Planificación de Fabricación y Rotación**: Optimización de lotes de producción según presupuesto, canales de venta y absorción diaria estimada.
- **Gestión de Inventario (Mi Banco)**: Cruce de existencias locales contra el catálogo de recetas para identificar oportunidades de fabricación inmediata.
- **Simulador de Machacado de Runas**: Cálculo de producción de runas de forjamagia y coeficientes de rotura con aislamiento estricto por servidor.
- **Consumibles y Cacerías (BYC)**: Análisis de progresión de estadísticas, evaluación de pergaminos y comparativa de adquisición en cacerías legendarias.
- **Filtro Global por Oficios**: Restricción transversal de interfaces en función de las competencias y niveles de oficio configurados por el usuario.
- **DBHDV Suite Unificada 3.6**: Inspección pasiva de tráfico de red TCP para mercadillo, almacén unificado, historial de transacciones y listings activos en venta.
- **Sincronización Comunitaria Cloud**: Gestión centralizada de tokens de red mediante Turso LibSQL para garantizar resiliencia tras mantenimientos semanales.
- **Perfiles Aislados por Servidor**: Soporte para múltiples servidores de juego independientes con reactividad inmediata y preservación histórica.

---

## Módulos del Sistema

### 1. Calculadora de Recetas y Subcrafteo Multinivel
- Catálogo exhaustivo de recetas para todos los oficios de fabricación (Forjador, Escultor, Sastre, Zapatero, Joyero, Alquimista, etc.).
- Exclusión automática de equipamiento de clase y panoplias cosméticas sin demanda comercial.
- Modos de resolución de costos:
  - **Compra directa**: Valoración según el precio inmediato de cada ingrediente en mercadillo.
  - **Subcrafteo total**: Desglose jerárquico hasta materias primas base.
  - **Modo óptimo**: Selección automatizada de la ruta más económica entre compra y fabricación intermedia.
- Métricas financieras:
  - Costo de producción frente a cotización de venta.
  - Margen neto en kamas y retorno porcentual sobre la inversión (ROI).
  - Deducción automática de la tasa de puesta en venta en mercadillo (2%).

### 2. Planificador de Fabricación y Rotación
- Asignación presupuestaria orientada a maximizar la rentabilidad sin saturar la capacidad de mercadillo.
- Soporte para canales de venta independientes:
  - **Multicanal**: Asignación simultánea en mercadillos de equipamiento y consumibles.
  - **Equipamiento**: Lotes unitarios por pieza (armas, armaduras y trofeos).
  - **Consumibles / Recursos**: Agrupación automática en lotes comerciales (x1, x10, x100).
- Métricas de flujo de capital:
  - Proyección de retorno de inversión (*cashflow payback* en horas/días).
  - Identificación de cuellos de botella presupuestarios en materias primas.
  - Filtrado estadístico de cotizaciones atípicas o infladas mediante cálculo de mediana.

### 3. Gestión de Inventario y Fabricación Inversa (Mi Banco)
- Carga e importación rápida del inventario disponible en banco o personajes.
- Cruce matricial contra el árbol de recetas:
  - Objetos completamente fabricables con existencias actuales.
  - Fabricables adquiriendo un número reducido de ingredientes faltantes.
  - Clasificación por retorno potencial de capital.

### 4. Simulador de Machacado de Runas y Coeficientes
- Estimación determinista de tipos y cantidades de runas generadas según el nivel del objeto (1 a 200) y fórmulas oficiales de peso de características (`dofusRuneWeights.ts`).
- Registro y actualización de coeficientes de rotura con persistencia aislada por perfil de servidor.
- Comparativa financiera entre el costo de fabricación del objeto y la valoración estimada de las runas obtenidas.

### 5. Clasificación y Ranking de Rentabilidad
- Tabla consolidada de oportunidades comerciales ordenadas por margen neto, porcentaje de ROI o velocidad de absorción.
- Filtros por rango de nivel, categoría de objeto, oficio requerido y umbrales mínimos de rentabilidad.

### 6. Consumibles de Características y Optimización de Pergaminos
- Módulo especializado en vías de progresión de características base (0 a 100).
- Comparativa entre consumibles derivados de protectores de recursos y pergaminos de características.
- Modelado de rentabilidad por sebuscalín frente a referencias comerciales de mercado.

### 7. Cacerías Legendarias y Análisis Comercial (BYC)
- Catálogo de cacerías legendarias y mapas de búsqueda.
- Análisis de decisión: venta del recurso directo del jefe frente a la fabricación de los equipables asociados.
- Evaluación de rutas de adquisición:
  - Adquisición de fragmentos, resolución de cacería y fabricación.
  - Adquisición directa de mapa en mercadillo, resolución y fabricación.
  - Compra directa del recurso final y fabricación.
- Exportación estructurada a hojas de cálculo con fórmulas dinámicas.

### 8. Filtro Global de Competencias (Mis Oficios)
- Configuración persistente a nivel local (`localStorage`) para los 20 oficios de recolección, fabricación y forjamagia.
- Activación transversal en un clic para restringir recetas, cálculo de machacado y clasificaciones únicamente a objetos que el usuario puede elaborar.

### 9. Integración con Dofusbook
- Importación de sets mediante enlace público o identificador de equipamiento.
- Detección automática de piezas asignadas y balance comparativo entre compra directa y fabricación artesanal.
- Exportación consolidada a la lista de compras.

### 10. Planificador de Compras
- Consolidación y agregación de ingredientes para lotes simples o múltiples.
- Desglose por mercadillo de destino y estimación de presupuesto total requerido.

### 11. Gestión de Cotizaciones y Métricas de Demanda
- Perfiles de precios independientes por servidor con aislamiento estricto de cotizaciones.
- Panel de métricas de absorción: volumen de ventas en 24h, 7d, 30d y tasa diaria de rotación.
- Historial de fluctuaciones y herramientas de exportación/importación JSON.

### 12. DBHDV Suite Unificada 3.6 (Captura Pasiva y Diagnóstico)
Script de alto rendimiento en Python (`sniffer/dofus_suite.py`) estructurado en 12 submódulos integrados:
- **Modos de Captura en Vivo**:
  1. *Sniffer de Mercadillo*: Captura de cotizaciones x1, x10, x100, x1000 en tiempo real y transmisión HTTP asíncrona por lotes.
  2. *Sniffer de Almacén Unificado*: Consolidación simultánea de inventario de personaje, banco de cuenta y cofre de merkasako.
  3. *Sniffer de Historial de Ventas*: Registro cronológico de transacciones realizadas, ingresos brutos y notificaciones de caducidad.
  4. *Sniffer de Listings Activos en Venta*: Lotes colocados activamente en mercadillos de recursos, equipamiento y consumibles con partición atómica y cálculo exacto de precios.
- **Visores Visuales Web Locales**:
  5. *Visor de Almacén* (`sniffer/viewer/visor_almacen.html`): Exploración gráfica interactiva y filtrado de existencias locales.
  6. *Visor de Historial* (`sniffer/viewer/visor_historial.html`): Auditoría analítica de transacciones comerciales pasadas.
- **Calibración y Diagnóstico de Red**:
  7-10. *Calibradores Inteligentes*: Descubrimiento interactivo y validación de tokens de red (`price_list`, `inventory`, `storage`, `sales_history`, `active_listings`) tras cada parche semanal.
  11. *Sincronización Cloud Comunitaria*: Descarga y publicación de tokens comunitarios verificados mediante la API central.
  12. *Telemetría y Registro Diagnóstico*: Inspección de trazas y depuración de ráfagas TCP.

---

## Arquitectura Técnica

```
├── client (Frontend)
│   ├── React 19 + TypeScript + Vite 6
│   ├── Tailwind CSS v4
│   ├── TanStack Virtual (virtualización para catálogos extensos)
│   └── Lucide Icons
│
├── server (Backend Express / Local)
│   ├── server.ts (Punto de entrada: Vite en desarrollo, estáticos en producción)
│   ├── src/server/expressApp.ts (Endpoints de API, ingestión, tokens y sincronización)
│   └── src/server/localDataStore.ts (Capa de datos y persistencia SQL con Turso / LibSQL)
│
├── sniffer (DBHDV Suite Unificada 3.6)
│   ├── dofus_suite.py (Suite completa de captura, calibración y sincronización)
│   ├── config/ (keymap.json, item_categories.json, items_db.json)
│   ├── data/ (Archivos locales de captura excluidos de control de versiones)
│   ├── logs/ (Registros de diagnóstico de calibración y ejecución)
│   └── viewer/ (Generadores y visores web offline de almacén e historial)
│
├── api (Serverless Functions - Vercel)
│   ├── api/tokens.ts (Gestión y sincronización comunitaria de tokens de red)
│   ├── api/market/download-bat.ts (Lanzador .BAT unificado para Windows con elevación UAC)
│   ├── api/market/suite-script.ts (Distribución del script dofus_suite.py)
│   ├── api/market/* (Ingestión de precios y diccionarios)
│   └── api/local-db/* (Endpoints de persistencia relacional)
│
└── database (Persistencia)
    ├── local.db (Base de datos SQLite local predeterminada)
    └── Turso LibSQL Remoto (Configurable mediante TURSO_DATABASE_URL / DATABASE_URL)
```

---

## Endpoints de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Verificación de estado operativo del servicio. |
| `GET` | `/api/tokens` | Consulta de tokens de red comunitarios verificados (Dofus Unity 3.6). |
| `POST` | `/api/tokens` | Publicación y actualización comunitaria de tokens tras calibración. |
| `GET` | `/api/market/suite-script` | Descarga directa de la DBHDV Suite Unificada (`dofus_suite.py`). |
| `GET` | `/api/market/download-bat` | Generación del lanzador `.bat` unificado para Windows con elevación UAC. |
| `POST` | `/api/market/update` | Ingestión individual de cotizaciones de mercadillo. |
| `POST` | `/api/market/batch-update` | Ingestión masiva asíncrona de cotizaciones enviadas por la suite. |
| `GET` | `/api/market/latest-prices` | Consulta de cotizaciones más recientes por servidor. |
| `GET` | `/api/market/items-dictionary` | Diccionario indexado ID -> Nombre para resolución local de objetos. |
| `GET` | `/api/market/download-items-db` | Descarga de la base local de objetos (`items_db.json`). |
| `GET` | `/api/local-db/bootstrap` | Carga inicial consolidada (catálogo, recetas, precios, perfiles y configuración). |
| `GET` | `/api/local-db/meta` | Resumen estadístico de registros en base de datos. |
| `GET` | `/api/local-db/items/:id` | Consulta de objeto por identificador numérico. |
| `GET` | `/api/local-db/recipes/:resultId` | Consulta de receta asociada al objeto resultante. |
| `PUT` | `/api/local-db/prices/:itemId` | Actualización de cotización para un objeto en el perfil activo. |
| `PUT` | `/api/local-db/prices` | Actualización masiva de cotizaciones en el perfil activo. |
| `GET` | `/api/local-db/price-history` | Consulta paginada del historial cronológico de precios. |
| `GET` | `/api/local-db/coefficients` | Consulta de coeficientes de machacado guardados. |
| `POST` | `/api/local-db/coefficients/bulk` | Guardado en lote de coeficientes de machacado. |
| `POST` | `/api/dofusbook/analyze` | Análisis de equipamiento, costos y crafteo para builds externas. |
| `GET` | `/api/dofocus/servers` | Consulta de servidores disponibles en DoFocus. |
| `GET` | `/api/dofocus/coefficients/:serverName` | Consulta de coeficientes de rotura por servidor. |
| `GET` | `/api/dofocus/item/:itemId` | Coeficiente de rotura específico para un objeto. |

---

## Configuración del Entorno

Variables de entorno configurables en `.env`:

```env
# Configuración del Servidor y Control de Acceso (Opcionales)
APP_HOST=0.0.0.0
APP_BASIC_AUTH_USER=
APP_BASIC_AUTH_PASSWORD=
APP_BASIC_AUTH_REALM=Acceso Privado

# Autenticación de Ingestión de Precios (Opcional)
MARKET_SNIFFER_SECRET=

# Persistencia SQL Remota (Turso / LibSQL)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
DATABASE_URL=
DATABASE_AUTH_TOKEN=
```

---

## Instalación y Despliegue

### Requisitos Previos
- **Node.js**: Versión 20 o superior
- **npm**: Versión 10 o superior
- **Python**: Versión 3.9 o superior (requerido únicamente para la ejecución de la suite en el cliente)
- **Npcap**: Requerido en entornos Windows para la captura pasiva de paquetes de red

### Pasos de Instalación

1. Instalar dependencias del proyecto:
   ```bash
   npm install
   ```

2. Configurar variables de entorno (opcional):
   ```bash
   cp .env.example .env
   ```

3. Iniciar entorno de desarrollo:
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000`.

4. Compilar y ejecutar en modo producción:
   ```bash
   npm run build
   npm run start
   ```

---

## Operación de la DBHDV Suite Unificada

1. En la barra superior de la aplicación web, acceder a la opción **Sniffer de Mercadillo**.
2. Seleccionar el servidor de juego activo (por ejemplo, *Draconiros*).
3. Hacer clic en **Descargar .BAT (Suite Unificada 3.6)**.
4. Ejecutar el archivo `.bat` descargado con doble clic (solicitará permisos de Administrador para Scapy/Npcap).
5. El lanzador descargará automáticamente `dofus_suite.py` y `items_db.json`, sincronizará los tokens comunitarios desde DBHDV Cloud y desplegará el menú interactivo con las 12 opciones de captura, visualización y calibración.
