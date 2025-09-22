import { Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider.jsx";
import { useState } from "react";
import SolicitudesList from "./pages/SolicitudesList.jsx";
import SolicitudShow from "./pages/SolicitudShow.jsx";
import SolicitudCreate from "./pages/SolicitudCreate.jsx";
import SolicitudSolicitante from "./pages/SolicitudSolicitante.jsx";
import Login from "./pages/Login.jsx";
import CatalogoPiezas from "./pages/CatalogoPiezas.jsx";

const ROLES_GARANTIAS = ["garantias", "admin"];

function Private({ children, roles }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-neutral-400">Cargando sesión…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) return <div className="p-6">Acceso denegado</div>;
  return children;
}

/* ===== Barra superior tipo “aviso” ===== */
function TopBar() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center">
      <div className="max-w-md w-auto mx-auto bg-amber-500 text-black rounded-b-lg shadow px-6 py-1">
        <div className="flex items-center justify-center">
          <span className="font-semibold tracking-wide text-lg">
            Plataforma de garantías
          </span>
        </div>
      </div>
    </div>
  );
}


export default function App() {
  return (
    <AuthProvider>
      {/* Fondo y color base de la app */}
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <TopBar />
        {/* Empuje para no quedar debajo de la barra fija */}
        <div className="max-w-6xl mx-auto p-4 pt-12">
          <Header />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Private><SolicitudesList /></Private>} />
            <Route
              path="/create"
              element={
                <Private roles={[...ROLES_GARANTIAS, "solicitante"]}>
                  <SolicitudCreate />
                </Private>
              }
            />
            // además de /create, agrega esta ruta:
            <Route
              path="/create/:zohoId"
              element={
                <Private roles={[...ROLES_GARANTIAS, "solicitante"]}>
                  <SolicitudCreate />
                </Private>
              }
            />
            <Route
              path="/s/:id"
              element={
                <Private roles={ROLES_GARANTIAS}>
                  <SolicitudShow />
                </Private>
              }
            />
            <Route
              path="/s/:id/solicitante"
              element={
                <Private roles={[...ROLES_GARANTIAS, "solicitante"]}>
                  <SolicitudSolicitante />
                </Private>
              }
            />
            <Route
              path="/catalogo"
              element={
                <Private roles={[...ROLES_GARANTIAS, "solicitante"]}>
                  <CatalogoPiezas />
                </Private>
              }
            />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}

/* ===== Header tal cual, solo lo dejo como lo traías ===== */
function Header() {
  const nav = useNavigate();
  const { user, role, signOut } = useAuth();
  const esSolicitante = role === "solicitante";

  return (
    <header className="flex items-center justify-between px-4 py-2 mb-4 border-b border-neutral-800">
      <button
        onClick={() => nav("/")}
        className="flex items-center gap-1 cursor-pointer hover:opacity-90 transition"
        title="Ir a inicio"
      >
        <img src="/dragon_vintage.png" alt="Dragon" className="h-10 w-auto object-contain" />
        <img src="/asia_vintage.png" alt="Asia" className="h-10 w-auto object-contain" />
        <img src="/robotica_vintage.png" alt="Robótica" className="h-10 w-auto object-contain" />
      </button>

      <div className="flex items-center gap-3">
        {user && (
          <span className="text-xs px-2 py-1 rounded-full border border-neutral-700 bg-neutral-900">
            {role || "sin-rol"}
          </span>
        )}

        {user ? (
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => nav("/create")}>Nueva</button>
            {!esSolicitante && <button className="btn" onClick={() => nav("/")}>Solicitudes</button>}
            <button className="btn" onClick={signOut}>Salir</button>
          </div>
        ) : (
          <button className="btn" onClick={() => nav("/login")}>Entrar</button>
        )}
      </div>
    </header>
  );
}
