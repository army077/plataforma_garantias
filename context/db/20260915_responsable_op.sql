-- Aplicar manualmente en PostgreSQL antes de habilitar las nuevas rutas.
-- Guarda únicamente la asignación actual; no migra nombres de movimientos.
BEGIN;

-- Función de sesión: no se instala una función permanente en el esquema público.
CREATE OR REPLACE FUNCTION pg_temp.normalizar_op(valor TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE STRICT AS $$
    SELECT CASE WHEN limpio ~* '^OP[[:space:]]*([0-9]+)$'
        THEN regexp_replace(limpio, '^OP[[:space:]]*([0-9]+)$', '\1', 'i')
        ELSE limpio END
    FROM (SELECT regexp_replace(valor, '^[[:space:]]+|[[:space:]]+$', '', 'g') AS limpio) s;
$$;

-- Impide escrituras concurrentes entre la comprobación y la normalización.
LOCK TABLE almacen_movimientos, ordenes_cerradas IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (
        SELECT pg_temp.normalizar_op(orden_produccion)
        FROM ordenes_cerradas
        GROUP BY pg_temp.normalizar_op(orden_produccion)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Normalización cancelada: varias filas de ordenes_cerradas comparten una clave canónica. Revisar sin eliminar ni fusionar cierres.';
    END IF;
END;
$$;

UPDATE almacen_movimientos
SET orden_produccion = pg_temp.normalizar_op(orden_produccion)
WHERE orden_produccion IS DISTINCT FROM pg_temp.normalizar_op(orden_produccion);

UPDATE ordenes_cerradas
SET orden_produccion = pg_temp.normalizar_op(orden_produccion)
WHERE orden_produccion IS DISTINCT FROM pg_temp.normalizar_op(orden_produccion);

CREATE TABLE IF NOT EXISTS ordenes_produccion_asignaciones (
    orden_produccion VARCHAR(50) PRIMARY KEY,
    responsable_id INTEGER NULL,
    asignado_por INTEGER NULL,
    asignado_en TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT ordenes_produccion_asignaciones_responsable_id_fkey
        FOREIGN KEY (responsable_id) REFERENCES usuarios_almacen(id)
        ON DELETE SET NULL,
    CONSTRAINT ordenes_produccion_asignaciones_asignado_por_fkey
        FOREIGN KEY (asignado_por) REFERENCES usuarios(id)
        ON DELETE SET NULL
);

-- NULL significa Por asignar. Eliminar un usuario conserva la fila de OP.
-- IF NOT EXISTS no corrige una tabla preexistente con otra estructura.
-- asignado_por identifica al usuario de plataforma que realizó el último cambio.
-- Guarda el último actor; no conserva un historial de reasignaciones.
COMMIT;
