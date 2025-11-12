// src/pages/SolicitudShow.jsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addItem,
  buscarProductos,
  cambiarEstadoSolicitud,
  getSolicitud,
  setClasificacionGarantia,
  setClasificacionItem,
  setCostoItem,
  setDescripcionItem,
  addZohoComment
} from "../lib/api.js";
import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import EstadoBadge from "../components/EstadoBadge.jsx";
import Loader from "../components/Loader.jsx";

/*----------------------- Motivos de garantía ----------------------- */

const MotivoGarantiaOptions = ['Funcional', 'Descuido técnico', 'Refacción incorrecta', 'Faltante', 'Otro motivo'];

/* ----------------------- Estados permitidos ----------------------- */
const transiciones = {
  CREADA: ["EN_REVISION", "CANCELADA"],
  EN_REVISION: ["APROBADA", "RECHAZADA", "CANCELADA"],
  APROBADA: ["LIBERADA", "CANCELADA"],
  LIBERADA: ["ENTREGADA"],
  ENTREGADA: ["CERRADA"],
};

/* ----------------------- Conversión y etiquetas ----------------------- */
const MXN_FORMAT = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});
const FX_TO_MXN = { "1": 1, "2": 19.0, "3": 2.59, "4": 21.0, "5": 26.0 };
const MONEDA_LABEL = {
  "1": "MXN",
  "2": "USD",
  "3": "YUAN",
  "4": "EURO",
  "5": "LIBRA ESTERLINA",
};

// opciones del combo
const CLASIF_OPTIONS = [
  "Instalación",
  "Garantía de Equipo",
  "Garantía de Componente/ Servicio",
  "Cortesía",
];

const MEDIO_ENTREGA_OPTIONS = [
  "Entrega en sucursal",
  "Envío por Uber",
  "Paquetería a domicilio del cliente",
  "Paquetería ocurre o central",
  "Envío por grúa interna",
];


