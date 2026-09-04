# Dofus Craft & Market Explorer (DofusDB HDV)

Plataforma web de alto rendimiento para análisis económico, optimización de crafteo, gestión inteligente de inventario y seguimiento de precios en tiempo real para **Dofus** y **Dofus Unity**.

---

## 📋 Resumen del Proyecto

**Dofus Craft** combina una interfaz interactiva en React 19 con un servidor Node.js/Express y una base de datos local SQLite (`local.db`), con soporte opcional para sincronización remota mediante Turso (LibSQL).

El sistema permite a los jugadores y artesanos:
1. **Analizar la rentabilidad de crafteos** con árboles jerárquicos de sub-recetas.
2. **Transformar recursos ociosos en kamas** analizando el inventario del banco (crafteo inverso).
3. **Simular el machacado de runas** con pesos oficiales y coeficientes de rotura de equipo.
4. **Capturar precios de mercadillo en vivo** mediante un sniffer de red para Dofus Unity **sin necesidad de contraseñas ni tokens**.
5. **Calcular sets completos de Dofusbook** y generar listas de compras consolidadas por mercadillo.
6. **Consultar el histórico de fluctuaciones de precios** y mantener perfiles por servidor de juego.

---

## 🚀 Módulos y Funcionalidades Principales

### 1. 🔨 Calculadora de Recetas y Subcrafteo Multinivel
- **Explorador de Recetas**: Catálogo completo de recetas de todos los oficios (Forjador, Escultor, Sastre, Zapatero, Joyero, Alquimista, etc.).
- **Árbol de Desglose Recursivo**: Permite alternar entre:
  - *Compra directa*: Costo asumiendo la compra de ingredientes inmediatos.
  - *Subcrafteo total*: Desglose recursivo hasta materias primas básicas.
  - *Modo inteligente / óptimo*: Selección automática de la vía más barata (comprar vs fabricar) para cada rama intermedia.
- **Métricas Financieras en Vivo**:
  - Costo de fabricación vs Precio de venta en mercadillo.
  - Beneficio neto en Kamas y Retorno de Inversión (ROI %).
  - Tasa de impuestos de mercadillo calculada automáticamente.

### 2. 🏦 "Mi Banco" y Crafteo Inverso (BankCraftingView)
- **Gestor de Inventario**: Carga o pegado rápido de recursos disponibles en el banco o bolsas del personaje.
- **Motor de Crafteo Inverso**:
  - Analiza todo el catálogo de recetas contra tu inventario actual.
  - Clasifica objetos en: *100% fabricables con tus recursos*, *fabricables comprando pocos ingredientes faltantes*, o *de alto ROI potencial*.
  - Desglose del costo residual necesario para completar recetas y el valor final de venta proyectado.
- **Filtros por Oficio y Nivel**: Localiza rápidamente qué ítems de tu nivel puedes crear para subir de nivel tus oficios mientras generas kamas.

### 3. 💥 Simulador de Machacado de Runas (Rompedora & Coeficientes)
- **Cálculo de Runas por Machacado**: Estimación de la cantidad y tipos de runas obtenidas al romper equipamiento (niveles 1 al 200).
- **Fórmulas Oficiales de Peso**: Basado en la tabla ponderada de efectos y pesos de runas de Dofus (`dofusRuneWeights.ts`).
- **Coeficientes de Rotura**: Soporte para simular diferentes porcentajes de rotura de servidor (50% a 4000%).
- **Evaluación de Margen de Machacado**: Compara el costo de fabricación del objeto frente al valor estimado de venta de las runas resultantes.

### 4. 📈 Ranking Global de Rentabilidad (ROI & Profit)
- **Tabla Clasificatoria en Tiempo Real**: Escanea todas las recetas registradas y las ordena según margen comercial.
- **Filtros Avanzados**:
  - Rango de niveles (ej. 150 - 200).
  - Filtrado por oficio específico o categoría de equipo.
  - Filtro por beneficio mínimo en kamas o ROI mínimo deseado.
- **Acceso Directo**: Envío con un clic hacia la Calculadora de Recetas o hacia el Simulador de Machacado.

