import axios from "axios";
import { auth } from "./firebase";
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use(async (config) => {
  const u = auth.currentUser;
  if (u) {
    const t = await u.getIdToken();
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

// opciones para selects
export const listUsuarios = async (q = "", start = 0, end = 20) =>
  (await api.get("/catalogo/usuarios", { params: { q, _start: start, _end: end } })).data;

export const listClientes = async (q = "", start = 0, end = 20) =>
  (await api.get("/catalogo/clientes", { params: { q, _start: start, _end: end } })).data;

export const listTickets = async (q = "", start = 0, end = 20) =>
  (await api.get("/catalogo/tickets", { params: { q, _start: start, _end: end } })).data;

// Solicitudes
export const listSolicitudes = async (params = {}) => {
  const {
    page = 1,
    pageSize = 10,
    q = "",
    email,
    estado = "",
  } = params;

  const res = await api.get("/solicitudes", {
    params: {
      _start: (page - 1) * pageSize,
      _end: page * pageSize,
      q,
      ...(email ? { email } : {}),
      ...(estado ? { estado } : {}),  // ← clave
    },
  });

  return {
    rows: res.data,
    total: Number(res.headers["x-total-count"] || 0),
  };
};
export const getSolicitud = async (id) => (await api.get(`/solicitudes/${id}`)).data;
export const createSolicitud = async (payload) => (await api.post("/solicitudes", payload)).data;
export const cambiarEstadoSolicitud = async (id, a, nota = "", actor_id = 1) =>
  (await api.post(`/solicitudes/${id}/estado`, { a, nota, actor_id })).data;
export const setTecnicoSolicitud = async (id, tecnico) =>
  (await api.put(`/solicitudes/tecnico/${id}`, { tecnico })).data;

export const cerrarSolicitud = async (id, fechaSalida) =>
  (await api.put(`/solicitudes/${id}/cerrar`, { fecha_salida: fechaSalida }))
    .data;

export const setClasificacionGarantia = async (id, payload) =>
  (await api.put(`/solicitudes/${id}`, payload)).data;
// payload: { clasificacion_garantia, folio_sai }
// Actualiza la clasificación por ITEM dentro de la solicitud
export async function setClasificacionItem(idSolicitud, itemId, data) {
  return api.put(
    `/solicitudes/motivo_item/${idSolicitud}/items/${itemId}`,
    data
  );
}

export async function setDescripcionItem(idSolicitud, itemId, data) {
  return api.put(`/solicitudes/descripcion_item/${idSolicitud}/items/${itemId}`, data);
}

export async function setCostoItem(idSolicitud, itemId, data) {
  return api.put(`/solicitudes/costo_item/${idSolicitud}/items/${itemId}`, data);
}

// Cambiar estado de un ITEM
export const cambiarEstadoItem = async (itemId, payload /* {actor_id, a, nota} */) => {
  const { data } = await api.post(`/solicitudes/items/${itemId}/estado`, payload);
  return data;
};

export const addItem = async (solId, payload) =>
  (await api.post(`/solicitudes/${solId}/items`, payload)).data;

// Catálogo
export const buscarProductos = async (q, start = 0, end = 10) =>
  (await api.get("/catalogo/productos", { params: { q, _start: start, _end: end } })).data;

/* ============================================================
   ALMACÉN
   ============================================================ */

// GET: movimientos (todas las solicitudes sueltas del almacén)
export const listAlmacenMovimientos = async () => {
  const { data } = await api.get("/almacen/movimientos");
  return data;
};

// POST: crear movimiento (solicitud simple)
export const createAlmacenMovimiento = async (payload) => {
  // payload:
  // {
  //   persona,
  //   estacion,
  //   orden_produccion,
  //   numero_parte,
  //   descripcion,
  //   cantidad,
  //   concepto_liberacion
  // }
  const { data } = await api.post("/almacen/crear", payload);
  return data;
};

export const createAlmacenMovimientoPin = async (payload) =>
  (await api.post(`/almacen/crear_pin`, payload)).data;

// POST: marcar como atendido
export const atenderAlmacenMovimiento = async (id, atendio) => {
  const { data } = await api.post(`/almacen/atender/${id}`, { atendio });
  return data;
};

export const atenderAlmacenMovimientoPin = async (id, pin) =>
  (await api.post(`/almacen/atender_pin/${id}`, { pin })).data;

// GET: buscar producto para kiosko/simple
export const buscarProductoAlmacen = async (q) => {
  const { data } = await api.get("/almacen/buscar", { params: { q } });
  return data;
};

export const actualizarEstatusMovimiento = async (id, status) =>
  (await api.put(`/almacen/movimientos/${id}/status`, { status })).data;

// PUT: cerrar todos los movimientos por orden de producción
export const cerrarMovimientosPorOrden = async (ordenProduccion) => {
  const { data } = await api.put(
    `/almacen/movimientos/orden/${ordenProduccion}/cerrar`
  );
  return data;
};

export const cambiarStatusConPin = async (id, nuevo_status, pin) =>
  (await api.post(`/almacen/cambiar_status_pin/${id}`, { nuevo_status, pin })).data;

export const updateAlmacenMovimiento = async (id, payload) =>
  (await api.put(`/almacen/movimientos/${id}`, payload)).data;

export const deleteAlmacenMovimiento = async (id) =>
  (await api.delete(`/almacen/movimientos/${id}`)).data;

//USUARIOS ALMACEN PIN
export const getUsuariosAlmacen = async () =>
  (await api.get("/almacen/usuarios_almacen")).data;

export const getUsuarioAlmacen = async (id) =>
  (await api.get(`/almacen/usuarios_almacen/${id}`)).data;

export const createUsuarioAlmacen = async (payload) =>
  (await api.post("/almacen/usuarios_almacen", payload)).data;

export const updateUsuarioAlmacen = async (id, payload) =>
  (await api.put(`/almacen/usuarios_almacen/${id}`, payload)).data;

export const deleteUsuarioAlmacen = async (id) =>
  (await api.delete(`/almacen/usuarios_almacen/${id}`)).data;

export const resetPinUsuarioAlmacen = async (id, nuevo_pin) =>
  (await api.put(`/almacen/usuarios_almacen/reset_pin/${id}`, { nuevo_pin })).data;

export const validarPinUsuario = async (pin) =>
  (await api.post("/almacen/usuarios_almacen/validar_pin", { pin })).data;

//FUERA DE LA API12
// POST: agregar comentario (HTML) a ticket de Zoho vía tu backend
export const addZohoComment = async ({ ticketId, message, isPublic = true }) => {
  const url = `https://desarrollotecnologicoar.com/api8/ticket/${ticketId}/comment`;

  const { data } = await axios.post(url, { message, isPublic }, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return data;
};