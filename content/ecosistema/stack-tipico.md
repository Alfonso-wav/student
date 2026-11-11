---
title: Un stack típico, visto por un senior
order: 7
summary: Las piezas de casi cualquier plataforma de datos, las preguntas que importan y el arte de no añadir herramientas.
---

## video: El stack más común

> Con nombres distintos, esta forma aparece en la mayoría de empresas. Una base para la app, una ingesta hacia el warehouse, capas de transformación dentro, y un BI encima.
% A vertical flow: small app database at the top, pipe down into a warehouse with three floors, dashboard screen at the bottom
% The same vertical data flow drawn as a simple map seen in many different companies

```
base de la app  Postgres, MySQL…
   │  ingesta: CDC, Fivetran…
   ▼
warehouse
   crudo ─► transformado ─► marts
   ▼
BI              Metabase, Looker…
```

---

> Las cinco preguntas que un senior hace al llegar. Cómo llega el dato. Dónde vive la lógica. Quién se entera si algo falla. Si hay una sola definición de cada métrica. Y cuánto cuesta el warehouse al mes.
% A senior engineer with a short checklist of five questions looking at a data pipeline
% Five small icons: an incoming pipe, a code tree, an alarm bell, a single ruler, a coin

1. ¿Cómo llega el dato? ¿Capta borrados?
2. ¿Dónde vive la lógica? ¿Está en git?
3. ¿Quién se entera si algo falla?
4. ¿Una sola definición por métrica?
5. ¿Cuánto cuesta y qué se lo lleva?

## video: El arte de no añadir herramientas

> Cada herramienta nueva cuesta: alguien la opera, la actualiza, la entiende a las tres de la mañana y se la explica al siguiente que llegue.
% A toolbox overflowing with many tools, a tired engineer at night holding a lantern
% Each extra tool attached to a person who must maintain it

**Coste de una herramienta**

operar · actualizar · depurar de madrugada · enseñar

---

> El junior pregunta qué herramienta usamos. El senior pregunta antes: qué problema concreto tenemos hoy, si ya lo resuelve algo que tenemos, cuál es la solución más aburrida que funciona, y qué pasa cuando falla.
% One simple boring hammer chosen among many shiny complex gadgets
% A question mark becoming a scale weighing options with numbers

- ¿Qué problema concreto, **hoy**?
- ¿Lo resuelve algo que **ya tenemos**?
- ¿Cuál es la solución **más aburrida**?
- ¿Qué pasa cuando **falla**?

«Depende», solo si va seguido de **de qué**.

## quiz: La mejora con más retorno

Un equipo tiene 20 consultas programadas en su warehouse. Algunas dependen de otras, pero cada una va a su hora fija. A veces una falla y las siguientes corren igualmente sobre datos viejos, y nadie se entera hasta que alguien de negocio pregunta. ¿Qué cambio aporta más con menos coste?

- [ ] Montar Kafka para pasar todo a streaming
- [ ] Migrar a otro warehouse
- [x] Pasar las consultas a dbt o Dataform (dependencias con ref, tests y ejecución en orden) y añadir alertas de fallo y frescura
- [ ] Un clúster de Spark para reprocesar en paralelo

> El problema es de **dependencias implícitas y falta de visibilidad**, no de volumen ni de latencia. dbt o Dataform resuelven el orden (el DAG sale de los `ref`), los tests impiden publicar datos malos y las alertas cierran el hueco de "nadie se entera". Kafka, migrar o Spark son respuestas a preguntas que nadie ha hecho.

## quiz: La propuesta de Spark

Alguien propone montar un clúster de Spark para transformar 30 GB diarios que **ya están en el warehouse**. ¿Qué respondes?

- [ ] Sí: Spark es el estándar para big data
- [x] No hace falta: el warehouse transforma 30 GB con SQL en segundos sin gestionar un clúster; Spark añadiría coste de operación sin resolver nada
- [ ] Sí, pero solo con Databricks
- [ ] Depende de si el equipo sabe Scala

> 30 GB al día es un volumen pequeño para BigQuery, Snowflake o Redshift. Spark tendría sentido con lógica que no se expresa bien en SQL (ML, parsing complejo) o si los datos vivieran fuera del warehouse. Sacarlos para procesarlos en Spark y volver a cargarlos añade dos movimientos y un sistema más que mantener.

## flash: Seis preguntas antes de elegir una herramienta de datos

1. **Latencia**: ¿cada cuánto necesita el dato quien lo consume?
2. **Volumen y crecimiento**: ¿cuánto hay hoy y cuánto en dos años?
3. **Quién lo opera**: ¿hay personas y conocimiento para mantenerlo?
4. **Coste total**: licencia más cómputo más horas de personas.
5. **Modos de fallo**: ¿qué pasa cuando se cae y cómo se recupera?
6. **Cómo se prueba**: ¿se puede testear y desplegar con CI?

## video: Lo siguiente

> Ya tienes el mapa. A partir de aquí, profundidad en las piezas que más se repiten. Primero, Postgres por dentro: cómo decide el planificador, índices de verdad, y un laboratorio con un Postgres real corriendo en el móvil.
% A map with a path leading into a database cylinder opened to show its internal gears
% A small phone running a database engine inside it

**Postgres por dentro**

- planificador · índices · MVCC y VACUUM
- laboratorio con Postgres real

---

> Después, BigQuery por dentro, con ideas que valen para cualquier warehouse columnar, y modelado de datos. El feed te irá mezclando repasos con lo nuevo, y lo que falles volverá antes.
% Further path on the map leading to a columnar warehouse and a blueprint of tables
% Cards coming back in a loop, the failed ones returning sooner

- **BigQuery por dentro**: slots, particionado, coste
- **Modelado**: hechos, dimensiones, SCD

Lo que falles vuelve antes.
