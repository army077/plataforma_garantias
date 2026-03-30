import { useQuery } from "@tanstack/react-query";
import { listSolicitudes } from "../lib/api.js";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import EstadoBadge from "../components/EstadoBadge.jsx";
import Loader from "../components/Loader.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

const ROLES_GARANTIAS = ["garantias", "admin"];

export default function SolicitudesList() {
  const { role, user, loading } = useAuth();
  const esGarantias = ROLES_GARANTIAS.includes(role);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({
    q,
    estado,
    page,
    pageSize: 20,
    email: esGarantias ? "all" : (user?.email || "")
  }), [q, estado, page, esGarantias, user?.email]);

  const { data, isLoading } = useQuery({
    queryKey: ["solicitudes", params],
    queryFn: () => listSolicitudes(params),
    enabled: !loading && (esGarantias || !!user?.email),
  });

  const keyHandler = (e) => { if (e.key === "Enter") runSearch(); };

  if (loading || isLoading) return <Loader />;

  const rows = data?.rows || [];
  const buildLink = (id) => (esGarantias ? `/s/${id}` : `/s/${id}/solicitante`);

  const ESTADOS = [
    "CREADA",
    "EN_REVISION",
    "APROBADA",
    "LIBERADA",
    "ENTREGADA",
    "CERRADA",
    "RECHAZADA",
    "CANCELADA"
  ];

  const runSearch = () => {
    setPage(1);
    setQ(qInput);
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Solicitudes</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gestiona y consulta las solicitudes de garantía</p>
      </div>

      {/* FILTROS */}
      <div className="card space-y-3">

        {/* Primera fila: búsqueda + botón + nueva */}
        <div className="flex flex-wrap gap-2">

          <input
            className="input flex-1"
            placeholder="Buscar solicitud, ticket o cliente"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={keyHandler}
          />

          <button className="btn" onClick={runSearch}>
            Buscar
          </button>

          <Link to="/create" className="btn btn-primary">
            Nueva
          </Link>
        </div>

        {/* Segunda fila: select de estado */}
        <div>
          <label className="text-xs text-slate-500 font-medium">Filtrar por estado</label>
          <select
            className="input mt-1"
            value={estado}
            onChange={(e) => {
              setPage(1);
              setEstado(e.target.value);
            }}
          >
            <option value="">Todos</option>
            {ESTADOS.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {!esGarantias && (
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">
            Viendo solo tus solicitudes:
            <span className="font-medium text-slate-700 ml-1">{user?.email}</span>
          </div>
        )}
      </div>

      {/* LISTA */}
      <div className="grid gap-2">
        {rows.map((s) => (
          <Link
            key={s.id}
            to={buildLink(s.id)}
            className="card px-4 py-3 hover:border-slate-300 hover:shadow transition-all duration-150"
          >
            <div className="flex items-start justify-between gap-4">

              {/* IZQUIERDA */}
              <div className="space-y-1">
                <div className="font-semibold text-sm text-slate-800 tracking-tight">
                  Solicitud #{s.id}
                  <span className="text-slate-300 mx-1">·</span>
                  <span className="text-slate-600">{s.ticket_numero || s.cliente_label || "N/A"}</span>
                </div>

                <div className="text-slate-500 text-sm">
                  {s.cliente_nombre || s.razon_social || "Sin cliente"}
                </div>

                <div className="text-xs text-slate-400">
                  {new Date(s.creado_en).toLocaleString()}
                </div>
              </div>

              {/* DERECHA */}
              <div className="text-right shrink-0">
                <EstadoBadge code={s.estado_code} />

                <div className="text-xs text-slate-400 mt-1">
                  {s.prioridad_nombre || "Sin prioridad"}
                </div>
              </div>

            </div>
          </Link>
        ))}

        {!rows.length && (
          <div className="text-sm text-slate-400 py-12 text-center">
            Sin resultados.
          </div>
        )}

        <div className="flex justify-center items-center gap-4 mt-4">

          <button
            className="btn"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>

          <span className="text-slate-500 text-sm">
            Página {page}
          </span>

          <button
            className="btn"
            disabled={rows.length < 20}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>

        </div>
      </div>
    </div>
  );
}
