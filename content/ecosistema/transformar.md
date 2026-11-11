---
title: 'Transformar: dbt, Dataform y Spark'
order: 4
summary: Del caos de consultas programadas a transformaciones versionadas, testeadas y con dependencias.
---

## video: El problema que resuelve dbt

> Situación típica: decenas de vistas y consultas programadas en el warehouse. Unas dependen de otras, pero eso solo está en la cabeza de quien las escribió. No hay tests, y el SQL no está en git.
% A messy tangle of pipes connecting many unlabeled boxes, nobody knows which feeds which
% A worker scratching their head in front of a tangle of pipes with a missing map

```
vista_a ─► consulta_3 ─► ¿?
vista_b ─► ¿quién la usa?
```

sin tests · sin git · sin dependencias

---

> dbt lo convierte en un proyecto de software. Cada modelo es un archivo con un SELECT. Al referenciar otros modelos con ref, dbt deduce las dependencias y ejecuta en orden. Añade tests, documentación y linaje, todo en git. No mueve datos: genera SQL y lo ejecuta en el warehouse.
% Neat labeled modules connected by clear arrows forming an ordered graph
% A checklist with check marks next to an ordered graph of modules, stored in a version-control tree

```sql
-- models/fct_pedidos.sql
SELECT p.*, c.pais
FROM {{ ref('stg_pedidos') }} p
JOIN {{ ref('stg_clientes') }} c
  USING (cliente_id)
```

- tests: `unique`, `not_null`, `relationships`
- docs y linaje solos · todo en git

## video: Dataform, el dbt de Google

> Dataform es la herramienta equivalente de Google, integrada en la consola de BigQuery. Modelos en archivos punto sqlx, dependencias con ref, tests llamados assertions y ejecuciones programadas.
% A neat graph of modules embedded inside a large console window of a cloud warehouse
% Small assertion checkmarks attached to modules in a graph, with a clock scheduling runs

```
definitions/fct_pedidos.sqlx
  SELECT … FROM ${ref("stg_pedidos")}
```

---

> ¿Cuál elegir? Dataform es nativo y sin infraestructura extra, pero solo encaja si todo vive en BigQuery. dbt es el estándar del sector, portable a cualquier warehouse, y lo que más verás en ofertas. Los conceptos son idénticos: si sabes uno, sabes el otro.
% Two nearly identical toolboxes side by side, one locked to a single building and one with wheels that can travel
% Two toolboxes producing the same graph of modules, showing the same concepts

- **Dataform**: nativo, sin infraestructura · solo BigQuery
- **dbt**: estándar, portable · más ofertas de trabajo

## video: Capas de transformación

> Casi todos los proyectos ordenan los modelos en tres capas. Staging: una vista por tabla fuente, para renombrar, tipar y limpiar, sin lógica de negocio. Intermediate: uniones y cálculos reutilizables. Marts: tablas listas para negocio.
% Raw stones entering the bottom floor of a three-floor factory and being washed and sorted
% The middle floor of a factory joining sorted pieces into reusable parts
% The top floor of a factory displaying finished polished products on clean shelves

```
fuentes
  ▼
staging       limpiar, tipar
  ▼
intermediate  unir, reutilizar
  ▼
marts         fct_pedidos, dim_…
```

---

> Medallion, con bronce, plata y oro, es el mismo concepto con el nombre que popularizó Databricks. Y la regla de oro: el BI solo lee de marts. Si un dashboard lee de staging, la lógica de negocio acaba duplicada en el BI.
% A three-floor factory where each floor is tinted a different metal tone, bronze at the bottom, silver in the middle, gold on top, plain surfaces without engravings
% A dashboard screen connected only to the top floor of a factory, with the lower floors closed off

| dbt | Medallion |
|---|---|
| staging | bronze → silver |
| intermediate | silver |
| marts | gold |

**El BI solo lee de marts.**

## video: Spark y Databricks

