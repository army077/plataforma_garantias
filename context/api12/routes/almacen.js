// routes/almacen.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { pool } = require("../db");
const almacenAdmin = require("../firebase_almacen");
const autorizarRoles = require("../middleware/autorizarRoles");

function normalizarOrdenProduccion(value) {
    if (value == null) return value;
    const orden = String(value).trim();
    const match = /^OP\s*(\d+)$/i.exec(orden);
    return match ? match[1] : orden;
}

/* ============================================================
   🧱 BOOTSTRAP: tabla de órdenes de producción cerradas
   - Una OP listada aquí NO admite nuevas solicitudes.
============================================================ */
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ordenes_cerradas (
                orden_produccion VARCHAR(50) PRIMARY KEY,
                cerrada_en       TIMESTAMP    NOT NULL DEFAULT now(),
                cerrada_por      INTEGER      NULL REFERENCES usuarios_almacen(id)
            )
        `);
    } catch (e) {
        console.error("⚠️ No se pudo asegurar tabla ordenes_cerradas:", e.message);
    }
})();

// Resuelve un usuario_almacen a partir de un PIN (devuelve null si no coincide).
async function buscarUsuarioPorPin(pin) {
    if (!pin) return null;
    const q = await pool.query(`SELECT id, nombre, pin_hash FROM usuarios_almacen`);
    for (const u of q.rows) {
        // eslint-disable-next-line no-await-in-loop
        if (await bcrypt.compare(String(pin), u.pin_hash)) return u;
    }
    return null;
}

// Devuelve true si la orden está marcada como cerrada.
async function ordenEstaCerrada(orden) {
    if (!orden) return false;
    const q = await pool.query(
        `SELECT 1 FROM ordenes_cerradas WHERE orden_produccion = $1 LIMIT 1`,
        [normalizarOrdenProduccion(orden)]
    );
    return q.rowCount > 0;
}

// PIN
/* ============================================================
   🔒 1) VALIDAR PIN Y RETORNAR USUARIO
============================================================ */
async function validarPIN(pin, usuarioId) {
    const q = await pool.query(
        `SELECT id, nombre, pin_hash
         FROM usuarios_almacen
         WHERE id = $1`,
        [usuarioId]
    );

    if (q.rowCount === 0) return null;

    const user = q.rows[0];
    const ok = await bcrypt.compare(pin, user.pin_hash);

    if (!ok) return null;

    return user;
}

/* ============================================================
   📝 2) Registrar acción en bitácora
============================================================ */
async function logAccion(movimiento_id, usuario_id, accion, detalle = "") {
    await pool.query(
        `INSERT INTO bitacora_almacen (movimiento_id, usuario_id, accion, detalle)
         VALUES ($1, $2, $3, $4)`,
        [movimiento_id, usuario_id, accion, detalle]
    );
}

// Listar usuarios de almacén
router.get("/usuarios_almacen", async (req, res) => {
    try {
        const q = await pool.query(`
            SELECT id, nombre, rol, creado_en
            FROM usuarios_almacen
            ORDER BY id ASC
        `);
        res.json(q.rows);
    } catch (err) {
        console.error("Error listando usuarios:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

router.get("/usuarios_almacen/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const q = await pool.query(`
            SELECT id, nombre, rol, creado_en
            FROM usuarios_almacen
            WHERE id = $1
        `, [id]);

        if (!q.rowCount) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json(q.rows[0]);
    } catch (err) {
        console.error("Error obteniendo usuario:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// Crear usuario de almacén
router.post("/usuarios_almacen", async (req, res) => {
    try {
        const { nombre, rol, pin } = req.body;

        if (!pin || pin.length < 4) {
            return res.status(400).json({ error: "PIN mínimo de 4 dígitos." });
        }

        const pin_hash = await bcrypt.hash(pin, 10);

        const q = await pool.query(
            `INSERT INTO usuarios_almacen (nombre, rol, pin_hash)
             VALUES ($1, $2, $3)
             RETURNING id, nombre, rol, creado_en`,
            [nombre, rol, pin_hash]
        );

        res.json(q.rows[0]);
    } catch (err) {
        console.error("Error creando usuario almacen:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

router.put("/usuarios_almacen/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, rol } = req.body;

        const q = await pool.query(`
            UPDATE usuarios_almacen
            SET nombre = $1,
                rol = $2
            WHERE id = $3
            RETURNING id, nombre, rol, creado_en
        `, [nombre, rol, id]);

        if (!q.rowCount) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json(q.rows[0]);
    } catch (err) {
        console.error("Error actualizando usuario:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

router.delete("/usuarios_almacen/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const q = await pool.query(`
            DELETE FROM usuarios_almacen
            WHERE id = $1
        `, [id]);

        if (!q.rowCount) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({ ok: true, mensaje: "Usuario eliminado" });
    } catch (err) {
        console.error("Error eliminando usuario:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

router.put("/usuarios_almacen/reset_pin/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevo_pin } = req.body;

        if (!nuevo_pin || nuevo_pin.length < 4) {
            return res.status(400).json({ error: "PIN mínimo de 4 dígitos" });
        }

        const pin_hash = await bcrypt.hash(nuevo_pin, 10);

        const q = await pool.query(`
            UPDATE usuarios_almacen
            SET pin_hash = $1
            WHERE id = $2
            RETURNING id, nombre, rol
        `, [pin_hash, id]);

        if (!q.rowCount) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({ ok: true, mensaje: "PIN actualizado" });

    } catch (err) {
        console.error("Error reseteando PIN:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

router.post("/usuarios_almacen/validar_pin", async (req, res) => {
    try {
        const { pin } = req.body;

        if (!pin) {
            return res.status(400).json({ error: "PIN requerido" });
        }

        const q = await pool.query(`
            SELECT id, nombre, pin_hash
            FROM usuarios_almacen
        `);

        const bcrypt = require("bcrypt");
        let usuario = null;

        for (const u of q.rows) {
            const match = await bcrypt.compare(pin, u.pin_hash);
            if (match) usuario = u;
        }

        if (!usuario) {
            return res.status(401).json({ valido: false });
        }

        res.json({
            valido: true,
            usuario: { id: usuario.id, nombre: usuario.nombre }
        });

    } catch (err) {
        console.error("Error validando PIN:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

// GET todas las solicitudes del almacén
router.get("/movimientos", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM almacen_movimientos
       ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error GET /movimientos:", error);
    res.status(500).json({ error: "Error al obtener movimientos" });
  }
});

// POST crear nuevo movimiento
router.post("/crear", async (req, res) => {
  try {
    const {
      persona,
      estacion,
      orden_produccion,
      numero_parte,
      descripcion,
      cantidad,
      concepto_liberacion
    } = req.body;

    // 🚫 Bloquear creación si la OP ya está cerrada
    if (await ordenEstaCerrada(orden_produccion)) {
      return res.status(409).json({
        error: `La Orden ${orden_produccion} está cerrada. No se pueden registrar más movimientos.`,
        codigo: "OP_CERRADA",
        orden_produccion
      });
    }

    const result = await pool.query(
      `INSERT INTO almacen_movimientos
        (persona, estacion, orden_produccion, numero_parte, descripcion, cantidad, concepto_liberacion, estatus_movimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7, 'SIN ENTREGAR')
       RETURNING *`,
      [
        persona,
        estacion,
        normalizarOrdenProduccion(orden_produccion),
        numero_parte,
        descripcion,
        cantidad,
        concepto_liberacion
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error POST /crear:", error);
    res.status(500).json({ error: "Error al crear movimiento" });
  }
});

/* ============================================================
   📌 4) CREAR MOVIMIENTO (CON USUARIO Y BITÁCORA)
============================================================ */
/*
router.post("/crear_pin", async (req, res) => {
    try {
        const {
            persona,
            estacion,
            orden_produccion,
            numero_parte,
            descripcion,
            cantidad,
            concepto_liberacion,
            usuario_id,    // <- ID del usuario que firma con PIN
            pin            // <- PIN para validar
        } = req.body;

        // Validar PIN
        const user = await validarPIN(pin, usuario_id);
        if (!user) return res.status(401).json({ error: "PIN incorrecto" });

        const result = await pool.query(
            `INSERT INTO almacen_movimientos
                (persona, estacion, orden_produccion, numero_parte, descripcion,
                 cantidad, concepto_liberacion, estatus_movimiento, solicitado_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'SIN ENTREGAR',$8)
             RETURNING *`,
            [
                persona,
                estacion,
                orden_produccion,
                numero_parte,
                descripcion,
                cantidad,
                concepto_liberacion,
                user.id
            ]
        );

        const movimiento = result.rows[0];

        await logAccion(movimiento.id, user.id, "CREAR", "Solicitud creada.");

        res.json(movimiento);
    } catch (error) {
        console.error("❌ Error POST /crear:", error);
        res.status(500).json({ error: "Error al crear movimiento" });
    }
});
*/

router.post("/crear_pin", async (req, res) => {
    try {
        const {
            pin,
            estacion,
            orden_produccion,
            numero_parte,
            descripcion,
            cantidad,
            concepto_liberacion
        } = req.body;

        if (!pin) {
            return res.status(400).json({ error: "PIN requerido" });
        }

        // 🚫 Bloquear creación si la OP ya está cerrada
        if (await ordenEstaCerrada(orden_produccion)) {
            return res.status(409).json({
                error: `La Orden ${orden_produccion} está cerrada. No se pueden registrar más movimientos.`,
                codigo: "OP_CERRADA",
                orden_produccion
            });
        }

        // Buscar usuario por PIN
        const userQuery = await pool.query(`
            SELECT id, nombre, pin_hash 
            FROM usuarios_almacen
        `);

        const usuarios = userQuery.rows;

        const bcrypt = require("bcrypt");
        let usuario = null;

        for (const u of usuarios) {
            const ok = await bcrypt.compare(pin, u.pin_hash);
            if (ok) {
                usuario = u;
                break;
            }
        }

        if (!usuario) {
            return res.status(401).json({ error: "PIN incorrecto" });
        }

        // Insertar movimiento
        const result = await pool.query(
            `INSERT INTO almacen_movimientos
                (persona, estacion, orden_produccion, numero_parte, descripcion, cantidad,
                 concepto_liberacion, estatus_movimiento, solicitado_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'SIN ENTREGAR',$8)
             RETURNING *`,
            [
                usuario.nombre,   // persona automático
                estacion,
                normalizarOrdenProduccion(orden_produccion),
                numero_parte,
                descripcion,
                cantidad,
                concepto_liberacion,
                usuario.id         // solicitado_por automático
            ]
        );

        res.json(result.rows[0]);

    } catch (error) {
        console.error("❌ Error POST /crear:", error);
        res.status(500).json({ error: "Error al crear movimiento" });
    }
});


// POST para marcar atendido
router.post("/atender/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { atendio } = req.body;

    const result = await pool.query(
      `UPDATE almacen_movimientos
       SET status = 'ATENDIDO',
           atendio = $1,
           atendido_en = NOW()
       WHERE id = $2
       RETURNING *`,
      [atendio, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error POST /atender:", error);
    res.status(500).json({ error: "Error al atender movimiento" });
  }
});

/* ============================================================
   📌 5) ATENDER MOVIMIENTO (AUTOMÁTICO CON PIN)
============================================================ */
router.post("/atender_pin/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { pin } = req.body;

        if (!pin) {
            return res.status(400).json({ error: "PIN requerido" });
        }

        // 1. Buscar usuario por PIN
        const users = await pool.query(`
            SELECT id, nombre, pin_hash
            FROM usuarios_almacen
        `);

        const bcrypt = require("bcrypt");
        let usuario = null;

        for (const u of users.rows) {
            const ok = await bcrypt.compare(pin, u.pin_hash);
            if (ok) {
                usuario = u;
                break;
            }
        }

        if (!usuario) {
            return res.status(401).json({ error: "PIN incorrecto" });
        }

        // 2. Actualizar movimiento
        const result = await pool.query(
            `UPDATE almacen_movimientos
             SET status = 'ATENDIDO',
                 atendio = $1,
                 atendido_por = $2,
                 atendido_en = NOW()
             WHERE id = $3
             RETURNING *`,
            [usuario.nombre, usuario.id, id]
        );

        if (!result.rowCount) {
            return res.status(404).json({ error: "Movimiento no encontrado" });
        }

        // 3. Registrar en bitácora
        await pool.query(
            `INSERT INTO bitacora_almacen (movimiento_id, usuario_id, accion, detalle)
             VALUES ($1, $2, 'ATENDER', 'Movimiento atendido')`,
            [id, usuario.id]
        );

        // 4. Respuesta final
        res.json({
            ok: true,
            mensaje: "Movimiento atendido",
            atendido_por: usuario.nombre,
            movimiento: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Error POST /atender:", error);
        res.status(500).json({ error: "Error al atender movimiento" });
    }
});

// GET búsqueda de productos (simple)
router.get("/buscar", async (req, res) => {
  try {
    const q = req.query.q || "";
    const result = await pool.query(
      `SELECT id, clave_prod, desc_prod, uni_med
       FROM productos
       WHERE clave_prod ILIKE $1
          OR desc_prod ILIKE $1
       LIMIT 50`,
      [`%${q}%`]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error GET /buscar:", error);
    res.status(500).json({ error: "Error al buscar productos" });
  }
});

router.put("/movimientos/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const q = await pool.query(
      `UPDATE almacen_movimientos
       SET estatus_movimiento = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    res.json(q.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el estatus" });
  }
});

