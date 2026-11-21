-- Phosters Phase 4.2 Migration: Admin Broadcasts, Announcements & Links
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 001, 002, 003, and 004.

-- 1. Announcements table
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 2 and char_length(title) <= 160),
  message text not null check (char_length(trim(message)) >= 2),
  audience_type text not null default 'all' check (audience_type in ('all', 'exam', 'exam_subject')),
  exam_id uuid null references public.exams(id) on delete cascade,
  subject_id uuid null references public.subjects(id) on delete cascade,
  is_pinned boolean not null default false,
  is_published boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_announcement_audience_scope check (
    (audience_type = 'all' and exam_id is null and subject_id is null)
    or (audience_type = 'exam' and exam_id is not null and subject_id is null)
    or (audience_type = 'exam_subject' and exam_id is not null and subject_id is not null)
  )
);

create index if not exists idx_announcements_feed
  on public.announcements (is_published, is_pinned desc, created_at desc);

create index if not exists idx_announcements_scope
  on public.announcements (exam_id, subject_id);

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row
  execute function public.set_updated_at();

-- 2. Announcement links table (multiple safe external links per broadcast)
create table if not exists public.announcement_links (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 1 and char_length(title) <= 120),
  url text not null check (url ~* '^https?://'),
  display_order integer not null default 0
);

create index if not exists idx_announcement_links_order
  on public.announcement_links (announcement_id, display_order);

-- 3. Access helper for scoped broadcasts
create or replace function public.student_can_access_announcement(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.announcements a
    where a.id = p_announcement_id
      and (
        public.is_admin()
        or (
          a.is_published = true
          and (
            a.audience_type = 'all'
            or (
              a.audience_type = 'exam'
              and a.exam_id is not null
              and exists (
                select 1
                from public.student_exam_profiles sep
                where sep.student_id = auth.uid()
                  and sep.exam_id = a.exam_id
              )
            )
            or (
              a.audience_type = 'exam_subject'
              and a.exam_id is not null
              and a.subject_id is not null
              and public.student_has_subject_access(a.exam_id, a.subject_id)
            )
          )
        )
      )
  );
$$;

revoke all on function public.student_can_access_announcement(uuid) from public;
grant execute on function public.student_can_access_announcement(uuid) to authenticated;

-- 4. Row Level Security Policies
alter table public.announcements enable row level security;
alter table public.announcement_links enable row level security;

drop policy if exists "announcements_select_accessible" on public.announcements;
create policy "announcements_select_accessible"
  on public.announcements for select to authenticated
  using (public.student_can_access_announcement(id));

drop policy if exists "announcements_admin_all" on public.announcements;
create policy "announcements_admin_all"
  on public.announcements for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "announcement_links_select_accessible" on public.announcement_links;
create policy "announcement_links_select_accessible"
  on public.announcement_links for select to authenticated
  using (public.student_can_access_announcement(announcement_id));

drop policy if exists "announcement_links_admin_all" on public.announcement_links;
create policy "announcement_links_admin_all"
  on public.announcement_links for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
