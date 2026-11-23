-- Phosters Migration 012: 4-Subject CBT Mock Exams & Secure Server-Side Grading
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 001, 002, 003, 010, and 011.

-- 1. Tutor/Admin Published Mock Exam Templates
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

-- 2. Optional Custom / AI-Set Fixed Questions attached to a Mock Exam per Subject
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

-- 3. Student Mock Exam Sessions / Attempts (4-Subject JAMB /400 + Subject Breakdown)
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

-- 4. Snapshotted Mock Questions per Attempt (Answer keys hidden from direct student SELECT)
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

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================
alter table public.mock_exams enable row level security;
alter table public.mock_exam_custom_questions enable row level security;
alter table public.mock_exam_custom_options enable row level security;
alter table public.mock_attempts enable row level security;
alter table public.mock_attempt_items enable row level security;

-- Mock exams: students can see published mocks for exams; admins manage all
drop policy if exists "mock_exams_select_published" on public.mock_exams;
create policy "mock_exams_select_published"
  on public.mock_exams for select to authenticated
  using (is_published = true or public.is_admin());

drop policy if exists "mock_exams_admin_all" on public.mock_exams;
create policy "mock_exams_admin_all"
  on public.mock_exams for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Custom mock questions & options: admins only (students use security definer RPCs)
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

-- Mock attempts: students can view only their own attempts; writes happen via RPC
drop policy if exists "mock_attempts_select_own" on public.mock_attempts;
create policy "mock_attempts_select_own"
  on public.mock_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "mock_attempts_admin_all" on public.mock_attempts;
create policy "mock_attempts_admin_all"
  on public.mock_attempts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Mock attempt items: restricted to admins directly; students read sanitized views via RPC
drop policy if exists "mock_attempt_items_admin_all" on public.mock_attempt_items;
create policy "mock_attempt_items_admin_all"
  on public.mock_attempt_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- Secure RPC 1: Bank Readiness Counts per Student Enrolled Subject (no content/keys)
-- ============================================================================
create or replace function public.get_student_mock_readiness(p_exam_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'subject_id', s.id,
        'subject_name', s.name,
        'subject_slug', s.slug,
        'approved_text_count', (
          select count(*)::integer
          from public.question_bank qb
          where qb.status = 'approved'
            and qb.subject_id = s.id
            and qb.needs_diagram = false
            and (p_exam_id is null or qb.exam_id = p_exam_id or qb.exam_id is null)
        ),
        'approved_total_count', (
          select count(*)::integer
          from public.question_bank qb
          where qb.status = 'approved'
            and qb.subject_id = s.id
            and (p_exam_id is null or qb.exam_id = p_exam_id or qb.exam_id is null)
        )
      )
      order by case when s.slug = 'english-language' then 0 else 1 end, s.name asc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select distinct ses.subject_id
    from public.student_exam_profiles sep
    join public.student_exam_subjects ses on ses.student_exam_profile_id = sep.id
    where sep.student_id = v_user_id
      and (p_exam_id is null or sep.exam_id = p_exam_id)
  ) enrolled
  join public.subjects s on s.id = enrolled.subject_id;

  return v_result;
end;
$$;

revoke all on function public.get_student_mock_readiness(uuid) from public;
grant execute on function public.get_student_mock_readiness(uuid) to authenticated;

