-- Aplicar manualmente antes de desplegar las rutas de solicitudes de almacén.
-- Migración aditiva: no reconstruye solicitudes ni actualiza movimientos históricos.
BEGIN;

CREATE TABLE IF NOT EXISTS almacen_solicitudes (
    id SERIAL PRIMARY KEY,
    orden_produccion VARCHAR(50) NOT NULL,
    persona VARCHAR(120) NOT NULL,
    estacion VARCHAR(20) NOT NULL,
    concepto_liberacion VARCHAR(80) NULL,
    creado_por INTEGER NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT almacen_solicitudes_creado_por_fkey
        FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Una OP puede tener varias solicitudes.
CREATE INDEX IF NOT EXISTS almacen_solicitudes_orden_produccion_idx
    ON almacen_solicitudes (orden_produccion);

-- Sin DEFAULT ni backfill: los movimientos existentes conservan NULL.
ALTER TABLE almacen_movimientos
    ADD COLUMN IF NOT EXISTS solicitud_id INTEGER NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'almacen_movimientos'::regclass
          AND conname = 'almacen_movimientos_solicitud_id_fkey'
    ) THEN
        ALTER TABLE almacen_movimientos
            ADD CONSTRAINT almacen_movimientos_solicitud_id_fkey
            FOREIGN KEY (solicitud_id) REFERENCES almacen_solicitudes(id)
            ON DELETE RESTRICT;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS almacen_movimientos_solicitud_id_idx
    ON almacen_movimientos (solicitud_id);

-- Reejecutable sobre el esquema creado aquí. IF NOT EXISTS no repara
-- objetos preexistentes con el mismo nombre y una definición diferente.
COMMIT;
