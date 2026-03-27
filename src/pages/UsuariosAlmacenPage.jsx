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
        <div className="p-6">
            <div className="flex justify-between mb-4">
                <h2 className="text-xl font-semibold">Usuarios de Almacén</h2>
                <button
                    onClick={abrirCrear}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow"
                >
                    Nuevo usuario
                </button>
            </div>

            <div className="bg-white shadow rounded-xl overflow-hidden border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-neutral-100 text-neutral-700 text-xs uppercase tracking-wide border-b">
                            <th className="px-4 py-3 text-left">ID</th>
                            <th className="px-4 py-3 text-left">Nombre</th>
                            <th className="px-4 py-3 text-left">Rol</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.map(u => (
                            <tr key={u.id} className="border-b hover:bg-neutral-50">
                                <td className="px-4 py-3">{u.id}</td>
                                <td className="px-4 py-3 font-medium">{u.nombre}</td>
                                <td className="px-4 py-3">{u.rol}</td>
                                <td className="px-4 py-3 flex gap-3 justify-center">
                                    
                                    {/* Editar */}
                                    <button
                                        className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs"
                                        onClick={() => abrirEditar(u)}
                                    >
                                        Editar
                                    </button>

                                    {/* Eliminar */}
                                    <button
                                        className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs"
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
                        className="fixed inset-0 bg-black/40"
                        onClick={() => setOpenModal(false)}
                    />

                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                    bg-white w-[90%] max-w-md p-6 rounded-xl shadow-xl">

                        <h3 className="text-lg font-semibold mb-4">
                            {editUser ? "Editar usuario" : "Nuevo usuario"}
                        </h3>

                        <div className="space-y-3">

                            <input
                                className="w-full border px-3 py-2 rounded-lg"
                                placeholder="Nombre"
                                value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                            />

                            <input
                                className="w-full border px-3 py-2 rounded-lg"
                                placeholder="Rol"
                                value={form.rol}
                                onChange={e => setForm({ ...form, rol: e.target.value })}
                            />

                            <input
                                className="w-full border px-3 py-2 rounded-lg"
                                placeholder={editUser ? "Nuevo PIN (opcional)" : "PIN inicial"}
                                value={form.pin}
                                onChange={e => setForm({ ...form, pin: e.target.value })}
                            />
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button
                                className="flex-1 py-2 rounded-lg bg-neutral-200"
                                onClick={() => setOpenModal(false)}
                            >
                                Cancelar
                            </button>

                            <button
                                className="flex-1 py-2 rounded-lg bg-blue-600 text-white"
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
