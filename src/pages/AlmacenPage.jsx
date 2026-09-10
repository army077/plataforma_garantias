import { useEffect, useMemo, useState } from "react";
import {
    listAlmacenMovimientos,
    createAlmacenMovimiento,
    createAlmacenMovimientoPin,
    buscarProductoAlmacen,
    atenderAlmacenMovimiento,
    atenderAlmacenMovimientoPin,
    actualizarEstatusMovimiento,
    cambiarStatusConPin,
    updateAlmacenMovimiento,
    deleteAlmacenMovimiento,
    cerrarMovimientosPorOrden,
    listOrdenesCerradas,
    toggleOrdenProduccion,
    validarPinUsuario
} from "../lib/api.js";
import EstadoBadge from "../components/EstadoBadge";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";

export default function AlmacenPage() {
    const { user, role, usuarioId } = useAuth();
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [search, setSearch] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [detalle, setDetalle] = useState(null);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState(null);

    const [ordenesUnicas, setOrdenesUnicas] = useState([]);
    const [filtroOrden, setFiltroOrden] = useState("");

    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [pinValue, setPinValue] = useState("");
    const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null);

    const [pinModalStatusOpen, setPinModalStatusOpen] = useState(false);
    const [nuevoStatus, setNuevoStatus] = useState("");
    const [pinStatusValue, setPinStatusValue] = useState("");

    //cerrar solicitud
    const [cerrarModalOpen, setCerrarModalOpen] = useState(false);
    const [pinCerrar, setPinCerrar] = useState("");
    const [ordenCerrar, setOrdenCerrar] = useState("");

    // OPs cerradas (no admiten nuevas solicitudes)
    const [ordenesCerradas, setOrdenesCerradas] = useState(new Set());

    // Modal: alternar candado (cerrar/abrir OP) desde la fila
    const [toggleModalOpen, setToggleModalOpen] = useState(false);
    const [toggleOrden, setToggleOrden] = useState("");
    const [togglePin, setTogglePin] = useState("");
    const [toggleProximoEstado, setToggleProximoEstado] = useState(""); // "CERRADA" | "ABIERTA"

    // ID de la fila cuyo select de Movimiento está guardando
    const [loadingStatusId, setLoadingStatusId] = useState(null);


    const [form, setForm] = useState({
        persona: "",
        estacion: "",
        orden_produccion: "",
        numero_parte: "",
        descripcion: "",
        cantidad: 1,
        concepto_liberacion: ""
    });

    const [productos, setProductos] = useState([]);

    // --- Datos generales ---
    const [formHeader, setFormHeader] = useState({
        pin: "",
        estacion: "",
        orden_produccion: "",
        concepto_liberacion: ""
    });

    // --- Pieza actual ---
    const [currentPart, setCurrentPart] = useState({
        numero_parte: "",
        descripcion: "",
        cantidad: 1
    });

    // --- Lista acumulada de piezas ---
    const [listaPiezas, setListaPiezas] = useState([]);

    const load = async () => {
        const [data, cerradas] = await Promise.all([
            listAlmacenMovimientos(),
            listOrdenesCerradas().catch(() => [])
        ]);
        setRows(data);

        // Obtener órdenes únicas
        const setOrdenes = Array.from(
            new Set(data.map(r => r.orden_produccion).filter(Boolean))
        );
        setOrdenesUnicas(setOrdenes);

        // Indexar OPs cerradas
        setOrdenesCerradas(
            new Set((cerradas || []).map(c => String(c.orden_produccion)))
        );
    };

    // Helpers OP cerrada
    const esOrdenCerrada = (op) => ordenesCerradas.has(String(op || "").trim());
    const ordenesAbiertas = useMemo(
        () => ordenesUnicas.filter(op => !ordenesCerradas.has(String(op || "").trim())),
        [ordenesUnicas, ordenesCerradas]
    );

    const handleBuscarProd = async (q) => {
        if (!q.trim()) return setProductos([]);
        const res = await buscarProductoAlmacen(q);
        setProductos(res);
    };

    const handleCrear = async () => {
        if (!form.persona || !form.estacion || !form.orden_produccion) {
            alert("Los campos de persona, estacion y orden de producción son obligatorios.");
            return;
        }

        await createAlmacenMovimiento(form);
        setForm({
            persona: "",
            estacion: "",
            orden_produccion: "",
            numero_parte: "",
            descripcion: "",
            cantidad: 1,
            concepto_liberacion: ""
        });
        setProductos([]);
        setDrawerOpen(false);
        load();
    };

    useEffect(() => {
        load(); // carga inicial

        const interval = setInterval(() => {
            load(); // refresco cada 10s
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const agregarPiezaALista = () => {
        if (!currentPart.numero_parte || currentPart.cantidad <= 0) {
            alert("Debes agregar número de parte y cantidad válida.");
            return;
        }

        setListaPiezas([...listaPiezas, currentPart]);

        setCurrentPart({
            numero_parte: "",
            descripcion: "",
            cantidad: 1
        });

        setSearch("");
        setProductos([]);
    };

    const removerPiezaLista = (i) => {
        const nueva = [...listaPiezas];
        nueva.splice(i, 1);
        setListaPiezas(nueva);
    };

    const handleCrearTodo = async () => {
        if (!formHeader.pin || !formHeader.estacion || !formHeader.orden_produccion) {
            alert("Completa Persona, Estación y Orden.");
            return;
        }

        // 🚫 Bloqueo en cliente si la OP está cerrada
        const ordenIngresada = String(formHeader.orden_produccion).trim();
        if (esOrdenCerrada(ordenIngresada)) {
            alert(`La Orden ${ordenIngresada} está cerrada. No se pueden registrar más movimientos.`);
            return;
        }

        if (listaPiezas.length === 0) {
            alert("Agrega al menos una pieza.");
            return;
        }

        try {
            for (const pieza of listaPiezas) {
                await createAlmacenMovimientoPin({
                    ...formHeader,
                    ...pieza
                });
            }

            setFormHeader({
                pin: "",
                estacion: "",
                orden_produccion: "",
                concepto_liberacion: ""
            });
            setListaPiezas([]);
            setDrawerOpen(false);

            load();
            alert("Solicitudes creadas correctamente.");
        } catch (e) {
            console.error(e);
            // Surfaceamos el mensaje del backend (ej. OP_CERRADA)
            const msg = e?.response?.data?.error || "Error al guardar.";
            alert(msg);
        }
    };

    // ---- Candado: alternar cerrar/abrir OP desde la fila ----
    const abrirToggleModal = (orden) => {
        const op = String(orden || "").trim();
        if (!op) return;
        setToggleOrden(op);
        setToggleProximoEstado(esOrdenCerrada(op) ? "ABIERTA" : "CERRADA");
        setTogglePin("");
        setToggleModalOpen(true);
    };

    const confirmarToggleOP = async () => {
        if (!togglePin || !toggleOrden) {
            alert("Debes ingresar PIN.");
            return;
        }
        try {
            await toggleOrdenProduccion(toggleOrden, togglePin);
            setToggleModalOpen(false);
            setTogglePin("");
            setToggleOrden("");
            await load();
        } catch (err) {
            const msg = err?.response?.data?.error || "No se pudo cambiar el estado de la OP.";
            alert(msg);
        }
    };

    const cerrarSolicitudDummy = async () => {
        if (!pinCerrar || !ordenCerrar) {
            alert("Debes ingresar PIN y seleccionar una orden.");
            return;
        }

        try {
            // 1) validar PIN contra backend
            const res = await validarPinUsuario(pinCerrar);

            if (!res?.valido) {
                alert("PIN inválido");
                return;
            }

            // 2) cerrar movimientos por orden (manda PIN al backend también)
            await cerrarMovimientosPorOrden(ordenCerrar, pinCerrar);

            // 3) refrescar data
            await load();

            // 4) resetear todo a estado inicial
            resetToDefaultState();

            alert("Orden cerrada correctamente.");

        } catch (err) {
            console.error(err);
            alert("Error al validar PIN o cerrar la orden.");
        }
    };

    const resetToDefaultState = () => {
        // filtros
        setFiltroOrden("");

        // paginación
        setPage(1);

        // modales
        setCerrarModalOpen(false);
        setModalOpen(false);
        setPinModalOpen(false);
        setPinModalStatusOpen(false);
        setEditModalOpen(false);

        // valores de PIN / orden
        setPinCerrar("");
        setOrdenCerrar("");
        setPinValue("");
        setPinStatusValue("");
        setNuevoStatus("");
        setMovimientoSeleccionado(null);
        setDetalle(null);

        // drawer / formularios
        setDrawerOpen(false);
        setSearch("");
        setProductos([]);
        setListaPiezas([]);

        setForm({
            persona: "",
            estacion: "",
            orden_produccion: "",
            numero_parte: "",
            descripcion: "",
            cantidad: 1,
            concepto_liberacion: ""
        });

        setFormHeader({
            pin: "",
            estacion: "",
            orden_produccion: "",
            concepto_liberacion: ""
        });

        setCurrentPart({
            numero_parte: "",
            descripcion: "",
            cantidad: 1
        });
    };

    const filtrados = rows.filter((r) =>
        filtroOrden === "" ? true : r.orden_produccion === filtroOrden
    );

    const totalPages = Math.ceil(filtrados.length / pageSize);
    const paginated = filtrados.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="space-y-5">

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Solicitudes de Almacén</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Gestión de movimientos y entregas</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">

                    {role === "admin" && (
                        <button
                            className="btn"
                            onClick={() => navigate("/almacen/usuarios")}
                        >
                            Usuarios
                        </button>
                    )}

                    <select
                        className="input w-auto"
                        value={filtroOrden}
                        onChange={(e) => setFiltroOrden(e.target.value)}
                    >
                        <option value="">Todas las órdenes</option>
                        {ordenesUnicas.map((op) => (
                            <option key={op} value={op}>
                                {op}
                            </option>
                        ))}
                    </select>

                    <button
                        className="btn btn-primary"
                        onClick={() => setDrawerOpen(true)}
                    >
                        Nueva solicitud
                    </button>

                    {(role === "admin" || role === "supervisor") && (
                        <button
                            className="btn btn-danger"
                            onClick={() => setCerrarModalOpen(true)}
                        >
                            Cerrar solicitud
                        </button>
                    )}

                </div>
            </div>

            <div className="card p-0 overflow-x-auto">
                {/* LEYENDA DE CANDADOS */}
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Leyenda de candados:</span>
                    <span className="inline-flex items-center gap-1.5">
                        <LockOpenIcon className="text-emerald-600" style={{ fontSize: 16 }} />
                        <span><strong className="text-emerald-700">OP activa</strong> &mdash; se pueden registrar solicitudes</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <LockIcon className="text-red-600" style={{ fontSize: 16 }} />
                        <span><strong className="text-red-700">OP cerrada</strong> &mdash; no admite nuevas solicitudes</span>
                    </span>
                    {(role === "admin" || role === "supervisor" || role === "almacen") && (
                        <span className="text-slate-500">
                            &middot; Haz clic en el candado para alternar (requiere PIN)
                        </span>
                    )}
                </div>

                <div className="overflow-hidden">

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3 text-left">ID</th>
                                <th className="px-4 py-3 text-left">Persona</th>
                                <th className="px-4 py-3 text-left">Orden</th>
                                <th className="px-4 py-3 text-left">N° Parte</th>
                                <th className="px-4 py-3 text-center">Cant</th>
                                <th className="px-4 py-3 text-center">Estatus</th>
                                <th className="px-4 py-3 text-center">
                                    {(role === "admin" || role === "almacen") && "Movimiento"}
                                </th>
                                <th className="px-4 py-3 text-center">
                                    {(role === "admin" || role === "almacen") && "Acciones"}
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {paginated.map((r) => (
                                <tr
                                    key={r.id}
                                    className="hover:bg-blue-50/50 transition cursor-pointer"
                                    onClick={() => {
                                        setDetalle(r);
                                        setModalOpen(true);
                                    }}
                                >
                                    <td className="px-4 py-3 font-medium text-slate-800">{r.id}</td>

                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-slate-800">{r.persona}</div>
                                        <div className="text-xs text-slate-400">Estación {r.estacion}</div>
                                    </td>

                                    <td className="px-4 py-3 text-slate-700">{r.orden_produccion}</td>

                                    <td className="px-4 py-3">
                                        <span className="font-mono bg-slate-50 px-2 py-1 rounded text-slate-700 border border-slate-200 text-xs">
                                            {r.numero_parte}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3 text-center font-semibold">
                                        {Number(r.cantidad).toFixed(2)}
                                    </td>

                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            r.status === "PENDIENTE"
                                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        }`}>
                                            {r.status}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        {(role === "admin" || role === "almacen") && (
                                            loadingStatusId === r.id ? (
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <svg
                                                        className="animate-spin h-4 w-4 text-blue-500 shrink-0"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12" cy="12" r="10"
                                                            stroke="currentColor" strokeWidth="4"
                                                        />
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                        />
                                                    </svg>
                                                    Guardando…
                                                </div>
                                            ) : (
                                                <select
                                                    className="border rounded-lg px-2 py-1 text-xs bg-white"
                                                    value={r.estatus_movimiento}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const nuevo = e.target.value;
                                                        const anterior = r.estatus_movimiento;
                                                        const requierePin =
                                                            anterior === "SIN ENTREGAR" &&
                                                            (nuevo === "ENTREGADO" || nuevo === "CARGADO");
                                                        if (requierePin) {
                                                            setMovimientoSeleccionado(r);
                                                            setNuevoStatus(nuevo);
                                                            setPinModalStatusOpen(true);
                                                            return;
                                                        }
                                                        // Actualización optimista: reflejar el cambio localmente de inmediato
                                                        setRows(prev => prev.map(row =>
                                                            row.id === r.id ? { ...row, estatus_movimiento: nuevo } : row
                                                        ));
                                                        setLoadingStatusId(r.id);
                                                        actualizarEstatusMovimiento(r.id, nuevo)
                                                            .catch(() => {
                                                                // Revertir si el backend falla
                                                                setRows(prev => prev.map(row =>
                                                                    row.id === r.id ? { ...row, estatus_movimiento: anterior } : row
                                                                ));
                                                                alert("Error al actualizar el estatus");
                                                            })
                                                            .finally(() => {
                                                                setLoadingStatusId(null);
                                                                load();
                                                            });
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <option value="SIN ENTREGAR">Sin entregar</option>
                                                    <option value="ENTREGADO">Entregado</option>
                                                    <option value="CARGADO">Cargado (SAI)</option>
                                                </select>
                                            )
                                        )}
                                    </td>

                                    {/* ACCIONES: editar + eliminar + candado OP + atender */}
                                    <td
                                        className="px-4 py-3"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {(role === "admin" || role === "almacen") && (
                                            <div className="flex items-center gap-2">

                                                {/* EDITAR */}
                                                <button
                                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
                                                    title="Editar"
                                                    onClick={() => { setEditForm(r); setEditModalOpen(true); }}
                                                >
                                                    <EditIcon className="text-slate-600" fontSize="small" />
                                                </button>

                                                {/* ELIMINAR */}
                                                <button
                                                    className="p-1.5 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 transition"
                                                    title="Eliminar"
                                                    onClick={async () => {
                                                        if (!confirm("¿Eliminar registro?")) return;
                                                        await deleteAlmacenMovimiento(r.id);
                                                        load();
                                                    }}
                                                >
                                                    <DeleteIcon className="text-red-700" fontSize="small" />
                                                </button>

                                                {/* CANDADO OP */}
                                                {(() => {
                                                    const cerrada = esOrdenCerrada(r.orden_produccion);
                                                    const puedeAlternar = role === "admin" || role === "supervisor" || role === "almacen";

                                                    // Para cerrar: verificar que TODOS los movimientos de esta OP estén en CARGADO
                                                    const lineasDeOp = rows.filter(
                                                        (m) => m.orden_produccion === r.orden_produccion
                                                    );
                                                    const todasCargadas = lineasDeOp.length > 0 &&
                                                        lineasDeOp.every(
                                                            (m) => String(m.estatus_movimiento || "").toUpperCase() === "CARGADO"
                                                        );

                                                    // Solo bloquear el clic de cerrar; reabrir siempre se puede
                                                    const puedeAccionar = puedeAlternar && (cerrada || todasCargadas);

                                                    const title = !puedeAlternar
                                                        ? "Sin permisos para cambiar el estado de la OP"
                                                        : cerrada
                                                            ? `Orden ${r.orden_produccion} CERRADA — clic para reabrir`
                                                            : todasCargadas
                                                                ? `Orden ${r.orden_produccion} ACTIVA — clic para cerrar`
                                                                : `No se puede cerrar: hay movimientos sin Cargar en SAI`;

                                                    const cls = cerrada
                                                        ? "border-red-300 bg-red-50 hover:bg-red-100 text-red-700"
                                                        : todasCargadas
                                                            ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                                            : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60";

                                                    return (
                                                        <button
                                                            className={`p-1.5 rounded-lg border transition ${cls}`}
                                                            title={title}
                                                            disabled={!puedeAccionar}
                                                            onClick={() => puedeAccionar && abrirToggleModal(r.orden_produccion)}
                                                        >
                                                            {cerrada
                                                                ? <LockIcon fontSize="small" />
                                                                : <LockOpenIcon fontSize="small" />}
                                                        </button>
                                                    );
                                                })()}

                                                {/* ATENDER */}
                                                {r.status === "PENDIENTE" && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMovimientoSeleccionado(r);
                                                            setPinModalOpen(true);
                                                        }}
                                                        className="px-3 py-1 text-xs rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition whitespace-nowrap"
                                                    >
                                                        Atender
                                                    </button>
                                                )}

                                            </div>
                                        )}
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* PAGINACIÓN */}
                    <div className="px-6 py-4 flex justify-center items-center gap-3 bg-slate-50 border-t border-slate-200">
                        <button
                            className="btn"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            ←
                        </button>

                        <span className="text-sm text-slate-600">
                            Página {page} de {totalPages}
                        </span>

                        <button
                            className="btn"
                            disabled={page === totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            →
                        </button>
                    </div>
                </div>
            </div>

            {/* DRAWER */}
            {drawerOpen && (
                <>
                    {/* FONDO OSCURO */}
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setDrawerOpen(false)}
                    />

                    {/* DRAWER */}
                    <aside className="
                        fixed right-0 top-0 h-full w-full sm:w-[440px] z-50
                        bg-white shadow-2xl
                        border-l border-slate-200
                        flex flex-col
                    ">
                        {/* HEADER */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                                Nueva solicitud
                            </h3>
                            <button
                                className="btn"
                                onClick={() => setDrawerOpen(false)}
                            >
                                Cerrar
                            </button>
                        </div>

                        {/* CONTENIDO */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

                            {/* ----------- DATOS GENERALES ----------- */}
                            <div className="card space-y-4">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Datos Generales
                                </h4>

                                {/* SOLICITANTE POR PIN */}
                                <div className="p-4 rounded-lg border border-blue-100 bg-blue-50/50">
                                    <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">
                                        Solicitante (Responsable)
                                    </label>

                                    <input
                                        className="input border-blue-200 focus:border-blue-500"
                                        placeholder="Ingresa tu PIN"
                                        value={formHeader.pin}
                                        onChange={e => setFormHeader({ ...formHeader, pin: e.target.value })}
                                        type="text"
                                    />

                                    <p className="text-xs text-blue-500 mt-1.5">
                                        Ingresa tu PIN personal asignado por almacén.
                                    </p>
                                </div>

                                <input
                                    className="input"
                                    placeholder="Estación"
                                    value={formHeader.estacion}
                                    onChange={(e) => setFormHeader({ ...formHeader, estacion: e.target.value })}
                                />

                                <input
                                    className={`input ${esOrdenCerrada(formHeader.orden_produccion) ? "border-red-400 focus:border-red-500" : ""}`}
                                    placeholder="Orden de producción (activa)"
                                    list="ordenes-abiertas"
                                    value={formHeader.orden_produccion}
                                    onChange={(e) => setFormHeader({ ...formHeader, orden_produccion: e.target.value })}
                                />
                                <datalist id="ordenes-abiertas">
                                    {ordenesAbiertas.map((op) => (
                                        <option key={op} value={op} />
                                    ))}
                                </datalist>
                                {esOrdenCerrada(formHeader.orden_produccion) && (
                                    <p className="text-xs text-red-600 -mt-2">
                                        La Orden {formHeader.orden_produccion} está cerrada. No se pueden registrar más movimientos.
                                    </p>
                                )}

                                <select
                                    className="input"
                                    value={formHeader.concepto_liberacion}
                                    onChange={(e) => setFormHeader({ ...formHeader, concepto_liberacion: e.target.value })}
                                >
                                    <option value="">Concepto de liberación</option>
                                    <option>Desgaste</option>
                                    <option>Orden de Producción</option>
                                    <option>Reposición</option>
                                    <option>Reproceso</option>
                                    <option>Autorización Especial</option>
                                </select>
                            </div>


                            {/* ----------- AGREGAR PIEZAS ----------- */}
                            <div className="card space-y-4">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Agregar pieza
                                </h4>

                                <input
                                    className="input"
                                    placeholder="Buscar número de parte…"
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        handleBuscarProd(e.target.value);
                                    }}
                                />

                                {productos.length > 0 && (
                                    <div className="border border-slate-200 rounded-lg bg-white max-h-48 overflow-y-auto divide-y divide-slate-100">
                                        {productos.map((p) => (
                                            <div
                                                key={p.id}
                                                className="px-3 py-2 hover:bg-blue-50/50 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    setCurrentPart({
                                                        numero_parte: p.clave_prod,
                                                        descripcion: p.desc_prod,
                                                        cantidad: 1
                                                    });
                                                    setProductos([]);
                                                    setSearch("");
                                                }}
                                            >
                                                <div className="font-semibold">{p.clave_prod}</div>
                                                <div className="text-xs text-slate-500">{p.desc_prod}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <input
                                    className="input"
                                    placeholder="Número de parte"
                                    value={currentPart.numero_parte}
                                    onChange={(e) =>
                                        setCurrentPart({ ...currentPart, numero_parte: e.target.value })
                                    }
                                />

                                <textarea
                                    className="input"
                                    rows={2}
                                    placeholder="Descripción"
                                    value={currentPart.descripcion}
                                    onChange={(e) =>
                                        setCurrentPart({ ...currentPart, descripcion: e.target.value })
                                    }
                                />

                                <input
                                    className="input"
                                    type="number"
                                    placeholder="Cantidad"
                                    value={currentPart.cantidad}
                                    onChange={(e) =>
                                        setCurrentPart({ ...currentPart, cantidad: Number(e.target.value) })
                                    }
                                />

                                <button
                                    className="btn w-full"
                                    onClick={agregarPiezaALista}
                                >
                                    Agregar pieza
                                </button>
                            </div>

                            {/* ----------- LISTA DE PIEZAS ----------- */}
                            {listaPiezas.length > 0 && (
                                <div className="card space-y-3">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Piezas agregadas ({listaPiezas.length})
                                    </h4>

                                    <div className="space-y-2">
                                        {listaPiezas.map((p, i) => (
                                            <div
                                                key={i}
                                                className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-slate-50"
                                            >
                                                <div>
                                                    <div className="font-semibold text-sm text-slate-800">{p.numero_parte}</div>
                                                    <div className="text-xs text-slate-500">{p.descripcion}</div>
                                                    <div className="text-xs font-bold text-slate-600">x{p.cantidad}</div>
                                                </div>

                                                <button
                                                    className="btn btn-danger text-xs px-2 py-1"
                                                    onClick={() => removerPiezaLista(i)}
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* BOTÓN FINAL */}
                            <div className="mt-6 pt-4 border-t border-slate-200">
                                <button
                                    onClick={handleCrearTodo}
                                    className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
                                >
                                    <span>Guardar Solicitud</span>
                                    {listaPiezas.length > 0 && (
                                        <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                                            {listaPiezas.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                        </div>
                    </aside>
                </>
            )}
            {modalOpen && detalle && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setModalOpen(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                    bg-white w-[90%] max-w-md rounded-xl shadow-2xl p-6
                    z-50 border border-slate-200">

                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Detalle de solicitud</h3>

                        <div className="space-y-3 text-sm">

                            <div>
                                <span className="font-semibold text-slate-500">Persona: </span>
                                <span className="text-slate-800">{detalle.persona}</span>
                            </div>

                            <div>
                                <span className="font-semibold text-slate-500">Estación: </span>
                                <span>{detalle.estacion}</span>
                            </div>

                            <div>
                                <span className="font-semibold text-slate-500">Número de parte: </span>
                                <span className="font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200 text-xs">
                                    {detalle.numero_parte}
                                </span>
                            </div>

                            <div>
                                <span className="font-semibold text-slate-500">Descripción: </span>
                                <p className="text-slate-700">{detalle.descripcion}</p>
                            </div>

                            <div>
                                <span className="font-semibold text-slate-500">Cantidad: </span>
                                <span className="font-semibold">{Number(detalle.cantidad).toFixed(2)}</span>
                            </div>

                            <div>
                                <span className="font-semibold text-slate-500">Fecha solicitud: </span>
                                <span className="text-slate-800">
                                    {new Date(detalle.creado_en).toLocaleDateString("es-MX", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </span>
                            </div>

                        </div>

                        <button
                            onClick={() => setModalOpen(false)}
                            className="btn btn-primary w-full mt-5"
                        >
                            Cerrar
                        </button>
                    </div>
                </>
            )}

            {editModalOpen && editForm && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setEditModalOpen(false)}
                    />

                    <div className="
                    fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                    bg-white w-[90%] max-w-md rounded-xl shadow-2xl p-6
                    z-50 border border-slate-200
                    ">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Editar solicitud</h3>

                        <div className="space-y-3 text-sm">

                            <input
                                className="input w-full"
                                value={editForm.persona}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, persona: e.target.value })
                                }
                                placeholder="Persona"
                            />

                            <input
                                className="input w-full"
                                value={editForm.estacion}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, estacion: e.target.value })
                                }
                                placeholder="Estación"
                            />

                            <input
                                className="input w-full"
                                value={editForm.orden_produccion}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, orden_produccion: e.target.value })
                                }
                                placeholder="Orden"
                            />

                            <input
                                className="input w-full"
                                value={editForm.numero_parte}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, numero_parte: e.target.value })
                                }
                                placeholder="Número de parte"
                            />

                            <textarea
                                className="input w-full"
                                rows={2}
                                value={editForm.descripcion}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, descripcion: e.target.value })
                                }
                                placeholder="Descripción"
                            />

                            <input
                                className="input w-full"
                                type="number"
                                value={editForm.cantidad}
                                onChange={(e) =>
                                    setEditForm({ ...editForm, cantidad: Number(e.target.value) })
                                }
                                placeholder="Cantidad"
                            />
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button
                                className="btn flex-1"
                                onClick={() => setEditModalOpen(false)}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn btn-primary flex-1"
                                onClick={async () => {
                                    await updateAlmacenMovimiento(editForm.id, editForm);
                                    setEditModalOpen(false);
                                    load();
                                }}
                            >
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                </>
            )}

            {pinModalOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setPinModalOpen(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        bg-white w-[90%] max-w-sm rounded-xl shadow-2xl p-6
                        z-50 border border-slate-200">

                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="p-3 bg-blue-50 rounded-full mb-3">
                                <LockIcon className="text-blue-500" style={{ fontSize: 32 }} />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">Confirmar Atención</h2>
                            <p className="text-slate-500 text-sm mt-1">
                                ¿Quién está atendiendo esta solicitud?
                            </p>
                        </div>

                        <label className="text-xs font-semibold text-slate-500 uppercase">
                            Firma / PIN / Nombre
                        </label>

                        <input
                            className="input mt-1 mb-4"
                            placeholder="Ingresa tu clave…"
                            value={pinValue}
                            onChange={(e) => setPinValue(e.target.value)}
                        />

                        <div className="flex justify-between mt-2">
                            <button
                                className="btn"
                                onClick={() => {
                                    setPinModalOpen(false);
                                    setPinValue("");
                                }}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn btn-primary"
                                onClick={async () => {
                                    try {
                                        await atenderAlmacenMovimientoPin(movimientoSeleccionado.id, pinValue);
                                        setPinModalOpen(false);
                                        setPinValue("");
                                        load();
                                        alert("Movimiento atendido correctamente.");
                                    } catch (err) {
                                        alert("PIN incorrecto " + err);
                                    }
                                }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </>
            )}

            {pinModalStatusOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setPinModalStatusOpen(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        bg-white w-[90%] max-w-sm rounded-xl shadow-2xl p-6
                        z-50 border border-slate-200">

                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="p-3 bg-blue-50 rounded-full mb-3">
                                <LockIcon className="text-blue-500" style={{ fontSize: 32 }} />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">Confirmar Entrega</h2>
                            <p className="text-slate-500 text-sm mt-1">
                                ¿Quién está realizando este movimiento?
                            </p>
                        </div>

                        <label className="text-xs font-semibold text-slate-500 uppercase">
                            Firma / PIN / Nombre
                        </label>

                        <input
                            className="input mt-1 mb-4"
                            placeholder="Ingresa tu clave…"
                            value={pinStatusValue}
                            onChange={(e) => setPinStatusValue(e.target.value)}
                        />

                        <div className="flex justify-between mt-2">
                            <button
                                className="btn"
                                onClick={() => {
                                    setPinModalStatusOpen(false);
                                    setPinStatusValue("");
                                }}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn btn-primary"
                                onClick={async () => {
                                    try {
                                        await cambiarStatusConPin(
                                            movimientoSeleccionado.id,
                                            nuevoStatus,
                                            pinStatusValue
                                        );

                                        setPinModalStatusOpen(false);
                                        setPinStatusValue("");
                                        load();
                                        alert("Estatus actualizado correctamente.");
                                    } catch (err) {
                                        alert("PIN incorrecto" + err);
                                    }
                                }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </>
            )}

            {cerrarModalOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setCerrarModalOpen(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            bg-white w-[90%] max-w-sm rounded-xl shadow-2xl p-6
            z-50 border border-slate-200">

                        <h3 className="text-lg font-semibold text-slate-900 mb-4 text-center">
                            Cerrar solicitud
                        </h3>

                        <div className="space-y-3 text-sm">

                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">
                                    PIN
                                </label>
                                <input
                                    className="input mt-1"
                                    value={pinCerrar}
                                    onChange={(e) => setPinCerrar(e.target.value)}
                                    placeholder="Ingresa tu PIN"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">
                                    Orden de producción
                                </label>
                                <select
                                    className="input mt-1"
                                    value={ordenCerrar}
                                    onChange={(e) => setOrdenCerrar(e.target.value)}
                                >
                                    <option value="">Selecciona orden de producción</option>
                                    {ordenesUnicas
                                        .filter((op) => !esOrdenCerrada(op))
                                        .map((op) => (
                                            <option key={op} value={op}>
                                                {op}
                                            </option>
                                        ))}
                                </select>
                            </div>

                        </div>

                        <div className="flex gap-3 mt-5">
                            <button
                                className="btn flex-1"
                                onClick={() => {
                                    setCerrarModalOpen(false);
                                    setPinCerrar("");
                                    setOrdenCerrar("");
                                }}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn btn-danger flex-1"
                                onClick={() => {
                                    cerrarSolicitudDummy();
                                    setCerrarModalOpen(false);
                                    setModalOpen(false);
                                    setPinCerrar("");
                                    setOrdenCerrar("");
                                }}
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </>
            )}

            {toggleModalOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setToggleModalOpen(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        bg-white w-[90%] max-w-sm rounded-xl shadow-2xl p-6
                        z-50 border border-slate-200">

                        <div className="flex flex-col items-center text-center mb-4">
                            <div className={`p-3 rounded-full mb-3 ${toggleProximoEstado === "CERRADA" ? "bg-red-50" : "bg-emerald-50"}`}>
                                {toggleProximoEstado === "CERRADA"
                                    ? <LockIcon className="text-red-600" />
                                    : <LockOpenIcon className="text-emerald-600" />}
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                {toggleProximoEstado === "CERRADA" ? "Cerrar OP" : "Reabrir OP"} {toggleOrden}
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                {toggleProximoEstado === "CERRADA"
                                    ? "Una vez cerrada, no se podrán registrar más solicitudes contra esta orden."
                                    : "Al reabrirla, se podrán registrar nuevas solicitudes nuevamente."}
                            </p>
                        </div>

                        <label className="text-xs font-semibold text-slate-500 uppercase">
                            Firma / PIN
                        </label>

                        <input
                            className="input mt-1 mb-4"
                            placeholder="Ingresa tu clave…"
                            value={togglePin}
                            onChange={(e) => setTogglePin(e.target.value)}
                        />

                        <div className="flex justify-between mt-2 gap-3">
                            <button
                                className="btn flex-1"
                                onClick={() => {
                                    setToggleModalOpen(false);
                                    setTogglePin("");
                                }}
                            >
                                Cancelar
                            </button>

                            <button
                                className={`btn flex-1 ${toggleProximoEstado === "CERRADA" ? "btn-danger" : "btn-primary"}`}
                                onClick={confirmarToggleOP}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
}
