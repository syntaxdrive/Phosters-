-- Phosters Migration 013d: Fix ambiguous column reference "tutor_id" in set_tutor_assigned_subjects
-- Run in Supabase Dashboard -> SQL Editor (standalone patch for 013a).

create or replace function public.set_tutor_assigned_subjects(
  p_tutor_id uuid,
  p_subject_ids uuid[]
)
returns table (
  tutor_id uuid,
  subject_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
#variable_conflict use_column
declare
  v_target_role text;
  v_target_email text;
  v_valid_ids uuid[];
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Super administrator access required';
  end if;

  if p_tutor_id is null then
    raise exception 'Tutor user ID is required';
  end if;

  select p.role, u.email::text
  into v_target_role, v_target_email
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_tutor_id
  limit 1;

  if v_target_role is null then
    raise exception 'Tutor profile not found.';
  end if;

  if lower(trim(coalesce(v_target_email, ''))) = 'oyasordaniel@gmail.com' then
    raise exception 'Super Administrator automatically has access to all subjects.';
  end if;

  if v_target_role <> 'admin' then
    raise exception 'Upgrade this account to Tutor before assigning subjects.';
  end if;

  select coalesce(array_agg(distinct s.id), '{}'::uuid[])
  into v_valid_ids
  from public.subjects s
  where s.id = any(coalesce(p_subject_ids, '{}'::uuid[]));

  delete from public.tutor_subject_assignments tsa
  where tsa.tutor_id = p_tutor_id
    and not (tsa.subject_id = any(v_valid_ids));

  insert into public.tutor_subject_assignments (tutor_id, subject_id, assigned_by)
  select p_tutor_id, sid, auth.uid()
  from unnest(v_valid_ids) as sid
  where not exists (
    select 1
    from public.tutor_subject_assignments ex
    where ex.tutor_id = p_tutor_id
      and ex.subject_id = sid
  )
  on conflict do nothing;

  return query
  select tsa.tutor_id, tsa.subject_id
  from public.tutor_subject_assignments tsa
  where tsa.tutor_id = p_tutor_id;
end;
$$;

revoke all on function public.set_tutor_assigned_subjects(uuid, uuid[]) from public, anon;
grant execute on function public.set_tutor_assigned_subjects(uuid, uuid[]) to authenticated;
