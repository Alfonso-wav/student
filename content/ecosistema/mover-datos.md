---
title: 'Mover datos: ETL, ELT y CDC'
order: 3
summary: Cómo llega el dato de la base de la app al warehouse, y las formas de hacerlo mal.
---

## video: ETL contra ELT

> Dos recetas para mover datos. ETL: extraes, transformas en un servidor intermedio, y cargas el resultado ya limpio. ELT: extraes, cargas en crudo, y transformas después, dentro del warehouse, con SQL. ¡Mismas letras, distinto orden!
% Parcels being unpacked and cleaned in a small workshop on the road before reaching a warehouse
% Raw parcels going straight into a big warehouse and being cleaned inside by large machines

```
ETL
origen ─► transformar ─► warehouse
          (Python…)

ELT
origen ─► warehouse ─► SQL dentro
          (crudo)
```

---

> ELT ganó con los warehouses en la nube. Su cómputo es enorme y elástico. El crudo sigue ahí, por si cambia la lógica y hay que rehacer. Y la transformación es SQL que puedes versionar. ¿Y ETL? Sigue sirviendo para quitar datos personales antes de que entren, o para formatos que el warehouse no sabe leer.
% A huge elastic machine inside a warehouse stretching to process many parcels at once
% A shelf of raw parcels kept intact next to processed ones, ready to be processed again
% A filter removing personal identity cards from parcels before they enter a warehouse gate

**Por qué ganó ELT**

- cómputo elástico del warehouse
- el crudo queda para reprocesar
- SQL versionable

**Cuándo ETL**: quitar datos personales antes de cargar · formatos raros

## video: Batch o streaming

> En batch mueves datos por lotes, cada hora o cada día, como el camión del reparto: simple, barato y fácil de repetir. En streaming cada evento fluye en segundos, como una cinta transportadora. Pero trae problemas nuevos: orden, duplicados, datos que llegan tarde y estado.
% A big truck leaving once a day full of parcels
% A continuous fast stream of tiny parcels on a conveyor, some out of order and some duplicated

- **Batch**: lotes cada hora o día · simple · barato
- **Streaming**: segundos · orden, duplicados, datos tardíos, estado

---

> La pregunta buena no es ¿qué es más moderno?, sino ¿cuánta prisa tiene de verdad quien usa el dato? Si el dashboard se mira una vez al día, el streaming es gastar sin ganar nada. El fraude o el stock en tiempo real sí lo justifican.
% A person reading a printed dashboard once in the morning with a coffee cup
% An alarm light flashing instantly as a suspicious parcel passes on a fast conveyor

**¿Qué latencia necesita quien consume el dato?**

```
dashboard de cada mañana  → batch
detección de fraude       → streaming
stock en tiempo real      → streaming
```

## video: CDC: leer el diario de Postgres

> CDC, captura de cambios, lee el WAL de Postgres: el diario donde la base apunta cada cambio antes de hacerlo. Es como leer el diario de alguien en vez de preguntarle qué ha hecho. La replicación lógica lo convierte en un flujo de inserciones, actualizaciones y borrados.
% A database cylinder with an open notebook beside it where every change is written before it happens
% A long scroll of change entries unrolling from the notebook into a pipe

```
app ─► Postgres
         │
         ▼
       WAL  diario de cambios
         │  replicación lógica
         ▼
       CDC ─► warehouse
```

---

> ¿Por qué no consultar la tabla cada hora? Porque CDC gana en cuatro cosas: ve los borrados, no necesita una columna de última modificación fiable, apenas molesta a la base, y respeta el orden real de los cambios.
% A crossed-out entry on the scroll still being captured and forwarded, showing deletions are kept
% A tiny reader quietly reading the scroll without touching the database cylinder

- capta los **borrados**
- no necesita `updated_at` fiable
- apenas carga la base: lee el log
- conserva el **orden** real

