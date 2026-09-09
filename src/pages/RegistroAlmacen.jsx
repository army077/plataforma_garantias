// src/pages/RegistroAlmacen.jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createAlmacenMovimiento, listAlmacenMovimientos } from "../lib/api.js";
import { useAuth } from "../auth/AuthProvider.jsx";

// Normaliza valores como "OP3889", "op3889" o "3889" al formato puro del backend: "3889"
function normalizarOrdenProduccion(value) {
  if (!value) return "";
  return String(value).trim().replace(/^OP/i, "").trim();
}

// Formatea cualquier valor de OP para que en la interfaz siempre se visualice con el prefijo "OP" (ej. "OP3889")
function formatearOpVisual(value) {
  const norm = normalizarOrdenProduccion(value);
  return norm ? `OP${norm}` : "";
}

export default function RegistroAlmacen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Estados locales principales
  const [opActiva, setOpActiva] = useState("");
  const [historialEscaneos, setHistorialEscaneos] = useState([]);
  const [inputCode, setInputCode] = useState("");
  const [toast, setToast] = useState(null); // { id, message, type: 'success'|'warning'|'error'|'info' }

  // Estados para flujo de cantidad y pieza pendiente
  const [piezaPendiente, setPiezaPendiente] = useState("");
  const [cantidadInput, setCantidadInput] = useState("1");

  // Caché local (no persistente) de OPs marcadas como cerradas por el backend (409 OP_CERRADA)
  const [opsCerradas, setOpsCerradas] = useState(() => new Set());

  const inputRef = useRef(null);
  const cantidadInputRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Mantener el foco continuo en el campo del escáner al montar
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Consulta React Query para obtener movimientos reales de Almacén
  const {
    data: movimientosBackend = [],
    isLoading: isLoadingMovimientos,
    isFetching: isFetchingMovimientos,
    refetch: refetchMovimientos,
  } = useQuery({
    queryKey: ["almacen_movimientos"],
    queryFn: listAlmacenMovimientos,
    enabled: Boolean(opActiva),
    staleTime: 1000 * 5, // 5 segundos
  });

  // Al existir una pieza pendiente, enfocar automáticamente el input de cantidad y seleccionar el texto
  useEffect(() => {
    if (piezaPendiente && cantidadInputRef.current) {
      cantidadInputRef.current.focus();
      cantidadInputRef.current.select();
    }
  }, [piezaPendiente]);

  // Notificaciones discretas tipo Toast
  const showToast = (message, type = "info") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    const toastId = Date.now();
    setToast({ id: toastId, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((curr) => (curr?.id === toastId ? null : curr));
    }, 3500);
  };

  // Mutación en segundo plano usando createAlmacenMovimiento (POST /almacen/crear)
  const mutation = useMutation({
    mutationFn: ({ payloadBackend }) => createAlmacenMovimiento(payloadBackend),
    onSuccess: (data, variables) => {
      const { _localId, opVisual, pieza, cantidad, payloadBackend } = variables;

      // 1. Incorporar el nuevo movimiento devuelto al caché de React Query
      queryClient.setQueryData(["almacen_movimientos"], (old = []) => {
        const nuevo = {
          id: data && data.id ? data.id : `temp-${_localId}`,
          orden_produccion: payloadBackend.orden_produccion,
          numero_parte: payloadBackend.numero_parte,
          cantidad: payloadBackend.cantidad,
          persona: payloadBackend.persona,
          estacion: payloadBackend.estacion,
          created_at: new Date().toISOString(),
          ...(typeof data === "object" ? data : {}),
        };
        return [nuevo, ...old];
      });

      // 2. Marcar el registro local como 'completado' para retirar el estado optimista 'enviando'
      setHistorialEscaneos((prev) =>
        prev.map((item) =>
          item.id === _localId
            ? { ...item, status: "completado" }
            : item
        )
      );

      // 3. Sincronizar de forma definitiva con el backend en segundo plano
      queryClient.invalidateQueries({ queryKey: ["almacen_movimientos"] });

      showToast(
        `Pieza ${pieza} (x${cantidad}) registrada en ${opVisual}`,
        "success"
      );
    },
    onError: (err, variables) => {
      const { _localId, pieza, opVisual, payloadBackend } = variables;
      const isOpCerrada =
        err?.response?.status === 409 && err?.response?.data?.codigo === "OP_CERRADA";

      const errMsg = isOpCerrada
        ? `La ${opVisual} está cerrada y ya no admite nuevos movimientos.`
        : err?.response?.data?.message || err?.message || "Error al registrar en servidor";

      setHistorialEscaneos((prev) =>
        prev.map((item) =>
          item.id === _localId
            ? { ...item, status: "error", errorMsg: errMsg }
            : item
        )
      );

      if (isOpCerrada) {
        const opPura = normalizarOrdenProduccion(payloadBackend.orden_produccion);
        setOpsCerradas((prev) => new Set(prev).add(opPura));
        showToast(errMsg, "error");
      } else {
        showToast(`Fallo al enviar ${pieza}: ${errMsg}`, "error");
      }
    },
  });

  // Procesamiento de lectura de escáner
  const procesarCodigo = (raw) => {
    const code = raw.trim();
    if (!code) return;

    const ahora = new Date();

    // 1. Detección de Orden de Producción (comienza con "OP", case-insensitive)
    if (code.toUpperCase().startsWith("OP")) {
      const opLimpia = normalizarOrdenProduccion(code);
      const opVisual = `OP${opLimpia}`;

      setOpActiva(opVisual);
      setPiezaPendiente("");
      setCantidadInput("1");

      const nuevoRegistro = {
        id: crypto.randomUUID ? crypto.randomUUID() : `scan-${Date.now()}-${Math.random()}`,
        codigo: opVisual,
        tipo: "OP",
        op: opLimpia,
        timestamp: ahora,
        status: "completado",
      };

      setHistorialEscaneos((prev) => [nuevoRegistro, ...prev]);
      showToast(`OP Activa establecida: ${opVisual}`, "info");
      return;
    }

    // 2. Si es una pieza, validar que exista una OP activa
    if (!opActiva) {
      showToast("⚠️ Primero debes escanear una Orden de Producción (ej. OP3889)", "warning");
      const registroInvalido = {
        id: crypto.randomUUID ? crypto.randomUUID() : `scan-${Date.now()}-${Math.random()}`,
        codigo: code.toUpperCase(),
        tipo: "PIEZA",
        op: "SIN_OP",
        cantidad: 0,
        timestamp: ahora,
        status: "error",
        errorMsg: "Falta OP Activa",
      };
      setHistorialEscaneos((prev) => [registroInvalido, ...prev]);
      return;
    }

    // 3. Bloquear captura de piezas si la OP activa ya fue reportada como cerrada (409 OP_CERRADA)
    if (opsCerradas.has(normalizarOrdenProduccion(opActiva))) {
      showToast(`La ${formatearOpVisual(opActiva)} está cerrada y ya no admite nuevos movimientos.`, "warning");
      return;
    }

    // 4. Dejar pieza como piezaPendiente para capturar cantidad
    const piezaNormalizada = code.toUpperCase();
    setPiezaPendiente(piezaNormalizada);
    setCantidadInput("1");
    // El useEffect se encargará de mover el foco al input de cantidad y seleccionar el '1'
  };

  // Confirmar el registro de la pieza con su cantidad
  const confirmarRegistroPieza = () => {
    if (!piezaPendiente) return;

    // Defensa adicional: si la OP se marcó como cerrada mientras la pieza estaba pendiente
    if (opsCerradas.has(normalizarOrdenProduccion(opActiva))) {
      showToast(`La ${formatearOpVisual(opActiva)} está cerrada y ya no admite nuevos movimientos.`, "warning");
      cancelarPiezaPendiente();
      return;
    }

    const cantNum = parseInt(cantidadInput, 10);
    if (isNaN(cantNum) || cantNum <= 0) {
      showToast("La cantidad debe ser un número entero mayor a 0", "warning");
      cantidadInputRef.current?.focus();
      cantidadInputRef.current?.select();
      return;
    }

    const localId = crypto.randomUUID ? crypto.randomUUID() : `scan-${Date.now()}-${Math.random()}`;
    const ahora = new Date();
    const piezaARegistrar = piezaPendiente;
    const opPura = normalizarOrdenProduccion(opActiva); // "3889" para el backend

    // Agregado optimista al historial de la sesión
    const nuevoRegistro = {
      id: localId,
      codigo: piezaARegistrar,
      tipo: "PIEZA",
      op: opPura,
      cantidad: cantNum,
      timestamp: ahora,
      status: "enviando",
    };

    setHistorialEscaneos((prev) => [nuevoRegistro, ...prev]);

    // Disparar mutación en segundo plano enviando el payload requerido a createAlmacenMovimiento
    mutation.mutate({
      _localId: localId,
      opVisual: formatearOpVisual(opActiva),
      pieza: piezaARegistrar,
      cantidad: cantNum,
      payloadBackend: {
        persona: user?.name || user?.email || "Operador Escáner",
        estacion: "ALMACEN_SCANNER",
        orden_produccion: opPura,
        numero_parte: piezaARegistrar,
        descripcion: "",
        cantidad: cantNum,
        concepto_liberacion: "ESCANEO RÁPIDO",
      },
    });

    // Limpiar estado pendiente y devolver foco inmediatamente al escáner
    setPiezaPendiente("");
    setCantidadInput("1");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  // Cancelar la captura de la pieza pendiente
  const cancelarPiezaPendiente = () => {
    if (piezaPendiente) {
      showToast(`Cancelada captura de ${piezaPendiente}`, "info");
    }
    setPiezaPendiente("");
    setCantidadInput("1");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  // Manejador del evento KeyDown en el escáner (Enter)
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputCode;
      setInputCode("");
      procesarCodigo(val);
    } else if (e.key === "Escape" && piezaPendiente) {
      e.preventDefault();
      cancelarPiezaPendiente();
    }
  };

  // Manejador del evento KeyDown en el campo de cantidad (Enter para confirmar, Escape para cancelar)
  const handleCantidadKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmarRegistroPieza();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelarPiezaPendiente();
    }
  };

  // Limpiar sesión de escaneos
  const handleLimpiarSesion = () => {
    if (confirm("¿Deseas deseleccionar la OP activa y reiniciar la sesión de escaneo?")) {
      setHistorialEscaneos([]);
      setOpActiva("");
      setPiezaPendiente("");
      setCantidadInput("1");
      setOpsCerradas(new Set()); // descartar caché local: el backend vuelve a ser la autoridad
      showToast("Sesión de escaneo reiniciada", "info");
      inputRef.current?.focus();
    }
  };

  // ─── CONSTRUCCIÓN DE LA TARJETA VIVA DE LA OP ACTIVA (HISTÓRICO REAL + OPTIMISTA) ───
  const tarjetaOpActiva = useMemo(() => {
    if (!opActiva) return null;

    // Normalizar la OP activa actual (ej. "OP3889" -> "3889")
    const opNormalizada = normalizarOrdenProduccion(opActiva);

    // 1. Filtrar movimientos históricos de esta OP comparando valores normalizados
    const movimientosHistoricos = (movimientosBackend || []).filter(
      (m) => normalizarOrdenProduccion(m.orden_produccion) === opNormalizada
    );

    const piezasMap = {};
    let totalUnidadesHistoricas = 0;
    let ultimaActividad = null;

    // 2. Acumular registros históricos reales devueltos por el backend
    movimientosHistoricos.forEach((mov) => {
      const sku = (mov.numero_parte || mov.pieza || "S/N").trim().toUpperCase();
      const cant = Number(mov.cantidad) || 0;
      totalUnidadesHistoricas += cant;

      const statusReal = mov.status || mov.estatus_movimiento || "REGISTRADO";

      if (!piezasMap[sku]) {
        piezasMap[sku] = {
          numeroParte: sku,
          cantidad: 0,
          ultimoStatus: statusReal,
          ultimaHora: mov.created_at || mov.fecha || null,
          esOptimista: false,
        };
      }

      piezasMap[sku].cantidad += cant;
      if (mov.created_at) {
        const d = new Date(mov.created_at);
        if (!piezasMap[sku].ultimaHora || d > new Date(piezasMap[sku].ultimaHora)) {
          piezasMap[sku].ultimaHora = mov.created_at;
          piezasMap[sku].ultimoStatus = statusReal;
        }
        if (!ultimaActividad || d > ultimaActividad) {
          ultimaActividad = d;
        }
      }
    });

    // 3. Integrar registros optimistas en vuelo ('enviando') de la sesión actual
    historialEscaneos.forEach((scan) => {
      if (
        scan.tipo === "PIEZA" &&
        normalizarOrdenProduccion(scan.op) === opNormalizada &&
        scan.status === "enviando"
      ) {
        const sku = (scan.codigo || "S/N").trim().toUpperCase();
        const cant = Number(scan.cantidad) || 1;
        totalUnidadesHistoricas += cant;

        if (!piezasMap[sku]) {
          piezasMap[sku] = {
            numeroParte: sku,
            cantidad: 0,
            ultimoStatus: "enviando",
            ultimaHora: scan.timestamp,
            esOptimista: true,
          };
        }

        piezasMap[sku].cantidad += cant;
        piezasMap[sku].ultimoStatus = "enviando";

        if (!ultimaActividad || scan.timestamp > ultimaActividad) {
          ultimaActividad = scan.timestamp;
        }
      }
    });

    const piezas = Object.values(piezasMap).sort((a, b) => b.cantidad - a.cantidad);

    return {
      op: `OP${opNormalizada}`, // En la UI siempre mostramos "OP3889"
      opBackend: opNormalizada,  // Clave limpia "3889" para el backend
      totalPiezas: totalUnidadesHistoricas,
      piezas,
      totalMovimientos: movimientosHistoricos.length,
      ultimaActividad: ultimaActividad || null,
    };
  }, [opActiva, movimientosBackend, historialEscaneos]);

  // Total de unidades históricas de la OP activa para el panel superior
  const totalUnidadesOpActiva = tarjetaOpActiva ? tarjetaOpActiva.totalPiezas : 0;
  const totalSkusOpActiva = tarjetaOpActiva ? tarjetaOpActiva.piezas.length : 0;

  // OP activa marcada como cerrada por el backend (409 OP_CERRADA) en esta sesión
  const opCerrada = Boolean(opActiva) && opsCerradas.has(normalizarOrdenProduccion(opActiva));

  return (
    <div className="space-y-6">
      {/* ─── PANEL SUPERIOR INDUSTRIAL OSCURO ─── */}
      <div className="bg-slate-950 border border-slate-800 text-slate-100 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow de acento industrial */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Encabezado y Estado del Lector */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5v3.75m0 7.5v3.75m16.5-15v3.75m0 7.5v3.75M7.5 7.5v9m3-9v9m3-9v9m3-9v9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12h19.5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Panel de Captura de Almacén</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ESCÁNER LISTO
                </span>
                {isFetchingMovimientos && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-950 text-blue-300 border border-blue-800 animate-pulse">
                    Sincronizando...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Captura de alta velocidad para códigos de barras USB/Bluetooth o teclado continuo</p>
            </div>
          </div>

          {/* Botones de acción rápida */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (piezaPendiente) {
                  cantidadInputRef.current?.focus();
                  cantidadInputRef.current?.select();
                } else {
                  inputRef.current?.focus();
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Asegurar foco en el lector"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              {piezaPendiente ? "Foco Cantidad" : "Foco Escáner"}
            </button>
            <button
              onClick={handleLimpiarSesion}
              disabled={!opActiva && !piezaPendiente}
              className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-medium border border-red-800/60 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Deseleccionar OP y limpiar sesión"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Reiniciar Sesión
            </button>
          </div>
        </div>

        {/* Sección de Estado OP y Resumen de Sesión */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Card OP Activa */}
          <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Orden de Producción Activa</span>
              <div className="flex items-center gap-3 mt-1">
                {opActiva ? (
                  <div className="flex items-center gap-2">
                    <span className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-2xl font-black tracking-wider">
                      {formatearOpVisual(opActiva)}
                    </span>
                    {opCerrada ? (
                      <span className="text-xs text-red-400 font-medium bg-red-950/80 border border-red-800/80 px-2 py-0.5 rounded">
                        OP CERRADA
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400 font-medium bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                        Enlazando piezas
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-sm font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                      NINGUNA OP ACTIVA
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      (Escanea un código que empiece con "OP" para activarla)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {opActiva && (
              <button
                onClick={() => {
                  setOpActiva("");
                  setPiezaPendiente("");
                  setCantidadInput("1");
                  showToast("OP deseleccionada", "info");
                  inputRef.current?.focus();
                }}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Cambiar OP
              </button>
            )}
          </div>

          {/* Estadísticas históricas de la OP activa */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-around">
            <div className="text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Unidades OP</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                {opActiva ? totalUnidadesOpActiva : "—"}
              </p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">SKUs Distintos</span>
              <p className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
                {opActiva ? totalSkusOpActiva : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* ─── BANNER VISUAL DE PIEZA PENDIENTE ─── */}
        {piezaPendiente && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/20 border-2 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-amber-300">Pieza pendiente:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 font-mono text-base font-extrabold text-amber-300 border border-amber-500/40">
                  {piezaPendiente}
                </span>
              </div>
              <span className="text-xs text-slate-300 hidden sm:inline">
                | Escribe la cantidad y presiona <strong>Enter</strong> para confirmar
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelarPiezaPendiente}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors cursor-pointer"
                title="Presiona Escape para cancelar"
              >
                Cancelar (Esc)
              </button>
            </div>
          </div>
        )}

        {/* ─── INPUTS DE ESCÁNER Y CANTIDAD (ALTA VELOCIDAD) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
          {/* Input Principal de Escáner */}
          <div className="md:col-span-8 flex flex-col justify-end">
            <label htmlFor="scanner-input" className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Entrada de Código de Barras
            </label>
            <div className={`relative rounded-2xl bg-slate-950 border-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)] ${
              piezaPendiente
                ? "border-slate-700 opacity-60"
                : "border-amber-500/80 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-500/25"
            }`}>
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <input
                id="scanner-input"
                ref={inputRef}
                type="text"
                autoFocus
                autoComplete="off"
                disabled={Boolean(piezaPendiente)}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  piezaPendiente
                    ? `Pieza ${piezaPendiente} en espera de cantidad...`
                    : "Escanea OP (ej. OP3889) o Pieza (ej. P00072)..."
                }
                className="w-full bg-transparent pl-12 pr-4 py-3.5 text-lg sm:text-xl font-mono font-semibold text-amber-300 placeholder-slate-600 outline-none tracking-wider disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Input de Cantidad Integrado */}
          <div className="md:col-span-4 flex flex-col justify-end">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="cantidad-input" className="block text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>Cantidad</span>
                {piezaPendiente && (
                  <span className="text-[10px] text-amber-300 font-normal">(Enter confirma / Esc cancela)</span>
                )}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <div className={`relative flex-1 rounded-2xl bg-slate-950 border-2 transition-all ${
                piezaPendiente
                  ? "border-amber-400 ring-4 ring-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                  : "border-slate-800 opacity-60"
              }`}>
                <input
                  id="cantidad-input"
                  ref={cantidadInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  disabled={!piezaPendiente || opCerrada}
                  value={cantidadInput}
                  onChange={(e) => {
                    const soloNumeros = e.target.value.replace(/[^0-9]/g, "");
                    setCantidadInput(soloNumeros);
                  }}
                  onKeyDown={handleCantidadKeyDown}
                  placeholder="1"
                  className="w-full bg-transparent px-3 py-3.5 text-center text-xl font-mono font-bold text-amber-300 placeholder-slate-600 outline-none disabled:cursor-not-allowed"
                />
              </div>

              {/* Botón Confirmar / Capturar */}
              <button
                type="button"
                onClick={() => {
                  if (piezaPendiente) {
                    confirmarRegistroPieza();
                  } else {
                    const val = inputCode;
                    setInputCode("");
                    procesarCodigo(val);
                  }
                }}
                className={`px-4 py-3.5 font-bold rounded-2xl text-sm transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  piezaPendiente
                    ? "bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                }`}
              >
                {piezaPendiente ? (
                  <>
                    <span>Confirmar x{cantidadInput || "1"}</span>
                    <span className="text-[10px] opacity-75 font-mono">↵</span>
                  </>
                ) : (
                  <span>Capturar</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 mt-2.5">
          <span>
            {piezaPendiente ? (
              <span className="text-amber-300 font-medium">
                Presiona <strong>Enter</strong> para registrar con cantidad {cantidadInput || 1}, o <strong>Escape</strong> para cancelar.
              </span>
            ) : (
              <span>Escanea una pieza con el lector. Inmediatamente podrás indicar la cantidad o presionar Enter.</span>
            )}
          </span>
          <span className="font-mono text-slate-500">Operación 100% por teclado continuo</span>
        </div>
      </div>

      {/* ─── TABLERO INFERIOR: VISTA VIVA EXCLUSIVA DE LA OP ACTIVA ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">
              {opActiva ? `Historial de Piezas: ${formatearOpVisual(opActiva)}` : "Historial de Orden de Producción"}
            </h2>
            {opActiva && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                Vista en vivo
              </span>
            )}
          </div>
          {opActiva && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <button
                onClick={() => refetchMovimientos()}
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                title="Sincronizar con el servidor"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isFetchingMovimientos ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar
              </button>
              <span className="text-slate-300">|</span>
              <span>Datos sincronizados con base de datos</span>
            </div>
          )}
        </div>

        {!opActiva ? (
          /* Estado vacío: Sin OP Activa */
          <div className="card text-center py-12 px-6 border-dashed border-2 border-slate-300">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 4.5v3.75m0 7.5v3.75m16.5-15v3.75m0 7.5v3.75M7.5 7.5v9m3-9v9m3-9v9m3-9v9" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12h19.5" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">Ninguna Orden de Producción activa</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Escanea una etiqueta de <strong>Orden de Producción</strong> (ej. <code>OP3889</code>) para consultar y cargar en tiempo real todos sus movimientos históricos registrados en el sistema.
            </p>
            <div className="inline-flex flex-wrap items-center justify-center gap-4 sm:gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[11px]">1</span>
                <span>Escanear <strong>OP...</strong></span>
              </div>
              <span className="text-slate-300 font-bold">→</span>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 font-bold flex items-center justify-center text-[11px]">2</span>
                <span>Carga <strong>Historial Real</strong></span>
              </div>
              <span className="text-slate-300 font-bold">→</span>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 font-bold flex items-center justify-center text-[11px]">3</span>
                <span>Captura Continua</span>
              </div>
            </div>
          </div>
        ) : (
          /* Tarjeta única viva de la OP Activa */
          <div className="max-w-4xl mx-auto">
            <div className="card ring-2 ring-amber-500 border-amber-300 shadow-lg bg-white">
              {/* Encabezado de la Tarjeta */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-2xl font-black text-slate-900 tracking-wider">
                      {tarjetaOpActiva.op}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      ORDEN ACTIVA
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span>{tarjetaOpActiva.totalMovimientos} registros históricos en almacén</span>
                    {tarjetaOpActiva.ultimaActividad && (
                      <>
                        <span>•</span>
                        <span>Última actividad: {new Date(tarjetaOpActiva.ultimaActividad).toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Total acumulado</span>
                    <span className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-lg font-black font-mono inline-block">
                      {tarjetaOpActiva.totalPiezas} {tarjetaOpActiva.totalPiezas === 1 ? "unidad" : "unidades"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contenido: Tabla de piezas acumuladas o estado sin piezas */}
              {isLoadingMovimientos && tarjetaOpActiva.piezas.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  Cargando movimientos históricos de {tarjetaOpActiva.op}...
                </div>
              ) : tarjetaOpActiva.piezas.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  Esta orden de producción aún no tiene movimientos registrados en el almacén.
                  <br />
                  <span className="text-xs text-slate-500 mt-1 inline-block">
                    Escanea una pieza arriba para comenzar a sumar unidades a esta OP.
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-4 font-semibold">Pieza / N° de Parte</th>
                        <th className="py-2.5 px-4 text-center font-semibold">Cantidad Total Acumulada</th>
                        <th className="py-2.5 px-4 text-right font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tarjetaOpActiva.piezas.map((p) => (
                        <tr key={p.numeroParte} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 text-base">
                            {p.numeroParte}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-3 py-1 rounded-lg bg-amber-50 text-amber-950 border border-amber-200 font-extrabold font-mono text-sm shadow-xs">
                              x{p.cantidad}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {p.ultimoStatus === "enviando" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-spin" />
                                Enviando...
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {p.ultimoStatus || "Registrado"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer de Tarjeta */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                <span>
                  {tarjetaOpActiva.piezas.length} {tarjetaOpActiva.piezas.length === 1 ? "SKU distinto registrado" : "SKUs distintos registrados"}
                </span>
                <span className="text-amber-700 font-medium">
                  Receptor activo de lecturas de código de barras
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── NOTIFICACIÓN FLOTANTE TIPO TOAST (DISCRETA) ─── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all ${
              toast.type === "success"
                ? "bg-emerald-950 text-emerald-200 border-emerald-800"
                : toast.type === "warning"
                ? "bg-amber-950 text-amber-200 border-amber-800"
                : toast.type === "error"
                ? "bg-red-950 text-red-200 border-red-800"
                : "bg-slate-900 text-slate-100 border-slate-700"
            }`}
          >
            {toast.type === "success" && (
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === "warning" && (
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {toast.type === "error" && (
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.type === "info" && (
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-white cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
