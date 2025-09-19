import { useMutation, useQuery } from "@tanstack/react-query";
import { createSolicitud, listUsuarios, listClientes, listTickets } from "../lib/api.js";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";

// Responsable por defecto para solicitantes
const RESPONSABLE_DEFAULT = {
  id: 3,
  nombre: "Nohemi Amaya",
  email: "nohemi.amaya@asiarobotica.com",
};

export default function SolicitudCreate() {
  const navigate = useNavigate();
  const { user, role, usuarioId } = useAuth();
  const esSolicitante = role === "solicitante";
  const esGarantias = role === "garantias" || role === "admin";

  // Agente/admin pueden cambiar el responsable; solicitante NO
  const [cambiarUsuario, setCambiarUsuario] = useState(false);

  const [form, setForm] = useState({
    email: "",
    usuario_id: null,
    prioridad_id: 1,
    ticket_id: null,
    cliente_id: null,
    tipo_garantia_id: 1,
    gestion_garantia_id: 1,
    observaciones: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Prefill: email siempre es el del que inicia sesión.
  // usuario_id:
  //  - solicitante => Nohemí (id 3)
  //  - agente/admin => su propio usuarioId (editable si activan "Cambiar usuario")
  useEffect(() => {
    if (user?.email) set("email", user.email);
    if (esSolicitante) {
      console.log("Insertar id de la persona de garantias: " + RESPONSABLE_DEFAULT.id);
      set("usuario_id", RESPONSABLE_DEFAULT.id);
      setCambiarUsuario(false);
    } else if (usuarioId) {
      console.log("Insertar id del login: " + usuarioId);
      set("usuario_id", usuarioId);
    }
  }, [user?.email, usuarioId, esSolicitante]);

  // búsquedas
  const [qUsuario, setQUsuario] = useState("");
  const [qCliente, setQCliente] = useState("");
  const [qTicket, setQTicket] = useState("");

  // Solo cargo usuarios si un agente/admin activó el toggle
  const { data: usuarios = [], refetch: refetchUsuarios, isFetching: fU } = useQuery({
    queryKey: ["usuarios", qUsuario, cambiarUsuario],
    queryFn: () => listUsuarios(qUsuario, 0, 20),
    enabled: esGarantias && cambiarUsuario,
  });

  const { data: clientes = [], refetch: refetchClientes, isFetching: fC } = useQuery({
    queryKey: ["clientes", qCliente],
    queryFn: () => listClientes(qCliente, 0, 20),
  });

  const { data: tickets = [], refetch: refetchTickets, isFetching: fT } = useQuery({
    queryKey: ["tickets", qTicket],
    queryFn: () => listTickets(qTicket, 0, 20),
  });

  // Si agente/admin cambia usuario y elige uno, autollenar email solo si el campo está vacío.
  useEffect(() => {
    if (!(esGarantias && cambiarUsuario)) return;
    const u = usuarios.find(x => x.id === form.usuario_id);
    if (u && !form.email) set("email", u.email);
  }, [form.usuario_id, usuarios, esGarantias, cambiarUsuario]);

  const { mutate, isPending } = useMutation({
    mutationFn: createSolicitud,
    onSuccess: (data) => navigate(esSolicitante ? `/s/${data.id}/solicitante` : `/s/${data.id}`),
    onError: (e) => alert(e?.response?.data?.error || e.message),
  });

  const canSubmit = useMemo(() =>
    Boolean(form.usuario_id && form.ticket_id && form.cliente_id && form.email),
  [form]);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Nueva solicitud</div>
        <div className="text-xs px-2 py-1 rounded-full border border-neutral-700">
          {role || "sin-rol"}
        </div>
      </div>

      {/* Usuario / Email */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-neutral-300">Usuario interno (responsable)</div>
            {esGarantias && (
              <label className="text-xs flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={cambiarUsuario}
                  onChange={(e)=>setCambiarUsuario(e.target.checked)}
                />
                Cambiar usuario
              </label>
            )}
          </div>

          {/* Solicitante: fijo a Nohemí */}
          {esSolicitante && (
            <input
              className="input"
              value={`${RESPONSABLE_DEFAULT.nombre} • ${RESPONSABLE_DEFAULT.email}`}
              disabled
            />
          )}

          {/* Agente/Admin: por defecto ellos mismos; pueden cambiar si activan toggle */}
          {!esSolicitante && !cambiarUsuario && (
            <input
              className="input"
              value={`${user?.name || user?.displayName || ""} • ${user?.email || ""}`}
              disabled
            />
          )}

          {esGarantias && cambiarUsuario && (
            <>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Buscar usuario (nombre o email)"
                  value={qUsuario}
                  onChange={(e)=>setQUsuario(e.target.value)}
                />
                <button className="btn" onClick={()=>refetchUsuarios()} disabled={fU}>
                  {fU ? "..." : "Buscar"}
                </button>
              </div>
              <select
                className="input mt-2"
                value={form.usuario_id || ""}
                onChange={(e)=>set("usuario_id", Number(e.target.value) || null)}
              >
                <option value="">Selecciona usuario…</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} • {u.email}</option>
                ))}
              </select>
              {form.usuario_id && (
                <div className="mt-1 text-xs text-neutral-400">Seleccionado ID: {form.usuario_id}</div>
              )}
            </>
          )}
        </div>

        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="mb-2 text-sm font-medium text-neutral-300">Correo del solicitante (contacto)</div>
          <input
            className="input"
            value={form.email}
            onChange={(e)=>set("email", e.target.value)}
            disabled={esSolicitante && !cambiarUsuario}
          />
          {esSolicitante && !cambiarUsuario && (
            <div className="mt-1 text-xs text-neutral-400">
              Se usa tu correo de sesión.
            </div>
          )}
        </div>
      </section>

      {/* Cliente / Ticket */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="mb-2 text-sm font-medium text-neutral-300">Cliente</div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Buscar cliente (razón social)"
              value={qCliente}
              onChange={(e)=>setQCliente(e.target.value)}
            />
            <button className="btn" onClick={()=>refetchClientes()} disabled={fC}>
              {fC ? "..." : "Buscar"}
            </button>
          </div>
          <select
            className="input mt-2"
            value={form.cliente_id || ""}
            onChange={(e)=>set("cliente_id", Number(e.target.value) || null)}
          >
            <option value="">Selecciona cliente…</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.razon_social}</option>
            ))}
          </select>
        </div>

        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="mb-2 text-sm font-medium text-neutral-300">Ticket</div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Buscar ticket (número o id_externo)"
              value={qTicket}
              onChange={(e)=>setQTicket(e.target.value)}
            />
            <button className="btn" onClick={()=>refetchTickets()} disabled={fT}>
              {fT ? "..." : "Buscar"}
            </button>
          </div>
          <select
            className="input mt-2"
            value={form.ticket_id || ""}
            onChange={(e)=>set("ticket_id", Number(e.target.value) || null)}
          >
            <option value="">Selecciona ticket…</option>
            {tickets.map(t => (
              <option key={t.id} value={t.id}>
                #{t.id} • {t.numero}{t.id_externo ? ` • ${t.id_externo}` : ""}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Parámetros de garantía */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="mb-2 text-sm font-medium text-neutral-300">Prioridad</div>
          <select
            className="input"
            value={form.prioridad_id}
            onChange={(e)=>set("prioridad_id", Number(e.target.value))}
          >
            <option value={1}>Alta - Urgente/Escalación</option>
            <option value={2}>Medio - Importante</option>
            <option value={3}>Baja - Normal</option>
          </select>
        </div>

        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40 grid md:grid-cols-2 gap-3">
          <div>
            <div className="mb-2 text-sm font-medium text-neutral-300">Tipo de garantía</div>
            <select
              className="input"
              value={form.tipo_garantia_id}
              onChange={(e)=>set("tipo_garantia_id", Number(e.target.value))}
            >
              <option value={1}>Local</option>
              <option value={2}>Foránea</option>
              <option value={3}>Extendida</option>
              <option value={4}>Sin Garantía</option>
            </select>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-neutral-300">Gestión</div>
            <select
              className="input"
              value={form.gestion_garantia_id}
              onChange={(e)=>set("gestion_garantia_id", Number(e.target.value))}
            >
              <option value={1}>Visita técnica presencial</option>
              <option value={2}>Liberación y envío de refacción</option>
              <option value={3}>Reparación en taller</option>
              <option value={4}>Soporte remoto</option>
              <option value={5}>Otro</option>
            </select>
          </div>
        </div>
      </section>

      {/* Observaciones */}
      <section className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40">
        <div className="mb-2 text-sm font-medium text-neutral-300">Observaciones</div>
        <textarea
          className="input h-28"
          placeholder="Describe brevemente el caso"
          value={form.observaciones}
          onChange={(e)=>set("observaciones", e.target.value)}
        />
      </section>

      {/* Footer acciones */}
      <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-black/60">
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={()=>history.back()}>Cancelar</button>
          <button
            className={`btn btn-primary ${!canSubmit ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={isPending || !canSubmit}
            onClick={()=>mutate(form)}
            title={!canSubmit ? "Completa usuario, cliente y ticket" : "Crear"}
          >
            {isPending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}