Debezium · Datastream · AWS DMS · Fivetran · Airbyte

## video: Kafka y sus parientes

> Kafka es un log distribuido: un tablón de anuncios gigante. Los productores clavan eventos en un topic, y cualquier número de consumidores los lee a su ritmo. Los eventos se quedan un tiempo, así que uno que llega nuevo puede leer desde el principio.
% A long horizontal tape of messages; producers on the left append new messages at the end
% Several readers at different positions along the same message tape, each reading at its own pace

```
productor
   │
   ▼
topic  [e1 e2 e3 e4 …]
   │
   ├─► analítica
   ├─► emails
   └─► facturación
```

---

> ¿Qué resuelve? Desacoplar. La app publica pedido creado una sola vez, y analítica, emails y facturación lo leen sin que la app sepa que existen. Montarlo y operarlo tú mismo cuesta mucho, por eso hay versiones gestionadas y equivalentes en cada nube.
% One announcement bell ringing once while three separate rooms receive the same message
% Cloud-shaped managed service holding the message tape, with a maintenance robot tending it

**Desacoplar**: se publica una vez, lo consume quien quiera

- gestionado: Confluent · Amazon MSK
- parecidos: Pub/Sub · Kinesis · Event Hubs

## bug: La extracción incremental por updated_at

Un script copia cada hora los cambios de Postgres al warehouse así:

```sql
SELECT * FROM pedidos
WHERE updated_at > :ultima_ejecucion;
```

Lleva meses en producción y los números "casi" cuadran. ¿Qué se pierde?

- [ ] Nada, es el patrón correcto si `updated_at` tiene índice
- [ ] Solo las filas insertadas en el mismo segundo que la ejecución
- [x] Los `DELETE`, las filas que se cambian sin tocar `updated_at` y las que hacen commit tarde con un `updated_at` anterior a la ejecución
- [ ] Solo pierde datos si la tabla tiene más de un millón de filas

> Un `DELETE` no deja fila que consultar. Un `UPDATE` que no actualiza `updated_at` (otro script, un trigger que falta) es invisible. Y una transacción que empieza a las 10:59, pone `updated_at = 10:59` y hace commit a las 11:01 no la verá la ejecución de las 11:00 (aún no existía) ni la de las 12:00 (su `updated_at` es anterior a las 11:00). CDC sobre el WAL evita las tres cosas. Si no hay CDC, al menos solapa la ventana (`> :ultima - 10 min`) y deduplica.

## quiz: Réplica casi en tiempo real con borrados

Quieres que el warehouse refleje los cambios del Postgres de producción con unos minutos de retraso, **incluidos los borrados**, sin lanzar consultas pesadas contra la base. ¿Qué eliges?

- [ ] Un `pg_dump` completo cada 5 minutos
- [ ] Consultar `updated_at` cada minuto
- [x] CDC sobre la replicación lógica (Debezium, Datastream, DMS…)
- [ ] Un trigger en cada tabla que llame al warehouse por HTTP

> El dump completo es carísimo y no escala. `updated_at` no ve borrados. Un trigger que hace HTTP mete latencia y fallos de red dentro de cada transacción de la app. CDC lee el WAL sin tocar las tablas. Ojo con un detalle de operación: un *replication slot* que nadie consume hace que Postgres retenga WAL y llene el disco. Hay que vigilarlo.

## flash: Idempotencia: qué es y cómo se consigue

Un paso es **idempotente** si ejecutarlo dos veces con la misma entrada deja el mismo resultado que ejecutarlo una vez: nada de duplicados ni de sumas dobles.

Cómo se consigue:

- `MERGE` o *upsert* por clave en vez de `INSERT` a ciegas.
- **Sobrescribir la partición** del día que procesas en lugar de añadir filas.
- Usar el intervalo de la ejecución como parámetro, nunca "ahora".

Es la propiedad que te deja reintentar sin miedo. Sin ella, cada fallo es una investigación.