-- ============================================================================
-- Secure RPC 2: Start Multi-Subject Mock Exam Session (returns NO answer keys)
-- ============================================================================
create or replace function public.start_mock_exam_session(
  p_exam_id uuid,
  p_mock_exam_id uuid default null,
  p_mode text default 'full_mock'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_exam public.exams%rowtype;
  v_mock public.mock_exams%rowtype;
  v_has_mock boolean := false;
  v_mode text := coalesce(nullif(trim(p_mode), ''), 'full_mock');
  v_duration_minutes integer := 120;
  v_english_target integer := 60;
  v_other_target integer := 40;
  v_uses_bank boolean := true;
  v_exclude_diagrams boolean := true;
  v_show_explanations boolean := true;
  v_title text;
  v_attempt_id uuid;
  v_started_at timestamptz := now();
  v_subject_count integer := 0;
  v_subj record;
  v_section_idx integer := 0;
  v_q_order integer := 0;
  v_target_for_subj integer := 40;
  v_custom_q record;
  v_bank_q record;
  v_opts_sanitized jsonb;
  v_correct_key text;
  v_total_inserted integer := 0;
  v_sections_json jsonb := '[]'::jsonb;
  v_section_questions jsonb;
  v_item_id uuid;
begin
  if v_student_id is null then
    raise exception 'Authentication required';
  end if;

  if v_mode not in ('full_mock', 'mini_mock', 'published_mock') then
    v_mode := 'full_mock';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found then
    raise exception 'Examination not found';
  end if;

  if p_mock_exam_id is not null then
    select * into v_mock from public.mock_exams where id = p_mock_exam_id;
    if not found then
      raise exception 'Mock exam template not found';
    end if;
    if not v_mock.is_published and not public.is_admin() then
      raise exception 'This mock exam is not published yet';
    end if;
    if v_mock.exam_id <> p_exam_id then
      raise exception 'Mock exam does not belong to the selected examination';
    end if;
    v_has_mock := true;
    v_mode := 'published_mock';
    v_duration_minutes := v_mock.duration_minutes;
    v_english_target := v_mock.english_question_count;
    v_other_target := v_mock.other_subject_question_count;
    v_uses_bank := v_mock.uses_question_bank;
    v_exclude_diagrams := v_mock.exclude_diagrams;
    v_show_explanations := v_mock.show_explanations_after_submission;
    v_title := v_mock.title;
  elsif v_mode = 'mini_mock' then
    v_duration_minutes := 30;
    v_english_target := 15;
    v_other_target := 10;
    v_title := v_exam.name || ' Quick 4-Subject Mini Mock';
  else
    if v_exam.slug = 'ui-post-utme' then
      v_duration_minutes := 60;
      v_english_target := 25;
      v_other_target := 25;
      v_title := v_exam.name || ' Timed CBT Mock';
    else
      v_duration_minutes := 120;
      v_english_target := 60;
      v_other_target := 40;
      v_title := v_exam.name || ' Full 4-Subject CBT Mock';
    end if;
  end if;

  select count(*)::integer
  into v_subject_count
  from public.student_exam_profiles sep
  join public.student_exam_subjects ses on ses.student_exam_profile_id = sep.id
  where sep.student_id = v_student_id
    and sep.exam_id = p_exam_id;

  if v_subject_count = 0 then
    raise exception 'You have not selected subjects for % yet. Open Exams & Subjects setup first.', v_exam.name;
  end if;

  if v_exam.slug = 'jamb-utme' and v_subject_count <> 4 then
    raise exception 'JAMB UTME requires exactly 4 subjects (Use of English + 3 electives). Update your subject combination first.';
  end if;

  insert into public.mock_attempts (
    student_id,
    exam_id,
    mock_exam_id,
    title,
    mode,
    duration_minutes,
    started_at,
    show_explanations_after_submission
  )
  values (
    v_student_id,
    p_exam_id,
    case when v_has_mock then v_mock.id else null end,
    v_title,
    v_mode,
    v_duration_minutes,
    v_started_at,
    v_show_explanations
  )
  returning id into v_attempt_id;

  for v_subj in
    select s.id, s.name, s.slug
    from public.student_exam_profiles sep
    join public.student_exam_subjects ses on ses.student_exam_profile_id = sep.id
    join public.subjects s on s.id = ses.subject_id
    where sep.student_id = v_student_id
      and sep.exam_id = p_exam_id
    order by case when s.slug = 'english-language' then 0 else 1 end, s.name asc
  loop
    v_section_idx := v_section_idx + 1;
    v_q_order := 0;
    v_section_questions := '[]'::jsonb;

    if v_subj.slug = 'english-language' then
      v_target_for_subj := v_english_target;
    else
      v_target_for_subj := v_other_target;
    end if;

    -- 1. Pull fixed custom/AI questions for this mock template & subject (if any)
    if v_has_mock then
      for v_custom_q in
        select q.id, q.question_text, q.explanation
        from public.mock_exam_custom_questions q
        where q.mock_exam_id = v_mock.id
          and q.subject_id = v_subj.id
        order by q.display_order asc, q.created_at asc
        limit v_target_for_subj
      loop
        select
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'key', o.option_key,
                'text', o.option_text
              )
              order by o.display_order asc, o.option_key asc
            ),
            '[]'::jsonb
          ),
          (
            select o2.option_key
            from public.mock_exam_custom_options o2
            where o2.custom_question_id = v_custom_q.id
              and o2.is_correct = true
            order by o2.display_order asc
            limit 1
          )
        into v_opts_sanitized, v_correct_key
        from public.mock_exam_custom_options o
        where o.custom_question_id = v_custom_q.id;

        if v_correct_key is not null and jsonb_array_length(v_opts_sanitized) >= 2 then
          v_q_order := v_q_order + 1;
          v_total_inserted := v_total_inserted + 1;

          insert into public.mock_attempt_items (
            attempt_id, subject_id, subject_name, subject_slug,
            section_order, question_order, question_source, source_question_id,
            question_text, explanation, options_json, correct_option_key
          )
          values (
            v_attempt_id, v_subj.id, v_subj.name, v_subj.slug,
            v_section_idx, v_q_order, 'custom', v_custom_q.id,
            v_custom_q.question_text, v_custom_q.explanation, v_opts_sanitized, v_correct_key
          )
          returning id into v_item_id;

          v_section_questions := v_section_questions || jsonb_build_array(
            jsonb_build_object(
              'id', v_item_id,
              'question_text', v_custom_q.question_text,
              'options', v_opts_sanitized
            )
          );
        end if;
      end loop;
    end if;

    -- 2. Draw remaining questions from approved Question Bank for this subject
    if v_uses_bank and v_q_order < v_target_for_subj then
      for v_bank_q in
        select qb.id, qb.question_text, qb.explanation
        from public.question_bank qb
        where qb.status = 'approved'
          and qb.subject_id = v_subj.id
          and (not v_exclude_diagrams or qb.needs_diagram = false)
        order by
          case when qb.exam_id = p_exam_id then 0 when qb.exam_id is null then 1 else 2 end asc,
          random()
        limit (v_target_for_subj - v_q_order)
      loop
        select
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'key', o.option_key,
                'text', o.option_text
              )
              order by o.display_order asc, o.option_key asc
            ),
            '[]'::jsonb
          ),
          (
            select o2.option_key
            from public.question_bank_options o2
            where o2.bank_question_id = v_bank_q.id
              and o2.is_correct = true
            order by o2.display_order asc
            limit 1
          )
        into v_opts_sanitized, v_correct_key
        from public.question_bank_options o
        where o.bank_question_id = v_bank_q.id;

        if v_correct_key is not null and jsonb_array_length(v_opts_sanitized) >= 2 then
          v_q_order := v_q_order + 1;
          v_total_inserted := v_total_inserted + 1;

          insert into public.mock_attempt_items (
            attempt_id, subject_id, subject_name, subject_slug,
            section_order, question_order, question_source, source_question_id,
            question_text, explanation, options_json, correct_option_key
          )
          values (
            v_attempt_id, v_subj.id, v_subj.name, v_subj.slug,
            v_section_idx, v_q_order, 'bank', v_bank_q.id,
            v_bank_q.question_text, v_bank_q.explanation, v_opts_sanitized, v_correct_key
          )
          returning id into v_item_id;

          v_section_questions := v_section_questions || jsonb_build_array(
            jsonb_build_object(
              'id', v_item_id,
              'question_text', v_bank_q.question_text,
              'options', v_opts_sanitized
            )
          );
        end if;
      end loop;
    end if;

    v_sections_json := v_sections_json || jsonb_build_array(
      jsonb_build_object(
        'subject_id', v_subj.id,
        'subject_name', v_subj.name,
        'subject_slug', v_subj.slug,
        'section_order', v_section_idx,
        'target_count', v_target_for_subj,
        'available_count', v_q_order,
        'questions', v_section_questions
      )
    );
  end loop;

  if v_total_inserted = 0 then
    delete from public.mock_attempts where id = v_attempt_id;
    raise exception 'No approved questions are ready in the Question Bank for your selected subjects yet.';
  end if;

  update public.mock_attempts
  set total_questions = v_total_inserted
  where id = v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'exam_id', v_exam.id,
    'exam_name', v_exam.name,
    'exam_slug', v_exam.slug,
    'mock_exam_id', case when v_has_mock then v_mock.id else null end,
    'title', v_title,
    'mode', v_mode,
    'duration_minutes', v_duration_minutes,
    'started_at', v_started_at,
    'show_explanations_after_submission', v_show_explanations,
    'total_questions', v_total_inserted,
    'sections', v_sections_json
  );
