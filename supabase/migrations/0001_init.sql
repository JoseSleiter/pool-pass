-- Settings: single row
create table settings (
  id int primary key default 1 check (id = 1),
  daily_capacity int not null default 100,
  adult_price_usd numeric(10,2) not null default 15,
  child_price_usd numeric(10,2) not null default 5,
  last_bcv_rate numeric(14,4),
  last_bcv_rate_at timestamptz
);
insert into settings (id) values (1);

-- Per-date capacity override; 0 = closed
create table capacity_overrides (
  date date primary key,
  capacity int not null check (capacity >= 0)
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  date date not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  id_type text not null check (id_type in ('V','E','P','J')),
  id_number text not null,
  adults int not null check (adults >= 1),
  children int not null check (children >= 0),
  total_usd numeric(10,2) not null,
  bcv_rate numeric(14,4),
  total_ves numeric(14,2),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','confirmed','failed','expired','checked_in')),
  payment_ref text,
  expires_at timestamptz,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);
create index reservations_date_idx on reservations (date);

-- RLS: nothing for anon; read/update for authenticated admins.
-- The app server uses the service role, which bypasses RLS.
alter table settings enable row level security;
alter table capacity_overrides enable row level security;
alter table reservations enable row level security;

create policy "admin read settings" on settings for select to authenticated using (true);
create policy "admin update settings" on settings for update to authenticated using (true);
create policy "admin all overrides" on capacity_overrides for all to authenticated using (true);
create policy "admin read reservations" on reservations for select to authenticated using (true);
create policy "admin update reservations" on reservations for update to authenticated using (true);

-- Table-level grants: RLS policies only filter rows, Postgres still requires
-- an explicit GRANT before a role can touch a table at all. service_role
-- carries BYPASSRLS but still needs these grants; it is what the app server
-- uses for all reads/writes (including via reserve_slots below). authenticated
-- grants mirror the admin policies above for the Supabase Studio / dashboard use.
grant usage on schema public to service_role, authenticated;
grant select, update on settings to service_role, authenticated;
grant select, insert, update, delete on capacity_overrides to service_role, authenticated;
grant select, insert, update, delete on reservations to service_role;
grant select, update on reservations to authenticated;

-- Atomic capacity check + pending insert
create or replace function reserve_slots(
  p_date date,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_id_type text,
  p_id_number text,
  p_adults int,
  p_children int,
  p_total_usd numeric
) returns table (ok boolean, reservation_id uuid, code text, remaining int)
language plpgsql
as $$
declare
  v_limit int;
  v_occupancy int;
  v_code text;
begin
  -- serialize all bookings for the same date
  perform pg_advisory_xact_lock(hashtext('pool-' || p_date::text));

  select coalesce(
    (select o.capacity from capacity_overrides o where o.date = p_date),
    (select s.daily_capacity from settings s where s.id = 1)
  ) into v_limit;

  select coalesce(sum(r.adults + r.children), 0) into v_occupancy
  from reservations r
  where r.date = p_date
    and (r.status in ('confirmed','checked_in')
         or (r.status = 'pending_payment' and r.expires_at > now()));

  if v_occupancy + p_adults + p_children > v_limit then
    return query select false, null::uuid, null::text, greatest(v_limit - v_occupancy, 0);
    return;
  end if;

  v_code := 'PP-' || upper(substring(md5(gen_random_uuid()::text) from 1 for 5));

  return query
  insert into reservations
    (code, date, first_name, last_name, email, id_type, id_number,
     adults, children, total_usd, status, expires_at)
  values
    (v_code, p_date, p_first_name, p_last_name, p_email, p_id_type, p_id_number,
     p_adults, p_children, p_total_usd, 'pending_payment', now() + interval '10 minutes')
  returning true, reservations.id, reservations.code, null::int;
end;
$$;

grant execute on function reserve_slots to service_role;