### 5. 📜 Calculadora de Sets de Dofusbook
- **Importador de Builds**: Pega la URL o identificador de una build pública de Dofusbook.
- **Presupuesto Consolidado**: Extrae todo el equipamiento del set (sombrero, capa, amuleto, anillos, cinturón, botas, escudo, arma y trofeos/dofus).
- **Cálculo Dual**: Compara el costo total de comprar todo el equipo ya fabricado en mercadillo vs el costo total de conseguir los materiales y craftearlo.
- **Exportación a Lista de Compras**: Envía todos los ingredientes unificados a la lista de compras con un solo clic.

### 6. 🗺️ Búsqueda del Tesoro y Mapas Legendarios
- **Calculadora de Mapas**: Base de datos de fragmentos de mapas legendarios (Briss, Pecho, etc.) y cofres de búsqueda de tesoros.
- **Análisis de Oportunidad**: Compara el valor de mercado de los fragmentos individuales frente al valor medio del botín y los cofres generados.

### 7. 🛒 Planificador de Lista de Compras (Shopping List)
- **Consolidación de Materiales**: Agrupa ingredientes requeridos para tandas de crafteo de uno o múltiples ítems simultáneamente.
- **Organización por Mercadillo**:
  - Mercadillo de Recursos.
  - Mercadillo de Alquimistas.
  - Mercadillo de Mineros / Leñadores.
  - Mercadillo de Criadores / Consumibles.
- **Presupuesto Estimado**: Total de kamas requeridas para surtir la lista completa antes de comenzar las sesiones de forjamagia o fabricación.

### 8. 💰 Gestor de Precios de Mercadillo e Historial
- **Perfiles por Servidor de Dofus Unity**:
  - Monocuenta Clásico: *Draconiros*.
  - Monocuenta Pionero: *Kourial*, *Mikhal*, *Dakal*.
  - Multicuenta Pionero: *Brial*, *Rafal*, *Salar*.
  - Multicuenta Clásico: *Tal Kasha*, *Hell Mina*, *Imagiro*, *Orukam*, *Tylezia*.
  - Servidor Épico: *Shadow*.
- **Historial de Precios Detallado**: Seguimiento de cada cambio de precio con fecha, precio anterior, diferencia en kamas, porcentaje de variación y origen (manual o sniffer).
- **Copias de Seguridad**: Exportación e importación integral de precios en formato JSON.

### 9. 📡 Sniffer de Mercadillo en Vivo (Dofus Unity Sniffer)
- **Captura Pasiva sin Riesgo**: Script standalone en Python (`scripts/sniffer_standalone.py`) que escucha paquetes TCP en el puerto 5555 del juego utilizando `scapy`.
- **Sin Contraseñas ni Tokens**: **El sniffer NO requiere clave, contraseña ni token en este momento**. Funciona en modo abierto y directo tanto en local como en remoto.
- **Diccionario Local Ultrarrápido**: Cuenta con `/api/market/items-dictionary` (`items_db.json`), lo que permite al script de Python resolver nombres de objetos localmente en 0.001 ms sin saturar los servidores de DofusDB.
- **Descarga con Un Clic**: El modal incluye la descarga directa de `ejecutar_sniffer.bat` para Windows, el cual solicita permisos de administrador, verifica Python y las dependencias (`scapy`, `requests`) e inicia la sincronización inmediata.
- **Micro-Batching HTTP**: Envío por lotes asíncronos mediante Keep-Alive hacia `/api/market/batch-update` o `/api/market/update`.

### 10. 🔄 Sincronizador con DofusDB
- Conexión e importación masiva directamente desde la API oficial de DofusDB (`https://api.dofusdb.fr`).
- Filtrado automático de ítems cosméticos, apariencias y objetos sin utilidad económica.
- Normalización automática de traducciones en español.

---

## 🎨 Temas Visuales (Lore de Dofus)

La aplicación incluye cuatro temas de interfaz optimizados para reducir la fatiga visual:
- **Bonta**: Estética Ice Slate (azul pizarra y blanco invernal).
- **Brâkmar**: Estética Obsidian & Crimson (rojo volcánico y grafito oscuro).
- **Pandala**: Estética Bamboo Emerald (verde esmeralda suave y tonos jade).
- **Calm**: Estética ámbar neutra con luz cálida de bajo contraste.

---

## 🛠️ Arquitectura Técnica

