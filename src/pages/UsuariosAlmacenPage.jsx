import { useEffect, useState } from "react";
import {
    getUsuariosAlmacen,
    createUsuarioAlmacen,
    updateUsuarioAlmacen,
    deleteUsuarioAlmacen,
    resetPinUsuarioAlmacen
} from "../lib/api";

export default function UsuariosAlmacenPage() {

    const [usuarios, setUsuarios] = useState([]);
    const [openModal, setOpenModal] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [form, setForm] = useState({ nombre: "", rol: "", pin: "" });

    const load = async () => {
        const data = await getUsuariosAlmacen();
        setUsuarios(data);
    };

    useEffect(() => { load(); }, []);

    const abrirCrear = () => {
        setForm({ nombre: "", rol: "", pin: "" });
        setEditUser(null);
        setOpenModal(true);
    };

    const abrirEditar = (u) => {
        setEditUser(u);
        setForm({ nombre: u.nombre, rol: u.rol, pin: "" });
        setOpenModal(true);
    };

    const guardar = async () => {
        if (!form.nombre.trim() || !form.rol.trim()) {
            alert("Faltan datos obligatorios");
            return;
        }

        if (editUser) {
            await updateUsuarioAlmacen(editUser.id, {
                nombre: form.nombre,
                rol: form.rol
            });

            if (form.pin.length >= 4) {
                await resetPinUsuarioAlmacen(editUser.id, form.pin);
            }
        } else {
            await createUsuarioAlmacen(form);
        }

        setOpenModal(false);
        load();
    };

    const eliminar = async (id) => {
        if (!confirm("¿Eliminar usuario?")) return;
        await deleteUsuarioAlmacen(id);
        load();
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Usuarios de Almacén</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Gestión de usuarios y PINs</p>
                </div>
                <button
                    onClick={abrirCrear}
                    className="btn btn-primary"
                >
                    Nuevo usuario
                </button>
            </div>

            <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Nombre</th>
                            <th className="px-4 py-3">Rol</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {usuarios.map(u => (
                            <tr key={u.id} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-4 py-3 text-slate-600">{u.id}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">{u.nombre}</td>
                                <td className="px-4 py-3 text-slate-600">{u.rol}</td>
                                <td className="px-4 py-3 flex gap-2 justify-center">
                                    
                                    <button
                                        className="btn text-xs px-2 py-1"
                                        onClick={() => abrirEditar(u)}
                                    >
                                        Editar
                                    </button>

                                    <button
                                        className="btn btn-danger text-xs px-2 py-1"
                                        onClick={() => eliminar(u.id)}
                                    >
                                        Eliminar
                                    </button>

                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {openModal && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
                        onClick={() => setOpenModal(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                    bg-white w-[90%] max-w-md p-6 rounded-xl shadow-2xl border border-slate-200 z-50">

                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                            {editUser ? "Editar usuario" : "Nuevo usuario"}
                        </h3>

                        <div className="space-y-3">

                            <input
                                className="input"
                                placeholder="Nombre"
                                value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                            />

                            <input
                                className="input"
                                placeholder="Rol"
                                value={form.rol}
                                onChange={e => setForm({ ...form, rol: e.target.value })}
                            />

                            <input
                                className="input"
                                placeholder={editUser ? "Nuevo PIN (opcional)" : "PIN inicial"}
                                value={form.pin}
                                onChange={e => setForm({ ...form, pin: e.target.value })}
                            />
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button
                                className="btn flex-1"
                                onClick={() => setOpenModal(false)}
                            >
                                Cancelar
                            </button>

                            <button
                                className="btn btn-primary flex-1"
                                onClick={guardar}
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
}
