CREATE TABLE "adjuntos" (
	"id" SERIAL NOT NULL,
	"solicitud_id" BIGINT NULL DEFAULT NULL,
	"item_id" BIGINT NULL DEFAULT NULL,
	"tipo" TEXT NULL DEFAULT NULL,
	"url" TEXT NOT NULL,
	"subido_por" INTEGER NULL DEFAULT NULL,
	"ts" TIMESTAMPTZ NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "adjuntos_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "solicitud_items" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT "adjuntos_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT "adjuntos_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuarios" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
)
;
CREATE TABLE "almacen_movimientos" (
	"id" SERIAL NOT NULL,
	"persona" VARCHAR(120) NOT NULL,
	"estacion" VARCHAR(20) NOT NULL,
	"orden_produccion" VARCHAR(50) NULL DEFAULT NULL,
	"numero_parte" VARCHAR(50) NOT NULL,
	"descripcion" TEXT NULL DEFAULT NULL,
	"cantidad" NUMERIC(10,2) NOT NULL,
	"concepto_liberacion" VARCHAR(80) NULL DEFAULT NULL,
	"atendio" VARCHAR(120) NULL DEFAULT NULL,
	"status" VARCHAR(20) NULL DEFAULT 'PENDIENTE',
	"creado_en" TIMESTAMP NULL DEFAULT now(),
	"atendido_en" TIMESTAMP NULL DEFAULT NULL,
	"estatus_movimiento" VARCHAR(255) NULL DEFAULT NULL::character varying,
	"solicitado_por" INTEGER NULL DEFAULT NULL,
	"atendido_por" INTEGER NULL DEFAULT NULL,
	"entregado_por" INTEGER NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	CONSTRAINT "almacen_movimientos_atendido_por_fkey" FOREIGN KEY ("atendido_por") REFERENCES "usuarios_almacen" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "almacen_movimientos_entregado_por_fkey" FOREIGN KEY ("entregado_por") REFERENCES "usuarios_almacen" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "almacen_movimientos_solicitado_por_fkey" FOREIGN KEY ("solicitado_por") REFERENCES "usuarios_almacen" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
)
;
CREATE TABLE "bitacora" (
	"id" SERIAL NOT NULL,
	"ts" TIMESTAMPTZ NULL DEFAULT now(),
	"actor_id" INTEGER NULL DEFAULT NULL,
	"solicitud_id" BIGINT NULL DEFAULT NULL,
	"item_id" BIGINT NULL DEFAULT NULL,
	"accion" TEXT NULL DEFAULT NULL,
	"de" TEXT NULL DEFAULT NULL,
	"a" TEXT NULL DEFAULT NULL,
	"nota" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	CONSTRAINT "bitacora_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuarios" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "bitacora_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "solicitud_items" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "bitacora_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
)
;
CREATE TABLE "bitacora_almacen" (
	"id" SERIAL NOT NULL,
	"movimiento_id" INTEGER NULL DEFAULT NULL,
	"usuario_id" INTEGER NULL DEFAULT NULL,
	"accion" VARCHAR(50) NOT NULL,
	"detalle" TEXT NULL DEFAULT NULL,
	"fecha" TIMESTAMP NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "bitacora_almacen_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "almacen_movimientos" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT "bitacora_almacen_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios_almacen" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
)
;
CREATE TABLE "clientes" (
	"id" SERIAL NOT NULL,
	"razon_social" TEXT NOT NULL,
	"contacto" TEXT NULL DEFAULT NULL,
	"telefono" TEXT NULL DEFAULT NULL,
	"domicilio" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id")
)
;
CREATE TABLE "estados_pieza" (
	"id" SERIAL NOT NULL,
	"code" TEXT NULL DEFAULT NULL,
	"nombre" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "estados_pieza_code_key" ("code")
)
;
CREATE TABLE "estados_solicitud" (
	"id" SERIAL NOT NULL,
	"code" TEXT NULL DEFAULT NULL,
	"nombre" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "estados_solicitud_code_key" ("code")
)
;
CREATE TABLE "gestiones_garantia" (
	"id" SERIAL NOT NULL,
	"nombre" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "gestiones_garantia_nombre_key" ("nombre")
)
;
CREATE TABLE "ordenes_cerradas" (
	"orden_produccion" VARCHAR(50) NOT NULL,
	"cerrada_en" TIMESTAMP NOT NULL DEFAULT now(),
	"cerrada_por" INTEGER NULL DEFAULT NULL,
	PRIMARY KEY ("orden_produccion"),
	CONSTRAINT "ordenes_cerradas_cerrada_por_fkey" FOREIGN KEY ("cerrada_por") REFERENCES "usuarios_almacen" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
)
;
CREATE TABLE "monedas" (
	"clave" TEXT NOT NULL,
	"moneda" VARCHAR(255) NULL DEFAULT NULL,
	PRIMARY KEY ("clave")
)
;
CREATE TABLE "numero_partes_sai" (
	"id" SERIAL NOT NULL,
	"cse_prod" VARCHAR(100) NULL DEFAULT NULL,
	"clave_prod" VARCHAR(100) NULL DEFAULT NULL,
	"desc_prod" VARCHAR(255) NULL DEFAULT NULL::character varying,
	"uni_med" VARCHAR(100) NULL DEFAULT NULL,
	"costo_entrante" VARCHAR(100) NULL DEFAULT NULL,
	"clave_moneda_precio" VARCHAR(100) NULL DEFAULT NULL,
	"clave_moneda_costo" VARCHAR(100) NULL DEFAULT NULL,
	"precio_venta" VARCHAR(100) NULL DEFAULT NULL,
	"link_img" VARCHAR(10000) NULL DEFAULT NULL,
	PRIMARY KEY ("id")
)
;
CREATE TABLE "prioridades" (
	"id" SERIAL NOT NULL,
	"nombre" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "prioridades_nombre_key" ("nombre")
)
;
CREATE TABLE "productos" (
	"id" SERIAL NOT NULL,
	"clave_prod" TEXT NOT NULL,
	"desc_prod" TEXT NOT NULL,
	"uni_med" TEXT NOT NULL,
	"link_img" TEXT NULL DEFAULT NULL,
	"activo" BOOLEAN NULL DEFAULT true,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "productos_clave_prod_key" ("clave_prod")
)
;
CREATE TABLE "producto_precios" (
	"id" SERIAL NOT NULL,
	"producto_id" INTEGER NULL DEFAULT NULL,
	"moneda_precio" TEXT NULL DEFAULT NULL,
	"moneda_costo" TEXT NULL DEFAULT NULL,
	"precio_venta" NUMERIC(14,4) NOT NULL,
	"costo_entrante" NUMERIC(14,4) NOT NULL,
	"vigente_desde" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"vigente_hasta" TIMESTAMPTZ NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	CONSTRAINT "producto_precios_moneda_costo_fkey" FOREIGN KEY ("moneda_costo") REFERENCES "monedas" ("clave") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "producto_precios_moneda_precio_fkey" FOREIGN KEY ("moneda_precio") REFERENCES "monedas" ("clave") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "producto_precios_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
)
;
CREATE TABLE "roles" (
	"id" SERIAL NOT NULL,
	"nombre" TEXT NOT NULL,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "roles_nombre_key" ("nombre")
)
;
CREATE TABLE "solicitudes" (
	"id" SERIAL NOT NULL,
	"creado_en" TIMESTAMPTZ NULL DEFAULT now(),
	"email" UNKNOWN NOT NULL,
	"usuario_id" INTEGER NULL DEFAULT NULL,
	"prioridad_id" INTEGER NULL DEFAULT NULL,
	"ticket_id" INTEGER NULL DEFAULT NULL,
	"cliente_id" INTEGER NULL DEFAULT NULL,
	"soporte_para" TEXT NULL DEFAULT NULL,
	"tipo_garantia_id" INTEGER NULL DEFAULT NULL,
	"gestion_garantia_id" INTEGER NULL DEFAULT NULL,
	"estado_id" INTEGER NOT NULL,
	"fecha_entrada" DATE NULL DEFAULT NULL,
	"fecha_salida" DATE NULL DEFAULT NULL,
	"fecha_inicio_servicio" TIMESTAMPTZ NULL DEFAULT NULL,
	"fecha_fin_servicio" TIMESTAMPTZ NULL DEFAULT NULL,
	"id_reserva_sql" TEXT NULL DEFAULT NULL,
	"sede_tecnico" TEXT NULL DEFAULT NULL,
	"tecnico_asignado" INTEGER NULL DEFAULT NULL,
	"sla_horas" INTEGER NULL DEFAULT NULL,
	"vencimiento_seguimiento" DATE NULL DEFAULT NULL,
	"aplica_cobro_viaticos" BOOLEAN NULL DEFAULT NULL,
	"aplica_descuento_viaticos" BOOLEAN NULL DEFAULT NULL,
	"motivo_autorizacion" TEXT NULL DEFAULT NULL,
	"observaciones" TEXT NULL DEFAULT NULL,
	"ticket_numero" TEXT NULL DEFAULT NULL,
	"ticket_id_externo" TEXT NULL DEFAULT NULL,
	"cliente_nombre" TEXT NULL DEFAULT NULL,
	"clasificacion_garantia" VARCHAR NULL DEFAULT NULL,
	"folio_sai" VARCHAR NULL DEFAULT NULL,
	"medio_entrega" VARCHAR NULL DEFAULT NULL,
	"tecnico" VARCHAR NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	INDEX "solicitudes_ticket_id_idx" ("ticket_id"),
	INDEX "solicitudes_cliente_id_idx" ("cliente_id"),
	INDEX "solicitudes_estado_id_idx" ("estado_id"),
	INDEX "solicitudes_prioridad_id_idx" ("prioridad_id"),
	INDEX "solicitudes_fecha_entrada_idx" ("fecha_entrada"),
	INDEX "solicitudes_creado_en_idx" ("creado_en"),
	INDEX "solicitudes_estado_id_creado_en_idx" ("estado_id", "creado_en"),
	INDEX "solicitudes_ticket_id_estado_id_idx" ("ticket_id", "estado_id"),
	INDEX "solicitudes_cliente_id_estado_id_idx" ("cliente_id", "estado_id"),
	INDEX "idx_solicitudes_email" ("email"),
	CONSTRAINT "solicitudes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitudes_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estados_solicitud" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitudes_gestion_garantia_id_fkey" FOREIGN KEY ("gestion_garantia_id") REFERENCES "gestiones_garantia" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitudes_prioridad_id_fkey" FOREIGN KEY ("prioridad_id") REFERENCES "prioridades" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitudes_tecnico_asignado_fkey" FOREIGN KEY ("tecnico_asignado") REFERENCES "usuarios" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitudes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitudes_tipo_garantia_id_fkey" FOREIGN KEY ("tipo_garantia_id") REFERENCES "tipos_garantia" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitudes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitudes_soporte_para_check" CHECK (((soporte_para = ANY (ARRAY['Garantía'::text, 'Venta'::text, 'Otro'::text]))))
)
;
CREATE TABLE "solicitudes_almacen_subensamble" (
	"id" SERIAL NOT NULL,
	"id_num_parte" INTEGER NULL DEFAULT NULL,
	"comentarios" VARCHAR(255) NULL DEFAULT NULL,
	"cantidad" INTEGER NULL DEFAULT NULL,
	"created_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	"solicitud_para" VARCHAR(255) NULL DEFAULT NULL::character varying,
	"status" VARCHAR(255) NULL DEFAULT 'pendiente',
	PRIMARY KEY ("id")
)
;
CREATE TABLE "solicitud_items" (
	"id" SERIAL NOT NULL,
	"solicitud_id" BIGINT NULL DEFAULT NULL,
	"producto_id" INTEGER NULL DEFAULT NULL,
	"numero_parte" TEXT NULL DEFAULT NULL,
	"descripcion" TEXT NULL DEFAULT NULL,
	"cantidad" NUMERIC(12,3) NOT NULL DEFAULT 1,
	"unidad" TEXT NULL DEFAULT NULL,
	"motivo" TEXT NULL DEFAULT NULL,
	"comentarios" TEXT NULL DEFAULT NULL,
	"estado_pieza_id" INTEGER NULL DEFAULT NULL,
	"moneda_precio" TEXT NULL DEFAULT NULL,
	"moneda_costo" TEXT NULL DEFAULT NULL,
	"precio_unitario" NUMERIC(14,4) NULL DEFAULT NULL,
	"costo_unitario" NUMERIC(14,4) NULL DEFAULT NULL,
	"precio_total" NUMERIC(14,4) NULL DEFAULT NULL,
	"costo_total" NUMERIC(14,4) NULL DEFAULT NULL,
	"medio_entrega" TEXT NULL DEFAULT NULL,
	"destino_cliente" TEXT NULL DEFAULT NULL,
	"fecha_refaccion_entregada" DATE NULL DEFAULT NULL,
	"recibido_por" TEXT NULL DEFAULT NULL,
	"folio_sai_liberacion" TEXT NULL DEFAULT NULL,
	"status" TEXT NULL DEFAULT NULL,
	"eliminado" BOOLEAN NOT NULL DEFAULT false,
	PRIMARY KEY ("id"),
	INDEX "solicitud_items_solicitud_id_idx" ("solicitud_id"),
	INDEX "solicitud_items_estado_pieza_id_idx" ("estado_pieza_id"),
	INDEX "solicitud_items_producto_id_idx" ("producto_id"),
	INDEX "solicitud_items_solicitud_id_estado_pieza_id_idx" ("solicitud_id", "estado_pieza_id"),
	CONSTRAINT "solicitud_items_estado_pieza_id_fkey" FOREIGN KEY ("estado_pieza_id") REFERENCES "estados_pieza" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitud_items_moneda_costo_fkey" FOREIGN KEY ("moneda_costo") REFERENCES "monedas" ("clave") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitud_items_moneda_precio_fkey" FOREIGN KEY ("moneda_precio") REFERENCES "monedas" ("clave") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitud_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
	CONSTRAINT "solicitud_items_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
;
CREATE TABLE "tickets" (
	"id" SERIAL NOT NULL,
	"id_externo" TEXT NULL DEFAULT NULL,
	"numero" TEXT NULL DEFAULT NULL,
	"cliente_id" INTEGER NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "tickets_id_externo_key" ("id_externo"),
	CONSTRAINT "tickets_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
)
;
CREATE TABLE "tipos_garantia" (
	"id" SERIAL NOT NULL,
	"nombre" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "tipos_garantia_nombre_key" ("nombre")
)
;
CREATE TABLE "tmp_catalogo" (
	"cse_prod" VARCHAR NULL DEFAULT NULL,
	"clave_prod" VARCHAR NULL DEFAULT NULL,
	"desc_prod" VARCHAR NULL DEFAULT NULL,
	"uni_med" VARCHAR NULL DEFAULT NULL,
	"costo_entrante" NUMERIC NULL DEFAULT NULL,
	"clave_moneda_costo" VARCHAR NULL DEFAULT NULL,
	"clave_moneda_precio" VARCHAR NULL DEFAULT NULL,
	"precio_venta" NUMERIC NULL DEFAULT NULL
)
;
CREATE TABLE "usuarios" (
	"id" SERIAL NOT NULL,
	"email" UNKNOWN NOT NULL,
	"nombre" TEXT NOT NULL,
	"role_id" INTEGER NULL DEFAULT NULL,
	"sede" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE INDEX "usuarios_email_key" ("email"),
	CONSTRAINT "usuarios_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
)
;
CREATE TABLE "usuarios_almacen" (
	"id" SERIAL NOT NULL,
	"nombre" VARCHAR(120) NOT NULL,
	"rol" VARCHAR(40) NOT NULL,
	"pin_hash" VARCHAR(255) NOT NULL,
	"creado_en" TIMESTAMP NULL DEFAULT now(),
	PRIMARY KEY ("id")
)
;