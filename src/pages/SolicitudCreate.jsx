import { useMutation } from "@tanstack/react-query";
import { createSolicitud } from "../lib/api.js";
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

  // NUEVO shape del formulario: adiós ticket_id/cliente_id
  const [form, setForm] = useState({
    email: "",
    usuario_id: null,
    prioridad_id: 1,
    tipo_garantia_id: 1,
    gestion_garantia_id: 1,
    observaciones: "",

    // nuevos campos
    ticket_numero: "",
    cliente_nombre: "",
    ticket_id_externo: "", // el Zoho ID
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Etiquetas de solo lectura
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

        // escribir en el form lo que vamos a ENVIAR
        set("cliente_nombre", razon || "");
        set("ticket_numero", numeroZoho || "");
        set("ticket_id_externo", String(zohoId));
      } catch (e) {
        console.error("No pude precargar por Zoho ID:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zohoId]);

  // Si un agente/admin cambia el responsable manualmente,
  // podrías cargar lista de usuarios aquí si quisieras.
  // Para no distraernos, lo dejamos simple:
  const puedeCambiarUsuario = esGarantias && cambiarUsuario;

  const { mutate, isPending } = useMutation({
    mutationFn: createSolicitud,
    onSuccess: (data) =>
      navigate(esSolicitante ? `/s/${data.id}/solicitante` : `/s/${data.id}`),
    onError: (e) => alert(e?.response?.data?.error || e.message),
  });

  // Nueva validación: ya no pedimos ticket_id/cliente_id
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
    // payload con los nuevos nombres
    const payload = {
      email: form.email,
      usuario_id: form.usuario_id,
      prioridad_id: form.prioridad_id,
      tipo_garantia_id: form.tipo_garantia_id,
      gestion_garantia_id: form.gestion_garantia_id,
      observaciones: form.observaciones,

      // Lo importante:
      ticket_numero: form.ticket_numero,
      cliente_nombre: form.cliente_nombre,
      ticket_id_externo: form.ticket_id_externo,
    };

    mutate(payload);
  };

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
            <div className="text-sm font-medium text-neutral-300">
              Usuario interno (responsable)
            </div>
            {esGarantias && (
              <label className="text-xs flex items-center gap-2 cursor-pointer select-none">
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

          {/* Solicitante: fijo a Nohemí */}
          {esSolicitante && (
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
              value={`${user?.name || user?.displayName || ""} • ${
                user?.email || ""
              }`}
              disabled
            />
          )}

          {/* Si quisieras permitir elegir responsable, aquí iría el select de usuarios */}
          {puedeCambiarUsuario && (
            <div className="text-xs text-neutral-500">
              Aquí pondrías tu selector de usuarios, si decides activarlo.
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="mb-2 text-sm font-medium text-neutral-300">
            Correo del solicitante (contacto)
          </div>
          <input
            className="input"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            disabled={esSolicitante && !cambiarUsuario}
          />
          {esSolicitante && !cambiarUsuario && (
            <div className="mt-1 text-xs text-neutral-400">
              Se usa tu correo de sesión.
            </div>
          )}
        </div>
      </section>

      {/* Solo lectura para confirmar que jaló bien */}
      <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-3 mb-2">
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-600/20 text-amber-300 uppercase text-[10px] tracking-wide">
              Cliente
            </span>
            <span className="font-medium text-neutral-200">
              {clienteLabel || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-600/20 text-amber-300 uppercase text-[10px] tracking-wide">
              Ticket
            </span>
            <span className="font-medium text-neutral-200">
              {ticketLabel || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-600/20 text-amber-300 uppercase text-[10px] tracking-wide">
              Zoho ID
            </span>
            <span className="font-medium text-neutral-200">
              {zohoId || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Parámetros de garantía */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="mb-2 text-sm font-medium text-neutral-300">Prioridad</div>
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

        <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/40 grid md:grid-cols-2 gap-3">
          <div>
            <div className="mb-2 text-sm font-medium text-neutral-300">Tipo de garantía</div>
            <select
              className="input"
              value={form.tipo_garantia_id}
              onChange={(e) => set("tipo_garantia_id", Number(e.target.value))}
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
              onChange={(e) => set("gestion_garantia_id", Number(e.target.value))}
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
          onChange={(e) => set("observaciones", e.target.value)}
        />
      </section>

      {/* Footer acciones */}
      <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-black/60">
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
