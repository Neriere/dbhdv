# Auditoría y Análisis Arquitectónico Integral del Proyecto DofusDB HDV

> **Propósito del Documento:**  
> Este informe constituye un desglose técnico, analítico y funcional exhaustivo de todas las secciones, módulos y procedimientos que integran la plataforma **Dofus Craft & Market Explorer (DofusDB HDV)**.  
> Su meta fundamental es servir de **guía maestra de referencia y auditoría continua** para contrastar la implementación real del código frente a los objetivos económicos y funcionales del proyecto, facilitando la detección temprana de:
> 1. **Incoherencias funcionales:** Desajustes lógicos respecto a las reglas y mecánicas de Dofus / Dofus Unity (impuestos, fórmulas de runas, árboles de crafteo, experiencia de oficios).
> 2. **Errores visuales o de UX:** Estados desincronizados, badges confusos, redondeos engañosos, desbordamientos o inputs no reactivos.
> 3. **Fallas en funciones y procedimientos:** Pérdida de precisión matemática, colisiones de IDs, condiciones de carrera en caché/eventos, errores de persistencia en `localStorage` o base de datos.
> 4. **Ineficiencias y cuellos de botella:** Cálculos O(N) o recursivos no memorizados, renders masivos sin virtualización, tráfico de red redundante o llamadas no balanceadas.

---

## Índice General

