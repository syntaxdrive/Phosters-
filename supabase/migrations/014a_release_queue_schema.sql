-- Phosters Migration 014a: Release Queue & Scheduled Release Schema
-- Run in Supabase Dashboard -> SQL Editor AFTER 013c (Step 1 of 3).

alter table public.tests
  add column if not exists release_status text not null default 'draft'
    check (release_status in ('draft', 'queued', 'published')),
  add column if not exists scheduled_release_at timestamptz null;

alter table public.mock_exams
  add column if not exists release_status text not null default 'draft'
    check (release_status in ('draft', 'queued', 'published')),
  add column if not exists scheduled_release_at timestamptz null;

update public.tests
set release_status = case when is_published then 'published' else 'draft' end
where release_status = 'draft' and is_published = true;

update public.mock_exams
set release_status = case when is_published then 'published' else 'draft' end
where release_status = 'draft' and is_published = true;

create index if not exists idx_tests_release_queue
  on public.tests (release_status, scheduled_release_at, updated_at desc);

create index if not exists idx_mock_exams_release_queue
  on public.mock_exams (release_status, scheduled_release_at, updated_at desc);

create or replace function public.is_item_released(
  p_is_published boolean,
  p_release_status text,
  p_scheduled_release_at timestamptz
)
returns boolean
language sql
stable
as $$
  select
    coalesce(p_is_published, false) = true
    or p_release_status = 'published'
    or (
      p_release_status = 'queued'
      and p_scheduled_release_at is not null
      and p_scheduled_release_at <= now()
    );
$$;

revoke all on function public.is_item_released(boolean, text, timestamptz) from public;
grant execute on function public.is_item_released(boolean, text, timestamptz) to authenticated;

create or replace function public.sync_release_status_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.release_status = 'published' then
      new.is_published := true;
      new.scheduled_release_at := null;
    elsif new.release_status = 'queued' then
      new.is_published := false;
    elsif new.is_published = true then
      new.release_status := 'published';
      new.scheduled_release_at := null;
    else
      new.release_status := coalesce(nullif(new.release_status, ''), 'draft');
      new.is_published := false;
      if new.release_status = 'draft' then
        new.scheduled_release_at := null;
      end if;
    end if;
    return new;
  end if;

  -- UPDATE path: respect explicit release_status changes first; keep legacy is_published callers working
  if new.release_status is distinct from old.release_status then
    if new.release_status = 'published' then
      new.is_published := true;
      new.scheduled_release_at := null;
    else
      new.is_published := false;
      if new.release_status = 'draft' then
        new.scheduled_release_at := null;
      end if;
    end if;
  elsif new.is_published is distinct from old.is_published then
    new.release_status := case when new.is_published then 'published' else 'draft' end;
    if new.release_status in ('published', 'draft') then
      new.scheduled_release_at := null;
    end if;
  else
    if new.release_status = 'published' then
      new.is_published := true;
      new.scheduled_release_at := null;
    else
      new.is_published := false;
      if new.release_status = 'draft' then
        new.scheduled_release_at := null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tests_sync_release_status on public.tests;
create trigger trg_tests_sync_release_status
  before insert or update on public.tests
  for each row
  execute function public.sync_release_status_fields();

drop trigger if exists trg_mock_exams_sync_release_status on public.mock_exams;
create trigger trg_mock_exams_sync_release_status
  before insert or update on public.mock_exams
  for each row
  execute function public.sync_release_status_fields();
