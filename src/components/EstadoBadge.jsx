const map = {
  CREADA: "border-neutral-600",
  EN_REVISION: "border-blue-500 text-blue-300",
  APROBADA: "border-green-600 text-green-300",
  RECHAZADA: "border-red-600 text-red-300",
  LIBERADA: "border-yellow-600 text-yellow-300",
  ENTREGADA: "border-emerald-600 text-emerald-300",
  CERRADA: "border-neutral-700 text-neutral-400",
  CANCELADA: "border-red-600 text-red-300",
};
export default function EstadoBadge({ code }) {
  return <span className={`badge ${map[code] || ""}`}>{code || "SIN_ESTADO"}</span>;
}