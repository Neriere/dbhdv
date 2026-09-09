# Dofus Craft & Market Explorer (DofusDB HDV)

Plataforma web para análisis económico, optimización de crafteo, gestión de inventario y seguimiento de precios en tiempo real para Dofus y Dofus Unity.

---

## Resumen del Proyecto

Dofus Craft combina una interfaz en React 19 con un servidor Node.js/Express, funciones serverless para despliegues en Vercel y persistencia en SQLite (`local.db`) con soporte opcional para bases de datos remotas en Turso (LibSQL).

Capacidades principales:
1. Analizar la rentabilidad de recetas con desglose jerárquico de subcrafteos.
2. Identificar recetas fabricables a partir del inventario disponible en el banco (crafteo inverso).
3. Simular el machacado de equipamiento para la obtención de runas de forjamagia y consultar coeficientes de rotura.
4. Capturar precios de mercadillo en tiempo real mediante un sniffer de red pasivo para Dofus Unity.
5. Importar y cotizar builds completas de Dofusbook, comparando el costo de compra frente al costo de crafteo.
6. Consultar el historial de fluctuaciones de precios y gestionar perfiles independientes por servidor.

---

## Modulos y Funcionalidades

### 1. Calculadora de Recetas y Subcrafteo Multinivel
- Catalogo de recetas de todos los oficios (Forjador, Escultor, Sastre, Zapatero, Joyero, Alquimista, etc.).
- Modos de calculo del arbol de ingredientes:
  - Compra directa: Costo total comprando los ingredientes inmediatos en mercadillo.
  - Subcrafteo total: Desglose recursivo hasta materias primas basicas.
  - Modo optimo: Selecciona de forma automatica la opcion mas economica entre comprar o fabricar cada sub-ingrediente.
- Metricas de rentabilidad:
  - Costo de fabricacion frente a precio de venta estimado.
  - Margen neto en kamas y porcentaje de retorno de inversion (ROI).
  - Calculo automatico de la tasa de impuestos de venta en mercadillo.

### 2. Gestion de Inventario y Crafteo Inverso (Mi Banco)
- Carga rapida o pegado de listas de recursos disponibles en el banco o inventario del personaje.
- Cruce del inventario contra el catalogo de recetas para clasificar objetos en:
  - Completamente crafteables con recursos propios.
  - Fabricables comprando pocos ingredientes faltantes.
  - Oportunidades de alto ROI potencial.
- Filtros por oficio, nivel y categoria de objeto.

### 3. Simulador de Machacado de Runas y Coeficientes
- Estimacion de tipos y cantidades de runas obtenidas al machacar equipamiento (niveles 1 al 200).
- Calculos basados en formulas oficiales de peso de efectos (`dofusRuneWeights.ts`).
- Soporte para coeficientes de rotura personalizados y consulta de coeficientes de servidores mediante integracion con Dofocus.
- Comparacion entre el costo de fabricacion del objeto y el valor de venta proyectado de las runas resultantes.

### 4. Ranking Global de Rentabilidad
- Tabla clasificatoria de recetas ordenadas por margen comercial y ROI.
- Filtros configurables por rango de nivel, oficio, categoria de objeto, beneficio minimo en kamas y porcentaje de ROI.
- Acceso directo hacia la Calculadora de Recetas o hacia el Simulador de Machacado.

### 5. Calculadora de Sets de Dofusbook
- Importacion mediante enlace publico o identificador de build (incluyendo enlaces cortos `d-bk.net`).
- Deteccion automatica del equipamiento asignado a los slots principales.
- Comparacion de costos:
  - Costo total comprando las piezas directamente en mercadillo.
  - Costo total adquiriendo los materiales para craftear cada pieza.
  - Costo optimo combinado y calculo de ahorro estimado.
- Generacion de lista de compras consolidada con la suma total de materiales requeridos.

### 6. Busqueda de Tesoros y Mapas Legendarios
- Base de datos de fragmentos de mapas legendarios y cofres de busqueda de tesoros.
- Comparacion del valor de mercado de los fragmentos individuales frente al valor medio del botin y cofres obtenidos.

### 7. Planificador de Lista de Compras
- Agrupacion y suma de materiales requeridos para lotes de fabricacion de uno o multiples objetos.
- Clasificacion de ingredientes segun el mercadillo correspondiente (Recursos, Alquimistas, Mineros/Lenadores, Consumibles/Criadores).
- Calculo del presupuesto total estimado en kamas para completar las compras.

### 8. Gestor de Precios de Mercadillo e Historial
- Perfiles de precios por servidor de juego:
  - Monocuenta: Draconiros, Kourial, Mikhal, Dakal.
  - Multicuenta: Brial, Rafal, Salar, Tal Kasha, Hell Mina, Imagiro, Orukam, Tylezia.
  - Servidor Epico: Shadow.
- Registro historico de modificaciones de precios con fecha, valor previo, diferencia neta, porcentaje de variacion y fuente (manual o sniffer).
- Herramientas de exportacion e importacion de precios en formato JSON.

### 9. Sniffer de Mercadillo para Dofus Unity
- Script en Python (`scripts/sniffer_standalone.py`) que analiza pasivamente paquetes TCP en el puerto 5555 del juego utilizando `scapy`.
- Operacion directa sin intermediarios ni almacenamiento de credenciales.
- Resolucion ultrarrapida de nombres de objetos mediante el diccionario indexado local (`/api/market/items-dictionary`).
- Descarga automatizada del script preconfigurado y del lanzador por lotes (`ejecutar_sniffer.bat`) para Windows.
- Envio asincrono por lotes mediante `/api/market/batch-update` o `/api/market/update`.