/* ----------------------- Placeholder de imagen ----------------------- */
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
      <rect width='100%' height='100%' fill='#0a0a0a'/>
      <g fill='#6b7280' font-family='Arial,sans-serif' font-size='22'>
        <text x='50%' y='50%' text-anchor='middle'>Sin imagen</text>
      </g>
    </svg>`
  );

function toMXN(amount = 0, moneda = "1") {
  const rate = FX_TO_MXN[String(moneda)] ?? 1;
  return amount * rate;
}

/* ----------------------- Hardcode de piezas por máquina ----------------------- */
const machineParts = {
  MAKER0609: [
    "P00178", "P00183", "P00184", "P00185", "P00240", "P00241", "P00243", "P00244", "M00576", "P00295", "P02766",
    "P02767", "P02768", "P00835", "P00283"
  ],

  BENDWORX: [
    "P03842", "P03843", "P03844", "P03845", "P03846", "P03847", "P03848", "P03849", "P03850", "P00236", "P03851",
    "P03841", "P03839", "P03840", "P03939", "P03831", "P03832", "P03833", "P03834", "P03835", "P03836", "P03876",
    "P03875", "P03873", "P03874"
  ],

  WELDWORX: [
    "P03940", "P03941", "P03942", "P03943", "P03944", "P03945", "P03946", "P03947", "P03948", "P03949", "P03963",
    "P03964", "P03965", "P03966", "P03968", "P01205", "P03794", "P03967", "P03970", "P03973", "P03974", "P03976",
    "P03971", "P03674", "P03972", "P03887", "P00092", "P00924", "P02506", "P01202", "P02503", "P03619", "P03593",
    "P03994", "P03995", "P04004", "P04005", "P03563"
  ],

  PLASMA: [
    "P01083", "P02384", "P00935", "P00936", "P00939", "P00942", "P00945", "P00917", "P00949", "P00952", "P00953",
    "P03543", "P03544", "P03545", "P03546", "P03547", "P00934", "P00938", "P02021", "P02022", "P02023", "P02024",
    "P02026", "P02027", "P02921", "P00329", "P02832", "P00853", "M00749"
  ],

  SHOPPRO: [
    "P00152", "P00076", "P01091", "P00835", "P00092", "P03572", "P00001", "P04072", "P04158", "P00228", "P00229",
    "P00230", "P02987", "P00231", "P00234", "M00247", "P01205", "P02107", "P00177", "P00180", "P00182", "P00183",
    "P00184", "P00185", "P00245", "P00246", "P00247", "P00250", "P00251", "M00253", "P00148", "P01943", "P04191",
    "P03609", "P04012", "P04094", "P04013", "P01207", "P04077", "P02203", "P03452", "P00079", "P01990", "P00263",
    "P02748", "P00078", "P00079", "P03289", "P03315"
  ],

  WORKS: [
    "P04012", "P00411", "P00413", "P02221", "P00113", "P02203", "P00101", "P02925", "P00092", "P01990", "P00264",
    "P00001", "P00300", "P00003", "P00055", "P00148", "P00238", "P00263", "M00247", "P03572", "P01207", "P00695",
    "P00180", "P00182", "P00183", "P00184", "P00185", "P00255", "P00257", "P00258", "P00259", "P00256", "P02157",
    "P01092", "P00373", "P03046", "P02925", "P00428", "P00333", "P00854", "P00439", "P03466", "P00364", "P02169",
    "P01053", "P03883", "P03352", "P03816", "P03817", "P02158", "P03730", "P01100"
  ],

  MULTIHEAD: [
    "M00471", "M00472", "M00563", "P00177", "P00180", "P00182", "P00183", "P00184", "P00185", "P00245", "P00246",
    "P00247", "P00250", "P00251", "P02251", "P00301", "P00302", "P01167", "P01646", "M00042", "M00465", "P02764",
    "P03454", "P02169", "P00127", "P00128", "M00109", "P00329", "P00328", "M00182"
  ],

  CREATOR: [
    "P03677", "P00753", "P00197", "P03269", "P00163", "P03724", "P03743", "P03576", "M00776", "P03300", "P04188",
    "P00581", "P03156", "P02326", "P00584", "P03652", "P03678", "P03604", "P03660", "P03680", "P03157", "P03158",
    "P03162", "P03454", "P03457", "P04283", "P04229", "P03784", "P04142", "P03527", "P04284", "P04285"
  ],

  SAAP: [
    "P03304", "P03245", "P03250", "P03257", "P03256", "P03236", "P03242", "P03255", "P03253", "P03336", "P03249",
    "P03238", "P03246", "P03260", "P03251", "P03341", "P03261", "P01616", "P03241", "P03241", "P03244", "P03240",
    "P03344", "M00666", "P03345", "P03235", "M00672", "P03346", "M00686", "P03506"
  ]
};

// Etiquetas e imágenes de cada máquina (en /public/img/*.png)
const MACHINE_META = {
  MAKER0609: { label: "Maker", img: "/img/maker0609.png" },
  BENDWORX: { label: "Bend Worx", img: "/img/bendworx.png" },
  WELDWORX: { label: "Weld Worx", img: "/img/weldworx.png" },
  PLASMA: { label: "Plasma Blade", img: "/img/plasma.png" },
  SHOPPRO: { label: "Shop Pro", img: "/img/shoppro.png" },
  WORKS: { label: "Works", img: "/img/works.png" },
  MULTIHEAD: { label: "Multihead", img: "/img/multihead.png" },
  CREATOR: { label: "Creator", img: "/img/creator0704.png" }, // usamos 0704 como icono
  SAAP: { label: "SAAP", img: "/img/saap.png" },
};

/* Etiquetas “bonitas” para el dropdown */
const MACHINE_LABEL = {
  MAKER0609: "Maker",
  BENDWORX: "Bend Worx",
  WELDWORX: "Weld Worx",
  PLASMA: "Plasma Blade",
  SHOPPRO: "Shop Pro",
  WORKS: "Works",
  MULTIHEAD: "Multihead",
  CREATOR: "Creator",
  SAAP: "SAAP",
};

const ITEM_CLASIF_OPTS = [
  "Pieza sin Seguimiento",
  "Utilizada y con técnico",
  "No utilizada y con técnico",
  "En almacén AR",
  "Con el Cliente",
  "Utilizada y con Garantías",
  "Utilizada y en CDMX",
  "Utilizada y en MTY",
  "Utilizada y en Ocotlán",
];

// HTML para comentar en Zoho cuando se entrega
function buildEntregaHTML(solicitud) {
  const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
  const itemsRows = (solicitud.items || [])
    .map(it => `
      <tr>
        <td>${it.numero_parte || ""}</td>
        <td>${(it.descripcion || "").replace(/</g, "&lt;")}</td>
        <td class="num">${it.cantidad ?? ""} ${it.unidad ?? ""}</td>
        <td class="num">${fmt.format(Number(it.precio_total ?? 0))}</td>
      </tr>
    `)
    .join("");

  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a;">
    <div style="padding:16px; border-radius:12px; background:#f3f4f6; border:1px solid #d1d5db;">
      <h2 style="margin:0 0 6px; font-size:18px;">Orden de Trabajo entregada ✅</h2>
      <div style="font-size:12px; color:#475569; margin-bottom:10px;">Estatus: <strong>PIEZAS ENTREGADAS</strong>.</div>

      <table style="width:100%; border-collapse:separate; border-spacing:0 8px; font-size:13px;">
        <tr>
          <td style="width:180px; color:#64748b;">Agente:</td>
          <td style="font-weight:600;">Nohemi Amaya</td>
        </tr>
        <tr>
          <td style="color:#64748b;">Clasificación de Garantía:</td>
          <td>${solicitud.clasificacion_garantia || "-"}</td>
        </tr>
        <tr>
          <td style="color:#64748b;">Medio de Entrega:</td>
          <td>${solicitud.medio_entrega || "-"}</td>
        </tr>
      </table>

      <div style="margin-top:14px; font-weight:600;">Piezas relacionadas</div>
      <table style="width:100%; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; font-size:13px;">
        <thead>
          <tr style="background:#ef4444; color:white;">
            <th style="text-align:left; padding:8px 10px; width:120px;">Número</th>
            <th style="text-align:left; padding:8px 10px;">Descripción</th>
            <th style="text-align:right; padding:8px 10px; width:140px;">Cantidad</th>
            <th style="text-align:right; padding:8px 10px; width:140px;">Precio total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || `<tr><td colspan="4" style="padding:10px; color:#64748b;">Sin items.</td></tr>`}
        </tbody>
      </table>

      <style>
        td.num, th.num { text-align:right; }
        tbody tr:nth-child(odd) td { background:#f9fafb; }
        tbody td { padding:8px 10px; }
      </style>

      <div style="margin-top:12px; font-size:12px; color:#64748b;">
        Generado automáticamente por la plataforma de garantías.
      </div>
    </div>
  </div>`;
}


