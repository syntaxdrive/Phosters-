-- Phosters Migration 012a: Mock Exams Tables, Indexes & RLS
-- Run in Supabase SQL Editor AFTER 001, 002, 003, 010, and 011 (Step 1 of 4 for Mock Exams).

create table if not exists public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  description text null,
  duration_minutes integer not null default 120 check (duration_minutes >= 5 and duration_minutes <= 360),
  english_question_count integer not null default 60 check (english_question_count >= 1 and english_question_count <= 100),
  other_subject_question_count integer not null default 40 check (other_subject_question_count >= 1 and other_subject_question_count <= 100),
  uses_question_bank boolean not null default true,
  exclude_diagrams boolean not null default true,
  is_published boolean not null default false,
  show_explanations_after_submission boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mock_exams_exam_published
  on public.mock_exams (exam_id, is_published, updated_at desc);

drop trigger if exists trg_mock_exams_updated_at on public.mock_exams;
create trigger trg_mock_exams_updated_at
  before update on public.mock_exams
  for each row
  execute function public.set_updated_at();

create table if not exists public.mock_exam_custom_questions (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references public.mock_exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  question_text text not null check (char_length(trim(question_text)) >= 1),
  explanation text null,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  points integer not null default 1 check (points > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_mock_custom_q_exam_subject
  on public.mock_exam_custom_questions (mock_exam_id, subject_id, display_order);

create table if not exists public.mock_exam_custom_options (
  id uuid primary key default gen_random_uuid(),
  custom_question_id uuid not null references public.mock_exam_custom_questions(id) on delete cascade,
  option_key text not null check (char_length(trim(option_key)) >= 1),
  option_text text not null check (char_length(trim(option_text)) >= 1),
  is_correct boolean not null default false,
  display_order integer not null default 0
);

create index if not exists idx_mock_custom_opt_question
  on public.mock_exam_custom_options (custom_question_id, display_order);

create table if not exists public.mock_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  mock_exam_id uuid null references public.mock_exams(id) on delete set null,
  title text not null,
  mode text not null default 'full_mock' check (mode in ('full_mock', 'mini_mock', 'published_mock')),
  duration_minutes integer not null default 120 check (duration_minutes >= 5 and duration_minutes <= 360),
  started_at timestamptz not null default now(),
  submitted_at timestamptz null,
  elapsed_seconds integer null check (elapsed_seconds is null or elapsed_seconds >= 0),
  total_score_400 integer not null default 0 check (total_score_400 >= 0 and total_score_400 <= 400),
  total_correct integer not null default 0 check (total_correct >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  percentage numeric(5, 2) not null default 0 check (percentage >= 0 and percentage <= 100),
  show_explanations_after_submission boolean not null default true,
  subject_scores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mock_attempts_student_submitted
  on public.mock_attempts (student_id, submitted_at desc, started_at desc);

create table if not exists public.mock_attempt_items (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mock_attempts(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  subject_name text not null,
  subject_slug text not null,
  section_order integer not null default 0,
  question_order integer not null default 0,
  question_source text not null default 'bank' check (question_source in ('bank', 'custom')),
  source_question_id uuid null,
  question_text text not null,
  explanation text null,
  options_json jsonb not null default '[]'::jsonb,
  selected_option_key text null,
  correct_option_key text not null,
  is_correct boolean not null default false
);

create index if not exists idx_mock_attempt_items_attempt_order
  on public.mock_attempt_items (attempt_id, section_order, question_order);

alter table public.mock_exams enable row level security;
alter table public.mock_exam_custom_questions enable row level security;
alter table public.mock_exam_custom_options enable row level security;
alter table public.mock_attempts enable row level security;
alter table public.mock_attempt_items enable row level security;

drop policy if exists "mock_exams_select_published" on public.mock_exams;
create policy "mock_exams_select_published"
  on public.mock_exams for select to authenticated
  using (is_published = true or public.is_admin());

drop policy if exists "mock_exams_admin_all" on public.mock_exams;
create policy "mock_exams_admin_all"
  on public.mock_exams for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mock_custom_q_admin_all" on public.mock_exam_custom_questions;
create policy "mock_custom_q_admin_all"
  on public.mock_exam_custom_questions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mock_custom_opt_admin_all" on public.mock_exam_custom_options;
create policy "mock_custom_opt_admin_all"
  on public.mock_exam_custom_options for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mock_attempts_select_own" on public.mock_attempts;
create policy "mock_attempts_select_own"
  on public.mock_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "mock_attempts_admin_all" on public.mock_attempts;
create policy "mock_attempts_admin_all"
  on public.mock_attempts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mock_attempt_items_admin_all" on public.mock_attempt_items;
create policy "mock_attempt_items_admin_all"
  on public.mock_attempt_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
