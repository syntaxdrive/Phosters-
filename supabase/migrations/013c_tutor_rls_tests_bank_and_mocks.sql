-- Phosters Migration 013c: Subject-Scoped RLS (Tests, Question Bank & Mock Exams)
-- Run in Supabase Dashboard -> SQL Editor AFTER 013b.

-- 1. CBT Tests, Questions & Options: scoped to tutor's assigned subjects
drop policy if exists "tests_select_accessible" on public.tests;
create policy "tests_select_accessible"
  on public.tests for select to authenticated
  using (
    public.tutor_can_access_test(topic_id, lesson_id)
    or (not public.is_admin() and public.student_can_access_test(id))
  );

drop policy if exists "tests_admin_all" on public.tests;
drop policy if exists "tests_tutor_write" on public.tests;
create policy "tests_tutor_write"
  on public.tests for all to authenticated
  using (public.tutor_can_access_test(topic_id, lesson_id))
  with check (public.tutor_can_access_test(topic_id, lesson_id));

drop policy if exists "questions_admin_all" on public.questions;
drop policy if exists "questions_tutor_all" on public.questions;
create policy "questions_tutor_all"
  on public.questions for all to authenticated
  using (
    exists (
      select 1 from public.tests tst
      where tst.id = test_id and public.tutor_can_access_test(tst.topic_id, tst.lesson_id)
    )
  )
  with check (
    exists (
      select 1 from public.tests tst
      where tst.id = test_id and public.tutor_can_access_test(tst.topic_id, tst.lesson_id)
    )
  );

drop policy if exists "question_options_admin_all" on public.question_options;
drop policy if exists "question_options_tutor_all" on public.question_options;
create policy "question_options_tutor_all"
  on public.question_options for all to authenticated
  using (
    exists (
      select 1 from public.questions q
      join public.tests tst on tst.id = q.test_id
      where q.id = question_id and public.tutor_can_access_test(tst.topic_id, tst.lesson_id)
    )
  )
  with check (
    exists (
      select 1 from public.questions q
      join public.tests tst on tst.id = q.test_id
      where q.id = question_id and public.tutor_can_access_test(tst.topic_id, tst.lesson_id)
    )
  );

-- 2. Question Bank: tutors only see approved items for their assigned subjects
drop policy if exists "qb_admin_select_approved" on public.question_bank;
create policy "qb_admin_select_approved"
  on public.question_bank for select to authenticated
  using (
    public.is_admin()
    and status = 'approved'
    and (subject_id is null or public.tutor_can_access_subject(subject_id))
  );

drop policy if exists "qb_options_admin_select_approved" on public.question_bank_options;
create policy "qb_options_admin_select_approved"
  on public.question_bank_options for select to authenticated
  using (
    public.is_admin()
    and exists (
      select 1 from public.question_bank qb
      where qb.id = bank_question_id
        and qb.status = 'approved'
        and (qb.subject_id is null or public.tutor_can_access_subject(qb.subject_id))
    )
  );

-- 3. Mock Exams: Super Admin configures templates; Tutors read templates & manage custom questions for assigned subjects
drop policy if exists "mock_exams_admin_all" on public.mock_exams;
drop policy if exists "mock_exams_super_admin_insert" on public.mock_exams;
create policy "mock_exams_super_admin_insert"
  on public.mock_exams for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists "mock_exams_super_admin_update" on public.mock_exams;
create policy "mock_exams_super_admin_update"
  on public.mock_exams for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "mock_exams_super_admin_delete" on public.mock_exams;
create policy "mock_exams_super_admin_delete"
  on public.mock_exams for delete to authenticated
  using (public.is_super_admin());

drop policy if exists "mock_custom_q_admin_all" on public.mock_exam_custom_questions;
drop policy if exists "mock_custom_q_admin_select" on public.mock_exam_custom_questions;
create policy "mock_custom_q_admin_select"
  on public.mock_exam_custom_questions for select to authenticated
  using (public.is_admin());
drop policy if exists "mock_custom_q_tutor_insert" on public.mock_exam_custom_questions;
create policy "mock_custom_q_tutor_insert"
  on public.mock_exam_custom_questions for insert to authenticated
  with check (public.tutor_can_access_subject(subject_id));
drop policy if exists "mock_custom_q_tutor_update" on public.mock_exam_custom_questions;
create policy "mock_custom_q_tutor_update"
  on public.mock_exam_custom_questions for update to authenticated
  using (public.tutor_can_access_subject(subject_id))
  with check (public.tutor_can_access_subject(subject_id));
drop policy if exists "mock_custom_q_tutor_delete" on public.mock_exam_custom_questions;
create policy "mock_custom_q_tutor_delete"
  on public.mock_exam_custom_questions for delete to authenticated
  using (public.tutor_can_access_subject(subject_id));

drop policy if exists "mock_custom_opt_admin_all" on public.mock_exam_custom_options;
drop policy if exists "mock_custom_opt_admin_select" on public.mock_exam_custom_options;
create policy "mock_custom_opt_admin_select"
  on public.mock_exam_custom_options for select to authenticated
  using (public.is_admin());
drop policy if exists "mock_custom_opt_tutor_write" on public.mock_exam_custom_options;
create policy "mock_custom_opt_tutor_write"
  on public.mock_exam_custom_options for all to authenticated
  using (
    exists (
      select 1 from public.mock_exam_custom_questions q
      where q.id = custom_question_id and public.tutor_can_access_subject(q.subject_id)
    )
  )
  with check (
    exists (
      select 1 from public.mock_exam_custom_questions q
      where q.id = custom_question_id and public.tutor_can_access_subject(q.subject_id)
    )
  );