router.put("/movimientos/orden/:orden/cerrar", async (req, res) => {
  const orden = normalizarOrdenProduccion(req.params.orden || "");
  const { pin } = req.body || {};

  if (!orden) {
    return res.status(400).json({ error: "Orden requerida" });
  }

  try {
    // Validar PIN si viene (opcional para mantener compatibilidad)
    let usuarioId = null;
    if (pin) {
      const user = await buscarUsuarioPorPin(pin);
      if (!user) return res.status(401).json({ error: "PIN incorrecto" });
      usuarioId = user.id;
    }

    // Verificar que la OP exista en almacen_movimientos
    const existe = await pool.query(
      `SELECT 1 FROM almacen_movimientos WHERE orden_produccion = $1 LIMIT 1`,
      [orden]
    );
    if (existe.rowCount === 0) {
      return res.status(404).json({
        error: "No se encontraron movimientos para esa orden"
      });
    }

    // ❌ Solo se puede cerrar si TODAS las líneas están en CARGADO (SAI)
    const sinCargar = await pool.query(
      `SELECT COUNT(*) FROM almacen_movimientos
       WHERE orden_produccion = $1
         AND UPPER(COALESCE(estatus_movimiento,'')) <> 'CARGADO'`,
      [orden]
    );
    if (Number(sinCargar.rows[0].count) > 0) {
      return res.status(422).json({
        error: `No se puede cerrar la Orden ${orden}: hay movimientos que aún no están Cargados en SAI.`,
        codigo: "OP_NO_CARGADA",
        pendientes: Number(sinCargar.rows[0].count)
      });
    }

    // Insertar (o actualizar) marca de OP cerrada
    await pool.query(
      `INSERT INTO ordenes_cerradas (orden_produccion, cerrada_por)
       VALUES ($1, $2)
       ON CONFLICT (orden_produccion) DO UPDATE
         SET cerrada_en  = now(),
             cerrada_por = EXCLUDED.cerrada_por`,
      [orden, usuarioId]
    );

    res.json({
      ok: true,
      orden_produccion: orden,
      estado: "CERRADA",
      cerrada_por: usuarioId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "No se pudo cerrar la orden de producción"
    });
  }
});

