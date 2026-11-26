-- Phosters Migration 016: UI Post-UTME 90-Min Timing & 4-Subject Parity
-- Run in Supabase Dashboard -> SQL Editor.

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
  if v_student_id is null then raise exception 'Authentication required'; end if;
  if v_mode not in ('full_mock', 'mini_mock', 'published_mock') then v_mode := 'full_mock'; end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found then raise exception 'Examination not found'; end if;

  if p_mock_exam_id is not null then
    select * into v_mock from public.mock_exams where id = p_mock_exam_id;
    if not found then raise exception 'Mock exam template not found'; end if;
    if not public.is_item_released(v_mock.is_published, v_mock.release_status, v_mock.scheduled_release_at) and not public.is_admin() then
      raise exception 'This mock exam has not been released yet';
    end if;
    if v_mock.exam_id <> p_exam_id then raise exception 'Mock exam does not belong to the selected examination'; end if;
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
  elsif v_exam.slug = 'ui-post-utme' then
    v_duration_minutes := 90;
    v_english_target := 25;
    v_other_target := 25;
    v_title := v_exam.name || ' Full 4-Subject CBT Mock';
  else
    v_duration_minutes := 120;
    v_english_target := 60;
    v_other_target := 40;
    v_title := v_exam.name || ' Full 4-Subject CBT Mock';
  end if;

  select count(*)::integer into v_subject_count
  from public.student_exam_profiles sep
  join public.student_exam_subjects ses on ses.student_exam_profile_id = sep.id
  where sep.student_id = v_student_id and sep.exam_id = p_exam_id;

  if v_subject_count = 0 then
    raise exception 'You have not selected subjects for % yet. Open Exams & Subjects setup first.', v_exam.name;
  end if;
  if v_exam.slug in ('jamb-utme', 'ui-post-utme') and v_subject_count <> 4 then
    raise exception '% requires exactly 4 subjects (Use of English + 3 electives). Update your subject combination first.', v_exam.name;
  end if;

  insert into public.mock_attempts (
    student_id, exam_id, mock_exam_id, title, mode, duration_minutes, started_at, show_explanations_after_submission
  ) values (
    v_student_id, p_exam_id, case when v_has_mock then v_mock.id else null end,
    v_title, v_mode, v_duration_minutes, v_started_at, v_show_explanations
  ) returning id into v_attempt_id;

  for v_subj in
    select s.id, s.name, s.slug
    from public.student_exam_profiles sep
    join public.student_exam_subjects ses on ses.student_exam_profile_id = sep.id
    join public.subjects s on s.id = ses.subject_id
    where sep.student_id = v_student_id and sep.exam_id = p_exam_id
    order by case when s.slug = 'english-language' then 0 else 1 end, s.name asc
  loop
    v_section_idx := v_section_idx + 1;
    v_q_order := 0;
    v_section_questions := '[]'::jsonb;
    v_target_for_subj := case when v_subj.slug = 'english-language' then v_english_target else v_other_target end;

    if v_has_mock then
      for v_custom_q in
        select q.id, q.question_text, q.explanation
        from public.mock_exam_custom_questions q
        where q.mock_exam_id = v_mock.id and q.subject_id = v_subj.id
        order by q.display_order asc, q.created_at asc
        limit v_target_for_subj
      loop
        select
          coalesce(jsonb_agg(jsonb_build_object('key', o.option_key, 'text', o.option_text) order by o.display_order asc, o.option_key asc), '[]'::jsonb),
          (select o2.option_key from public.mock_exam_custom_options o2 where o2.custom_question_id = v_custom_q.id and o2.is_correct = true order by o2.display_order asc limit 1)
        into v_opts_sanitized, v_correct_key
        from public.mock_exam_custom_options o
        where o.custom_question_id = v_custom_q.id;

        if v_correct_key is not null and jsonb_array_length(v_opts_sanitized) >= 2 then
          v_q_order := v_q_order + 1;
          v_total_inserted := v_total_inserted + 1;
          insert into public.mock_attempt_items (
            attempt_id, subject_id, subject_name, subject_slug, section_order, question_order,
            question_source, source_question_id, question_text, explanation, options_json, correct_option_key
          ) values (
            v_attempt_id, v_subj.id, v_subj.name, v_subj.slug, v_section_idx, v_q_order,
            'custom', v_custom_q.id, v_custom_q.question_text, v_custom_q.explanation, v_opts_sanitized, v_correct_key
          ) returning id into v_item_id;
          v_section_questions := v_section_questions || jsonb_build_array(jsonb_build_object('id', v_item_id, 'question_text', v_custom_q.question_text, 'options', v_opts_sanitized));
        end if;
      end loop;
    end if;

    if v_uses_bank and v_q_order < v_target_for_subj then
      for v_bank_q in
        select qb.id, qb.question_text, qb.explanation
        from public.question_bank qb
        where qb.status = 'approved' and qb.subject_id = v_subj.id
          and (not v_exclude_diagrams or qb.needs_diagram = false)
        order by case when qb.exam_id = p_exam_id then 0 when qb.exam_id is null then 1 else 2 end asc, random()
        limit (v_target_for_subj - v_q_order)
      loop
        select
          coalesce(jsonb_agg(jsonb_build_object('key', o.option_key, 'text', o.option_text) order by o.display_order asc, o.option_key asc), '[]'::jsonb),
          (select o2.option_key from public.question_bank_options o2 where o2.bank_question_id = v_bank_q.id and o2.is_correct = true order by o2.display_order asc limit 1)
        into v_opts_sanitized, v_correct_key
        from public.question_bank_options o
        where o.bank_question_id = v_bank_q.id;

        if v_correct_key is not null and jsonb_array_length(v_opts_sanitized) >= 2 then
          v_q_order := v_q_order + 1;
          v_total_inserted := v_total_inserted + 1;
          insert into public.mock_attempt_items (
            attempt_id, subject_id, subject_name, subject_slug, section_order, question_order,
            question_source, source_question_id, question_text, explanation, options_json, correct_option_key
          ) values (
            v_attempt_id, v_subj.id, v_subj.name, v_subj.slug, v_section_idx, v_q_order,
            'bank', v_bank_q.id, v_bank_q.question_text, v_bank_q.explanation, v_opts_sanitized, v_correct_key
          ) returning id into v_item_id;
          v_section_questions := v_section_questions || jsonb_build_array(jsonb_build_object('id', v_item_id, 'question_text', v_bank_q.question_text, 'options', v_opts_sanitized));
        end if;
      end loop;
    end if;

    v_sections_json := v_sections_json || jsonb_build_array(jsonb_build_object(
      'subject_id', v_subj.id, 'subject_name', v_subj.name, 'subject_slug', v_subj.slug,
      'section_order', v_section_idx, 'target_count', v_target_for_subj,
      'available_count', v_q_order, 'questions', v_section_questions
    ));
  end loop;

  if v_total_inserted = 0 then
    delete from public.mock_attempts where id = v_attempt_id;
    raise exception 'No approved questions are ready in the Question Bank for your selected subjects yet.';
  end if;

  update public.mock_attempts set total_questions = v_total_inserted where id = v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id, 'exam_id', v_exam.id, 'exam_name', v_exam.name, 'exam_slug', v_exam.slug,
    'mock_exam_id', case when v_has_mock then v_mock.id else null end, 'title', v_title, 'mode', v_mode,
    'duration_minutes', v_duration_minutes, 'started_at', v_started_at,
    'show_explanations_after_submission', v_show_explanations, 'total_questions', v_total_inserted, 'sections', v_sections_json
  );
end;
$$;

revoke all on function public.start_mock_exam_session(uuid, uuid, text) from public;
grant execute on function public.start_mock_exam_session(uuid, uuid, text) to authenticated;
