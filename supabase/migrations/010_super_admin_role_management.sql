-- Phosters Migration 010: Super Admin Role Management (Zero-SQL Tutor Upgrades)
-- Run this script ONCE in your Supabase Dashboard -> SQL Editor AFTER 001.
-- Designates oyasordaniel@gmail.com as the Super Administrator who can upgrade
-- registered student accounts to Tutor/Admin accounts (or revert them) from the app UI.

-- 1. Trusted Super Admin check helper
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and lower(trim(coalesce(u.email, ''))) = 'oyasordaniel@gmail.com'
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- 2. Auto-assign 'admin' on signup for oyasordaniel@gmail.com; force 'student' for all others
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
  v_initial_role text;
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

  if lower(trim(coalesce(new.email, ''))) = 'oyasordaniel@gmail.com' then
    v_initial_role := 'admin';
  else
    v_initial_role := 'student';
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (new.id, left(v_full_name, 100), left(v_phone, 30), v_initial_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 3. Immediately ensure oyasordaniel@gmail.com holds 'admin' if the account already exists
do $$
declare
  v_super_id uuid;
  v_full_name text;
begin
  select
    u.id,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'Daniel Oyasor')
  into v_super_id, v_full_name
  from auth.users u
  where lower(trim(coalesce(u.email, ''))) = 'oyasordaniel@gmail.com'
  limit 1;

  if v_super_id is not null then
    insert into public.profiles (id, full_name, role)
    values (v_super_id, left(v_full_name, 100), 'admin')
    on conflict (id) do update
    set role = 'admin';
  end if;
end $$;

-- 4. Tighten role update trigger so only Super Admin (or SQL Editor / trusted RPCs) can alter roles
create or replace function public.guard_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_target_super boolean;
begin
  if new.role is distinct from old.role then
    -- Allow privileged SQL Editor / service role / trusted SECURITY DEFINER RPCs
    if current_user in ('postgres', 'supabase_admin', 'service_role') or auth.uid() is null then
      return new;
    end if;

    select exists (
      select 1
      from auth.users u
      where u.id = new.id
        and lower(trim(coalesce(u.email, ''))) = 'oyasordaniel@gmail.com'
    ) into v_is_target_super;

    -- Block non-super-admins, self-demotion, or modifying the super admin row via client updates
    if not public.is_super_admin() or new.id = auth.uid() or v_is_target_super then
      raise exception 'Unauthorized attempt to modify profile role';
    end if;
  end if;

  return new;
end;
$$;

-- 5. Super-Admin-only directory listing all registered accounts (Students & Tutors/Admins)
create or replace function public.get_admin_managed_accounts()
returns table (
  user_id uuid,
  full_name text,
  email text,
  phone text,
  role text,
  is_super_admin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Super administrator access required';
  end if;

  return query
  select
    u.id as user_id,
    coalesce(
      p.full_name,
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Phosters User'
    )::text as full_name,
    u.email::text as email,
    p.phone::text as phone,
    coalesce(p.role, 'student')::text as role,
    (lower(trim(coalesce(u.email, ''))) = 'oyasordaniel@gmail.com') as is_super_admin,
    coalesce(p.created_at, u.created_at) as created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by
    (lower(trim(coalesce(u.email, ''))) = 'oyasordaniel@gmail.com') desc,
    (coalesce(p.role, 'student') = 'admin') desc,
    coalesce(p.created_at, u.created_at) desc;
end;
$$;

revoke all on function public.get_admin_managed_accounts() from public, anon;
grant execute on function public.get_admin_managed_accounts() to authenticated;

-- 6. Super-Admin-only RPC to upgrade a user account to Tutor ('admin') or revert to 'student'
create or replace function public.set_user_account_role(
  p_target_user_id uuid,
  p_new_role text
)
returns table (
  user_id uuid,
  role text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_email text;
  v_fallback_name text;
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Super administrator access required';
  end if;

  if p_target_user_id is null then
    raise exception 'Target user ID is required';
  end if;

  if p_new_role not in ('student', 'admin') then
    raise exception 'Invalid role. Allowed values are student or admin.';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot change your own Super Administrator role.';
  end if;

  select
    u.email::text,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Phosters User'
    )
  into v_target_email, v_fallback_name
  from auth.users u
  where u.id = p_target_user_id
  limit 1;

  if v_target_email is null and not exists (select 1 from auth.users u where u.id = p_target_user_id) then
    raise exception 'Account not found.';
  end if;

  if lower(trim(coalesce(v_target_email, ''))) = 'oyasordaniel@gmail.com' then
    raise exception 'Cannot modify the designated Super Administrator account.';
  end if;

  if char_length(v_fallback_name) < 2 then
    v_fallback_name := 'Phosters User';
  end if;

  insert into public.profiles (id, full_name, role)
  values (p_target_user_id, left(v_fallback_name, 100), p_new_role)
  on conflict (id) do update
  set role = excluded.role;

  return query
  select p.id as user_id, p.role::text as role
  from public.profiles p
  where p.id = p_target_user_id;
end;
$$;

revoke all on function public.set_user_account_role(uuid, text) from public, anon;
grant execute on function public.set_user_account_role(uuid, text) to authenticated;
