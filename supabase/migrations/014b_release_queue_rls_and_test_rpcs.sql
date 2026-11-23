-- Phosters Migration 014b: Release Queue RLS & Student Test Access
-- Run in Supabase Dashboard -> SQL Editor AFTER 014a (Step 2 of 3).

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
          public.is_item_released(tst.is_published, tst.release_status, tst.scheduled_release_at)
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

drop policy if exists "mock_exams_select_published" on public.mock_exams;
create policy "mock_exams_select_published"
  on public.mock_exams for select to authenticated
  using (
    public.is_admin()
    or public.is_item_released(is_published, release_status, scheduled_release_at)
  );
