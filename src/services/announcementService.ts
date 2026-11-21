import { isSafeExternalHttpUrl } from '../lib/materialLinks';
import { supabase } from '../lib/supabase';
import type {
  AdminAnnouncementInput,
  AnnouncementFeedItem,
} from '../types/announcement';
import type {
  Announcement,
  AnnouncementLink,
  Exam,
  Subject,
} from '../types/database';

function mapAnnouncementError(err: { message?: string; code?: string } | null): string {
  if (!err) return 'An unexpected error occurred.';
  const msg = (err.message ?? '').toLowerCase();
  if (err.code === '42P01' || msg.includes('relation')) {
    return 'Announcements table is not set up yet. Run supabase/migrations/005_admin_announcements.sql in Supabase SQL Editor.';
  }
  if (err.code === '42501') {
    return 'Permission denied for this announcement operation.';
  }
  return err.message || 'Unable to process announcement request right now.';
}

function buildAudienceLabel(
  item: Pick<Announcement, 'audience_type' | 'exam_id' | 'subject_id'>,
  examMap: Map<string, string>,
  subjectMap: Map<string, string>
): string {
  if (item.audience_type === 'all') return 'All Students';
  const examName = item.exam_id ? examMap.get(item.exam_id) : undefined;
  const subjectName = item.subject_id ? subjectMap.get(item.subject_id) : undefined;
  if (item.audience_type === 'exam') {
    return examName ? `${examName} Students` : 'Examination Students';
  }
  return [examName, subjectName].filter(Boolean).join(' · ') || 'Subject Students';
}

export async function fetchStudentAnnouncements(options?: {
  examId?: string;
  subjectId?: string;
}): Promise<{
  announcements: AnnouncementFeedItem[];
  error: string | null;
}> {
  if (!supabase) return { announcements: [], error: 'Supabase is not configured.' };

  let query = supabase
    .from('announcements')
    .select(
      'id, title, message, audience_type, exam_id, subject_id, is_pinned, is_published, created_by, created_at, updated_at'
    )
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  if (options?.examId && options?.subjectId) {
    query = query
      .eq('audience_type', 'exam_subject')
      .eq('exam_id', options.examId)
      .eq('subject_id', options.subjectId);
  }

  const [annRes, examsRes, subjectsRes] = await Promise.all([
    query,
    supabase.from('exams').select('id, name'),
    supabase.from('subjects').select('id, name'),
  ]);

  if (annRes.error) {
    // Gracefully hide before migration 005 is applied
    if (annRes.error.code === '42P01') return { announcements: [], error: null };
    return { announcements: [], error: mapAnnouncementError(annRes.error) };
  }

  const rows = (annRes.data ?? []) as Announcement[];
  if (rows.length === 0) {
    return { announcements: [], error: null };
  }

  const announcementIds = rows.map((r) => r.id);
  const linksRes = await supabase
    .from('announcement_links')
    .select('id, announcement_id, title, url, display_order')
    .in('announcement_id', announcementIds)
    .order('display_order', { ascending: true });

  const linksByAnnouncement = new Map<string, AnnouncementLink[]>();
  if (!linksRes.error && linksRes.data) {
    for (const lnk of linksRes.data as AnnouncementLink[]) {
      if (!isSafeExternalHttpUrl(lnk.url)) continue;
      const list = linksByAnnouncement.get(lnk.announcement_id) ?? [];
      list.push(lnk);
      linksByAnnouncement.set(lnk.announcement_id, list);
    }
  }

  const examMap = new Map(
    ((examsRes.data ?? []) as Array<Pick<Exam, 'id' | 'name'>>).map((e) => [e.id, e.name])
  );
  const subjectMap = new Map(
    ((subjectsRes.data ?? []) as Array<Pick<Subject, 'id' | 'name'>>).map((s) => [s.id, s.name])
  );

  const items: AnnouncementFeedItem[] = rows.map((a) => ({
    ...a,
    audienceLabel: buildAudienceLabel(a, examMap, subjectMap),
    links: linksByAnnouncement.get(a.id) ?? [],
  }));

  return { announcements: items, error: null };
}

