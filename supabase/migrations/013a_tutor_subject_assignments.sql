-- Phosters Migration 013a: Multi-Subject Tutor Assignments & Access Helpers
-- Run in Supabase Dashboard -> SQL Editor AFTER 001, 002, 003, and 010.

-- 1. Mapping table: Super Admin can assign 1 or multiple subjects to each Tutor
create table if not exists public.tutor_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  assigned_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tutor_id, subject_id)
);

create index if not exists idx_tutor_subj_assign_tutor
  on public.tutor_subject_assignments (tutor_id);

create index if not exists idx_tutor_subj_assign_subject
  on public.tutor_subject_assignments (subject_id);

alter table public.tutor_subject_assignments enable row level security;

drop policy if exists "tutor_assignments_super_admin_all" on public.tutor_subject_assignments;
create policy "tutor_assignments_super_admin_all"
  on public.tutor_subject_assignments
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "tutor_assignments_select_own" on public.tutor_subject_assignments;
create policy "tutor_assignments_select_own"
  on public.tutor_subject_assignments
  for select
  to authenticated
  using (tutor_id = auth.uid() and public.is_admin());

-- 2. Clean up subject assignments automatically if a Tutor is reverted to Student
create or replace function public.cleanup_tutor_assignments_on_demote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'student' and old.role is distinct from new.role then
    delete from public.tutor_subject_assignments where tutor_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cleanup_tutor_assignments on public.profiles;
create trigger trg_cleanup_tutor_assignments
  after update of role on public.profiles
  for each row
  execute function public.cleanup_tutor_assignments_on_demote();

-- 3. Trusted access helper: Super Admin has all subjects; Tutors have assigned subjects only
create or replace function public.tutor_can_access_subject(p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      public.is_admin()
      and p_subject_id is not null
      and exists (
        select 1
        from public.tutor_subject_assignments tsa
        where tsa.tutor_id = auth.uid()
          and tsa.subject_id = p_subject_id
      )
    );
$$;

revoke all on function public.tutor_can_access_subject(uuid) from public, anon;
grant execute on function public.tutor_can_access_subject(uuid) to authenticated;

-- 4. Helper for tests attached to either a lesson or a topic
create or replace function public.tutor_can_access_test(p_topic_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      public.is_admin()
      and (
        (
          p_lesson_id is not null
          and exists (
            select 1
            from public.lessons l
            join public.topics t on t.id = l.topic_id
            where l.id = p_lesson_id
              and public.tutor_can_access_subject(t.subject_id)
          )
        )
        or (
          p_lesson_id is null
          and p_topic_id is not null
          and exists (
            select 1
            from public.topics t
            where t.id = p_topic_id
              and public.tutor_can_access_subject(t.subject_id)
          )
        )
      )
    );
$$;

revoke all on function public.tutor_can_access_test(uuid, uuid) from public, anon;
grant execute on function public.tutor_can_access_test(uuid, uuid) to authenticated;

-- 5. Super-Admin-only RPC to atomically set 0, 1, or multiple subjects for a Tutor
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
  on conflict (tutor_id, subject_id) do nothing;

  return query
  select tsa.tutor_id, tsa.subject_id
  from public.tutor_subject_assignments tsa
  where tsa.tutor_id = p_tutor_id;
end;
$$;

revoke all on function public.set_tutor_assigned_subjects(uuid, uuid[]) from public, anon;
grant execute on function public.set_tutor_assigned_subjects(uuid, uuid[]) to authenticated;
