import { useEffect, useMemo, useRef, useState } from "react";
import {
    listAlmacenMovimientos,
    normalizarOrdenProduccion,
    createAlmacenMovimiento,
    getUsuariosAlmacen,
    listResponsablesPorOrden,
    getResponsablePorOrden,
    updateResponsablePorOrden,
    buscarProductoAlmacen,
    atenderAlmacenMovimiento,
    actualizarEstatusMovimiento,
    updateAlmacenMovimiento,
    deleteAlmacenMovimiento,
    listOrdenesCerradas,
    toggleOrdenProduccion
} from "../lib/api.js";
import EstadoBadge from "../components/EstadoBadge";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

const PERSONA_POR_ASIGNAR = "Por asignar";
const opcionSinResponsable = { id: null, nombre: PERSONA_POR_ASIGNAR, esPorAsignar: true };
const claveOP = normalizarOrdenProduccion;
const firmaAsignacion = (a) => JSON.stringify([a?.responsable_id ?? null, a?.asignado_por ?? null, a?.asignado_en ?? null]);

function normalizarTexto(str) {
    return (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// Normaliza "OP3889", "op3889" o "3889" a la forma pura "3889" para comparar OPs
const normalizarOP = normalizarOrdenProduccion;

// Formatea cualquier valor de OP para mostrarse siempre con el prefijo "OP" (ej. "OP3889")
function formatearOP(value) {
    const norm = normalizarOP(value);
    return norm ? `OP${norm}` : "";
}

export default function AlmacenPage() {
    const { user, role, usuarioId } = useAuth();
    const puedeAsignarOP = role === "admin" || role === "almacen";
    const [responsablesPorOP, setResponsablesPorOP] = useState(null);
    const [loadingResponsablesOP, setLoadingResponsablesOP] = useState(true);
    const [errorResponsablesOP, setErrorResponsablesOP] = useState(null);
    const [operacionesResponsablePorOP, setOperacionesResponsablePorOP] = useState({});
    const bloqueosOP = useRef(new Set());
    const incertidumbreOP = useRef(new Set());
    const basesAsignacion = useRef({});
    const versionResponsables = useRef(0);
    const [editorOP, setEditorOP] = useState(null);
    const [editorSeleccion, setEditorSeleccion] = useState(null);
    const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);
    const envioSolicitud = useRef(false);
    const [resultadoSolicitud, setResultadoSolicitud] = useState(null);
    const [asignacionPendiente, setAsignacionPendiente] = useState(null);
    const [movimientoIncierto, setMovimientoIncierto] = useState(false);
    const [seleccionOPModificada, setSeleccionOPModificada] = useState(false);
    const [buscandoResponsable, setBuscandoResponsable] = useState(false);

    const cargarAsignacionesOP = async () => {
        if (bloqueosOP.current.size) return;
        const version = ++versionResponsables.current;
        setLoadingResponsablesOP(true);
        try {
            const data = await listResponsablesPorOrden();
            if (!Array.isArray(data)) throw new Error("Respuesta inválida");
            if (version !== versionResponsables.current) return;
            setResponsablesPorOP(Object.fromEntries(data.map(a => [claveOP(a.orden_produccion), a])));
            setErrorResponsablesOP(null);
        } catch (_) {
            if (version === versionResponsables.current) setErrorResponsablesOP("No se pudo consultar el servicio de responsables de OP.");
        } finally {
            if (version === versionResponsables.current) setLoadingResponsablesOP(false);
        }
    };

    const textoResponsableOP = (orden) => {
        if (!claveOP(orden)) return "Sin OP";
        if (errorResponsablesOP) return "No se pudo consultar el responsable";
        if (!responsablesPorOP) return "Consultando responsable…";
        const asignacion = responsablesPorOP[claveOP(orden)];
        return asignacion?.responsable_id == null ? "⚠ Por asignar" : asignacion.responsable_nombre;
    };

    const guardarResponsableOP = async (orden, responsableId, reconciliar = false, reservado = false) => {
        const op = claveOP(orden);
        if (!puedeAsignarOP || (!reservado && bloqueosOP.current.has(op))) throw new Error("Operación no permitida o ya en curso para esta OP.");
        bloqueosOP.current.add(op);
        ++versionResponsables.current;
        let incierto = incertidumbreOP.current.has(op);
        let escribiendo = false;
        setOperacionesResponsablePorOP(prev => ({ ...prev, [op]: { loading: true, incierto } }));
        try {
            // Siempre consultar antes de escribir. Un GET fallido NO resuelve un PUT incierto.
            const actual = await getResponsablePorOrden(op);
            incertidumbreOP.current.delete(op);
            setResponsablesPorOP(prev => ({ ...prev, [op]: actual }));
            const base = basesAsignacion.current[op];
            const cambioExterno = !base || firmaAsignacion(base) !== firmaAsignacion(actual);
            basesAsignacion.current[op] = actual;
            if (actual.responsable_id === responsableId) {
                setOperacionesResponsablePorOP(prev => ({ ...prev, [op]: {} }));
                return actual;
            }
            if (incierto || reconciliar || cambioExterno) {
                const nombreActual = actual.responsable_nombre || PERSONA_POR_ASIGNAR;
                if (!window.confirm(
                    (cambioExterno ? "La asignación cambió o no había podido verificarse. " : "Se consultó el estado real. ") +
                    "Responsable actual: " + nombreActual + ". ¿Confirmas que deseas cambiar la asignación de toda la OP?"
                )) {
                    const error = new Error("Estado actualizado. La asignación no se cambió; confirma de nuevo si deseas reasignar.");
                    error.local = true;
                    throw error;
                }
            }
            incierto = false;
            escribiendo = true;
            const data = await updateResponsablePorOrden(op, responsableId);
            basesAsignacion.current[op] = data;
            setResponsablesPorOP(prev => ({ ...prev, [op]: data }));
            setOperacionesResponsablePorOP(prev => ({ ...prev, [op]: {} }));
            return data;
        } catch (error) {
            const status = error.response?.status;
            if (escribiendo && (!status || status >= 500)) incertidumbreOP.current.add(op);
            const mensaje = error.local ? error.message : status === 401 || status === 403 ? "Tu sesión no permite consultar o cambiar el responsable."
                : status === 404 ? "No se encontró la OP, el responsable o el servicio. Actualiza el catálogo y vuelve a consultar."
                    : "No se pudo confirmar la asignación. Se consultará su estado antes de reintentar.";
            setOperacionesResponsablePorOP(prev => ({ ...prev, [op]: { error: mensaje, incierto: incertidumbreOP.current.has(op) } }));
            throw error;
        } finally {
            bloqueosOP.current.delete(op);
            setLoadingResponsablesOP(false);
        }
    };
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

    // Filtro por estado de movimiento (chips); "" significa "Todos"
    const [filtroMovimiento, setFiltroMovimiento] = useState("");

    // Buscador/combobox de OP: texto visible y estado de sugerencias (no es la fuente de verdad del filtro)
    const [opSearchText, setOpSearchText] = useState("");
    const [mostrarSugerenciasOP, setMostrarSugerenciasOP] = useState(false);
    const [indiceSugerenciaActiva, setIndiceSugerenciaActiva] = useState(-1);


    // OPs cerradas (no admiten nuevas solicitudes)
    const [ordenesCerradas, setOrdenesCerradas] = useState(new Set());

    // Modal: alternar candado (cerrar/abrir OP) desde la fila
    const [toggleModalOpen, setToggleModalOpen] = useState(false);
    const [toggleOrden, setToggleOrden] = useState("");
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
        estacion: "",
        orden_produccion: "",
        concepto_liberacion: ""
    });

    // --- Catálogo y combobox de responsables (Fase 2) ---
    const [listaResponsables, setListaResponsables] = useState([]);
    const [responsablesLoading, setResponsablesLoading] = useState(false);
    const [responsablesError, setResponsablesError] = useState(null);

    const [responsableTexto, setResponsableTexto] = useState("");
    const [responsableSeleccionado, setResponsableSeleccionado] = useState(null);
    const [mostrarSugerenciasResp, setMostrarSugerenciasResp] = useState(false);
    const [indiceSugerenciaResp, setIndiceSugerenciaResp] = useState(-1);

    // --- Pieza actual ---
    const [currentPart, setCurrentPart] = useState({
        numero_parte: "",
        descripcion: "",
        cantidad: 1
    });

    // --- Lista acumulada de piezas ---
    const [listaPiezas, setListaPiezas] = useState([]);
    const opFormularioAnterior = useRef(null);
    useEffect(() => {
        if (!drawerOpen || !puedeAsignarOP || guardandoSolicitud || asignacionPendiente) return;
        const op = claveOP(formHeader.orden_produccion);
        const cambioOP = opFormularioAnterior.current !== op;
        if (cambioOP) opFormularioAnterior.current = op;
        if (!responsablesPorOP || errorResponsablesOP) return;
        const actual = responsablesPorOP[op];
        if (cambioOP || (!seleccionOPModificada && !buscandoResponsable)) {
            basesAsignacion.current[op] = actual || { responsable_id: null, asignado_por: null, asignado_en: null };
        }
        if (seleccionOPModificada || buscandoResponsable) return;
        const seleccion = actual?.responsable_id != null
            ? { id: actual.responsable_id, nombre: actual.responsable_nombre }
            : opcionSinResponsable;
        setResponsableSeleccionado(seleccion);
        setResponsableTexto(seleccion.nombre);
    }, [drawerOpen, formHeader.orden_produccion, responsablesPorOP, errorResponsablesOP, puedeAsignarOP, seleccionOPModificada, buscandoResponsable, guardandoSolicitud, asignacionPendiente]);

    const cargarResponsables = async () => {
        setResponsablesLoading(true);
        setResponsablesError(null);
        try {
            const data = await getUsuariosAlmacen();
            setListaResponsables(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error al obtener usuarios_almacen:", err);
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                setResponsablesError(`No cuentas con permisos para consultar el catálogo de responsables (HTTP ${status}).`);
            } else {
                setResponsablesError("No se pudo cargar el catálogo de responsables. Revisa la conexión.");
            }
        } finally {
            setResponsablesLoading(false);
        }
    };

    const load = async () => {
        const [data, cerradas] = await Promise.all([
            listAlmacenMovimientos(),
            listOrdenesCerradas().catch(() => [])
        ]);
        setRows(data.map(r => ({ ...r, orden_produccion: claveOP(r.orden_produccion) })));

        // Obtener órdenes únicas
        const setOrdenes = Array.from(
            new Set(data.map(r => claveOP(r.orden_produccion)).filter(Boolean))
        );
        setOrdenesUnicas(setOrdenes);

        // Indexar OPs cerradas
        setOrdenesCerradas(
            new Set((cerradas || []).map(c => claveOP(c.orden_produccion)))
        );
    };

    // Helpers OP cerrada
    const esOrdenCerrada = (op) => ordenesCerradas.has(claveOP(op));
    const ordenesAbiertas = useMemo(
        () => ordenesUnicas.filter(op => !ordenesCerradas.has(claveOP(op))),
        [ordenesUnicas, ordenesCerradas]
    );

    const responsablesActivos = useMemo(() => {
        return listaResponsables.filter(u => u.activo !== 0 && u.activo !== false);
    }, [listaResponsables]);

    const sugerenciasResponsable = useMemo(() => {
        const opcionPorAsignar = {
            id: null,
            nombre: PERSONA_POR_ASIGNAR,
            esPorAsignar: true
        };

        const queryNorm = normalizarTexto(responsableTexto);
        const esSeleccionActual = responsableSeleccionado && normalizarTexto(responsableSeleccionado.nombre) === queryNorm;

        const filtrados = (queryNorm && !esSeleccionActual)
            ? responsablesActivos.filter(r => normalizarTexto(r.nombre).includes(queryNorm))
            : responsablesActivos;

        return [opcionPorAsignar, ...filtrados];
    }, [responsablesActivos, responsableTexto, responsableSeleccionado]);

    const seleccionarResponsable = (opcion) => {
        if (!opcion) return;
        setSeleccionOPModificada(true);
        setBuscandoResponsable(false);
        setResponsableSeleccionado(opcion);
        setResponsableTexto(opcion.nombre);
        setMostrarSugerenciasResp(false);
        setIndiceSugerenciaResp(-1);
    };

    const limpiarResponsable = () => {
        setBuscandoResponsable(true);
        setResponsableSeleccionado(null);
        setResponsableTexto("");
        setMostrarSugerenciasResp(false);
        setIndiceSugerenciaResp(-1);
    };

    const handleResponsableKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (sugerenciasResponsable.length === 0) return;
            setMostrarSugerenciasResp(true);
            setIndiceSugerenciaResp((prev) => (prev + 1) % sugerenciasResponsable.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (sugerenciasResponsable.length === 0) return;
            setMostrarSugerenciasResp(true);
            setIndiceSugerenciaResp((prev) => (prev - 1 + sugerenciasResponsable.length) % sugerenciasResponsable.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (mostrarSugerenciasResp && indiceSugerenciaResp >= 0 && sugerenciasResponsable[indiceSugerenciaResp]) {
                seleccionarResponsable(sugerenciasResponsable[indiceSugerenciaResp]);
            } else if (sugerenciasResponsable.length > 0 && mostrarSugerenciasResp) {
                const coincidencia = sugerenciasResponsable.find(
                    s => normalizarTexto(s.nombre) === normalizarTexto(responsableTexto)
                );
                if (coincidencia) {
                    seleccionarResponsable(coincidencia);
                }
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setMostrarSugerenciasResp(false);
            setIndiceSugerenciaResp(-1);
        }
    };

    const resetFormNuevaSolicitud = () => {
        setSeleccionOPModificada(false);
        setBuscandoResponsable(false);
        opFormularioAnterior.current = null;
        setResponsableSeleccionado(null);
        setResponsableTexto("");
        setMostrarSugerenciasResp(false);
        setIndiceSugerenciaResp(-1);
        setFormHeader({
            estacion: "",
            orden_produccion: "",
            concepto_liberacion: ""
        });
        setCurrentPart({
            numero_parte: "",
            descripcion: "",
            cantidad: 1
        });
        setListaPiezas([]);
        setSearch("");
        setProductos([]);
    };

    const cerrarDrawer = () => {
        if (envioSolicitud.current) return;
        if ((asignacionPendiente || resultadoSolicitud) && !window.confirm("Hay un resultado de guardado pendiente. ¿Cerrar y descartar este seguimiento local? Los movimientos guardados se conservan.")) return;
        setAsignacionPendiente(null);
        setResultadoSolicitud(null);
        setMovimientoIncierto(false);
        setSeleccionOPModificada(false);
        opFormularioAnterior.current = null;
        resetFormNuevaSolicitud();
        setDrawerOpen(false);
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
        cargarResponsables(); // carga inicial de responsables
        cargarAsignacionesOP();

        const interval = setInterval(() => {
            load(); // refresco cada 10s
            cargarAsignacionesOP();
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
        if (envioSolicitud.current || asignacionPendiente || movimientoIncierto) return;
        if (!responsableSeleccionado || normalizarTexto(responsableTexto) !== normalizarTexto(responsableSeleccionado.nombre)) {
            alert("Debes seleccionar un Responsable / Operador del catálogo o elegir 'Por asignar'.");
            return;
        }

        if (!formHeader.estacion || !formHeader.orden_produccion) {
            alert("Completa Persona, Estación y Orden.");
            return;
        }

        // 🚫 Bloqueo en cliente si la OP está cerrada
        const ordenIngresada = claveOP(formHeader.orden_produccion);
        if (!ordenIngresada || ordenIngresada.length > 50) {
            alert("Indica una OP de entre 1 y 50 caracteres.");
            return;
        }
        if (esOrdenCerrada(ordenIngresada)) {
            alert(`La Orden ${ordenIngresada} está cerrada. No se pueden registrar más movimientos.`);
            return;
        }

        if (listaPiezas.length === 0) {
            alert("Agrega al menos una pieza.");
            return;
        }

        const nombrePersona = responsableSeleccionado.esPorAsignar
            ? PERSONA_POR_ASIGNAR
            : responsableSeleccionado.nombre;

        if (bloqueosOP.current.has(ordenIngresada)) return;
        const responsableId = responsableSeleccionado.esPorAsignar ? null : responsableSeleccionado.id;
        const servicioDisponible = responsablesPorOP !== null && !errorResponsablesOP;
        const actual = responsablesPorOP?.[ordenIngresada]?.responsable_id ?? null;
        const cambiarAsignacion = puedeAsignarOP && seleccionOPModificada && (!servicioDisponible || actual !== responsableId);
        // Una OP nueva con selección explícita también requiere una asignación real.
        const opNueva = !rows.some(r => claveOP(r.orden_produccion) === ordenIngresada);
        const asignar = cambiarAsignacion || (puedeAsignarOP && opNueva && responsableId !== null);
        if (asignar && !opNueva && !window.confirm("La reasignación afectará a todos los movimientos de esta OP. ¿Continuar?")) return;
        envioSolicitud.current = true;
        bloqueosOP.current.add(ordenIngresada);
        ++versionResponsables.current;
        setGuardandoSolicitud(true);
        setResultadoSolicitud(null);
        let confirmados = 0;
        const piezas = [...listaPiezas];
        try {
            // El catálogo no condiciona la creación. El PUT valida el ID en backend.
            for (const pieza of piezas) {
                try {
                    await createAlmacenMovimiento({
                        persona: nombrePersona,
                        estacion: formHeader.estacion,
                        orden_produccion: ordenIngresada,
                        concepto_liberacion: formHeader.concepto_liberacion,
                        numero_parte: pieza.numero_parte,
                        descripcion: pieza.descripcion,
                        cantidad: pieza.cantidad
                    });
                    confirmados++;
                    setListaPiezas(piezas.slice(confirmados));
                } catch (error) {
                    const incierto = !error.response || error.response.status >= 500;
                    setMovimientoIncierto(incierto ? { pieza, op: ordenIngresada } : false);
                    if (incierto) setListaPiezas(piezas.slice(confirmados + 1));
                    setResultadoSolicitud(`${confirmados} movimientos confirmados de ${piezas.length}. No se cambió la asignación. ${incierto ? "El último envío tiene resultado desconocido; revisa Movimientos antes de resolver los pendientes. No vuelvas a enviarlo sin comprobarlo." : "Los pendientes permanecen en el formulario para reintento explícito."}`);
                    return;
                }
            }
            if (asignar) {
                const pendiente = { op: ordenIngresada, responsableId };
                setAsignacionPendiente(pendiente);
                try {
                    await guardarResponsableOP(ordenIngresada, responsableId, false, true);
                    setAsignacionPendiente(null);
                } catch (_) {
                    setResultadoSolicitud("Movimientos guardados; asignación pendiente de confirmar");
                    return;
                }
            }
            resetFormNuevaSolicitud();
            setDrawerOpen(false);
            setSeleccionOPModificada(false);
            opFormularioAnterior.current = null;
            alert(asignar ? "Movimientos y asignación guardados." : "Movimientos guardados. La asignación de OP no se modificó.");
        } catch (_) {
            setResultadoSolicitud(`${confirmados} movimientos confirmados. Revisa el resultado antes de continuar.`);
        } finally {
            bloqueosOP.current.delete(ordenIngresada);
            envioSolicitud.current = false;
            setGuardandoSolicitud(false);
            load();
            cargarAsignacionesOP();
        }
    };

    // ---- Atender movimiento (sin PIN, con identidad de useAuth) ----
    const handleAtender = async (movimiento) => {
        const atendio = user?.name || user?.email;
        if (!atendio) {
            alert("No se pudo determinar la identidad del usuario autenticado.");
            return;
        }

        try {
            await atenderAlmacenMovimiento(movimiento.id, atendio);
            await load();
            alert("Movimiento atendido correctamente.");
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.error || "Error al atender el movimiento.";
            alert(msg);
        }
    };

    // ---- Candado: alternar cerrar/abrir OP desde la fila ----
    const abrirToggleModal = (orden) => {
        const op = String(orden || "").trim();
        if (!op) return;
        setToggleOrden(op);
        setToggleProximoEstado(esOrdenCerrada(op) ? "ABIERTA" : "CERRADA");
        setToggleModalOpen(true);
    };

    const confirmarToggleOP = async () => {
        if (!toggleOrden) return;
        try {
            await toggleOrdenProduccion(toggleOrden);
            setToggleModalOpen(false);
            setToggleOrden("");
            await load();
        } catch (err) {
            const msg = err?.response?.data?.error || "No se pudo cambiar el estado de la OP.";
            alert(msg);
        }
    };

    // Mantener el texto visible del buscador sincronizado con la fuente de verdad del filtro
    useEffect(() => {
        setOpSearchText(filtroOrden ? formatearOP(filtroOrden) : "");
    }, [filtroOrden]);

    // Sugerencias limitadas, solo a partir de las OP ya cargadas en los movimientos y con texto de búsqueda
    const sugerenciasOP = useMemo(() => {
        const norm = normalizarOP(opSearchText);
        if (!norm) return [];
        return ordenesUnicas
            .filter((op) => normalizarOP(op).includes(norm))
            .slice(0, 8);
    }, [ordenesUnicas, opSearchText]);

    const aplicarFiltroOP = (valorCrudo) => {
        const norm = normalizarOP(valorCrudo);
        if (!norm) {
            setFiltroOrden("");
        } else {
            // Preferir el valor tal como está almacenado en ordenesUnicas, si existe
            const match = ordenesUnicas.find((op) => normalizarOP(op) === norm);
            setFiltroOrden(match || norm);
        }
        setMostrarSugerenciasOP(false);
        setIndiceSugerenciaActiva(-1);
        setPage(1);
    };

    const limpiarFiltroOP = () => {
        setFiltroOrden("");
        setMostrarSugerenciasOP(false);
        setIndiceSugerenciaActiva(-1);
        setPage(1);
    };

    // Chips de MOVIMIENTO: solo cambian filtroMovimiento, nunca filtroOrden
    const aplicarFiltroMovimiento = (valor) => {
        setFiltroMovimiento(valor);
        setPage(1);
    };

    // Clases del semáforo visual del select de Movimiento (solo presentación)
    const getMovimientoClasses = (estatus) => {
        switch (estatus) {
            case "SIN ENTREGAR":
                return "bg-red-50 text-red-800 border-red-300";
            case "ENTREGADO":
                return "bg-amber-50 text-amber-800 border-amber-300";
            case "CARGADO":
                return "bg-emerald-50 text-emerald-800 border-emerald-300";
            default:
                return "bg-white text-slate-700 border-slate-300";
        }
    };

    const handleOpSearchKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (sugerenciasOP.length === 0) return;
            setMostrarSugerenciasOP(true);
            setIndiceSugerenciaActiva((prev) => (prev + 1) % sugerenciasOP.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (sugerenciasOP.length === 0) return;
            setMostrarSugerenciasOP(true);
            setIndiceSugerenciaActiva((prev) => (prev - 1 + sugerenciasOP.length) % sugerenciasOP.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (mostrarSugerenciasOP && indiceSugerenciaActiva >= 0 && sugerenciasOP[indiceSugerenciaActiva]) {
                aplicarFiltroOP(sugerenciasOP[indiceSugerenciaActiva]);
            } else {
                aplicarFiltroOP(opSearchText);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setMostrarSugerenciasOP(false);
            setIndiceSugerenciaActiva(-1);
        }
    };

    const filtrados = rows.filter((r) => {
        const matchOrden = filtroOrden === "" ? true : r.orden_produccion === filtroOrden;
        const matchMovimiento = filtroMovimiento === "" ? true : r.estatus_movimiento === filtroMovimiento;
        return matchOrden && matchMovimiento;
    });

    const totalPages = Math.ceil(filtrados.length / pageSize);
    const paginated = filtrados.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="space-y-5">
            {errorResponsablesOP && <div className="p-3 bg-amber-50 text-amber-900 rounded" role="status">
                {errorResponsablesOP} Los movimientos siguen disponibles. No se cambiarán asignaciones.
                <button type="button" className="underline ml-2" disabled={loadingResponsablesOP} onClick={cargarAsignacionesOP}>Reintentar consulta</button>
            </div>}
            {editorOP && <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center" onClick={event => event.stopPropagation()}>
                <section role="dialog" aria-modal="true" aria-labelledby="titulo-responsable-op" className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4">
                    <h3 id="titulo-responsable-op" className="font-semibold">Responsable de OP {editorOP}</h3>
                    <p className="text-sm">El cambio afecta a todos los movimientos de esta OP. La persona histórica se conserva.</p>
                    <Autocomplete
                        options={[opcionSinResponsable, ...responsablesActivos]}
                        value={editorSeleccion}
                        getOptionLabel={option => option.nombre || ""}
                        getOptionKey={option => option.id ?? "sin-responsable"}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        onChange={(_event, value) => setEditorSeleccion(value)}
                        disabled={Boolean(operacionesResponsablePorOP[editorOP]?.loading)}
                        loading={responsablesLoading}
                        renderInput={params => <TextField {...params} label="Buscar responsable" />}
                    />
                    {responsablesError && <p className="text-sm text-red-700">{responsablesError} <button className="underline" onClick={cargarResponsables}>Actualizar catálogo</button></p>}
                    {errorResponsablesOP && <p className="text-sm text-red-700">{errorResponsablesOP}</p>}
                    {operacionesResponsablePorOP[editorOP]?.error && <p className="text-sm text-red-700" role="alert">{operacionesResponsablePorOP[editorOP].error}</p>}
                    <div className="flex gap-3">
                        <button className="btn" disabled={operacionesResponsablePorOP[editorOP]?.loading} onClick={() => setEditorOP(null)}>Cerrar</button>
                        <button className="btn btn-primary" disabled={!editorSeleccion || Boolean(errorResponsablesOP) || operacionesResponsablePorOP[editorOP]?.loading ||
                            (editorSeleccion.id === (responsablesPorOP?.[editorOP]?.responsable_id ?? null) && !operacionesResponsablePorOP[editorOP]?.incierto)}
                            onClick={async () => {
                                const op = editorOP;
                                try {
                                    await guardarResponsableOP(op, editorSeleccion.id, operacionesResponsablePorOP[op]?.incierto);
                                    setEditorOP(null);
                                    cargarAsignacionesOP();
                                } catch (_) { /* El error se muestra por OP. */ }
                            }}>Guardar para toda la OP</button>
                    </div>
                </section>
            </div>}

            <div className="space-y-3">

                {/* FILA 1: título + buscador + acciones de administración */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Solicitudes de Almacén</h2>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">

                        <div className="relative w-56">
                            <label htmlFor="op-search-input" className="sr-only">
                                Buscar o escanear OP
                            </label>
                            <div className="relative">
                                <input
                                    id="op-search-input"
                                    type="text"
                                    role="combobox"
                                    aria-expanded={mostrarSugerenciasOP && sugerenciasOP.length > 0}
                                    aria-controls="op-search-listbox"
                                    aria-autocomplete="list"
                                    autoComplete="off"
                                    autoFocus
                                    className="input w-full pr-8"
                                    placeholder="Buscar o escanear OP"
                                    value={opSearchText}
                                    onChange={(e) => {
                                        setOpSearchText(e.target.value);
                                        setMostrarSugerenciasOP(true);
                                        setIndiceSugerenciaActiva(-1);
                                    }}
                                    onFocus={() => {
                                        if (opSearchText.trim() !== "") setMostrarSugerenciasOP(true);
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => setMostrarSugerenciasOP(false), 100);
                                    }}
                                    onKeyDown={handleOpSearchKeyDown}
                                />
                                {(opSearchText || filtroOrden) && (
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={limpiarFiltroOP}
                                        className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-700"
                                        title="Limpiar búsqueda de OP"
                                        aria-label="Limpiar búsqueda de OP"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {mostrarSugerenciasOP && sugerenciasOP.length > 0 && (
                                <ul
                                    id="op-search-listbox"
                                    role="listbox"
                                    className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg text-sm"
                                >
                                    {sugerenciasOP.map((op, idx) => (
                                        <li
                                            key={op}
                                            role="option"
                                            aria-selected={idx === indiceSugerenciaActiva}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => aplicarFiltroOP(op)}
                                            className={`px-3 py-2 cursor-pointer ${
                                                idx === indiceSugerenciaActiva
                                                    ? "bg-blue-50 text-blue-700"
                                                    : "hover:bg-slate-50 text-slate-700"
                                            }`}
                                        >
                                            {formatearOP(op)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {role === "admin" && (
                            <button
                                className="btn"
                                onClick={() => navigate("/almacen/usuarios")}
                            >
                                Usuarios
                            </button>
                        )}

                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                if (listaResponsables.length === 0 && !responsablesLoading) {
                                    cargarResponsables();
                                }
                                setDrawerOpen(true);
                            }}
                        >
                            Nueva solicitud
                        </button>


                    </div>
                </div>

                {/* FILA 2: filtros de movimiento */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <p className="text-sm text-slate-500">Gestión de movimientos y entregas</p>

                    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtrar por movimiento">
                        <button
                            type="button"
                            onClick={() => aplicarFiltroMovimiento("")}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filtroMovimiento === ""
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => aplicarFiltroMovimiento("SIN ENTREGAR")}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filtroMovimiento === "SIN ENTREGAR"
                                ? "bg-red-600 text-white border-red-600"
                                : "bg-red-50 text-red-700 border-red-300 hover:bg-red-100"
                                }`}
                        >
                            🔴 Sin entregar
                        </button>
                        <button
                            type="button"
                            onClick={() => aplicarFiltroMovimiento("ENTREGADO")}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filtroMovimiento === "ENTREGADO"
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                                }`}
                        >
                            🟡 Entregado
                        </button>
                        <button
                            type="button"
                            onClick={() => aplicarFiltroMovimiento("CARGADO")}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filtroMovimiento === "CARGADO"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                }`}
                        >
                            🟢 Cargado (SAI)
                        </button>
                    </div>
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
                            &middot; Haz clic en el candado para alternar
                        </span>
                    )}
                </div>

                <div className="overflow-hidden">

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3 text-left">ID</th>
                                <th className="px-4 py-3 text-left">Responsable de OP</th>
                                <th className="px-4 py-3 text-left">Orden</th>
                                <th className="px-4 py-3 text-left">N° Parte</th>
                                <th className="px-4 py-3 text-center">Cant</th>
                                <th className="px-4 py-3 text-center">Estatus</th>
                                <th className="px-4 py-3 text-center">
                                    {(role === "admin" || role === "almacen" || role === "solicitante") && "Movimiento"}
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
                                        <div className="font-semibold text-slate-800">{textoResponsableOP(r.orden_produccion)}</div>
                                        <div className="text-xs text-slate-400">Estación {r.estacion}</div>
                                        {puedeAsignarOP && claveOP(r.orden_produccion) && (
                                            <button type="button" className="text-xs text-blue-700 underline disabled:opacity-50"
                                                disabled={!responsablesPorOP || Boolean(errorResponsablesOP) || operacionesResponsablePorOP[claveOP(r.orden_produccion)]?.loading || guardandoSolicitud}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    const op = claveOP(r.orden_produccion);
                                                    const actual = responsablesPorOP?.[op];
                                                    basesAsignacion.current[op] = actual || { responsable_id: null, asignado_por: null, asignado_en: null };
                                                    setEditorSeleccion(actual?.responsable_id != null ? { id: actual.responsable_id, nombre: actual.responsable_nombre } : opcionSinResponsable);
                                                    setEditorOP(op);
                                                    cargarResponsables();
                                                }}>
                                                {operacionesResponsablePorOP[claveOP(r.orden_produccion)]?.loading ? "Guardando…" : "Cambiar"}
                                            </button>
                                        )}
                                        {operacionesResponsablePorOP[claveOP(r.orden_produccion)]?.error && <p className="text-xs text-red-700">{operacionesResponsablePorOP[claveOP(r.orden_produccion)].error}</p>}
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
                                        {(role === "admin" || role === "almacen" || role === "solicitante") && (
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
                                                    className={`border rounded-lg px-2 py-1 text-xs font-semibold ${getMovimientoClasses(r.estatus_movimiento)}`}
                                                    value={r.estatus_movimiento}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const nuevo = e.target.value;
                                                        const anterior = r.estatus_movimiento;

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
                                                    const puedeAlternar = role === "admin" || role === "almacen";

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
                                                            handleAtender(r);
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
                        onClick={cerrarDrawer}
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
                                onClick={cerrarDrawer}
                            >
                                Cerrar
                            </button>
                        </div>

                        {/* CONTENIDO */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                            <div className="text-sm bg-slate-50 p-3 rounded" aria-live="polite">
                                Responsable actual de la OP: {textoResponsableOP(formHeader.orden_produccion)}
                                <p>{puedeAsignarOP && !errorResponsablesOP && responsablesPorOP
                                    ? "Una selección diferente cambiará el responsable de toda la OP después de guardar las piezas."
                                    : "La selección de persona solo se registra en los movimientos; no modifica la asignación de OP."}</p>
                            </div>
                            {resultadoSolicitud && <div role="status" className="p-3 bg-amber-50 text-amber-900 rounded">
                                <p>{resultadoSolicitud}</p>
                                {movimientoIncierto && <div className="mt-2 space-y-2 border border-amber-400 p-3">
                                    <p>Resultado desconocido, separado de las piezas pendientes: OP {movimientoIncierto.op}, pieza {movimientoIncierto.pieza.numero_parte}, cantidad {movimientoIncierto.pieza.cantidad}.</p>
                                    <p>Revisa en Movimientos antes de decidir. No se reenviará automáticamente.</p>
                                    <button type="button" className="btn" onClick={() => {
                                        if (window.confirm("¿Confirmaste que esta pieza sí quedó guardada en el servidor?")) setMovimientoIncierto(false);
                                    }}>Confirmé que se guardó</button>
                                    <button type="button" className="btn ml-2" onClick={() => {
                                        if (window.confirm("¿Confirmaste que NO se guardó? Si sí se guardó, reenviarla duplicará el movimiento.")) {
                                            setListaPiezas(prev => [movimientoIncierto.pieza, ...prev]);
                                            setMovimientoIncierto(false);
                                        }
                                    }}>Confirmé que no se guardó; pasar a pendientes</button>
                                </div>}
                            </div>}
                            {asignacionPendiente && <div className="p-3 border rounded space-y-2">
                                <p>OP {asignacionPendiente.op}: reintentar solamente la asignación. Las piezas ya están guardadas.</p>
                                <Autocomplete options={[opcionSinResponsable, ...responsablesActivos]}
                                    value={[opcionSinResponsable, ...listaResponsables].find(u => u.id === asignacionPendiente.responsableId) || null}
                                    getOptionLabel={option => option.nombre || ""}
                                    getOptionKey={option => option.id ?? "sin-responsable"}
                                    isOptionEqualToValue={(a, b) => a.id === b.id}
                                    disabled={guardandoSolicitud}
                                    onChange={(_event, value) => { if (value) setAsignacionPendiente(prev => ({ ...prev, responsableId: value.id })); }}
                                    renderInput={params => <TextField {...params} label="Responsable pendiente" />} />
                                <button className="btn" onClick={cargarResponsables}>Actualizar catálogo</button>
                                {operacionesResponsablePorOP[asignacionPendiente.op]?.error && <p className="text-red-700">{operacionesResponsablePorOP[asignacionPendiente.op].error}</p>}
                                <button className="btn btn-primary" disabled={guardandoSolicitud || Boolean(errorResponsablesOP)} onClick={async () => {
                                    if (envioSolicitud.current) return;
                                    envioSolicitud.current = true;
                                    setGuardandoSolicitud(true);
                                    try {
                                        await guardarResponsableOP(asignacionPendiente.op, asignacionPendiente.responsableId, true);
                                        setAsignacionPendiente(null);
                                        setResultadoSolicitud("Movimientos y asignación confirmados.");
                                        cargarAsignacionesOP();
                                    } catch (_) { /* No reenviar movimientos. */ }
                                    finally { envioSolicitud.current = false; setGuardandoSolicitud(false); }
                                }}>Consultar y reintentar solo asignación</button>
                            </div>}
                            <fieldset disabled={guardandoSolicitud || Boolean(asignacionPendiente)} className="space-y-6">

                            {/* ----------- DATOS GENERALES ----------- */}
                            <div className="card space-y-4">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Datos Generales
                                </h4>

                                {/* RESPONSABLE / OPERADOR (COMBOBOX) */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                                            {puedeAsignarOP && !errorResponsablesOP && responsablesPorOP ? "Responsable de OP / Persona registrada" : "Persona registrada en el movimiento"}
                                        </label>
                                        {responsablesLoading && (
                                            <span className="text-[11px] text-slate-400">Cargando catálogo…</span>
                                        )}
                                    </div>

                                    {/* Si hay error al cargar responsables */}
                                    {responsablesError ? (
                                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                                            <p>{responsablesError}</p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={cargarResponsables}
                                                    className="btn text-xs px-2.5 py-1 bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                                                >
                                                    Reintentar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => seleccionarResponsable({ id: null, nombre: PERSONA_POR_ASIGNAR, esPorAsignar: true })}
                                                    className="text-xs font-medium text-amber-700 underline hover:text-amber-900 ml-1"
                                                >
                                                    Usar "{PERSONA_POR_ASIGNAR}"
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <input
                                                type="text"
                                                role="combobox"
                                                aria-expanded={mostrarSugerenciasResp && sugerenciasResponsable.length > 0}
                                                aria-autocomplete="list"
                                                autoComplete="off"
                                                disabled={responsablesLoading}
                                                className={`input w-full pr-8 ${
                                                    responsableSeleccionado?.esPorAsignar
                                                        ? "border-amber-300 bg-amber-50/40 text-amber-900 font-medium"
                                                        : responsableSeleccionado
                                                        ? "border-emerald-300 bg-emerald-50/20 text-slate-900 font-medium"
                                                        : ""
                                                }`}
                                                placeholder="Buscar responsable u operador…"
                                                value={responsableTexto}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setBuscandoResponsable(true);
                                                    setResponsableTexto(val);
                                                    setMostrarSugerenciasResp(true);
                                                    setIndiceSugerenciaResp(-1);
                                                    if (responsableSeleccionado && val !== responsableSeleccionado.nombre) {
                                                        setResponsableSeleccionado(null);
                                                    }
                                                }}
                                                onFocus={() => {
                                                    setMostrarSugerenciasResp(true);
                                                }}
                                                onBlur={() => {
                                                    setTimeout(() => {
                                                        setMostrarSugerenciasResp(false);
                                                    }, 150);
                                                }}
                                                onKeyDown={handleResponsableKeyDown}
                                            />

                                            {responsableTexto && (
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={limpiarResponsable}
                                                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-700 text-lg leading-none"
                                                    title="Limpiar selección"
                                                    aria-label="Limpiar selección"
                                                >
                                                    ×
                                                </button>
                                            )}

                                            {/* Panel de sugerencias */}
                                            {mostrarSugerenciasResp && sugerenciasResponsable.length > 0 && (
                                                <ul
                                                    role="listbox"
                                                    className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl text-sm divide-y divide-slate-100"
                                                >
                                                    {sugerenciasResponsable.map((opt, idx) => {
                                                        const esActivo = idx === indiceSugerenciaResp;
                                                        const esSeleccionado = responsableSeleccionado != null && responsableSeleccionado.id === opt.id;

                                                        if (opt.esPorAsignar) {
                                                            return (
                                                                <li
                                                                    key="__por_asignar__"
                                                                    role="option"
                                                                    aria-selected={esSeleccionado}
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                    onClick={() => seleccionarResponsable(opt)}
                                                                    className={`px-3 py-2.5 cursor-pointer font-medium flex items-center gap-2 transition-colors ${
                                                                        esActivo
                                                                            ? "bg-amber-100 text-amber-900"
                                                                            : "bg-amber-50/70 text-amber-800 hover:bg-amber-100/80"
                                                                    }`}
                                                                >
                                                                    <span className="text-amber-600 font-bold">⚠</span>
                                                                    <span>{PERSONA_POR_ASIGNAR}</span>
                                                                    <span className="text-[11px] text-amber-600 font-normal ml-auto">
                                                                        (Definir más tarde)
                                                                    </span>
                                                                </li>
                                                            );
                                                        }

                                                        return (
                                                            <li
                                                                key={opt.id}
                                                                role="option"
                                                                aria-selected={esSeleccionado}
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={() => seleccionarResponsable(opt)}
                                                                className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                                                                    esActivo
                                                                        ? "bg-blue-50 text-blue-700"
                                                                        : "hover:bg-slate-50 text-slate-700"
                                                                } ${esSeleccionado ? "font-semibold" : ""}`}
                                                            >
                                                                <span>{opt.nombre}</span>
                                                                {opt.rol && (
                                                                    <span className="text-[11px] text-slate-400">
                                                                        {opt.rol}
                                                                    </span>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    )}

                                    {/* Mensaje de estado de selección */}
                                    <div className="mt-1">
                                        {responsableSeleccionado?.esPorAsignar ? (
                                            <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                                                <span>⚠</span> Persona registrada: Por asignar.
                                            </p>
                                        ) : responsableSeleccionado ? (
                                            <p className="text-xs text-emerald-600 flex items-center gap-1">
                                                Persona registrada: <strong>{responsableSeleccionado.nombre}</strong>
                                            </p>
                                        ) : (
                                            <p className="text-[11px] text-slate-400">
                                                Selecciona del catálogo o elige <em>"⚠ {PERSONA_POR_ASIGNAR}"</em>.
                                            </p>
                                        )}
                                    </div>
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
                                    disabled={guardandoSolicitud || Boolean(asignacionPendiente) || movimientoIncierto}
                                    className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
                                >
                                    <span>{guardandoSolicitud ? "Guardando…" : "Guardar Solicitud"}</span>
                                    {listaPiezas.length > 0 && (
                                        <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                                            {listaPiezas.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            </fieldset>
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
                                <span className="font-semibold text-slate-500">Persona registrada en el movimiento: </span>
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
                                ¿{toggleProximoEstado === "CERRADA" ? "Cerrar" : "Reabrir"} {formatearOP(toggleOrden)}?
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                {toggleProximoEstado === "CERRADA"
                                    ? <>Todos los movimientos están cargados.<br />La orden dejará de aceptar nuevos registros.</>
                                    : "La orden volverá a aceptar movimientos."}
                            </p>
                        </div>

                        <div className="flex justify-between mt-2 gap-3">
                            <button
                                className="btn flex-1"
                                onClick={() => {
                                    setToggleModalOpen(false);
                                }}
                            >
                                Cancelar
                            </button>

                            <button
                                className={`btn flex-1 ${toggleProximoEstado === "CERRADA" ? "btn-danger" : "btn-primary"}`}
                                onClick={confirmarToggleOP}
                            >
                                {toggleProximoEstado === "CERRADA" ? "Cerrar OP" : "Reabrir OP"}
                            </button>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
}
