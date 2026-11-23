import { supabase } from '../lib/supabase';
import {
  OFFICIAL_JAMB_SUBJECTS,
  findMatchingSubject,
} from '../lib/jambSubjects';
import { isSafeExternalHttpUrl, validateMaterialUrl } from '../lib/materialLinks';
import { isValidYouTubeUrl } from '../lib/youtube';
import type {
  AdminLessonListItem,
  AdminOverviewCounts,
  LessonEditorInput,
} from '../types/admin';
import type {
  Exam,
  ExamSubject,
  Lesson,
  LessonLink,
  LessonMaterial,
  Subject,
  Topic,
} from '../types/database';

function mapAdminError(err: { message?: string; code?: string } | null): string {
  if (!err) return 'An unexpected error occurred.';
  if (err.code === '23505') {
    return 'A record with this unique identifier or slug already exists.';
  }
  if (err.code === '42501') {
    return 'Permission denied. Administrator access is required.';
  }
  return err.message || 'Operation failed. Please try again.';
}

export async function fetchAdminOverviewCounts(): Promise<{
  counts: AdminOverviewCounts | null;
  error: string | null;
}> {
  if (!supabase) return { counts: null, error: 'Supabase is not configured.' };

  const [examsRes, subjectsRes, topicsRes, pubLessonsRes, draftLessonsRes, studentsRes] =
    await Promise.all([
      supabase.from('exams').select('id', { count: 'exact', head: true }),
      supabase.from('subjects').select('id', { count: 'exact', head: true }),
      supabase.from('topics').select('id', { count: 'exact', head: true }),
      supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', false),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student'),
    ]);

  const firstError =
    examsRes.error ||
    subjectsRes.error ||
    topicsRes.error ||
    pubLessonsRes.error ||
    draftLessonsRes.error ||
    studentsRes.error;

  if (firstError) {
    return { counts: null, error: mapAdminError(firstError) };
  }

  return {
    counts: {
      examsCount: examsRes.count ?? 0,
      subjectsCount: subjectsRes.count ?? 0,
      topicsCount: topicsRes.count ?? 0,
      publishedLessonsCount: pubLessonsRes.count ?? 0,
      draftLessonsCount: draftLessonsRes.count ?? 0,
      studentsCount: studentsRes.count ?? 0,
    },
    error: null,
  };
}

// ============================================================================
// Examinations & Exam-Subject Configuration
// ============================================================================

export async function fetchAllExams(): Promise<{ exams: Exam[]; error: string | null }> {
  if (!supabase) return { exams: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('exams')
    .select('id, name, slug, description, is_active, created_at')
    .order('name', { ascending: true });

  if (error) return { exams: [], error: mapAdminError(error) };
  return { exams: (data ?? []) as Exam[], error: null };
}

export async function saveExam(input: {
  id?: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
}): Promise<{ exam: Exam | null; error: string | null }> {
  if (!supabase) return { exam: null, error: 'Supabase is not configured.' };

  const payload = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    description: input.description.trim() || null,
    is_active: input.is_active,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('exams')
      .update(payload)
      .eq('id', input.id)
      .select('id, name, slug, description, is_active, created_at')
      .single();
    if (error) return { exam: null, error: mapAdminError(error) };
    return { exam: data as Exam, error: null };
  }

  const { data, error } = await supabase
    .from('exams')
    .insert(payload)
    .select('id, name, slug, description, is_active, created_at')
    .single();
  if (error) return { exam: null, error: mapAdminError(error) };
  return { exam: data as Exam, error: null };
}

