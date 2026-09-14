require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");


const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

// Rutas
app.use("/api12/solicitudes", require("./routes/solicitudes"));
app.use("/api12/catalogo", require("./routes/catalogo"));
app.use("/api12/reportes", require("./routes/reportes")); // opcional, pero ya va montada
app.use("/api12/auth", require("./routes/auth"));
app.use("/api12/almacen", require("./routes/almacen"));
// app.use("/api12/usuarios", require("./routes/usuarios"));

// Health check
app.get("/api12/health", (_req, res) => res.json({ ok: true, service: "api12-garantias" }));

const PORT = 3012;
app.listen(PORT, () => {
  console.log(`API12 escuchando en http://localhost:${PORT}/api12/health`);
});
