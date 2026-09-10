# Dofus Craft & Market Explorer (DofusDB HDV)

Plataforma web para análisis económico, optimización de crafteo, gestión de inventario y seguimiento de precios en tiempo real para Dofus y Dofus Unity.

---

## Resumen del Proyecto

Dofus Craft combina una interfaz en React 19 con un servidor Node.js/Express, funciones serverless para despliegues en Vercel y persistencia en SQLite (`local.db`) con soporte opcional para bases de datos remotas en Turso (LibSQL).

Capacidades principales:
1. Analizar la rentabilidad de recetas con desglose jerarquico de subcrafteos.
2. Identificar recetas fabricables a partir del inventario disponible en el banco (crafteo inverso).
3. Simular el machacado de equipamiento para la obtencion de runas de forjamagia y consultar coeficientes de rotura.
4. Analizar la rentabilidad de consumibles de caracteristicas de protectores y canje de sebuscalines por pergaminos.
5. Evaluar cacerias legendarias (BYC) y la decision comercial entre vender el recurso crudo o fabricar equipables.
6. Filtrar globalmente todas las secciones segun los niveles reales de oficio del usuario ("Mis Oficios").
7. Capturar precios de mercadillo en tiempo real mediante un sniffer de red pasivo para Dofus Unity.
8. Importar y cotizar builds completas de Dofusbook, comparando el costo de compra frente al costo de crafteo.
9. Consultar el historial de fluctuaciones, velocidad de rotacion (24h/7d/30d) y gestionar perfiles independientes por servidor.

---

## Modulos y Funcionalidades

### 1. Calculadora de Recetas y Subcrafteo Multinivel
- Catalogo de recetas de todos los oficios (Forjador, Escultor, Sastre, Zapatero, Joyero, Alquimista, etc.).
- Exclusion automatica de los 97 objetos de clase y sus 20 panoplias para evitar items sin demanda comercial ni generacion de runas.
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
- Filtros por oficio, nivel, categoria de objeto y restriccion opcional segun los oficios del usuario.

### 3. Simulador de Machacado de Runas y Coeficientes
- Estimacion de tipos y cantidades de runas obtenidas al machacar equipamiento (niveles 1 al 200).
- Calculos basados en formulas oficiales de peso de efectos (`dofusRuneWeights.ts`).
- Soporte para coeficientes de rotura personalizados con aislamiento estricto por servidor (Draconiros, Talok, etc.).
- Comparacion entre el costo de fabricacion del objeto y el valor de venta proyectado de las runas resultantes.

### 4. Ranking Global de Rentabilidad
- Tabla clasificatoria de recetas ordenadas por margen comercial y ROI.
- Filtros configurables por rango de nivel, oficio, categoria de objeto, beneficio minimo en kamas y porcentaje de ROI.
- Acceso directo hacia la Calculadora de Recetas o hacia el Simulador de Machacado.
- Compatibilidad directa con el filtro de oficios personales.

### 5. Consumibles de Caracteristicas y Pergaminos
- Modulo especializado para consumibles permanentes de recoleccion (Cazador, Pescador, Campesino, Alquimista) derivados de protectores de recursos.
- Analisis comparativo de vias de progresion (0 a 100 de estadistica): coste de subir con consumibles frente al uso exclusivo de pergaminos.
- Comparador de rentabilidad de pergaminos frente al valor de referencia seguro (Turmalina a 200 sebuscalines).
- Metricas de rotacion en 24h, 7d y ratio de kamas generadas por cada sebuscalin invertido.
- Simulador de canje optimo con asignacion automatica de unidades segun el saldo de sebuscalines disponible.

### 6. Cacerias Legendarias y Mapas de Se Busca (BYC)
- Base de datos completa de las 45 cacerias legendarias de Se Busca con precios aislados por servidor.
- Decision comercial automatizada: vender el recurso crudo del jefe en mercadillo frente a fabricar el equipable asociado.
- Evaluacion de las 3 vias de adquisicion de cada equipable:
  - Via 1: Compra de fragmentos, realizacion de la caceria y craft del objeto.
  - Via 2: Compra directa del mapa completo en mercadillo, caceria y craft.
  - Via 3: Compra directa del recurso del jefe en mercadillo y craft.
- Exportador a libros de Excel con 4 hojas analiticas y formulas nativas.

### 7. Filtro Global de Niveles de Oficio (Mis Oficios)
- Configuracion y persistencia 100% local en el navegador (`localStorage`) para los 20 oficios del juego:
  - Recoleccion: Alquimista, Campesino, Cazador, Lenador, Minero, Pescador.
  - Crafteo: Joyero, Sastre, Zapatero, Herrero, Escultor, Fabricante, Manitas, Pescadero/Panadero.
  - Forjamagia: Joyeromago, Sastremago, Zapateromago, Forjamago de armas, Escultormago, Forjamago de escudos.
- Interruptor maestro para activar o desactivar el filtrado global con un solo clic.
- Integracion en cascada: Recetas, Rompedora (requiere crafteo o forjamagia), Ranking de Rentabilidad, Mi Banco, Consumibles y Cacerias BYC.

### 8. Calculadora de Sets de Dofusbook
- Importacion mediante enlace publico o identificador de build (incluyendo enlaces cortos `d-bk.net`).
- Deteccion automatica del equipamiento asignado a los slots principales.
- Comparacion de costos entre compra directa y fabricacion artesanal con calculo de ahorro estimado.
- Generacion de lista de compras consolidada.

### 9. Planificador de Lista de Compras
- Agrupacion y suma de materiales requeridos para lotes de fabricacion de uno o multiples objetos.
- Clasificacion de ingredientes segun el mercadillo correspondiente.
- Calculo del presupuesto total estimado en kamas para completar las compras.

### 10. Gestor de Precios de Mercadillo e Historial
- Perfiles de precios independientes por servidor de juego con reactividad inmediata y aislamiento estricto.
- Scope pre-filtro: visualizacion diferenciada de solo recursos puros sin receta, solo crafteables o catalogo completo.
- Panel de metricas de demanda: volumen de ventas en 24h, 7d, 30d y promedio diario estimado.
- Ordenacion avanzada por velocidad de rotacion y volumen de ventas.
- Historial de variaciones de cotizaciones y herramientas de respaldo JSON.

### 11. Sniffer de Mercadillo para Dofus Unity
- Script en Python (`scripts/sniffer_standalone.py`) que analiza pasivamente paquetes TCP en el puerto 5555 del juego utilizando `scapy`.
- Operacion directa sin intermediarios ni almacenamiento de credenciales.
- Resolucion de nombres de objetos mediante diccionario indexado local (`/api/market/items-dictionary`).
- Descarga automatizada de paquetes preconfigurados para Windows.

### 12. Integracion con DofusDB y Dofocus
- Sincronizacion directa con la API publica de DofusDB (`https://api.dofusdb.fr`) para items, recetas y tipos de objetos.
- Exclusion de objetos cosmeticos, apariencias y objetos de clase.
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
