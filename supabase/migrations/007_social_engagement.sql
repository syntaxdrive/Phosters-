-- Phosters Phase 5 Migration: Social Sharing Metadata, Course/Topic Comments (Admin Toggle), Likes & Views
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 001 - 006.

-- 1. Allow admins to enable or disable comments per topic
alter table public.topics
  add column if not exists comments_enabled boolean not null default true;

-- 2. Course / Topic Comments (attached to a topic, optionally noting the lesson being studied)
create table if not exists public.topic_comments (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  lesson_id uuid null references public.lessons(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) >= 1 and char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_topic_comments_topic_created
  on public.topic_comments (topic_id, created_at desc);

create index if not exists idx_topic_comments_user
  on public.topic_comments (user_id);

drop trigger if exists trg_topic_comments_updated_at on public.topic_comments;
create trigger trg_topic_comments_updated_at
  before update on public.topic_comments
  for each row
  execute function public.set_updated_at();

-- 3. Likes for courses (exam_id:subject_id), topics, and lessons
create table if not exists public.content_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('course', 'topic', 'lesson')),
  target_key text not null check (char_length(trim(target_key)) >= 3 and char_length(target_key) <= 120),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_key)
);

create index if not exists idx_content_likes_target
  on public.content_likes (target_type, target_key);

-- 4. Views counter & per-user deduplication for courses, topics, and lessons
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

create table if not exists public.content_view_counters (
  target_type text not null check (target_type in ('course', 'topic', 'lesson')),
  target_key text not null check (char_length(trim(target_key)) >= 3 and char_length(target_key) <= 120),
  views_count bigint not null default 0 check (views_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (target_type, target_key)
);

-- ============================================================================
-- Helper: Validate whether current user can view/engage with a target key
-- ============================================================================
create or replace function public.user_can_engage_target(
  p_target_type text,
  p_target_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_exam_id uuid;
  v_subject_id uuid;
  v_entity_id uuid;
  v_parts text[];
begin
  if v_user_id is null then
    return false;
  end if;

  if public.is_admin() then
    return p_target_type in ('course', 'topic', 'lesson')
      and char_length(trim(coalesce(p_target_key, ''))) >= 3;
  end if;

  if p_target_type = 'course' then
    v_parts := string_to_array(p_target_key, ':');
    if array_length(v_parts, 1) <> 2 then
      return false;
    end if;
    begin
      v_exam_id := v_parts[1]::uuid;
      v_subject_id := v_parts[2]::uuid;
    exception when invalid_text_representation then
      return false;
    end;
    return public.student_has_subject_access(v_exam_id, v_subject_id);
  elsif p_target_type = 'topic' then
    begin
      v_entity_id := p_target_key::uuid;
    exception when invalid_text_representation then
      return false;
    end;
    return exists (
      select 1
      from public.topics t
      where t.id = v_entity_id
        and t.is_published = true
        and public.student_has_subject_access(t.exam_id, t.subject_id)
    );
  elsif p_target_type = 'lesson' then
    begin
      v_entity_id := p_target_key::uuid;
    exception when invalid_text_representation then
      return false;
    end;
    return exists (
      select 1
      from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = v_entity_id
        and l.is_published = true
        and t.is_published = true
        and public.student_has_subject_access(t.exam_id, t.subject_id)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.user_can_engage_target(text, text) from public;
grant execute on function public.user_can_engage_target(text, text) to authenticated;

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================
alter table public.topic_comments enable row level security;
alter table public.content_likes enable row level security;
alter table public.content_views enable row level security;
alter table public.content_view_counters enable row level security;

-- Topic comments: enrolled students + admins can read; students can insert ONLY when topic.comments_enabled = true
drop policy if exists "topic_comments_select_enrolled" on public.topic_comments;
create policy "topic_comments_select_enrolled"
  on public.topic_comments for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.topics t
      where t.id = topic_id
        and t.is_published = true
        and public.student_has_subject_access(t.exam_id, t.subject_id)
    )
  );

drop policy if exists "topic_comments_insert_enabled" on public.topic_comments;
create policy "topic_comments_insert_enabled"
  on public.topic_comments for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or exists (
        select 1
        from public.topics t
        where t.id = topic_id
          and t.is_published = true
          and t.comments_enabled = true
          and public.student_has_subject_access(t.exam_id, t.subject_id)
      )
    )
  );

drop policy if exists "topic_comments_delete_own_or_admin" on public.topic_comments;
create policy "topic_comments_delete_own_or_admin"
  on public.topic_comments for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Content likes: direct row access limited to owner/admin (aggregates served via RPC)
drop policy if exists "content_likes_select_own_or_admin" on public.content_likes;
create policy "content_likes_select_own_or_admin"
  on public.content_likes for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "content_likes_insert_own" on public.content_likes;
