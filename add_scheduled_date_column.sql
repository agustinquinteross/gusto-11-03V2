-- Agregar columna para pedidos programados
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS scheduled_date timestamp with time zone;

-- Comentario para documentación
COMMENT ON COLUMN public.orders.scheduled_date IS 'Fecha y hora programada para la entrega o retiro del pedido. Si es NULL, el pedido es inmediato.';
