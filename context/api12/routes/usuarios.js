// routes/usuarios.js
const express = require("express");
const pool = require("../db");
const crudFactory = require("../utils/crudFactory");

const router = express.Router();

// Whitelist para ORDER BY, o te van a inyectar un "DROP DATABASE" con cariño
const SORTABLE = new Set(["id", "nombre", "correo", "rol", "activo", "created_at"]);

// GET /usuarios con filtros: ?q=texto&rol=...&activo=true|false&_start=0&_end=10&_sort=created_at&_order=DESC
router.get("/", async (req, res, next) => {
  try {
    const {
      q,
      rol,
      activo,
      _start = 0,
      _end,
      _sort = "created_at",
      _order = "DESC",
    } = req.query;

    // Sanitiza sort
    const sortCol = SORTABLE.has(String(_sort)) ? _sort : "created_at";
    const sortDir = String(_order).toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Pagina
    const limit = _end ? Number(_end) - Number(_start) : 50;
    const offset = Number(_start) || 0;

    const whereParts = [];
    const values = [];
    let i = 1;

    if (q) {
      // Busca en nombre y correo (correo es CITEXT, ILIKE igual funciona)
      whereParts.push(`(nombre ILIKE $${i} OR correo::text ILIKE $${i})`);
      values.push(`%${q}%`);
      i++;
    }

    if (rol) {
      // La tabla ya tiene CHECK(rol in ...), esto es solo filtro
      whereParts.push(`rol = $${i}`);
      values.push(rol);
      i++;
    }

    if (typeof activo !== "undefined") {
      // acepta "true"/"false" o boolean real
      const boolVal =
        activo === true ||
        activo === "true" ||
        activo === "1" ||
        activo === 1;
      whereParts.push(`activo = $${i}`);
      values.push(boolVal);
      i++;
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Total
    const countSql = `SELECT COUNT(*)::int AS c FROM usuarios ${where};`;
    const countRes = await pool.query(countSql, values);
    res.set("X-Total-Count", String(countRes.rows[0].c));

    // Datos
    const dataSql = `
      SELECT id, nombre, correo, rol, activo, created_at
      FROM usuarios
      ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ${limit} OFFSET ${offset};
    `;
    const dataRes = await pool.query(dataSql, values);

    res.json(dataRes.rows);
  } catch (err) {
    next(err);
  }
});

// Resto de CRUD (GET /:id, POST, PUT, DELETE) via crudFactory
const columns = ["nombre", "correo", "rol", "activo"];

const factoryRouter = crudFactory(pool, {
  table: "usuarios",
  columns,
  defaultOrder: "created_at DESC",
});

// Opcional: si quieres mensajes de error más humanos para UNIQUE/CHK, puedes
// envolver POST/PUT con middlewares y mapear códigos 23505/23514 en tu error handler global.

router.use("/", factoryRouter);

module.exports = router;
