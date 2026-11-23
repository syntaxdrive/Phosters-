-- Phosters Migration 013b: Subject-Scoped RLS (Taxonomy, Topics, Lessons & Materials)
-- Run in Supabase Dashboard -> SQL Editor AFTER 010, 011, 012a, and 013a.

-- 1. Global Exam / Subject taxonomy: readable by all authenticated users/admins; editable by Super Admin only
drop policy if exists "exams_admin_all" on public.exams;
drop policy if exists "exams_super_admin_insert" on public.exams;
create policy "exams_super_admin_insert"
  on public.exams for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists "exams_super_admin_update" on public.exams;
create policy "exams_super_admin_update"
  on public.exams for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "exams_super_admin_delete" on public.exams;
create policy "exams_super_admin_delete"
  on public.exams for delete to authenticated
  using (public.is_super_admin());

drop policy if exists "subjects_admin_all" on public.subjects;
drop policy if exists "subjects_super_admin_insert" on public.subjects;
create policy "subjects_super_admin_insert"
  on public.subjects for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists "subjects_super_admin_update" on public.subjects;
create policy "subjects_super_admin_update"
  on public.subjects for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "subjects_super_admin_delete" on public.subjects;
create policy "subjects_super_admin_delete"
  on public.subjects for delete to authenticated
  using (public.is_super_admin());

drop policy if exists "exam_subjects_admin_all" on public.exam_subjects;
drop policy if exists "exam_subjects_super_admin_insert" on public.exam_subjects;
create policy "exam_subjects_super_admin_insert"
  on public.exam_subjects for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists "exam_subjects_super_admin_update" on public.exam_subjects;
create policy "exam_subjects_super_admin_update"
  on public.exam_subjects for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "exam_subjects_super_admin_delete" on public.exam_subjects;
create policy "exam_subjects_super_admin_delete"
  on public.exam_subjects for delete to authenticated
  using (public.is_super_admin());

-- 2. Topics: tutors read & write ONLY their assigned subjects; students read enrolled published topics
drop policy if exists "topics_select_enrolled" on public.topics;
create policy "topics_select_enrolled"
  on public.topics for select to authenticated
  using (
    public.tutor_can_access_subject(subject_id)
    or (
      not public.is_admin()
      and is_published = true
      and public.student_has_subject_access(exam_id, subject_id)
    )
  );

drop policy if exists "topics_admin_all" on public.topics;
drop policy if exists "topics_tutor_write" on public.topics;
create policy "topics_tutor_write"
  on public.topics for all to authenticated
  using (public.tutor_can_access_subject(subject_id))
  with check (public.tutor_can_access_subject(subject_id));

-- 3. Lessons, Materials & Links: scoped to tutor's assigned subjects via parent topic
drop policy if exists "lessons_select_enrolled" on public.lessons;
create policy "lessons_select_enrolled"
  on public.lessons for select to authenticated
  using (
    exists (
      select 1 from public.topics t
      where t.id = topic_id
        and (
          public.tutor_can_access_subject(t.subject_id)
          or (
            not public.is_admin()
            and lessons.is_published = true
            and t.is_published = true
            and public.student_has_subject_access(t.exam_id, t.subject_id)
          )
        )
    )
  );

drop policy if exists "lessons_admin_all" on public.lessons;
drop policy if exists "lessons_tutor_write" on public.lessons;
create policy "lessons_tutor_write"
  on public.lessons for all to authenticated
  using (
    exists (
      select 1 from public.topics t
      where t.id = topic_id and public.tutor_can_access_subject(t.subject_id)
    )
  )
  with check (
    exists (
      select 1 from public.topics t
      where t.id = topic_id and public.tutor_can_access_subject(t.subject_id)
    )
  );

drop policy if exists "lesson_materials_select_enrolled" on public.lesson_materials;
create policy "lesson_materials_select_enrolled"
  on public.lesson_materials for select to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = lesson_id
        and (
          public.tutor_can_access_subject(t.subject_id)
          or (
            not public.is_admin()
            and l.is_published = true
            and t.is_published = true
            and public.student_has_subject_access(t.exam_id, t.subject_id)
          )
        )
    )
  );

drop policy if exists "lesson_materials_admin_all" on public.lesson_materials;
drop policy if exists "lesson_materials_tutor_write" on public.lesson_materials;
create policy "lesson_materials_tutor_write"
  on public.lesson_materials for all to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = lesson_id and public.tutor_can_access_subject(t.subject_id)
    )
  )
  with check (
    exists (
      select 1 from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = lesson_id and public.tutor_can_access_subject(t.subject_id)
    )
  );

drop policy if exists "lesson_links_select_enrolled" on public.lesson_links;
create policy "lesson_links_select_enrolled"
  on public.lesson_links for select to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = lesson_id
        and (
          public.tutor_can_access_subject(t.subject_id)
          or (
            not public.is_admin()
            and l.is_published = true
            and t.is_published = true
            and public.student_has_subject_access(t.exam_id, t.subject_id)
          )
        )
    )
  );

drop policy if exists "lesson_links_admin_all" on public.lesson_links;
drop policy if exists "lesson_links_tutor_write" on public.lesson_links;
create policy "lesson_links_tutor_write"
  on public.lesson_links for all to authenticated
  using (
    exists (
      select 1 from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = lesson_id and public.tutor_can_access_subject(t.subject_id)
    )
  )
  with check (
    exists (
      select 1 from public.lessons l
      join public.topics t on t.id = l.topic_id
      where l.id = lesson_id and public.tutor_can_access_subject(t.subject_id)
    )
  );
