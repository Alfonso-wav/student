---
title: Dos bases de datos, dos trabajos
order: 1
summary: Por qué casi toda empresa tiene una base para la app y otra para analítica.
---

## video: El viaje de un dato

> Un pedido nace en la app y se guarda en una base transaccional, como Postgres o MySQL. Esa base existe para una cosa: que la app lea y escriba pocas filas, muy rápido, muchas veces por segundo.
% A smartphone shopping app with a single small parcel flying out of the screen toward a compact database cylinder
% A compact database cylinder handling many tiny fast arrows going in and out, like a busy ticket counter

```
app
 │
 ▼
Postgres / MySQL / SQL Server
pocas filas · muy rápido · sin parar
```

---

> Luego alguien pregunta cuánto se vendió por país el último trimestre. Esa pregunta no se hace en la base de la app: el dato se copia a un warehouse, y una herramienta de BI lo pinta.
% A question mark floating above a world map with a few countries highlighted, waiting for an answer
% A conveyor belt carrying parcels from a small database cylinder to a large warehouse building
% A large warehouse building feeding a simple bar chart displayed on a monitor

```
app ─► OLTP
        │  copia
        ▼
     warehouse  BigQuery, Snowflake…
        │
        ▼
       BI       Metabase, Looker…
```

---

> Todo lo que pasa entre esos dos puntos es ingeniería de datos: copiar, limpiar, transformar, programar y vigilar. Cada herramienta con nombre raro del sector resuelve uno de esos pasos.
% A long pipeline between a small database and a warehouse, with tiny workers copying, cleaning and labeling parcels along it
% A row of different small machines along a pipeline, each machine doing one distinct step to the parcels

**Ingeniería de datos** = lo que pasa en las flechas

- copiar · limpiar · transformar
- programar · vigilar · documentar
- dbt, Airflow, Kafka, Iceberg… = un paso cada una

## video: OLTP y OLAP

> Dos siglas lo ordenan todo. OLTP es la base de la app: consultas como dame el pedido cuarenta y dos, que tocan pocas filas, con escrituras constantes de una en una.
% A clerk at a counter quickly handing over one single parcel from a shelf
% Many small arrows hitting a database cylinder one by one in rapid succession

**OLTP** · online transaction processing

- Postgres, MySQL
- «dame el pedido 42»
- pocas filas · escrituras constantes
- normalizado, con índices

---

> OLAP es el mundo analítico: consultas como la suma de ventas por mes y país, que recorren millones de filas, con cargas por lotes y tablas desnormalizadas y columnares.
% A giant funnel summing thousands of small parcels into one bar chart
% A big truck delivering parcels in bulk batches to a warehouse loading dock

**OLAP** · online analytical processing

- BigQuery, Snowflake, ClickHouse
- «ventas por mes y país»
- millones de filas · cargas por lotes
- desnormalizado, columnar

---

> Casi toda la arquitectura de datos consiste en mover información del primer mundo al segundo sin romper ninguno de los dos.
% A bridge with parcels moving from a small busy shop on the left to a large calm warehouse on the right
% Both buildings intact and stable while parcels flow across the bridge between them

```
OLTP ──────► OLAP
```

sin romper la app · sin mentir en el informe

## video: Filas contra columnas

> Postgres guarda por filas: cada fila completa va junta en páginas de ocho kilobytes. Leer un pedido entero es barato. Pero sumar una sola columna de cincuenta millones de pedidos obliga a leer todas las páginas, con todas sus columnas.
% Horizontal drawers each containing a full row of different small objects packed together
% A magnifying glass forced to open every horizontal drawer to find one kind of object

```
página de 8 KB
[id|cliente|estado|importe|…]
[id|cliente|estado|importe|…]
SUM(importe) → lee TODO
```

---

> Los warehouses guardan por columnas. Cada columna vive aparte y comprimida, así que sumar el importe lee solo el importe. Por eso en un warehouse SELECT asterisco es caro, y en BigQuery bajo demanda pagas por los bytes de las columnas que lees.
% Data stored as tall vertical glass tubes standing in a row, each tube holding one kind of item
% Data stored as tall vertical glass tubes standing in a row; only one tube glows amber and is being read while the others stay dark
% A coin meter attached to the glowing tubes, charging by how much liquid is read

```
id      ▮▮▮▮▮▮▮▮
importe ▮▮▮▮▮▮▮▮  ◄ SUM lee solo esta
email   ▮▮▮▮▮▮▮▮
```

`SELECT *` en un warehouse = pagar todas las columnas

## quiz: El LIMIT que no ahorra nada

Tabla de 1 TB en BigQuery, sin particionado ni clustering. Lanzas:

```sql
SELECT * FROM ventas LIMIT 10;
```

¿Cuántos bytes te facturan?

- [ ] Unos pocos KB: solo devuelve 10 filas
- [x] Prácticamente el TB entero: se leen todas las columnas completas
- [ ] La mitad, porque BigQuery para de leer en cuanto tiene 10 filas
- [ ] Nada: las consultas con LIMIT son gratis

> El coste on-demand se calcula por bytes de las columnas referenciadas, y el `LIMIT` se aplica después de leerlas. Para mirar datos usa la vista previa de la tabla (no factura) o selecciona solo las columnas que necesitas. En tablas con clustering el motor sí puede leer menos, pero no cuentes con ello.

## flash: ¿Por qué no analítica pesada en el Postgres de prod?

- **Compite con la app**: CPU, disco y la caché de páginas (`shared_buffers`) se van en tu informe en vez de en servir pedidos.
- **Las consultas largas frenan a VACUUM**: mientras una transacción larga sigue abierta, Postgres no puede limpiar versiones viejas de filas, y las tablas se hinchan (*bloat*).
- **El almacenamiento por filas es ineficiente** para leer pocas columnas de muchas filas.

Alternativas: una **réplica de lectura** para cosas ligeras, o copiar a un **warehouse** para la analítica de verdad.

## bug: El dashboard que tumba producción

La herramienta de BI está conectada al **Postgres primario de producción**. Un dashboard con `SUM(importe)` sobre 50 millones de pedidos se refresca cada minuto. Desde que existe, la app va lenta en hora punta. ¿Cuál es el problema de fondo?

- [ ] Al BI le falta caché; con activarla está arreglado del todo
- [ ] Falta un índice en `importe`
- [x] Cada refresco es un escaneo masivo que compite con la app en el primario; esa carga debería ir a una réplica o al warehouse
- [ ] `SUM` en Postgres es lento; cambiándolo por `COUNT` se arregla

> Un índice en `importe` no ayuda a sumar todas las filas, y `COUNT` tendría el mismo problema. La caché alivia, pero sigue siendo analítica en el mismo servidor que atiende la app. La regla senior: **las cargas OLAP no van en el primario OLTP**.