end;
$$;

revoke all on function public.start_mock_exam_session(uuid, uuid, text) from public;
grant execute on function public.start_mock_exam_session(uuid, uuid, text) to authenticated;

-- ============================================================================
-- Secure RPC 3: Resume Pending Mock Session Without Answer Keys
-- ============================================================================
create or replace function public.get_pending_mock_session(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.mock_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_sections jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_attempt
  from public.mock_attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Mock session not found';
  end if;

  if v_attempt.student_id <> v_user_id then
    raise exception 'Unauthorized access to mock session';
  end if;

  if v_attempt.submitted_at is not null then
    raise exception 'ALREADY_SUBMITTED';
  end if;

  select * into v_exam from public.exams where id = v_attempt.exam_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'subject_id', sec.subject_id,
        'subject_name', sec.subject_name,
        'subject_slug', sec.subject_slug,
        'section_order', sec.section_order,
        'target_count', sec.q_count,
        'available_count', sec.q_count,
        'questions', sec.questions
      )
      order by sec.section_order asc
    ),
    '[]'::jsonb
  )
  into v_sections
  from (
    select
      mai.subject_id,
      mai.subject_name,
      mai.subject_slug,
      mai.section_order,
      count(*)::integer as q_count,
      jsonb_agg(
        jsonb_build_object(
          'id', mai.id,
          'question_text', mai.question_text,
          'options', mai.options_json
        )
        order by mai.question_order asc
      ) as questions
    from public.mock_attempt_items mai
    where mai.attempt_id = v_attempt.id
    group by mai.subject_id, mai.subject_name, mai.subject_slug, mai.section_order
  ) sec;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'exam_id', v_attempt.exam_id,
    'exam_name', v_exam.name,
    'exam_slug', v_exam.slug,
    'mock_exam_id', v_attempt.mock_exam_id,
    'title', v_attempt.title,
    'mode', v_attempt.mode,
    'duration_minutes', v_attempt.duration_minutes,
    'started_at', v_attempt.started_at,
    'show_explanations_after_submission', v_attempt.show_explanations_after_submission,
    'total_questions', v_attempt.total_questions,
    'sections', v_sections
  );