export async function fetchAdminAnnouncements(): Promise<{
  announcements: AnnouncementFeedItem[];
  exams: Exam[];
  subjects: Subject[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      announcements: [],
      exams: [],
      subjects: [],
      error: 'Supabase is not configured.',
    };
  }

  const [annRes, examsRes, subjectsRes] = await Promise.all([
    supabase
      .from('announcements')
      .select(
        'id, title, message, audience_type, exam_id, subject_id, is_pinned, is_published, created_by, created_at, updated_at'
      )
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('exams')
      .select('id, name, slug, description, is_active, created_at')
      .order('name', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name, slug, description, is_active, created_at')
      .order('name', { ascending: true }),
  ]);

  const firstErr = annRes.error || examsRes.error || subjectsRes.error;
  if (firstErr) {
    return {
      announcements: [],
      exams: [],
      subjects: [],
      error: mapAnnouncementError(firstErr),
    };
  }

  const rows = (annRes.data ?? []) as Announcement[];
  const exams = (examsRes.data ?? []) as Exam[];
  const subjects = (subjectsRes.data ?? []) as Subject[];

  const linksByAnnouncement = new Map<string, AnnouncementLink[]>();
  if (rows.length > 0) {
    const linksRes = await supabase
      .from('announcement_links')
      .select('id, announcement_id, title, url, display_order')
      .in(
        'announcement_id',
        rows.map((r) => r.id)
      )
      .order('display_order', { ascending: true });

    if (linksRes.error) {
      return {
        announcements: [],
        exams,
        subjects,
        error: mapAnnouncementError(linksRes.error),
      };
    }

    for (const lnk of (linksRes.data ?? []) as AnnouncementLink[]) {
      const list = linksByAnnouncement.get(lnk.announcement_id) ?? [];
      list.push(lnk);
      linksByAnnouncement.set(lnk.announcement_id, list);
    }
  }

  const examMap = new Map(exams.map((e) => [e.id, e.name]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

  const items: AnnouncementFeedItem[] = rows.map((a) => ({
    ...a,
    audienceLabel: buildAudienceLabel(a, examMap, subjectMap),
    links: linksByAnnouncement.get(a.id) ?? [],
  }));

  return {
    announcements: items,
    exams,
    subjects,
    error: null,
  };
}

export async function saveAdminAnnouncement(
  input: AdminAnnouncementInput
): Promise<{ announcementId: string | null; error: string | null }> {
  if (!supabase) return { announcementId: null, error: 'Supabase is not configured.' };

  if (input.title.trim().length < 2) {
    return { announcementId: null, error: 'Announcement title must be at least 2 characters.' };
  }
  if (input.message.trim().length < 2) {
    return { announcementId: null, error: 'Announcement message must be at least 2 characters.' };
  }
  if (input.audience_type === 'exam' && !input.exam_id) {
    return { announcementId: null, error: 'Select a target examination.' };
  }
  if (input.audience_type === 'exam_subject' && (!input.exam_id || !input.subject_id)) {
    return { announcementId: null, error: 'Select both an examination and a subject.' };
  }

  for (let i = 0; i < input.links.length; i++) {
    const l = input.links[i];
    if (!l.title.trim()) {
      return { announcementId: null, error: `Link #${i + 1} needs a label.` };
    }
    if (!isSafeExternalHttpUrl(l.url)) {
      return {
        announcementId: null,
        error: `Link #${i + 1} must be a valid https:// or http:// URL.`,
      };
    }
  }

  const resolvedExamId = input.audience_type === 'all' ? null : input.exam_id;
  const resolvedSubjectId =
    input.audience_type === 'exam_subject' ? input.subject_id : null;

  let announcementId = input.id ?? null;

  if (announcementId) {
    const { error } = await supabase
      .from('announcements')
      .update({
        title: input.title.trim(),
        message: input.message.trim(),
        audience_type: input.audience_type,
        exam_id: resolvedExamId,
        subject_id: resolvedSubjectId,
        is_pinned: input.is_pinned,
        is_published: input.is_published,
      })
      .eq('id', announcementId);

    if (error) return { announcementId: null, error: mapAnnouncementError(error) };

    const delRes = await supabase
      .from('announcement_links')
      .delete()
      .eq('announcement_id', announcementId);
    if (delRes.error) {
      return { announcementId, error: mapAnnouncementError(delRes.error) };
    }
  } else {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: input.title.trim(),
        message: input.message.trim(),
        audience_type: input.audience_type,
        exam_id: resolvedExamId,
        subject_id: resolvedSubjectId,
        is_pinned: input.is_pinned,
        is_published: input.is_published,
        created_by: input.created_by,
      })
      .select('id')
      .single();

    if (error) return { announcementId: null, error: mapAnnouncementError(error) };
    announcementId = data.id;
  }

  if (input.links.length > 0 && announcementId) {
    const rows = input.links.map((lnk, idx) => ({
      announcement_id: announcementId,
      title: lnk.title.trim(),
      url: lnk.url.trim(),
      display_order: idx + 1,
    }));

    const linkRes = await supabase.from('announcement_links').insert(rows);
    if (linkRes.error) {
      return { announcementId, error: mapAnnouncementError(linkRes.error) };
    }
  }

  return { announcementId, error: null };
}

export async function updateAnnouncementFlags(
  announcementId: string,
  patch: { is_published?: boolean; is_pinned?: boolean }
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('announcements')
    .update(patch)
    .eq('id', announcementId);
  return { error: error ? mapAnnouncementError(error) : null };
}

export async function deleteAdminAnnouncement(
  announcementId: string
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId);
  return { error: error ? mapAnnouncementError(error) : null };
}
