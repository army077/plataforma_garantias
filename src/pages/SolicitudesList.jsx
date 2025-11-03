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

  const params = useMemo(() => ({
    q,
    page: 1,
    pageSize: 20,
    email: esGarantias ? "all" : (user?.email || ""),
  }), [q, esGarantias, user?.email]);

  const { data, isLoading } = useQuery({
    queryKey: ["solicitudes", params],
    queryFn: () => listSolicitudes(params),
    enabled: !loading && (esGarantias || !!user?.email),
  });

  const runSearch = () => setQ(qInput);
  const keyHandler = (e) => { if (e.key === "Enter") runSearch(); };

  if (loading || isLoading) return <Loader />;

  const rows = data?.rows || [];
  const buildLink = (id) => (esGarantias ? `/s/${id}` : `/s/${id}/solicitante`);

  return (
    <div>
      <div className="card mb-4">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Buscar por id/ticket/cliente"
            value={qInput}
            onChange={(e)=>setQInput(e.target.value)}
            onKeyDown={keyHandler}
          />
          <button className="btn" onClick={runSearch}>Buscar</button>
          <Link to="/create" className="btn">Nueva</Link>
        </div>
        {!esGarantias && (
          <div className="mt-2 text-xs text-neutral-500">
            Viendo solo tus solicitudes: <span className="font-medium">{user?.email}</span>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        {rows.map((s) => (
          <Link to={buildLink(s.id)} key={s.id} className="card hover:bg-neutral-900/80">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">
                  Solicitud #{s.id} • Ticket {s.ticket_numero || s.cliente_label || "N/A"}
                </div>
                <div className="text-sm text-neutral-400">
                  {s.cliente_nombre || s.razon_social || "Sin cliente"}
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(s.creado_en).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <EstadoBadge code={s.estado_code} />
                <div className="text-xs text-neutral-400 mt-1">
                  {s.prioridad_nombre || "Sin prioridad"}
                </div>
              </div>
            </div>
          </Link>
        ))}
        {!rows.length && <div className="text-sm text-neutral-400">Sin resultados.</div>}
      </div>
    </div>
  );
}