1. [Visión General de la Arquitectura y Flujo de Datos](#1-visión-general-de-la-arquitectura-y-flujo-de-datos)
2. [Sección 1: Calculadora de Recetas y Subcrafteo Multinivel (`RecipeCraftingCalculator`)](#sección-1-calculadora-de-recetas-y-subcrafteo-multinivel)
3. [Sección 2: Gestión de Inventario y Crafteo Inverso - Mi Banco (`BankCraftingView`)](#sección-2-gestión-de-inventario-y-crafteo-inverso---mi-banco)
4. [Sección 3: Simulador de Machacado de Runas y Coeficientes - Rompedora (`CrushingCalculator`)](#sección-3-simulador-de-machacado-de-runas-y-coeficientes---rompedora)
5. [Sección 4: Optimizador de Subida de Oficios (`JobLevelingOptimizer`)](#sección-4-optimizador-de-subida-de-oficios)
6. [Sección 5: Planificador Diario de Crafteo (`DailyCraftPlanner`)](#sección-5-planificador-diario-de-crafteo)
7. [Sección 6: Ranking Global de Rentabilidad (`GlobalProfitRanking`)](#sección-6-ranking-global-de-rentabilidad)
8. [Sección 7: Planificador de Lista de Compras (`ShoppingListPlanner`)](#sección-7-planificador-de-lista-de-compras)
9. [Sección 8: Mapas de Se Busca y Cacerías Legendarias - BYC (`TreasureHuntCalculator` & `BycDetailPage`)](#sección-8-mapas-de-se-busca-y-cacerías-legendarias---byc)
10. [Sección 9: Consumibles de Características y Pergaminos (`ConsumablesCharacteristicView`)](#sección-9-consumibles-de-características-y-pergaminos)
11. [Sección 10: Calculadora de Sets Dofusbook (`DofusbookSetCalculator`)](#sección-10-calculadora-de-sets-dofusbook)
12. [Sección 11: Gestor de Precios de Mercadillo e Historial (`PriceManager`)](#sección-11-gestor-de-precios-de-mercadillo-e-historial)
13. [Sección 12: Base de Datos y Catálogo Maestro (`DofusImporter`)](#sección-12-base-de-datos-y-catálogo-maestro)
14. [Sección 13: Módulos Transversales y Núcleo del Sistema](#sección-13-módulos-transversales-y-núcleo-del-sistema)
    - [13.1. Filtro Global "Mis Oficios"](#131-filtro-global-mis-oficios)
    - [13.2. Sniffer Pasivo de Red para Dofus Unity](#132-sniffer-pasivo-de-red-para-dofus-unity)
    - [13.3. Aislamiento por Servidor y Perfiles de Precios](#133-aislamiento-por-servidor-y-perfiles-de-precios)
    - [13.4. Sincronización Automática con Dofocus](#134-sincronización-automática-con-dofocus)
    - [13.5. Sistema de Respaldo y Restauración JSON](#135-sistema-de-respaldo-y-restauración-json)
    - [13.6. Persistencia y Arquitectura Backend (Express / LibSQL / Turso)](#136-persistencia-y-arquitectura-backend-express--libsql--turso)
    - [13.7. Motor de Temas Visuales y CSS](#137-motor-de-temas-visuales-y-css)
15. [Matriz Maestra de Incoherencias Potenciales y Puntos Críticos](#15-matriz-maestra-de-incoherencias-potenciales-y-puntos-críticos)
16. [Recomendaciones para Mantenimiento y Pruebas Futuras](#16-recomendaciones-para-mantenimiento-y-pruebas-futuras)

---

## 1. Visión General de la Arquitectura y Flujo de Datos

El sistema está diseñado como una aplicación híbrida SPA (React 19 + TypeScript + Vite) respaldada por un servidor Node.js/Express (`server.ts` / `src/server/expressApp.ts`) con una capa de persistencia dual:
- **Base de Datos Relacional:** SQLite local en modo WAL (`local.db`) mediante `@libsql/client`, con capacidad de conmutar automáticamente a bases remotas en Turso (LibSQL) mediante variables de entorno (`TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`).
- **Almacenamiento Local en Navegador:** `localStorage` se utiliza para estados inmediatos, preferencias de usuario, caché offline, inventario del banco y la configuración de "Mis Oficios".
- **Bus de Eventos del Cliente (`window.dispatchEvent`):** La comunicación y reactividad entre vistas desacopladas se logra a través de `CustomEvent` de navegador (`dofus_prices_updated`, `dofus_database_updated`, `dofus_shopping_list_updated`, `dofus_bank_inventory_updated`, `dofus_sales_volume_updated`, `dofus_profile_changed`, `dofus_user_jobs_updated`, `dofus_theme_updated`).
- **Sniffer Pasivo TCP (Python + Scapy):** Captura en tiempo real paquetes TCP del puerto 5555 de Dofus Unity, decodifica payloads Protobuf y envía micro-lotes al backend (`/api/market/batch-update`) aplicando salvaguardas anti-troll y filtros de valores atípicos.

```
┌─────────────────────────────────────────────────────────────┐
│                    Dofus Unity Client                       │
│             (Tráfico TCP Puerto 5555 Mercadillo)            │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Captura pasiva Scapy)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Python Sniffer Standalone                    │
│   (items_db.json / Protobuf Decoder / Anti-Troll Filter)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP POST /api/market/batch-update
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend Express / Serverless API               │
│   (localDataStore.ts / LibSQL Client / Turso / SQLite)      │
│   • profile_prices        • price_history                   │
│   • profile_coefficients  • profile_sales_volume            │
│   • items & recipes       • dofocusBackgroundSync           │
└──────────────────────────────┬──────────────────────────────┘
                               │ SSE / Bootstrap JSON / Polling
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Frontend React 19 (SPA)                     │
│  Bus de Eventos Global (dofus_prices_updated / CustomEvent) │
│  ┌───────────────────────┬───────────────────────────────┐  │
│  │ 1. Recetas y Árbol    │ 7. Planificador de Compras    │  │
│  │ 2. Crafteo Inverso    │ 8. Mapas & ByC (Cacerías)     │  │
│  │ 3. Rompedora / Runas  │ 9. Pergaminos y Consumibles   │  │
│  │ 4. Subir Oficios      │ 10. Dofusbook Sets            │  │
│  │ 5. Plan Diario Crafteo│ 11. Gestor de Precios         │  │
│  │ 6. Ranking Rentabil.  │ 12. Base / Sincronizador      │  │
│  └───────────────────────┴───────────────────────────────┘  │
│  Filtros Transversales: Mis Oficios · Servidor · Temas      │
└─────────────────────────────────────────────────────────────┘
```

---

## Sección 1: Calculadora de Recetas y Subcrafteo Multinivel

### 1.1. Propósito y Alcance Funcional
Proporcionar un análisis económico exhaustivo de cualquier receta del juego (equipamiento, consumibles, trofeos, llaves, esencias, etc.), calculando el coste de fabricación bajo múltiples estrategias de adquisición y contrastándolo contra el precio de venta en mercadillo (HDV) para determinar el margen neto, el retorno de inversión (ROI) y la viabilidad comercial.

### 1.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/RecipeCraftingCalculator.tsx`
- **Filtros de Catálogo:** `src/components/recipes/RecipeCatalogFilters.tsx`
- **Tarjeta de Resumen y Rentabilidad:** `src/components/recipes/RecipeSummaryCard.tsx`
- **Fila Jerárquica del Árbol de Ingredientes:** `src/components/recipes/RecipeTreeNodeRow.tsx`
- **Modal de Cotización Rápida:** `src/components/recipes/QuickQuoteModal.tsx`
- **Servicios:** `src/services/dofusDbService.ts` (`buildRecipeTree`, `calculateTreeCraftCost`, `clearRecipeTreeCache`), `src/services/bycCostService.ts` (`isBycResource`, `getOptimizedIngredientCost`), `src/services/salesVolumeService.ts`.

### 1.3. Interfaz de Usuario y Controles
- **Navegación Dual:** Vista Catálogo (tarjetas con paginación de 24 ítems) y Vista Detalle (árbol jerárquico expandible con nodo raíz y hojas de subingredientes).
- **Filtros Avanzados:**
  - Oficio específico o todos los oficios.
  - Rango de nivel (1 a 200).
  - Búsqueda por texto con coincidencia difusa (ignora tildes, mayúsculas y caracteres especiales).
  - Selector de cotización: `Todos`, `Solo cotizados` (precio > 0), `Sin cotizar` (precio = 0).
  - Interruptor "Solo rentables" (margen neto > 0) y filtro de ganancia mínima en kamas.
  - Umbrales de rotación: ventas mínimas diarias (`minDailySales`), "Solo con datos de venta" y "Solo ingredientes 100% cotizados".
  - Filtro de ROI mínimo (%) y Coste de fabricación máximo (kamas).
  - Ordenación: Flujo diario esperado (`expectedDailyFlow`), Margen neto descendente, ROI descendente, Costo ascendente, Nivel descendente y Ventas en 24h.
- **Acciones Rápidas en Vista Detalle:**
  - Edición en línea del precio de venta proyectado.
  - Selector de método para recursos BYC (Compra directa, Fragmentos, Mapa).
  - Botón de cotización rápida (`QuickQuoteModal`).
  - Botón para enviar a la Rompedora (`onSelectForCrushing`).
  - Desplegar / Colapsar todos los nodos del árbol.
  - Sincronización manual en vivo con el servidor.

### 1.4. Lógica de Negocio, Algoritmos y Procedimientos
1. **Construcción Recursiva del Árbol (`buildRecipeTree`):**  
   Desciende hasta una profundidad máxima de 5 niveles para evitar ciclos infinitos en recetas circulares o dependencias recursivas.
2. **Estrategias de Costeo (`calculateTreeCraftCost`):**
   - `direct_buy`: Suma el coste de los ingredientes inmediatos de nivel 1. Si un ingrediente tiene precio 0 pero es crafteable, evalúa recursivamente su subcrafteo.
   - `full_subcraft`: Desglosa todos los ingredientes hasta materias primas no crafteables.
   - `auto_optimal`: En cada nodo del árbol, evalúa dinámicamente:
     $$\text{CostoNodo} = \min(\text{PrecioCompraDirecta}, \text{CostoSubcrafteo})$$
     Si el ingrediente es de tipo BYC (Cacería Legendaria), evalúa además la opción óptima entre recurso crudo, mapa o fragmentos.
   - `custom_hybrid`: Respeta las decisiones manuales tomadas por el usuario nodo a nodo (`buy` vs `craft`).
3. **Fórmulas Financieras Oficiales:**
   - **Tasa de Mercadillo:** $\text{Impuesto} = \lceil \text{PrecioVenta} \times 0.02 \rceil$ (2% con redondeo superior en Kamas).
   - **Margen Neto:** $\text{Margen} = \text{PrecioVenta} - \text{Impuesto} - \text{CostoFabricación}$.
   - **ROI (%):** $\text{ROI} = \frac{\text{Margen}}{\text{CostoFabricación}} \times 100$.
   - **Flujo Diario Estimado:** $\text{FlujoDiario} = \text{Margen} \times \text{VentasDiariasPromedio}$.

### 1.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Falta de Cotización en Ingredientes Críticos:** Si un ingrediente caro tiene precio 0 k, el coste de crafteo total se desploma artificialmente, proyectando un ROI astronómico (falso positivo de rentabilidad).  
  *Mitigación aplicada:* Indicador visual `missingIngredientsCount` y filtro "Solo ingredientes 100% cotizados".
- **Invalidación de Caché del Árbol:** Al editar el precio de un ingrediente base, si `clearRecipeTreeCache()` no se dispara en el momento preciso, el árbol renderizado conserva costes memorizados obsoletos.
- **Sobrecarga de Render en Árboles Profundos:** Expandir simultáneamente múltiples recetas de nivel 200 con decenas de sub-ingredientes puede provocar micro-congelamientos de UI si no se controla la renderización de filas jerárquicas.

---

## Sección 2: Gestión de Inventario y Crafteo Inverso - Mi Banco

### 2.1. Propósito y Alcance Funcional
Analizar los recursos y materias primas existentes en el banco del personaje (ingresados manualmente, pegados desde el juego o importados vía JSON) y cruzarlos contra la base completa de recetas para identificar qué objetos puede fabricar el usuario inmediatamente sin coste adicional, o cuáles requieren una inversión mínima en ingredientes faltantes para obtener un beneficio elevado.

### 2.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/BankCraftingView.tsx`
- **Filtros de Catálogo del Banco:** `src/components/bank/BankCatalogFilters.tsx`
- **Drawer Lateral de Recursos:** `src/components/bank/BankItemDrawer.tsx`
- **Tarjeta de Receta Inversa:** `src/components/bank/ReverseCraftCard.tsx`
- **Hook de Inventario:** `src/hooks/useBankInventory.ts`
- **Persistencia y Cálculo:** `src/services/dofusDbService.ts` (`calculateReverseCraftsFromBank`, `getStoredBankInventory`, `saveBankInventory`).

### 2.3. Interfaz de Usuario y Controles
- **Pestañas Internas:** "Recetas Posibles" (clasificación de oportunidades) e "Inventario del Banco" (listado de recursos almacenados, cantidades y valor acumulado en Kamas).
- **Controles de Gestión:**
  - Botón "Pegar inventario": Parser de texto de inventario copiado directamente del chat/portapapeles de Dofus.
  - Importador / Exportador JSON de inventario para copias de seguridad.
  - Botón "Vaciar banco" con confirmación de seguridad.
- **Filtros de Oportunidades:**
  - Filtrado por oficio y nivel (1 a 200).
  - Interruptor "Solo 100% crafteables": Muestra únicamente recetas donde el usuario posee la totalidad de los materiales requeridos.
  - Ordenación por: `Smart Score` (puntuación heurística de rentabilidad y factibilidad), `Mayor Beneficio Neto`, `Mayor ROI %`, `Mayor Cobertura de Materiales (%)`, `Menor Coste de Faltantes` y `Nivel de Objeto`.

### 2.4. Lógica de Negocio y Algoritmos
1. **Evaluación de Cobertura de Ingredientes:**  
   Para cada receta candidata y cada uno de sus ingredientes:
   $$\text{Faltantes}_i = \max(0, \text{CantidadRequerida}_i - \text{CantidadEnBanco}_i)$$
   $$\text{CostoFaltantes} = \sum (\text{Faltantes}_i \times \text{PrecioMercadillo}_i)$$
   $$\text{PorcentajeCobertura} = \frac{\text{IngredientesCompletos}}{\text{TotalIngredientes}} \times 100$$
2. **Cálculo de Margen con Recursos Propios:**  
   Dado que los recursos en banco tienen un coste de desembolso presente nulo (aunque poseen coste de oportunidad), la ganancia líquida inmediata al fabricar el objeto se define como:
   $$\text{GananciaLíquida} = (\text{PrecioVenta} - \text{Impuesto}) - \text{CostoFaltantes}$$
3. **Algoritmo Smart Score:**  
   Pondera armónicamente el ROI, el beneficio neto absoluto y la cercanía de fabricación (cobertura) para evitar que objetos de 500 kamas con 100% de cobertura superen a objetos de 2 millones de kamas que solo requieren comprar 1 recurso de 5,000 kamas.

### 2.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Consumo Concurrente de Materiales:** El cálculo de recetas inversas evalúa cada receta de forma aislada. Si el usuario tiene 50 unidades de un recurso y existen dos recetas distintas que requieren 50 unidades cada una, ambas aparecerán como "100% crafteables", aunque en la práctica solo podrá fabricar una de las dos.
- **Subcrafteos no Aplanados:** Si el banco contiene los ingredientes para fabricar un sustrato o una aleación intermedia pero no el sustrato ya elaborado, la calculadora tradicional de banco no detecta el crafteo en cascada a menos que se use la lógica recursiva de recetas.

---

## Sección 3: Simulador de Machacado de Runas y Coeficientes - Rompedora

### 3.1. Propósito y Alcance Funcional
Simular con precisión matemática el proceso de triturado/machacado de piezas de equipamiento en la forjamagia de Dofus (niveles 1 al 200), proyectando el tipo y cantidad exacta de runas generadas, evaluando el impacto del coeficiente de rotura por servidor, y contrastando el valor comercial de las runas resultantes contra el coste de fabricación o compra del equipable.

### 3.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/CrushingCalculator.tsx`
- **Héroe de Decisión Estratégica:** `src/components/crushing/CrushingStrategyHero.tsx`
- **Tabla Detallada de Runas Resultantes:** `src/components/crushing/CrushingRunesTable.tsx`
- **Barra Lateral de Receta del Ítem:** `src/components/crushing/RecipeSidebar.tsx`
- **Modal de Sincronización con Dofocus:** `src/components/crushing/DofocusSyncModal.tsx`
- **Base de Conocimiento de Pesos y Fórmulas:** `src/data/dofusRuneWeights.ts` (`calculateItemCrushing`, `extractItemStats`, `DOFUS_BASE_RUNES`).

### 3.3. Interfaz de Usuario y Controles
- **Modos de Vista:**
  - *Catálogo General:* Grid o lista con filtros por ranura (Sombrero, Capa, Anillo, etc.), nivel, coeficiente mínimo/máximo, fecha de actualización y ordenación por ganancia de runas, ROI o punto de equilibrio (`breakeven`).
  - *Detalle del Objeto:* Panel interactivo con slider de coeficiente de rotura (1% a 4000%), selector de foco a estadística única (Focus Stat), desglose de estadísticas promedio vs máximas y tabla de runas con cotizaciones en tiempo real.
  - *Catálogo de Precios de Runas:* Vista dedicada para auditar y actualizar los precios de las más de 80 runas oficiales del juego.
- **Persistencia de Filtros y Estado:** Guarda en `localStorage` (`dofus_crushing_filters_v2` y `dofus_crushing_state_v2`) el último objeto consultado, la vista activa y la configuración de filtros para evitar reseteos al navegar entre tabs.

### 3.4. Lógica de Negocio y Algoritmos
1. **Fórmula Oficial de Generación de Runas:**  
   Para cada estadística $j$ presente en el objeto con valor medio o máximo $V_j$ y peso de forjamagia $W_j$:
   $$\text{PesoEfecto}_j = V_j \times W_j$$
   $$\text{FactorNivel} = 1 + \frac{\text{NivelObjeto}}{20}$$
   $$\text{RunasGeneradas}_j = \frac{\text{PesoEfecto}_j \times \text{FactorNivel} \times \left(\frac{\text{Coeficiente}}{100}\right)}{W_{\text{runa}_j} \times 3}$$
2. **Modo Foco a una Característica (Focus):**  
   Al seleccionar foco sobre una estadística específica, la cantidad de runas generadas de esa característica se multiplica por un factor de bonificación (hasta 3x), pero se anula por completo la generación de runas de todas las demás estadísticas del objeto.
3. **Punto de Equilibrio (Breakeven Coefficient):**  
   Calcula el coeficiente mínimo de rotura necesario para que el valor bruto de las runas iguale exactamente el coste de fabricación:
   $$\text{CoeficienteEquilibrio} = \frac{\text{CostoFabricación}}{\text{ValorRunasAl100Porciento}} \times 100$$
4. **Protección de Ediciones Manuales (`is_manual`):**  
   Si el usuario ajusta un coeficiente manualmente tras una prueba in-game, el sistema almacena `is_manual = 1` y la marca temporal para evitar que las sincronizaciones periódicas con Dofocus sobreescriban el valor ingresado por el usuario.

### 3.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Estadísticas Exóticas o Negativas:** Ítems con malus (ej. -PM, -Resistencias) no deben restar runas de otras características. El extractor `extractItemStats` debe ignorar o filtrar adecuadamente las líneas con efectos negativos.
- **Desincronización en el Precio de Runas Clave:** Dado que la rentabilidad de machacado depende del valor agregado de 5 a 15 tipos de runas diferentes, si una runa de alto peso (ej. Runa PA, PM o Alcance) tiene un precio corrupto o inflado en mercadillo, la herramienta clasificará el equipable como altamente rentable de forma errónea.

---

## Sección 4: Optimizador de Subida de Oficios

### 4.1. Propósito y Alcance Funcional
Calcular la ruta de fabricación más económica, eficiente y balanceada para subir cualquier oficio de crafteo o forjamagia desde el nivel actual del usuario hasta el nivel objetivo (por defecto, nivel 200 o el siguiente hito), consolidando automáticamente los lotes de materiales requeridos y minimizando la pérdida o coste neto por punto de experiencia obtenido.

### 4.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/jobs/JobLevelingOptimizer.tsx`
- **Motor de Optimización y Fórmulas:** `src/services/jobLevelingService.ts` (`SUPPORTED_JOBS`, `calculateLevelTiers`, `generateOptimizedPhases`, `levelToXp`, `xpToLevel`, `getCraftXpByJobLevel`, `consolidateMaterialsNeeded`).

### 4.3. Interfaz de Usuario y Controles
- **Selectores Principales:** Oficio seleccionado (Joyero, Sastre, Zapatero, Herrero, etc.), nivel de partida (sincronizado con "Mis Oficios") y nivel meta.
- **Estrategias de Optimización:**
  - *Mínimo Coste Bruto:* Selecciona las recetas cuyo coste de compra de ingredientes es menor, sin importar la reventa.
  - *Máximo Retorno / Mínimo Coste Neto:* Considera la reventa del objeto crafteado o su triturado para recuperar kamas.
  - *Mínimo Clics / Menos Crafteos:* Prioriza recetas de mayor experiencia unitaria para reducir el tiempo manual en taller.
- **División por Fases (Milestones):** Desglose por tramos de nivel (ej. 1-20, 20-40, 40-60... 180-200).
- **Consola de Materiales Consolidados:** Panel que totaliza los ingredientes de todas las fases planificadas con botón para agregar directamente a la Lista de Compras.

### 4.4. Lógica de Negocio y Algoritmos
1. **Curva Oficial de Experiencia:**  
   Utiliza la tabla acumulativa oficial de Dofus Unity para convertir bidireccionalmente niveles en puntos de XP requeridos ($\Delta \text{XP} = \text{xpToLevel}(\text{Target}) - \text{levelToXp}(\text{Start})$).
2. **Cálculo de XP por Crafteo (`getCraftXpByJobLevel`):**  
   En Dofus, la experiencia otorgada por una receta decrece a medida que el nivel del oficio supera el nivel del ítem. Cuando la diferencia supera los 20 niveles, la XP disminuye progresivamente hasta ser nula:
   $$\text{XpBase} = 20 \times \text{NivelReceta}$$
   $$\text{FactorPenalización} = f(\text{NivelOficio} - \text{NivelReceta})$$
3. **Exclusión de Recetas Inválidas (`isQuestOrZeroXpCraft`):**  
   Filtra automáticamente recetas vinculadas a misiones que no otorgan experiencia o requieren herramientas especiales no comerciables.

### 4.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Falsos Costes Cero:** Si una receta de nivel 40 incluye ingredientes no cotizados en la base de datos, el algoritmo de coste mínimo la seleccionará de forma preferente considerándola "gratis", desvirtuando la planificación real de materiales.
- **Saturación de Inventario:** Planificar 1,500 sombreros de nivel 20 ocupará 1,500 slots en inventario o banco. La herramienta debe alertar o priorizar objetos apilables o de rápida rotación.

---

## Sección 5: Planificador Diario de Crafteo

### 5.1. Propósito y Alcance Funcional
Asignar de forma inteligente un presupuesto diario disponible en Kamas (ej. 1 Mk, 5 Mk, 20 Mk) entre una cartera diversificada de recetas que el usuario puede fabricar con sus niveles reales de oficio, limitando la producción según la velocidad real de absorción del mercadillo para evitar la sobreoferta y el estancamiento de capital.

### 5.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/DailyCraftPlanner.tsx`
- **Servicios:** `src/services/salesVolumeService.ts` (`analyzeSalesVolume`), `src/hooks/useUserJobs.ts`, `src/services/dofusDbService.ts`.

### 5.3. Interfaz de Usuario y Controles
- **Entrada Presupuestaria:** Input numérico libre o selección rápida de presets (1 Mk, 3 Mk, 5 Mk, 10 Mk, 20 Mk, 50 Mk).
- **Modos de Optimización:**
  - *Balanceado:* Equilibrio ponderado entre rentabilidad y rotación rápida.
  - *Máximo Beneficio:* Maximiza la ganancia neta total en Kamas.
  - *Máximo ROI:* Maximiza el retorno porcentual por cada kama invertido.
- **Parámetros de Riesgo:**
  - Días objetivo de venta (`targetDays`, ej. 1 día, 3 días, 7 días).
  - Límite máximo de slots de mercadillo a ocupar (`maxHdvSlots`).
  - Límite de concentración presupuestaria por ítem (máx. 35% del presupuesto en un solo objeto).
  - Interruptor "Solo mis oficios" y selector de ROI mínimo (por defecto 15%).
- **Acciones sobre la Cartera:** Ajuste manual de unidades recomendadas, exclusión temporal de ítems y botón de envío masivo a la Lista de Compras.

### 5.4. Lógica de Negocio y Algoritmos
1. **Diferenciación de Slots:**
   - Equipamiento: 1 slot de mercadillo por cada unidad fabricada.
   - Consumibles / Recursos apilables: Se comercializan en lotes (x1, x10, x100), por lo que 100 pociones ocupan solo 1 slot.
2. **Restricción de Absorción del Mercado:**  
   Para cada ítem candidato con venta diaria estimada $V_{\text{diaria}}$:
   $$\text{UnidadesMáximas} = \lfloor V_{\text{diaria}} \times \text{DíasObjetivo} \rfloor$$
   Si no existen registros de venta históricos, se aplica un tope de seguridad de 1 unidad para equipables o 1 lote pequeño para consumibles.
3. **Distribución Presupuestaria Greedy / Mochila Acotada:**  
   Itera sobre los ítems clasificados por puntuación de atractivo, asignando unidades hasta agotar el presupuesto o alcanzar las restricciones de slots y concentración máxima.

### 5.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Falta de Datos de Volumen:** Si el usuario no ha utilizado el sniffer o no ha descargado datos de volumen, todos los ítems carecerán de métricas de rotación, provocando que el planificador dependa de supuestos estáticos o rechace objetos rentables.

---

## Sección 6: Ranking Global de Rentabilidad

### 6.1. Propósito y Alcance Funcional
Proporcionar un tablero clasificatorio integral de todas las recetas registradas en Dofus, ordenadas por su potencial de rentabilidad neta y retorno de inversión, evaluando simultáneamente las dos vías comerciales disponibles para cada objeto: venta directa en HDV o triturado en la rompedora para venta de runas.

### 6.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/GlobalProfitRanking.tsx`
- **Insignia de Frescura de Cotización:** `src/components/common/PriceFreshnessBadge.tsx`
- **Servicios:** `src/services/dofusDbService.ts`, `src/data/dofusRuneWeights.ts` (`calculateItemCrushing`).

### 6.3. Interfaz de Usuario y Controles
- **Filtros Macroeconómicos:**
  - Selector de estrategia comercial: `Todas`, `Solo HDV`, `Solo Rompedora`, `Solo Rentables`.
  - Filtro por oficio, nivel mínimo/máximo, ganancia mínima neta, ROI mínimo y coste máximo de fabricación.
- **Tabla Analítica:** Columnas para Nivel, Objeto, Oficio, Coste de Crafteo, Precio HDV, Margen HDV (Kamas y ROI), Valor Estimado de Runas, Margen Rompedora y Mejor Estrategia recomendada.
- **Acciones Rápidas:** Copiar nombre al portapapeles, enviar a la Calculadora de Recetas, enviar a la Rompedora o agregar directamente a la Lista de Compras.

### 6.4. Lógica de Negocio y Algoritmos
- **Evaluación Bimodal por Ítem:**
  $$\text{BeneficioHDV} = \text{PrecioVenta} - \lceil \text{PrecioVenta} \times 0.02 \rceil - \text{CostoCrafteo}$$
  $$\text{BeneficioRompedora} = \text{ValorRunasProyectadas} - \text{CostoCrafteo}$$
  $$\text{MejorEstrategia} = \begin{cases} \text{"hdv"}, & \text{si } \text{BeneficioHDV} \ge \text{BeneficioRompedora} \text{ y } \text{BeneficioHDV} > 0 \\ \text{"crush"}, & \text{si } \text{BeneficioRompedora} > \text{BeneficioHDV} \text{ y } \text{BeneficioRompedora} > 0 \\ \text{"none"}, & \text{en otro caso} \end{cases}$$

### 6.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Coste Computacional Elevado:** Calcular de manera continua las runas y costes de miles de objetos en el cliente al cambiar un filtro puede generar caídas de frames si no se gestiona con memoización estricta (`useMemo`) y paginación acotada (25 ítems por página).

---

## Sección 7: Planificador de Lista de Compras

### 7.1. Propósito y Alcance Funcional
Consolidar en una lista única de compras todos los ingredientes, materias primas y cantidades necesarias provenientes de las distintas secciones (Calculadora de Recetas, Planificador Diario, Crafteo Inverso, Dofusbook o Subida de Oficios), permitiendo marcar los ítems ya adquiridos y proyectar el gasto total y pendiente en Kamas.

### 7.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/ShoppingListPlanner.tsx`
- **Búsqueda Rápida:** `src/components/QuickSearchModal.tsx`
- **Servicio y Estado:** `src/services/dofusDbService.ts` (`getShoppingList`, `updateShoppingListItemQuantity`, `removeFromShoppingList`, `clearShoppingList`, `getConsolidatedShoppingIngredients`).

### 7.3. Interfaz de Usuario y Controles
- **Listado Consolidado:** Tabla agrupada por ingrediente único con icono, nombre, cantidad total requerida, precio unitario de mercadillo, coste total acumulado y checkbox de estado ("comprado").
- **Edición en Vivo:**
  - Ajuste de cantidades con botones +/- o entrada numérica directa.
  - Edición instantánea del precio unitario del ingrediente.
  - Buscador modal para agregar ingredientes o recetas adicionales manualmente.
  - Botón para copiar la lista de compras en texto plano estructurado (ideal para comprar rápido en mercadillo).

### 7.4. Lógica de Negocio y Algoritmos
- **Consolidación de Multi-Recetas:**
  Si el usuario agrega 2 Sombreros de Jalató y 5 Capas de Jalató, la función `getConsolidatedShoppingIngredients` agrega las recetas a nivel atómico sumando las cantidades de ingredientes compartidos:
  $$\text{CantidadConsolidada}_i = \sum_{r \in \text{Recetas}} (\text{CantidadPorReceta}_{i,r} \times \text{LotesReceta}_r)$$
- **Coste Pendiente vs Coste Total:**
  $$\text{CosteTotal} = \sum (\text{CantidadConsolidada}_i \times \text{PrecioUnitario}_i)$$
  $$\text{CostePendiente} = \sum_{i \notin \text{Comprados}} (\text{CantidadConsolidada}_i \times \text{PrecioUnitario}_i)$$

### 7.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Falta de Descuento Automático con el Banco:** Si el usuario tiene 50 unidades de un recurso en su banco, la lista de compras sigue pidiendo comprar el 100% de los materiales a menos que exista una conciliación explícita con el inventario bancario.

---

## Sección 8: Mapas de Se Busca y Cacerías Legendarias - BYC

### 8.1. Propósito y Alcance Funcional
Administrar y analizar la economía de las 45 Cacerías Legendarias de "Se Busca" (BYC) en Dofus Unity. Permite resolver la encrucijada comercial central de esta actividad: ¿es más rentable vender el recurso crudo del jefe en mercadillo, o utilizarlo para fabricar los equipables legendarios asociados? Asimismo, evalúa las 3 vías de adquisición del objeto (comprar fragmentos, comprar mapa completo o comprar recurso directo).

### 8.2. Componentes y Archivos Clave
- **Vista Resumen de Cacerías:** `src/components/TreasureHuntCalculator.tsx`
- **Página de Detalle Profundo por Cacería:** `src/components/BycDetailPage.tsx`
- **Modal de Exportación a Excel:** `src/components/BycExportExcelModal.tsx`
- **Base de Datos BYC:** `src/data/bycDatabase.ts`, `src/data/bycGeneratedDbData.ts`, `src/data/bycEquipmentData.ts`, `src/data/legendaryHuntsData.ts`.
- **Servicios:** `src/services/bycCostService.ts`, `src/services/bycExcelExportService.ts`.

### 8.3. Interfaz de Usuario y Controles
- **Configuración del Sebuscalín:** Control editable en cabecera para definir la cotización de referencia de 1 Sebuscalín en Kamas (almacenado por servidor en `localStorage`).
- **Filtros por Zona Geográfica:** Astrub, Amakna, Frigost I/II/III, Dimensiones Divinas (Sramvil, Anutropía, Zurcalia, etc.) y rango de nivel.
- **Página de Detalle (`BycDetailPage`):**
  - Desglose de fragmentos del mapa y cotización individual.
  - Retorno garantizado de Sebuscalines del cofre.
  - Tabla comparativa de equipables asociados con cálculo de ganancia neta y ROI según las 3 vías de obtención.
  - Tarjeta de recomendación de decisión: "Vender Recurso Crudo" vs "Craftear Equipable".
- **Exportador a Excel:** Genera un archivo `.xlsx` profesional con estilos tipográficos, bordes corporativos y fórmulas nativas de Excel en 4 hojas analíticas (Resumen Cacerías, Detalle Equipables, Matriz de Decisiones y Cotización de Fragmentos).

### 8.4. Lógica de Negocio y Algoritmos
1. **Evaluación de las 3 Vías de Obtención:**
   - *Vía 1 (Fragmentos):* $\text{Costo} = \sum \text{PrecioFragmentos} - (\text{SebuscalinesCofre} \times \text{ValorSebuscalín}) + \text{OtrosIngredientesReceta}$
   - *Vía 2 (Mapa Entero):* $\text{Costo} = \text{PrecioMapaHDV} - (\text{SebuscalinesCofre} \times \text{ValorSebuscalín}) + \text{OtrosIngredientesReceta}$
   - *Vía 3 (Recurso Crudo HDV):* $\text{Costo} = \text{PrecioRecursoJefeHDV} + \text{OtrosIngredientesReceta}$
2. **Valor Agregado de Crafteo frente a Venta Cruda:**
   $$\text{ValorAgregado} = \text{BeneficioNetoCrafteo} - (\text{PrecioRecursoCrudo} - \text{ImpuestoRecurso})$$
   Si el valor agregado es negativo, fabricar el objeto destruye valor respecto a vender el recurso directamente en HDV.

### 8.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Fragmentos no Cotizados:** Un mapa requiere típicamente 4 o 5 fragmentos distintos. Si uno de ellos no tiene cotización en el servidor activo, el coste de la Vía 1 queda subestimado.
- **Aislamiento por Servidor:** La cotización del Sebuscalín varía drásticamente entre servidores monocuenta (Draconiros) y pioneros/multicuenta. Debe garantizarse el aislamiento de este parámetro por servidor (`dofus_sebuscalin_unit_price_{slug}`).

---

## Sección 9: Consumibles de Características y Pergaminos

### 9.1. Propósito y Alcance Funcional
Analizar el mercado de consumibles permanentes de características derivados de protectores de recursos (Cazador, Pescador, Campesino, Alquimista) y los pergaminos de características tradicionales canjeables por Sebuscalines, permitiendo:
1. Comparar el coste de subir una estadística de 0 a 100 mediante consumibles frente a pergaminos.
2. Identificar qué pergaminos generan el mayor retorno de Kamas por cada Sebuscalín invertido frente al activo seguro de referencia (Turmalina a 200 Sebuscalines).
3. Simular la asignación óptima de Sebuscalines disponibles.

### 9.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/ConsumablesCharacteristicView.tsx`
- **Catálogo de Datos:** `src/data/characteristicConsumablesData.ts` (`CHARACTERISTIC_SCROLLS`, `CHARACTERISTIC_CONSUMABLES`).
- **Servicios:** `src/services/dofusDbService.ts`, `src/services/salesVolumeService.ts`.

### 9.3. Interfaz de Usuario y Controles
- **Sub-Tabs:** "Pergaminos & Sebuscalines" y "Consumibles de Protectores".
- **Filtros:** Estadística objetivo (Fuerza, Vitalidad, Sabiduría, Inteligencia, Suerte, Agilidad), oficio recolector y buscador por nombre.
- **Simulador de Canje:** Input de Sebuscalines acumulados (ej. 5,000 Sebuscalines) y selector de estrategia: "Diversificado" (reparte compras según la demanda diaria en 24h/7d) o "Máximo Retorno" (concentra el 100% en el pergamino con mayor ratio Kamas/Sebuscalín).
- **Comparador 0-100:** Visualización del desglose paso a paso de los 4 tramos de pergaminos (Pequeño 1-25, Mediano 26-50, Grande 51-80, Potente 81-100) vs los consumibles de oficio equivalentes.

### 9.4. Lógica de Negocio y Algoritmos
- **Ratio de Rentabilidad por Sebuscalín:**
  $$\text{Ratio} = \frac{\text{PrecioMercadillo}}{\text{CostoSebuscalines}}$$
- **Diferencial frente a Turmalina:**  
  La Turmalina (ID: 15271) cuesta exactamente 200 Sebuscalines y es el benchmark estándar de liquidez del juego:
  $$\text{RatioTurmalina} = \frac{\text{PrecioTurmalina}}{200}$$
  $$\text{DiferencialVsTurmalina} = \frac{\text{RatioPergamino} - \text{RatioTurmalina}}{\text{RatioTurmalina}} \times 100$$
  Cualquier pergamino con diferencial positivo genera más Kamas por Sebuscalín que la Turmalina.

### 9.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Límites de Características por Tramo:** En ciertas actualizaciones de Dofus los consumibles de protectores han cambiado sus tramos máximos de uso. Si los datos en `characteristicConsumablesData.ts` no se mantienen sincronizados con los efectos del juego, la comparación 0-100 arrojará cantidades inexactas.

---

## Sección 10: Calculadora de Sets Dofusbook

### 10.1. Propósito y Alcance Funcional
Importar builds y equipamientos completos configurados por jugadores en **Dofusbook** (a través de enlaces públicos `dofusbook.net` o enlaces cortos `d-bk.net`), extrayendo automáticamente el equipamiento asignado a los 16 slots principales del personaje para calcular y comparar el coste de comprar el set completo armado en mercadillo frente al coste de fabricar artesanalmente cada pieza desde cero.

### 10.2. Componentes y Archivos Clave
- **Componente Frontend:** `src/components/DofusbookSetCalculator.tsx`
- **Endpoint Backend / Serverless:** `api/dofusbook/analyze.ts` / `src/server/expressApp.ts` (`/api/dofusbook/analyze`)
- **Lógica de Extracción:** `src/server/localDataStore.ts` (`analyzeDofusbookBuild`).

### 10.3. Interfaz de Usuario y Controles
- **Entrada de URL:** Input de texto con validación y normalización de enlaces Dofusbook.
- **Opciones de Exclusión:** Switches para "Excluir Dofus" (generalmente no crafteables, obtenidos por misiones) y "Excluir Trofeos".
- **Pestañas de Resultados:**
  - *Comparativa:* Tarjetas de cada ítem del set mostrando precio de compra vs coste de crafteo, ahorro estimado, y badges para marcar ítems como "Ya obtenido" o "Excluido".
  - *Materiales Requeridos:* Lista consolidada de materias primas para fabricar las piezas seleccionadas que no se tienen, con filtro de "necesitados / obtenidos" y botón para enviar a la Lista de Compras general.
- **Persistencia de Sesión:** Guarda el estado en `localStorage` (`dofus_dofusbook_cached_session_v1`) para no perder la build al refrescar la página.

### 10.4. Lógica de Negocio y Algoritmos
- **Scraping y Normalización Backend:** Descarga la página de Dofusbook, procesa el payload HTML/JSON, extrae los identificadores de objeto de cada ranura, resuelve los IDs canónicos en la base de datos local y consulta las recetas e ingredientes asociados.
- **Cálculo de Ahorro:**
  $$\text{AhorroKamas} = \sum \text{PrecioCompraDirecta}_k - \sum \text{CostoCrafteo}_k$$
  $$\text{AhorroPorcentaje} = \frac{\text{AhorroKamas}}{\sum \text{PrecioCompraDirecta}_k} \times 100$$

### 10.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Cambios en el DOM de Dofusbook:** Si Dofusbook altera su estructura HTML o sus endpoints internos de renderizado, el extractor backend puede fallar o retornar builds vacías.
- **Builds Privadas:** Builds no publicadas o protegidas retornarán error 404/403, requiriendo mensajes de error claros al usuario.

---

## Sección 11: Gestor de Precios de Mercadillo e Historial

### 11.1. Propósito y Alcance Funcional
Centro operativo para la visualización, filtrado masivo, edición manual y auditoría histórica de las cotizaciones de todos los objetos del juego por servidor. Integra las métricas de volumen de ventas (24h, 7d, 30d), velocidad de rotación y herramientas de importación/exportación rápida.

### 11.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/PriceManager.tsx`
- **Modales Asociados:**
  - `src/components/GlobalPriceHistoryModal.tsx`: Historial general de cambios de precio con paginación y reversión.
  - `src/components/ItemPriceHistoryModal.tsx`: Gráfico e historial específico por ítem.
  - `src/components/common/EditSalesVolumeModal.tsx`: Editor de volúmenes de ventas (24h, 7d, 30d y precio sugerido).
  - `src/components/MarketSnifferModal.tsx`: Panel de control y descarga del sniffer.
  - `src/components/common/BackupModal.tsx`: Gestor de copias de seguridad de la base de datos.
- **Servicios:** `src/services/salesVolumeService.ts`, `src/services/dofusDbService.ts`.

### 11.3. Interfaz de Usuario y Controles
- **Filtros por Categoría de Mercado:** Recursos de recolección (Campesino, Leñador, Alquimista, Minero, Pescador, Cazador), Runas de forjamagia, Equipamiento, Dofus, Objetos con precio y Objetos sin cotización.
- **Scope de Visualización:** "Todos los objetos", "Solo materias primas/recursos puros" o "Solo objetos crafteables".
- **Edición en Línea con Debounce:** Modificación instantánea de cotizaciones directamente en la tabla, con guardado asíncrono y notificación toast de confirmación.
- **Ordenación Avanzada por Rotación:** Ordenar por volumen en 24h, 7d, 30d o promedio diario ponderado.

### 11.4. Lógica de Negocio y Algoritmos
1. **Algoritmo de Rotación de Ventas Ponderado (`analyzeSalesVolume`):**  
   Pondera los tres horizontes temporales para suavizar picos atípicos de 24 horas:
   $$\text{VentasDiarias} = \frac{(\text{Ventas}_{24h} \times 0.50) + \left(\frac{\text{Ventas}_{7d}}{7} \times 0.35\right) + \left(\frac{\text{Ventas}_{30d}}{30} \times 0.15\right)}{0.50 + 0.35 + 0.15}$$
   $$\text{DíasParaVender} = \frac{1}{\text{VentasDiarias}}$$
2. **Clasificación de Rotación:**
   - *Alta rotación:* $\ge 1$ venta/día (se vende en menos de 24 horas).
   - *Media rotación:* entre 0.25 y 1 venta/día (tarda entre 1 y 4 días).
   - *Baja rotación:* $< 0.25$ ventas/día (tarda más de 4 días).
3. **Detección de Momentum Comercial:**
   - *Acelerado:* $\text{Ventas}_{24h} > \left(\frac{\text{Ventas}_{7d}}{7}\right) \times 1.30$.
   - *Desacelerado:* $\text{Ventas}_{24h} < \left(\frac{\text{Ventas}_{7d}}{7}\right) \times 0.70$.
   - *Estable:* Dentro del rango $\pm 30\%$.

### 11.5. Incoherencias Potenciales y Puntos Críticos de Falla
- **Desincronización de Timers de Debounce:** Si el usuario edita precios rápidamente y cambia de página antes de expirar el temporizador de 400 ms, el valor modificado puede perderse sin enviarse al backend.  
  *Mitigación aplicada:* Referencia mutable `debounceTimersRef` con limpieza en desmontaje.

---

## Sección 12: Base de Datos y Catálogo Maestro

### 12.1. Propósito y Alcance Funcional
Gestionar la ingesta, indexación y actualización del catálogo completo de objetos, tipos, recetas y efectos del universo Dofus, sincronizándose con la API pública oficial de DofusDB (`https://api.dofusdb.fr`) o sembrando la base instantáneamente mediante el bundle pre-empaquetado (`dofusDbSeedData.ts`).

### 12.2. Componentes y Archivos Clave
- **Vista Principal:** `src/components/DofusImporter.tsx`
- **Servicios:** `src/services/dofusDbService.ts` (`performFullItemImport`, `triggerFastSeedDatabase`, `fetchLiveSyncStatus`).
- **Endpoints de Ingestión por Pasos:** `/api/local-db/seed-step/*` y `/api/local-db/import-chunk/*`.

### 12.3. Interfaz de Usuario y Controles
- **Indicadores de Salud:** Contador total de objetos indexados, total de recetas registradas, total de precios guardados y fecha de la última sincronización.
- **Acciones Principales:**
  - *Sincronizar Turso (Rápido):* Sembrado en 4 pasos atómicos que carga el catálogo completo en 2-4 segundos.
  - *Rastrear DofusDB en Vivo:* Ejecuta una recolección paginada completa desde los servidores de DofusDB.
  - *Switch de Auto-Sync:* Habilita o deshabilita la verificación periódica de actualizaciones cada 30 días.

### 12.4. Lógica de Negocio y Reglas de Depuración
1. **Exclusión de Ítems Obsoletos o no Comerciales:**
   - Ídolos de mazmorra antiguos (tipo 289 y lista de IDs de ídolos retirados del juego).
   - Ítems de clase y sus 20 panoplias asociadas (`isClassItem`), dado que no poseen mercado ni generan runas útiles.
   - Objetos puramente cosméticos o apariencias (`isCosmeticItem`).
2. **Chunking y Resiliencia en Vercel/Serverless:**  
   Dado que Vercel aplica límites de tiempo de ejecución (10s a 60s) y tamaños máximos de payload HTTP (4.5 MB), la sincronización se fragmenta en llamadas secuenciales (`seedStepInit` $\to$ `seedStepItems` $\to$ `seedStepRecipes` $\to$ `seedStepFinalize`).

---

## Sección 13: Módulos Transversales y Núcleo del Sistema

### 13.1. Filtro Global "Mis Oficios"
- **Archivos:** `src/components/common/UserJobsModal.tsx`, `src/services/userJobsService.ts`, `src/hooks/useUserJobs.ts`.
- **Mecánica:** Permite al usuario configurar sus niveles reales (1 a 200) para los 20 oficios de Dofus, clasificados en:
  - *Recolección (6):* Alquimista, Campesino, Cazador, Leñador, Minero, Pescador.
  - *Crafteo (8):* Joyero, Sastre, Zapatero, Herrero, Escultor, Fabricante, Manitas, Ganadero.
  - *Forjamagia (6):* Joyeromago, Costureromago, Zapateromago, Forjamago, Escultormago, Fabricamago.
- **Cascada Global:** Al activar el interruptor maestro (`enabled: true`), un hook reactivo (`useUserJobs`) filtra automáticamente las recetas mostradas en: Calculadora de Recetas, Rompedora (verifica crafteo O forjamagia vía `canUserCraftOrMageItem`), Ranking de Rentabilidad, Crafteo Inverso y Planificador Diario.
- **Aislamiento:** 100% persistido en `localStorage` (`dofus_user_job_levels_v1`), garantizando privacidad y reactividad sin llamadas de red.

### 13.2. Sniffer Pasivo de Red para Dofus Unity
- **Archivos:** `scripts/sniffer_standalone.py`, `scripts/ejecutar_sniffer.bat`, `api/market/update.ts`, `api/market/batch-update.ts`.
- **Mecánica de Captura:**
  - Script independiente en Python que utiliza la librería `scapy` para escuchar de forma pasiva el tráfico TCP en el puerto 5555 del juego.
  - No inyecta código ni modifica la memoria del cliente de Dofus (operación pasiva indetectable).
- **Procesamiento de Protocolo (Protobuf Varints):**
  - Decodifica varints y empaquetados de precios de mercadillo.
  - Discrimina automáticamente entre **Recursos** (lotes x1, x10, x100, x1000) y **Equipables** (ofertas individuales ordenadas por precio unitario).
- **Algoritmo Anti-Troll y Filtro de Valores Atípicos (`calculateItemMarketPrice`):**
  - *Recursos:* Si hay 3 o 4 lotes disponibles, calcula la mediana de precios unitarios y descarta lotes que se desvíen más del 3.5x o menos del 0.25x de la mediana (evita troleos de 1 kama o precios absurdos en lotes de 1).
  - *Equipables:* Descarta ofertas con exomagueos extremos (> 1.8x del precio base de mercado). Calcula el precio final ponderando 70% el grupo de ofertas competitivas más bajas y 30% la mediana estándar.
  - *Salvaguarda de Cotización:* Si el precio capturado supera 3x la cotización histórica sugerida o cae por debajo del 25% con 1 sola oferta solitaria, activa la bandera `anti_troll_triggered` y adopta el precio sugerido de referencia.

### 13.3. Aislamiento por Servidor y Perfiles de Precios
- **Archivos:** `src/server/localDataStore.ts` (`UNITY_SERVER_PROFILES`), `src/utils/serverUtils.ts`.
- **Servidores Oficiales Soportados:**
  - *Monocuenta Clásico:* Draconiros (perfil predeterminado).
  - *Monocuenta Pionero:* Kourial, Mikhal, Dakal.
  - *Multicuenta Pionero:* Brial, Rafal, Salar.
  - *Multicuenta Clásico:* Tal Kasha, Hell Mina, Imagiro, Orukam, Tylezia.
- **Garantía de Aislamiento:** Todas las tablas de precios (`profile_prices`), historial (`price_history`), coeficientes de rompedora (`profile_coefficients`) y volumen de ventas (`profile_sales_volume`) indexan obligatoriamente `profile_id`. Al cambiar de servidor en la barra de navegación, toda la interfaz conmuta instantáneamente sin mezclar datos económicos entre servidores.

### 13.4. Sincronización Automática con Dofocus
- **Archivos:** `src/server/dofocusBackgroundSync.ts`, `src/components/crushing/DofocusSyncModal.tsx`.
- **Mecánica:** Proceso en segundo plano que consulta periódicamente los coeficientes reales de rotura calculados por la comunidad en Dofocus (`https://dofocus.com`).
- **Respeto a Modificaciones Locales:** Al sincronizar coeficientes, comprueba la columna `is_manual`. Si un jugador editó manualmente el coeficiente de un objeto, Dofocus no sobreescribe dicho registro.

### 13.5. Sistema de Respaldo y Restauración JSON
- **Archivos:** `src/components/common/BackupModal.tsx`, `src/services/backupService.ts`.
- **Alcance:** Genera un archivo `.json` íntegro que empaqueta:
  1. Todos los precios de mercadillo del perfil activo y de todos los servidores.
  2. Coeficientes de machacado y banderas de edición manual.
  3. Historial de cotizaciones y volúmenes de venta.
  4. Inventario del banco del usuario y lista de compras.
  5. Niveles de oficio configurados en "Mis Oficios".

### 13.6. Persistencia y Arquitectura Backend (Express / LibSQL / Turso)
- **Modo Local:** Servidor Express nativo que interactúa con SQLite local (`local.db`) en modo WAL (`journal_mode = WAL`, `synchronous = NORMAL`) para garantizar lecturas ultrarrápidas y soportar miles de escrituras por minuto provenientes del sniffer.
- **Modo Nube (Vercel + Turso):** Si se configuran `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`, `@libsql/client` redirige las consultas transparentemente hacia la base de datos distribuida en Turso vía HTTPS.

### 13.7. Motor de Temas Visuales y CSS
- **Archivos:** `src/index.css`, `src/components/Navbar.tsx`.
- **Temas Implementados:**
  - `bonta`: Azul pizarra (#38bdf8), estética fría de la ciudad de la luz.
  - `brakmar`: Carbón oscuro y rojo carmesí (#f43f5e), estética volcánica.
  - `pandala`: Verde jade y esmeralda (#10b981), tonos de bosque y bambú.
  - `calm`: Fondo neutro suave con acentos ámbar (#f59e0b).
- **Mecanismo:** Atributo `data-theme` en el elemento raíz `<html>`, persistido en `localStorage` (`dofus_active_theme`) con transiciones suaves de color.

---

## 15. Matriz Maestra de Incoherencias Potenciales y Puntos Críticos

| Sección / Módulo | Tipo de Riesgo | Causa Raíz Potencial | Impacto en la Experiencia / Operación | Estrategia de Mitigación Recomendada |
|---|---|---|---|---|
| **Calculadora de Recetas** | Incoherencia Matemática | Ingrediente sin precio registrado (precio = 0). | Coste de crafteo subestimado; ROI irrealmente alto (falso positivo). | Exigir precio en ingredientes o usar precio sugerido/histórico antes de habilitar badge "Rentable". |
| **Calculadora de Recetas** | Error de Caché | Edición de precio profundo sin invalidación en cascada. | El nodo raíz conserva el coste viejo del subingrediente. | Verificar que `clearRecipeTreeCache()` incremente la versión de árbol en cada cambio. |
| **Mi Banco (Crafteo Inverso)** | Incoherencia Lógica | Concurrencia de recursos compartidos entre varias recetas. | El usuario cree que puede craftear 3 recetas a la vez pero solo alcanza para 1. | Añadir modo de "Simulación de Consumo en Lote" que reste stock temporalmente. |
| **Rompedora de Runas** | Incoherencia Económica | Precio de una runa clave inflado o desactualizado. | Proyección de ganancias de triturado muy por encima de la realidad. | Comparar precio de runas contra promedio histórico antes de recomendar machacado. |
| **Subir Oficios** | Ineficiencia de Planificación | Recetas con ingredientes caros evaluadas con precio 0. | Sugiere fabricar ítems inviables en el juego real. | Filtrar recetas con ingredientes faltantes de precio en el optimizador de XP. |
| **Plan Diario de Crafteo** | Riesgo de Mercado | Pico aislado de ventas en 24 horas. | Fabricar exceso de unidades que tardan semanas en venderse. | Ponderar 7d (35%) y 30d (15%) en la fórmula de ventas diarias, no solo 24h. |
| **Cacerías BYC** | Incoherencia de Aislamiento | Cotización de Sebuscalines compartida entre servidores. | Los precios de cofres en Draconiros se calculan con ratios de servidores clásicos. | Validar que la clave de almacenamiento incluya siempre el slug del servidor activo. |
| **Dofusbook Sets** | Falla de Integración | Modificación del DOM o endpoints de Dofusbook. | Fallo silencioso o error 500 al importar enlaces de builds. | Añadir timeout de scraping con fallback a mensaje instructivo y parseo manual. |
| **Sniffer de Mercadillo** | Error de Decodificación | Paquetes de equipables interpretados como recursos. | Guarda precios unitarios en slots de lotes de 10 o 100. | Validar siempre el catálogo `EQUIPMENT_IDS` y rechazar lotes si el tipo es equipable. |
| **Base de Datos / SQLite** | Ineficiencia / Cuello de Botella | Escrituras masivas individuales desde el sniffer. | Bloqueo de base de datos (`SQLITE_BUSY` o latencia en requests). | Utilizar micro-batching (`/api/market/batch-update`) con transacciones agrupadas. |

---

## 16. Recomendaciones para Mantenimiento y Pruebas Futuras

1. **Monitoreo de Paquetes en Dofus Unity:**  
   Dado que Dofus Unity recibe parches continuos, cualquier cambio en la estructura de paquetes Protobuf puede alterar los tags de varints. Revisar periódicamente `cotizaciones_inspeccion.txt` y `sniffer.log` tras cada actualización del cliente de juego.
2. **Auditoría de Fórmulas de Machacado:**  
   Contrastar periódicamente los pesos de estadísticas (`dofusRuneWeights.ts`) con las tablas oficiales de forjamagia para asegurar que nuevas runas añadidas por Ankama tengan sus factores de peso exactos.
3. **Pruebas Automatizadas:**  
   Ejecutar la suite de tests existente (`npm test`) que valida:
   - Cálculos de lotes y anti-troll en mercadillo (`test_market_calculator.test.ts`).
   - Algoritmos de subida de oficio y curvas de nivel (`test_job_leveling_optimizer.test.ts`).
   - Resolución de conflictos LWW en volúmenes de venta (`test_sales_volume_lww.test.ts`).
   - Generación de libros de Excel con fórmulas nativas (`test_byc_excel_export.test.ts`).
   - Aislamiento de perfiles de servidores y oficios personales (`test_user_jobs_and_server_isolation.test.ts`).
   - Decodificación y rendimiento del sniffer en Python (`test_sniffer.py`).
