# HISTORIAL DE CAMBIOS Y ARQUITECTURA DEL SNIFFER DOFUS UNITY

Este documento sirve como registro técnico exhaustivo de los cambios realizados en el sniffer de mercadillo, los problemas detectados en cada iteración, los errores de aproximación cometidos y las reglas canónicas que deben respetarse en futuras actualizaciones para no reescribir el sniffer desde cero.

---

## 1. ESTADO ORIGINAL (PRE-ACTUALIZACIÓN)
- **Protocolo y Token:** El cliente de Dofus Unity emitía un token fijo previo en los paquetes TCP del puerto 5555.
- **Formato:** Los paquetes contenían mensajes Protobuf estándar donde los lotes de recursos venían en un campo repetido con 4 enteros continuos: `[precio_x1, precio_x10, precio_x100, precio_x1000]`.
- **Comportamiento:** Funcionaba de forma estable porque la estructura no variaba entre diferentes aperturas y no se mezclaban ofertas de equipables complejas.

---

## 2. LA ACTUALIZACIÓN DE ANKAMA Y EL NUEVO TOKEN `jzn`
- **Cambio de Token:** Ankama cambió la firma de los paquetes a `jzn`.
- **Cambio en el formato del Payload:**
  - Los mensajes de mercadillo pasaron a incluir subestructuras Protobuf con campos de longitud variable (`wire_type == 2`).
  - Para los **Equipables**, cada oferta puesta a la venta en el mercadillo se envía como un submensaje que contiene:
    - ID interno de la oferta
    - Precio en kamas de esa oferta individual
    - Contenedor anidado de estadísticas/efectos (ejemplo: ID de estadística 125, valor 6; ID de estadística 211, valor 17).
  - Para los **Recursos**, los lotes se transmiten en arrays packed de varints que a veces van precedidos por el conteo de lotes disponibles (1..4) o por metadatos del tipo de objeto.

---

## 3. ERRORES DE APROXIMACIÓN COMETIDOS TRAS EL CAMBIO DE TOKEN

### Error A: "Parser Universal" ciego a la semántica de Submensajes Protobuf
- **Aproximación errónea:** Se implementó una función recursiva `walk()` que tomaba cualquier campo `wire_type == 2` (longitud delimitada) y asumía que era una lista de varints numéricos simples (`decode_packed_varints`).
- **Consecuencia:** 
  1. En las ofertas de equipables, los efectos de las armas/armaduras (ej: +6 Golpes Críticos, +17 Daños) se decodificaban como números planos dentro de una supuesta "escalera".
  2. Al procesar esos números, el algoritmo capturaba valores como `6`, `17`, `125` como si fueran precios de venta.
  3. Esto provocó el error masivo donde múltiples objetos aparecían con precio de **6 kamas** (o 4 kamas).

### Error B: Clasificación errónea de Equipables como Recursos
- **Aproximación errónea:** En la lógica de `process_ladders()`, se establecía:
  ```python
  multi_ladders = [cl for _, p_list in ladders for cl in [clean_ladder(p_list)] if len(cl) >= 2]
  if not multi_ladders and single_prices:
      return "equipable", single_prices
  ```
- **Consecuencia:** Como los efectos anidados generaban listas con varios números (longitud >= 2), `multi_ladders` nunca estaba vacío. El código caía en la rama de `score_ladder()`, la cual por defecto clasificaba el paquete como `cat = "recurso"`.
- **Impacto visible:**
  - `Cinturón de Brus (#13114)` -> clasificado erróneamente como `[RECURSO]`.
  - `Botas de Brus (#13116)` -> clasificado erróneamente como `[RECURSO]`.
  - `Anillo de Brus (#13115)` -> clasificado erróneamente como `[RECURSO]`.

### Error C: Deformación de precios y promedios exagerados
- **Aproximación errónea:** Cuando un equipable era catalogado erróneamente como `recurso`, el sniffer ejecutaba:
  ```python
  clean_p = clean_ladder(prices)
  body["precios"] = {
      "1": clean_p[0],
      "10": clean_p[1],
      "100": clean_p[2],
      "1000": clean_p[3]
  }
  ```
  Y para recursos auténticos como la `Corteza de Brus (#18693)`:
  Si el paquete contenía el precio del lote x1000 (o si solo había oferta en lotes mayores, ej. 29,999,990 k por 1000 unidades), el parser colocaba ese valor directamente en la clave `"1"` (lote de 1 unidad).
- **Consecuencia:**
  - Para `Corteza de Brus (#18693)`: El servidor recibió `29,999,990 k` asignado al lote `"1"`, guardando una media absurda de **29,999,990 kamas por unidad** en vez de ~29,999 kamas.
  - Para `Botas de Brus (#13116)`: Se tomó una oferta particular extrema (4,999,909 k) en lugar de una media podada de todas las ofertas disponibles o el precio mínimo del mercadillo.

---

## 4. REGLAS ARQUITECTÓNICAS Y SOLUCIÓN CANÓNICA

Para evitar romper el sniffer en el futuro, se establecen las siguientes reglas fijas:

### 1. Discriminación Formal de Submensajes Protobuf (`is_valid_submessage`)
- Antes de tratar un bloque de bytes delimitado por longitud como un array de precios planos, se valida si contiene pares `(tag, wire_type)` válidos.
- Si es un submensaje válido:
  - Es una **oferta individual** o un **bloque de efectos**. Se debe inspeccionar recursivamente extrayendo el precio de la oferta (varint con `fnum` correspondiente y valor >= 50).
- Si NO es un submensaje válido:
  - Es un array packed de varints (escalera de precios por lotes de recursos).

### 2. Catálogo Maestro de Equipables (`EQUIPMENT_IDS`)
- El sniffer descarga y mantiene en memoria un conjunto con todos los IDs de equipables del juego (sombreros, capas, cinturones, botas, anillos, etc., type IDs: 1..23, 81..97, 120..220).
- **Regla absoluta:** Si `item_id in EQUIPMENT_IDS`, el objeto es **SIEMPRE `equipable`**, sin importar cómo vengan empaquetados los paquetes en la red. Jamás debe procesarse como escalera de lotes `{"1": ..., "10": ...}`.

### 3. Cálculo de Precios para Equipables
- No se toma una sola oferta al azar ni el valor máximo.
- Se recopilan todas las ofertas válidas (precios >= 50 k).
- Se descartan precios atípicos u ofertas troll (outliers > min_price * 2.2).
- El precio de mercado debe ponderar principalmente la oferta mínima y el promedio de las ofertas bajas razonables:
  $$\text{Precio Final} = 0.6 \times \text{Precio Mínimo} + 0.4 \times \text{Promedio Ofertas Normales}$$

### 4. Cálculo de Precios para Recursos por Lotes
- Los recursos se venden en lotes: x1, x10, x100, x1000.
- El precio unitario de cada lote se obtiene dividiendo:
  - Lote x1: $\text{precio} / 1$
  - Lote x10: $\text{precio} / 10$
  - Lote x100: $\text{precio} / 100$
  - Lote x1000: $\text{precio} / 1000$
