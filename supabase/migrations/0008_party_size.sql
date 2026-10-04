-- 0008_party_size.sql
-- Derived search helpers for the admin reservation search, maintained by Postgres
-- (nobody writes them: inserts/updates keep working unchanged):
--   * party_size  = adults + children, so PostgREST can filter by guest type
--     (individual = 1, family >= 2) and sort by group size without an RPC or view.
--   * search_text = lowercase, accent-free "first last code id_number", so a search
--     for "perez" finds "Pérez". Clients normalize terms the same way.
-- Table-level grants from 0001/0003 already cover the new columns.
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() is only STABLE; this wrapper pins the dictionary so it can be
-- used in a generated column / index (standard pattern).
create or replace function public.f_unaccent(text)
  returns text
  language sql
  immutable
  parallel safe
  strict
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

alter table public.reservations
  add column if not exists party_size int generated always as (adults + children) stored;

alter table public.reservations
  add column if not exists search_text text generated always as (
    lower(public.f_unaccent(
      coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || code || ' ' || id_number
    ))
  ) stored;

create index if not exists reservations_search_text_trgm_idx
  on public.reservations using gin (search_text extensions.gin_trgm_ops);