```
├── client (Frontend)
│   ├── React 19 + TypeScript + Vite 6
│   ├── Tailwind CSS v4 (con temas Bonta, Brakmar, Pandala, Calm)
│   ├── TanStack Virtual (listas virtuales para miles de ítems)
│   └── Lucide Icons
│
├── server (Backend Express)
│   ├── server.ts (Entry point con Vite middleware en dev y static en prod)
│   ├── src/server/expressApp.ts (Rutas API, health check y batching)
│   └── src/server/localDataStore.ts (Capa de persistencia con SQLite / Turso)
│
└── database (Persistencia)
    ├── local.db (Base de datos SQLite local por defecto)
    └── Turso / LibSQL (Soporte opcional para base remota vía TURSO_DATABASE_URL)
```

---

## 🔌 Endpoints de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servidor y confirmación de servicio activo. |
| `GET` | `/api/local-db/bootstrap` | Carga inicial optimizada (ítems, recetas, precios, perfiles y settings). |
| `GET` | `/api/local-db/meta` | Resumen estadístico de la base de datos (total de ítems, recetas, precios). |
| `GET` | `/api/local-db/item/:id` | Obtiene un ítem por ID o lo consulta dinámicamente en DofusDB. |
| `GET` | `/api/local-db/recipe/:id` | Obtiene la receta de un ítem por ID de resultado. |
| `POST` | `/api/local-db/prices` | Actualización manual de precios de mercadillo. |
| `POST` | `/api/market/update` | Ingestión individual de precios enviada por el sniffer (**sin token requerido**). |
| `POST` | `/api/market/batch-update` | Ingestión masiva por lotes enviada por el sniffer (**sin token requerido**). |
| `GET` | `/api/market/items-dictionary` | Diccionario indexado ID -> Nombre para resolución ultrarrápida en el sniffer. |
| `GET` | `/api/market/download-items-db` | Descarga de `items_db.json` para el script de Python. |
| `GET` | `/api/market/sniffer-script` | Genera y descarga el script `dofus_sniffer.py` preconfigurado con el host actual. |
| `GET` | `/api/market/download-bat` | Descarga el archivo `ejecutar_sniffer.bat` para Windows. |
| `GET` | `/api/local-db/price-history` | Consulta paginada del historial de fluctuaciones de precios. |

---

## ⚙️ Configuración y Variables de Entorno

El archivo `.env.example` incluye las opciones configurables del sistema:

```env
# Configuración del Servidor y Autenticación Básica (Opcionales)
APP_HOST=0.0.0.0
APP_BASIC_AUTH_USER=
APP_BASIC_AUTH_PASSWORD=
APP_BASIC_AUTH_REALM=Acceso Privado DofusDB

# Sniffer de Mercadillo (Opcional - por defecto NO se requiere clave ni token)
MARKET_SNIFFER_SECRET=

# Base de Datos en la Nube Turso / LibSQL (Opcional - si se omite, usa local.db en SQLite)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

> **Nota sobre el Market Sniffer**: De momento **no se requiere ninguna contraseña, token ni clave secreta** para sincronizar precios con el sniffer. El script de Python envía los paquetes directamente al endpoint `/api/market/batch-update`.

---

## 💻 Instalación y Ejecución

### Requisitos
- **Node.js**: v22 o superior
- **npm**: v10 o superior
- **Python**: v3.9+ (solo si deseas ejecutar el sniffer de red localmente)

### Pasos de Instalación

1. **Clonar e instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configuración de entorno (opcional)**:
   ```bash
   cp .env.example .env
   ```

3. **Iniciar en modo desarrollo**:
   ```bash
   npm run dev
   ```
   El servidor iniciará en `http://localhost:3000` con recarga y Vite integrado.

4. **Compilar para producción**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🛡️ Uso del Sniffer de Mercadillo

1. En la aplicación web, abre el modal **Sniffer de Mercadillo** desde la barra superior.
2. Selecciona tu servidor de juego (por ejemplo, *Draconiros*).
3. Haz clic en **Descargar ejecutar_sniffer.bat** o copia el comando de terminal.
4. Ejecuta el archivo como Administrador en tu PC mientras juegas Dofus Unity.
5. Al abrir cualquier mercadillo en el juego, los precios se capturarán e inyectarán automáticamente en tu base de datos en tiempo real.
