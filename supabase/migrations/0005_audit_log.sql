-- 0005_audit_log.sql
-- Audit trail of admin actions that write (check-in, resend voucher, settings,
-- capacity overrides, roles). The app inserts via logAudit() with the service
-- role. RLS enabled with no policy = deny for anon/authenticated (see 0003).
-- Append-only: even the service role may only read and insert.
create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_email text not null,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at_idx on audit_log (at desc, id desc);

alter table audit_log enable row level security;
revoke all on audit_log from anon, authenticated, service_role;
revoke all on sequence audit_log_id_seq from anon, authenticated, service_role;
grant select, insert on audit_log to service_role;
grant usage, select on sequence audit_log_id_seq to service_role;
