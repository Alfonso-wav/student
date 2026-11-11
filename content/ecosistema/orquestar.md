---
title: 'Orquestar: Airflow, Dagster y Prefect'
order: 5
summary: Qué aporta un orquestador frente a cron, y el concepto que más separa a un junior de un senior.
---

## video: Por qué cron no basta

> Con cron ejecutas un script a una hora. Lo que no tienes: dependencias, reintentos cuando falla una API, alertas, visibilidad de qué corrió y cuánto tardó, ni backfills para reprocesar un mes entero.
% An alarm clock triggering a single script at night, nothing else around it
% A missing bridge between two tasks, a broken retry loop and a silent alarm

```
0 3 * * *  python cargar.py
```

- dependencias: B solo si A terminó bien
- reintentos · alertas · visibilidad
- **backfills**: reprocesar marzo entero

---

> Un orquestador da todo eso. El trabajo se describe como un DAG, un grafo dirigido sin ciclos: tareas, y flechas de dependencia entre ellas.
% A conductor directing an orchestra of tasks connected by arrows
% A directed graph of task boxes with arrows flowing one way, no loops

```
extraer
   ▼
cargar ───────┐
   ▼          ▼
transformar  tests
   └────┬─────┘
        ▼
      avisar
```

**DAG** = tareas + flechas, sin ciclos

## video: Los tres nombres que oirás

> Airflow es el más extendido: los DAGs se escriben en Python, y Cloud Composer es Airflow gestionado en Google. Dagster se orienta a assets: declaras qué tablas existen y de qué dependen, y él sabe qué está desactualizado. Prefect es Python normal con decoradores.
% Three different control panels side by side: a pinwheel, a stack of assets, a simple flow line
% A graph of data tables where outdated tables glow amber

- **Airflow**: el más extendido · Python · Cloud Composer
- **Dagster**: orientado a *assets* · linaje · encaja con dbt
- **Prefect**: `@flow`, `@task` · poca ceremonia

---

> Lo importante no es la herramienta: todas resuelven lo mismo. Dependencias, reintentos, programación, observabilidad y backfills.
% Three different control panels all producing the same ordered graph of tasks
% Five simple unlabeled pictograms in a row: a chain link, a circular retry arrow, a clock, an eye, a rewind symbol

- dependencias · reintentos
- programación · observabilidad
- backfills

## video: Intervalos, no "ahora"

> El concepto clave: cada ejecución procesa un intervalo de datos, no lo que haya ahora mismo. La ejecución del martes procesa el lunes. Si la relanzas el viernes, sigue procesando el lunes.
% A calendar where a run on Tuesday reaches back to process the Monday box
% A run on Friday still processing the same Monday box, a dotted arrow back in time

```
martes          → datos del lunes
relanzada vie.  → datos del lunes
backfill marzo  → cada día, el suyo
```

---

> Por eso las consultas reciben la fecha como parámetro, y nunca usan la fecha actual. Con esto y la idempotencia, reprocesar cualquier día del pasado es un botón, no un proyecto.
% A function receiving a date ticket as input instead of looking at a wall clock
% A big rewind button replaying a whole month of calendar boxes one by one

```sql
-- mal
WHERE fecha = CURRENT_DATE() - 1
-- bien
WHERE fecha = @data_interval_start
```

## bug: La tarea diaria que se rompe al reintentar

Una tarea programada a diario ejecuta:

```sql
INSERT INTO ventas_diarias
SELECT DATE(creado_en) AS dia, SUM(importe)
FROM pedidos
WHERE DATE(creado_en) = CURRENT_DATE() - 1
GROUP BY dia;
```

¿Qué pasa cuando el orquestador **la reintenta** tras un fallo a medias, o cuando haces **backfill** de la semana pasada?

- [ ] Nada: el orquestador deshace el primer intento antes de reintentar
- [x] El reintento duplica filas (INSERT a ciegas) y el backfill vuelve a procesar ayer en vez de cada día pasado
- [ ] Solo falla si cambia la zona horaria del servidor
- [ ] El backfill funciona, pero va más lento

> Dos fallos clásicos juntos. `INSERT` sin borrar antes lo que ya había no es idempotente: cada reintento suma otra fila para el mismo día. Y `CURRENT_DATE()` ata la tarea al reloj, no al intervalo: un backfill de 7 días recalcula 7 veces "ayer". La versión correcta recibe `@dia` como parámetro y sobrescribe esa partición (o hace `MERGE` por `dia`).

## quiz: Lo que un orquestador no debe hacer

¿Cuál de estas cosas **no** debería hacer tu orquestador?

- [ ] Lanzar una consulta en el warehouse y esperar a que termine
- [ ] Reintentar una tarea que falló por un error de red
- [x] Ejecutar las transformaciones pesadas dentro de sus propios workers, cargando millones de filas en memoria
- [ ] Avisar por Slack cuando un DAG supera su tiempo habitual

> El orquestador **orquesta**: dice qué se ejecuta, cuándo y en qué orden. El cómputo pesado va donde está el músculo (el warehouse, Spark, un contenedor). Un worker de Airflow trayendo 10 millones de filas a pandas es la causa número uno de DAGs lentos y caídas por falta de memoria.

## flash: ¿Scheduled queries u orquestador?

**Bastan** con pocas consultas independientes, todas dentro del warehouse, en las que un fallo puntual no tiene consecuencias graves.

**Necesitas un orquestador** (o al menos Dataform/dbt con sus ejecuciones) cuando:

- hay dependencias entre pasos,
- intervienen sistemas distintos (extraer de una API, cargar, transformar, avisar),
- necesitas reintentos, alertas y backfills fiables,
- varias personas mantienen los pipelines.
