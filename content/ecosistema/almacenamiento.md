---
title: Warehouse, lake y lakehouse
order: 2
summary: Dónde viven los datos analíticos, qué es Parquet y por qué todo el mundo habla de Iceberg.
---

## video: Data warehouse

> Un data warehouse es una base de datos hecha para analizar. Tablas con esquema, consultas en SQL, y un truco: el almacenamiento va por un lado y el cómputo por otro. BigQuery, Snowflake y Redshift son warehouses.
% A clean modern warehouse building with neatly labeled shelves of identical boxes
% A warehouse building split in two halves: storage shelves on one side, a separate engine room with gears on the other

**Data warehouse**

- base de datos para analítica
- tablas con esquema · SQL
- almacenamiento separado del cómputo
- BigQuery · Snowflake · Redshift

---

> El proveedor se encarga de los archivos, la compresión y el reparto entre máquinas. Tú solo ves tablas. ¡Cero mantenimiento y SQL rápido sobre montañas de datos! ¿La pega? Los datos quedan en su formato propio, y solo los lee su motor. Como una caja fuerte que solo abre su llave.
% Robotic arms automatically compressing and arranging boxes across several connected warehouse halls
% A single locked vault door with a proprietary keyhole guarding the boxes inside

```
+ cero mantenimiento
+ SQL rápido sobre volúmenes enormes
- formato propio: solo lo lee su motor
```

## video: Data lake

> Un data lake es un trastero enorme y barato en la nube. Echas archivos en cualquier formato, y el esquema lo decides al leer, no al guardar. Flexible, y baratísimo por terabyte.
% A calm lake seen from above with many different floating objects: files, documents, images, logs
% A fisherman pulling an item from the lake and deciding its shape only when it is out of the water

**Data lake** = object storage + archivos

- S3 (AWS) · GCS (Google) · ADLS (Azure)
- CSV, JSON, logs, imágenes, Parquet…
- *schema-on-read*: el esquema, al leer

---

> ¿El peligro? Que el trastero se convierta en un pantano de datos: miles de archivos sin dueño ni etiqueta, sin transacciones, y sin forma fácil de cambiar o borrar una sola fila.
% A murky swamp full of tangled floating files with no labels
% Two cranes dropping objects into the same spot of a swamp, objects colliding and breaking

**Data swamp**

- miles de archivos sin dueño
- sin transacciones: dos escrituras a la vez = archivos a medias
- `UPDATE` o `DELETE` de una fila: muy difícil

## video: Formatos de archivo que tienes que conocer

> CSV y JSON sirven para pasarse datos, y poco más. Avro guarda por filas, en binario y con su esquema: perfecto para ir apuntando eventos uno a uno. Parquet guarda por columnas y comprimido: es el formato de la analítica.
% Three kinds of containers side by side: a loose paper envelope, a sealed horizontal capsule, and a block of compressed vertical tubes
% A stream of small capsules being written one after another onto a conveyor belt

| Formato | Organización | Cuándo |
|---|---|---|
| CSV / JSON | filas, texto | intercambio |
| **Avro** | filas, binario | eventos, streaming |
| **Parquet** | columnas, comprimido | analítica |

---

> El truco de Parquet: en cada bloque apunta el mínimo y el máximo de cada columna, como la etiqueta de una caja de mudanza. Si buscas algo que cae fuera de ese rango, ¡ni la abres! Es la idea de un warehouse columnar, pero en un archivo abierto.
% A block of vertical tubes divided into stacked segments, each segment with a small min and max gauge on its side
% A reader skipping entire segments of a tube stack, reading only one segment highlighted amber

```
grupo 1: fecha 01-01 … 01-31
grupo 2: fecha 02-01 … 02-28

WHERE fecha = '2025-02-10'
→ el grupo 1 ni se lee
```

*predicate pushdown*

## video: Lakehouse y formatos de tabla

