-- 0004_override_reason.sql
-- Motivo opcional para excepciones de capacidad (p. ej. "Mantenimiento de piscina").
alter table capacity_overrides
  add column if not exists reason text;
