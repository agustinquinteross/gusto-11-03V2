-- Agrega la columna max_per_option a modifier_groups
-- Controla cuántas veces se puede repetir un mismo item dentro de un grupo
-- Default 1 = comportamiento actual (toggle on/off)
-- Valor > 1 = permite seleccionar múltiples unidades del mismo item (ej: Box de 5)
ALTER TABLE modifier_groups
ADD COLUMN IF NOT EXISTS max_per_option INTEGER NOT NULL DEFAULT 1;
