// routes/catalogo.js
const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// GET /catalogo/usuarios?q=&_start=&_end=
router.get("/usuarios", async (req, res) => {
  try {
    const { q, _start, _end } = req.query;
    const values = [];
    let where = "WHERE 1=1";
    if (q) {
      values.push(`%${q}%`);
      where += ` AND (u.nombre ILIKE $${values.length} OR u.email ILIKE $${values.length})`;
    }
    const total = Number((await pool.query(`SELECT COUNT(*) FROM usuarios u ${where}`, values)).rows[0].count);

    let limitOffset = "";
    if (_start !== undefined && _end !== undefined) {
      const limit = Math.max(0, Number(_end) - Number(_start));
      values.push(limit, Number(_start));
      limitOffset = ` LIMIT $${values.length-1} OFFSET $${values.length}`;
    }

    const rows = (await pool.query(
      `SELECT u.id, u.nombre, u.email FROM usuarios u ${where} ORDER BY u.nombre ASC ${limitOffset}`,
      values
    )).rows;

    res.set("X-Total-Count", String(total));
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ error: e.message });
  }
});

// GET /catalogo/clientes?q=&_start=&_end=
router.get("/clientes", async (req, res) => {
  try {
    const { q, _start, _end } = req.query;
    const values = [];
    let where = "WHERE 1=1";
    if (q) {
      values.push(`%${q}%`);
      where += ` AND (c.razon_social ILIKE $${values.length})`;
    }
    const total = Number((await pool.query(`SELECT COUNT(*) FROM clientes c ${where}`, values)).rows[0].count);

    let limitOffset = "";
    if (_start !== undefined && _end !== undefined) {
      const limit = Math.max(0, Number(_end) - Number(_start));
      values.push(limit, Number(_start));
      limitOffset = ` LIMIT $${values.length-1} OFFSET $${values.length}`;
    }

    const rows = (await pool.query(
      `SELECT c.id, c.razon_social FROM clientes c ${where} ORDER BY c.razon_social ASC ${limitOffset}`,
      values
    )).rows;

    res.set("X-Total-Count", String(total));
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ error: e.message });
  }
});

// GET /catalogo/tickets?q=&_start=&_end=
router.get("/tickets", async (req, res) => {
  try {
    const { q, _start, _end } = req.query;
    const values = [];
    let where = "WHERE 1=1";
    if (q) {
      values.push(`%${q}%`);
      where += ` AND (t.numero ILIKE $${values.length} OR COALESCE(t.id_externo,'') ILIKE $${values.length})`;
    }
    const total = Number((await pool.query(`SELECT COUNT(*) FROM tickets t ${where}`, values)).rows[0].count);

    let limitOffset = "";
    if (_start !== undefined && _end !== undefined) {
      const limit = Math.max(0, Number(_end) - Number(_start));
      values.push(limit, Number(_start));
      limitOffset = ` LIMIT $${values.length-1} OFFSET $${values.length}`;
    }

    const rows = (await pool.query(
      `SELECT t.id, t.numero, t.id_externo FROM tickets t ${where} ORDER BY t.id DESC ${limitOffset}`,
      values
    )).rows;

    res.set("X-Total-Count", String(total));
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ error: e.message });
  }
});


// GET /catalogo/productos?q=...&_start=0&_end=10
router.get("/productos", async (req, res) => {
  try {
    const { q, _start, _end } = req.query;
    const values = [];
    let where = "WHERE pr.activo = TRUE";

    if (q) {
      values.push(`%${q}%`);
      where += ` AND (pr.clave_prod ILIKE $${values.length}
                   OR pr.desc_prod ILIKE $${values.length})`;
    }

    const total = Number(
      (await pool.query(`SELECT COUNT(*) FROM productos pr ${where}`, values)).rows[0].count
    );

    let limitOffset = "";
    if (_start !== undefined && _end !== undefined) {
      const limit = Math.max(0, Number(_end) - Number(_start));
      values.push(limit, Number(_start));
      limitOffset = ` LIMIT $${values.length-1} OFFSET $${values.length}`;
    }

    // precio vigente: el que no tiene vigente_hasta o con mayor vigente_desde
    const sql = `
      SELECT pr.id, pr.clave_prod, pr.desc_prod, pr.uni_med, pr.link_img,
             pp.precio_venta, pp.costo_entrante, pp.moneda_precio, pp.moneda_costo
      FROM productos pr
      LEFT JOIN LATERAL (
        SELECT *
        FROM producto_precios ppx
        WHERE ppx.producto_id = pr.id
          AND (ppx.vigente_hasta IS NULL OR ppx.vigente_hasta > now())
        ORDER BY ppx.vigente_desde DESC
        LIMIT 1
      ) pp ON TRUE
      ${where}
      ORDER BY pr.clave_prod ASC
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

module.exports = router;