/* ============================================================
   🔓 LISTAR / ABRIR / TOGGLE ÓRDENES CERRADAS
============================================================ */

// GET listado de OPs cerradas (solo strings)
router.get("/ordenes/cerradas", async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT orden_produccion, cerrada_en, cerrada_por
       FROM ordenes_cerradas
       ORDER BY cerrada_en DESC`
    );
    res.json(q.rows);
  } catch (err) {
    console.error("Error listando ordenes cerradas:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// PUT reabrir una OP (requiere PIN)
router.put("/movimientos/orden/:orden/abrir", async (req, res) => {
  const orden = normalizarOrdenProduccion(req.params.orden || "");
  const { pin } = req.body || {};

  if (!orden) return res.status(400).json({ error: "Orden requerida" });

  try {
    if (pin) {
      const user = await buscarUsuarioPorPin(pin);
      if (!user) return res.status(401).json({ error: "PIN incorrecto" });
    }

    const q = await pool.query(
      `DELETE FROM ordenes_cerradas WHERE orden_produccion = $1`,
      [orden]
    );

    res.json({
      ok: true,
      orden_produccion: orden,
      estado: "ABIERTA",
      eliminadas: q.rowCount
    });
  } catch (err) {
    console.error("Error abriendo OP:", err);
    res.status(500).json({ error: "No se pudo reabrir la orden" });
  }
});

// POST alternar estado de la OP (cerrar ↔ abrir) — útil para el candado
router.post("/ordenes/:orden/toggle", async (req, res) => {
  const orden = normalizarOrdenProduccion(req.params.orden || "");
  const { pin } = req.body || {};

  if (!orden) return res.status(400).json({ error: "Orden requerida" });

  try {
    let usuarioId = null;
    if (pin) {
      const user = await buscarUsuarioPorPin(pin);
      if (!user) return res.status(401).json({ error: "PIN incorrecto" });
      usuarioId = user.id;
    }

    const cerrada = await ordenEstaCerrada(orden);

    if (cerrada) {
      // Reabrir siempre está permitido
      await pool.query(
        `DELETE FROM ordenes_cerradas WHERE orden_produccion = $1`,
        [orden]
      );
      return res.json({ ok: true, orden_produccion: orden, estado: "ABIERTA" });
    }

    // ❌ Solo se puede cerrar si TODAS las líneas están en CARGADO (SAI)
    const sinCargar = await pool.query(
      `SELECT COUNT(*) FROM almacen_movimientos
       WHERE orden_produccion = $1
         AND UPPER(COALESCE(estatus_movimiento,'')) <> 'CARGADO'`,
      [orden]
    );
    if (Number(sinCargar.rows[0].count) > 0) {
      return res.status(422).json({
        error: `No se puede cerrar la Orden ${orden}: hay movimientos que aún no están Cargados en SAI.`,
        codigo: "OP_NO_CARGADA",
        pendientes: Number(sinCargar.rows[0].count)
      });
    }

    await pool.query(
      `INSERT INTO ordenes_cerradas (orden_produccion, cerrada_por)
       VALUES ($1, $2)
       ON CONFLICT (orden_produccion) DO NOTHING`,
      [orden, usuarioId]
    );
    res.json({ ok: true, orden_produccion: orden, estado: "CERRADA" });
  } catch (err) {
    console.error("Error toggle OP:", err);
    res.status(500).json({ error: "No se pudo cambiar el estado de la orden" });
  }
});

// Asignación actual por OP. Requiere aplicar la migración SQL por separado.
// Identidad y roles resueltos en backend mediante autorizarRoles.
router.get("/ordenes/responsables", autorizarRoles(["admin", "almacen", "garantias", "supervisor", "solicitante"]), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.orden_produccion, a.responsable_id,
             u.nombre AS responsable_nombre, a.asignado_por,
             actor.nombre AS asignado_por_nombre, a.asignado_en
      FROM ordenes_produccion_asignaciones a
      LEFT JOIN usuarios_almacen u ON u.id = a.responsable_id
      LEFT JOIN usuarios actor ON actor.id = a.asignado_por
      ORDER BY a.orden_produccion ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error listando responsables de OP:", error);
    res.status(500).json({ error: "Error al obtener responsables de OP" });
  }
});

router.get("/ordenes/:orden/responsable", autorizarRoles(["admin", "almacen", "garantias", "supervisor", "solicitante"]), async (req, res) => {
  const orden = normalizarOrdenProduccion(req.params.orden || "");
  if (!orden || orden.length > 50) {
    return res.status(400).json({ error: "Orden requerida, máximo 50 caracteres" });
  }

  try {
    const result = await pool.query(`
      SELECT op.orden_produccion, a.responsable_id,
             u.nombre AS responsable_nombre, a.asignado_por,
             actor.nombre AS asignado_por_nombre, a.asignado_en
      FROM (SELECT $1::varchar(50) AS orden_produccion) op
      LEFT JOIN ordenes_produccion_asignaciones a
        ON a.orden_produccion = op.orden_produccion
      LEFT JOIN usuarios_almacen u ON u.id = a.responsable_id
      LEFT JOIN usuarios actor ON actor.id = a.asignado_por
      WHERE EXISTS (
        SELECT 1 FROM almacen_movimientos WHERE orden_produccion = $1
      )
    `, [orden]);
    if (!result.rowCount) {
      return res.status(404).json({ error: "No se encontraron movimientos para esa orden" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error obteniendo responsable de OP:", error);
    res.status(500).json({ error: "Error al obtener responsable de OP" });
  }
});

router.put("/ordenes/:orden/responsable", autorizarRoles(["admin", "almacen"]), async (req, res) => {
  const orden = normalizarOrdenProduccion(req.params.orden || "");
  if (!orden || orden.length > 50) {
    return res.status(400).json({ error: "Orden requerida, máximo 50 caracteres" });
  }

  const { responsable_id } = req.body || {};
  if (responsable_id !== null &&
      (!Number.isInteger(responsable_id) || responsable_id <= 0 || responsable_id > 2147483647)) {
    return res.status(400).json({ error: "responsable_id debe ser un entero positivo o null" });
  }

  try {
    const existe = await pool.query(
      "SELECT 1 FROM almacen_movimientos WHERE orden_produccion = $1 LIMIT 1",
      [orden]
    );
    if (!existe.rowCount) {
      return res.status(404).json({ error: "No se encontraron movimientos para esa orden" });
    }

    if (responsable_id !== null) {
      const usuario = await pool.query(
        "SELECT 1 FROM usuarios_almacen WHERE id = $1",
        [responsable_id]
      );
      if (!usuario.rowCount) {
        return res.status(404).json({ error: "Responsable no encontrado en usuarios_almacen" });
      }
    }

    const result = await pool.query(`
      WITH asignacion AS (
        INSERT INTO ordenes_produccion_asignaciones (orden_produccion, responsable_id, asignado_por)
        VALUES ($1, $2, $3)
        ON CONFLICT (orden_produccion) DO UPDATE
          SET responsable_id = EXCLUDED.responsable_id,
              asignado_por = EXCLUDED.asignado_por,
              asignado_en = now()
        RETURNING orden_produccion, responsable_id, asignado_por, asignado_en
      )
      SELECT a.orden_produccion, a.responsable_id,
             u.nombre AS responsable_nombre, a.asignado_por,
             actor.nombre AS asignado_por_nombre, a.asignado_en
      FROM asignacion a
      LEFT JOIN usuarios_almacen u ON u.id = a.responsable_id
      LEFT JOIN usuarios actor ON actor.id = a.asignado_por
    `, [orden, responsable_id, req.usuarioPlataforma.id]);
    res.json(result.rows[0]);
  } catch (error) {
    // El usuario podría eliminarse entre la validación y el UPSERT.
    if (error.code === "23503" &&
        error.constraint === "ordenes_produccion_asignaciones_responsable_id_fkey") {
      return res.status(404).json({ error: "Responsable no encontrado en usuarios_almacen" });
    }
    console.error("Error asignando responsable de OP:", error);
    res.status(500).json({ error: "Error al asignar responsable de OP" });
  }
});

/* ============================================================
   📌 CAMBIAR ESTATUS (CON PIN)
============================================================ */
router.post("/cambiar_status_pin/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { pin, nuevo_status } = req.body;

        if (!pin) return res.status(400).json({ error: "PIN requerido" });
        if (!nuevo_status) return res.status(400).json({ error: "Nuevo estatus requerido" });

        // Buscar usuario por PIN
        const users = await pool.query(`
            SELECT id, nombre, pin_hash
            FROM usuarios_almacen
        `);

        const bcrypt = require("bcrypt");
        let usuario = null;

        for (const u of users.rows) {
            const ok = await bcrypt.compare(pin, u.pin_hash);
            if (ok) {
                usuario = u;
                break;
            }
        }

        if (!usuario) {
            return res.status(401).json({ error: "PIN incorrecto" });
        }

        // Actualizar el movimiento
        const result = await pool.query(
            `UPDATE almacen_movimientos
             SET estatus_movimiento = $1,
                 entregado_por = $2
             WHERE id = $3
             RETURNING *`,
            [nuevo_status, usuario.id, id]
        );

        if (!result.rowCount) {
            return res.status(404).json({ error: "Movimiento no encontrado" });
        }

        // Agregar bitácora
        await pool.query(
            `INSERT INTO bitacora_almacen (movimiento_id, usuario_id, accion, detalle)
             VALUES ($1, $2, $3, $4)`,
            [
                id,
                usuario.id,
                "CAMBIAR_STATUS",
                `Cambio de estatus a "${nuevo_status}"`,
            ]
        );

        res.json({
            ok: true,
            mensaje: "Estatus actualizado",
            usuario: usuario.nombre,
            movimiento: result.rows[0],
        });

    } catch (error) {
        console.error("❌ Error cambiar estatus PIN:", error);
        res.status(500).json({ error: "Error al cambiar estatus" });
    }
});


// PUT ─ actualizar movimiento
router.put("/movimientos/:id", async (req, res) => {
  const { id } = req.params;
  const {
    persona,
    estacion,
    orden_produccion,
    numero_parte,
    descripcion,
    cantidad,
    concepto_liberacion
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE almacen_movimientos
       SET persona = $1,
           estacion = $2,
           orden_produccion = $3,
           numero_parte = $4,
           descripcion = $5,
           cantidad = $6,
           concepto_liberacion = $7
       WHERE id = $8
       RETURNING *`,
      [
        persona,
        estacion,
        normalizarOrdenProduccion(orden_produccion),
        numero_parte,
        descripcion,
        cantidad,
        concepto_liberacion,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }

    res.json({ ok: true, movimiento: result.rows[0] });

  } catch (err) {
    console.error("❌ Error al actualizar movimiento:", err);
    res.status(500).json({ error: "Error interno al actualizar" });
  }
});

