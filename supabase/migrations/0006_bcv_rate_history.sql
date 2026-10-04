-- 0006_bcv_rate_history.sql
-- One row per freshly fetched BCV rate (never on a cache read). `source` says
-- what triggered the fetch: 'auto' (app traffic) or 'manual' (admin refresh).
-- Service role only; append-only like audit_log.
create table if not exists bcv_rate_history (
  id bigserial primary key,
  fetched_at timestamptz not null,
  rate numeric(14,4) not null check (rate > 0),
  source text
);
create index if not exists bcv_rate_history_fetched_at_idx on bcv_rate_history (fetched_at desc, id desc);

alter table bcv_rate_history enable row level security;
revoke all on bcv_rate_history from anon, authenticated, service_role;
revoke all on sequence bcv_rate_history_id_seq from anon, authenticated, service_role;
grant select, insert on bcv_rate_history to service_role;
grant usage, select on sequence bcv_rate_history_id_seq to service_role;
