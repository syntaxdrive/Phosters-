-- Phosters Phase 4 Migration: Integrated CBT / Test Engine & Secure Server-Side Grading
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 001 and 002.

-- 1. Tests table (attached to a topic or a specific lesson)
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) >= 2),
  description text null,
  topic_id uuid null references public.topics(id) on delete set null,
  lesson_id uuid null references public.lessons(id) on delete set null,
  is_published boolean not null default false,
  show_explanations_after_submission boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tests_topic on public.tests (topic_id);
create index if not exists idx_tests_lesson on public.tests (lesson_id);

drop trigger if exists trg_tests_updated_at on public.tests;
create trigger trg_tests_updated_at
  before update on public.tests
  for each row
  execute function public.set_updated_at();

-- 2. Questions table (explanation kept hidden from students until reviewed post-submission)
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question_text text not null check (char_length(trim(question_text)) >= 1),
  explanation text null,
  display_order integer not null default 0,
  points integer not null default 1 check (points > 0)
);

create index if not exists idx_questions_test_order on public.questions (test_id, display_order);

-- 3. Question options table (is_correct MUST NEVER be readable by students via direct SELECT)
create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null check (char_length(trim(option_text)) >= 1),
  option_key text not null check (char_length(trim(option_key)) >= 1),
  is_correct boolean not null default false,
  display_order integer not null default 0
);

create index if not exists idx_question_options_question_order on public.question_options (question_id, display_order);

-- 4. Test attempts table
create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  total_points integer not null default 0 check (total_points >= 0),
  percentage numeric(5, 2) not null default 0 check (percentage >= 0 and percentage <= 100),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_test_attempts_student_submitted on public.test_attempts (student_id, submitted_at desc);
create index if not exists idx_test_attempts_test on public.test_attempts (test_id);

-- 5. Attempt answers table
create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid null references public.question_options(id) on delete set null,
  is_correct boolean not null default false,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  unique (attempt_id, question_id)
);

create index if not exists idx_attempt_answers_attempt on public.attempt_answers (attempt_id);

-- ============================================================================
-- Helper: Verify whether current user has access to a test
-- ============================================================================
create or replace function public.student_can_access_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tests tst
    left join public.lessons l on l.id = tst.lesson_id
    left join public.topics tl on tl.id = l.topic_id
    left join public.topics tt on tt.id = tst.topic_id
    where tst.id = p_test_id
      and (
        public.is_admin()
        or (
          tst.is_published = true
          and (
            (
              tst.lesson_id is not null
              and l.is_published = true
              and tl.is_published = true
              and public.student_has_subject_access(tl.exam_id, tl.subject_id)
            )
            or (
              tst.lesson_id is null
              and tst.topic_id is not null
              and tt.is_published = true
              and public.student_has_subject_access(tt.exam_id, tt.subject_id)
            )
          )
        )
      )
  );
$$;

revoke all on function public.student_can_access_test(uuid) from public;
grant execute on function public.student_can_access_test(uuid) to authenticated;

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.test_attempts enable row level security;
alter table public.attempt_answers enable row level security;

-- Tests: students can read published tests they have subject access to; admins manage all
drop policy if exists "tests_select_accessible" on public.tests;
create policy "tests_select_accessible"
  on public.tests for select to authenticated
  using (public.student_can_access_test(id));

drop policy if exists "tests_admin_all" on public.tests;
create policy "tests_admin_all"
  on public.tests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Questions & Options: direct table SELECT restricted to admins ONLY
-- Students receive sanitized questions/options (without is_correct or explanation) via RPC.
drop policy if exists "questions_admin_all" on public.questions;
create policy "questions_admin_all"
  on public.questions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "question_options_admin_all" on public.question_options;
create policy "question_options_admin_all"
  on public.question_options for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Test attempts: students can read ONLY their own attempts; writes happen via submit_test_attempt RPC
drop policy if exists "test_attempts_select_own" on public.test_attempts;
create policy "test_attempts_select_own"
  on public.test_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "test_attempts_admin_all" on public.test_attempts;
create policy "test_attempts_admin_all"
  on public.test_attempts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Attempt answers: students can read ONLY answers belonging to their own attempts
drop policy if exists "attempt_answers_select_own" on public.attempt_answers;
create policy "attempt_answers_select_own"
  on public.attempt_answers for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.test_attempts ta
      where ta.id = attempt_id
        and ta.student_id = auth.uid()
    )
  );

drop policy if exists "attempt_answers_admin_all" on public.attempt_answers;
create policy "attempt_answers_admin_all"
  on public.attempt_answers for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- Secure RPC 1: Fetch published test questions WITHOUT answer keys or explanations
-- ============================================================================
create or replace function public.get_published_test_for_student(p_test_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_test public.tests%rowtype;
  v_questions jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.student_can_access_test(p_test_id) then
    raise exception 'Test not found or not accessible';
  end if;

  select * into v_test
  from public.tests
  where id = p_test_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'display_order', q.display_order,
        'points', q.points,
        'options', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', o.id,
              'option_key', o.option_key,
              'option_text', o.option_text,
              'display_order', o.display_order
            )
            order by o.display_order asc, o.option_key asc
          )
          from public.question_options o
          where o.question_id = q.id
        ), '[]'::jsonb)
      )
      order by q.display_order asc
    ),
    '[]'::jsonb
  )
  into v_questions
  from public.questions q
  where q.test_id = p_test_id;

  return jsonb_build_object(
    'test', jsonb_build_object(
      'id', v_test.id,
      'title', v_test.title,
      'description', v_test.description,
      'topic_id', v_test.topic_id,
      'lesson_id', v_test.lesson_id,
      'show_explanations_after_submission', v_test.show_explanations_after_submission
    ),
    'questions', v_questions
  );
