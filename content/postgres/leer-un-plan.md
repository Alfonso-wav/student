---
title: Leer un plan de ejecución
order: 1
summary: EXPLAIN, EXPLAIN ANALYZE y los cuatro tipos de lectura que vas a ver siempre.
---

## video: Qué hace Postgres con tu SQL

> SQL es declarativo: dices qué quieres, no cómo conseguirlo. El planificador de Postgres genera muchos planes posibles, estima el coste de cada uno con las estadísticas que tiene de los datos, y ejecuta el más barato.
% A written order card entering a machine that draws several alternative routes on a map
% Each route on a map with a price tag, the cheapest route highlighted amber

```
WHERE cliente_id = 4242
  Seq Scan          4773
  Bitmap Heap Scan    79 ◄
```

coste estimado · gana el menor

---

> Por eso dos consultas casi iguales pueden ir a velocidades muy distintas. Y si las estadísticas mienten, el plan se equivoca. Hoy mucho SQL lo escribe un ORM, una IA o un compañero: saber leer el plan es lo que te deja juzgar si aguanta en producción.
% A map with wrong statistics leading a traveler onto a long detour
% A code reviewer holding a magnifying glass over a route plan before shipping

- estadísticas malas → plan malo
- SQL de ORM, IA o un compañero
- **leer el plan** = juzgar si aguanta

## video: EXPLAIN y EXPLAIN ANALYZE

> EXPLAIN muestra el plan elegido, con estimaciones, sin ejecutar nada. EXPLAIN ANALYZE ejecuta la consulta de verdad, y añade tiempos y filas reales. En Postgres dieciocho, además, incluye por defecto los buffers: páginas leídas de caché o de disco.
% A blueprint of a route with estimated times, nobody walking it
% A runner actually running the route with a stopwatch, recording real times
% Pages being read from a nearby shelf and some from a far storage room

- `EXPLAIN` → plan + estimaciones, no ejecuta
- `EXPLAIN ANALYZE` → **ejecuta**: tiempo y filas reales
- Postgres 18: `BUFFERS` por defecto (`hit` / `read`)

---

> Cuidado: EXPLAIN ANALYZE de un DELETE o un UPDATE borra o modifica de verdad. Envuélvelo en una transacción y deshazla al final.
% A big delete button inside a protective glass box with an undo arrow
% A transaction envelope wrapping an action and then being torn up to undo it

```sql
BEGIN;
EXPLAIN ANALYZE
  DELETE FROM pedidos WHERE ...;
ROLLBACK;
```

## video: Cómo se lee una línea del plan

> Cada línea del plan es un nodo: qué operación hace y sobre qué tabla. El coste son unidades arbitrarias, solo sirven para comparar planes. Rows es lo que el planificador cree que saldrá.
% A single labeled node card showing an operation icon over a table shelf
% A price tag with arbitrary units comparing two route cards
% A forecast board guessing how many parcels will come out

```
Seq Scan on pedidos
  (cost=0.00..4773.00
   rows=20 width=56)
```

- **Seq Scan on pedidos**: operación y tabla
- **cost**: primera fila .. todas (unidades arbitrarias)
- **rows=20**: filas **estimadas**

---

> Con ANALYZE aparece lo que pasó de verdad: milisegundos reales y filas reales. El plan es un árbol: los nodos más indentados se ejecutan primero y pasan filas al de arriba. Se lee de dentro hacia fuera.
% A stopwatch and a counter comparing the forecast with the real number of parcels
% A tree of node cards where the deepest leaves run first and pass parcels upward

```
(actual time=0.608..14.859
 rows=20.00 loops=1)
```

- **actual time**: ms reales, primera y última fila
- **rows** real frente a estimado
- árbol: se lee **de dentro hacia fuera**

## video: Los cuatro tipos de lectura

> Seq Scan lee la tabla entera, página a página. Index Scan recorre el índice y salta a cada fila de la tabla: bueno para pocas filas, sobre todo si necesita orden.
% A huge library shelf of identical boxes; a tiny robot walks along every shelf checking each box one by one
% A small card catalog drawer with an amber arrow pointing directly to exactly one box on a huge shelf

| Nodo | Qué hace |
|---|---|
| **Seq Scan** | lee la tabla entera |
| **Index Scan** | índice → salta a cada fila |

---

> Bitmap Heap Scan marca en un mapa qué páginas tienen filas, y luego las lee en orden: para un número medio de filas. Index Only Scan responde solo con el índice, sin tocar la tabla. Y un Seq Scan no es malo por sí mismo: lo es cuando lee doscientas mil filas para quedarse con veinte.
% A map of shelves with some pages marked amber, then a robot visiting only those pages in order
% A card catalog alone answering the question without touching the shelves
% A robot carrying a huge pile of boxes to keep only a tiny handful, wasted effort

| Nodo | Qué hace |
|---|---|
| **Bitmap Heap Scan** | mapa de páginas → lectura en orden |
| **Index Only Scan** | solo el índice |

