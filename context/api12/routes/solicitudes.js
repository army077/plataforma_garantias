// routes/solicitudes.js
const express = require("express");
const router = express.Router();
const { pool, withTransaction } = require("../db");

// mapas de transiciones permitidas
const SOL_EST = {
  CREADA: "CREADA",
  EN_REVISION: "EN_REVISION",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
  LIBERADA: "LIBERADA",
  ENTREGADA: "ENTREGADA",
  CERRADA: "CERRADA",
  CANCELADA: "CANCELADA",
};
const PIEZA_EST = {
  SOLICITADA: "SOLICITADA",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
  LIBERADA: "LIBERADA",
  ENTREGADA: "ENTREGADA",
  CANCELADA: "CANCELADA",
};

const SOL_TRANSICIONES = {
  [SOL_EST.CREADA]: [SOL_EST.EN_REVISION, SOL_EST.CANCELADA],
  [SOL_EST.EN_REVISION]: [SOL_EST.APROBADA, SOL_EST.RECHAZADA, SOL_EST.CANCELADA],
  [SOL_EST.APROBADA]: [SOL_EST.LIBERADA, SOL_EST.CANCELADA],
  [SOL_EST.LIBERADA]: [SOL_EST.ENTREGADA],
  [SOL_EST.ENTREGADA]: [SOL_EST.CERRADA],
  [SOL_EST.RECHAZADA]: [],
  [SOL_EST.CERRADA]: [],
  [SOL_EST.CANCELADA]: [],
};

const PIEZA_TRANSICIONES = {
  [PIEZA_EST.SOLICITADA]: [PIEZA_EST.APROBADA, PIEZA_EST.RECHAZADA, PIEZA_EST.CANCELADA],
  [PIEZA_EST.APROBADA]: [PIEZA_EST.LIBERADA, PIEZA_EST.CANCELADA],
  [PIEZA_EST.LIBERADA]: [PIEZA_EST.ENTREGADA],
  [PIEZA_EST.ENTREGADA]: [],
  [PIEZA_EST.RECHAZADA]: [],
  [PIEZA_EST.CANCELADA]: [],
};

// helpers: obtener id del catálogo de estados por code
async function getEstadoId(client, tabla, code) {
  const r = await client.query(
    `SELECT id FROM ${tabla} WHERE code = $1`,
    [code]
  );
  if (!r.rowCount) throw new Error(`Estado no encontrado: ${tabla}.${code}`);
  return r.rows[0].id;
}

// LIST con filtros y paginación estilo refine (_start/_end)
/*
router.get("/", async (req, res) => {
  try {
    const {
      q,
      estado,            // code de estados_solicitud
      prioridad,         // nombre en catálogo prioridades
      cliente,           // id numérico
      desde, hasta,      // rango fecha creado_en (date)
      _start, _end,      // paginación
      _sort, _order,     // orden
      email              // <- nuevo: "all" o correo
    } = req.query;

    const values = [];
    let where = "WHERE 1=1";

    if (q) {
      values.push(`%${q}%`);
      where += ` AND (
        CAST(s.id AS TEXT) ILIKE $${values.length}
        OR t.numero ILIKE $${values.length}
        OR c.razon_social ILIKE $${values.length}
        OR s.email ILIKE $${values.length}
      )`;
    }

    if (estado) { values.push(estado); where += ` AND es.code = $${values.length}`; }
    if (prioridad) { values.push(prioridad); where += ` AND p.nombre = $${values.length}`; }
    if (cliente && /^\d+$/.test(cliente)) { values.push(Number(cliente)); where += ` AND s.cliente_id = $${values.length}`; }
    if (desde) { values.push(desde); where += ` AND s.creado_en::date >= $${values.length}`; }
    if (hasta) { values.push(hasta); where += ` AND s.creado_en::date <= $${values.length}`; }

    // ------ Filtro por email SIN middleware ------
    if (email && email.toLowerCase() !== "all") {
      values.push(email);               // CITEXT hace la comparación case-insensitive
      where += ` AND s.email = $${values.length}`;
    }
    // Si quieres que sin email no regrese nada, descomenta:
    // if (!email) { res.set("X-Total-Count","0"); return res.json([]); }
    // ---------------------------------------------

    // Total
    const totalSql = `
      SELECT COUNT(*)
      FROM solicitudes s
      LEFT JOIN estados_solicitud es ON es.id = s.estado_id
      LEFT JOIN prioridades p ON p.id = s.prioridad_id
      LEFT JOIN tickets t ON t.id = s.ticket_id
      LEFT JOIN clientes c ON c.id = s.cliente_id
      ${where}
    `;
    const total = Number((await pool.query(totalSql, values)).rows[0].count);

    // Orden
    let orderBy = "ORDER BY s.creado_en DESC";
    if (_sort && _order) {
      const sort = ["id","creado_en"].includes(_sort) ? _sort : "creado_en";
      const order = String(_order).toUpperCase() === "ASC" ? "ASC" : "DESC";
      orderBy = `ORDER BY s.${sort} ${order}`;
    }

    // Paginación
    let limitOffset = "";
    if (_start !== undefined && _end !== undefined) {
      const limit = Math.max(0, Number(_end) - Number(_start));
      values.push(limit, Number(_start));
      limitOffset = ` LIMIT $${values.length-1} OFFSET $${values.length}`;
    }

    // Datos
    const sql = `
      SELECT s.*, es.code AS estado_code, es.nombre AS estado_nombre,
             p.nombre AS prioridad_nombre,
             t.numero AS ticket_numero, t.id_externo AS ticket_externo,
             c.razon_social
      FROM solicitudes s
      LEFT JOIN estados_solicitud es ON es.id = s.estado_id
      LEFT JOIN prioridades p ON p.id = s.prioridad_id
      LEFT JOIN tickets t ON t.id = s.ticket_id
      LEFT JOIN clientes c ON c.id = s.cliente_id
      ${where} ${orderBy} ${limitOffset}
    `;
    const rows = (await pool.query(sql, values)).rows;

    res.set("X-Total-Count", String(total));
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
*/

