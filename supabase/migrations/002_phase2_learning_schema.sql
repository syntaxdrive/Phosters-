-- Phosters Phase 2 Migration: Examinations, Subjects, Student Profiles, Topics, Lessons, Materials, Links & Progress
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 001_phase1_profiles_and_auth.sql.

-- 1. Examinations
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null unique,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Subjects
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null unique,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Exam <-> Subject configuration (separate combinations per examination)
create table if not exists public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  is_active boolean not null default true,
  is_compulsory boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (exam_id, subject_id)
);

create index if not exists idx_exam_subjects_exam_order on public.exam_subjects (exam_id, display_order);

-- 4. Student Examination Profiles (one per student + exam)
create table if not exists public.student_exam_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  intended_course text null check (intended_course is null or char_length(intended_course) <= 150),
  institution text null check (institution is null or char_length(institution) <= 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, exam_id)
);

create index if not exists idx_student_exam_profiles_student on public.student_exam_profiles (student_id);

drop trigger if exists trg_student_exam_profiles_updated_at on public.student_exam_profiles;
create trigger trg_student_exam_profiles_updated_at
  before update on public.student_exam_profiles
  for each row
  execute function public.set_updated_at();

-- 5. Student Selected Subjects per Examination Profile
create table if not exists public.student_exam_subjects (
  id uuid primary key default gen_random_uuid(),
  student_exam_profile_id uuid not null references public.student_exam_profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_exam_profile_id, subject_id)
);

create index if not exists idx_student_exam_subjects_profile on public.student_exam_subjects (student_exam_profile_id);

-- 6. Topics
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  description text null,
  display_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_topics_exam_subject_order on public.topics (exam_id, subject_id, display_order);

drop trigger if exists trg_topics_updated_at on public.topics;
create trigger trg_topics_updated_at
  before update on public.topics
  for each row
  execute function public.set_updated_at();

-- 7. Lessons
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  short_description text null,
  description text null,
  tutor_name text null,
  youtube_url text null,
  display_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lessons_topic_order on public.lessons (topic_id, display_order);

drop trigger if exists trg_lessons_updated_at on public.lessons;
create trigger trg_lessons_updated_at
  before update on public.lessons
  for each row
  execute function public.set_updated_at();

-- 8. Lesson Materials (GitHub raw file URLs)
create table if not exists public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 1),
  file_type text not null default 'pdf' check (file_type in ('pdf', 'image', 'zip', 'other')),
  file_url text not null check (file_url ~* '^https://raw\.githubusercontent\.com/'),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_materials_lesson_order on public.lesson_materials (lesson_id, display_order);

-- 9. Lesson Important Links
create table if not exists public.lesson_links (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 1),
  url text not null check (url ~* '^https?://'),
  display_order integer not null default 0
);

create index if not exists idx_lesson_links_lesson_order on public.lesson_links (lesson_id, display_order);

-- 10. Reliable Lesson Progress / Continue Learning tracking
create table if not exists public.student_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz null,
  last_opened_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create index if not exists idx_student_lesson_progress_recent on public.student_lesson_progress (student_id, last_opened_at desc);

-- ============================================================================
-- Helper function for checking if the current student has enrolled in exam+subject
-- ============================================================================
create or replace function public.student_has_subject_access(p_exam_id uuid, p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_exam_profiles sep
    join public.student_exam_subjects ses
      on ses.student_exam_profile_id = sep.id
    where sep.student_id = auth.uid()
      and sep.exam_id = p_exam_id
      and ses.subject_id = p_subject_id
  );
$$;

revoke all on function public.student_has_subject_access(uuid, uuid) from public;
grant execute on function public.student_has_subject_access(uuid, uuid) to authenticated;

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================
alter table public.exams enable row level security;
alter table public.subjects enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.student_exam_profiles enable row level security;
alter table public.student_exam_subjects enable row level security;
alter table public.topics enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_materials enable row level security;
alter table public.lesson_links enable row level security;
alter table public.student_lesson_progress enable row level security;

-- Exams
drop policy if exists "exams_select_active" on public.exams;
create policy "exams_select_active"
  on public.exams for select to authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "exams_admin_all" on public.exams;
create policy "exams_admin_all"
  on public.exams for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Subjects
drop policy if exists "subjects_select_active" on public.subjects;
create policy "subjects_select_active"
  on public.subjects for select to authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "subjects_admin_all" on public.subjects;
create policy "subjects_admin_all"
  on public.subjects for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Exam Subjects
drop policy if exists "exam_subjects_select_active" on public.exam_subjects;
create policy "exam_subjects_select_active"
  on public.exam_subjects for select to authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "exam_subjects_admin_all" on public.exam_subjects;
create policy "exam_subjects_admin_all"
  on public.exam_subjects for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Student Exam Profiles
drop policy if exists "student_exam_profiles_own" on public.student_exam_profiles;
create policy "student_exam_profiles_own"
  on public.student_exam_profiles for all to authenticated
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- Student Exam Subjects
drop policy if exists "student_exam_subjects_own" on public.student_exam_subjects;
create policy "student_exam_subjects_own"
  on public.student_exam_subjects for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.student_exam_profiles sep
      where sep.id = student_exam_profile_id
        and sep.student_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.student_exam_profiles sep
      where sep.id = student_exam_profile_id
        and sep.student_id = auth.uid()
    )
  );