end;
$$;

revoke all on function public.get_published_test_for_student(uuid) from public;
grant execute on function public.get_published_test_for_student(uuid) to authenticated;

-- ============================================================================
-- Secure RPC 2: Server-authoritative test grading & attempt creation
-- ============================================================================
create or replace function public.submit_test_attempt(
  p_test_id uuid,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_attempt_id uuid;
  v_q record;
  v_selected_option_id uuid;
  v_is_correct boolean;
  v_points_awarded integer;
  v_total_score integer := 0;
  v_total_points integer := 0;
  v_percentage numeric(5, 2) := 0;
  v_question_count integer := 0;
begin
  if v_student_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.student_can_access_test(p_test_id) then
    raise exception 'You do not have permission to submit this test';
  end if;

  select count(*) into v_question_count
  from public.questions
  where test_id = p_test_id;

  if v_question_count = 0 then
    raise exception 'This test has no questions yet';
  end if;

  insert into public.test_attempts (test_id, student_id, score, total_points, percentage, submitted_at)
  values (p_test_id, v_student_id, 0, 0, 0, now())
  returning id into v_attempt_id;

  for v_q in
    select id, points
    from public.questions
    where test_id = p_test_id
    order by display_order asc
  loop
    v_total_points := v_total_points + v_q.points;
    v_selected_option_id := null;
    v_is_correct := false;
    v_points_awarded := 0;

    if p_answers is not null and jsonb_typeof(p_answers) = 'object' then
      begin
        v_selected_option_id := nullif(trim(p_answers ->> v_q.id::text), '')::uuid;
      exception when invalid_text_representation then
        v_selected_option_id := null;
      end;
    end if;

    -- Verify selected option actually belongs to this exact question
    if v_selected_option_id is not null then
      select coalesce(o.is_correct, false)
      into v_is_correct
      from public.question_options o
      where o.id = v_selected_option_id
        and o.question_id = v_q.id;

      if not found then
        v_selected_option_id := null;
        v_is_correct := false;
      end if;
    end if;

    if v_is_correct then
      v_points_awarded := v_q.points;
      v_total_score := v_total_score + v_q.points;
    end if;

    insert into public.attempt_answers (
      attempt_id,
      question_id,
      selected_option_id,
      is_correct,
      points_awarded
    )
    values (
      v_attempt_id,
      v_q.id,
      v_selected_option_id,
      v_is_correct,
      v_points_awarded
    );
  end loop;

  if v_total_points > 0 then
    v_percentage := round((v_total_score::numeric / v_total_points::numeric) * 100.0, 2);
  end if;

  update public.test_attempts
  set
    score = v_total_score,
    total_points = v_total_points,
    percentage = v_percentage
  where id = v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.submit_test_attempt(uuid, jsonb) from public;
grant execute on function public.submit_test_attempt(uuid, jsonb) to authenticated;

-- ============================================================================
-- Secure RPC 3: Fetch submitted attempt result & gated answer review
-- ============================================================================
create or replace function public.get_test_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%rowtype;
  v_test public.tests%rowtype;
  v_allow_review boolean;
  v_total_questions integer := 0;
  v_correct_count integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_attempt
  from public.test_attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  if v_attempt.student_id <> v_user_id and not public.is_admin() then
    raise exception 'Unauthorized access to test attempt';
  end if;

  select * into v_test
  from public.tests
  where id = v_attempt.test_id;

  v_allow_review := coalesce(v_test.show_explanations_after_submission, false);

  select
    count(*),
    count(*) filter (where aa.is_correct = true)
  into v_total_questions, v_correct_count
  from public.attempt_answers aa
  where aa.attempt_id = v_attempt.id;

  if v_allow_review then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'question_id', q.id,
          'question_text', q.question_text,
          'explanation', q.explanation,
          'points', q.points,
          'selected_option_id', aa.selected_option_id,
          'is_correct', aa.is_correct,
          'points_awarded', aa.points_awarded,
          'correct_option_id', (
            select o.id
            from public.question_options o
            where o.question_id = q.id and o.is_correct = true
            limit 1
          ),
          'options', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', o.id,
                'option_key', o.option_key,
                'option_text', o.option_text,
                'is_correct', o.is_correct
              )
              order by o.display_order asc, o.option_key asc
            )
            from public.question_options o
            where o.question_id = q.id
          ), '[]'::jsonb)
        )
        order by q.display_order asc
      ),
      '[]'::jsonb
    )
    into v_items
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    where aa.attempt_id = v_attempt.id;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'test_id', v_attempt.test_id,
      'test_title', v_test.title,
      'lesson_id', v_test.lesson_id,
      'topic_id', v_test.topic_id,
      'score', v_attempt.score,
      'total_points', v_attempt.total_points,
      'percentage', v_attempt.percentage,
      'correct_count', v_correct_count,
      'total_questions', v_total_questions,
      'submitted_at', v_attempt.submitted_at,
      'show_explanations_after_submission', v_allow_review
    ),
    'review_items', v_items
  );
end;
$$;

revoke all on function public.get_test_attempt_review(uuid) from public;
grant execute on function public.get_test_attempt_review(uuid) to authenticated;
