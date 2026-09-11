import { useEffect, useState } from "react";
import {
    getUsuariosAlmacen,
    createUsuarioAlmacen,
    updateUsuarioAlmacen,
    resetPinUsuarioAlmacen
} from "../lib/api";

const PIN_REGEX = /^\d{4,6}$/;

function normalizarNombre(str) {
    return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default function UsuariosAlmacenPage() {
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal: Nuevo responsable
    const [modalCrearOpen, setModalCrearOpen] = useState(false);
    const [formCrear, setFormCrear] = useState({ nombre: "", pin: "" });
    const [errorCrear, setErrorCrear] = useState("");

    // Modal: Editar nombre
    const [modalEditarOpen, setModalEditarOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [nombreEditar, setNombreEditar] = useState("");
    const [errorEditar, setErrorEditar] = useState("");

    // Modal: Cambiar PIN temporal
    const [modalPinOpen, setModalPinOpen] = useState(false);
    const [pinUser, setPinUser] = useState(null);
    const [nuevoPin, setNuevoPin] = useState("");
    const [errorPin, setErrorPin] = useState("");

    const load = async () => {
        try {
            setLoading(true);
            const data = await getUsuariosAlmacen();
            setUsuarios(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error al cargar responsables:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    // --- Alta ---
    const abrirCrear = () => {
        setFormCrear({ nombre: "", pin: "" });
        setErrorCrear("");
        setModalCrearOpen(true);
    };

    const guardarCrear = async () => {
        const nombreLimpio = formCrear.nombre.trim();
        const pinLimpio = formCrear.pin.trim();

        if (!nombreLimpio) {
            setErrorCrear("El nombre es obligatorio.");
            return;
        }

        const normNuevo = normalizarNombre(nombreLimpio);
        const existe = usuarios.some(u => normalizarNombre(u.nombre) === normNuevo);
        if (existe) {
            setErrorCrear("Ya existe un responsable registrado con este nombre.");
            return;
        }

        if (!PIN_REGEX.test(pinLimpio)) {
            setErrorCrear("El PIN debe ser exclusivamente numérico de 4 a 6 dígitos.");
            return;
        }

        try {
            await createUsuarioAlmacen({
                nombre: nombreLimpio,
                rol: "solicitante",
                pin: pinLimpio
            });
            setModalCrearOpen(false);
            await load();
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.error || "Error al crear el responsable.";
            setErrorCrear(msg);
        }
    };

    // --- Edición de Nombre ---
    const abrirEditar = (u) => {
        setEditUser(u);
        setNombreEditar(u.nombre || "");
        setErrorEditar("");
        setModalEditarOpen(true);
    };

    const guardarEditar = async () => {
        const nombreLimpio = nombreEditar.trim();

        if (!nombreLimpio) {
            setErrorEditar("El nombre es obligatorio.");
            return;
        }

        const normEdit = normalizarNombre(nombreLimpio);
        const existe = usuarios.some(
            u => u.id !== editUser.id && normalizarNombre(u.nombre) === normEdit
        );
        if (existe) {
            setErrorEditar("Ya existe otro responsable registrado con este nombre.");
            return;
        }

        try {
            await updateUsuarioAlmacen(editUser.id, {
                nombre: nombreLimpio,
                rol: editUser.rol
            });
            setModalEditarOpen(false);
            await load();
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.error || "Error al actualizar el nombre.";
            setErrorEditar(msg);
        }
    };

    // --- Cambio de PIN ---
    const abrirCambiarPin = (u) => {
        setPinUser(u);
        setNuevoPin("");
        setErrorPin("");
        setModalPinOpen(true);
    };

    const guardarCambiarPin = async () => {
        const pinLimpio = nuevoPin.trim();

        if (!PIN_REGEX.test(pinLimpio)) {
            setErrorPin("El PIN debe ser exclusivamente numérico de 4 a 6 dígitos.");
            return;
        }

        try {
            await resetPinUsuarioAlmacen(pinUser.id, pinLimpio);
            setModalPinOpen(false);
            await load();
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.error || "Error al cambiar el PIN.";
            setErrorPin(msg);
        }
    };

    return (
        <div className="space-y-5">
            {/* Encabezado */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Catálogo de Responsables</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Gestión de personal autorizado para solicitud y recepción de material</p>
                </div>
                <button
                    onClick={abrirCrear}
                    className="btn btn-primary"
                >
                    Nuevo responsable
                </button>
            </div>

            {/* Tabla */}
            <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Responsable</th>
                            <th className="px-4 py-3">Rol</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                                    Cargando responsables…
                                </td>
                            </tr>
                        ) : usuarios.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                                    No hay responsables registrados.
                                </td>
                            </tr>
                        ) : (
                            usuarios.map(u => {
                                const estaActivo = u.activo !== 0 && u.activo !== false;
                                return (
                                    <tr key={u.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.id}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{u.nombre}</td>
                                        <td className="px-4 py-3 text-slate-600">{u.rol}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                estaActivo
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                            }`}>
                                                {estaActivo ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2 justify-center">
                                                <button
                                                    className="btn text-xs px-2.5 py-1"
                                                    onClick={() => abrirEditar(u)}
                                                >
                                                    Editar nombre
                                                </button>

                                                <button
                                                    className="btn text-xs px-2.5 py-1 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                                                    onClick={() => abrirCambiarPin(u)}
                                                >
                                                    Cambiar PIN
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL: NUEVO RESPONSABLE */}
            {modalCrearOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setModalCrearOpen(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                    bg-white w-[90%] max-w-md p-6 rounded-xl shadow-2xl border border-slate-200 z-50">
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                            Nuevo responsable
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Se registrará con rol <span className="font-semibold text-slate-700">solicitante</span>.
                        </p>

                        {errorCrear && (
                            <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
                                {errorCrear}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Nombre completo
                                </label>
                                <input
                                    className="input w-full"
                                    placeholder="Ej. Juan Pérez"
                                    value={formCrear.nombre}
                                    onChange={e => {
                                        setFormCrear({ ...formCrear, nombre: e.target.value });
                                        setErrorCrear("");
                                    }}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    PIN temporal (4 a 6 dígitos)
                                </label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={6}
                                    className="input w-full"
                                    placeholder="Ej. 1234"
                                    value={formCrear.pin}
                                    onChange={e => {
                                        setFormCrear({ ...formCrear, pin: e.target.value });
                                        setErrorCrear("");
                                    }}
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Debe ser estrictamente numérico (entre 4 y 6 números).
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                className="btn flex-1"
                                onClick={() => setModalCrearOpen(false)}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn btn-primary flex-1"
                                onClick={guardarCrear}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL: EDITAR NOMBRE */}
            {modalEditarOpen && editUser && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setModalEditarOpen(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                    bg-white w-[90%] max-w-md p-6 rounded-xl shadow-2xl border border-slate-200 z-50">
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                            Editar nombre de responsable
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            ID: <span className="font-mono text-slate-700">{editUser.id}</span> · Rol: <span className="font-medium text-slate-700">{editUser.rol}</span>
                        </p>

                        {errorEditar && (
                            <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
                                {errorEditar}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Nombre completo
                                </label>
                                <input
                                    className="input w-full"
                                    placeholder="Nombre del responsable"
                                    value={nombreEditar}
                                    onChange={e => {
                                        setNombreEditar(e.target.value);
                                        setErrorEditar("");
                                    }}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                className="btn flex-1"
                                onClick={() => setModalEditarOpen(false)}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn btn-primary flex-1"
                                onClick={guardarEditar}
                            >
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL: CAMBIAR PIN */}
            {modalPinOpen && pinUser && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setModalPinOpen(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                    bg-white w-[90%] max-w-md p-6 rounded-xl shadow-2xl border border-slate-200 z-50">
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                            Cambiar PIN temporal
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Responsable: <span className="font-semibold text-slate-700">{pinUser.nombre}</span>
                        </p>

                        {errorPin && (
                            <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600">
                                {errorPin}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Nuevo PIN numérico (4 a 6 dígitos)
                                </label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={6}
                                    className="input w-full"
                                    placeholder="Ingresa el nuevo PIN"
                                    value={nuevoPin}
                                    onChange={e => {
                                        setNuevoPin(e.target.value);
                                        setErrorPin("");
                                    }}
                                    autoFocus
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Debe ser estrictamente numérico (entre 4 y 6 números).
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                className="btn flex-1"
                                onClick={() => setModalPinOpen(false)}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn btn-primary flex-1"
                                onClick={guardarCambiarPin}
                            >
                                Actualizar PIN
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