export default function SolicitudShow() {
  const { id } = useParams();

  const { data: s, isLoading, refetch } = useQuery({
    queryKey: ["solicitud", id],
    queryFn: () => getSolicitud(id),
  });

  const queryClient = useQueryClient();

  const [nota, setNota] = useState("");

  // Búsqueda normal por texto
  const [q, setQ] = useState("");
  const [productos, setProductos] = useState([]);

  // Drawer state
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // cantidad
  const [cantidad, setCantidad] = useState(1);
  useEffect(() => {
    setCantidad(1);
  }, [selected?.id]);

  // Submenú de máquinas
  const [machineKey, setMachineKey] = useState("");
  const [partsLoading, setPartsLoading] = useState(false);

  const mutCambiar = useMutation({
    mutationFn: ({ a, nota }) => cambiarEstadoSolicitud(id, a, nota, 4),
    onSuccess: () => {
      setNota("");
      refetch();
    },
    onError: (e) => alert(e?.response?.data?.error || e.message),
  });

  const mutAdd = useMutation({
    mutationFn: (payload) => addItem(id, payload),
    onSuccess: () => {
      setSelected(null);
      setProductos([]);
      setCantidad(1);
      setDrawerOpen(false);
      refetch();
    },
    onError: (e) => alert(e?.response?.data?.error || e.message),
  });
  // una para el status
  const mutStatusItem = useMutation({
    mutationFn: ({ itemId, status }) => setClasificacionItem(id, itemId, { status }),
    onSuccess: () => queryClient.invalidateQueries(["solicitud", id]),
    onError: (e) => alert("Error al guardar status: " + e.message),
  });

  // otra para el motivo
  const mutMotivoItem = useMutation({
    mutationFn: ({ itemId, motivo }) => setClasificacionItem(id, itemId, { motivo }),
    onSuccess: () => queryClient.invalidateQueries(["solicitud", id]),
    onError: (e) => alert("Error al guardar motivo: " + e.message),
  });

  const mutCantidadItem = useMutation({
    mutationFn: ({ itemId, cantidad }) =>
      setClasificacionItem(id, itemId, { cantidad }),
    onSuccess: () => queryClient.invalidateQueries(["solicitud", id]),
    onError: (e) => alert("Error al guardar cantidad: " + e.message),
  });

  const mutCostoItem = useMutation({
    mutationFn: ({ itemId, costo_unitario }) =>
      setCostoItem(id, itemId, { costo_unitario }),
    onSuccess: () => queryClient.invalidateQueries(["solicitud", id]),
    onError: (e) => alert("Error al guardar costo: " + e.message),
  });

  const mutDescripcionItem = useMutation({
    mutationFn: ({ itemId, descripcion }) =>
      setDescripcionItem(id, itemId, { descripcion }),
    onSuccess: () => queryClient.invalidateQueries(["solicitud", id]),
    onError: (e) => alert("Error al guardar descripción: " + e.message),
  });

  const acc = transiciones[s?.estado_code] || [];

  // helpers cantidad
  const step = selected?.uni_med?.toUpperCase() === "HORA" ? 0.5 : 1;
  const min = step;
  const qtyNum = Number(cantidad);
  const qtyValid = !Number.isNaN(qtyNum) && qtyNum >= min;

  // precios UI
  const unitPrice = selected?.precio_venta ?? 0;
  const unitCur = selected?.moneda_precio ?? "1";
  const unitPriceMXN = toMXN(unitPrice, unitCur);
  const totalPreviewMXN = selected && qtyValid ? qtyNum * unitPriceMXN : 0;

  // Modal clasificación para aprobar
  const [clasifOpen, setClasifOpen] = useState(false);
  const [clasifValue, setClasifValue] = useState("");
  const [savingClasif, setSavingClasif] = useState(false);

  const [folioSaiValue, setFolioSaiValue] = useState("");
  const [medioEntregaValue, setMedioEntregaValue] = useState("");

  if (isLoading) return <Loader />;

  const openDrawer = (p) => {
    setSelected({ ...p, link_img: p.link_img || PLACEHOLDER });
    setDrawerOpen(true);
  };

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
      status: "SIN_SEGUIMIENTO",
      motivo: "Definir motivo",
      comentarios: "Agregado desde catálogo",
    });
  };

  // Carga sugerencias por máquina
  const loadMachineParts = async () => {
    if (!machineKey) return;
    const claves = machineParts[machineKey] || [];
    if (!claves.length) {
      setProductos([]);
      return;
    }

    setPartsLoading(true);
    try {
      // Buscar por cada clave. Si tu backend soporta múltiple, reemplaza por un endpoint decente.
      const results = await Promise.all(
        claves.map(async (clave) => {
          try {
            const arr = await buscarProductos(clave, 0, 1); // 1 por clave, match exacto primero
            return Array.isArray(arr) ? arr : [];
          } catch {
            return [];
          }
        })
      );

      // Flatten + dedupe por id
      const flat = results.flat();
      const uniqById = Object.values(
        flat.reduce((acc, it) => {
          if (!it || !it.id) return acc;
          acc[it.id] = acc[it.id] || it;
          return acc;
        }, {})
      );

      // Ordena por clave de parte
      uniqById.sort((a, b) => String(a.clave_prod).localeCompare(String(b.clave_prod)));

      setProductos(uniqById);
    } finally {
      setPartsLoading(false);
    }
  };

  return (
    <div className="grid gap-3">
      {/* Encabezado */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-lg">
              Solicitud #{s.id} • {s.cliente_label}
            </div>
            <div className="text-sm text-neutral-400">
              Ticket {s.ticket_label} • {new Date(s.creado_en).toLocaleString()}
            </div>
          </div>
          <EstadoBadge code={s.estado_code} />
        </div>
      </div>

      {/* Acciones */}
      <div className="card">
        <div className="font-semibold mb-2">Acciones</div>
        <div className="flex gap-2 flex-wrap">
          {acc.map((a) => (
            <button
              key={a}
              className="btn btn-primary"
              onClick={async () => {
                // 👇 Caso especial: APROBADA desde EN_REVISION
                if (a === "APROBADA" && s?.estado_code === "EN_REVISION") {
                  setClasifOpen(true); // abre modal de clasificación
                  return;
                }

                // 👇 Caso especial: ENTREGADA → agrega comentario en Zoho
                if (a === "ENTREGADA") {
                  const ticketId = s?.ticket_id_externo; // ajusta al campo real en tu DB
                  if (ticketId) {
                    const html = buildEntregaHTML(s); // tu función para armar el HTML bonito
                    try {
                      await addZohoComment({ ticketId, message: html, isPublic: true });
                      console.log("✅ Comentario agregado en Zoho");
                    } catch (err) {
                      console.error("❌ Error al enviar comentario a Zoho:", err);
                    }
                  }
                }

                // 👇 Resto de transiciones normales
                mutCambiar.mutate({ a, nota });
              }}
            >
              {a.replaceAll("_", " ")}
            </button>
          ))}
          <input
            className="input w-72"
            placeholder="Nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>
      </div>

      {/* Items actuales */}
      <div className="card">
        <div className="font-semibold text-lg mb-4 text-neutral-800 border-b pb-2">
          Items de la solicitud
        </div>

        {s.items?.length ? (
          <div className="grid gap-5">
            {s.items.map((it) => {
              const esEditable = ["S09999", "S00010"].includes(it.numero_parte);

              return (
                <div
                  key={it.id}
                  className={`rounded-2xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 p-5 ${esEditable ? "ring-1 ring-rose-100" : ""
                    }`}
                >
                  {/* Encabezado */}
                  <div className="flex items-center justify-between mb-4">
                    {esEditable ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-800">
                          {it.numero_parte}
                        </span>
                        <input
                          type="text"
                          className="input text-sm w-80"
                          defaultValue={it.descripcion}
                          onBlur={(e) =>
                            mutDescripcionItem.mutate({
                              itemId: it.id,
                              descripcion: e.target.value,
                            })
                          }
                        />
                        {mutDescripcionItem.isLoading &&
                          mutDescripcionItem.variables?.itemId === it.id && (
                            <span className="text-xs text-blue-600">Guardando…</span>
                          )}
                      </div>
                    ) : (
                      <div className="font-semibold text-sm text-neutral-800">
                        {it.numero_parte} • {it.descripcion}
                      </div>
                    )}

                    <div className="text-xs text-neutral-500 uppercase tracking-wide">
                      ESTADO:{" "}
                      <span className="font-semibold text-neutral-700">
                        {it.estado_pieza_code || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Cantidad */}
                    <div className="flex flex-col gap-2 text-sm">
                      <label className="text-xs text-neutral-500">Cantidad</label>
                      <input
                        type="number"
                        className="input w-24"
                        step="0.5"
                        min="0"
                        defaultValue={it.cantidad}
                        onBlur={(e) =>
                          mutCantidadItem.mutate({
                            itemId: it.id,
                            cantidad: Number(e.target.value),
                          })
                        }
                      />
                      <div className="flex justify-between text-xs text-neutral-600 mt-1">
                        <span>Unidad: {it.unidad}</span>
                        <span className="font-semibold text-neutral-700">
                          Total: ${Number(it.costo_total || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Costo */}
                    <div className="flex flex-col gap-2 text-sm">
                      {esEditable ? (
                        <>
                          <label className="text-xs text-neutral-500">
                            Costo Unitario
                          </label>
                          <input
                            type="number"
                            className="input w-32"
                            step="0.5"
                            min="0"
                            defaultValue={it.costo_unitario}
                            onBlur={(e) =>
                              mutCostoItem.mutate({
                                itemId: it.id,
                                costo_unitario: Number(e.target.value),
                              })
                            }
                          />
                        </>
                      ) : (
                        <div className="text-xs text-neutral-500 mt-4">
                          Costo:{" "}
                          <span className="text-neutral-700 font-medium">
                            ${Number(it.costo_unitario || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Selects */}
                    <div className="flex flex-col gap-3 text-sm">
                      <div>
                        <label className="text-xs text-neutral-500 mb-1 block">
                          Status de la pieza
                        </label>
                        <select
                          className="input"
                          value={it.status || ""}
                          onChange={(e) =>
                            mutStatusItem.mutate({
                              itemId: it.id,
                              status: e.target.value,
                            })
                          }
                        >
                          <option value="">Elige una opción</option>
                          {ITEM_CLASIF_OPTS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-neutral-500 mb-1 block">
                          Motivo de garantía
                        </label>
                        <select
                          className="input"
                          value={it.motivo || ""}
                          onChange={(e) =>
                            mutMotivoItem.mutate({
                              itemId: it.id,
                              motivo: e.target.value,
                            })
                          }
                        >
                          <option value="">Elige una opción</option>
                          {MotivoGarantiaOptions.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 flex justify-end items-center text-xs text-neutral-500 border-t border-neutral-200 pt-2">
                    {mutCantidadItem.isLoading &&
                      mutCantidadItem.variables?.itemId === it.id && (
                        <span className="text-blue-600">Guardando cantidad…</span>
                      )}
                    {mutCostoItem.isLoading &&
                      mutCostoItem.variables?.itemId === it.id && (
                        <span className="text-blue-600 ml-4">Guardando costo…</span>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-neutral-400">Sin items.</div>
        )}
      </div>


      {/* Agregar item desde catálogo */}
      <div className="card">
        <div className="font-semibold mb-2">Agregar item desde catálogo</div>

        {/* Submenú: escoger máquina */}
        <div className="flex flex-col md:flex-row gap-2 md:items-center mb-3">
          <div className="flex items-center gap-2">
            {/* Submenú: escoger máquina (versión avatars) */}
            <div className="flex flex-col gap-2 mb-3">
              <MachinePicker
                value={machineKey}
                onChange={setMachineKey}
                onShowParts={loadMachineParts}
              />

              <div className="flex gap-2 items-center">
                {machineKey && (
                  <button
                    className="btn"
                    onClick={() => { setMachineKey(""); setProductos([]); }}
                    title="Quitar filtro"
                  >
                    Quitar filtro
                  </button>
                )}

                {/* Buscador por texto se mantiene */}
                <div className="flex gap-2 items-center ml-auto">
                  <input
                    className="input"
                    placeholder="Buscar por clave o descripción"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") setProductos(await buscarProductos(q, 0, 8));
                    }}
                  />
                  <button className="btn" onClick={async () => setProductos(await buscarProductos(q, 0, 8))}>
                    Buscar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="grid md:grid-cols-2 gap-2 mt-2">
          {productos.map((p) => (
            <div
              key={p.id}
              onClick={() => openDrawer(p)}
              className={`card cursor-pointer ${selected?.id === p.id && drawerOpen
                ? "ring-2 ring-blue-600"
                : ""
                }`}
              title="Ver detalles"
            >
              <div className="font-medium">
                {p.clave_prod} • {p.desc_prod}
              </div>
              <div className="text-sm text-neutral-400">
                {p.uni_med} • Precio:{" "}
                {MXN_FORMAT.format(
                  toMXN(p.precio_venta ?? 0, p.moneda_precio || "1")
                )}{" "}
                <span className="text-neutral-500">
                  (
                  {MONEDA_LABEL[p.moneda_precio || "1"] ?? "MXN"}{" "}
                  {Number(p.precio_venta ?? 0).toFixed(4)})
                </span>
              </div>
            </div>
          ))}
          {!productos.length && (
            <div className="text-sm text-neutral-500">Sin resultados.</div>
          )}
        </div>
      </div>

      {/* Bitácora */}
      <div className="card">
        <div className="font-semibold mb-2 text-neutral-800">Bitácora</div>
        {s.bitacora?.length ? (
          s.bitacora.map((b) => (
            <div
              key={b.id}
              className="text-sm text-neutral-700 py-2 border-b border-neutral-200 last:border-0"
            >
              <span className="font-medium text-neutral-800">
                {new Date(b.ts).toLocaleString()}
              </span>{" "}
              • {b.accion}{" "}
              {b.de ? (
                <span className="text-blue-700 font-medium">
                  ({b.de} → {b.a})
                </span>
              ) : null}{" "}
              {b.nota ? `• ${b.nota}` : ""}{" "}
              {b.actor && (
                <span className="text-neutral-500">• {b.actor}</span>
              )}
            </div>
          ))
        ) : (
          <div className="text-sm text-neutral-500">Sin movimientos.</div>
        )}
      </div>

      {/* Modal: Clasificación antes de aprobar */}
      {/* Modal: Clasificación antes de aprobar */}
      {clasifOpen && (
        <>
          {/* Backdrop con leve blur */}
          <div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[1px]"
            onClick={() => !savingClasif && setClasifOpen(false)}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 bg-neutral-50 border-b border-neutral-200 flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold text-neutral-900">Confirmación</div>
                  <div className="text-sm text-neutral-600">Tip: recuerda verificar la gestión.</div>
                </div>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                  onClick={() => !savingClasif && setClasifOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                {/* Clasificación */}
                <div>
                  <label className="text-sm font-medium text-neutral-800">Clasificación de garantía</label>
                  <select
                    className="input mt-1 bg-white focus:ring-2 focus:ring-blue-600"
                    value={clasifValue}
                    onChange={(e) => setClasifValue(e.target.value)}
                    disabled={savingClasif}
                  >
                    <option value="">Selecciona una opción…</option>
                    {CLASIF_OPTIONS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  {!clasifValue && (
                    <p className="mt-1 text-xs text-neutral-500">Selecciona una clasificación para continuar.</p>
                  )}
                </div>

                {/* Folio SAI */}
                <div>
                  <label className="text-sm font-medium text-neutral-800">
                    Folio SAI <span className="text-neutral-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    className="input mt-1 bg-white focus:ring-2 focus:ring-blue-600"
                    placeholder="Ej. SAI-2025-001234"
                    value={folioSaiValue}
                    onChange={(e) => setFolioSaiValue(e.target.value)}
                    maxLength={50}
                    disabled={savingClasif}
                  />
                </div>

                {/* Medio de entrega (opcional) */}
                <div>
                  <label className="text-sm font-medium text-neutral-800">
                    Elige el medio de entrega <span className="text-neutral-400 font-normal">(opcional)</span>
                  </label>
                  <select
                    className="input mt-1 bg-white focus:ring-2 focus:ring-blue-600"
                    value={medioEntregaValue}
                    onChange={(e) => setMedioEntregaValue(e.target.value)}
                    disabled={savingClasif}
                  >
                    <option value="">Elige una opción</option>
                    {MEDIO_ENTREGA_OPTIONS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-2">
                <button
                  className="btn"
                  onClick={() => !savingClasif && setClasifOpen(false)}
                  disabled={savingClasif}
                >
                  Cancelar
                </button>
                <button
                  className={`btn btn-primary ${(!clasifValue || savingClasif) ? "opacity-60 cursor-not-allowed" : ""}`}
                  disabled={!clasifValue || savingClasif}
                  onClick={async () => {
                    try {
                      setSavingClasif(true);
                      // PUT con ambas cosas
                      await setClasificacionGarantia(id, {
                        clasificacion_garantia: clasifValue,
                        folio_sai: folioSaiValue || undefined,
                        medio_entrega: medioEntregaValue || undefined, // <- nuevo
                      });
                      await mutCambiar.mutateAsync({ a: "APROBADA", nota });

                      // limpia estado
                      setClasifOpen(false);
                      setClasifValue("");
                      setFolioSaiValue("");
                      setMedioEntregaValue("");
                    } catch (err) {
                      alert(err?.message || "No se pudo aprobar");
                    } finally {
                      setSavingClasif(false);
                    }
                  }}
                >
                  {savingClasif ? "Guardando…" : "Aprobar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Drawer de pieza */}
      <PiezaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pieza={selected}
        cantidad={cantidad}
        setCantidad={setCantidad}
        step={step}
        min={min}
        qtyValid={qtyValid}
        qtyNum={qtyNum}
        unitPriceMXN={unitPriceMXN}
        unitCur={unitCur}
        totalPreviewMXN={totalPreviewMXN}
        onAdd={handleAdd}
      />
    </div>
  );
}

function PiezaDrawer({
  open,
  onClose,
  pieza,
  cantidad,
  setCantidad,
  step,
  min,
  qtyValid,
  qtyNum,
  unitPriceMXN,
  unitCur,
  totalPreviewMXN,
  onAdd,
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white text-neutral-900 shadow-2xl border-l border-neutral-200 transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"
          }`}
        aria-hidden={!open}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-white">
            <div>
              <div className="text-sm font-semibold text-neutral-800">
                {pieza?.clave_prod || "—"}
              </div>
              <div className="text-xs text-neutral-500">
                {pieza?.desc_prod || ""}
              </div>
            </div>
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-auto space-y-4">
            <div className="rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
              <img
                src={pieza?.link_img || PLACEHOLDER}
                alt={pieza?.desc_prod}
                className="w-full h-auto object-contain"
                onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Spec label="Clave" value={pieza?.clave_prod} />
              <Spec label="Unidad" value={pieza?.uni_med} />
              <Spec
                label="Precio lista (MXN)"
                value={
                  typeof unitPriceMXN === "number"
                    ? MXN_FORMAT.format(unitPriceMXN)
                    : "—"
                }
              />
              <Spec
                label="Precio original"
                value={
                  pieza?.precio_venta != null
                    ? `$${Number(pieza.precio_venta).toFixed(2)} ${unitCur}`
                    : "—"
                }
              />
              <Spec
                label="Costo entrante"
                value={
                  pieza?.costo_entrante != null
                    ? `$${Number(pieza.costo_entrante).toFixed(2)}`
                    : "—"
                }
              />
              <div className="col-span-2">
                <Spec label="Descripción" value={pieza?.desc_prod} />
              </div>
            </div>

            {/* Cantidad + total + agregar */}
            <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">
                Cantidad
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn px-2"
                  onClick={() =>
                    setCantidad((prev) => {
                      const n = Number(prev) || min;
                      return Math.max(min, +(n - step).toFixed(2));
                    })
                  }
                  disabled={!pieza}
                  title="Menos"
                >
                  −
                </button>

                <input
                  className="input w-24 text-center"
                  type="number"
                  step={step}
                  min={min}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />

                <button
                  className="btn px-2"
                  onClick={() =>
                    setCantidad((prev) => {
                      const n = Number(prev) || 0;
                      return +(n + step).toFixed(2);
                    })
                  }
                  disabled={!pieza}
                  title="Más"
                >
                  +
                </button>

                <div className="ml-auto text-sm">
                  Total:{" "}
                  <span className="font-semibold">
                    {qtyValid ? MXN_FORMAT.format(totalPreviewMXN) : "—"}
                  </span>
                </div>

                <button
                  className="btn btn-primary"
                  disabled={!pieza || !qtyValid}
                  onClick={onAdd}
                  title={
                    !pieza
                      ? "Selecciona un producto"
                      : !qtyValid
                        ? "Cantidad inválida"
                        : "Agregar"
                  }
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Spec({ label, value }) {
  return (
    <div className="p-3 rounded-lg border border-neutral-200 bg-white text-neutral-800">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="text-sm font-medium break-words">
        {value || "—"}
      </div>
    </div>
  );
}

function MachinePicker({ value, onChange, onShowParts }) {
  const keys = Object.keys(MACHINE_META);

  return (
    <div className="w-full">
      <div className="flex items-stretch gap-6 overflow-x-auto py-2 px-1 no-scrollbar">
        {keys.map((key) => {
          const { label, img } = MACHINE_META[key];
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={active}
              className={`flex flex-col items-center shrink-0 outline-none group cursor-pointer
                          transition-transform duration-150 hover:-translate-y-0.5`}
              title={label}
            >
              <div
                className={`w-16 h-16 rounded-full border-2 transition-all duration-200 flex items-center justify-center
                ${active
                    ? "border-blue-500 ring-4 ring-blue-500/40 bg-blue-50 scale-105"
                    : "border-neutral-300 bg-neutral-100 group-hover:border-neutral-400"
                  }`}
              >
                <img
                  src={img}
                  alt={label}
                  className={`w-full h-full object-cover rounded-full transition-opacity duration-200
                  ${active
                      ? "opacity-100"
                      : "opacity-80 group-hover:opacity-100"
                    }`}
                />
              </div>
              <span
                className={`mt-2 text-[12px] w-20 text-center leading-tight transition-colors duration-200
                ${active
                    ? "text-blue-600 font-semibold"
                    : "text-neutral-600 group-hover:text-neutral-800"
                  }`}
              >
                {label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onShowParts}
          className="ml-2 self-center px-3 py-2 rounded-full border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          title="Ver piezas sugeridas"
        >
          Ver piezas
        </button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}


