-- Phosters Migration 011: Super Admin Question Bank & Document Import Batches
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 001, 002, 003, and 010.

-- 1. Upload / conversion batches table (audit trail of ingested PDF/DOCX/TXT files)
create table if not exists public.question_bank_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (char_length(trim(file_name)) >= 1),
  source_format text not null check (source_format in ('pdf', 'docx', 'txt', 'csv', 'md', 'html', 'rtf', 'paste')),
  exam_id uuid null references public.exams(id) on delete set null,
  subject_id uuid null references public.subjects(id) on delete set null,
  exam_year integer null check (exam_year is null or (exam_year >= 1978 and exam_year <= 2035)),
  raw_char_count integer not null default 0 check (raw_char_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  uploaded_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_qb_batches_created_at on public.question_bank_batches (created_at desc);

-- 2. Reusable Question Bank items
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid null references public.question_bank_batches(id) on delete set null,
  exam_id uuid null references public.exams(id) on delete set null,
  subject_id uuid null references public.subjects(id) on delete set null,
  topic_id uuid null references public.topics(id) on delete set null,
  exam_year integer null check (exam_year is null or (exam_year >= 1978 and exam_year <= 2035)),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  section_label text null,
  question_text text not null check (char_length(trim(question_text)) >= 1),
  explanation text null,
  points integer not null default 1 check (points > 0),
  needs_diagram boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  source_reference text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_qb_exam_subject_status on public.question_bank (exam_id, subject_id, status);
create index if not exists idx_qb_topic on public.question_bank (topic_id);
create index if not exists idx_qb_year on public.question_bank (exam_year);
create index if not exists idx_qb_batch on public.question_bank (batch_id);
create index if not exists idx_qb_created_at on public.question_bank (created_at desc);

drop trigger if exists trg_question_bank_set_updated_at on public.question_bank;
create trigger trg_question_bank_set_updated_at
  before update on public.question_bank
  for each row
  execute function public.set_updated_at();

-- 3. Question Bank answer options (never directly readable by students)
create table if not exists public.question_bank_options (
  id uuid primary key default gen_random_uuid(),
  bank_question_id uuid not null references public.question_bank(id) on delete cascade,
  option_key text not null check (char_length(trim(option_key)) >= 1),
  option_text text not null check (char_length(trim(option_text)) >= 1),
  is_correct boolean not null default false,
  display_order integer not null default 0
);

create index if not exists idx_qb_options_question_order
  on public.question_bank_options (bank_question_id, display_order);

-- 4. Row Level Security
alter table public.question_bank_batches enable row level security;
alter table public.question_bank enable row level security;
alter table public.question_bank_options enable row level security;

-- Super Admin manages upload batches
drop policy if exists "qb_batches_super_admin_all" on public.question_bank_batches;
create policy "qb_batches_super_admin_all"
  on public.question_bank_batches
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Super Admin manages all bank questions; regular Tutors/Admins can read approved items to build tests
drop policy if exists "qb_super_admin_all" on public.question_bank;
create policy "qb_super_admin_all"
  on public.question_bank
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "qb_admin_select_approved" on public.question_bank;
create policy "qb_admin_select_approved"
  on public.question_bank
  for select
  to authenticated
  using (public.is_admin() and status = 'approved');

-- Question options mirror parent access rules
drop policy if exists "qb_options_super_admin_all" on public.question_bank_options;
create policy "qb_options_super_admin_all"
  on public.question_bank_options
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "qb_options_admin_select_approved" on public.question_bank_options;
create policy "qb_options_admin_select_approved"
  on public.question_bank_options
  for select
  to authenticated
  using (
    public.is_admin()
    and exists (
      select 1
      from public.question_bank qb
      where qb.id = bank_question_id
        and qb.status = 'approved'
    )
  );
