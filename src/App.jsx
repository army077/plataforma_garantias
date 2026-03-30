import { Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider.jsx";
import { useState } from "react";
import SolicitudesList from "./pages/SolicitudesList.jsx";
import SolicitudShow from "./pages/SolicitudShow.jsx";
import SolicitudCreate from "./pages/SolicitudCreate.jsx";
import SolicitudSolicitante from "./pages/SolicitudSolicitante.jsx";
import Login from "./pages/Login.jsx";
import CatalogoPiezas from "./pages/CatalogoPiezas.jsx";
import MainPage from "./pages/MainPage.jsx";
import AlmacenPage from "./pages/AlmacenPage.jsx";
import UsuariosAlmacenPage from "./pages/UsuariosAlmacenPage.jsx";

const ROLES_GARANTIAS = ["garantias", "admin"];

function Private({ children, roles }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-slate-400">Cargando sesión…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) return <div className="p-8 text-slate-500">Acceso denegado</div>;
  return children;
}

/* ===== Iconos SVG para sidebar ===== */
const IcoNew = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
  </svg>
);
const IcoList = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z"/>
  </svg>
);
const IcoAlmacen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
  </svg>
);
const IcoCatalogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/>
  </svg>
);
const IcoUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z"/>
  </svg>
);
const IcoLogout = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"/>
  </svg>
);
const IcoMenu = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
  </svg>
);
const IcoClose = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
  </svg>
);
const IcoChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
  </svg>
);
const IcoChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
  </svg>
);

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route path="/login" element={<div className="flex items-center justify-center min-h-screen"><Login /></div>} />
          <Route path="/catalogo" element={<div className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8"><CatalogoPiezas /></div>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Backdrop móvil */}
      <div
        className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col
        bg-[#1e1e2d] transition-all duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${collapsed ? "w-[72px]" : "w-[240px]"}
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar móvil */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-slate-200 bg-white">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-500 hover:text-slate-700">
            <IcoMenu />
          </button>
          <img src="/logo_ar_sombra.png" alt="Asia Robótica" className="h-8 w-auto" />
        </div>

        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Private><SolicitudesList /></Private>} />
              <Route path="/main" element={<MainPage />} />
              <Route path="/almacen" element={<Private roles={[...ROLES_GARANTIAS, "solicitante", "almacen", "supervisor"]}><AlmacenPage /></Private>} />
              <Route path="/almacen/usuarios" element={<Private roles={["admin"]}><UsuariosAlmacenPage /></Private>} />
              <Route path="/create" element={<Private roles={[...ROLES_GARANTIAS, "solicitante"]}><SolicitudCreate /></Private>} />
              <Route path="/create/:zohoId" element={<Private roles={[...ROLES_GARANTIAS, "solicitante"]}><SolicitudCreate /></Private>} />
              <Route path="/s/:id" element={<Private roles={ROLES_GARANTIAS}><SolicitudShow /></Private>} />
              <Route path="/s/:id/solicitante" element={<Private roles={[...ROLES_GARANTIAS, "solicitante"]}><SolicitudSolicitante /></Private>} />
              <Route path="/catalogo" element={<CatalogoPiezas />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ===== Sidebar ===== */
function Sidebar({ onClose, collapsed, setCollapsed }) {
  const nav = useNavigate();
  const location = useLocation();
  const { role, signOut } = useAuth();
  const esSolicitante = role === "solicitante";
  const esAdmin = role === "admin";

  const go = (path) => { nav(path); onClose(); };
  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-white/10 ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        <button onClick={() => go("/")} className="flex items-center gap-2.5 cursor-pointer">
          <img src="/logo_ar_sombra.png" alt="AR" className={`${collapsed ? "h-8 w-8 object-contain" : "h-8 w-auto"}`} />
        </button>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
          <IcoClose />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-auto py-4 px-2 space-y-6">
        <NavSection label="Garantías" collapsed={collapsed}>
          <NavItem icon={<IcoNew />} label="Nueva solicitud" active={isActive("/main")} onClick={() => go("/main")} collapsed={collapsed} />
          {!esSolicitante && (
            <NavItem icon={<IcoList />} label="Solicitudes" active={isActive("/") && !isActive("/main") && !isActive("/almacen") && !isActive("/catalogo") && !isActive("/create")} onClick={() => go("/")} collapsed={collapsed} />
          )}
        </NavSection>

        <NavSection label="Almacén" collapsed={collapsed}>
          <NavItem icon={<IcoAlmacen />} label="Movimientos" active={isActive("/almacen") && !isActive("/almacen/usuarios")} onClick={() => go("/almacen")} collapsed={collapsed} />
          {esAdmin && (
            <NavItem icon={<IcoUsers />} label="Usuarios PIN" active={isActive("/almacen/usuarios")} onClick={() => go("/almacen/usuarios")} collapsed={collapsed} />
          )}
        </NavSection>

        <NavSection label="Consulta" collapsed={collapsed}>
          <NavItem icon={<IcoCatalogo />} label="Catálogo de piezas" active={isActive("/catalogo")} onClick={() => go("/catalogo")} collapsed={collapsed} />
        </NavSection>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-2">
        <button
          onClick={signOut}
          className={`flex items-center gap-2.5 w-full py-2 rounded-lg text-[13px] text-slate-400 hover:text-white hover:bg-white/5 transition-colors ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
          title="Cerrar sesión"
        >
          <IcoLogout />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      {/* Toggle collapse */}
      <div className="border-t border-white/10 p-2 hidden lg:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          {collapsed ? <IcoChevronRight /> : <IcoChevronLeft />}
        </button>
      </div>
    </>
  );
}

function NavSection({ label, children, collapsed }) {
  return (
    <div>
      {!collapsed && (
        <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
      )}
      {collapsed && <div className="mb-1 border-b border-white/5 mx-2" />}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`relative flex items-center gap-3 w-full py-2.5 rounded-lg text-[13px] transition-all duration-150 ${
        collapsed ? "justify-center px-2" : "px-3"
      } ${
        active
          ? "bg-white/10 text-white font-medium"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-red-500 rounded-r-full" />
      )}
      <span className={`flex-shrink-0 ${active ? "text-white" : "text-slate-400"}`}>{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