// DELETE eliminar movimiento
router.delete("/movimientos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query(
      "DELETE FROM almacen_movimientos WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Movimiento no encontrado." });
    }

    res.json({ success: true, message: "Movimiento eliminado correctamente." });
  } catch (err) {
    console.error("Error eliminando movimiento:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// GET - Movimientos de almacén con costo vigente
router.get("/almacen-movimientos-detalle", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
  	am.id,
  	am.persona,
        am.orden_produccion,
  	am.numero_parte,
  	am.descripcion,
  	CAST(am.cantidad AS INTEGER),
  	am.concepto_liberacion,
  	am.atendio,
  	am.status,
  	am.creado_en - INTERVAL '6 hours' AS creado_en,
  	am.atendido_en - INTERVAL '6 hours' AS atendido_en,
  	am.estatus_movimiento,
  	CAST(pp.moneda_costo AS INTEGER),
  	CAST(pp.costo_entrante AS REAL)
	FROM PUBLIC.almacen_movimientos am
	LEFT JOIN PUBLIC.productos p 
	  ON am.numero_parte = p.clave_prod 
	LEFT JOIN LATERAL (
	    SELECT moneda_costo, costo_entrante
	    FROM PUBLIC.producto_precios
	    WHERE producto_id = p.id
	    ORDER BY vigente_desde DESC
	    LIMIT 1
	) pp ON TRUE;
      `);

    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo movimientos de almacén con precios:", error);
    res.status(500).json({ error: "Error obteniendo movimientos de almacén" });
  }
});

// NOTIFICACION INSPECCION
router.post('/notificacion_insp', async (req, res) => {
  try {
    const { correoTecnico, inspNum, est } = req.body;

    if (!correoTecnico || !inspNum || !est) {
      return res.status(400).json({ error: 'Faltan parámetros (correoTecnico, inspNum, estación)' });
    }

    console.log(`🔍 Buscando tokens para correo: ${correoTecnico}`);

    const snapshot = await almacenAdmin.firestore()
      .collection('operadoresTokens')
      .where('email', '==', correoTecnico)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'No existe un usuario con ese correo' });
    }

    const userData = snapshot.docs[0].data();
    const tokens = userData.fcmTokens || [];

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(404).json({ error: 'El usuario no tiene tokens registrados' });
    }

    console.log('📲 Tokens encontrados:', tokens);

    const message = {
      tokens: tokens, // 👈 AQUÍ está la diferencia real
      notification: {
        title: `¡Nueva inspección pendiente de asignar! #${inspNum}`,
        body: `Un operador te está esperando en la estación: #${est}`
      },
      data: {
        inspNum: String(inspNum)
      }
    };

    const response = await almacenAdmin.messaging().sendEachForMulticast(message);

    console.log('✅ Notificación enviada:', response);

    res.json({
      ok: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    });

  } catch (error) {
    console.error('❌ Error al enviar la notificación:', error);
    res.status(500).json({
      error: error.message || 'Error interno al enviar la notificación'
    });
  }
});

