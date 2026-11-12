---
title: Leer un plan de ejecución
order: 1
summary: EXPLAIN, EXPLAIN ANALYZE y los cuatro tipos de lectura que vas a ver siempre.
---

## video: Qué hace Postgres con tu SQL

> Tú le pides datos a Postgres, pero no le dices cómo buscarlos. Eso lo decide el planificador: un pequeño GPS dentro de la base de datos. Dibuja muchos caminos posibles, mira sus estadísticas para calcular cuánto cuesta cada uno… ¡y elige el más barato!
% A navigation device projecting many glowing alternative routes over a city map
% A city map with several routes, each with a price tag, the shortest route highlighted and the others fading

```
WHERE cliente_id = 4242
  Seq Scan          4773
  Bitmap Heap Scan    79 ◄
```

coste estimado · gana el menor

---

> Pero ojo: si las estadísticas están viejas, el GPS cree que la calle está vacía… ¡y te mete en un atasco! Por eso dos consultas casi iguales pueden ir rapidísimo o lentísimo. Da igual quién escriba el SQL, tú, un ORM o una IA: leer el plan es tu superpoder para saber si aguanta.
% A car stuck in a huge traffic jam while its navigation screen shows an outdated empty street
% A magnifying glass held over a route plan on a desk, inspecting it before shipping

- estadísticas malas → plan malo
- SQL de ORM, IA o un compañero
- **leer el plan** = juzgar si aguanta

## video: EXPLAIN y EXPLAIN ANALYZE

> EXPLAIN es mirar el mapa antes del viaje: te enseña la ruta elegida y lo que cree que tardará, sin moverse del sitio. EXPLAIN ANALYZE hace el viaje de verdad, ¡con cronómetro! Tiempos reales y filas reales. Y en Postgres dieciocho te chiva también los buffers: cuántas páginas salieron de la memoria y cuántas del disco.
% A paper map on a desk with a dotted route and an estimated clock time next to it
% A runner on a road holding a large stopwatch, speed lines behind
% Pages flying quickly out of a nearby shelf and a few slowly arriving from a far away warehouse

- `EXPLAIN` → plan + estimaciones, no ejecuta
- `EXPLAIN ANALYZE` → **ejecuta**: tiempo y filas reales
- Postgres 18: `BUFFERS` por defecto (`hit` / `read`)

---

> ¡Cuidado, trampa! EXPLAIN ANALYZE ejecuta la consulta de verdad. Si es un DELETE, borra. Si es un UPDATE, cambia los datos. El truco: mételo en una transacción y haz rollback al final. Es como jugar con un botón de deshacer.
% A big red delete button inside a protective glass dome
% A large undo arrow sweeping scattered blocks back into place

```sql
BEGIN;
EXPLAIN ANALYZE
  DELETE FROM pedidos WHERE ...;
ROLLBACK;
```

## video: Cómo se lee una línea del plan

> Cada línea del plan es un nodo: una tarea, como leer una tabla. Lleva un coste en unidades inventadas, que solo sirven para comparar planes entre sí. Y lleva rows: cuántas filas cree el planificador que van a salir. Cree, ¿eh? Es una apuesta.
% A single task card showing a crate being lifted from a shelf, like a factory work order
% Two price tags with abstract made-up currency symbols balanced on a scale
% A weather-forecast style board predicting how many boxes will come out of a machine

```
Seq Scan on pedidos
  (cost=0.00..4773.00
   rows=20 width=56)
```

- **Seq Scan on pedidos**: operación y tabla
- **cost**: primera fila .. todas (unidades arbitrarias)
- **rows=20**: filas **estimadas**

---

> Con ANALYZE llega la verdad: milisegundos reales y filas reales, justo al lado de la apuesta. Y el plan es un árbol, como una cadena de montaje: los nodos de más adentro trabajan primero y pasan sus filas al de arriba. Se lee de dentro hacia fuera.
% A scoreboard comparing a predicted count with the real count, stopwatch beside it
% An assembly line shaped like an upside-down tree, workers at the leaves passing boxes up to the trunk

```
(actual time=0.608..14.859
 rows=20.00 loops=1)
```

- **actual time**: ms reales, primera y última fila
- **rows** real frente a estimado
- árbol: se lee **de dentro hacia fuera**

## video: Los cuatro tipos de lectura

> Hay cuatro formas de leer una tabla. Seq Scan: leerse el libro entero, página a página. Index Scan: ir al índice del final, encontrar la palabra y saltar justo a esa página. Genial para pocas filas, sobre todo si las quieres ordenadas.
% A gigantic book being read page by page, a tall pile of turned pages behind
% An arrow jumping from the index section of a book straight to one highlighted page

| Nodo | Qué hace |
|---|---|
| **Seq Scan** | lee la tabla entera |
| **Index Scan** | índice → salta a cada fila |

---

> Bitmap Heap Scan: primero pegas pósits en las páginas que te interesan y luego las lees en orden, sin saltos locos. Ideal para un número medio de filas. Index Only Scan: el índice ya tiene la respuesta, ¡ni abres el libro! Y Seq Scan no es malo: lo malo es leer doscientas mil filas para quedarte con veinte.
% A thick book with bright sticky notes sticking out of some pages, read in order from front to back
% A small index card that already holds the answer, next to a closed book that stays shut
% A conveyor dumping a mountain of boxes into a bin, only a tiny handful kept on a tray

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

En la consulta 1 salió `Seq Scan` con `Rows Removed by Filter: 199980`. En la 2, con índice, `Bitmap Index Scan` + `Bitmap Heap Scan`. ¿Qué cambió?

- [ ] Nada: el índice solo cachea el resultado anterior
- [x] Antes leía toda la tabla (~2.300 páginas) para quedarse con 20 filas; ahora va directo a las páginas que las tienen
- [ ] El índice ordena la tabla por `cliente_id`
- [ ] Ahora se ejecuta en paralelo

> Míralo en `Buffers`: **2.273 páginas** sin índice frente a **22** con él. Por eso pasa de ~14 ms a menos de 0,1 ms. Un B-tree es una estructura aparte que apunta a las filas: no reordena la tabla (eso es `CLUSTER`, y no se mantiene solo).

## quiz: Del lab: el índice que no se usa

En la consulta 3 había índice en `estado`, pero Postgres eligió `Seq Scan` para `estado = 'entregado'`. ¿Por qué?

- [ ] El índice aún no estaba construido
- [ ] Postgres no usa índices en columnas de texto
- [x] El 70 % de las filas cumple el filtro: leer la tabla de seguido sale más barato que saltar del índice a casi todas las páginas
- [ ] Falta un `ANALYZE` tras crear el índice

> Es la **selectividad**. Con el 2 % (`devuelto`) sí compensa el índice; con el 70 % visitarías casi todas las páginas igual, más el índice. El planificador lo sabe por los **valores más frecuentes** de las estadísticas (`pg_stats.most_common_vals`).

## flash: rows estimado frente a rows real: ¿qué te dice?

Si estima 10 filas y salen 100.000, **decide con información mala**: el tipo de join, el orden y la memoria pueden estar mal.

- estadísticas viejas → `ANALYZE tabla`
- columnas correlacionadas (`pais`, `ciudad`) → `CREATE STATISTICS`
- filtros sobre funciones sin estadísticas

Busca el nodo **más profundo** donde estimado y real se separan.