> Spark es un motor de procesamiento distribuido: reparte el trabajo entre muchas máquinas de un clúster, y se programa en Python, Scala o SQL. Aparece con archivos crudos enormes, machine learning, lógica muy procedural, o en lakehouses sin warehouse.
% One big job split into pieces and distributed to many small computers in a cluster
% A cluster of computers processing a huge pile of raw files

**Apache Spark**: un trabajo, muchas máquinas

- PySpark · Scala · SQL
- crudo enorme · ML · lógica procedural · lakehouse
- gestionado: **Databricks** · Dataproc

---

> Con un warehouse como BigQuery o Snowflake, Spark rara vez hace falta para transformar: el warehouse ya es un motor distribuido, solo que escribes SQL y no gestionas el clúster.
% A large warehouse with a built-in engine room doing distributed work, no cluster to manage
% A person writing a short query on a card that powers a big warehouse engine

```
warehouse = motor distribuido
          + SQL
          - clúster que gestionar
```

## video: El renacimiento de una sola máquina

> DuckDB, una especie de SQLite para analítica, y Polars, dataframes escritos en Rust, procesan decenas de gigas en un portátil en segundos. Mucho de lo que hace diez años necesitaba un clúster cabe hoy en una sola máquina.
% A single laptop easily lifting a large pile of data blocks
% A huge old cluster of servers shrinking into one single laptop

- **DuckDB**: SQL analítico, columnar, en proceso
- **Polars**: DataFrames en Rust
- decenas de GB en un portátil

---

> La mayoría de las empresas no tiene big data: tiene datos medianos y una factura de nube grande. Saber decir esto lo hace DuckDB en una función, en vez de montemos Spark, es criterio de senior.
% A small tidy pile of data next to a very long cloud bill receipt
% A small duck-shaped tool next to a giant spark machine, the small tool chosen

*«esto lo hace DuckDB en una función»*

en vez de

*«montemos Spark»*

## quiz: Qué hace ref()

En un modelo de dbt escribes `FROM {{ ref('stg_pedidos') }}` en lugar de `FROM analytics.stg_pedidos`. ¿Qué ganas?

- [ ] Que la consulta se cachee y salga gratis
- [x] dbt resuelve el nombre correcto según el entorno (dev o prod) y registra la dependencia para ejecutar en orden
- [ ] Que el modelo se convierta automáticamente en incremental
- [ ] Nada, es solo estilo

> `ref()` hace dos cosas: genera el nombre de tabla adecuado al entorno (tu esquema de desarrollo o el de producción) y apunta que este modelo depende de `stg_pedidos`. Con todas esas aristas dbt construye el DAG, ejecuta en el orden correcto y te deja reconstruir solo lo que va aguas abajo de un cambio (`dbt build --select stg_pedidos+`).

## quiz: Cuándo un modelo incremental

¿En qué caso compensa materializar un modelo como **incremental** (procesar solo lo nuevo) en vez de reconstruir la tabla entera cada vez?

- [ ] Siempre: es más eficiente
- [ ] En tablas de dimensiones pequeñas que cambian a menudo
- [x] En tablas grandes de eventos, sobre todo de solo inserción, donde recalcularlo todo cada ejecución es caro
- [ ] Solo cuando la tabla fuente no tiene clave primaria

> Incremental añade complejidad: lógica de filtro, datos que llegan tarde, *full refresh* cuando cambia la lógica. Compensa cuando reconstruir cuesta de verdad (cientos de GB de eventos). Para tablas pequeñas, una tabla completa reconstruida es más simple y siempre correcta.

## flash: ¿Qué significan bronze, silver y gold?

Arquitectura **medallion**, capas de calidad creciente:

- **Bronze**: datos crudos tal como llegan de la fuente. Solo se añaden; sirven para reprocesar.
- **Silver**: limpios, tipados, deduplicados y unidos. Entidades fiables.
- **Gold**: agregados y modelos de negocio listos para BI y consumidores.

Es el equivalente de staging → intermediate → marts en dbt.
