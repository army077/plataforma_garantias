const admin = require("../firebase");
const { pool } = require("../db");

function autorizarRoles(rolesPermitidos) {
  const roles = new Set(rolesPermitidos);

  return async (req, res, next) => {
    const encabezado = req.headers.authorization;
    const coincidencia = typeof encabezado === "string"
      ? /^Bearer ([^\s]+)$/.exec(encabezado)
      : null;

    if (!coincidencia) {
      return res.status(401).json({ error: "Token ausente o mal formado" });
    }

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().verifyIdToken(coincidencia[1]);
    } catch (_) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const email = firebaseUser.email;
    if (typeof email !== "string" || !email.trim()) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    let usuarioPlataforma;
    try {
      const { rows } = await pool.query(
        `SELECT u.id, u.email, u.nombre, u.sede, r.nombre AS role
         FROM usuarios u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.email = $1`,
        [email]
      );
      usuarioPlataforma = rows[0];
    } catch (_) {
      return res.status(500).json({ error: "Error interno al consultar usuario" });
    }

    if (!usuarioPlataforma || !usuarioPlataforma.role || !roles.has(usuarioPlataforma.role)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    req.firebaseUser = firebaseUser;
    // Este ID pertenece a usuarios, no a usuarios_almacen.
    req.usuarioPlataforma = usuarioPlataforma;
    return next();
  };
}

module.exports = autorizarRoles;
