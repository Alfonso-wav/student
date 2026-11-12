---
title: Servir, vigilar la calidad y gobernar
order: 6
summary: Capa semántica, tests y observabilidad de datos, linaje, contratos y seguridad.
---

## video: La capa semántica

> Reunión. Pregunta: ¿cuántos clientes activos tenemos? Tres dashboards, tres números. Uno cuenta a quien compró en treinta días, otro en noventa, y otro mete pedidos cancelados. ¿Cuál dice la verdad?
% A meeting table with three screens showing three different numbers for the same question
% Three slightly different measuring rulers measuring the same object

```
A: compra en los últimos 30 días
B: compra en los últimos 90 días
C: incluye pedidos cancelados
→ tres números distintos
```

---

> Una capa semántica es el diccionario oficial: define cada métrica una vez, con su fórmula, filtros y dimensiones, y todo el mundo la usa. Puede vivir dentro del BI o fuera, para todos. Casi nunca es un problema técnico: son definiciones repetidas.
% One single master ruler in the center feeding identical measurements to many screens
% Several dashboards all connected to one shared definition book

**Una métrica, una definición**

- dentro del BI: LookML · Metabase · Power BI
- fuera, para todos: dbt semantic layer · Cube

## video: Calidad y observabilidad de datos

> Dos capas que se ayudan. Primera: tests en el pipeline, como el control de calidad de una fábrica que para la cinta si algo falla. Claves únicas, nulos donde no toca, relaciones rotas, valores no permitidos.
% A checkpoint gate on a pipeline stopping a defective parcel
% Inspectors with checklists verifying parcels on a conveyor

**Tests en el pipeline** (paran si fallan)

- unicidad · no nulos · integridad referencial
- dbt tests · Dataform assertions · Great Expectations · Soda

---

> Segunda: observabilidad, una alarma para lo que no sabías que tenías que mirar: frescura, volumen, esquema y distribución. El peor fallo no es el que rompe el pipeline. Es el que no rompe nada… y deja números falsos durante semanas.
% A dashboard of four gauges watching a pipeline: clock, volume meter, structure, distribution
% A calm-looking pipeline secretly delivering wrong parcels for weeks, dust on top

**Observabilidad**

- frescura: ¿cuándo se actualizó?
- volumen: ¿hoy llegaron diez veces menos filas?
- esquema: ¿renombraron una columna?
- distribución: ¿nulos del 1 % al 40 %?

## video: Linaje y catálogo

> El linaje es el árbol genealógico de los datos: de dónde sale cada tabla y columna, y quién la usa después. Responde lo importante antes de un cambio: si toco esta columna, ¿qué dashboards se rompen?
% A map of connected tables flowing downstream like a river delta into dashboards
% One column highlighted amber at the source and all downstream dashboards it affects lit up

```
pedidos.estado
  ▼
stg_pedidos
  ▼
fct_ventas ─┬─► dashboard ventas
            └─► dashboard logística
```

---

> Un catálogo de datos es la biblioteca: junta linaje, descripciones, dueños, clasificación, por ejemplo si hay datos personales, y un buscador. Y si transformas con dbt o Dataform, el linaje de sus modelos te sale gratis.
% A library catalog drawer with cards linking to tables, owners and sensitivity labels
% A search magnifier over a catalog of tables with lineage lines between them

**Catálogo** = linaje + descripción + dueño + clasificación + búsqueda

- Dataplex · Unity Catalog · DataHub · OpenMetadata
- dbt y Dataform: linaje gratis

## video: Contratos de datos

> El origen de muchos incendios: el equipo de la app renombra una columna o cambia lo que significa, y el pipeline se rompe. O peor: no se rompe, y miente.
% An app team renaming a label on a box while a pipeline downstream breaks
% A pipeline quietly returning empty results with no alarm

```
app:
  'enviado' → 'en_transito'
pipeline:
  WHERE estado = 'enviado'
  → 0 filas, y ningún error
```

---

> Un contrato de datos es un acuerdo por escrito, con versiones, entre quien produce los datos y quien los usa: esquema, significado, frescura y cómo se avisa de los cambios. Lo ideal es comprobarlo en la integración continua del productor: si un cambio lo rompe, no se puede desplegar.
% A signed contract document between two buildings, a producer and a consumer
% An automated gate blocking a deployment that would break the contract

**Contrato**

- esquema: columnas, tipos, nulos
- semántica: qué significa, en qué unidades
- SLA: frescura, disponibilidad
- política de cambios

Comprobado en el CI del productor

## video: Gobernanza y seguridad en el warehouse

> Cada uno, la llave justa. Mínimo privilegio: roles por esquema, no administrador para todos. Seguridad por columna, para que el email solo lo vea quien debe. Por fila, para que cada delegación vea solo lo suyo. Y enmascaramiento dinámico de datos personales.
% Keys of different sizes opening only specific doors in a warehouse
% A table where one column is covered by a mask and some rows are hidden behind frosted glass

- **mínimo privilegio**: roles por esquema o dataset
- **por columna**: policy tags · masking policies
- **por fila**: row access policies
- **enmascaramiento** dinámico

---

> Y el RGPD: el derecho de supresión obliga a poder borrar a una persona de todas partes, crudo y copias de seguridad incluidos. En tablas donde solo se inserta, eso hay que pensarlo desde el primer día.
% A person's silhouette being erased from raw files, finished tables and backup tapes
% An architect drawing a deletion path on blueprints before building a warehouse

**RGPD · derecho de supresión**

borrar a una persona de: crudo · marts · backups

Diseñarlo desde el principio

## quiz: El fallo silencioso

La ingesta desde Postgres se quedó colgada el viernes sin dar error. El lunes, los dashboards muestran los números del jueves como si fueran actuales. ¿Qué lo habría detectado antes?

- [ ] Un test `not_null` sobre la clave
- [x] Un check de frescura: alerta si la tabla no se ha actualizado en N horas
- [ ] Un test `unique` sobre el id del pedido
- [ ] Más memoria para el worker del orquestador

> Los datos que había eran correctos, así que los tests de contenido pasan. Lo que fallaba es que **no llegaban datos nuevos**. Por eso los checks de frescura y volumen son lo primero que se monta en observabilidad: detectan justo los fallos que no rompen nada.

## bug: Tres definiciones de cliente activo

En la herramienta de BI hay tres preguntas guardadas que calculan "clientes activos", cada una con su SQL. Una filtra 30 días, otra 90 y otra no excluye los pedidos cancelados. Dirección se queja de que los números no cuadran. ¿Cuál es el arreglo de fondo?

- [ ] Borrar dos de las preguntas
- [ ] Añadir una nota en cada dashboard explicando la diferencia
- [x] Definir la métrica una vez (capa semántica o tabla mart) y que todas las preguntas la usen
- [ ] Pasar a otra herramienta de BI

> Borrar preguntas no evita que mañana alguien escriba la cuarta. La métrica tiene que vivir en un solo sitio: un mart `clientes_activos` en el warehouse o una métrica de la capa semántica, con la definición acordada con negocio y documentada. Las preguntas consumen esa definición, nunca la reescriben.

## flash: ¿Qué es un contrato de datos y qué contiene?

Un acuerdo explícito y versionado entre el productor de un dato (por ejemplo, el equipo de la app) y sus consumidores (el equipo de datos). Contiene:

- **esquema** (columnas, tipos, nulos),
- **semántica** (qué significa cada campo),
- **SLA** (frescura, disponibilidad),
- **reglas de cambio** (avisos y versionado).

Lo ideal es validarlo en el CI del productor para que un cambio incompatible no llegue a producción.