router.post('/notificacion_broadcast', async (req, res) => {
  try {
    const { titulo, cuerpo, data } = req.body;

    if (!titulo || !cuerpo) {
      return res.status(400).json({ error: 'Faltan parámetros (titulo, cuerpo)' });
    }

    const message = {
      topic: 'operadores', // 👈 ESTE ES EL MAGO
      notification: {
        title: titulo,
        body: cuerpo,
      },
      data: data || {},
    };

    const response = await almacenAdmin.messaging().send(message);

    console.log('📣 Notificación broadcast enviada:', response);

    res.json({
      ok: true,
      message: 'Notificación enviada a todos los operadores',
      response,
    });

  } catch (error) {
    console.error('❌ Error enviando broadcast:', error);
    res.status(500).json({
      error: error.message || 'Error interno al enviar broadcast'
    });
  }
});

// ==========================================
// LISTAR TODAS LAS SOLICITUDES
// ==========================================
router.get("/solicitudes_almacen_subensamble", async (req, res) => {
    try {
        const q = await pool.query(`
            SELECT 
                id,
                id_num_parte,
                comentarios,
                cantidad,
		solicitud_para,
                created_at,
		status
            FROM solicitudes_almacen_subensamble
            ORDER BY id DESC
        `);

        res.json(q.rows);

    } catch (err) {
        console.error("Error listando solicitudes:", err);
        res.status(500).json({
            error: "Error interno"
        });
    }
});


