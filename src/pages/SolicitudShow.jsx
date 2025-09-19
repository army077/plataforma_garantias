import { useQuery, useMutation } from "@tanstack/react-query";
import { addItem, buscarProductos, cambiarEstadoSolicitud, getSolicitud } from "../lib/api.js";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import EstadoBadge from "../components/EstadoBadge.jsx";
import Loader from "../components/Loader.jsx";

const transiciones = {
  CREADA: ["EN_REVISION", "CANCELADA"],
  EN_REVISION: ["APROBADA", "RECHAZADA", "CANCELADA"],
  APROBADA: ["LIBERADA", "CANCELADA"],
  LIBERADA: ["ENTREGADA"],
  ENTREGADA: ["CERRADA"],
};

// --- Conversión visual a MXN (solo UI) ---
const MXN_FORMAT = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

// Mapa de monedas -> tipo de cambio a MXN (ajústalo o tráelo desde backend más tarde)
const FX_TO_MXN = {
  "1": 1,     // MXN
  "2": 19.0,  // USD -> MXN (ejemplo)
  "3": 2.59,  // EUR -> MXN (ejemplo)
  "4": 21.0,  // USD -> MXN (ejemplo)
  "5": 26.0,  // EUR -> MXN (ejemplo)
};

const MONEDA_LABEL = { "1": "MXN", "2": "USD", "3": "YUAN", "4": "EURO", "5": "LIBRA ESTERLINA" };

function toMXN(amount = 0, moneda = "1") {
  const rate = FX_TO_MXN[String(moneda)] ?? 1;
  return amount * rate;
}

