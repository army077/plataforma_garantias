// src/pages/CatalogoPiezas.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { buscarProductos } from "../lib/api.js";

/* ── Piezas hardcodeadas por máquina (mismo mapa que SolicitudShow) ── */
const machineParts = {
  MAKER0609: [
    "P00178","P00183","P00184","P00185","P00240","P00241","P00243","P00244","M00576","P00295","P02766",
    "P02767","P02768","P00835","P00283"
  ],
  BENDWORX: [
    "P03842","P03843","P03844","P03845","P03846","P03847","P03848","P03849","P03850","P00236","P03851",
    "P03841","P03839","P03840","P03939","P03831","P03832","P03833","P03834","P03835","P03836","P03876",
    "P03875","P03873","P03874"
  ],
  WELDWORX: [
    "P03940","P03941","P03942","P03943","P03944","P03945","P03946","P03947","P03948","P03949","P03963",
    "P03964","P03965","P03966","P03968","P01205","P03794","P03967","P03970","P03973","P03974","P03976",
    "P03971","P03674","P03972","P03887","P00092","P00924","P02506","P01202","P02503","P03619","P03593",
    "P03994","P03995","P04004","P04005","P03563"
  ],
  PLASMA: [
    "P01083","P02384","P00935","P00936","P00939","P00942","P00945","P00917","P00949","P00952","P00953",
    "P03543","P03544","P03545","P03546","P03547","P00934","P00938","P02021","P02022","P02023","P02024",
    "P02026","P02027","P02921","P00329","P02832","P00853","M00749"
  ],
  SHOPPRO: [
    "P00152","P00076","P01091","P00835","P00092","P03572","P00001","P04072","P04158","P00228","P00229",
    "P00230","P02987","P00231","P00234","M00247","P01205","P02107","P00177","P00180","P00182","P00183",
    "P00184","P00185","P00245","P00246","P00247","P00250","P00251","M00253","P00148","P01943","P04191",
    "P03609","P04012","P04094","P04013","P01207","P04077","P02203","P03452","P00079","P01990","P00263",
    "P02748","P00078","P00079","P03289","P03315"
  ],
  WORKS: [
    "P04012","P00411","P00413","P02221","P00113","P02203","P00101","P02925","P00092","P01990","P00264",
    "P00001","P00300","P00003","P00055","P00148","P00238","P00263","M00247","P03572","P01207","P00695",
    "P00180","P00182","P00183","P00184","P00185","P00255","P00257","P00258","P00259","P00256","P02157",
    "P01092","P00373","P03046","P02925","P00428","P00333","P00854","P00439","P03466","P00364","P02169",
    "P01053","P03883","P03352","P03816","P03817","P02158","P03730","P01100"
  ],
  MULTIHEAD: [
    "M00471","M00472","M00563","P00177","P00180","P00182","P00183","P00184","P00185","P00245","P00246",
    "P00247","P00250","P00251","P02251","P00301","P00302","P01167","P01646","M00042","M00465","P02764",
    "P03454","P02169","P00127","P00128","M00109","P00329","P00328","M00182"
  ],
  CREATOR: [
    "P03677","P00753","P00197","P03269","P00163","P03724","P03743","P03576","M00776","P03300","P04188",
    "P00581","P03156","P02326","P00584","P03652","P03678","P03604","P03660","P03680","P03157","P03158",
    "P03162","P03454","P03457","P04283","P04229","P03784","P04142","P03527","P04284","P04285"
  ],
  SAAP: [
    "P03304","P03245","P03250","P03257","P03256","P03236","P03242","P03255","P03253","P03336","P03249",
    "P03238","P03246","P03260","P03251","P03341","P03261","P01616","P03241","P03241","P03244","P03240",
    "P03344","M00666","P03345","P03235","M00672","P03346","M00686","P03506"
  ]
};

