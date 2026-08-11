# DofusDB HDV

Aplicación web para importar datos de **DofusDB**, gestionar precios manuales de mercadillo y calcular rentabilidad de crafteo para objetos de Dofus.

## Resumen ejecutivo

Hoy el proyecto funciona como un **frontend React + un servidor Express ligero con base de datos local en archivo**.

Su propósito actual es:

- importar items y recetas desde la API pública de DofusDB,
- persistir esos datos en una base local SQLite,
- permitir cargar precios manuales de mercadillo,
- calcular costos, ROI y profit por receta,
- mostrar rankings globales de rentabilidad.

## Lo que hace actualmente

### 1) Importa el catálogo desde DofusDB

El importador descarga:

- items desde `https://api.dofusdb.fr/items`
- recetas desde `https://api.dofusdb.fr/recipes`

Durante la importación:

- normaliza nombres en español,
- intenta unificar formatos de datos distintos,
- omite cosméticos, apariencias y ciertos items no útiles para economía,
- guarda items y recetas para reutilizarlos después.

### 2) Guarda la información en una base de datos local

La persistencia actual usa un archivo SQLite local:

- [data/dofus-local.db](./data/dofus-local.db)

Se mantiene además una caché en memoria del frontend para no pedir los mismos datos en cada render.

Actualmente se guardan en esa base:

- items importados
- recetas importadas
- precios de mercadillo
- perfiles privados y por servidor
- metadata de sincronización

### 3) Permite gestionar precios manuales

La pestaña de precios permite:

- buscar items importados,
- trabajar con un perfil privado y perfiles por servidor de Dofus Unity,
- asignar o editar precios manualmente,
- ver la fecha de la última actualización de precio al pasar el mouse,
- filtrar por categorías y oficios,
- exportar precios a JSON,
- exportar la base SQLite completa,
- importar precios desde JSON,
- limpiar precios guardados.

### 4) Calcula costos y rentabilidad

La calculadora de recetas permite:

- seleccionar recetas crafteables,
- construir árboles de subcrafteo,
- comparar costo de compra vs costo de fabricar,
- calcular profit neto y ROI,
- optimizar decisiones de compra/crafteo en ramas intermedias.

Soporta modos lógicos como:

- compra directa de ingredientes,
- subcrafteo completo,
- optimización automática,
- modo híbrido manual.

### 5) Muestra ranking global de profit

La vista de ranking toma las recetas disponibles y ordena resultados según:

- beneficio neto,
- ROI,
- costo,
- precio de venta.

### 6) Expone un backend Express básico

El servidor en [server.ts](./server.ts) hace estas funciones:

- servir la app en desarrollo y producción,
- exponer endpoints proxy hacia DofusDB,
- exponer endpoints simplificados para items, item-types y effects,
- proteger el acceso con `express-basic-auth`.

## Arquitectura actual

### Frontend

La aplicación principal está en:

- [src/App.tsx](./src/App.tsx)
- [src/components/](./src/components)

Pantallas activas en la navegación:

- **Calculadora de Recetas**
- **Ranking Global de Profit**
- **Precios de Mercadillo**
- **Sincronizar DofusDB**

### Lógica de negocio

La mayor parte de la lógica central vive en:

- [src/services/dofusDbService.ts](./src/services/dofusDbService.ts)
- [src/server/localDataStore.ts](./src/server/localDataStore.ts)

Ahí se concentra:

- inicialización de caché,
- importación masiva,
- fetch de items/recetas,
- persistencia local,
- construcción de árbol de recetas,
- cálculo de costos.

### Backend

Backend actual:

- [server.ts](./server.ts)
- [src/server/localDataStore.ts](./src/server/localDataStore.ts)

El backend ya incorpora:

- una base SQLite en archivo,
- una API local para bootstrap, importación y precios,
- persistencia de items, recetas, precios y metadata de sincronización.

## Persistencia actual vs objetivo deseado

### Estado actual

La app ya **no depende de localStorage como fuente principal**.

Esto implica:

- existe un archivo local reutilizable entre ejecuciones,
- items, recetas y precios sobreviven al reinicio de la app,
- la base local puede moverse más adelante a un servidor.

### Objetivo que planteas

Tu objetivo real es:

- importar los datos de DofusDB,
- almacenarlos en una **base de datos persistente**,
- dejar de depender de `localStorage`,
- poder categorizar mejor los items,
- preparar el sistema para sincronizaciones poco frecuentes (semanales o mensuales como máximo).

### Conclusión honesta

**Hoy el proyecto ya cumple una primera fase del objetivo final.**

Ahora sí importa datos desde DofusDB y los persiste en una **base SQLite local en archivo**. Aún falta una segunda fase para convertir esto en una persistencia centralizada del lado servidor.

## Limitaciones detectadas

1. **Persistencia todavía local al entorno**
   - La base persiste en archivo, pero sigue siendo una instalación local y no multiusuario.

2. **Sincronización todavía simple**
   - Ya existe sincronización automática mensual local, pero aún no hay tareas más finas ni scheduler externo.

3. **Precios aún no segmentados por mercado avanzado**
   - Ya existen perfiles privados y por servidor, pero todavía no hay histórico completo ni herramientas de comparación más avanzadas.

4. **Código con piezas no conectadas a la UI actual**
   - Existen componentes auxiliares o experimentales no expuestos en la navegación principal.

## Estructura principal del proyecto

- [package.json](./package.json) - scripts y dependencias
- [server.ts](./server.ts) - servidor Express/proxy
- [src/App.tsx](./src/App.tsx) - composición principal
- [src/components/](./src/components) - interfaz
- [src/services/dofusDbService.ts](./src/services/dofusDbService.ts) - cliente de la base local y cálculos
- [src/server/localDataStore.ts](./src/server/localDataStore.ts) - SQLite local e importación persistente
- [src/data/](./src/data) - presets, pesos, categorías y ayudas
- [src/types.ts](./src/types.ts) - tipos base

## Scripts disponibles

Según [package.json](./package.json):

- `npm run dev` - levanta servidor y frontend en desarrollo
- `npm run build` - build de frontend + bundle del servidor
- `npm run start` - ejecuta build generado
- `npm run lint` - chequeo TypeScript sin emitir archivos

## Preparación para GitHub

Antes de subir este proyecto a GitHub:

1. Copia [\.env.example](./.env.example) como `.env`
2. Completa:
   - `APP_BASIC_AUTH_USER`
   - `APP_BASIC_AUTH_PASSWORD`
   - `APP_BASIC_AUTH_REALM`
3. Verifica que `.env` no se suba al repositorio

La autenticación compartida del proyecto ya no debe quedar hardcodeada en el código.

## Ejecución local

1. Crear `.env` a partir de [\.env.example](./.env.example)
2. Instalar dependencias:
   - `npm install`
3. Ejecutar:
   - `npm run dev`

## Imágenes de items

La forma más rápida y ligera de mostrar imágenes es **no guardarlas en tu base de datos** y usar la CDN pública existente.

La app ya usa estas rutas:

- principal: `https://api.dofusdb.fr/img/items/{iconId}.png`
- fallback: `https://s.dofusdu.de/articles/dofus/es/100/{iconId}.png`

Esto es lo ideal porque:

- carga rápido,
- evita inflar la base de datos,
- no requiere almacenar miles de imágenes,
- simplifica mucho el despliegue.

Si más adelante quieres acelerar aún más la percepción visual:

- mantener miniaturas remotas,
- usar `loading="lazy"` en listados largos,
- cachear en CDN o proxy solo si algún host externo falla.

## Tecnologías actuales

- React 19
- TypeScript
- Vite
- Express
- SQLite local
- Tailwind CSS

## Recomendación para la siguiente fase

La siguiente refactorización debería mover el corazón del sistema a una arquitectura como esta:

1. **Separar precios por personaje/cuenta dentro de cada perfil**
2. **Agregar reglas de sincronización más finas**
3. **Mover la misma base local a un entorno servidor**
4. **Agregar endpoints más específicos para categorías y consultas**
5. **Retirar por completo la persistencia legacy del navegador**

## Estado del README

Este README documenta **lo que el proyecto hace hoy**, incluida la migración inicial a base de datos local persistente.

Con tu siguiente respuesta, el paso lógico será:

- decidir qué partes sí se conservan,
- cuáles sobran,
- y qué migramos hacia una base de datos real y persistente.
