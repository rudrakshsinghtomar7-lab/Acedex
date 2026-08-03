-- © 2026 Rudraksh Singh Tomar. All rights reserved.
-- 023_waitlist.sql — pre-launch waitlist capture for the marketing site
-- (acedex-web repo). Anonymous visitors may INSERT (join the list); nobody can
-- read the list except admins (in-app) and the service role / Supabase
-- dashboard. Public reads are denied by RLS.

create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  role_interest text check (role_interest in ('professor','student')),
  created_at    timestamptz not null default now()
);

-- Case-insensitive uniqueness so Jane@x.edu and jane@x.edu don't double-list.
create unique index if not exists waitlist_email_lower_idx
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- INSERT: anon or authenticated may join, but the row must look sane.
-- Note: the lower(email) unique index above means a duplicate signup returns
-- 23505 to the caller. The marketing site treats that as success so the UI
-- never reveals membership, but a direct API call can still use it as an
-- enumeration oracle. Closing that needs the client to send
-- `Prefer: resolution=ignore-duplicates` (acedex-web), not a schema change.
drop policy if exists waitlist_anon_insert on public.waitlist;
create policy waitlist_anon_insert
  on public.waitlist for insert
  to anon, authenticated
  with check (
    char_length(email) between 3 and 254
    and position('@' in email) > 1
    and (role_interest is null or role_interest in ('professor','student'))
  );

-- SELECT: admins only (reuses the app's is_admin() helper from 001). The
-- service role / dashboard bypasses RLS, so the list is always readable there.
-- No anon/public SELECT policy exists → public reads are denied.
drop policy if exists waitlist_admin_select on public.waitlist;
create policy waitlist_admin_select
  on public.waitlist for select
  to authenticated
  using (public.is_admin());

-- No UPDATE/DELETE policies → blocked for everyone but the service role.