Seq Scan malo = leer 200.000 para quedarte con 20

## lab: Un índice, tres comportamientos

Tienes una tabla `pedidos` con **200.000 filas**: 10.000 clientes, el 70 % de los pedidos en estado `entregado`, el 28 % `enviado` y el 2 % `devuelto`.

Pulsa las consultas **en orden** y fíjate en tres cosas de cada plan: el **tipo de nodo**, `Rows Removed by Filter` y el **Execution Time** final.

```sql setup
CREATE TABLE pedidos (
  id bigint PRIMARY KEY,
  cliente_id int NOT NULL,
  estado text NOT NULL,
  email text NOT NULL,
  creado_en timestamptz NOT NULL,
  importe numeric(10,2) NOT NULL
);
INSERT INTO pedidos
SELECT g,
       1 + (g * 7919) % 10000,
       CASE WHEN g % 100 < 70 THEN 'entregado' WHEN g % 100 < 98 THEN 'enviado' ELSE 'devuelto' END,
       'cliente' || (1 + (g * 7919) % 10000) || '@correo.es',
       timestamptz '2025-01-01' + g * interval '2 minutes',
       ((g * 37) % 50000) / 100.0
FROM generate_series(1, 200000) g;
ANALYZE pedidos;
```

```sql run 1 · pedidos de un cliente, sin índice
EXPLAIN ANALYZE
SELECT * FROM pedidos WHERE cliente_id = 4242;
```

```sql run 2 · crear índice y repetir
CREATE INDEX IF NOT EXISTS pedidos_cliente_idx ON pedidos (cliente_id);
EXPLAIN ANALYZE
SELECT * FROM pedidos WHERE cliente_id = 4242;
```

```sql run 3 · índice en estado, valor frecuente
CREATE INDEX IF NOT EXISTS pedidos_estado_idx ON pedidos (estado);
EXPLAIN ANALYZE
SELECT id, importe FROM pedidos WHERE estado = 'entregado';
```

```sql run 4 · mismo índice, valor raro
EXPLAIN ANALYZE
SELECT id, importe FROM pedidos WHERE estado = 'devuelto';
```

## quiz: Del lab: el índice de cliente

En la consulta 1 el plan era `Seq Scan` con `Rows Removed by Filter: 199980`. En la 2, con el índice, pasó a `Bitmap Index Scan` + `Bitmap Heap Scan`. ¿Qué cambió en el trabajo que hace Postgres?

- [ ] Nada: el índice solo cachea el resultado de la consulta anterior
- [x] Antes leía las ~2.300 páginas de la tabla para quedarse con 20 filas; con el índice localiza las 20 filas y lee solo las páginas que las contienen
- [ ] El índice ordena la tabla físicamente por `cliente_id`
- [ ] Ahora la consulta se ejecuta en paralelo

> En el plan se ve en los `Buffers`: 2.273 páginas leídas sin índice frente a 22 con él (20 de la tabla y 2 del índice). Eso es lo que baja el `Execution Time` de unos 14 ms a menos de 0,1 ms. Un índice B-tree es una estructura aparte que apunta a las filas; no reordena la tabla (eso sería `CLUSTER`, y es una operación puntual que no se mantiene sola).

## quiz: Del lab: el índice que no se usa

En la consulta 3 existía un índice en `estado`, pero Postgres eligió `Seq Scan` para `estado = 'entregado'`. ¿Por qué?

- [ ] El índice todavía no estaba construido
- [ ] Postgres no usa índices en columnas de texto
- [x] El 70 % de las filas cumple el filtro: leer la tabla de seguido es más barato que saltar del índice a casi todas las páginas
- [ ] Hace falta `ANALYZE` después de crear un índice para que se use

> Es la **selectividad**. Con el 2 % (`devuelto`, consulta 4) sí compensa usar el índice; con el 70 % habría que visitar prácticamente todas las páginas igualmente y además leer el índice. El planificador lo sabe porque las estadísticas guardan los **valores más frecuentes** de cada columna y su proporción (`pg_stats.most_common_vals`). Un índice sobre una columna con pocos valores muy repartidos rara vez ayuda y siempre cuesta: espacio y escrituras más lentas.

## flash: rows estimado frente a rows real: ¿qué te dice?

Si el planificador estima 10 filas y salen 100.000 (o al revés), **está decidiendo con información mala**, y todo lo que construye encima (tipo de join, orden, memoria) puede estar mal.

Causas habituales:

- estadísticas viejas: tras cargas grandes, `ANALYZE tabla`;
- columnas correlacionadas (`pais` y `ciudad`), que se arreglan con `CREATE STATISTICS`;
- filtros sobre expresiones o funciones sin estadísticas propias.

Es lo **primero** que hay que mirar en una consulta lenta: busca el nodo más profundo donde la estimación y la realidad se separan.
