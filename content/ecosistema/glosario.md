---
title: Glosario de supervivencia
order: 8
summary: La jerga que sale en reuniones y ofertas de trabajo, en tarjetas de repaso.
---

## flash: ¿Qué es un esquema en estrella (star schema)?

Un modelo analítico con una **tabla de hechos** en el centro (eventos medibles con su granularidad: una fila por línea de pedido, con importes y cantidades) rodeada de **tablas de dimensiones** (cliente, producto, fecha, tienda) que dan contexto para filtrar y agrupar.

Es la base del modelado de Kimball. Lo verás a fondo en la ruta de modelado.

## flash: ¿Qué es una SCD (slowly changing dimension)?

Una dimensión cuyos atributos cambian con el tiempo, como la dirección o el segmento de un cliente. Las dos formas más usadas de tratarla:

- **Tipo 1**: sobrescribes el valor. Pierdes la historia.
- **Tipo 2**: añades una fila nueva con `valido_desde`, `valido_hasta` y `es_actual`. Conservas la historia y cada hecho se une a la versión vigente en su fecha.

## flash: ¿Qué es una clave subrogada (surrogate key)?

Un identificador artificial que genera el warehouse (un entero o un hash) en lugar de usar la clave del sistema de origen.

Sirve para unir varias fuentes con claves distintas, para distinguir versiones de una SCD tipo 2 y para que el modelo no dependa de cómo numere los ids la aplicación.

## flash: ¿Qué es MPP?

*Massively parallel processing*: una consulta se divide en trozos que ejecutan a la vez muchos nodos, cada uno sobre su parte de los datos, y luego se combinan los resultados.

BigQuery, Snowflake, Redshift y Spark son MPP. Por eso escanean terabytes en segundos.

## flash: ¿Qué es un shuffle y por qué es caro?

El paso en el que un motor distribuido **redistribuye datos entre nodos por red**, para que las filas con la misma clave acaben en el mismo nodo. Ocurre en `JOIN`, `GROUP BY`, `DISTINCT` y funciones de ventana con `PARTITION BY`.

Es caro porque mueve datos por la red y puede escribir a disco. Optimizar consultas distribuidas consiste mucho en **reducir lo que se baraja**: filtrar antes y unir tablas más pequeñas.

## flash: ¿Qué es la poda de particiones (partition pruning)?

Cuando una tabla está particionada (por ejemplo, por día) y tu `WHERE` filtra por esa columna, el motor **solo lee las particiones que pueden cumplirlo** y descarta el resto sin abrirlas.

En warehouses que cobran por datos leídos (BigQuery *on-demand*, Athena) es la forma número uno de bajar coste. Se pierde si envuelves la columna en una función que el motor no sabe invertir o si filtras con una subconsulta dinámica.

## flash: Schema-on-write frente a schema-on-read

- **Schema-on-write**: el esquema se valida al escribir. Si un dato no encaja, se rechaza. Así funcionan las bases de datos y los warehouses.
- **Schema-on-read**: se guarda cualquier cosa y el esquema se aplica al leer. Así funcionan los data lakes.

El primero da garantías y el segundo flexibilidad. Los formatos de tabla (Iceberg, Delta) acercan el lake al primer modelo.

## flash: ¿Qué significa exactly-once?

Que cada evento afecta al resultado **exactamente una vez**, aunque haya fallos y reintentos.

En sistemas distribuidos la entrega real suele ser *at-least-once* (puede duplicarse). Exactly-once se consigue en la práctica con **entrega al menos una vez más procesamiento idempotente**, por ejemplo deduplicando o haciendo upsert por un id de evento.

## flash: ¿Qué es un watermark en streaming?

Una marca que dice "ya no espero eventos con hora anterior a T". Sirve para cerrar ventanas de tiempo (por ejemplo, las ventas por minuto) aunque haya eventos que lleguen con retraso.

Un watermark corto da resultados rápidos y descarta más datos tardíos. Uno largo da resultados más completos pero más tarde.

## flash: ¿Qué es FinOps aplicado a datos?

Gestionar el **coste** de la plataforma de datos como una métrica más:

- saber qué consultas, tablas y equipos generan el gasto,
- poner límites (bytes máximos facturados por consulta, cuotas),
- elegir bien el modelo de precio (pago por consulta o capacidad reservada),
- y diseñar para leer menos (particionado, clustering, tablas agregadas).

En la nube, una mala consulta en un dashboard que se refresca cada 5 minutos puede costar más que un sueldo.

## flash: ¿Qué es el reverse ETL?

Mover datos **desde el warehouse de vuelta a las herramientas operativas**: CRM, herramientas de marketing, soporte. Por ejemplo, la puntuación de riesgo de abandono calculada en el warehouse aparece en la ficha del cliente en el CRM.

Herramientas: Hightouch, Census o un pipeline propio.