const MACHINE_META = {
  MAKER0609: { label: "Maker",        img: "/img/maker0609.png" },
  BENDWORX:  { label: "Bend Worx",    img: "/img/bendworx.png" },
  WELDWORX:  { label: "Weld Worx",    img: "/img/weldworx.png" },
  PLASMA:    { label: "Plasma Blade",  img: "/img/plasma.png" },
  SHOPPRO:   { label: "Shop Pro",      img: "/img/shoppro.png" },
  WORKS:     { label: "Works",         img: "/img/works.png" },
  MULTIHEAD: { label: "Multihead",     img: "/img/multihead.png" },
  CREATOR:   { label: "Creator",       img: "/img/creator0704.png" },
  SAAP:      { label: "SAAP",          img: "/img/saap.png" },
};

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
      <rect width='100%' height='100%' fill='#f3f4f6'/>
      <g fill='#9ca3af' font-family='Arial,sans-serif' font-size='22'>
        <text x='50%' y='50%' text-anchor='middle'>Sin imagen</text>
      </g>
    </svg>`
  );

/* Iconos SVG inline */
const IconGrid = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
  </svg>
);
const IconTable = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M3 6h18M3 18h18"/>
  </svg>
);
const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
  </svg>
);

/* ── URL del macro de Google Sheets (misma que usa SolicitudShow) ── */
const IMG_MACRO_URL =
  "https://script.google.com/macros/s/AKfycbx2Lj3lBA7Bpu4Uuu_AJh9kCZzK_FZvSpUF4M6Opaxz5OUmYj-1P_poVSX3QB6qkfY/exec";

/** Obtiene imagen base64 desde el macro de Google Sheets por clave de producto */
async function fetchImagen(clave) {
  try {
    const resp = await fetch(`${IMG_MACRO_URL}?clave=${encodeURIComponent(clave)}`);
    const data = await resp.json();
    return data.base64 ? `data:${data.mime};base64,${data.base64}` : null;
  } catch {
    return null;
  }
}

function formatPrice(value, moneda) {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n)) return "—";
  const formatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
  const suffix = moneda && moneda !== "1" ? ` ${moneda}` : "";
  return `${formatted}${suffix}`;
}

export default function CatalogoPiezas() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [view, setView] = useState("table"); // "table" | "grid"
  const pageSize = view === "grid" ? 24 : 30;
  const [page, setPage] = useState(1);

  // Filtro por máquina
  const [machineKey, setMachineKey] = useState("");
  const [machineProducts, setMachineProducts] = useState([]);
  const [machineLoading, setMachineLoading] = useState(false);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  // Solo buscar por texto cuando NO hay máquina seleccionada
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["catalogo", term, page, pageSize],
    queryFn: () => buscarProductos(term, start, end),
    keepPreviousData: true,
    enabled: !machineKey, // desactivar si hay máquina seleccionada
  });

  // Cuando hay máquina, paginamos localmente sobre machineProducts
  const productos = useMemo(() => {
    if (machineKey) {
      return machineProducts.slice(start, end);
    }
    return Array.isArray(data) ? data : [];
  }, [data, machineKey, machineProducts, start, end]);

  const totalMachineProducts = machineProducts.length;

  useEffect(() => setPage(1), [term, view, machineKey]);

  // Carga piezas por máquina
  const loadMachineParts = useCallback(async (key) => {
    const claves = machineParts[key] || [];
    if (!claves.length) {
      setMachineProducts([]);
      return;
    }
    setMachineLoading(true);
    try {
      const results = await Promise.all(
        claves.map(async (clave) => {
          try {
            const arr = await buscarProductos(clave, 0, 1);
            return Array.isArray(arr) ? arr : [];
          } catch {
            return [];
          }
        })
      );
      const flat = results.flat();
      const uniqById = Object.values(
        flat.reduce((acc, it) => {
          if (!it || !it.id) return acc;
          acc[it.id] = acc[it.id] || it;
          return acc;
        }, {})
      );
      uniqById.sort((a, b) => String(a.clave_prod).localeCompare(String(b.clave_prod)));
      setMachineProducts(uniqById);
    } finally {
      setMachineLoading(false);
    }
  }, []);

  const handleMachineSelect = useCallback((key) => {
    if (key === machineKey) return; // ya seleccionada
    setMachineKey(key);
    setTerm("");
    setQ("");
    setPage(1);
    loadMachineParts(key);
  }, [machineKey, loadMachineParts]);

  const handleClearMachine = () => {
    setMachineKey("");
    setMachineProducts([]);
    setPage(1);
  };

  // Drawer state
  const [open, setOpen] = useState(false);
  const [pieza, setPieza] = useState(null);

  // Cache de imágenes ya descargadas (clave → dataURI | PLACEHOLDER)
  const [imgCache, setImgCache] = useState({});

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // En vista grid: cargar imágenes de la página actual en lote
  useEffect(() => {
    if (view !== "grid" || productos.length === 0) return;
    let cancelled = false;
    const toFetch = productos.filter((p) => !(p.clave_prod in imgCache));
    toFetch.forEach(async (p) => {
      const img = await fetchImagen(p.clave_prod);
      if (!cancelled) {
        setImgCache((c) => ({ ...c, [p.clave_prod]: img || PLACEHOLDER }));
      }
    });
    return () => { cancelled = true; };
  }, [productos, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = async (p) => {
    // Mostrar drawer inmediatamente con skeleton para imagen
    setPieza({ ...p, link_img: null });
    setOpen(true);

    // Si ya tenemos la imagen en cache, usarla
    if (imgCache[p.clave_prod]) {
      setPieza({ ...p, link_img: imgCache[p.clave_prod] });
      return;
    }

    // Obtener imagen del macro de Google Sheets (mismo flujo que garantías)
    const img = await fetchImagen(p.clave_prod);
    const resolved = img || PLACEHOLDER;
    setImgCache((c) => ({ ...c, [p.clave_prod]: resolved }));
    setPieza({ ...p, link_img: resolved });
  };

  const doSearch = () => {
    setMachineKey("");
    setMachineProducts([]);
    setTerm(q.trim());
  };
  const doClear = () => {
    setQ("");
    setTerm("");
    setMachineKey("");
    setMachineProducts([]);
    setPage(1);
  };

  return (
    <div className="grid gap-4">
      {/* ─── Encabezado ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Catálogo de piezas
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Consulta de refacciones por número de parte o descripción
          </p>
        </div>
        {/* Toggle vista */}
        <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5 self-start bg-white">
          <button
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              view === "table"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setView("table")}
          >
            <IconTable /> Tabla
          </button>
          <button
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              view === "grid"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setView("grid")}
          >
            <IconGrid /> Tarjetas
          </button>
        </div>
      </div>

      {/* ─── Selector de máquina + Buscador ─── */}
      <div className="card">
        <div className="font-semibold mb-2 text-slate-700">Filtrar por máquina</div>
        <MachinePicker
          value={machineKey}
          onChange={handleMachineSelect}
        />

        {machineKey && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-slate-500">
              Mostrando piezas de <span className="font-semibold text-slate-700">{MACHINE_META[machineKey]?.label}</span>
              {!machineLoading && <span className="ml-1">({totalMachineProducts} piezas)</span>}
            </span>
            <button className="btn text-xs" onClick={handleClearMachine}>
              Quitar filtro
            </button>
          </div>
        )}

        {!machineKey && (
          <>
            <div className="border-t border-slate-200 my-3" />
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <input
                  className="input flex-1"
                  placeholder="Buscar por clave (P0…), descripción o categoría…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") doSearch();
                  }}
                />
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={doSearch}
                  disabled={isFetching}
                >
                  {isFetching ? "Buscando…" : "Buscar"}
                </button>
                {term && (
                  <button className="btn" onClick={doClear}>
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            {term && (
              <div className="mt-2 text-xs text-slate-500">
                Resultados para:{" "}
                <span className="font-semibold text-slate-700">{term}</span>
            {productos.length > 0 && (
              <span className="ml-2">
                — mostrando <strong>{productos.length}</strong> en página{" "}
                {page}
              </span>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* ─── Error ─── */}
      {isError && !machineKey && (
        <div className="card border-red-200 bg-red-50 text-red-700 text-sm">
          Error al consultar el catálogo. Verifica tu conexión e intenta de
          nuevo.
        </div>
      )}

      {/* ─── Vista: TABLA ─── */}
      {view === "table" && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Clave</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-center">Unidad</th>
                <th className="px-4 py-3 text-right">Precio lista</th>
                <th className="px-4 py-3 text-right">Costo entrante</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(isLoading || machineLoading) &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 bg-slate-200 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-48 bg-slate-200 rounded" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="h-4 w-10 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                ))}

              {!isLoading && !machineLoading && productos.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    {machineKey
                      ? "No se encontraron piezas para esta máquina."
                      : term
                        ? "No se encontraron piezas. Intenta con otra clave o palabra."
                        : "Selecciona una máquina o escribe un término de búsqueda."}
                  </td>
                </tr>
              )}

              {productos.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  onClick={() => openDrawer(p)}
                  title="Ver detalle"
                >
                  <td className="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">
                    {p.clave_prod}
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-md">
                    <span className="line-clamp-2">{p.desc_prod || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="badge">{p.uni_med || "UND"}</span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-slate-700">
                    {formatPrice(p.precio_venta, p.moneda_precio)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-slate-500">
                    {formatPrice(p.costo_entrante, p.moneda_costo)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">▸</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Vista: GRID (tarjetas) ─── */}
      {view === "grid" && (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {(isLoading || machineLoading) &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="aspect-square rounded-lg bg-slate-200" />
                <div className="h-4 w-2/3 bg-slate-200 rounded mt-3" />
                <div className="h-3 w-1/2 bg-slate-200 rounded mt-2" />
              </div>
            ))}

          {!isLoading && !machineLoading && productos.length === 0 && (
            <div className="col-span-full card text-sm text-slate-400 text-center py-12">
              {machineKey
                ? "No se encontraron piezas para esta máquina."
                : term
                  ? "No se encontraron piezas. Intenta con otra clave o palabra."
                  : "Selecciona una máquina o escribe un término de búsqueda."}
            </div>
          )}

          {productos.map((p) => (
            <article
              key={p.id}
              className="card group hover:shadow-md transition-shadow cursor-pointer select-none"
              onClick={() => openDrawer(p)}
              title="Ver especificaciones"
            >
              <div className="aspect-square overflow-hidden rounded-lg bg-white">
                {imgCache[p.clave_prod] ? (
                  <img
                    src={imgCache[p.clave_prod]}
                    alt={p.desc_prod}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                  />
                ) : (
                  <div className="h-full w-full bg-slate-100 animate-pulse" />
                )}
              </div>
              <div className="mt-3">
                <div className="text-sm font-semibold tracking-tight text-blue-600">
                  {p.clave_prod}
                </div>
                <div className="text-sm text-slate-600 line-clamp-2">
                  {p.desc_prod}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="badge">{p.uni_med || "UND"}</span>
                  <span className="text-sm text-slate-700 font-medium">
                    {formatPrice(p.precio_venta, p.moneda_precio)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ─── Paginación ─── */}
      {productos.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          <button
            className="btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching || machineLoading}
          >
            ← Anterior
          </button>
          <span className="text-sm font-medium text-slate-600">
            Página {page}
            {machineKey && totalMachineProducts > 0 && (
              <span className="text-slate-400 ml-1">
                ({start + 1}–{Math.min(end, totalMachineProducts)} de {totalMachineProducts})
              </span>
            )}
          </span>
          <button
            className="btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching || machineLoading || (machineKey ? end >= totalMachineProducts : productos.length < pageSize)}
            title={
              productos.length < pageSize ? "No hay más resultados" : ""
            }
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* ─── Drawer detalle ─── */}
      <Drawer open={open} onClose={() => setOpen(false)} pieza={pieza} />
    </div>
  );
}

/* ────────────────────────────────────────────────
   Drawer lateral de detalle (solo lectura)
   ──────────────────────────────────────────────── */
function Drawer({ open, onClose, pieza }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-200 z-40 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 w-full sm:w-[480px] z-50
        bg-white shadow-2xl border-l border-slate-200
        transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="min-w-0 pr-4">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {pieza?.clave_prod || "—"}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {pieza?.desc_prod || ""}
              </div>
            </div>
            <button className="btn shrink-0" onClick={onClose}>
              Cerrar
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-auto flex-1 space-y-4">
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              {pieza?.link_img === null ? (
                <div className="w-full aspect-square animate-pulse bg-slate-100" />
              ) : (
                <img
                  src={pieza?.link_img || PLACEHOLDER}
                  alt={pieza?.desc_prod}
                  className="w-full h-auto object-contain bg-white"
                  onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Spec label="Clave" value={pieza?.clave_prod} />
              <Spec label="Unidad" value={pieza?.uni_med} />
              <div className="col-span-2">
                <Spec label="Descripción" value={pieza?.desc_prod} />
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
    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
        {label}
      </div>
      <div className="text-sm font-medium text-slate-800">{value || "—"}</div>
    </div>
  );
}

/* ── MachinePicker: selector visual de máquinas ── */
function MachinePicker({ value, onChange }) {
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
                    : "border-slate-300 bg-slate-100 group-hover:border-slate-400"
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
                    : "text-slate-600 group-hover:text-slate-800"
                  }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
