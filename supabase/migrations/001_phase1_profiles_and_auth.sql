-- Phosters Phase 1 Migration: Profiles, Authentication Trigger, and Role Security
-- Run this script in your Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

-- 1. Profiles table linked 1:1 with Supabase Auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2 and char_length(full_name) <= 100),
  phone text null check (phone is null or char_length(trim(phone)) <= 30),
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_created_at on public.profiles (created_at desc);

-- 2. Automatic updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- 3. Security-definer admin check helper (prevents recursive RLS lookups)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 4. Automatically create a student profile when a user signs up via Supabase Auth.
-- Security: Role is always forced to 'student'; client metadata cannot assign 'admin'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Phosters Student'
  );

  if char_length(v_full_name) < 2 then
    v_full_name := 'Phosters Student';
  end if;

  v_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');

  insert into public.profiles (id, full_name, phone, role)
  values (new.id, left(v_full_name, 100), left(v_phone, 30), 'student')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 5. Guard against self-promotion or unauthorized role updates
create or replace function public.guard_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Allow privileged SQL/service role operations (e.g. Supabase SQL Editor)
    if current_user in ('postgres', 'supabase_admin', 'service_role') or auth.uid() is null then
      return new;
    end if;

    -- Block any user (even admin in standard profile form) from changing their own role via self-update,
    -- and block non-admins from changing any role.
    if not public.is_admin() or new.id = auth.uid() then
      raise exception 'Unauthorized attempt to modify profile role';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role_update on public.profiles;
create trigger trg_guard_profile_role_update
  before update on public.profiles
  for each row
  execute function public.guard_profile_role_update();

-- 6. Row Level Security (RLS)
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- 7. Trusted admin promotion helper (executable ONLY by database owner / service_role in SQL Editor)
create or replace function public.promote_user_to_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(target_email))
  limit 1;

  if v_user_id is null then
    raise exception 'No user found with email: %', target_email;
  end if;

  update public.profiles
  set role = 'admin'
  where id = v_user_id;

  if not found then
    insert into public.profiles (id, full_name, role)
    values (v_user_id, 'Phosters Admin', 'admin');
  end if;
end;
$$;

revoke all on function public.promote_user_to_admin(text) from public, anon, authenticated;

-- Example usage in Supabase SQL Editor after signing up your first admin account:
-- select public.promote_user_to_admin('admin@phosters.example');
