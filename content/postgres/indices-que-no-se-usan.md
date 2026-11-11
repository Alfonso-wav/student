---
title: Índices que no se usan
order: 2
summary: Funciones en el WHERE, índices de expresión y estimaciones que mienten.
---

## video: Un índice indexa una expresión exacta

> Un índice B-tree sobre email guarda los valores de email ordenados. Si la consulta pregunta por lower de email, para Postgres es otra expresión: el índice no sabe nada de ella y no lo puede usar. Pasa igual con funciones de fecha, conversiones de tipo o cálculos sobre la columna.
% An alphabetized card catalog of email cards, and a person asking for a lowercase version that is not in the catalog
% A key that does not fit a slightly different lock shape

```sql
-- índice en email, creado_en, id
WHERE lower(email) = 'ana@x.es'
WHERE date(creado_en) = '2025-03-01'
WHERE id::text = '42'
```

---

> Dos arreglos. Reescribir el filtro para que la columna quede sola, o crear un índice de expresión. Es la causa más común de tengo índice y no lo usa, y un patrón que el SQL generado por IA repite mucho.
% A filter rewritten so the plain column matches the catalog directly, amber arrow hitting the card
% A second catalog built specifically for the lowercase version, the key now fits

```sql
-- 1 · la columna, sola
WHERE creado_en >= '2025-03-01'
  AND creado_en <  '2025-03-02'
-- 2 · índice de expresión
CREATE INDEX
  ON pedidos (lower(email));
```

## lab: lower(email) contra el índice

Misma tabla de 200.000 pedidos. Hay un índice normal en `email`. Mira qué pasa al buscar sin distinguir mayúsculas.

En la consulta 1 fíjate también en `rows=` estimado frente a `rows=` real.

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
CREATE INDEX pedidos_email_idx ON pedidos (email);
ANALYZE pedidos;
```

```sql run 1 · buscar con lower(), índice normal
EXPLAIN ANALYZE
SELECT * FROM pedidos WHERE lower(email) = 'cliente4242@correo.es';
```

```sql run 2 · misma búsqueda sin lower()
EXPLAIN ANALYZE
SELECT * FROM pedidos WHERE email = 'cliente4242@correo.es';
```

```sql run 3 · crear índice de expresión y repetir
CREATE INDEX IF NOT EXISTS pedidos_email_lower_idx ON pedidos (lower(email));
ANALYZE pedidos;
EXPLAIN ANALYZE
SELECT * FROM pedidos WHERE lower(email) = 'cliente4242@correo.es';
```

## quiz: Del lab: la estimación de 1000 filas

En la consulta 1 el plan estimó `rows=1000` y salieron 20. Tras crear el índice de expresión y lanzar `ANALYZE`, estimó `rows=20`. ¿De dónde salía el 1000?

- [ ] Del tamaño del índice en `email`
- [x] Sin estadísticas sobre `lower(email)`, Postgres aplica una selectividad por defecto (0,5 % de 200.000 = 1000)
- [ ] Es el máximo de filas que Postgres estima siempre
- [ ] Del número de clientes distintos dividido entre 10

> Para una igualdad sobre una expresión de la que no sabe nada, el planificador usa una selectividad fija del 0,5 %. Al crear un índice de expresión, `ANALYZE` también **recoge estadísticas de esa expresión**, y la estimación pasa a ser buena. Por eso un índice de expresión puede mejorar planes incluso en consultas que luego no lo usan para leer.

## bug: El filtro por día que hace Seq Scan

Hay un índice en `creado_en` (timestamptz). El SQL generado para "pedidos del 1 de marzo" es:

```sql
SELECT * FROM pedidos
WHERE date(creado_en) = '2025-03-01';
```

El plan muestra `Seq Scan` sobre 200.000 filas. ¿Cuál es el mejor arreglo?

- [ ] `SET enable_seqscan = off` en la sesión
- [ ] Crear un índice `hash` en `creado_en`
- [x] Reescribir como rango: `creado_en >= '2025-03-01' AND creado_en < '2025-03-02'`
- [ ] Pasar `creado_en` a tipo `text`

> El rango deja la columna sola en la comparación, así que el índice B-tree existente sirve, y es exacto con cualquier hora del día. Desactivar el Seq Scan es una herramienta de diagnóstico, nunca un arreglo. Ojo con un detalle: con `timestamptz`, "el 1 de marzo" depende de la zona horaria de la sesión, y `date()` también la usa. Sé explícito con la zona en los límites del rango.

## flash: Índice compuesto: ¿por qué importa el orden?

Un índice sobre varias columnas, como `(cliente_id, creado_en)`, ordenado primero por la primera y, dentro de ella, por la segunda.

Sirve para:

- `WHERE cliente_id = ?` (prefijo izquierdo),
- `WHERE cliente_id = ? AND creado_en > ?`,
- `WHERE cliente_id = ? ORDER BY creado_en`, porque ya sale ordenado.

No sirve bien para `WHERE creado_en > ?` sola. Regla práctica: **igualdades primero y rangos u orden al final**.

## flash: ¿Qué necesita un Index Only Scan?

1. Que **todas las columnas** que pide la consulta estén en el índice: como claves o con `INCLUDE (col)`.
2. Que las páginas estén marcadas como **visibles para todos** en el *visibility map*, cosa que mantiene **VACUUM**.

Si la tabla tiene muchas páginas sin limpiar, el plan dice Index Only Scan pero aparece `Heap Fetches: N` alto: está yendo a la tabla igualmente. Esto conecta con MVCC y VACUUM, que llegarán en una próxima lección de esta ruta.