end;
$$;

revoke all on function public.get_pending_mock_session(uuid) from public;
grant execute on function public.get_pending_mock_session(uuid) to authenticated;

-- ============================================================================
-- Secure RPC 4: Grade Mock Exam Attempt & Compute JAMB /400 Breakdown
-- ============================================================================
create or replace function public.submit_mock_attempt(
  p_attempt_id uuid,
  p_answers jsonb,
  p_elapsed_seconds integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_attempt public.mock_attempts%rowtype;
  v_item record;
  v_selected text;
  v_is_correct boolean;
  v_total_correct integer := 0;
  v_total_questions integer := 0;
  v_percentage numeric(5, 2) := 0;
  v_subject_scores jsonb := '[]'::jsonb;
  v_sum_400 integer := 0;
  v_subject_count integer := 0;
  v_total_400 integer := 0;
begin
  if v_student_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_attempt
  from public.mock_attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Mock exam session not found';
  end if;

  if v_attempt.student_id <> v_student_id then
    raise exception 'You do not have permission to submit this mock attempt';
  end if;

  -- Idempotent return if already graded (safe for offline queue retries)
  if v_attempt.submitted_at is not null then
    return v_attempt.id;
  end if;

  for v_item in
    select id, correct_option_key
    from public.mock_attempt_items
    where attempt_id = v_attempt.id
    order by section_order asc, question_order asc
  loop
    v_total_questions := v_total_questions + 1;
    v_selected := null;
    v_is_correct := false;

    if p_answers is not null and jsonb_typeof(p_answers) = 'object' then
      v_selected := upper(nullif(trim(p_answers ->> v_item.id::text), ''));
    end if;

    if v_selected is not null and v_selected = upper(trim(v_item.correct_option_key)) then
      v_is_correct := true;
      v_total_correct := v_total_correct + 1;
    end if;

    update public.mock_attempt_items
    set
      selected_option_key = v_selected,
      is_correct = v_is_correct
    where id = v_item.id;
  end loop;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'subject_id', s.subject_id,
          'subject_name', s.subject_name,
          'subject_slug', s.subject_slug,
          'correct', s.correct_cnt,
          'total', s.total_cnt,
          'jamb_score_100', case
            when s.total_cnt > 0 then round((s.correct_cnt::numeric / s.total_cnt::numeric) * 100.0)::integer
            else 0
          end,
          'percentage', case
            when s.total_cnt > 0 then round((s.correct_cnt::numeric / s.total_cnt::numeric) * 100.0, 2)
            else 0
          end
        )
        order by s.section_order asc
      ),
      '[]'::jsonb
    ),
    coalesce(sum(
      case
        when s.total_cnt > 0 then round((s.correct_cnt::numeric / s.total_cnt::numeric) * 100.0)::integer
        else 0
      end
    ), 0)::integer,
    count(*)::integer
  into v_subject_scores, v_sum_400, v_subject_count
  from (
    select
      mai.subject_id,
      mai.subject_name,
      mai.subject_slug,
      mai.section_order,
      count(*)::integer as total_cnt,
      count(*) filter (where mai.is_correct = true)::integer as correct_cnt
    from public.mock_attempt_items mai
    where mai.attempt_id = v_attempt.id
    group by mai.subject_id, mai.subject_name, mai.subject_slug, mai.section_order
  ) s;

  if v_total_questions > 0 then
    v_percentage := round((v_total_correct::numeric / v_total_questions::numeric) * 100.0, 2);
  end if;

  if v_subject_count = 4 then
    v_total_400 := least(400, greatest(0, v_sum_400));
  elsif v_total_questions > 0 then
    v_total_400 := least(400, greatest(0, round((v_total_correct::numeric / v_total_questions::numeric) * 400.0)::integer));
  end if;

  update public.mock_attempts
  set
    submitted_at = now(),
    elapsed_seconds = case when p_elapsed_seconds is not null and p_elapsed_seconds >= 0 then p_elapsed_seconds else null end,
    total_correct = v_total_correct,
    total_questions = v_total_questions,
    percentage = v_percentage,
    total_score_400 = v_total_400,
    subject_scores = v_subject_scores
  where id = v_attempt.id;

  return v_attempt.id;