export async function fetchAllSubjects(): Promise<{
  subjects: Subject[];
  error: string | null;
}> {
  if (!supabase) return { subjects: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, slug, description, is_active, created_at')
    .order('name', { ascending: true });

  if (error) return { subjects: [], error: mapAdminError(error) };
  return { subjects: (data ?? []) as Subject[], error: null };
}

export async function saveSubject(input: {
  id?: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
}): Promise<{ subject: Subject | null; error: string | null }> {
  if (!supabase) return { subject: null, error: 'Supabase is not configured.' };

  const payload = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    description: input.description.trim() || null,
    is_active: input.is_active,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('subjects')
      .update(payload)
      .eq('id', input.id)
      .select('id, name, slug, description, is_active, created_at')
      .single();
    if (error) return { subject: null, error: mapAdminError(error) };
    return { subject: data as Subject, error: null };
  }

  const { data, error } = await supabase
    .from('subjects')
    .insert(payload)
    .select('id, name, slug, description, is_active, created_at')
    .single();
  if (error) return { subject: null, error: mapAdminError(error) };
  return { subject: data as Subject, error: null };
}

export async function fetchExamSubjects(examId: string): Promise<{
  rows: ExamSubject[];
  error: string | null;
}> {
  if (!supabase) return { rows: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('exam_subjects')
    .select('id, exam_id, subject_id, is_active, is_compulsory, display_order, created_at')
    .eq('exam_id', examId)
    .order('display_order', { ascending: true });

  if (error) return { rows: [], error: mapAdminError(error) };
  return { rows: (data ?? []) as ExamSubject[], error: null };
}

export async function upsertExamSubject(input: {
  id?: string;
  exam_id: string;
  subject_id: string;
  is_active: boolean;
  is_compulsory: boolean;
  display_order: number;
}): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  if (input.id) {
    const { error } = await supabase
      .from('exam_subjects')
      .update({
        is_active: input.is_active,
        is_compulsory: input.is_compulsory,
        display_order: input.display_order,
      })
      .eq('id', input.id);
    return { error: error ? mapAdminError(error) : null };
  }

  const { error } = await supabase.from('exam_subjects').insert({
    exam_id: input.exam_id,
    subject_id: input.subject_id,
    is_active: input.is_active,
    is_compulsory: input.is_compulsory,
    display_order: input.display_order,
  });

  return { error: error ? mapAdminError(error) : null };
}

export async function deleteExamSubject(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('exam_subjects').delete().eq('id', id);
  return { error: error ? mapAdminError(error) : null };
}

