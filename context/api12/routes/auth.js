const express = require("express");
const admin = require("../firebase");   // 👈 ya importa con require
const { pool } = require("../db");      // 👈 ya funciona porque exportaste con module.exports

const router = express.Router();

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta token" });
  }
  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    console.error("Error verificando token:", e);
    res.status(401).json({ error: "Token inválido" });
  }
}

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const email = req.user.email;
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.sede, r.nombre as role
       FROM usuarios u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email=$1`,
      [email]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Usuario no encontrado en la plataforma" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en servidor" });
  }
});

module.exports = router;
