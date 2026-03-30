const map = {
  CREADA: "bg-slate-100 text-slate-600",
  EN_REVISION: "bg-blue-50 text-blue-700",
  APROBADA: "bg-emerald-50 text-emerald-700",
  RECHAZADA: "bg-red-50 text-red-700",
  LIBERADA: "bg-amber-50 text-amber-700",
  ENTREGADA: "bg-teal-50 text-teal-700",
  CERRADA: "bg-slate-100 text-slate-500",
  CANCELADA: "bg-red-50 text-red-600",
};
export default function EstadoBadge({ code }) {
  return <span className={`badge ${map[code] || "bg-slate-100 text-slate-600"}`}>{code || "SIN_ESTADO"}</span>;
}