export async function syncOfficialJambSubjects(): Promise<{
  subjectsCreated: number;
  linksCreated: number;
  totalOfficialCount: number;
  error: string | null;
}> {
  if (!supabase) {
    return {
      subjectsCreated: 0,
      linksCreated: 0,
      totalOfficialCount: OFFICIAL_JAMB_SUBJECTS.length,
      error: 'Supabase is not configured.',
    };
  }

  const [examsRes, subjectsRes] = await Promise.all([
    supabase
      .from('exams')
      .select('id, slug')
      .in('slug', ['jamb-utme', 'ui-post-utme']),
    supabase
      .from('subjects')
      .select('id, name, slug, description, is_active, created_at'),
  ]);

  if (examsRes.error || subjectsRes.error) {
    return {
      subjectsCreated: 0,
      linksCreated: 0,
      totalOfficialCount: OFFICIAL_JAMB_SUBJECTS.length,
      error: mapAdminError(examsRes.error || subjectsRes.error),
    };
  }

  let allSubjects = (subjectsRes.data ?? []) as Subject[];
  const missingSpecs = OFFICIAL_JAMB_SUBJECTS.filter(
    (spec) => !findMatchingSubject(spec, allSubjects)
  );

  let subjectsCreated = 0;
  if (missingSpecs.length > 0) {
    const insertPayload = missingSpecs.map((spec) => ({
      name: spec.name,
      slug: spec.slug,
      description: spec.description,
      is_active: true,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from('subjects')
      .insert(insertPayload)
      .select('id, name, slug, description, is_active, created_at');

    if (insertError) {
      return {
        subjectsCreated: 0,
        linksCreated: 0,
        totalOfficialCount: OFFICIAL_JAMB_SUBJECTS.length,
        error: mapAdminError(insertError),
      };
    }

    const created = (insertedRows ?? []) as Subject[];
    subjectsCreated = created.length;
    allSubjects = [...allSubjects, ...created];
  }

  const targetExams = (examsRes.data ?? []) as Array<{ id: string; slug: string }>;
  let linksCreated = 0;

  if (targetExams.length > 0) {
    const examIds = targetExams.map((e) => e.id);
    const { data: existingLinks, error: linksError } = await supabase
      .from('exam_subjects')
      .select('exam_id, subject_id')
      .in('exam_id', examIds);

    if (linksError) {
      return {
        subjectsCreated,
        linksCreated: 0,
        totalOfficialCount: OFFICIAL_JAMB_SUBJECTS.length,
        error: mapAdminError(linksError),
      };
    }

    const existingPairs = new Set(
      (existingLinks ?? []).map((row) => `${row.exam_id}:${row.subject_id}`)
    );

    const newLinks: Array<{
      exam_id: string;
      subject_id: string;
      is_active: boolean;
      is_compulsory: boolean;
      display_order: number;
    }> = [];

    for (const exam of targetExams) {
      for (const spec of OFFICIAL_JAMB_SUBJECTS) {
        const matched = findMatchingSubject(spec, allSubjects);
        if (!matched) continue;
        const pairKey = `${exam.id}:${matched.id}`;
        if (existingPairs.has(pairKey)) continue;
        existingPairs.add(pairKey);

        newLinks.push({
          exam_id: exam.id,
          subject_id: matched.id,
          is_active: true,
          is_compulsory: exam.slug === 'jamb-utme' && Boolean(spec.isCompulsoryInJamb),
          display_order: spec.displayOrder,
        });
      }
    }

    if (newLinks.length > 0) {
      const { error: linkInsertError } = await supabase
        .from('exam_subjects')
        .insert(newLinks);

      if (linkInsertError) {
        return {
          subjectsCreated,
          linksCreated: 0,
          totalOfficialCount: OFFICIAL_JAMB_SUBJECTS.length,
          error: mapAdminError(linkInsertError),
        };
      }
      linksCreated = newLinks.length;
    }
  }

  return {
    subjectsCreated,
    linksCreated,
    totalOfficialCount: OFFICIAL_JAMB_SUBJECTS.length,
    error: null,
  };
}

// ============================================================================
// Topics Management
// ============================================================================

export async function fetchAllTopics(): Promise<{
  topics: Topic[];
  commentsColumnAvailable?: boolean;
  error: string | null;
}> {
  if (!supabase) return { topics: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase
    .from('topics')
    .select(
      'id, exam_id, subject_id, title, description, display_order, is_published, comments_enabled, created_at, updated_at'
    )
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42703' || (error.message ?? '').toLowerCase().includes('comments_enabled')) {
      const fallback = await supabase
        .from('topics')
        .select(
          'id, exam_id, subject_id, title, description, display_order, is_published, created_at, updated_at'
        )
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (fallback.error) {
        return { topics: [], commentsColumnAvailable: false, error: mapAdminError(fallback.error) };
      }

      return {
        topics: ((fallback.data ?? []) as Array<Omit<Topic, 'comments_enabled'>>).map((t) => ({
          ...t,
          comments_enabled: true,
        })),
        commentsColumnAvailable: false,
        error: null,
      };
    }

    return { topics: [], error: mapAdminError(error) };
  }

  return {
    topics: ((data ?? []) as Topic[]).map((t) => ({
      ...t,
      comments_enabled: t.comments_enabled ?? true,
    })),
    commentsColumnAvailable: true,
    error: null,
  };
}

export async function saveTopic(input: {
  id?: string;
  exam_id: string;
  subject_id: string;
  title: string;
  description: string;
  display_order: number;
  is_published: boolean;
  comments_enabled?: boolean;
}): Promise<{ topic: Topic | null; error: string | null }> {
  if (!supabase) return { topic: null, error: 'Supabase is not configured.' };

  const basePayload = {
    exam_id: input.exam_id,
    subject_id: input.subject_id,
    title: input.title.trim(),
    description: input.description.trim() || null,
    display_order: Number.isFinite(input.display_order) ? input.display_order : 0,
    is_published: input.is_published,
  };

  const payload = {
    ...basePayload,
    comments_enabled: input.comments_enabled ?? true,
  };

  if (input.id) {
    let { data, error } = await supabase
      .from('topics')
      .update(payload)
      .eq('id', input.id)
      .select(
        'id, exam_id, subject_id, title, description, display_order, is_published, comments_enabled, created_at, updated_at'
      )
      .single();

    if (error && (error.code === '42703' || (error.message ?? '').toLowerCase().includes('comments_enabled'))) {
      const fallback = await supabase
        .from('topics')
        .update(basePayload)
        .eq('id', input.id)
        .select(
          'id, exam_id, subject_id, title, description, display_order, is_published, created_at, updated_at'
        )
        .single();
      if (fallback.error) return { topic: null, error: mapAdminError(fallback.error) };
      return {
        topic: { ...(fallback.data as Omit<Topic, 'comments_enabled'>), comments_enabled: true },
        error: null,
      };
    }

    if (error) return { topic: null, error: mapAdminError(error) };
    return { topic: data as Topic, error: null };
  }

  const { data, error } = await supabase
    .from('topics')
    .insert(payload)
    .select(
      'id, exam_id, subject_id, title, description, display_order, is_published, comments_enabled, created_at, updated_at'
    )
    .single();

  if (error && (error.code === '42703' || (error.message ?? '').toLowerCase().includes('comments_enabled'))) {
    const fallback = await supabase
      .from('topics')
      .insert(basePayload)
      .select(
        'id, exam_id, subject_id, title, description, display_order, is_published, created_at, updated_at'
      )
      .single();
    if (fallback.error) return { topic: null, error: mapAdminError(fallback.error) };
    return {
      topic: { ...(fallback.data as Omit<Topic, 'comments_enabled'>), comments_enabled: true },
      error: null,
    };
  }

  if (error) return { topic: null, error: mapAdminError(error) };
  return { topic: data as Topic, error: null };
}

export async function updateTopicPublished(
  topicId: string,
  isPublished: boolean
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('topics')
    .update({ is_published: isPublished })
    .eq('id', topicId);
  return { error: error ? mapAdminError(error) : null };
}

export async function updateTopicCommentsEnabled(
  topicId: string,
  commentsEnabled: boolean
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('topics')
    .update({ comments_enabled: commentsEnabled })
    .eq('id', topicId);
  if (error && (error.code === '42703' || (error.message ?? '').toLowerCase().includes('comments_enabled'))) {
    return {
      error: 'Run supabase/migrations/007_social_engagement.sql in Supabase first to enable per-topic comment controls.',
    };
  }
  return { error: error ? mapAdminError(error) : null };
}

export async function deleteTopic(topicId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('topics').delete().eq('id', topicId);
  return { error: error ? mapAdminError(error) : null };
}

// ============================================================================
// Lessons, Materials & Links Management
// ============================================================================

export async function fetchAdminLessonsList(): Promise<{
  lessons: AdminLessonListItem[];
  exams: Exam[];
  subjects: Subject[];
  topics: Topic[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      lessons: [],
      exams: [],
      subjects: [],
      topics: [],
      error: 'Supabase is not configured.',
    };
  }

  const [examsRes, subjectsRes, topicsRes, lessonsRes] = await Promise.all([
    supabase
      .from('exams')
      .select('id, name, slug, description, is_active, created_at')
      .order('name', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name, slug, description, is_active, created_at')
      .order('name', { ascending: true }),
    supabase
      .from('topics')
      .select(
        'id, exam_id, subject_id, title, description, display_order, is_published, created_at, updated_at'
      )
      .order('display_order', { ascending: true }),
    supabase
      .from('lessons')
      .select(
        'id, topic_id, title, short_description, description, tutor_name, youtube_url, display_order, is_published, created_at, updated_at'
      )
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  const err = examsRes.error || subjectsRes.error || topicsRes.error || lessonsRes.error;
  if (err) {
    return {
      lessons: [],
      exams: [],
      subjects: [],
      topics: [],
      error: mapAdminError(err),
    };
  }

  const exams = (examsRes.data ?? []) as Exam[];
  const subjects = (subjectsRes.data ?? []) as Subject[];
  const topics = ((topicsRes.data ?? []) as Array<Omit<Topic, 'comments_enabled'>>).map((t) => ({
    ...t,
    comments_enabled: true,
  }));
  const rawLessons = (lessonsRes.data ?? []) as Lesson[];

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const lessons: AdminLessonListItem[] = rawLessons.map((lesson) => {
    const topic = topicMap.get(lesson.topic_id);
    const exam = topic ? examMap.get(topic.exam_id) : undefined;
    const subject = topic ? subjectMap.get(topic.subject_id) : undefined;

    return {
      id: lesson.id,
      topic_id: lesson.topic_id,
      title: lesson.title,
      short_description: lesson.short_description,
      tutor_name: lesson.tutor_name,
      youtube_url: lesson.youtube_url,
      display_order: lesson.display_order,
      is_published: lesson.is_published,
      updated_at: lesson.updated_at,
      topicTitle: topic?.title ?? 'Unknown topic',
      examId: topic?.exam_id ?? '',
      examName: exam?.name ?? 'Unknown exam',
      subjectId: topic?.subject_id ?? '',
      subjectName: subject?.name ?? 'Unknown subject',
    };
  });

  return { lessons, exams, subjects, topics, error: null };
}

export async function fetchLessonForEditor(lessonId: string): Promise<{
  lesson: Lesson | null;
  topic: Topic | null;
  materials: LessonMaterial[];
  links: LessonLink[];
  error: string | null;
}> {
  if (!supabase) {
    return {
      lesson: null,
      topic: null,
      materials: [],
      links: [],
      error: 'Supabase is not configured.',
    };
  }

  const [lessonRes, materialsRes, linksRes] = await Promise.all([
    supabase
      .from('lessons')
      .select(
        'id, topic_id, title, short_description, description, tutor_name, youtube_url, display_order, is_published, created_at, updated_at'
      )
      .eq('id', lessonId)
      .maybeSingle(),
    supabase
      .from('lesson_materials')
      .select('id, lesson_id, title, file_type, file_url, display_order, created_at')
      .eq('lesson_id', lessonId)
      .order('display_order', { ascending: true }),
    supabase
      .from('lesson_links')
      .select('id, lesson_id, title, url, display_order')
      .eq('lesson_id', lessonId)
      .order('display_order', { ascending: true }),
  ]);

  if (lessonRes.error) {
    return {
      lesson: null,
      topic: null,
      materials: [],
      links: [],
      error: mapAdminError(lessonRes.error),
    };
  }

  const lesson = lessonRes.data as Lesson | null;
  if (!lesson) {
    return {
      lesson: null,
      topic: null,
      materials: [],
      links: [],
      error: 'Lesson not found.',
    };
  }

  const topicRes = await supabase
    .from('topics')
    .select(
      'id, exam_id, subject_id, title, description, display_order, is_published, created_at, updated_at'
    )
    .eq('id', lesson.topic_id)
    .maybeSingle();

  return {
    lesson,
    topic: topicRes.data
      ? { ...(topicRes.data as Omit<Topic, 'comments_enabled'>), comments_enabled: true }
      : null,
    materials: (materialsRes.data ?? []) as LessonMaterial[],
    links: (linksRes.data ?? []) as LessonLink[],
    error: null,
  };
}

export async function saveLessonWithAttachments(
  input: LessonEditorInput
): Promise<{ lessonId: string | null; error: string | null }> {
  if (!supabase) return { lessonId: null, error: 'Supabase is not configured.' };

  const ytTrimmed = input.youtube_url.trim();
  if (ytTrimmed && !isValidYouTubeUrl(ytTrimmed)) {
    return {
      lessonId: null,
      error: 'Enter a valid YouTube link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...).',
    };
  }

  for (let i = 0; i < input.materials.length; i++) {
    const mat = input.materials[i];
    if (!mat.title.trim()) {
      return { lessonId: null, error: `Material #${i + 1} needs a title.` };
    }
    const urlCheck = validateMaterialUrl(mat.file_url);
    if (!urlCheck.valid) {
      return {
        lessonId: null,
        error: `Material "${mat.title.trim()}": ${urlCheck.error}`,
      };
    }
  }

  for (let i = 0; i < input.links.length; i++) {
    const lnk = input.links[i];
    if (!lnk.title.trim()) {
      return { lessonId: null, error: `Link #${i + 1} needs a title.` };
    }
    if (!isSafeExternalHttpUrl(lnk.url)) {
      return {
        lessonId: null,
        error: `Link "${lnk.title.trim()}" must start with https:// or http://.`,
      };
    }
  }

  const lessonPayload = {
    topic_id: input.topic_id,
    title: input.title.trim(),
    short_description: input.short_description.trim() || null,
    description: input.description.trim() || null,
    tutor_name: input.tutor_name.trim() || null,
    youtube_url: ytTrimmed || null,
    display_order: Number.isFinite(input.display_order) ? input.display_order : 0,
    is_published: input.is_published,
  };

  let lessonId = input.id ?? null;

  if (lessonId) {
    const { error } = await supabase
      .from('lessons')
      .update(lessonPayload)
      .eq('id', lessonId);
    if (error) return { lessonId: null, error: mapAdminError(error) };
  } else {
    const { data, error } = await supabase
      .from('lessons')
      .insert(lessonPayload)
      .select('id')
      .single();
    if (error) return { lessonId: null, error: mapAdminError(error) };
    lessonId = data.id;
  }

  // Replace materials list cleanly in admin-defined order
  const delMatRes = await supabase
    .from('lesson_materials')
    .delete()
    .eq('lesson_id', lessonId);
  if (delMatRes.error) {
    return { lessonId, error: mapAdminError(delMatRes.error) };
  }

  if (input.materials.length > 0) {
    const matRows = input.materials.map((m, idx) => ({
      lesson_id: lessonId as string,
      title: m.title.trim(),
      file_type: m.file_type,
      file_url: m.file_url.trim(),
      display_order: idx + 1,
    }));
    const insMatRes = await supabase.from('lesson_materials').insert(matRows);
    if (insMatRes.error) {
      return { lessonId, error: mapAdminError(insMatRes.error) };
    }
  }

  // Replace links list cleanly in admin-defined order
  const delLinkRes = await supabase
    .from('lesson_links')
    .delete()
    .eq('lesson_id', lessonId);
  if (delLinkRes.error) {
    return { lessonId, error: mapAdminError(delLinkRes.error) };
  }

  if (input.links.length > 0) {
    const linkRows = input.links.map((l, idx) => ({
      lesson_id: lessonId as string,
      title: l.title.trim(),
      url: l.url.trim(),
      display_order: idx + 1,
    }));
    const insLinkRes = await supabase.from('lesson_links').insert(linkRows);
    if (insLinkRes.error) {
      return { lessonId, error: mapAdminError(insLinkRes.error) };
    }
  }

  return { lessonId, error: null };
}

export async function updateLessonPublished(
  lessonId: string,
  isPublished: boolean
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('lessons')
    .update({ is_published: isPublished })
    .eq('id', lessonId);
  return { error: error ? mapAdminError(error) : null };
}

export async function updateLessonOrder(
  lessonId: string,
  displayOrder: number
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('lessons')
    .update({ display_order: displayOrder })
    .eq('id', lessonId);
  return { error: error ? mapAdminError(error) : null };
}

export async function deleteLesson(lessonId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
  return { error: error ? mapAdminError(error) : null };
}