end;
$$;

revoke all on function public.submit_mock_attempt(uuid, jsonb, integer) from public;
grant execute on function public.submit_mock_attempt(uuid, jsonb, integer) to authenticated;

-- ============================================================================
-- Secure RPC 5: Mock Attempt Score Breakdown & Gated Answer Review
-- ============================================================================
create or replace function public.get_mock_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.mock_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_sections jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_attempt
  from public.mock_attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Mock exam attempt not found';
  end if;

  if v_attempt.student_id <> v_user_id and not public.is_admin() then
    raise exception 'Unauthorized access to mock attempt';
  end if;

  if v_attempt.submitted_at is null then
    raise exception 'This mock exam has not been submitted yet';
  end if;

  select * into v_exam from public.exams where id = v_attempt.exam_id;

  if v_attempt.show_explanations_after_submission then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'subject_id', sec.subject_id,
          'subject_name', sec.subject_name,
          'subject_slug', sec.subject_slug,
          'section_order', sec.section_order,
          'items', sec.items
        )
        order by sec.section_order asc
      ),
      '[]'::jsonb
    )
    into v_sections
    from (
      select
        mai.subject_id,
        mai.subject_name,
        mai.subject_slug,
        mai.section_order,
        jsonb_agg(
          jsonb_build_object(
            'id', mai.id,
            'question_order', mai.question_order,
            'question_text', mai.question_text,
            'explanation', mai.explanation,
            'options', mai.options_json,
            'selected_option_key', mai.selected_option_key,
            'correct_option_key', mai.correct_option_key,
            'is_correct', mai.is_correct
          )
          order by mai.question_order asc
        ) as items
      from public.mock_attempt_items mai
      where mai.attempt_id = v_attempt.id
      group by mai.subject_id, mai.subject_name, mai.subject_slug, mai.section_order
    ) sec;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'exam_id', v_attempt.exam_id,
      'exam_name', v_exam.name,
      'exam_slug', v_exam.slug,
      'mock_exam_id', v_attempt.mock_exam_id,
      'title', v_attempt.title,
      'mode', v_attempt.mode,
      'duration_minutes', v_attempt.duration_minutes,
      'started_at', v_attempt.started_at,
      'submitted_at', v_attempt.submitted_at,
      'elapsed_seconds', v_attempt.elapsed_seconds,
      'total_score_400', v_attempt.total_score_400,
      'total_correct', v_attempt.total_correct,
      'total_questions', v_attempt.total_questions,
      'percentage', v_attempt.percentage,
      'show_explanations_after_submission', v_attempt.show_explanations_after_submission,
      'subject_scores', v_attempt.subject_scores
    ),
    'sections', v_sections
  );
end;
$$;

revoke all on function public.get_mock_attempt_review(uuid) from public;
grant execute on function public.get_mock_attempt_review(uuid) to authenticated;
