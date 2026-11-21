-- Phosters Phase 4.1 Migration: Admin Student Usage & Email Directory RPC
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 001, 002, and 003.
-- Purpose: Safely expose student email addresses and last sign-in timestamps ONLY to verified admins.

create or replace function public.get_admin_student_contacts()
returns table (
  student_id uuid,
  email text,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  return query
  select
    p.id as student_id,
    u.email::text as email,
    u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'student';
end;
$$;

revoke all on function public.get_admin_student_contacts() from public, anon;
grant execute on function public.get_admin_student_contacts() to authenticated;