// ==========================================
// OBTENER UNA SOLICITUD POR ID
// ==========================================
router.get("/solicitudes_almacen_subensamble/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const q = await pool.query(`
            SELECT 
                id,
                id_num_parte,
                comentarios,
                cantidad,
		solicitud_para,
                created_at,
		status
            FROM solicitudes_almacen_subensamble
            WHERE id = $1
        `, [id]);

        if (q.rows.length === 0) {
            return res.status(404).json({
                error: "Solicitud no encontrada"
            });
        }

        res.json(q.rows[0]);

    } catch (err) {
        console.error("Error obteniendo solicitud:", err);
        res.status(500).json({
            error: "Error interno"
        });
    }
});


// ==========================================
// CREAR SOLICITUD
// ==========================================
router.post("/solicitudes_almacen_subensamble", async (req, res) => {
    try {

        const {
            id_num_parte,
            comentarios,
            cantidad,
	    solicitud_para
        } = req.body;

        const q = await pool.query(`
            INSERT INTO solicitudes_almacen_subensamble
            (
                id_num_parte,
                comentarios,
                cantidad,
		solicitud_para
            )
            VALUES
            (
                $1,
                $2,
                $3,
		$4
            )
            RETURNING *
        `, [
            id_num_parte,
            comentarios,
            cantidad,
	    solicitud_para
        ]);

        res.status(201).json({
            message: "Solicitud creada correctamente",
            data: q.rows[0]
        });

    } catch (err) {
        console.error("Error creando solicitud:", err);
        res.status(500).json({
            error: "Error interno"
        });
    }
});


// ==========================================
// ACTUALIZAR SOLICITUD
// ==========================================
router.put("/solicitudes_almacen_subensamble/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const {
            id_num_parte,
            comentarios,
            cantidad,
            status
        } = req.body;

        const q = await pool.query(`
            UPDATE solicitudes_almacen_subensamble
            SET
                id_num_parte = COALESCE($1, id_num_parte),
                comentarios = COALESCE($2, comentarios),
                cantidad = COALESCE($3, cantidad),
                status = COALESCE($4, status)
            WHERE id = $5
            RETURNING *
        `, [
            id_num_parte,
            comentarios,
            cantidad,
            status,
            id
        ]);

        if (q.rows.length === 0) {
            return res.status(404).json({
                error: "Solicitud no encontrada"
            });
        }

        res.json({
            message: "Solicitud actualizada correctamente",
            data: q.rows[0]
        });

    } catch (err) {
        console.error("Error actualizando solicitud:", err);
        res.status(500).json({
            error: "Error interno"
        });
    }
});

// ==========================================
// ELIMINAR SOLICITUD
// ==========================================
router.delete("/solicitudes_almacen_subensamble/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const q = await pool.query(`
            DELETE FROM solicitudes_almacen_subensamble
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (q.rows.length === 0) {
            return res.status(404).json({
                error: "Solicitud no encontrada"
            });
        }

        res.json({
            message: "Solicitud eliminada correctamente",
            data: q.rows[0]
        });

    } catch (err) {
        console.error("Error eliminando solicitud:", err);
        res.status(500).json({
            error: "Error interno"
        });
    }
});

// ====================================================
// SEND WABA
// ====================================================

router.post("/send-whatsapp-template", async (req, res) => {
    try {

        const {
            telefono,
            contentSid,
            variables
        } = req.body;

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        const body = new URLSearchParams({
            From: "whatsapp:+18555580230",
            To: `whatsapp:${telefono}`,
            ContentSid: contentSid,
            ContentVariables: JSON.stringify(variables)
        });

        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Basic " +
                        Buffer.from(
                            `${accountSid}:${authToken}`
                        ).toString("base64"),

                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body
            }
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;