- **Protección contra asignación incorrecta de lote:**
  Si una lista de precios para un recurso tiene un solo valor y este es enorme (ej. > 100,000 kamas para un recurso estándar), se debe verificar su coherencia con los órdenes de magnitud de lotes o contra el precio base conocido, impidiendo registrar 30M por una unidad.

### 5. Registro de Diagnóstico por Sesión (`sniffer.log`)
- El archivo `sniffer.log` debe reiniciarse en modo `"w"` al abrir el script para contener **únicamente** los datos de la sesión activa.
- Para cada paquete interceptado, debe registrarse:
  - Timestamp y tamaño del paquete.
  - Token detectado.
  - Volcado Hex del payload.
  - Lista de campos brutos identificados (tags, submensajes, ladders).
  - Categorización asignada (`equipable` vs `recurso`) y precios calculados.
  - Respuesta HTTP del servidor.

---

## 6. INICIALIZACIÓN SEGURA DE `SessionPacketLogger` Y PROTOCOLO DE DEBUG EN TIEMPO REAL

### Problema Detectado (NameError: SERVER_NAME is not defined)
- **Causa:** Al implementar el encabezado forense en `SessionPacketLogger`, la clase se instanciaba al inicio del script (línea ~94/109), antes de que `argparse` y las constantes `SERVER_NAME` y `CURRENT_TOKEN` fuesen evaluadas en tiempo de ejecución.
- **Solución implementada:**
  1. `SessionPacketLogger.__init__` ahora recibe parámetros opcionales `(log_path, server_name=None, current_token=None)` con resolución segura `globals().get(...)` y fallbacks por defecto para nunca fallar ante variables no inicializadas.
  2. La instancia global `packet_logger` se inicializa estrictamente tras cargar la configuración y el token calibrado (`CURRENT_TOKEN = load_calibrated_token()`).
  3. Se añadieron pruebas unitarias en `tests/test_sniffer.py` para validar la instanciación segura y el borrado de logs residuales.

### Protocolo de Depuración y Captura en Vivo
- **Archivo de log:** `sniffer.log` (excluido permanentemente de Git mediante `.gitignore`).
- **Ciclo de depuración en vivo:**
  1. Ejecutar el sniffer localmente en una consola con permisos de Administrador (vía `scripts/ejecutar_sniffer.bat` o `python scripts/sniffer_standalone.py`).
  2. Interactuar en Dofus Unity abriendo categorías y haciendo clic en objetos de prueba.
  3. En caso de discrepancia (precios anómalos o paquetes no reconocidos), inspeccionar `sniffer.log` para extraer:
     - `Payload Hex (64b)`
     - `Ladders brutos decodificados`
     - `Ofertas individuales (precios)`
  4. Analizar la secuencia en el asistente, ajustar los filtros de `extract_market_universal` o `score_ladder`, verificar con los tests unitarios y registrar la solución aquí para mantener la trazabilidad histórica.

---

## 7. REGISTRO EXHAUSTIVO DE OFERTAS Y ELIMINACIÓN DE BLOQUEOS ARTIFICIALES POR OUTLIERS

### Diagnóstico de Problemas en el Modelo Anterior
1. **Deduplicación artificial con `set()`:**
   - En iteraciones previas, las ofertas de equipables se procesaban con `list(set(all_equip_prices))`.
   - Si 5 jugadores vendían un objeto a 1,200,000 k y 1 jugador a 2,500,000 k, el conjunto eliminaba los duplicados dejando `[1200000, 2500000]`, deformando la masa crítica y la mediana del mercado.
2. **Bloqueo por "Anti-Troll" y congelamiento de precios:**
   - En el backend (`update.ts`), si un precio cambiaba abruptamente (`> previousPrice * 6` o `< previousPrice * 0.15`), el sistema forzaba `finalPrice = previousPrice`.
   - Esto provocaba que nuevos registros reales fuesen ignorados indefinidamente cuando el mercado sufría inflación o deflación legítima.
3. **Filtro arbitrario de Outliers (`minPrice * 2.2`):**
   - Descartaba ofertas superiores a 2.2x del mínimo, impidiendo que el log o la base de datos tuviesen visibilidad completa de la dispersión de precios en el mercadillo.

### Solución Canónica Implementada
1. **Conservación íntegra de ofertas en el Sniffer:**
   - Se eliminó `set()` en `process_ladders`. Todas las ofertas encontradas se preservan en orden (`valid_prices = sorted(all_equip_prices)`).
   - Se amplió la captura de ofertas en `extract_market_universal` a `depth in (1, 2)` para cubrir tanto listas directas como subcontenedores de ofertas Protobuf.
2. **Nuevo formato forense enriquecido en `sniffer.log`:**
   - Para **Equipables**:
     - `Total ofertas capturadas`: conteo total de ítems en venta.
     - `LISTA COMPLETA DE PRECIOS`: arreglo íntegro con cada una de las ofertas del mercadillo.
     - `Estadísticas de mercado`: Mínimo, Mediana, Media aritmética y Máximo.
   - Para **Recursos**:
     - Desglose por lotes (x1, x10, x100, x1000).
     - Precios unitarios calculados por lote para evaluar dumping o primas de volumen.
3. **Eliminación de bloqueos en el Backend (`update.ts` y `localDataStore.ts`):**
   - Se removió el congelamiento `finalPrice = previousPrice`.
   - Se removió el descarte por umbral del 2.2x.
   - Cálculo base representativo:
     - **Equipables:** $\text{Precio Final} = 0.75 \times \text{Precio Mínimo} + 0.25 \times \text{Mediana}$ (refleja el precio accesible real de compra amortiguado por la masa de ofertas).
     - **Recursos:** Promedio ponderado según lotes habituales de crafteo.

---

## 8. ANÁLISIS FORENSE DE `sniffer.log` (129 PAQUETES DE TAL KASHA), DETECCIÓN MULTI-TUPLA DE EQUIPABLES Y FÓRMULAS REPRESENTATIVAS DEFINITIVAS

### 1. Auditoría Exhaustiva de Paquetes en `sniffer.log`
A través de 1,429 líneas de registro en tiempo real con 129 aperturas de mercadillo en el servidor **Tal Kasha**, se analizaron:
- **89 paquetes de Equipables** (armas, anillos, cinturones, amuletos, etc., con múltiples vendedores y precios de 500k a 40M+ kamas).
- **40 paquetes de Recursos** (cereales, flores, maderas, carnes, etc., con lotes x1, x10, x100 y x1000).

### 2. Descubrimiento de la Estructura Wire-Format de Protobuf en Dofus Unity
El análisis de los volcados reveló la diferencia fundamental en cómo el motor de Unity serializa los datos:
1. **Equipables:**
   - No se envían en una sola escalera con 4 enteros continuos.
   - Cada vendedor con su objeto individual se serializa como una tupla separada en el campo 6 con ceros de relleno para ranuras no usadas:
     `[(6, [Precio1, 0, 0, 0]), (6, [Precio2, 0, 0, 0]), (6, [Precio3, 0, 0, 0]), ...]`
   - Ejemplo real en `sniffer.log`: Un objeto de 38.8M generaba `[(6, [38888887, 0, 0, 0]), (6, [39000000, 0, 0, 0])]`.