### 10. Integracion con DofusDB y Dofocus
- Sincronizacion directa con la API publica de DofusDB (`https://api.dofusdb.fr`) para items, recetas y tipos de objetos.
- Exclusion automatica de objetos cosmeticos, apariencias y elementos sin utilidad economica.
- Consulta de coeficientes por servidor mediante endpoints de Dofocus.

---

## Temas de Interfaz

La aplicacion dispone de cuatro esquemas de color:
- Bonta: Tonos azul pizarra y blanco frio.
- Brakmar: Tonos grafito oscuro y acentos carmesi.
- Pandala: Tonos verde esmeralda y jade.
- Calm: Paleta neutra de contraste suave con iluminacion calida.

---

## Arquitectura Tecnica

```
├── client (Frontend)
│   ├── React 19 + TypeScript + Vite 6
│   ├── Tailwind CSS v4
│   ├── TanStack Virtual (renderizado virtual para volumenes amplios de datos)
│   └── Lucide Icons
│
├── server (Backend Express / Local)
│   ├── server.ts (Punto de entrada con middleware Vite en desarrollo y estaticos en produccion)
│   ├── src/server/expressApp.ts (Rutas de la API, ingestion por lotes y sincronizacion)
│   └── src/server/localDataStore.ts (Capa de datos y logica de negocio en SQLite)
│
├── api (Serverless Functions para despliegues en Vercel)
│   ├── api/dofusbook/analyze.ts (Analisis de builds y recetas de Dofusbook)
│   ├── api/dofocus/* (Servidores y coeficientes de rotura)
│   ├── api/market/* (Actualizacion y consulta de precios de mercadillo)
│   └── api/local-db/coefficients/bulk.ts (Actualizacion masiva de coeficientes)
│
└── database (Persistencia)
    ├── local.db (Base de datos SQLite local predeterminada)
    └── Turso / LibSQL (Persistencia remota opcional mediante variable TURSO_DATABASE_URL)
```

---

## Endpoints de la API

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/api/health` | Verificacion de estado del servidor. |
| `GET` | `/api/local-db/bootstrap` | Carga inicial consolidada (items, recetas, precios, perfiles y ajustes). |
| `GET` | `/api/local-db/meta` | Resumen de registros almacenados en la base de datos. |
| `GET` | `/api/local-db/items/:id` | Consulta de un objeto por ID con fallback a DofusDB. |
| `GET` | `/api/local-db/recipes/:resultId` | Consulta de receta por ID del objeto resultante. |
| `PUT` | `/api/local-db/prices/:itemId` | Actualizacion del precio de un objeto en el perfil activo. |
| `PUT` | `/api/local-db/prices` | Actualizacion masiva de precios en el perfil activo. |
| `GET` | `/api/local-db/price-history` | Consulta paginada del historial de precios. |
| `GET` | `/api/local-db/coefficients` | Obtencion de coeficientes de machacado guardados. |
| `POST` | `/api/local-db/coefficients/bulk` | Guardado en lote de coeficientes de machacado. |
| `POST` | `/api/market/update` | Ingestion individual de precios enviada por el sniffer. |
| `POST` | `/api/market/batch-update` | Ingestion por lotes de precios enviada por el sniffer. |
| `GET` | `/api/market/latest-prices` | Precios mas recientes registrados. |
| `GET` | `/api/market/items-dictionary` | Diccionario indexado ID -> Nombre para el sniffer. |
| `GET` | `/api/market/download-items-db` | Descarga de `items_db.json`. |
| `GET` | `/api/market/sniffer-script` | Generacion del script `dofus_sniffer.py` configurado con el host actual. |
| `GET` | `/api/market/download-bat` | Descarga del archivo `ejecutar_sniffer.bat` para Windows. |
| `POST` | `/api/dofusbook/analyze` | Analisis de equipamiento, costos y crafteo de un set de Dofusbook. |
| `GET` | `/api/dofocus/servers` | Listado de servidores disponibles en Dofocus. |
| `GET` | `/api/dofocus/coefficients/:serverName` | Coeficientes de machacado por servidor desde Dofocus. |
| `GET` | `/api/dofocus/item/:itemId` | Coeficiente de rotura de un objeto especifico desde Dofocus. |

---

## Variables de Entorno

Definidas en el archivo `.env.example`:

```env
# Configuracion del Servidor y Autenticacion Basica (Opcionales)
APP_HOST=0.0.0.0
APP_BASIC_AUTH_USER=
APP_BASIC_AUTH_PASSWORD=
APP_BASIC_AUTH_REALM=Acceso Privado DofusDB

# Sniffer de Mercadillo (Opcional)
MARKET_SNIFFER_SECRET=

# Base de Datos Turso / LibSQL (Opcional - si no se define, se utiliza local.db)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

---

## Instalacion y Ejecucion

### Requisitos previos
- Node.js version 20 o superior
- npm version 10 o superior
- Python version 3.9 o superior (exclusivamente para la ejecucion local del sniffer)

### Pasos de instalacion

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno (opcional):
   ```bash
   cp .env.example .env
   ```

3. Iniciar el entorno de desarrollo:
   ```bash
   npm run dev
   ```
   El servicio queda accesible en `http://localhost:3000`.

4. Compilar e iniciar en modo produccion:
   ```bash
   npm run build
   npm run start
   ```

---

## Uso del Sniffer de Mercadillo

1. En la aplicacion web, abrir la opcion de Sniffer de Mercadillo en la barra superior.
2. Seleccionar el servidor de juego activo.
3. Descargar el archivo `ejecutar_sniffer.bat` o utilizar el comando de terminal correspondiente.
4. Ejecutar el archivo con permisos de administrador en el mismo equipo donde se ejecuta el cliente de Dofus Unity.
5. Al consultar cualquier mercadillo dentro del juego, los precios se capturaran y sincronizaran automaticamente con la base de datos.
