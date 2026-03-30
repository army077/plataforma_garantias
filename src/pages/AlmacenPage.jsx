import { useEffect, useState } from "react";
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
    validarPinUsuario
} from "../lib/api.js";
import EstadoBadge from "../components/EstadoBadge";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

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
        const data = await listAlmacenMovimientos();
        setRows(data);

        // Obtener órdenes únicas
        const setOrdenes = Array.from(
            new Set(data.map(r => r.orden_produccion).filter(Boolean))
        );

        setOrdenesUnicas(setOrdenes);
    };

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
            alert("Error al guardar.");
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

            // 2) cerrar movimientos por orden
            await cerrarMovimientosPorOrden(ordenCerrar);

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
                <div className="overflow-hidden">

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-6 py-3 text-left">ID</th>
                                <th className="px-6 py-3 text-left">Persona</th>
                                <th className="px-6 py-3 text-left">Orden</th>
                                <th className="px-6 py-3 text-left">N° Parte</th>
                                <th className="px-6 py-3 text-center">Cant</th>
                                <th className="px-6 py-3 text-center">Estatus</th>
                                <th className="px-6 py-3 text-center">
                                    {(role === "admin" || role === "almacen") && (
                                        "Movimiento"
                                    )}
                                </th>
                                <th className="px-6 py-3 text-center">
                                    {(role === "admin" || role === "almacen") && (
                                        "Acciones"
                                    )}
                                </th>
                                <th className="px-6 py-3"></th>
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
                                    <td className="px-6 py-4 font-medium text-slate-800">{r.id}</td>

                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-800">
                                            {r.persona}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            Estación {r.estacion}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-slate-700">{r.orden_produccion}</td>

                                    <td className="px-6 py-4">
                                        <span className="font-mono bg-slate-50 px-2 py-1 rounded text-slate-700 border border-slate-200 text-xs">
                                            {r.numero_parte}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4 text-center font-semibold">
                                        {Number(r.cantidad).toFixed(2)}
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <span
                                            className={`
                                                inline-flex px-3 py-1 rounded-full text-xs font-semibold
                                                ${r.status === "PENDIENTE"
                                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"}
                                            `}
                                        >
                                            {r.status}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4">
                                        {(role === "admin" || role === "almacen") && (
                                            <select
                                                className="border rounded-lg px-2 py-1 text-xs bg-white"
                                                value={r.estatus_movimiento}
                                                onChange={(e) => {
                                                    e.stopPropagation();

                                                    const nuevo = e.target.value;
                                                    const anterior = r.estatus_movimiento;

                                                    // SOLO pedir PIN cuando pasa de SIN ENTREGAR → otro estatus
                                                    const requierePin =
                                                        anterior === "SIN ENTREGAR" &&
                                                        (nuevo === "ENTREGADO" || nuevo === "CARGADO");

                                                    if (requierePin) {
                                                        setMovimientoSeleccionado(r);
                                                        setNuevoStatus(nuevo);
                                                        setPinModalStatusOpen(true);
                                                        return;
                                                    }

                                                    // Cambios normales SIN PIN
                                                    actualizarEstatusMovimiento(r.id, nuevo);
                                                    load();
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <option value="SIN ENTREGAR">Sin entregar</option>
                                                <option value="ENTREGADO">Entregado</option>
                                                <option value="CARGADO">Cargado (SAI)</option>
                                            </select>
                                        )}
                                    </td>

                                    <td
                                        className="px-6 py-4 text-right"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {(role === "admin" || role === "almacen") && (
                                            <div className="flex items-center gap-3 justify-end">

                                                {/* EDITAR */}
                                                <button
                                                    className="p-1.5 rounded-lg border border-slate-200 bg-white 
                                                            hover:bg-slate-50 transition"
                                                    title="Editar"
                                                    onClick={() => {
                                                        setEditForm(r);
                                                        setEditModalOpen(true);
                                                    }}
                                                >
                                                    <EditIcon className="text-slate-600" fontSize="small" />
                                                </button>

                                                {/* ELIMINAR */}
                                                <button
                                                    className="p-1.5 rounded-lg border border-red-300 bg-red-50 
                                                        hover:bg-red-100 transition"
                                                    title="Eliminar"
                                                    onClick={async () => {
                                                        if (!confirm("¿Eliminar registro?")) return;
                                                        await deleteAlmacenMovimiento(r.id);
                                                        load();
                                                    }}
                                                >
                                                    <DeleteIcon className="text-red-700" fontSize="small" />
                                                </button>

                                            </div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        {(role === "admin" || role === "almacen") && r.status === "PENDIENTE" && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMovimientoSeleccionado(r);
                                                    setPinModalOpen(true);
                                                }}
                                                className="px-3 py-1 text-xs rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                                            >
                                                Atender
                                            </button>
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
                                    className="input"
                                    placeholder="Orden de producción"
                                    value={formHeader.orden_produccion}
                                    onChange={(e) => setFormHeader({ ...formHeader, orden_produccion: e.target.value })}
                                />

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
                                <img src="/lock-icon.svg" className="w-8 h-8" />
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
                                <img src="/lock-icon.svg" className="w-8 h-8" />
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
                                    {ordenesUnicas.map((op) => (
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

        </div>
    );
}
