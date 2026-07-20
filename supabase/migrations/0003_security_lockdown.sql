-- Security hardening: lock RLS down to service-role only, and add a
-- Postgres-backed rate limiter for the public booking action.

-- 1) RLS lockdown ---------------------------------------------------------
-- The app server does every read/write with the service role (which bypasses
-- RLS). The previous `authenticated using (true)` policies let ANY logged-in
-- Supabase user read all customer PII and edit prices/capacity via the anon
-- key. Admin identity is now enforced in app code (ADMIN_EMAILS allowlist),
-- so no ordinary role needs direct table access. Drop the policies and revoke
-- the grants; RLS stays enabled with no policy = deny for anon/authenticated.
drop policy if exists "admin read settings" on settings;
drop policy if exists "admin update settings" on settings;
drop policy if exists "admin all overrides" on capacity_overrides;
drop policy if exists "admin read reservations" on reservations;
drop policy if exists "admin update reservations" on reservations;

-- Revoke ALL (not just DML): Supabase default privileges also grant
-- TRUNCATE/REFERENCES/TRIGGER to anon+authenticated, and TRUNCATE is not
-- filtered by RLS. Least privilege — only the service role touches these tables.
revoke all on settings from anon, authenticated;
revoke all on capacity_overrides from anon, authenticated;
revoke all on reservations from anon, authenticated;

-- 2) Rate limiter ---------------------------------------------------------
-- Fixed-window counter keyed by an arbitrary string (e.g. 'book:<ip>').
create table rate_limit (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

alter table rate_limit enable row level security;
revoke all on rate_limit from anon, authenticated;
grant select, insert, update, delete on rate_limit to service_role;

-- Atomically bump the counter for p_key. Resets the window when the current
-- one has elapsed. Returns true when the request is within p_max, false when
-- it exceeds it.
create or replace function check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
as $$
declare
  v_count int;
begin
  insert into rate_limit (key, count, window_start)
    values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when rate_limit.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
            else rate_limit.count + 1
          end,
        window_start = case
          when rate_limit.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
            else rate_limit.window_start
          end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

revoke execute on function check_rate_limit(text, int, int) from public;
grant execute on function check_rate_limit to service_role;
