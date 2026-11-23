-- Phosters Migration 012d: Mock Exam Grading & Review RPCs
-- Run in Supabase SQL Editor AFTER 012a, 012b, and 012c (Step 4 of 4 for Mock Exams).

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
  if v_student_id is null then raise exception 'Authentication required'; end if;

  select * into v_attempt from public.mock_attempts where id = p_attempt_id;
  if not found then raise exception 'Mock exam session not found'; end if;
  if v_attempt.student_id <> v_student_id then raise exception 'You do not have permission to submit this mock attempt'; end if;
  if v_attempt.submitted_at is not null then return v_attempt.id; end if;

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
    set selected_option_key = v_selected, is_correct = v_is_correct
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
          'jamb_score_100', case when s.total_cnt > 0 then round((s.correct_cnt::numeric / s.total_cnt::numeric) * 100.0)::integer else 0 end,
          'percentage', case when s.total_cnt > 0 then round((s.correct_cnt::numeric / s.total_cnt::numeric) * 100.0, 2) else 0 end
        )
        order by s.section_order asc
      ),
      '[]'::jsonb
    ),
    coalesce(sum(case when s.total_cnt > 0 then round((s.correct_cnt::numeric / s.total_cnt::numeric) * 100.0)::integer else 0 end), 0)::integer,
    count(*)::integer
  into v_subject_scores, v_sum_400, v_subject_count
  from (
    select
      mai.subject_id, mai.subject_name, mai.subject_slug, mai.section_order,
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
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_attempt from public.mock_attempts where id = p_attempt_id;
  if not found then raise exception 'Mock exam attempt not found'; end if;
  if v_attempt.student_id <> v_user_id and not public.is_admin() then raise exception 'Unauthorized access to mock attempt'; end if;
  if v_attempt.submitted_at is null then raise exception 'This mock exam has not been submitted yet'; end if;

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
        mai.subject_id, mai.subject_name, mai.subject_slug, mai.section_order,
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
      'id', v_attempt.id, 'exam_id', v_attempt.exam_id, 'exam_name', v_exam.name, 'exam_slug', v_exam.slug,
      'mock_exam_id', v_attempt.mock_exam_id, 'title', v_attempt.title, 'mode', v_attempt.mode,
      'duration_minutes', v_attempt.duration_minutes, 'started_at', v_attempt.started_at,
      'submitted_at', v_attempt.submitted_at, 'elapsed_seconds', v_attempt.elapsed_seconds,
      'total_score_400', v_attempt.total_score_400, 'total_correct', v_attempt.total_correct,
      'total_questions', v_attempt.total_questions, 'percentage', v_attempt.percentage,
      'show_explanations_after_submission', v_attempt.show_explanations_after_submission, 'subject_scores', v_attempt.subject_scores
    ),
    'sections', v_sections
  );
end;
$$;

revoke all on function public.get_mock_attempt_review(uuid) from public;
grant execute on function public.get_mock_attempt_review(uuid) to authenticated;
