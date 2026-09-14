// routes/reportes.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

router.get("/solicitudes-por-estado", async (_req, res) => {
  try {
    const sql = `
      SELECT es.nombre AS estado, COUNT(*)::int AS total
      FROM solicitudes s
      JOIN estados_solicitud es ON es.id = s.estado_id
      GROUP BY es.nombre
      ORDER BY total DESC
    `;
    const r = await pool.query(sql);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/backlog", async (_req, res) => {
  try {
    const sql = `
      SELECT s.id, u.nombre AS responsable, p.nombre AS prioridad,
             s.creado_en::date AS fecha,
             GREATEST(0, (CURRENT_DATE - s.creado_en::date))::int AS dias_abierta
      FROM solicitudes s
      LEFT JOIN usuarios u ON u.id = s.usuario_id
      LEFT JOIN prioridades p ON p.id = s.prioridad_id
      WHERE s.estado_id NOT IN (SELECT id FROM estados_solicitud WHERE code IN ('CERRADA','CANCELADA'))
      ORDER BY dias_abierta DESC, prioridad ASC
    `;
    const r = await pool.query(sql);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