create policy "content_likes_insert_own"
  on public.content_likes for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.user_can_engage_target(target_type, target_key)
  );

drop policy if exists "content_likes_delete_own_or_admin" on public.content_likes;
create policy "content_likes_delete_own_or_admin"
  on public.content_likes for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- View records & counters: read-only for own/authenticated; writes go through record_content_view RPC
drop policy if exists "content_views_select_own_or_admin" on public.content_views;
create policy "content_views_select_own_or_admin"
  on public.content_views for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "content_view_counters_select_auth" on public.content_view_counters;
create policy "content_view_counters_select_auth"
  on public.content_view_counters for select to authenticated
  using (auth.uid() is not null);

-- ============================================================================
-- Secure RPCs for Comments (author name without exposing profiles PII), Likes & Views
-- ============================================================================

-- 1. Fetch comments for a topic with safe author display name & role
create or replace function public.get_topic_comments(p_topic_id uuid)
returns table (
  id uuid,
  topic_id uuid,
  lesson_id uuid,
  user_id uuid,
  author_name text,
  author_role text,
  body text,
  created_at timestamptz,
  is_own boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from public.topics t
    where t.id = p_topic_id
      and t.is_published = true
      and public.student_has_subject_access(t.exam_id, t.subject_id)
  ) then
    raise exception 'You do not have access to this topic discussion';
  end if;

  return query
  select
    tc.id,
    tc.topic_id,
    tc.lesson_id,
    tc.user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Phosters Student') as author_name,
    coalesce(p.role, 'student') as author_role,
    tc.body,
    tc.created_at,
    (tc.user_id = v_user_id) as is_own
  from public.topic_comments tc
  left join public.profiles p on p.id = tc.user_id
  where tc.topic_id = p_topic_id
  order by tc.created_at desc
  limit 200;
end;
$$;

revoke all on function public.get_topic_comments(uuid) from public;
grant execute on function public.get_topic_comments(uuid) to authenticated;

-- 2. Record a content view once per user and return total unique views
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

-- 3. Toggle a like atomically and return updated state
create or replace function public.toggle_content_like(
  p_target_type text,
  p_target_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_liked boolean;
  v_likes_count bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.user_can_engage_target(p_target_type, p_target_key) then
    raise exception 'You do not have access to like this item';
  end if;

  if exists (
    select 1
    from public.content_likes
    where user_id = v_user_id
      and target_type = p_target_type
      and target_key = p_target_key
  ) then
    delete from public.content_likes
    where user_id = v_user_id
      and target_type = p_target_type
      and target_key = p_target_key;
    v_liked := false;
  else
    insert into public.content_likes (user_id, target_type, target_key)
    values (v_user_id, p_target_type, p_target_key)
    on conflict (user_id, target_type, target_key) do nothing;
    v_liked := true;
  end if;

  select count(*) into v_likes_count
  from public.content_likes
  where target_type = p_target_type
    and target_key = p_target_key;

  return jsonb_build_object(
    'liked', v_liked,
    'likes_count', coalesce(v_likes_count, 0)
  );
end;
$$;

revoke all on function public.toggle_content_like(text, text) from public;
grant execute on function public.toggle_content_like(text, text) to authenticated;

-- 4. Batch fetch engagement stats (likes, liked_by_me, views, topic comments count)
create or replace function public.get_engagement_stats(p_targets jsonb)
returns table (
  target_type text,
  target_key text,
  likes_count bigint,
  liked_by_me boolean,
  views_count bigint,
  comments_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with requested as (
    select distinct
      elem ->> 'target_type' as t_type,
      elem ->> 'target_key' as t_key
    from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb)) as elem
    where (elem ->> 'target_type') in ('course', 'topic', 'lesson')
      and char_length(trim(coalesce(elem ->> 'target_key', ''))) >= 3
  )
  select
    r.t_type as target_type,
    r.t_key as target_key,
    coalesce((
      select count(*)
      from public.content_likes cl
      where cl.target_type = r.t_type
        and cl.target_key = r.t_key
    ), 0)::bigint as likes_count,
    exists (
      select 1
      from public.content_likes cl
      where cl.target_type = r.t_type
        and cl.target_key = r.t_key
        and cl.user_id = v_user_id
    ) as liked_by_me,
    coalesce((
      select cv.views_count
      from public.content_view_counters cv
      where cv.target_type = r.t_type
        and cv.target_key = r.t_key
    ), 0)::bigint as views_count,
    case
      when r.t_type = 'topic' then coalesce((
        select count(*)
        from public.topic_comments tc
        where tc.topic_id::text = r.t_key
      ), 0)::bigint
      else 0::bigint
    end as comments_count
  from requested r;
end;
$$;

revoke all on function public.get_engagement_stats(jsonb) from public;
grant execute on function public.get_engagement_stats(jsonb) to authenticated;
