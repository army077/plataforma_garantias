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
  const { page = 1, pageSize = 10, q = "", email } = params;
  const res = await api.get("/solicitudes", {
    params: {
      _start: (page - 1) * pageSize,
      _end: page * pageSize,
      q,
      ...(email ? { email } : {}),   // ← manda email o “all”
    },
  });
  return { rows: res.data, total: Number(res.headers["x-total-count"] || 0) };
};
export const getSolicitud = async (id) => (await api.get(`/solicitudes/${id}`)).data;
export const createSolicitud = async (payload) => (await api.post("/solicitudes", payload)).data;
export const cambiarEstadoSolicitud = async (id, a, nota = "", actor_id = 1) =>
  (await api.post(`/solicitudes/${id}/estado`, { a, nota, actor_id })).data;

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