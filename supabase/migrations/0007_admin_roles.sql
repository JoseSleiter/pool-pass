-- 0007_admin_roles.sql
-- Admin roles. The access gate is still the ADMIN_EMAILS allowlist; this table
-- only refines the role of an allowlisted email. An allowlisted email with no
-- row here is 'owner' (keeps current access working). Emails stored lowercase.
create table if not exists admin_roles (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('owner', 'operator'))
);

alter table admin_roles enable row level security;
revoke all on admin_roles from anon, authenticated, service_role;
grant select, insert, update, delete on admin_roles to service_role;
