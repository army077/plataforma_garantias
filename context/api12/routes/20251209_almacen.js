// routes/almacen.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

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

    const result = await pool.query(
      `INSERT INTO almacen_movimientos
        (persona, estacion, orden_produccion, numero_parte, descripcion, cantidad, concepto_liberacion, estatus_movimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7, 'SIN ENTREGAR')
       RETURNING *`,
      [
        persona,
        estacion,
        orden_produccion,
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
        orden_produccion,
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

module.exports = router;
