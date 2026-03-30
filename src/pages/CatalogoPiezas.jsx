// src/pages/CatalogoPiezas.jsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buscarProductos } from "../lib/api.js";

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

  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["catalogo", term, page, pageSize],
    queryFn: () => buscarProductos(term, start, end),
    keepPreviousData: true,
  });

  const productos = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  useEffect(() => setPage(1), [term, view]);

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

  const doSearch = () => setTerm(q.trim());
  const doClear = () => {
    setQ("");
    setTerm("");
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

      {/* ─── Buscador principal ─── */}
      <div className="card">
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
      </div>

      {/* ─── Error ─── */}
      {isError && (
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
              {isLoading &&
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

              {!isLoading && productos.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    {term
                      ? "No se encontraron piezas. Intenta con otra clave o palabra."
                      : "Escribe un término de búsqueda para consultar el catálogo."}
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
          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="aspect-square rounded-lg bg-slate-200" />
                <div className="h-4 w-2/3 bg-slate-200 rounded mt-3" />
                <div className="h-3 w-1/2 bg-slate-200 rounded mt-2" />
              </div>
            ))}

          {!isLoading && productos.length === 0 && (
            <div className="col-span-full card text-sm text-slate-400 text-center py-12">
              {term
                ? "No se encontraron piezas. Intenta con otra clave o palabra."
                : "Escribe un término de búsqueda para consultar el catálogo."}
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
            disabled={page === 1 || isFetching}
          >
            ← Anterior
          </button>
          <span className="text-sm font-medium text-slate-600">
            Página {page}
          </span>
          <button
            className="btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching || productos.length < pageSize}
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
