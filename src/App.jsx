import { Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider.jsx";
import SolicitudesList from "./pages/SolicitudesList.jsx";
import SolicitudShow from "./pages/SolicitudShow.jsx";
import SolicitudCreate from "./pages/SolicitudCreate.jsx";
import SolicitudSolicitante from "./pages/SolicitudSolicitante.jsx";
import Login from "./pages/Login.jsx";

const ROLES_GARANTIAS = ["garantias", "admin"]; // aquí vive “el área de garantías”

function Private({ children, roles }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-neutral-400">Cargando sesión…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) return <div className="p-6">Acceso denegado</div>;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="max-w-6xl mx-auto p-4">
        <Header />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Todos los roles autenticados pueden ver la lista */}
          <Route path="/" element={<Private><SolicitudesList /></Private>} />

          {/* Crear: puede crear también el solicitante */}
          <Route
            path="/create"
            element={
              <Private roles={[...ROLES_GARANTIAS, "solicitante"]}>
                <SolicitudCreate />
              </Private>
            }
          />

          {/* Vista con ACCIONES: solo área de garantías */}
          <Route
            path="/s/:id"
            element={
              <Private roles={ROLES_GARANTIAS}>
                <SolicitudShow />
              </Private>
            }
          />

          {/* Vista sin acciones, solo agregar refacciones: solo solicitante */}
          <Route
            path="/s/:id/solicitante"
            element={
              <Private roles={[...ROLES_GARANTIAS, "solicitante"]}>
                <SolicitudSolicitante />
              </Private>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
}

function Header() {
  const nav = useNavigate();
  const { user, role, signOut } = useAuth();
  const esSolicitante = role === "solicitante";

  return (
    <header className="flex items-center justify-between mb-4">
      <button className="text-lg font-semibold" onClick={() => nav("/")}>
        Plataforma Garantías
      </button>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-xs px-2 py-1 rounded-full border border-neutral-700">
            {role || "sin-rol"}
          </span>
        )}

        {user ? (
          <>
            {/* Crear visible para todos los roles permitidos */}
            <button className="btn" onClick={() => nav("/create")}>Nueva</button>

            {/* El botón “Solicitudes” para todos; si te molesta para solicitante, quítalo */}
            {!esSolicitante && (
              <button className="btn" onClick={() => nav("/")}>Solicitudes</button>
            )}

            <button className="btn" onClick={signOut}>Salir</button>
          </>
        ) : (
          <button className="btn" onClick={() => nav("/login")}>Entrar</button>
        )}
      </div>
    </header>
  );
}