router.get("/monedas", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM monedas");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener las monedas" });
  }
});

router.get("/items", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM solicitud_items");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los items" });
  }
});

// LIST con filtros y paginación
router.get("/", async (req, res) => {
  try {
    const {
      q,
      estado,
      prioridad,
      cliente,
      desde, hasta,
      _start, _end,
      _sort, _order,
      email
    } = req.query;

    const values = [];
    let where = "WHERE 1=1";

    // --- Búsqueda libre: usa snapshot (s.*) y cae a tablas relacionadas ---
    if (q) {
      values.push(`%${q}%`);
      const idx = `$${values.length}`;
      where += `
        AND (
          CAST(s.id AS TEXT) ILIKE ${idx}
          OR COALESCE(s.ticket_numero, t.numero, '') ILIKE ${idx}
          OR COALESCE(s.ticket_id_externo, t.id_externo, '') ILIKE ${idx}
          OR COALESCE(s.cliente_nombre, c.razon_social, '') ILIKE ${idx}
          OR s.email ILIKE ${idx}
        )
      `;
    }

    if (estado)   { values.push(estado);   where += ` AND es.code = $${values.length}`; }
    if (prioridad){ values.push(prioridad);where += ` AND p.nombre = $${values.length}`; }
    if (cliente && /^\d+$/.test(cliente)) { values.push(Number(cliente)); where += ` AND s.cliente_id = $${values.length}`; }
    if (desde)    { values.push(desde);    where += ` AND s.creado_en::date >= $${values.length}`; }
    if (hasta)    { values.push(hasta);    where += ` AND s.creado_en::date <= $${values.length}`; }

    // Filtro por email (sin middleware)
    if (email && email.toLowerCase() !== "all") {
      values.push(email);
      where += ` AND s.email = $${values.length}`;
    }

    // Total
    const totalSql = `
      SELECT COUNT(*)
      FROM solicitudes s
      LEFT JOIN estados_solicitud es ON es.id = s.estado_id
      LEFT JOIN prioridades p ON p.id = s.prioridad_id
      LEFT JOIN tickets t ON t.id = s.ticket_id
      LEFT JOIN clientes c ON c.id = s.cliente_id
      ${where}
    `;
    const total = Number((await pool.query(totalSql, values)).rows[0].count);

    // Orden
    let orderBy = "ORDER BY s.creado_en DESC";
    if (_sort && _order) {
      const sort  = ["id","creado_en"].includes(_sort) ? _sort : "creado_en";
      const order = String(_order).toUpperCase() === "ASC" ? "ASC" : "DESC";
      orderBy = `ORDER BY s.${sort} ${order}`;
    }

    // Paginación
    let limitOffset = "";
    if (_start !== undefined && _end !== undefined) {
      const limit = Math.max(0, Number(_end) - Number(_start));
      values.push(limit, Number(_start));
      limitOffset = ` LIMIT $${values.length-1} OFFSET $${values.length}`;
    }

    // Datos: exponer “planos con fallback”
    const sql = `
      SELECT
        s.*,
        es.code  AS estado_code,
        es.nombre AS estado_nombre,
        p.nombre AS prioridad_nombre,

        -- campos para frontend
        COALESCE(s.ticket_numero,      t.numero)     AS ticket_numero,
        COALESCE(s.ticket_id_externo,  t.id_externo) AS ticket_id_externo,
        COALESCE(s.cliente_nombre,     c.razon_social) AS cliente_nombre,

        -- etiquetas útiles ya listas
        COALESCE(s.cliente_nombre, c.razon_social, 'Sin cliente') AS cliente_label,
        COALESCE(s.ticket_numero,  t.numero, s.ticket_id_externo, t.id_externo, 'N/A') AS ticket_label

      FROM solicitudes s
      LEFT JOIN estados_solicitud es ON es.id = s.estado_id
      LEFT JOIN prioridades p       ON p.id  = s.prioridad_id
      LEFT JOIN tickets t           ON t.id  = s.ticket_id
      LEFT JOIN clientes c          ON c.id  = s.cliente_id
      ${where}
      ${orderBy}
      ${limitOffset}
    `;
    const rows = (await pool.query(sql, values)).rows;

    res.set("X-Total-Count", String(total));
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});


// GET detalle (incluye items y bitácora)
/*
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cab = await pool.query(
      `SELECT s.*, es.code AS estado_code, es.nombre AS estado_nombre,
              p.nombre AS prioridad_nombre,
              t.numero AS ticket_numero, t.id_externo AS ticket_externo,
              c.razon_social
       FROM solicitudes s
       LEFT JOIN estados_solicitud es ON es.id = s.estado_id
       LEFT JOIN prioridades p ON p.id = s.prioridad_id
       LEFT JOIN tickets t ON t.id = s.ticket_id
       LEFT JOIN clientes c ON c.id = s.cliente_id
       WHERE s.id = $1`, [id]
    );
    if (!cab.rowCount) return res.status(404).json({ error: "No existe" });

    const items = await pool.query(
      `SELECT i.*, ep.code AS estado_pieza_code, ep.nombre AS estado_pieza_nombre,
              pr.clave_prod, pr.desc_prod, pr.uni_med
       FROM solicitud_items i
       LEFT JOIN estados_pieza ep ON ep.id = i.estado_pieza_id
       LEFT JOIN productos pr ON pr.id = i.producto_id
       WHERE i.solicitud_id = $1
       ORDER BY i.id ASC`, [id]
    );

    const bitacora = await pool.query(
      `SELECT b.*, u.nombre AS actor
       FROM bitacora b
       LEFT JOIN usuarios u ON u.id = b.actor_id
       WHERE b.solicitud_id = $1
       ORDER BY b.ts DESC`, [id]
    );

    res.json({ ...cab.rows[0], items: items.rows, bitacora: bitacora.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
*/

// GET detalle (incluye items y bitácora)
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "Parámetro id inválido" });
  }

  try {
    const cab = await pool.query(
      `
      SELECT
        s.*,
        es.code   AS estado_code,
        es.nombre AS estado_nombre,
        p.nombre  AS prioridad_nombre,

        -- Si aún existieran tablas tickets/clientes, las dejamos como respaldo
        t.numero       AS t_numero,
        t.id_externo   AS t_id_externo,
        c.razon_social AS c_razon_social,

        -- Labels para UI: prefieren lo guardado en solicitudes; si no hay, caen al join
        COALESCE(s.cliente_nombre, c.razon_social, 'Sin cliente') AS cliente_label,
        COALESCE(NULLIF(s.ticket_numero, ''),
                 s.ticket_id_externo,
                 NULLIF(t.numero, ''),
                 t.id_externo,
                 'N/A') AS ticket_label
      FROM solicitudes s
      LEFT JOIN estados_solicitud es ON es.id = s.estado_id
      LEFT JOIN prioridades       p  ON p.id  = s.prioridad_id
      LEFT JOIN tickets           t  ON t.id  = s.ticket_id        -- opcional
      LEFT JOIN clientes          c  ON c.id  = s.cliente_id       -- opcional
      WHERE s.id = $1
      `,
      [id]
    );

    if (!cab.rowCount) return res.status(404).json({ error: "No existe" });

    const items = await pool.query(
      `
      SELECT
        i.*,
        ep.code   AS estado_pieza_code,
        ep.nombre AS estado_pieza_nombre,
        pr.clave_prod, pr.desc_prod, pr.uni_med
      FROM solicitud_items i
      LEFT JOIN estados_pieza ep ON ep.id = i.estado_pieza_id
      LEFT JOIN productos   pr   ON pr.id = i.producto_id
      WHERE i.solicitud_id = $1 AND eliminado = false
      ORDER BY i.id ASC
      `,
      [id]
    );

    const bitacora = await pool.query(
      `
      SELECT b.*, u.nombre AS actor
      FROM bitacora b
      LEFT JOIN usuarios u ON u.id = b.actor_id
      WHERE b.solicitud_id = $1
      ORDER BY b.ts DESC
      `,
      [id]
    );

    res.json({ ...cab.rows[0], items: items.rows, bitacora: bitacora.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST crear solicitud
/*
router.post("/", async (req, res) => {
  const {
    email, usuario_id, prioridad_id, ticket_id, cliente_id,
    soporte_para = "Garantía", tipo_garantia_id, gestion_garantia_id,
    sla_horas, vencimiento_seguimiento, observaciones
  } = req.body;

  try {
    const r = await withTransaction(async (client) => {
      const estadoId = await getEstadoId(client, "estados_solicitud", SOL_EST.CREADA);
      const ins = await client.query(
        `INSERT INTO solicitudes
         (email, usuario_id, prioridad_id, ticket_id, cliente_id,
          soporte_para, tipo_garantia_id, gestion_garantia_id,
          estado_id, sla_horas, vencimiento_seguimiento, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [email, usuario_id, prioridad_id, ticket_id, cliente_id,
         soporte_para, tipo_garantia_id, gestion_garantia_id,
         estadoId, sla_horas ?? null, vencimiento_seguimiento ?? null, observaciones ?? null]
      );
      const row = ins.rows[0];

      await client.query(
        `INSERT INTO bitacora (actor_id, solicitud_id, accion, nota)
         VALUES ($1,$2,'CREAR',$3)`,
        [usuario_id ?? null, row.id, 'Solicitud creada']
      );
      return row;
    });

    res.status(201).json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
*/

router.post("/", async (req, res) => {
  const {
    email,
    usuario_id,
    prioridad_id,
    ticket_numero,
    ticket_id_externo,
    cliente_nombre,
    soporte_para = "Garantía",
    tipo_garantia_id,
    gestion_garantia_id,
    sla_horas,
    vencimiento_seguimiento,
    observaciones,
  } = req.body;

  try {
    const r = await withTransaction(async (client) => {
      // estado inicial de la solicitud
      const estadoId = await getEstadoId(
        client,
        "estados_solicitud",
        SOL_EST.CREADA
      );

      // Inserta solicitud
      const ins = await client.query(
        `INSERT INTO solicitudes
          (email, usuario_id, prioridad_id,
           ticket_numero, ticket_id_externo, cliente_nombre,
           soporte_para, tipo_garantia_id, gestion_garantia_id,
           estado_id, sla_horas, vencimiento_seguimiento, observaciones)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          email,
          usuario_id,
          prioridad_id,
          ticket_numero,
          ticket_id_externo,
          cliente_nombre,
          soporte_para,
          tipo_garantia_id,
          gestion_garantia_id,
          estadoId,
          sla_horas ?? null,
          vencimiento_seguimiento ?? null,
          observaciones ?? null,
        ]
      );

      const row = ins.rows[0];

      // Bitácora
      await client.query(
        `INSERT INTO bitacora (actor_id, solicitud_id, accion, nota)
         VALUES ($1,$2,'CREAR',$3)`,
        [usuario_id ?? null, row.id, "Solicitud creada"]
      );

      return row;
    });

    res.status(201).json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST agregar item a solicitud
router.post("/:id/items", async (req, res) => {
  const solicitudId = Number(req.params.id);
  const {
    actor_id, producto_id, numero_parte, descripcion, cantidad = 1, unidad,
    motivo, comentarios, moneda_precio, moneda_costo,
    precio_unitario, costo_unitario
  } = req.body;

  try {
    const r = await withTransaction(async (client) => {
      // estado inicial de pieza
      const estadoPiezaId = await getEstadoId(client, "estados_pieza", PIEZA_EST.SOLICITADA);
      const precioTotal = precio_unitario ? Number(precio_unitario) * Number(cantidad) : null;
      const costoTotal  = costo_unitario ? Number(costo_unitario) * Number(cantidad) : null;

      const ins = await client.query(
        `INSERT INTO solicitud_items
         (solicitud_id, producto_id, numero_parte, descripcion, cantidad, unidad,
          motivo, comentarios, estado_pieza_id,
          moneda_precio, moneda_costo, precio_unitario, costo_unitario,
          precio_total, costo_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [solicitudId, producto_id ?? null, numero_parte ?? null, descripcion ?? null,
         cantidad, unidad ?? null, motivo ?? null, comentarios ?? null, estadoPiezaId,
         moneda_precio ?? null, moneda_costo ?? null, precio_unitario ?? null, costo_unitario ?? null,
         precioTotal, costoTotal]
      );

      await client.query(
        `INSERT INTO bitacora (actor_id, solicitud_id, item_id, accion, nota)
         VALUES ($1,$2,$3,'AGREGAR_ITEM',$4)`,
        [actor_id, solicitudId, ins.rows[0].id, `Item agregado ${numero_parte || ""}`]
      );

      return ins.rows[0];
    });

    res.status(201).json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:solId/items/:itemId", async (req, res) => {
  const solicitudId = Number(req.params.solId);
  const itemId = Number(req.params.itemId);
  const { actor_id } = req.body;

  try {
    const r = await withTransaction(async (client) => {
      // Validar existencia
      const itemRes = await client.query(
        `SELECT *
           FROM solicitud_items
          WHERE id = $1
            AND solicitud_id = $2
            AND eliminado = false`,
        [itemId, solicitudId]
      );

      if (itemRes.rowCount === 0) {
        throw new Error("Item no encontrado o ya eliminado");
      }

      const item = itemRes.rows[0];

      // Soft delete
      await client.query(
        `UPDATE solicitud_items
            SET eliminado = true
          WHERE id = $1`,
        [itemId]
      );

      // Bitácora
      await client.query(
        `INSERT INTO bitacora (actor_id, solicitud_id, item_id, accion, nota)
         VALUES ($1,$2,$3,'ELIMINAR_ITEM',$4)`,
        [
          actor_id,
          solicitudId,
          itemId,
          `Item eliminado ${item.numero_parte || item.descripcion || ""}`
        ]
      );

      return { ok: true, item_id: itemId };
    });

    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST transición de estado de solicitud
router.post("/:id/estado", async (req, res) => {
  const id = Number(req.params.id);
  const { actor_id, a, nota } = req.body; // 'a' = estado destino (code)
  try {
    const r = await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT s.id, es.code AS code FROM solicitudes s
         JOIN estados_solicitud es ON es.id = s.estado_id
         WHERE s.id = $1`, [id]
      );
      if (!cur.rowCount) throw new Error("Solicitud no existe");
      const actual = cur.rows[0].code;

      const permitidas = SOL_TRANSICIONES[actual] || [];
      if (!permitidas.includes(a)) {
        throw new Error(`Transición inválida ${actual} → ${a}`);
      }
      const nuevoId = await getEstadoId(client, "estados_solicitud", a);

      await client.query(`UPDATE solicitudes SET estado_id = $1 WHERE id = $2`, [nuevoId, id]);
      await client.query(
        `INSERT INTO bitacora (actor_id, solicitud_id, accion, de, a, nota)
         VALUES ($1,$2,'CAMBIAR_ESTADO',$3,$4,$5)`,
        [actor_id ?? null, id, actual, a, nota ?? null]
      );
      return { id, de: actual, a };
    });

    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

// POST transición de estado de item
router.post("/items/:itemId/estado", async (req, res) => {
  const itemId = Number(req.params.itemId);
  const { actor_id, a, nota } = req.body;
  try {
    const r = await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT i.id, i.solicitud_id, ep.code AS code
         FROM solicitud_items i
         JOIN estados_pieza ep ON ep.id = i.estado_pieza_id
         WHERE i.id = $1`, [itemId]
      );
      if (!cur.rowCount) throw new Error("Item no existe");
      const { solicitud_id, code: actual } = cur.rows[0];

      const permitidas = PIEZA_TRANSICIONES[actual] || [];
      if (!permitidas.includes(a)) {
        throw new Error(`Transición inválida de pieza ${actual} → ${a}`);
      }
      const nuevoId = await getEstadoId(client, "estados_pieza", a);

      await client.query(`UPDATE solicitud_items SET estado_pieza_id = $1 WHERE id = $2`, [nuevoId, itemId]);
      await client.query(
        `INSERT INTO bitacora (actor_id, solicitud_id, item_id, accion, de, a, nota)
         VALUES ($1,$2,$3,'CAMBIAR_ESTADO_PIEZA',$4,$5,$6)`,
        [actor_id ?? null, solicitud_id, itemId, actual, a, nota ?? null]
      );
      return { item_id: itemId, de: actual, a };
    });

    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

// PUT - actualizar clasificacion_garantia por ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { clasificacion_garantia, folio_sai, medio_entrega } = req.body;

  if (!clasificacion_garantia) {
    return res.status(400).json({ error: "Falta clasificacion_garantia" });
  }

  try {
    const result = await pool.query(
      `UPDATE solicitudes
       SET clasificacion_garantia = $1, folio_sai = $2, medio_entrega = $3
       WHERE id = $4
       RETURNING *`,
      [clasificacion_garantia, folio_sai, medio_entrega, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al actualizar clasificacion_garantia:", err);
    res.status(500).json({ error: "Error interno al actualizar la solicitud" });
  }
});

// PUT - cerrar solicitud solo guardando fecha_salida
router.put("/:id/cerrar", async (req, res) => {
  const { id } = req.params;
  const { fecha_salida } = req.body;

  if (!fecha_salida) {
    return res.status(400).json({ error: "Falta fecha_salida" });
  }

  try {
    const result = await pool.query(
      `UPDATE solicitudes
       SET fecha_salida = $1
       WHERE id = $2
       RETURNING *`,
      [fecha_salida, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al actualizar fecha_salida:", err);
    res.status(500).json({ error: "Error interno al actualizar la solicitud" });
  }
});

// PUT - actualizar motivo de un item
/*
router.put("/motivo_item/:sid/items/:iid", async (req, res) => {
  const { sid, iid } = req.params;
  const { status, motivo } = req.body;

  // Permitir actualizar uno o ambos
  if (motivo == null && status == null) {
    return res.status(400).json({ error: "Falta motivo o status" });
  }

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE solicitud_items
       SET 
         motivo = COALESCE($1, motivo),
         status = COALESCE($2, status)
       WHERE id = $3 AND solicitud_id = $4
       RETURNING *`,
      [motivo, status, iid, sid]
    );

    if (!rowCount) {
      return res.status(404).json({ error: "Item no encontrado" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("set motivo item:", err.message);
    res.status(500).json({ error: "Error al actualizar el item" });
  }
});
*/

/*
router.put("/motivo_item/:sid/items/:iid", async (req, res) => {
  const { sid, iid } = req.params;
  const { status, motivo, cantidad } = req.body;

  // Acepta cualquier combinación de campos válidos
  const fields = [];
  const values = [];
  let idx = 1;

  if (motivo !== undefined) {
    fields.push(`motivo = $${idx++}`);
    values.push(motivo);
  }
  if (status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(status);
  }
  if (cantidad !== undefined) {
    fields.push(`cantidad = $${idx++}`);
    values.push(cantidad);
  }

  if (!fields.length) {
    return res.status(400).json({ error: "Nada para actualizar" });
  }

  values.push(iid);
  values.push(sid);

  const sql = `
    UPDATE solicitud_items
    SET ${fields.join(", ")}
    WHERE id = $${idx++} AND solicitud_id = $${idx}
    RETURNING *;
  `;

  try {
    const { rows, rowCount } = await pool.query(sql, values);
    if (!rowCount) return res.status(404).json({ error: "Item no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error al actualizar item:", err.message);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});
*/

router.put("/motivo_item/:sid/items/:iid", async (req, res) => {
  const { sid, iid } = req.params;
  const { status, motivo, cantidad } = req.body;

  // Acepta cualquier combinación de campos válidos
  const fields = [];
  const values = [];
  let idx = 1;

  if (motivo !== undefined) {
    fields.push(`motivo = $${idx++}`);
    values.push(motivo);
  }
  if (status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(status);
  }
  if (cantidad !== undefined) {
    fields.push(`cantidad = $${idx++}`);
    values.push(cantidad);
    // también recalcula costo_total si hay cantidad
    fields.push(`costo_total = ROUND($${idx - 1} * COALESCE(costo_unitario, 0), 2)`);
  }

  if (!fields.length) {
    return res.status(400).json({ error: "Nada para actualizar" });
  }

  values.push(iid);
  values.push(sid);

  const sql = `
    UPDATE solicitud_items
    SET ${fields.join(", ")}
    WHERE id = $${idx++} AND solicitud_id = $${idx}
    RETURNING id, solicitud_id, numero_parte, descripcion, cantidad, costo_unitario, costo_total, motivo, status;
  `;

  try {
    const { rows, rowCount } = await pool.query(sql, values);
    if (!rowCount) return res.status(404).json({ error: "Item no encontrado" });
    res.json({
      message: "Item actualizado correctamente",
      item: rows[0],
    });
  } catch (err) {
    console.error("Error al actualizar item:", err.message);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});


// PUT - actualizar costo_unitario de un item específico
/*
router.put("/costo_item/:sid/items/:iid", async (req, res) => {
  const { sid, iid } = req.params;
  const { costo_unitario } = req.body;

  if (costo_unitario == null || isNaN(Number(costo_unitario))) {
    return res.status(400).json({ error: "Falta o es inválido el costo_unitario" });
  }

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE solicitud_items
       SET costo_unitario = $1,
           costo_total = cantidad * $1
       WHERE id = $2 AND solicitud_id = $3
       RETURNING *`,
      [costo_unitario, iid, sid]
    );

    if (!rowCount) return res.status(404).json({ error: "Item no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error al actualizar costo_unitario:", err.message);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});*/

// PUT - actualizar costo unitario y total de un item
router.put("/costo_item/:sid/items/:iid", async (req, res) => {
  const { sid, iid } = req.params;
  const { costo_unitario } = req.body;

  if (costo_unitario == null || isNaN(Number(costo_unitario))) {
    return res.status(400).json({ error: "Falta o es inválido el costo_unitario" });
  }

  try {
    // recalcula costo_total directamente desde la cantidad actual
    const query = `
      UPDATE solicitud_items
      SET 
        costo_unitario = $1,
        costo_total = ROUND(cantidad * $1, 2)
      WHERE id = $2 AND solicitud_id = $3
      RETURNING id, solicitud_id, numero_parte, descripcion, cantidad, costo_unitario, costo_total;
    `;

    const { rows, rowCount } = await pool.query(query, [
      Number(costo_unitario),
      iid,
      sid,
    ]);

    if (!rowCount) {
      return res.status(404).json({ error: "Item no encontrado" });
    }

    res.json({
      message: "Costo actualizado correctamente",
      item: rows[0],
    });
  } catch (err) {
    console.error("Error al actualizar costo_unitario:", err.message);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// PUT - actualizar descripción de un item específico
router.put("/descripcion_item/:sid/items/:iid", async (req, res) => {
  const { sid, iid } = req.params;
  const { descripcion } = req.body;

  if (!descripcion || descripcion.trim() === "") {
    return res.status(400).json({ error: "Descripción vacía" });
  }

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE solicitud_items
       SET descripcion = $1
       WHERE id = $2 AND solicitud_id = $3
       RETURNING *`,
      [descripcion.trim(), iid, sid]
    );

    if (!rowCount) return res.status(404).json({ error: "Item no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error al actualizar descripción:", err.message);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

router.put("/tecnico/:id", async (req, res) => {
  const { id } = req.params;
  const { tecnico } = req.body;

  try {
    const result = await pool.query(
      `UPDATE solicitudes
       SET tecnico = $1
       WHERE id = $2
       RETURNING *`,
      [tecnico, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error al agregar tecnico:", err);
    res.status(500).json({ error: "Error interno al actualizar la solicitud" });
  }
});


module.exports = router;