> Un lakehouse es un lake que se porta como un warehouse. ¿Cómo? Con un formato de tabla encima de los Parquet: Iceberg, Delta Lake o Hudi. Son como el índice de un álbum: dicen qué archivos forman la tabla en cada momento.
% A house built on stilts over a lake, with an orderly warehouse interior
% A thin glowing ledger layer floating above many file blocks, with lines pointing to the blocks that belong to the table

```
metadatos  Iceberg / Delta / Hudi
   │  qué archivos son la tabla
   ▼
Parquet  Parquet  Parquet  …
(object storage)
```

---

> Con eso consigues transacciones, cambiar el esquema sin reescribirlo todo, ver la tabla tal como estaba ayer, y varios motores leyendo los mismos datos. Hoy Iceberg es el estándar de facto: un formato abierto que no te ata a ningún proveedor.
% A shield over a stack of files, two writers waiting in line instead of colliding
% A clock rewinding next to an earlier snapshot of the same stack of files
% Several different machines plugged into the same lake of files at once

- **ACID**: nadie lee una tabla a medias
- evolución de esquema y particiones
- ***time travel***: la tabla como estaba ayer
- Spark, Trino, Snowflake, DuckDB y BigQuery leen Iceberg

## video: Crudo en el warehouse no es un lake

> Una confusión muy común: cargar los datos crudos en el warehouse, tal cual llegan, y llamar a esa zona el lake. Ojo, el patrón es bueno, se llama ELT. Pero eso sigue siendo un warehouse, no un lake.
% Raw unsorted parcels dumped into a corner of a tidy warehouse with a wrong signpost pointing at them
% A warehouse building next to a lake, clearly separate, with a fence between them

**Crudo dentro del warehouse** = ELT

**Lake** = archivos en object storage, en formatos abiertos

---

> Eso sí, los dos mundos se tocan: casi todos los warehouses pueden leer archivos del lake sin cargarlos, con tablas externas, incluso tablas Iceberg. La frase correcta es: cargamos el crudo en el warehouse y transformamos dentro.
% A long pipe reaching from a warehouse into a lake, reading files without moving them
% Raw parcels entering a warehouse and being transformed inside by machines into neat boxes

**Tablas externas**: el warehouse lee el lake sin cargarlo

- BigQuery → BigLake
- Snowflake → external tables
- Redshift → Spectrum

*«cargamos el crudo en el warehouse y transformamos dentro»*

## quiz: Lo que Iceberg añade a Parquet

Tienes miles de archivos Parquet en un bucket de S3 o GCS. ¿Qué te da ponerles Iceberg encima?

- [ ] Compresión: Parquet sin Iceberg no se comprime
- [x] Una tabla con transacciones, snapshots y esquema que varios motores entienden igual
- [ ] Que las consultas pasen a ser gratis en el warehouse
- [ ] Convertir los archivos a formato por filas para escribir más rápido

> Parquet ya es columnar y comprimido. Iceberg es una capa de metadatos: lleva la lista de archivos de cada versión de la tabla, el esquema y las particiones. Eso permite escrituras atómicas, *time travel* y que Spark, Trino o BigQuery lean exactamente la misma tabla.

## quiz: Formato para eventos en streaming

Un servicio publica eventos uno a uno, miles por segundo, y otro los consume para cargarlos después en el warehouse. ¿Qué formato encaja mejor en el mensaje?

- [ ] Parquet
- [x] Avro
- [ ] CSV
- [ ] Iceberg

> Avro es binario y por filas: escribir un registro suelto es barato y lleva su esquema, lo que facilita la evolución de esquema con un *schema registry*. Parquet brilla al leer columnas de muchos registros, no al escribirlos de uno en uno. Iceberg es un formato de tabla, no de mensaje.

## flash: Tres razones por las que Parquet gana a CSV

1. **Columnar**: lees solo las columnas que pides.
2. **Compresión por columna**: valores del mismo tipo juntos se comprimen mucho mejor (diccionario, *run-length*).
3. **Tipos y estadísticas**: guarda tipos de verdad y el mínimo y el máximo por bloque, así que el motor se salta bloques que no cumplen el `WHERE`.

Extra: no hay ambigüedad con comas, comillas ni saltos de línea dentro de campos.
