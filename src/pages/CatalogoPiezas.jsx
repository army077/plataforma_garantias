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

export default function CatalogoPiezas() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const pageSize = 24;
  const [page, setPage] = useState(1);

  const start = (page - 1) * pageSize;
  const end = start + pageSize; // <- FIX: _end es start + pageSize

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["catalogo", term, page],
    queryFn: () => buscarProductos(term, start, end),
    keepPreviousData: true,
  });

  const productos = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // reset a la primera página cuando cambie el término “comprometido”
  useEffect(() => setPage(1), [term]);

  // Drawer state
  const [open, setOpen] = useState(false);
  const [pieza, setPieza] = useState(null);

  // ESC para cerrar
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openDrawer = (p) => {
    setPieza({ ...p, link_img: p.link_img || PLACEHOLDER });
    setOpen(true);
  };

  return (
    <div className="grid gap-4">
      {/* Buscador */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <input
            className="input flex-1"
            placeholder="Buscar por clave (P0...), descripción o categoría"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setTerm(q.trim());
            }}
          />
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={() => setTerm(q.trim())}
              disabled={isFetching}
            >
              {isFetching ? "Buscando…" : "Buscar"}
            </button>
            {term && (
              <button
                className="btn"
                onClick={() => {
                  setQ("");
                  setTerm("");
                  setPage(1);
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
        {term && (
          <div className="mt-2 text-xs text-neutral-500">
            Mostrando resultados para: <span className="font-medium">{term}</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {isLoading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-square rounded-lg bg-neutral-100" />
              <div className="h-4 w-2/3 bg-neutral-100 rounded mt-3" />
              <div className="h-3 w-1/2 bg-neutral-100 rounded mt-2" />
            </div>
          ))}

        {!isLoading && productos.length === 0 && (
          <div className="col-span-full card text-sm text-neutral-500">
            No hay resultados. Intenta con otra clave o palabra.
          </div>
        )}

        {productos.map((p) => (
          <article
            key={p.id}
            className="card group hover:shadow-md transition-shadow cursor-pointer select-none"
            onClick={() => openDrawer(p)}
            title="Ver especificaciones"
          >
            <div className="aspect-square overflow-hidden rounded-lg bg-white cursor-pointer">
              <img
                src={p.link_img || PLACEHOLDER}
                alt={p.desc_prod}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER;
                }}
              />
            </div>
            <div className="mt-3">
              <div className="text-sm font-semibold tracking-tight">{p.clave_prod}</div>
              <div className="text-sm text-neutral-600 line-clamp-2">{p.desc_prod}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="badge">{p.uni_med || "UND"}</span>
                <span className="text-sm text-neutral-700">
                  {typeof p.precio_venta === "number"
                    ? `$${p.precio_venta.toFixed(2)}`
                    : p.precio_venta
                    ? `$${p.precio_venta}`
                    : "—"}
                  {p.moneda_precio && p.moneda_precio !== "1" ? ` ${p.moneda_precio}` : ""}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Paginación */}
      {productos.length > 0 && (
        <div className="flex justify-center gap-2">
          <button
            className="btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
          >
            ← Anterior
          </button>
          <span className="text-sm self-center">Página {page}</span>
          <button
            className="btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching || productos.length < pageSize}
            title={productos.length < pageSize ? "No hay más resultados" : ""}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Drawer en negro */}
      <Drawer open={open} onClose={() => setOpen(false)} pieza={pieza} />
    </div>
  );
}

function Drawer({ open, onClose, pieza }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 w-full sm:w-[480px] 
        bg-neutral-900 text-neutral-100 shadow-2xl border-l border-neutral-800
        transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{pieza?.clave_prod || "—"}</div>
              <div className="text-xs text-neutral-400">{pieza?.desc_prod || ""}</div>
            </div>
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-auto space-y-4">
            <div className="rounded-xl overflow-hidden border border-neutral-800">
              <img
                src={pieza?.link_img || PLACEHOLDER}
                alt={pieza?.desc_prod}
                className="w-full h-auto object-contain bg-neutral-950"
                onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Spec label="Clave" value={pieza?.clave_prod} />
              <Spec label="Unidad" value={pieza?.uni_med} />
              <Spec
                label="Precio lista"
                value={
                  pieza?.precio_venta != null
                    ? `$${Number(pieza.precio_venta).toFixed(2)}${pieza?.moneda_precio && pieza.moneda_precio !== "1" ? " " + pieza.moneda_precio : ""}`
                    : "—"
                }
              />
              <Spec
                label="Costo entrante"
                value={
                  pieza?.costo_entrante != null
                    ? `$${Number(pieza.costo_entrante).toFixed(2)}${pieza?.moneda_costo && pieza.moneda_costo !== "1" ? " " + pieza.moneda_costo : ""}`
                    : "—"
                }
              />
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
    <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-medium">{value || "—"}</div>
    </div>
  );
}