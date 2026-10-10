# Dofus Craft & Market Explorer (DBHDV)

Plataforma de análisis económico, modelado de rentabilidad de recetas, simulación de forjamagia, valoración de inventarios e inspección pasiva de tráfico de red para Dofus Unity 3.6.

---

## Descripción General

**DBHDV** es una solución web integral construida con React 19, TypeScript, Node.js/Express, funciones serverless y almacenamiento relacional SQL (SQLite local / Turso LibSQL remoto). Su objetivo es maximizar la eficiencia y rentabilidad en la economía de Dofus Unity, automatizando el análisis de precios, márgenes de fabricación, consumo de materias primas y tendencias de mercado.

La plataforma se compone de dos elementos centrales:
1. **Aplicación Web**: Interfaz analítica reactiva con calculadoras de subcrafteo, simulador de forjamagia, gestión de banco y planificador de producción.
2. **DBHDV Suite Unificada (Sniffer)**: Cliente ligero en Python que intercepta de forma pasiva los paquetes TCP de Dofus Unity (mercadillo, almacén, ventas y ofertas activas) y alimenta de cotizaciones en tiempo real a la API web.

---

## Capacidades Principales

- **Análisis de Rentabilidad y Subcrafteo Recursivo**: Cálculo en tiempo real del costo de producción directo, desglosado o mixto óptimo frente al precio de venta y tasas de mercadillo.
- **Planificador de Producción y Rotación**: Optimización de lotes de fabricación considerando presupuesto, canales de venta (unitario vs. lotes x10/x100) y velocidad de absorción estimada.
- **Inventario y Crafteo Inverso (Mi Banco)**: Cruce de existencias del inventario contra el árbol de recetas para identificar artículos fabricables inmediatamente o con mínima inversión.
- **Simulador de Machacado de Runas**: Estimación matemática de runas y coeficientes de rotura con aislamiento estricto por servidor.
- **Consumibles y Cacerías Legendarias (BYC)**: Modelado de rutas de obtención de pergaminos, consumo de sebuscalines y valoración comparativa de mapas de búsqueda.
- **Filtro Global de Oficios**: Restricción transversal de interfaces según los 20 oficios y niveles del usuario.
- **Captura Pasiva en Tiempo Real**: Recepción continua de precios de mercadillo, inventario unificado, histórico de ventas y listings colocados.
- **Sincronización Cloud Comunitaria**: Resiliencia tras mantenimientos semanales mediante sincronización de tokens de red en Turso LibSQL.

---

## Arquitectura del Proyecto

El repositorio contiene el código de producción del sitio web y los módulos de la suite de captura:

```
dbhdv/
├── api/                           # Endpoints serverless (Vercel)
│   ├── market/                    # Ingestión de precios, diccionarios y script del sniffer
│   ├── dofusbook/                 # Integración y análisis de builds
│   ├── dofocus.ts                 # Integración con coeficientes DoFocus
│   ├── health.ts                  # Monitor de salud del servicio
│   └── tokens.ts                  # Sincronización comunitaria de tokens
│
├── scripts/
│   └── syncSuiteContent.js        # Sincronizador de empaquetado del sniffer para la API
│
├── sniffer/                       # Suite unificada de captura (Python)
│   ├── dofus_suite.py             # Orquestador principal de captura y calibración
│   ├── core/                      # Configuración, decodificador Protobuf y base de datos
│   ├── sniffers/                  # Módulos de captura (mercadillo, almacén, ventas, listings)
│   ├── calibrator/                # Calibrador heurístico y sincronización cloud
│   ├── exporters/                 # Generadores de visualizadores HTML
│   └── ui/                        # Menú interactivo y terminal
│
├── src/                           # Aplicación web frontend y backend
│   ├── components/                # Componentes organizados por dominio
│   │   ├── byc/                   # Detalle, rentabilidad y exportación Excel de BYC
│   │   ├── crushing/              # Calculadora y catálogo de machacado de runas
│   │   ├── daily-planner/         # Planificador diario de producción y solver
│   │   ├── dofusbook/             # Importación y optimización de sets de Dofusbook
│   │   ├── jobs/optimizer/        # Optimizador de subida de niveles de oficio
│   │   ├── market-sniffer/        # Interfaz de conexión, control y bat del sniffer
│   │   ├── price-history/         # Modal y visualizador de histórico de precios
│   │   ├── price-manager/         # Gestión masiva de precios y cotizaciones
│   │   ├── profit-ranking/        # Ranking global de rentabilidad comercial
│   │   ├── recipes/               # Calculadora y desglose de recetas multinivel
│   │   ├── shopping-list/         # Planificador y consolidador de compras
│   │   ├── treasure-hunt/         # Calculadora de cacerías y cofres
│   │   ├── bank/                  # Cajón de inventario y filtros de banco
│   │   ├── common/                # Modales, alertas y componentes compartidos
│   │   └── layout/                # Shell de aplicación, cabecera y navegación
│   │
│   ├── data/                      # Datos del catálogo de Dofus (generados, config, schemas)
│   ├── hooks/                     # Hooks reactivos de estado, precios y sincronización
│   ├── server/                    # Servidor Express, middlewares, rutas y base de datos SQL
│   ├── services/                  # Servicios de aplicación y catálogo de DofusDB
│   └── utils/                     # Formateadores, logger y utilidades generales
│
├── index.html                     # Punto de entrada HTML (Vite)
├── server.ts                      # Servidor backend Node.js / Express
├── package.json                   # Dependencias y scripts de construcción
├── tsconfig.json                  # Configuración de compilación TypeScript
├── vite.config.ts                 # Configuración del bundler Vite
└── vercel.json                    # Configuración de despliegue serverless
```