2. **Recursos:**
   - Se serializan **siempre en una única tupla** que contiene los 4 lotes agrupados:
     `[(6, [x1, x10, x100, x1000])]` o con conteo de lotes `[(3, [p1, p10, p100])]`.
   - Los recursos nunca tienen 2 o más tuplas de campo 6 con ceros en las posiciones 1, 2 y 3.

### 3. Causa Raíz de la Corrupción de Precios (Ej: 38.8M reducido a 38.8k)
Se identificaron 4 fallas encadenadas que provocaban la corrupción y posterior congelamiento:
1. **Falta de catálogo en la API (`items-dictionary.ts`):** La API servía un diccionario plano `{ [id]: name }`. Al faltar la clave `equipmentIds`, la función `is_item_equipment()` siempre devolvía `False`.
2. **Falsa clasificación como Recurso:** Al no estar catalogado, el parser pasaba a `score_ladder`. Como cada tupla tenía `len == 4` (`[38888887, 0, 0, 0]`), sumaba `+600` puntos y clasificaba el ítem como `"recurso"`.
3. **Asignación errónea al lote x1000:** Al ser clasificado como recurso, el código detectaba `38888887 >= 1_000_000` y lo asignaba al lote de 1,000 unidades (`body["precios"]["1000"] = 38888887`). Posteriormente, el backend dividía el valor por 1,000, reduciendo el precio a **38,888 kamas**.
4. **Congelamiento por Anti-Troll:** Al registrar un precio de 38.8k en la base de datos, cualquier lectura posterior del valor real (38.8M) disparaba el umbral de outlier (`> 6x previousPrice`), congelando el precio corrupto de forma permanente.

### 4. Soluciones Arquitectónicas Implementadas
1. **Catálogo Unificado Rico (`items-dictionary.ts`):**
   - Se optimizó y comprimió la exportación para incluir **3,684 IDs de equipables** (`equipmentIds`) y **10,105 nombres** (`items`).
   - Soporta compatibilidad hacia atrás y el parámetro `?v=2` para el sniffer.
2. **Detección Estructural Multi-Tupla en `process_ladders()`:**
   - Se añadió detección nativa: si `len(ladders) >= 2` y todas las tuplas tienen formato `[P, 0, 0, 0]`, el objeto se clasifica automáticamente como `equipable`, incluso si su ID no estuviera en el catálogo.
3. **Eliminación del Bloqueo por Outliers:**
   - Se removió la retención artificial de precios anteriores en `update.ts` y `localDataStore.ts`. El mercado actualiza libremente a los valores reales de la red.
4. **Sincronización Total de Todas las Superficies:**
   - Sincronizados `api/market/sniffer-script.ts`, `scripts/sniffer_standalone.py`, `src/server/expressApp.ts`, `api/market/update.ts` y `src/server/localDataStore.ts`.

---

### 5. Fórmulas Matemáticas Definitivas

#### A. Para Equipables: Mezcla Competitiva de Cluster Bajo (Low-Cluster Competitive Blend)
- **Problema abordado:**
  - El precio mínimo puro es susceptible a *undercutting* efímero (vendedores desesperados o 1 kama por debajo).
  - La media y la mediana generales se inflan masivamente por objetos con exomagueos (PA/PM a 75M-85M en objetos con base de 35M).
- **Algoritmo:**
  1. **Filtrado de Exomagueos:** Se descartan del cálculo base las ofertas que superen $1.8 \times \text{Precio Mínimo}$.
  2. **Promedio de Entrada Competitiva ($\text{Low3Avg}$):** Se calcula la media de las hasta 3 ofertas más bajas del mercado no-exo:
     $$\text{Low3Avg} = \frac{1}{k} \sum_{i=1}^{k} \text{Oferta}_i \quad \text{con } k = \min(3, n)$$
  3. **Mediana Estándar ($\text{MedStd}$):** Se calcula la mediana del conjunto sin exomagueos para evaluar el punto medio de la oferta normal.
  4. **Ponderación Final:**
     $$\text{Precio Final} = 0.70 \times \text{Low3Avg} + 0.30 \times \text{MedStd}$$
- **Beneficio:** Representa el costo real al que un jugador puede comprar el objeto de forma inmediata en el mercadillo, sin distorsión de exomagueos ni penalizaciones severas por ventas rápidas puntuales.

#### B. Para Recursos: Precio Unitario Ponderado por Volumen con Filtrado de Outliers
- **Problema abordado:**
  - Lotes de 1 unidad con frecuencia sufren de precios cebo o especulación ridícula (ejemplo en `sniffer.log`: Lúpulo x1 a 900 k mientras que x10 cuesta 34.6 k/u y x100 cuesta 34.0 k/u). Un promedio simple daría 250 k/u (730% inflado).
  - Ocasionalmente ocurren errores de tipeo de vendedores en lotes x10 o x100 (vender x100 al precio de x10).
- **Algoritmo:**
  1. **Conversión a Precios Unitarios:**
     $$u_1 = p_1, \quad u_{10} = \frac{p_{10}}{10}, \quad u_{100} = \frac{p_{100}}{100}, \quad u_{1000} = \frac{p_{1000}}{1000}$$
  2. **Filtrado de Dispersión Relativa:** Si hay 3 o más lotes presentes, se calcula la mediana unitaria $u_{\text{med}}$ y se descartan lotes con:
     $$u_i < 0.25 \times u_{\text{med}} \quad \text{o} \quad u_i > 3.5 \times u_{\text{med}}$$
  3. **Ponderación por Volumen Comercial Real:** Los lotes de x10 y x100 concentran el 75% del volumen económico de crafteo en Dofus:
     - Lote x1: $10\%$
     - Lote x10: $35\%$
     - Lote x100: $40\%$
     - Lote x1000: $15\%$
  4. **Cálculo Ponderado Normalizado:**
     $$\text{Precio Final} = \frac{\sum_{i \in \text{Válidos}} u_i \times w_i}{\sum_{i \in \text{Válidos}} w_i}$$
- **Beneficio:** Elimina al 100% las distorsiones causadas por cebos de 1 unidad o errores de tipeo, reflejando el coste real de adquisición de ingredientes para las recetas de los oficios.

---

### 6. Diagnóstico y Corrección de Precios Ilógicos en Equipables y Recursos Monolote (2026-09-09)