export default function SolicitudShow() {
  const { id } = useParams();
  const { data: s, isLoading, refetch } = useQuery({
    queryKey: ["solicitud", id],
    queryFn: () => getSolicitud(id),
  });

  const [nota, setNota] = useState("");
  const [q, setQ] = useState("");
  const [productos, setProductos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [cantidad, setCantidad] = useState(1);

  // si cambias el producto seleccionado, reinicia cantidad
  useEffect(() => { setCantidad(1); }, [selected?.id]);

  const mutCambiar = useMutation({
    mutationFn: ({ a, nota }) => cambiarEstadoSolicitud(id, a, nota, 4),
    onSuccess: () => { setNota(""); refetch(); },
    onError: (e) => alert(e?.response?.data?.error || e.message),
  });

  const mutAdd = useMutation({
    mutationFn: (payload) => addItem(id, payload),
    onSuccess: () => { setSelected(null); setProductos([]); setCantidad(1); refetch(); },
    onError: (e) => alert(e?.response?.data?.error || e.message),
  });

  if (isLoading) return <Loader />;

  const acc = transiciones[s?.estado_code] || [];

  // helpers cantidad
  // helpers cantidad
  const step = selected?.uni_med?.toUpperCase() === "HORA" ? 0.5 : 1;
  const min = step;
  const qtyNum = Number(cantidad);
  const qtyValid = !Number.isNaN(qtyNum) && qtyNum >= min;

  // precios UI (mostramos MXN sin cambiar payload)
  const unitPrice = selected?.precio_venta ?? 0;
  const unitCur = selected?.moneda_precio ?? "1";
  const unitPriceMXN = toMXN(unitPrice, unitCur);

  const totalPreview = selected && qtyValid ? qtyNum * unitPrice : 0;        // en moneda original
  const totalPreviewMXN = selected && qtyValid ? qtyNum * unitPriceMXN : 0;     // en MXN

  const handleAdd = () => {
    if (!selected || !qtyValid) return;
    const p = selected;
    mutAdd.mutate({
      producto_id: p.id,
      numero_parte: p.clave_prod,
      descripcion: p.desc_prod,
      cantidad: qtyNum,
      unidad: p.uni_med,
      precio_unitario: p.precio_venta || 0,
      costo_unitario: p.costo_entrante || 0,
      moneda_precio: p.moneda_precio || "1",
      moneda_costo: p.moneda_costo || "1",
      motivo: "Definir motivo",
      comentarios: "Agregado desde catálogo",
    });
  };

  return (
    <div className="grid gap-3">
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-lg">Solicitud #{s.id} • {s.razon_social || "Sin cliente"}</div>
            <div className="text-sm text-neutral-400">Ticket {s.ticket_numero || "N/A"} • {new Date(s.creado_en).toLocaleString()}</div>
          </div>
          <EstadoBadge code={s.estado_code} />
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Acciones</div>
        <div className="flex gap-2 flex-wrap">
          {acc.map((a) => (
            <button key={a} className="btn btn-primary" onClick={() => mutCambiar.mutate({ a, nota })}>
              {a.replaceAll("_", " ")}
            </button>
          ))}
          <input className="input w-72" placeholder="Nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Items</div>
        {s.items?.length ? s.items.map((it) => (
          <div key={it.id} className="flex justify-between py-2 border-b border-neutral-800 last:border-0">
            <div>
              <div className="font-medium">{it.numero_parte} • {it.descripcion}</div>
              <div className="text-sm text-neutral-400">
                Cant: {it.cantidad} {it.unidad} • ${it.precio_unitario || 0} • Estado: {it.estado_pieza_code}
              </div>
            </div>
            <div className="text-xs text-neutral-500">{it.folio_sai_liberacion || ""}</div>
          </div>
        )) : <div className="text-sm text-neutral-400">Sin items.</div>}
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Agregar item desde catálogo</div>
        <div className="flex gap-2 items-center">
          <input
            className="input"
            placeholder="Buscar por clave o descripción"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={async (e) => { if (e.key === "Enter") setProductos(await buscarProductos(q, 0, 8)); }}
          />
          <button className="btn" onClick={async () => setProductos(await buscarProductos(q, 0, 8))}>Buscar</button>

          {/* Cantidad */}
          <div className="flex items-center gap-1">
            <button
              className="btn px-2"
              onClick={() => setCantidad(prev => {
                const n = Number(prev) || min;
                return Math.max(min, +(n - step).toFixed(2));
              })}
              disabled={!selected}
              title="Menos"
            >−</button>
            <input
              className="input w-24 text-center"
              type="number"
              step={step}
              min={min}
              value={cantidad}
              disabled={!selected}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <button
              className="btn px-2"
              onClick={() => setCantidad(prev => {
                const n = Number(prev) || 0;
                return +(n + step).toFixed(2);
              })}
              disabled={!selected}
              title="Más"
            >+</button>
          </div>

          <button
            className="btn"
            disabled={!selected || !qtyValid}
            onClick={handleAdd}
            title={!selected ? "Selecciona un producto" : (!qtyValid ? "Cantidad inválida" : "Agregar")}
          >Agregar</button>
        </div>

        {/* Preview productos */}
        <div className="grid md:grid-cols-2 gap-2 mt-3">
          {productos.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className={`card cursor-pointer ${selected?.id === p.id ? "ring-2 ring-blue-600" : ""}`}
            >
              <div className="font-medium">{p.clave_prod} • {p.desc_prod}</div>
              <div className="text-sm text-neutral-400">
                {p.uni_med} • Precio:
                {" "}
                {MXN_FORMAT.format(toMXN(p.precio_venta ?? 0, p.moneda_precio || "1"))}
                {" "}
                <span className="text-neutral-500">
                  ({MONEDA_LABEL[p.moneda_precio || "1"] ?? "MXN"} {Number(p.precio_venta ?? 0).toFixed(4)})
                </span>
                {selected?.id === p.id && qtyValid ? (
                  <span className="ml-2 text-neutral-300">
                    • Cant: {qtyNum} • Total: {MXN_FORMAT.format(totalPreviewMXN)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
          {!productos.length && <div className="text-sm text-neutral-500">Sin resultados.</div>}
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Bitácora</div>
        {s.bitacora?.length ? s.bitacora.map((b) => (
          <div key={b.id} className="text-sm text-neutral-300 py-1 border-b border-neutral-800 last:border-0">
            {new Date(b.ts).toLocaleString()} • {b.accion} {b.de ? `(${b.de}→${b.a})` : ""} {b.nota ? `• ${b.nota}` : ""}
            <span className="text-neutral-500"> {b.actor ? `• ${b.actor}` : ""}</span>
          </div>
        )) : <div className="text-sm text-neutral-500">Sin movimientos.</div>}
      </div>
    </div>
  );
}