-- Phosters Migration 008: Enforce Unique Per-User Content Views (Course, Topic, Lesson)
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 007_social_engagement.sql.

-- 1. Track unique views per user and target so reopening/refreshing never increments twice
create table if not exists public.content_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('course', 'topic', 'lesson')),
  target_key text not null check (char_length(trim(target_key)) >= 3 and char_length(target_key) <= 120),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_key)
);

create index if not exists idx_content_views_target
  on public.content_views (target_type, target_key);

alter table public.content_views enable row level security;

drop policy if exists "content_views_select_own_or_admin" on public.content_views;
create policy "content_views_select_own_or_admin"
  on public.content_views for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 2. Replace record_content_view to increment at most once per user per target
create or replace function public.record_content_view(
  p_target_type text,
  p_target_key text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted_id uuid;
  v_views bigint;
begin
  if v_user_id is null then
    return 0;
  end if;

  if not public.user_can_engage_target(p_target_type, p_target_key) then
    return 0;
  end if;

  insert into public.content_views (user_id, target_type, target_key)
  values (v_user_id, p_target_type, p_target_key)
  on conflict (user_id, target_type, target_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    insert into public.content_view_counters (target_type, target_key, views_count, updated_at)
    values (p_target_type, p_target_key, 1, now())
    on conflict (target_type, target_key)
    do update set
      views_count = public.content_view_counters.views_count + 1,
      updated_at = now()
    returning views_count into v_views;
  else
    select cvc.views_count into v_views
    from public.content_view_counters cvc
    where cvc.target_type = p_target_type
      and cvc.target_key = p_target_key;
  end if;

  return coalesce(v_views, 0);
end;
$$;

revoke all on function public.record_content_view(text, text) from public;
grant execute on function public.record_content_view(text, text) to authenticated;