---

## Endpoints de la API

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/api/health` | Estado del servidor y tiempo de actividad. |
| `GET` | `/api/tokens` | Consulta de tokens de red comunitarios validados. |
| `POST` | `/api/tokens` | Publicación de tokens tras calibración. |
| `GET` | `/api/market/suite-script` | Descarga de la suite unificada empaquetada (`dofus_suite.py`). |
| `GET` | `/api/market/download-bat` | Descarga del lanzador `.bat` unificado para Windows con elevación UAC. |
| `POST` | `/api/market/batch-update` | Ingestión masiva de cotizaciones de mercadillo enviadas por el sniffer. |
| `GET` | `/api/market/latest-prices` | Cotizaciones más recientes filtradas por servidor. |
| `GET` | `/api/local-db/bootstrap` | Carga inicial consolidada de catálogo, recetas, perfiles y precios. |
| `PUT` | `/api/local-db/prices` | Actualización de cotizaciones en el perfil activo. |
| `GET` | `/api/local-db/price-history` | Consulta del histórico cronológico de precios. |
| `GET` | `/api/local-db/coefficients` | Coeficientes de machacado registrados. |
| `POST` | `/api/dofusbook/analyze` | Análisis de costos y piezas de sets externos de Dofusbook. |
| `GET` | `/api/dofocus/servers` | Consulta de servidores disponibles en DoFocus. |
| `GET` | `/api/dofocus/coefficients/:server` | Coeficientes de rotura por servidor desde DoFocus. |

---

## Configuración y Variables de Entorno

Copiar la plantilla de configuración e ingresar los valores correspondientes si se requiere personalización:

```bash
cp .env.example .env
```

Parámetros configurables:

```env
# Servidor Express y Control de Acceso (Opcional)
APP_HOST=0.0.0.0
APP_BASIC_AUTH_USER=
APP_BASIC_AUTH_PASSWORD=
APP_BASIC_AUTH_REALM=Acceso Privado

# Token de seguridad para ingestión de sniffer (Opcional)
MARKET_SNIFFER_SECRET=

# Base de datos remota LibSQL / Turso (Opcional, por defecto usa SQLite local en local.db)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
DATABASE_URL=
DATABASE_AUTH_TOKEN=
```

---

## Instalación y Despliegue del Sitio Web

### Requisitos
- **Node.js**: $\ge$ 20.x
- **npm**: $\ge$ 10.x

### Comandos de Ejecución

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar en modo desarrollo**:
   ```bash
   npm run dev
   ```
   Disponible en `http://localhost:3000`.

3. **Compilar para producción**:
   ```bash
   npm run build
   ```

4. **Iniciar en modo producción**:
   ```bash
   npm run start
   ```

---

## Operación del Sniffer de Mercadillo

El sniffer se integra directamente con la plataforma web:

1. En la barra de navegación de la aplicación web, abrir la sección **Sniffer de Mercadillo**.
2. Seleccionar el servidor activo (por ejemplo, *Draconiros*).
3. Hacer clic en **Descargar .BAT (Suite Unificada 3.6)**.
4. Ejecutar el archivo `.bat` descargado (solicita permisos de Administrador para Npcap).
5. El lanzador descarga la versión actualizada de `dofus_suite.py` servida por `/api/market/suite-script`, sincroniza los tokens comunitarios desde `/api/tokens` y comienza la captura pasiva, transmitiendo automáticamente los precios consultados hacia la base de datos de la aplicación.
