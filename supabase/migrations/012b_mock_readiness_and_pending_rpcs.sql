-- Phosters Migration 012b: Mock Exam Readiness & Pending Session RPCs
-- Run in Supabase SQL Editor AFTER 012a (Step 2 of 4 for Mock Exams).

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

  select * into v_attempt from public.mock_attempts where id = p_attempt_id;
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