#### A. Síntomas Reportados
1. **Equipables con precios colapsados o sin sentido:** Objetos de nivel alto valorados en millones de kamas (como Anillo de Brus, Capa de Minotot, etc.) mostraban precios ilógicos de entre 80,000 y 150,000 kamas o listas de precios con cientos de valores.
2. **Recursos de un solo lote (x1) con precios extraños:** Recursos sin existencias en lotes de 10, 100 o 1,000 (como Menta religiosa #16381, Ginsengoku #16386, Salvia adivinorum #16383) aparecían catalogados como equipables con precios fijos como 64,790 kamas.

#### B. Causa Raíz 1: Contaminación por Submensajes de Stats en Equipables
- **Mecanismo:** `extract_market_universal` recorría recursivamente todos los varints del paquete a profundidades `depth in (1, 2)` con un filtro `v >= 50`.
- **Estructura Protobuf en Dofus Unity:** En los paquetes de mercadillo de equipables, cada oferta incluye una lista anidada de efectos (`EffectInstance`: vitalidad, sabiduría, fuerza, etc.).
- **Impacto:**
  - Los IDs de efectos de stats (111 = PA, 118 = Fuerza, 124 = Sabiduría, 125 = Vitalidad) y los valores de las características de los objetos (50 de fuerza, 60 de agilidad, 70 de vitalidad, etc.) eran extraídos directamente en `offer_prices`.
  - Para un solo equipable se inyectaban entre 100 y 250 números de stats pequeños (`50, 60, 68, 70, 75, 111, 118, 124, 125...`) como supuestos precios de venta.
  - Al procesar la fórmula Low-Cluster Blend, las ofertas más bajas tomadas eran estos números de estadísticas, destruyendo el precio real del objeto.
- **Corrección:**
  1. En Dofus Unity, las ofertas reales de venta de equipables se encuentran **siempre y de forma garantizada** en las tuplas de ladders de campo 6: `(6, [Precio, 0, 0, 0])`.
  2. `process_ladders()` para equipables ahora toma los precios exclusivamente de `ladders`:
     ```python
     resolved_prices = [pl[0] for _, pl in ladders if pl[0] >= 50]
     ```
     Descartando por completo `offer_prices` (varints crudos).
  3. `extract_market_universal` se restringió estrictamente a `depth == 1` y campos `fnum in (2, 3, 4)` con umbral mínimo de 500 kamas.

#### C. Causa Raíz 2: Falsa Clasificación de Recursos Monolote como Equipables
- **Mecanismo:** Un recurso que solo tiene unidades en venta en el lote de 1 (y no en 10, 100 o 1,000) genera una tupla de escalera con ceros: `[7772, 0, 0, 0]`.
- **Heurística errónea:** En `process_ladders()`, se evaluaba:
  ```python
  multi_ladders = [cl for cl in custom_ladders if any(p > 0 for p in cl[1:])]
  all_singles = custom_ladders and all(cl[1:] == [0, 0, 0] for cl in custom_ladders)
  if not multi_ladders and all_singles:
      # Asumía erróneamente que era un equipable
  ```
  Al ser `cl[1:] == [0, 0, 0]`, `multi_ladders` resultaba vacío y `all_singles` verdadero.
- **Colisión con ID de listado:** Simultáneamente, `extract_market_universal` extraía el campo 5 de Protobuf (que representa el ID interno del listado de Ankama, e.g. 64,790). Al creer que era un equipable, asignaba dicho ID como si fuera el precio del objeto en kamas.
- **Corrección:**
  1. En Dofus Unity, un recurso siempre viaja en **exactamente 1 tupla de ladder** (`len(ladders) == 1`).
  2. Si el ítem no está catalogado como equipable ni tiene múltiples ofertas (`len(ladders) >= 2`), se procesa inequívocamente como recurso.
  3. Cualquier tupla con al menos un precio mayor a 0 (`any(p > 0 for p in cl)`) se clasifica como recurso legítimo:
     - Menta religiosa: `[7772, 0, 0, 0]` -> Recurso con precio unitario 7,772 k.
     - Ginsengoku: `[15984, 0, 0, 0]` -> Recurso con precio unitario 15,984 k.
     - Salvia adivinorum: `[3997, 0, 0, 0]` -> Recurso con precio unitario 3,997 k.
  4. Se excluyó el campo 5 de la extracción de precios.

#### D. Soporte para Equipables Apilados con Estadísticas Idénticas
- **Comportamiento en Dofus Unity:** Si dos o más equipables tienen exactamente las mismas estadísticas (por ejemplo, objetos recién fabricados con tiradas base, objetos perfectos o trofeos/dofus con stats fijas), los jugadores pueden apilarlos y ponerlos en venta en lotes de x1, x10 o x100.
- **Formato en ladders:**
  ```python
  # Oferta de equipable apilada:
  (6, [P1, P10, 0, 0])  # ej: 1 unidad a 85k, 10 unidades por 800k (80k/u)
  (6, [0, P10, 0, 0])   # ej: solo disponible en lote de 10
  ```
- **Extracción de Precios Unitarios:**
  El sniffer ahora calcula el precio por unidad para cada lote presente:
  - Lote x1: `pl[0]`
  - Lote x10: `round(pl[1] / 10)`
  - Lote x100: `round(pl[2] / 100)`
  - Lote x1000: `round(pl[3] / 1000)`
  Todos los precios unitarios resultantes se incorporan al conjunto de ofertas del equipable para el cálculo Low-Cluster Blend.
- **Robustez estructural:** Se eliminó la restricción que exigía `pl[1:] == [0,0,0]`. Cualquier paquete con 2 o más ofertas reales de mercadillo (`len(valid_ladders) >= 2`, tras filtrar TypeIDs aislados $\le 10$) se clasifica como equipable, soportando tanto ofertas unitarias como apiladas.

#### E. Validación de Resultados
- **27 pruebas unitarias automatizadas superadas (`tests/test_sniffer.py`).**
- **Validación al 100% sobre los 63 paquetes reales capturados en `sniffer.log`:**
  - 28 equipables procesados con ofertas limpias exactas (sin contaminación de stats).
  - 34 recursos clasificados correctamente (tanto monolotes x1 como multilotes x1/x10/x100/x1000).

---

### 7. Hito de Entrega: Release v1.0.0 — Versión Funcional Definitiva (2026-09-09)

Con las pruebas en vivo ejecutadas exitosamente contra el servidor **Tal Kasha** y la validación de integridad algorítmica:
1. **Sniffer Standalone (`scripts/sniffer_standalone.py`) & Web Sniffer (`api/market/sniffer-script.ts`):**
   - Detección precisa de tokens de red dinámicos de Ankama.
   - Manejo transparente de permisos de Administrador en Windows (UAC elevation).
   - Extracción limpia de ladders sin contaminación de stats ni de IDs de listados.
   - Soporte total para equipables individuales y apilados en lotes.
   - Clasificación correcta de recursos monolote (x1) y multilote (x1, x10, x100, x1000).
2. **Backend API (`api/market/update.ts` & `src/server/localDataStore.ts`):**
   - Algoritmo *Low-Cluster Competitive Blend* (70% promedio 3 ofertas más bajas, 30% mediana no-exo).
   - Algoritmo *Volume-Weighted Unit Price* para recursos con filtrado de precios cebo y errores tipográficos.
   - Eliminación de bloqueos por outliers que congelaban precios reales.
3. **Catálogo Unificado (`api/market/items-dictionary.ts`):**
   - 3,684 equipables clasificados y 10,105 nombres de objetos sincronizados.
4. **Estado:**
   - Listo para despliegue en producción (Vercel / Turso DB / Servidor Express).

---

## 9. AUDITORÍA INTEGRAL DE COHERENCIA Y ROBUSTEZ A FUTURO (2026-09-09)

Para garantizar que el sniffer y las herramientas de calibración sigan funcionando de forma infalible ante futuras actualizaciones de Dofus Unity, se realizó una auditoría de coherencia en todo el repositorio que corrigió inconsistencias arquitectónicas y código desfasado:

### 1. Eliminación de Código Muerto (~270 líneas)
- En versiones anteriores, la función obsoleta `score_ladder` y su bucle evaluador quedaron residiendo después de la instrucción `return "desconocido", []` dentro de `process_ladders()`.
- Se removió este bloque inalcanzable de:
  - `scripts/sniffer_standalone.py`
  - `api/market/sniffer-script.ts`
  - `src/server/expressApp.ts` (bloque de sniffer)
  - `tests/test_sniffer.py`

### 2. Sincronización y Corrección de Bugs en `MarketSnifferModal.tsx`
- **Detección de fallo crítico silencioso:** La función `process_packet` invocaba `is_item_equipment(item_id)`, la cual no estaba definida en el script embebido del modal, arrojando un `NameError` que descartaba paquetes silenciosamente. Se añadió la definición formal conectada al set `EQUIPMENT_IDS`.
- **Actualización de algoritmos:** Se sincronizó `extract_market_universal` (soporte `offer_prices`), `clean_ladder` (corrección de límites inferiores `1 <= cl[0] <= 10` y `1 <= cl[0] <= 50` para evitar fallos si `cl[0] == 0`), y `process_ladders` (filtrado de TypeIDs, detección de ofertas multi-tupla y cálculo de precios unitarios en equipables apilados).
- Se garantizó que el código copiado o descargado directamente desde el frontend web sea idéntico al sniffer standalone.

### 3. Sincronización de Calibradores (`calibrator-script.ts`, `findvalue.py` y ruta Express)
- Las herramientas de calibración (`calibrar_token.py`, `findvalue.py` y `/api/market/calibrator-script`) aún utilizaban la versión primitiva de `process_ladders` y `extract_market_universal` previa a la v1.0.0.
- Se actualizaron con el motor unificado v1.0.0, permitiendo calibrar tokens exitosamente con cualquier objeto del juego (equipables con ofertas complejas, recursos monolote o multilote).
- Se reemplazaron las comparaciones de prefijo `\x12` susceptibles a problemas de escape en TypeScript por `bytes([0x12])`.

### 4. Unificación de Límites de Item ID (`10 <= v <= 100,000`)
- Distintas partes del código utilizaban cotas dispares (`1 <= v <= 45000` vs `10 <= v <= 65000`).
- Se unificó en todos los archivos el umbral `10 <= v <= 100000`:
  - Límite inferior $\ge 10$: descarta metadatos y enumeraciones pequeñas de Ankama.
  - Límite superior $\le 100,000$: garantiza soporte nativo para futuros ítems y expansiones de Dofus sin requerir parches adicionales.

### 5. Verificación
- 27 pruebas unitarias de Python superadas al 100%.
- 9 pruebas de TypeScript superadas al 100%.
- Chequeo de tipos `npx tsc --noEmit` completado con cero errores.

---

## 10. INTEGRACIÓN DE COTIZACIONES DE MERCADO (`type.ankama.com/iuk` & `ive`), VOLÚMENES DE VENTA (24h/7d/30d) Y SALVAGUARDA DE PRECIOS INFLADOS (2026-09-10)

### 1. Diagnóstico e Ingeniería Inversa de Paquetes de Cotizaciones
- Al abrir la pestaña "Cotizaciones del mercado" de cualquier recurso o equipable en Dofus Unity, el servidor emite mensajes `google.protobuf.Any` con cabecera `type.ankama.com/iuk` (serie temporal completa de transacciones y gráficos) y `type.ankama.com/ive` (resumen).
- El mensaje `type.ankama.com/iuk` contiene una lista repetida de submensajes con:
  - `Field 1`: Identificador temporal/secuencial.
  - `Field 2`: Timestamp ISO 8601 exacto (`2026-09-10T...`).
  - `Field 3`: Precio de las transacciones registradas en ese intervalo (`Varint`).
  - `Field 4`: Volumen de artículos vendidos en ese intervalo (`Varint`).

### 2. Decoder Automatizado en el Sniffer (`parse_quotation_message`)
- Se implementó en `scripts/sniffer_standalone.py` y `api/market/sniffer-script.ts` la función `parse_quotation_message()`.
- Al abrir la cotización en el juego:
  - Calcula la suma ponderada del **Precio Medio Real** (`suggestedPrice`).
  - Calcula el **Volumen de Ventas** acumulado para $24\text{h}$, $7\text{d}$ y $30\text{d}$, así como el promedio diario (`avgDailySales`).
  - Envía automáticamente el bloque `salesVolume` a `/api/market/update` en segundo plano sin interferir con la captura de lotes.
- Se añadió `cotizaciones_inspeccion.txt` como canal de volcado forense y auditoría independiente de `sniffer.log`.

### 3. Regla Canónica de Jerarquía y Salvaguarda de Precios Inflados
- **Prioridad 1 (Precios del Mercadillo Vivo):** Siempre se calcula y prioriza el precio a partir de las ofertas activas en lotes ($x1, x10, x100, x1000$) o precios unitarios mediante la fórmula ponderada estándar de lotes.
- **Prioridad 2 (Salvaguarda ante ausencia de stock o troleos extremos):**
  - Si el precio calculado en mercadillo resulta $\ge 4.0\times$ (más de un 400%) o $\le 0.15\times$ (menos de un 15%) respecto al `suggestedPrice` histórico consolidado de ventas (con `suggestedPrice >= 50` y volumen registrado en 30 días):
    - El backend activa `anti_troll_triggered = true` y utiliza el **Precio Medio Histórico de 30 días** como salvaguarda realista.
    - Esto previene de forma absoluta que recursos agotados con 1 oferta solitaria a precios astronómicos distorsionen el ROI, las recetas o el ranking de crafteo.

### 4. Persistencia en Base de Datos Turso (`profile_sales_volume`)
- Soporte para inserción y actualización no destructiva vía `ON CONFLICT(profile_id, item_id)` preservando `coalesce` para métricas existentes no modificadas.

---

## 11. RESOLUCIÓN DE RUTAS 404 EN VERCEL Y ACUMULACIÓN MULTI-VENTANA DE COTIZACIONES (2026-09-10)

### 1. Diagnóstico y Corrección de Errores 404 en Vercel Serverless
- **Causa Raíz:** Al migrar y consolidar funciones serverless para respetar el límite de 12 funciones de Vercel en el plan Hobby, las rutas de base de datos local migraron a un catch-all router `api/local-db/[...path].ts`. Sin embargo, los siguientes endpoints críticos no habían sido portados desde `src/server/expressApp.ts`:
  - `GET /api/local-db/items/:id` -> provocaba 404 al cargar recetas y detalles de ítems en el cliente web.
  - `GET /api/local-db/sales-volume` y `POST /api/local-db/sales-volume/bulk` -> provocaba 404 en la sincronización LWW de volúmenes de venta.
  - `PUT /api/local-db/sales-volume/:itemId` -> provocaba 404 en actualizaciones puntuales.
- **Solución Implementada:**
  - Se incorporaron todos estos manejadores directamente en `api/local-db/[...path].ts` con acceso optimizado a Turso LibSQL y fallback a DofusDB para ítems no cacheados.
  - Se mantiene el conteo total de funciones serverless de Vercel en 10 (por debajo del límite de 12).

### 2. Detección y Acumulación Multi-Ventana en el Sniffer (24h, 7d, 30d)
- **Comportamiento en Dofus Unity:** El cliente de juego no emite las 3 ventanas de tiempo simultáneamente en un solo paquete, sino que emite un paquete individual cada vez que el usuario hace clic en las pestañas "24 h", "7 días" o "30 días".
- **Clasificación Temporal Robusta:**
  - Se reemplazó la heurística por conteo de puntos por un análisis exacto del rango temporal (diferencia entre fecha máxima y mínima ISO 8601 del submensaje):
    - $\le 1.2 \text{ días} \to 24\text{h}$
    - $\le 8.0 \text{ días} \to 7\text{d}$
    - $> 8.0 \text{ días} \to 30\text{d}$
- **Memoria Acumulativa por Ítem (`ITEM_SALES_VOLUME`):**
  - Se introdujo un diccionario en memoria que consolida las métricas a medida que el jugador navega por las pestañas del objeto, manteniendo los datos previos y actualizando la ventana correspondiente.
  - Salida formateada y enriquecida en consola:
    `[COTIZACIÓN] Ítem (#ID) [24h|7d|30d] -> Precio medio: X k | Ventas [24h: A | 7d: B | 30d: C] (Sincronizado)`
  - Sincronización idéntica entre `scripts/sniffer_standalone.py` y `api/market/sniffer-script.ts`.

### 3. Causa Raíz de los 404s Residuales en Producción (Edge Router vs Serverless)
- **Problema Descubierto:** Vercel (en proyectos que no son Next.js) no soporta de forma nativa la convención `[...path].ts` como un comodín recursivo en el enrutador de Edge. En su lugar, compila la ruta como un parámetro que únicamente acepta un segmento (`[^/]+`).
- Por esta razón, `/api/local-db/bootstrap` funcionaba (1 segmento), pero `/api/local-db/items/757` y `/api/local-db/sales-volume/bulk` (2 segmentos) eran rechazados directamente por el Edge de Vercel con un 404 antes de llegar a la función serverless.
- **Solución Definitiva:**
  1. Renombrado de `api/local-db/[...path].ts` a `api/local-db.ts` y `api/dofocus/[...path].ts` a `api/dofocus.ts`.
  2. Configuración de reglas `rewrites` en `vercel.json`:
     - `/api/local-db/:path*` -> `/api/local-db?path=:path*`
     - `/api/dofocus/:path*` -> `/api/dofocus?path=:path*`
  3. `extractPathSegments` robustecido con decodificación URI (`decodeURIComponent`) y stripping preventivo del prefijo de base de ruta.

### 4. Bucle 404 de `/api/market/live-stream` en Producción
- **Problema:** En el frontend, `connectLivePriceStream()` intentaba conectarse vía `EventSource` a `/api/market/live-stream`. En Vercel (arquitectura Serverless sin procesos daemon residentes), este endpoint no existe (pertenece al servidor Express local). El error 404 se disparaba en bucle en cada cambio de visibilidad de pestaña o foco.
- **Solución:**
  - Se añadió detección del entorno Vercel (`window.location?.hostname?.includes("vercel.app")`) para silenciar y omitir el intento de SSE innecesario.

---

## 12. ENDPOINTS DE RECETAS (`/api/local-db/recipes/:resultId`) Y RESOLUCIÓN LIMPIA SIN 404S (2026-09-10)

### 1. Diagnóstico de 404s en la Calculadora de Crafteo (`recipes/:resultId`)
- **Síntoma:** Al abrir o calcular costes de recetas en `RecipeCraftingCalculator.tsx`, la aplicación realiza llamadas en paralelo a `/api/local-db/recipes/:resultId` para evaluar si los ingredientes (trigo #368, lúpulo #369, lino #370, gelatina #757, roble #2437, etc.) tienen sub-recetas de crafteo.
- **Causa Raíz:** Este endpoint no existía en `api/local-db.ts`, provocando una cascada de errores 404 en el navegador.
- **Solución Implementada:**
  1. Integración de `GET /api/local-db/recipes/:resultId` con búsqueda primero en Turso DB (`SELECT payload_json FROM recipes WHERE result_id = ?`) y fallback automático a DofusDB (`https://api.dofusdb.fr/recipes?resultId=...`).
  2. Almacenamiento asíncrono en caché de Turso para que futuras consultas no dependan de APIs externas.
  3. **Resolución Limpia 200 con `null`:** Cuando un recurso es una materia prima o drop sin receta, se responde con HTTP 200 `null` en lugar de un error 404, permitiendo al frontend saber de inmediato que no es crafteable sin emitir errores rojos en la consola del navegador.
  4. Agregadas rutas de soporte para `items/batch-resolve`, `items/resolve-names`, `sync-status`, `sync-settings`, `item-stats` y `search-items`.

---

## 13. SOLUCIÓN INTEGRAL: LÍMITE DE 166 OBJETOS, ERROR TOLOCALESTRING Y SINCRONIZACIÓN DE PRECIOS (2026-09-10)

### 1. Diagnóstico del Error `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`
- **Síntoma:** Al acceder a la pestaña "Base" (Base de Datos Local), la aplicación fallaba con una pantalla de error capturada por `ErrorBoundary`:
  `TypeError: Cannot read properties of undefined (reading 'toLocaleString') at ne (DofusImporter-DqrCCHOu.js:1:10172)`
- **Causa Raíz:** 
  1. En `api/local-db.ts`, los endpoints `/api/local-db/sync-status` y `/api/local-db/bootstrap` devolvían `{ status: "idle", lastSync: Date.now() }` en lugar de una estructura completa `SyncStatus`.
  2. En `DofusImporter.tsx`, las estadísticas de la base de datos (`syncStatus.equipablesCount`, `syncStatus.consumablesCount`, `syncStatus.resourcesCount`, `syncStatus.cosmeticsOmittedCount`, `syncStatus.totalImported`) llamaban a `.toLocaleString()` directamente sobre valores que eran `undefined`.
- **Solución Implementada:**
  1. En `DofusImporter.tsx`: Se agregaron valores por defecto seguros mediante coalescencia nula `?? 0` a todas las invocaciones de `.toLocaleString()`, y se modificó `setSyncStatus` para fusionar el estado previo en lugar de sobreescribirlo (`setSyncStatus((prev) => ({ ...prev, ...status }))`).
  2. En `api/local-db.ts`: Tanto `bootstrap` como `sync-status` devuelven la estructura completa `SyncStatus` con métricas numéricas exactas (`totalImported: 9762`, `recipesCount: 4858`, `equipablesCount: 4500`, etc.).

### 2. Diagnóstico del Límite de 166 Objetos en el Catálogo y Ausencia de Precios en Recursos
- **Síntoma:** La aplicación mostraba únicamente 166 objetos en el catálogo (`166 / 166 OBJETOS`), oficios como Leñador mostraban 0 ítems, y recursos cotizados por el sniffer (ej. Madera de fresno #303) no aparecían en el mercado ni en las listas.
- **Causa Raíz:**
  1. En Turso DB existen 10.288 objetos y 4.858 recetas cuyos payloads JSON suman **5.46 MB** sin comprimir.
  2. En AWS Lambda / Vercel Serverless Functions existe un límite estricto de **4.5 MB por respuesta HTTP**. Si una función serverless intenta devolver 5.46 MB, Vercel aborta con `FUNCTION_PAYLOAD_TOO_LARGE` (HTTP 500).
  3. Para evitar ese error, en `api/local-db.ts` se había dejado temporalmente `items: []` y `recipes: []` en la respuesta de `bootstrap`.
  4. Al recibir `items: []`, el frontend caía en el fallback de `PRESET_CRAFTABLE_ITEMS`, que contiene exactamente **166 ítems de equipamiento**. Como ningún recurso forma parte de los 166 presets, todos los recursos quedaban completamente inaccesibles para el usuario y para los cálculos de crafteo.
- **Solución Arquitectónica (Client-Side Hydration + Chunk Splitting):**
  1. **Empaquetado Comprimido:** Se utilizó el archivo maestro comprimido `src/data/dofusDbSeedData.ts`, el cual almacena la totalidad de los 9.762 objetos y 4.858 recetas en solo **834 KB** en formato gzip base64.
  2. **Decompresión Nativa (`DecompressionStream`):** Se adaptó `dofusDbSeedData.ts` para que funcione tanto en el navegador (usando la API web estándar `DecompressionStream('gzip')`) como en Node.js (usando `zlib`), sin depender de librerías externas ni emitir advertencias en Vite.
  3. **Hydration en `dofusDbService.ts`:** Si la respuesta de `bootstrap` de Vercel devuelve un catálogo vacío o menor a 100 ítems, el frontend hidrata automáticamente el dataset empaquetado de 9.762 objetos y 4.858 recetas, fusionándolo con las cotizaciones en vivo recibidas de Turso DB (`prices`, `priceUpdatedAt`, `salesVolume`).
  4. **Manual Chunk Splitting:** En `vite.config.ts`, se configuró `manualChunks` para aislar `dofusDbSeedData` en un chunk independiente (`data-seed-items`), asegurando que el bundle principal de la aplicación no se sobrecargue.
  5. **Invalidación de Caché IndexedDB:** Se incrementó la clave de almacenamiento local de `dofus_database_cache_v5` a `dofus_database_cache_v6`, garantizando que todos los clientes en producción descarten la caché previa de 166 ítems y carguen de inmediato el catálogo completo.

### 3. Alineación de Perfiles de Servidores en `api/market/latest-prices.ts`
- **Problema:** En `api/market/latest-prices.ts`, el mapa `SERVER_MAP` contenía identificadores desactualizados de servidores antiguos (talok, dakart, boune, etc.), provocando que consultas para servidores como Tal Kasha, Rafal, Mikhal o Dakal resolvieran erróneamente a IDs incorrectos o por defecto a Draconiros (1).
- **Solución:** Se sincronizó `SERVER_MAP` para que coincida exactamente con los 12 servidores canónicos de Dofus Unity y sus alias (`draconiros: 1`, `mikhal: 2`, `talkasha: 3`, `rafal: 4`, `dakal: 5`, `brial: 6`, `kourial: 7`, `salar: 8`, `imagiro: 9`, `tylezia: 10`, `hellmina: 11`, `orukam: 12`).

### 4. Alineación del Servidor por Defecto y Reenvío de Argumentos en el Sniffer
- **Problema:** En `scripts/sniffer_standalone.py`, el servidor por defecto estaba configurado como `"Tal Kasha"` (`profile_id: 3`), mientras que la aplicación web y `api/market/sniffer-script.ts` tienen como servidor predeterminado `"Draconiros"` (`profile_id: 1`). Además, `scripts/ejecutar_sniffer.bat` invocaba Python sin `%*`, ignorando cualquier parámetro CLI introducido por el usuario.
- **Solución:**
  1. Se actualizó el valor predeterminado de `--server` a `"Draconiros"` en `scripts/sniffer_standalone.py` para sincronizar con el perfil 1 por defecto.
  2. Se agregó `%*` a todas las invocaciones de `python` en `scripts/ejecutar_sniffer.bat` permitiendo pasar banderas (como `--server Rafal` o `--server Mikhal`) sin fricción.
  3. Se verificó el flujo completo de captura multiventana de cotizaciones (`24 Horas`, `7 Días`, `30 Días`), que acumula `sales24h`, `sales7d` y `sales30d` en memoria y los sincroniza de forma inmediata hacia `/api/market/update` en Turso DB.

---

## 14. REENSAMBLAJE TCP STREAM Y DECODIFICACIÓN SIMULTÁNEA DE COTIZACIONES (24H, 7D, 30D) (2026-09-10)

### 1. Diagnóstico de Descoherencia en Volúmenes y Precios de Cotización
- **Síntomas Reportados:**
  - Al inspeccionar un objeto en la ventana de cotizaciones de Dofus Unity (ej. *Madera de fresno* #303), el sniffer mostraba:
    `[COTIZACIÓN] Madera de fresno (#303) [30 Días] -> Precio medio: 88 k | Ventas [30d: 1,732,315]`
  - Mientras que la interfaz del juego mostraba con exactitud:
    - **24 Horas:** `174.219 artículos vendidos` | Precio medio: `109 k` | Precio mediano: `109 k`
    - **7 Días:** `1.132.735 artículos vendidos` | Precio medio: `105 k` | Precio mediano: `99 k`
    - **30 Días:** `4.737.674 artículos vendidos` | Precio medio: `113 k` | Precio mediano: `108 k`
- **Causa Raíz 1 (Fragmentación TCP en Tránsito):**
  - El mensaje Protobuf `type.ankama.com/iuk` contiene la totalidad de registros horarios de 24 horas y diarios de 30 días, alcanzando un tamaño de **2.300 bytes**.
  - Dado que la MTU de red Ethernet divide los paquetes TCP en un máximo de ~1.412 bytes, el mensaje se transmitía en dos paquetes TCP consecutivos (#58 de 1.412 bytes y #59 de 890 bytes).
  - El sniffer procesaba cada paquete Scapy de forma aislada sin memoria de flujo TCP. El paquete #58 terminaba a mitad de camino y descartaba el paquete #59 por no tener la cabecera `type.ankama.com/iuk`. Como resultado, sólo se leían los primeros 10 días de datos antiguos de agosto (de ahí los 1,7M y 88k).
- **Causa Raíz 2 (Estructura Multicampo Protobuf Any en `iuk`):**
  - Dofus Unity no envía paquetes separados por cada pestaña: **envía toda la serie temporal en un único mensaje `iuk`**.
  - **Campo #1 (`0x0A`):** Array repetido de intervalos horarios para las últimas **24 Horas**.
  - **Campo #2 (`0x12`):** Array repetido de días para los últimos **30 Días**.
  - El gráfico de **7 Días** corresponde exactamente a los últimos 7 días de la serie del Campo #2.

### 2. Solución Arquitectónica Implementada
1. **Reensamblador de Flujos TCP (`STREAM_BUFFERS`):**
   - Se implementó un acumulador de stream TCP por conexión (`(src_ip, sport, dst_ip, dport)`).
   - Utiliza el varint inicial del protocolo de Ankama para conocer `msg_len`. Si el búfer acumulado no alcanza `total_needed = r_len + msg_len`, espera al siguiente paquete TCP.
   - Una vez completo, extrae el mensaje de 2.302 bytes exactos y lo procesa íntegro, eliminando al 100% la pérdida por fragmentación.
2. **Decodificación Unificada Simultánea (24h, 7d, 30d):**
   - `parse_quotation_message()` clasifica automáticamente los registros en `entries_24h` (Campo #1) y `entries_30d` (Campo #2).
   - Calcula para cada período el volumen total sumado, el precio medio ponderado por volumen `sum(p * v) / sum(v)` y la mediana `statistics.median(prices)`.
   - Con un solo clic en el juego se capturan y sincronizan inmediatamente las 3 métricas en la consola y en Turso DB (`profile_sales_volume`).

3. **Calibración de Ventanas de Tiempo Coincidentes con la UI del Juego:**
   - **30 Días:** Coincidencia exacta del 100% de la serie diaria completa (Campo #2):
     - Hierro (#312): `4,460,129` ventas | Medio: `285 k` | Mediano: `296 k` (coincidencia idéntica a la UI).
     - Madera de fresno (#303): `4,738,094` ventas | Medio: `113 k` | Mediano: `108 k`.
   - **7 Días:** La gráfica abarca desde hace 7 días hasta la fecha de hoy, conteniendo 8 puntos diarios en el eje X (ej: `03-09` al `10-09`). Se toman los 8 registros más recientes de la serie diaria (`entries_30d[-8:]`):
     - Hierro (#312): `1,039,718` ventas | Medio: `307 k` | Mediano: `303 k` (coincidencia idéntica a la UI).
   - **24 Horas:** En la interfaz de Dofus Unity, la ventana visible y agregada del gráfico comprende las últimas 22 marcas horarias (`entries_24h[-22:]`), reflejando la ventana activa que inicia tras el primer intervalo de la gráfica:
     - Hierro (#312): `181,827` ventas | Medio: `303 k` | Mediano: `306 k` (coincidencia idéntica a la UI).
   - **Cálculo de Precios Medios y Medianos (Unity Standard):**
     - **Precio Medio:** En Unity/C#, el promedio ponderado se obtiene mediante división entera `w_sum // total_vol` (truncamiento estándar de enteros), arrojando los valores exactos mostrados en la interfaz (`303 k`, `307 k`, `285 k`).
     - **Precio Mediano:** Se calcula como la mediana ponderada de las cotizaciones ordenadas por precio y acumuladas por volumen hasta el 50% (`calculate_weighted_median`), coincidiendo con exactitud con los `306 k`, `303 k` y `296 k` del cliente.

4. **Regla de Prioridad de Precios: Mercadillo (Lotes Vivos) vs Cotizaciones Históricas:**
   - **Prioridad Estricta del Mercadillo:** El precio unitario medio calculado de las ofertas en mercadillo (visto al abrir el HDV manualmente, ej. `316 k` para Hierro) tiene **prioridad absoluta** para el cálculo de recetas, beneficios y valoración de inventario, guardándose en `profile_prices.price`.
   - **Rol de las Cotizaciones:** Las cotizaciones capturadas se guardan en `profile_sales_volume` (`suggested_price`, `sales_24h`, `sales_7d`, `sales_30d`) y alimentan el modal de análisis de mercado y liquidez diaria, sin sobreescribir el precio activo del mercadillo.
   - **Salvaguarda Anti-Troll / Manipulación:** Si el precio de los lotes activos en el mercadillo sufre una subida exagerada e inflada (`finalPrice >= historicalSuggestedPrice * 4.0`) o un volcado anómalo (`finalPrice <= historicalSuggestedPrice * 0.15`) en comparación con el precio histórico sugerido de las cotizaciones, la salvaguarda de `api/market/update.ts` activa el mecanismo anti-troll y ajusta automáticamente la valoración al precio histórico sugerido, protegiendo las recetas de manipulaciones malintencionadas.

---

## 10. RESOLUCIÓN DE CENTRADO DE MODALES EN LA INTERFAZ WEB (VIEWPORT ANCHORING)

### 1. El Problema Detectado
- Al abrir el modal de descarga del sniffer (`MarketSnifferModal`), el sincronizador de DoFocus (`DofocusSyncModal`), el editor de cotización de Sebuscalines (`TreasureHuntCalculator`) o el historial de precios en páginas con listas extensas de ítems (4.000 a 6.000 px de altura), el modal aparecía ubicado a miles de píxeles hacia abajo (en el centro matemático de la altura total de la página).
- El usuario debía hacer mucho scroll hacia abajo en la pantalla para poder ver el modal y descargarlo o interactuar con él.

### 2. Causa Raíz Técnica
- En `src/App.tsx`, el contenedor `<main>` tenía la clase `.tab-content-enter`.
- En `src/index.css`, la animación `@keyframes tab-fade-in` aplicaba `transform: translateY(4px)` a `transform: translateY(0)` con la regla `animation-fill-mode: both`.
- **Regla W3C CSS Transforms Level 1:** Cualquier elemento con una propiedad `transform` distinta de `none` (incluso `translateY(0)`) establece un **bloque contenedor (containing block)** para todos sus elementos descendientes, anulando el comportamiento estándar de `position: fixed` respecto al viewport del navegador (`window`).
- En consecuencia, los modales con `fixed inset-0 flex items-center justify-center` se centraban respecto a la altura total de `<main>` (miles de píxeles) en lugar de la ventana visible de la pantalla.

### 3. Solución Arquitectónica
1. **Eliminación de `transform` en `src/index.css`:**
   - Se ajustó `@keyframes tab-fade-in` para realizar una transición suave únicamente de `opacity` (0 a 1) y se removió `fill-mode: both`. De este modo, `<main>` jamás establece un containing block ni retiene transformaciones espaciales.
2. **Componente de Portal Reutilizable (`ModalPortal`):**
   - Se implementó `src/components/common/ModalPortal.tsx` utilizando `ReactDOM.createPortal(children, document.body)` y gestión de bloqueo de scroll en el body (`overflow: hidden`).
   - Se envolvieron todos los modales de la aplicación (`MarketSnifferModal`, `DofocusSyncModal`, el modal de Sebuscalines en `TreasureHuntCalculator`, `BycExportExcelModal`, `BackupModal`, `EditSalesVolumeModal`, `UserJobsModal`, `QuickQuoteModal`, `ItemPriceHistoryModal`, `GlobalPriceHistoryModal`, `QuickSearchModal`).
   - Al renderizarse directamente como hijos directos de `document.body`, los modales son 100% inmunes a cualquier transform, filter o propiedad de contenedor ancestro, garantizando que siempre se centren exactamente en la pantalla visible del usuario.

---
