import { useMutation, useQuery } from "@tanstack/react-query";
import { createSolicitud, listUsuarios } from "../lib/api.js";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import axios from "axios";

// Responsable por defecto para solicitantes
const RESPONSABLE_DEFAULT = {
  id: 3,
  nombre: "Nohemi Amaya",
  email: "nohemi.amaya@asiarobotica.com",
};

export default function SolicitudCreate() {
  const navigate = useNavigate();
  const { zohoId } = useParams();
  const { user, role, usuarioId } = useAuth();

  const esSolicitante = role === "solicitante";
  const esGarantias = role === "garantias" || role === "admin";

  const [cambiarUsuario, setCambiarUsuario] = useState(false);

  const [form, setForm] = useState({
    email: "",
    usuario_id: null,
    prioridad_id: 2,
    tipo_garantia_id: 1,
    gestion_garantia_id: 1,
    observaciones: "",
    ticket_numero: "",
    cliente_nombre: "",
    ticket_id_externo: "", // Zoho ID
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [clienteLabel, setClienteLabel] = useState("");
  const [ticketLabel, setTicketLabel] = useState("");

  // Prefill responsable y email
  useEffect(() => {
    if (user?.email) set("email", user.email);

    if (esSolicitante) {
      set("usuario_id", RESPONSABLE_DEFAULT.id);
      setCambiarUsuario(false);
    } else if (usuarioId) {
      set("usuario_id", usuarioId);
    }
  }, [user?.email, usuarioId, esSolicitante]);

  // Autoprefill por Zoho ID
  useEffect(() => {
    if (!zohoId) return;
    (async () => {
      try {
        const { data: z } = await axios.get(
          `https://desarrollotecnologicoar.com/api8/ticket/${zohoId}`
        );
        const razon = z?.accountDetails?.accountName || "";
        const numeroZoho = z?.ticketNumber || "";

        setClienteLabel(razon || "—");
        setTicketLabel(numeroZoho || String(zohoId));

        set("cliente_nombre", razon || "");
        set("ticket_numero", numeroZoho || "");
        set("ticket_id_externo", String(zohoId));
      } catch (e) {
        console.error("No pude precargar por Zoho ID:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zohoId]);

  const puedeCambiarUsuario = esGarantias && cambiarUsuario;

  // Carga usuarios (sin búsqueda)
  const { data: usuarios = [], isFetching: fUsuarios } = useQuery({
    queryKey: ["usuarios", puedeCambiarUsuario],
    queryFn: () => listUsuarios("", 0, 20),
    enabled: puedeCambiarUsuario,
    staleTime: 60_000,
  });

  // Si apagas el toggle, restaurar responsable default/propio
  useEffect(() => {
    if (!cambiarUsuario) {
      if (esSolicitante) set("usuario_id", RESPONSABLE_DEFAULT.id);
      else if (usuarioId) set("usuario_id", usuarioId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cambiarUsuario]);

  const { mutate, isPending } = useMutation({
    mutationFn: createSolicitud,
    onSuccess: (data) =>
      navigate(esSolicitante ? `/s/${data.id}/solicitante` : `/s/${data.id}`),
    onError: (e) => alert(e?.response?.data?.error || e.message),
  });

  const canSubmit = useMemo(
    () =>
      Boolean(
        form.usuario_id &&
        form.email &&
        form.ticket_numero &&
        form.cliente_nombre &&
        form.ticket_id_externo
      ),
    [form]
  );

  const handleCrear = () => {
    const payload = {
      email: form.email,
      usuario_id: form.usuario_id,
      prioridad_id: form.prioridad_id,
      tipo_garantia_id: form.tipo_garantia_id,
      gestion_garantia_id: form.gestion_garantia_id,
      observaciones: form.observaciones,
      ticket_numero: form.ticket_numero,
      cliente_nombre: form.cliente_nombre,
      ticket_id_externo: form.ticket_id_externo,
    };
    mutate(payload);
  };

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-neutral-900">Nueva solicitud</div>
        <div className="text-xs px-2 py-1 rounded-full border border-neutral-300 bg-neutral-100 text-neutral-700">
          {role || "sin-rol"}
        </div>
      </div>

      {/* Usuario / Email */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-neutral-700">
              Usuario interno (responsable)
            </div>

            {esGarantias && (
              <label className="text-xs flex items-center gap-2 cursor-pointer select-none text-neutral-700">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={cambiarUsuario}
                  onChange={(e) => setCambiarUsuario(e.target.checked)}
                />
                Cambiar usuario
              </label>
            )}
          </div>

          {/* Solicitante fijo */}
          {esSolicitante && !puedeCambiarUsuario && (
            <input
              className="input"
              value={`${RESPONSABLE_DEFAULT.nombre} • ${RESPONSABLE_DEFAULT.email}`}
              disabled
            />
          )}

          {/* Agente/Admin sin cambio */}
          {!esSolicitante && !puedeCambiarUsuario && (
            <input
              className="input"
              value={`${user?.name || user?.displayName || ""} • ${user?.email || ""}`}
              disabled
            />
          )}

          {/* Selector de usuarios habilitado */}
          {puedeCambiarUsuario && (
            <>
              <select
                className="input mt-2"
                value={form.usuario_id || ""}
                onChange={(e) => set("usuario_id", Number(e.target.value) || null)}
              >
                <option value="">Selecciona usuario…</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} • {u.email}
                  </option>
                ))}
              </select>
              {fUsuarios && (
                <div className="mt-1 text-xs text-neutral-500">Cargando usuarios…</div>
              )}
              {form.usuario_id && (
                <div className="mt-1 text-xs text-neutral-500">
                  Seleccionado ID: {form.usuario_id}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 rounded-xl border border-neutral-200 bg-white">
          <div className="mb-2 text-sm font-medium text-neutral-700">
            Correo del solicitante (contacto)
          </div>
          <input
            className="input"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            disabled={esSolicitante && !cambiarUsuario}
          />
          {esSolicitante && !cambiarUsuario && (
            <div className="mt-1 text-xs text-neutral-500">
              Se usa tu correo de sesión.
            </div>
          )}
        </div>
      </section>

      {/* Solo lectura (chips) */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-2">
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase text-[10px] tracking-wide">
              Cliente
            </span>
            <span className="font-medium text-neutral-800">{clienteLabel || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase text-[10px] tracking-wide">
              Ticket
            </span>
            <span className="font-medium text-neutral-800">{ticketLabel || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase text-[10px] tracking-wide">
              Zoho ID
            </span>
            <span className="font-medium text-neutral-800">{zohoId || "—"}</span>
          </div>
        </div>
      </div>

      {/* Parámetros */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-neutral-200 bg-white">
          <div className="mb-2 text-sm font-medium text-neutral-700">Prioridad</div>
          <select
            className="input"
            value={form.prioridad_id}
            onChange={(e) => set("prioridad_id", Number(e.target.value))}
          >
            <option value={1}>Alta - Urgente/Escalación</option>
            <option value={2}>Medio - Importante</option>
            <option value={3}>Baja - Normal</option>
          </select>
        </div>

        <div className="p-3 rounded-xl border border-neutral-200 bg-white grid md:grid-cols-2 gap-3">
          <div>
            <div className="mb-2 text-sm font-medium text-neutral-700">Tipo de garantía</div>
            <select
              className="input"
              value={form.tipo_garantia_id}
              onChange={(e) => set("tipo_garantia_id", Number(e.target.value))}
            >
              <option value={1}>Local</option>
              <option value={2}>Foránea</option>
            </select>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-neutral-700">Gestión</div>
            <select
              className="input"
              value={form.gestion_garantia_id}
              onChange={(e) => set("gestion_garantia_id", Number(e.target.value))}
            >
              <option value={1}>Visita técnica presencial</option>
              <option value={2}>Liberación y envío de refacción</option>
              <option value={3}>Reparación en taller</option>
            </select>
          </div>
        </div>
      </section>

      {/* Observaciones */}
      <section className="p-3 rounded-xl border border-neutral-200 bg-white">
        <div className="mb-2 text-sm font-medium text-neutral-700">Observaciones</div>
        <textarea
          className="input h-28"
          placeholder="Describe brevemente el caso"
          value={form.observaciones}
          onChange={(e) => set("observaciones", e.target.value)}
        />
      </section>

      {/* Footer */}
      <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-white">
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={() => history.back()}>Cancelar</button>
          <button
            className={`btn btn-primary ${!canSubmit ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={isPending || !canSubmit}
            onClick={handleCrear}
            title={!canSubmit ? "Completa usuario, email, ticket y cliente" : "Crear"}
          >
            {isPending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