-- Topics: students can only read published topics in their enrolled exam + subject
drop policy if exists "topics_select_enrolled" on public.topics;
create policy "topics_select_enrolled"
  on public.topics for select to authenticated
  using (
    public.is_admin()
    or (
      is_published = true
      and public.student_has_subject_access(exam_id, subject_id)
    )
  );

drop policy if exists "topics_admin_all" on public.topics;
create policy "topics_admin_all"
  on public.topics for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Lessons: students can only read published lessons inside accessible published topics
drop policy if exists "lessons_select_enrolled" on public.lessons;
create policy "lessons_select_enrolled"
  on public.lessons for select to authenticated
  using (
    public.is_admin()
    or (
      is_published = true
      and exists (
        select 1 from public.topics t
        where t.id = topic_id
          and t.is_published = true
          and public.student_has_subject_access(t.exam_id, t.subject_id)
      )
    )
  );

drop policy if exists "lessons_admin_all" on public.lessons;
create policy "lessons_admin_all"
  on public.lessons for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Lesson Materials: accessible when parent lesson is accessible
drop policy if exists "lesson_materials_select_enrolled" on public.lesson_materials;
create policy "lesson_materials_select_enrolled"
  on public.lesson_materials for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = lesson_id
        and l.is_published = true
        and t.is_published = true
        and public.student_has_subject_access(t.exam_id, t.subject_id)
    )
  );

drop policy if exists "lesson_materials_admin_all" on public.lesson_materials;
create policy "lesson_materials_admin_all"
  on public.lesson_materials for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Lesson Links: accessible when parent lesson is accessible
drop policy if exists "lesson_links_select_enrolled" on public.lesson_links;
create policy "lesson_links_select_enrolled"
  on public.lesson_links for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = lesson_id
        and l.is_published = true
        and t.is_published = true
        and public.student_has_subject_access(t.exam_id, t.subject_id)
    )
  );

drop policy if exists "lesson_links_admin_all" on public.lesson_links;
create policy "lesson_links_admin_all"
  on public.lesson_links for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Student Lesson Progress
drop policy if exists "student_lesson_progress_own" on public.student_lesson_progress;
create policy "student_lesson_progress_own"
  on public.student_lesson_progress for all to authenticated
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- ============================================================================
-- Seed Official Examinations & Core Subject Options (Editable by Admin in Phase 3)
-- Note: No fake lessons or fake results are seeded.
-- ============================================================================
insert into public.exams (name, slug, description, is_active)
values
  ('JAMB UTME', 'jamb-utme', 'Joint Admissions and Matriculation Board Unified Tertiary Matriculation Examination (English Language plus 3 subjects).', true),
  ('UI Post-UTME', 'ui-post-utme', 'University of Ibadan Post-UTME screening examination with course-specific subject requirements.', true)
on conflict (slug) do nothing;

insert into public.subjects (name, slug, description, is_active)
values
  ('English Language', 'english-language', 'Comprehension, lexis and structure, oral forms, and essay fundamentals.', true),
  ('Mathematics', 'mathematics', 'Algebra, geometry, trigonometry, calculus, and statistics.', true),
  ('Physics', 'physics', 'Mechanics, waves, optics, electricity, magnetism, and modern physics.', true),
  ('Chemistry', 'chemistry', 'Stoichiometry, chemical bonding, organic chemistry, and electrochemistry.', true),
  ('Biology', 'biology', 'Cell biology, genetics, ecology, and human physiology.', true),
  ('Literature in English', 'literature-in-english', 'Prose, drama, poetry, and literary appreciation.', true),
  ('Government', 'government', 'Political institutions, Nigerian constitutional development, and international relations.', true),
  ('Economics', 'economics', 'Microeconomics, macroeconomics, market structures, and national income.', true),
  ('Christian Religious Studies', 'christian-religious-studies', 'Old and New Testament themes and moral teachings.', true),
  ('History', 'history', 'Nigerian history, West African states, and modern global history.', true),
  ('Geography', 'geography', 'Physical geography, map reading, and human geography.', true),
  ('Agricultural Science', 'agricultural-science', 'Crop production, soil science, animal husbandry, and agricultural economics.', true),
  ('Commerce', 'commerce', 'Trade, business organisations, banking, and consumer protection.', true),
  ('Financial Accounting', 'financial-accounting', 'Double-entry bookkeeping, financial statements, and partnership accounts.', true)
on conflict (slug) do nothing;

-- Map subjects to JAMB UTME (English compulsory) and UI Post-UTME
insert into public.exam_subjects (exam_id, subject_id, is_active, is_compulsory, display_order)
select
  e.id,
  s.id,
  true,
  (e.slug = 'jamb-utme' and s.slug = 'english-language'),
  case s.slug
    when 'english-language' then 1
    when 'mathematics' then 2
    when 'physics' then 3
    when 'chemistry' then 4
    when 'biology' then 5
    when 'literature-in-english' then 6
    when 'government' then 7
    when 'economics' then 8
    when 'christian-religious-studies' then 9
    when 'history' then 10
    when 'geography' then 11
    when 'agricultural-science' then 12
    when 'commerce' then 13
    when 'financial-accounting' then 14
    else 99
  end
from public.exams e
cross join public.subjects s
on conflict (exam_id, subject_id) do nothing;
