import { supabase } from '../lib/supabase';
import type {
  Exam,
  ExamSubject,
  Lesson,
  LessonLink,
  LessonMaterial,
  StudentExamProfile,
  StudentExamSubject,
  StudentLessonProgress,
  Subject,
  Topic,
} from '../types/database';
import type {
  ExamSubjectOption,
  ExamWithSubjects,
  LessonDetailData,
  RecentLessonItem,
  StudentEnrolledExam,
  TopicWithLessons,
} from '../types/learning';

export type ExamSelectionDraft = {
  examId: string;
  intendedCourse: string;
  institution: string;
  subjectIds: string[];
};

function mapDatabaseError(err: { message?: string; code?: string } | null): string {
  if (!err) return 'An unexpected error occurred.';
  const msg = (err.message ?? '').toLowerCase();
  if (err.code === '42P01' || msg.includes('relation')) {
    return 'Learning tables are not set up yet. Run the Phase 2 SQL migration in Supabase.';
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Network error while loading data. Check your connection and try again.';
  }
  return err.message || 'Unable to load learning data right now.';
}

export async function fetchActiveExamsWithSubjects(): Promise<{
  exams: ExamWithSubjects[];
  error: string | null;
}> {
  if (!supabase) {
    return { exams: [], error: 'Supabase is not configured.' };
  }

  const [examsRes, subjectsRes, examSubjectsRes] = await Promise.all([
    supabase
      .from('exams')
      .select('id, name, slug, description, is_active, created_at')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name, slug, description, is_active, created_at')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('exam_subjects')
      .select('id, exam_id, subject_id, is_active, is_compulsory, display_order, created_at')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ]);

  if (examsRes.error) return { exams: [], error: mapDatabaseError(examsRes.error) };
  if (subjectsRes.error) return { exams: [], error: mapDatabaseError(subjectsRes.error) };
  if (examSubjectsRes.error) return { exams: [], error: mapDatabaseError(examSubjectsRes.error) };

  const subjectMap = new Map<string, Subject>();
  for (const s of (subjectsRes.data ?? []) as Subject[]) {
    subjectMap.set(s.id, s);
  }

  const optionsByExam = new Map<string, ExamSubjectOption[]>();
  for (const es of (examSubjectsRes.data ?? []) as ExamSubject[]) {
    const subject = subjectMap.get(es.subject_id);
    if (!subject) continue;
    const list = optionsByExam.get(es.exam_id) ?? [];
    list.push({
      examSubjectId: es.id,
      examId: es.exam_id,
      subjectId: es.subject_id,
      isCompulsory: es.is_compulsory,
      displayOrder: es.display_order,
      subject,
    });
    optionsByExam.set(es.exam_id, list);
  }

  const exams: ExamWithSubjects[] = ((examsRes.data ?? []) as Exam[]).map((exam) => ({
    ...exam,
    availableSubjects: (optionsByExam.get(exam.id) ?? []).sort(
      (a, b) => a.displayOrder - b.displayOrder
    ),
  }));

  return { exams, error: null };
}

export async function fetchStudentEnrollments(studentId: string): Promise<{
  enrollments: StudentEnrolledExam[];
  error: string | null;
}> {
  if (!supabase) {
    return { enrollments: [], error: 'Supabase is not configured.' };
  }

  const [profilesRes, examsRes, subjectsRes] = await Promise.all([
    supabase
      .from('student_exam_profiles')
      .select('id, student_id, exam_id, intended_course, institution, created_at, updated_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true }),
    supabase
      .from('exams')
      .select('id, name, slug, description, is_active, created_at')
      .eq('is_active', true),
    supabase
      .from('subjects')
      .select('id, name, slug, description, is_active, created_at')
      .eq('is_active', true),
  ]);

  if (profilesRes.error) return { enrollments: [], error: mapDatabaseError(profilesRes.error) };
  if (examsRes.error) return { enrollments: [], error: mapDatabaseError(examsRes.error) };
  if (subjectsRes.error) return { enrollments: [], error: mapDatabaseError(subjectsRes.error) };

  const profiles = (profilesRes.data ?? []) as StudentExamProfile[];
  if (profiles.length === 0) {
    return { enrollments: [], error: null };
  }

  const profileIds = profiles.map((p) => p.id);
  const selectedRes = await supabase
    .from('student_exam_subjects')
    .select('id, student_exam_profile_id, subject_id, created_at')
    .in('student_exam_profile_id', profileIds);

  if (selectedRes.error) {
    return { enrollments: [], error: mapDatabaseError(selectedRes.error) };
  }

  const examMap = new Map<string, Exam>();
  for (const e of (examsRes.data ?? []) as Exam[]) {
    examMap.set(e.id, e);
  }

  const subjectMap = new Map<string, Subject>();
  for (const s of (subjectsRes.data ?? []) as Subject[]) {
    subjectMap.set(s.id, s);
  }

  const subjectsByProfile = new Map<string, Subject[]>();
  for (const row of (selectedRes.data ?? []) as StudentExamSubject[]) {
    const subj = subjectMap.get(row.subject_id);
    if (!subj) continue;
    const list = subjectsByProfile.get(row.student_exam_profile_id) ?? [];
    list.push(subj);
    subjectsByProfile.set(row.student_exam_profile_id, list);
  }

  const enrollments: StudentEnrolledExam[] = [];
  for (const p of profiles) {
    const exam = examMap.get(p.exam_id);
    if (!exam) continue;
    const selectedSubjects = (subjectsByProfile.get(p.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    enrollments.push({
      profileId: p.id,
      exam,
      intendedCourse: p.intended_course,
      institution: p.institution,
      selectedSubjects,
    });
  }

  return { enrollments, error: null };
}

export async function saveStudentExamSelections(
  studentId: string,
  drafts: ExamSelectionDraft[]
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const existingRes = await supabase
    .from('student_exam_profiles')
    .select('id, exam_id')
    .eq('student_id', studentId);

  if (existingRes.error) {
    return { error: mapDatabaseError(existingRes.error) };
  }

  const existingRows = (existingRes.data ?? []) as Array<{ id: string; exam_id: string }>;
  const existingByExam = new Map<string, string>();
  for (const row of existingRows) {
    existingByExam.set(row.exam_id, row.id);
  }

  const selectedExamIds = new Set(drafts.map((d) => d.examId));

  // Remove exam profiles that the student deselected
  const profileIdsToDelete = existingRows
    .filter((row) => !selectedExamIds.has(row.exam_id))
    .map((row) => row.id);

  if (profileIdsToDelete.length > 0) {
    const delRes = await supabase
      .from('student_exam_profiles')
      .delete()
      .in('id', profileIdsToDelete);
    if (delRes.error) {
      return { error: mapDatabaseError(delRes.error) };
    }
  }

  // Upsert each selected exam profile and sync its subjects independently
  for (const draft of drafts) {
    const existingProfileId = existingByExam.get(draft.examId);
    const course = draft.intendedCourse.trim() || null;
    const inst = draft.institution.trim() || null;

    let profileId: string;

    if (existingProfileId) {
      const updateRes = await supabase
        .from('student_exam_profiles')
        .update({ intended_course: course, institution: inst })
        .eq('id', existingProfileId)
        .select('id')
        .single();
      if (updateRes.error) {
        return { error: mapDatabaseError(updateRes.error) };
      }
      profileId = updateRes.data.id;
    } else {
      const insertRes = await supabase
        .from('student_exam_profiles')
        .insert({
          student_id: studentId,
          exam_id: draft.examId,
          intended_course: course,
          institution: inst,
        })
        .select('id')
        .single();
      if (insertRes.error) {
        return { error: mapDatabaseError(insertRes.error) };
      }
      profileId = insertRes.data.id;
    }

    // Sync subjects for this specific examination profile
    const currentSubjRes = await supabase
      .from('student_exam_subjects')
      .select('id, subject_id')
      .eq('student_exam_profile_id', profileId);

    if (currentSubjRes.error) {
      return { error: mapDatabaseError(currentSubjRes.error) };
    }

    const currentRows = (currentSubjRes.data ?? []) as Array<{ id: string; subject_id: string }>;
    const currentSet = new Set(currentRows.map((r) => r.subject_id));
    const desiredSet = new Set(draft.subjectIds);

    const toRemoveIds = currentRows
      .filter((r) => !desiredSet.has(r.subject_id))
      .map((r) => r.id);

    if (toRemoveIds.length > 0) {
      const rmRes = await supabase
        .from('student_exam_subjects')
        .delete()
        .in('id', toRemoveIds);
      if (rmRes.error) {
        return { error: mapDatabaseError(rmRes.error) };
      }
    }

    const toAdd = draft.subjectIds
      .filter((sid) => !currentSet.has(sid))
      .map((subjectId) => ({
        student_exam_profile_id: profileId,
        subject_id: subjectId,
      }));

    if (toAdd.length > 0) {
      const addRes = await supabase.from('student_exam_subjects').insert(toAdd);
      if (addRes.error) {
        return { error: mapDatabaseError(addRes.error) };
      }
    }
  }

  return { error: null };
}

export async function fetchLessonCountsByExamSubject(
  examIds: string[],
  subjectIds: string[]
): Promise<{ counts: Map<string, number>; error: string | null }> {
  const counts = new Map<string, number>();
  if (!supabase || examIds.length === 0 || subjectIds.length === 0) {
    return { counts, error: null };
  }

  const topicsRes = await supabase
    .from('topics')
    .select('id, exam_id, subject_id')
    .in('exam_id', examIds)
    .in('subject_id', subjectIds)
    .eq('is_published', true);

  if (topicsRes.error) {
    return { counts, error: mapDatabaseError(topicsRes.error) };
  }

  const topics = (topicsRes.data ?? []) as Array<{ id: string; exam_id: string; subject_id: string }>;
  if (topics.length === 0) {
    return { counts, error: null };
  }

  const topicIds = topics.map((t) => t.id);
  const lessonsRes = await supabase
    .from('lessons')
    .select('id, topic_id')
    .in('topic_id', topicIds)
    .eq('is_published', true);

  if (lessonsRes.error) {
    return { counts, error: mapDatabaseError(lessonsRes.error) };
  }

  const topicMap = new Map<string, { examId: string; subjectId: string }>();
  for (const t of topics) {
    topicMap.set(t.id, { examId: t.exam_id, subjectId: t.subject_id });
  }

  for (const lesson of (lessonsRes.data ?? []) as Array<{ id: string; topic_id: string }>) {
    const parent = topicMap.get(lesson.topic_id);
    if (!parent) continue;
    const key = `${parent.examId}:${parent.subjectId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return { counts, error: null };
}

export async function fetchRecentLesson(studentId: string): Promise<{
  recentLesson: RecentLessonItem | null;
  error: string | null;
}> {
  if (!supabase) {
    return { recentLesson: null, error: 'Supabase is not configured.' };
  }

  const progressRes = await supabase
    .from('student_lesson_progress')
    .select('lesson_id, is_completed, last_opened_at')
    .eq('student_id', studentId)
    .order('last_opened_at', { ascending: false })
    .limit(5);

  if (progressRes.error) {
    return { recentLesson: null, error: mapDatabaseError(progressRes.error) };
  }

  const progressRows = (progressRes.data ?? []) as Array<{
    lesson_id: string;
    is_completed: boolean;
    last_opened_at: string;
  }>;

  if (progressRows.length === 0) {
    return { recentLesson: null, error: null };
  }

  // Find the most recent progress row whose lesson & topic are still published & accessible via RLS
  for (const row of progressRows) {
    const lessonRes = await supabase
      .from('lessons')
      .select('id, title, topic_id')
      .eq('id', row.lesson_id)
      .eq('is_published', true)
      .maybeSingle();

    if (!lessonRes.data) continue;

    const topicRes = await supabase
      .from('topics')
      .select('id, title, exam_id, subject_id')
      .eq('id', lessonRes.data.topic_id)
      .eq('is_published', true)
      .maybeSingle();

    if (!topicRes.data) continue;

    const [examRes, subjectRes] = await Promise.all([
      supabase
        .from('exams')
        .select('name, slug')
        .eq('id', topicRes.data.exam_id)
        .maybeSingle(),
      supabase
        .from('subjects')
        .select('name, slug')
        .eq('id', topicRes.data.subject_id)
        .maybeSingle(),
    ]);

    if (!examRes.data || !subjectRes.data) continue;

    return {
      recentLesson: {
        lessonId: lessonRes.data.id,
        lessonTitle: lessonRes.data.title,
        topicTitle: topicRes.data.title,
        subjectName: subjectRes.data.name,
        subjectSlug: subjectRes.data.slug,
        examName: examRes.data.name,
        examSlug: examRes.data.slug,
        lastOpenedAt: row.last_opened_at,
        isCompleted: row.is_completed,
      },
      error: null,
    };
  }

  return { recentLesson: null, error: null };
}

export async function fetchSubjectTopicsAndLessons(
  studentId: string,
  examSlug: string,
  subjectSlug: string
): Promise<{
  exam: Exam | null;
  subject: Subject | null;
  topics: TopicWithLessons[];
  hasAccess: boolean;
  error: string | null;
}> {
  if (!supabase) {
    return {
      exam: null,
      subject: null,
      topics: [],
      hasAccess: false,
      error: 'Supabase is not configured.',
    };
  }

  const [examRes, subjectRes] = await Promise.all([
    supabase
      .from('exams')
      .select('id, name, slug, description, is_active, created_at')
      .eq('slug', examSlug)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('subjects')
      .select('id, name, slug, description, is_active, created_at')
      .eq('slug', subjectSlug)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (examRes.error) {
    return { exam: null, subject: null, topics: [], hasAccess: false, error: mapDatabaseError(examRes.error) };
  }
  if (subjectRes.error) {
    return { exam: null, subject: null, topics: [], hasAccess: false, error: mapDatabaseError(subjectRes.error) };
  }

  const exam = examRes.data as Exam | null;
  const subject = subjectRes.data as Subject | null;

  if (!exam || !subject) {
    return { exam, subject, topics: [], hasAccess: false, error: 'Examination or subject not found.' };
  }

  const accessRes = await supabase.rpc('student_has_subject_access', {
    p_exam_id: exam.id,
    p_subject_id: subject.id,
  });

  if (accessRes.error) {
    return { exam, subject, topics: [], hasAccess: false, error: mapDatabaseError(accessRes.error) };
  }

  const hasAccess = Boolean(accessRes.data);
  if (!hasAccess) {
    return { exam, subject, topics: [], hasAccess: false, error: null };
  }

  const topicsRes = await supabase
    .from('topics')
    .select('id, exam_id, subject_id, title, description, display_order, is_published, created_at, updated_at')
    .eq('exam_id', exam.id)
    .eq('subject_id', subject.id)
    .eq('is_published', true)
    .order('display_order', { ascending: true });

  if (topicsRes.error) {
    return { exam, subject, topics: [], hasAccess: true, error: mapDatabaseError(topicsRes.error) };
  }

  const topics = (topicsRes.data ?? []) as Topic[];
  if (topics.length === 0) {
    return { exam, subject, topics: [], hasAccess: true, error: null };
  }

  const topicIds = topics.map((t) => t.id);
  const lessonsRes = await supabase
    .from('lessons')
    .select(
      'id, topic_id, title, short_description, description, tutor_name, youtube_url, display_order, is_published, created_at, updated_at'
    )
    .in('topic_id', topicIds)
    .eq('is_published', true)
    .order('display_order', { ascending: true });

  if (lessonsRes.error) {
    return { exam, subject, topics: [], hasAccess: true, error: mapDatabaseError(lessonsRes.error) };
  }

  const lessons = (lessonsRes.data ?? []) as Lesson[];
  const lessonIds = lessons.map((l) => l.id);

  const completedSet = new Set<string>();
  if (lessonIds.length > 0) {
    const progRes = await supabase
      .from('student_lesson_progress')
      .select('lesson_id, is_completed')
      .eq('student_id', studentId)
      .in('lesson_id', lessonIds);

    if (!progRes.error && progRes.data) {
      for (const row of progRes.data as Array<{ lesson_id: string; is_completed: boolean }>) {
        if (row.is_completed) completedSet.add(row.lesson_id);
      }
    }
  }

  const lessonsByTopic = new Map<string, Array<Lesson & { isCompleted: boolean }>>();
  for (const lesson of lessons) {
    const list = lessonsByTopic.get(lesson.topic_id) ?? [];
    list.push({ ...lesson, isCompleted: completedSet.has(lesson.id) });
    lessonsByTopic.set(lesson.topic_id, list);
  }

  const topicsWithLessons: TopicWithLessons[] = topics.map((t) => ({
    ...t,
    lessons: (lessonsByTopic.get(t.id) ?? []).sort((a, b) => a.display_order - b.display_order),
  }));

  return { exam, subject, topics: topicsWithLessons, hasAccess: true, error: null };
}

export async function fetchLessonDetail(
  studentId: string,
  lessonId: string
): Promise<{
  data: LessonDetailData | null;
  error: string | null;
}> {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured.' };
  }

  const lessonRes = await supabase
    .from('lessons')
    .select(
      'id, topic_id, title, short_description, description, tutor_name, youtube_url, display_order, is_published, created_at, updated_at'
    )
    .eq('id', lessonId)
    .eq('is_published', true)
    .maybeSingle();

  if (lessonRes.error) {
    return { data: null, error: mapDatabaseError(lessonRes.error) };
  }

  const lesson = lessonRes.data as Lesson | null;
  if (!lesson) {
    return {
      data: null,
      error: 'Lesson not found, unpublished, or not included in your selected subjects.',
    };
  }

  const topicRes = await supabase
    .from('topics')
    .select('id, exam_id, subject_id, title, description, display_order, is_published, created_at, updated_at')
    .eq('id', lesson.topic_id)
    .eq('is_published', true)
    .maybeSingle();

  if (topicRes.error || !topicRes.data) {
    return {
      data: null,
      error: topicRes.error ? mapDatabaseError(topicRes.error) : 'Topic not found.',
    };
  }

  const topic = topicRes.data as Topic;

  const [examRes, subjectRes, materialsRes, linksRes, subjectTopicsRes, progressRes] =
    await Promise.all([
      supabase
        .from('exams')
        .select('id, name, slug, description, is_active, created_at')
        .eq('id', topic.exam_id)
        .single(),
      supabase
        .from('subjects')
        .select('id, name, slug, description, is_active, created_at')
        .eq('id', topic.subject_id)
        .single(),
      supabase
        .from('lesson_materials')
        .select('id, lesson_id, title, file_type, file_url, display_order, created_at')
        .eq('lesson_id', lesson.id)
        .order('display_order', { ascending: true }),
      supabase
        .from('lesson_links')
        .select('id, lesson_id, title, url, display_order')
        .eq('lesson_id', lesson.id)
        .order('display_order', { ascending: true }),
      supabase
        .from('topics')
        .select('id, title, display_order')
        .eq('exam_id', topic.exam_id)
        .eq('subject_id', topic.subject_id)
        .eq('is_published', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('student_lesson_progress')
        .select('id, is_completed')
        .eq('student_id', studentId)
        .eq('lesson_id', lesson.id)
        .maybeSingle(),
    ]);

  if (examRes.error || subjectRes.error) {
    return { data: null, error: 'Unable to load examination or subject details.' };
  }

  // Record recently opened timestamp reliably
  const nowIso = new Date().toISOString();
  void supabase
    .from('student_lesson_progress')
    .upsert(
      {
        student_id: studentId,
        lesson_id: lesson.id,
        last_opened_at: nowIso,
      },
      { onConflict: 'student_id,lesson_id' }
    );

  // Build ordered sequence across all published topics/lessons for Previous/Next & Related
  const orderedTopics = (subjectTopicsRes.data ?? []) as Array<{
    id: string;
    title: string;
    display_order: number;
  }>;
  const allTopicIds = orderedTopics.map((t) => t.id);

  let previousLesson: { id: string; title: string } | null = null;
  let nextLesson: { id: string; title: string } | null = null;
  const relatedLessons: LessonDetailData['relatedLessons'] = [];

  if (allTopicIds.length > 0) {
    const [allLessonsRes, allProgressRes] = await Promise.all([
      supabase
        .from('lessons')
        .select('id, topic_id, title, short_description, display_order')
        .in('topic_id', allTopicIds)
        .eq('is_published', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('student_lesson_progress')
        .select('lesson_id, is_completed')
        .eq('student_id', studentId),
    ]);

    const topicOrderMap = new Map<string, { order: number; title: string }>();
    orderedTopics.forEach((t, idx) => topicOrderMap.set(t.id, { order: idx, title: t.title }));

    const completedIds = new Set<string>();
    for (const p of (allProgressRes.data ?? []) as Array<{ lesson_id: string; is_completed: boolean }>) {
      if (p.is_completed) completedIds.add(p.lesson_id);
    }

    const flatLessons = ((allLessonsRes.data ?? []) as Array<{
      id: string;
      topic_id: string;
      title: string;
      short_description: string | null;
      display_order: number;
    }>).sort((a, b) => {
      const ta = topicOrderMap.get(a.topic_id)?.order ?? 0;
      const tb = topicOrderMap.get(b.topic_id)?.order ?? 0;
      if (ta !== tb) return ta - tb;
      return a.display_order - b.display_order;
    });

    const currentIdx = flatLessons.findIndex((l) => l.id === lesson.id);
    if (currentIdx > 0) {
      previousLesson = {
        id: flatLessons[currentIdx - 1].id,
        title: flatLessons[currentIdx - 1].title,
      };
    }
    if (currentIdx >= 0 && currentIdx < flatLessons.length - 1) {
      nextLesson = {
        id: flatLessons[currentIdx + 1].id,
        title: flatLessons[currentIdx + 1].title,
      };
    }

    // Prefer sibling lessons in the same topic first, then adjacent lessons in the subject
    const sameTopicOthers = flatLessons.filter(
      (l) => l.topic_id === lesson.topic_id && l.id !== lesson.id
    );
    const otherTopicLessons = flatLessons.filter(
      (l) => l.topic_id !== lesson.topic_id && l.id !== lesson.id
    );
    for (const rel of [...sameTopicOthers, ...otherTopicLessons].slice(0, 4)) {
      relatedLessons.push({
        id: rel.id,
        title: rel.title,
        short_description: rel.short_description,
        topicTitle: topicOrderMap.get(rel.topic_id)?.title ?? topic.title,
        isCompleted: completedIds.has(rel.id),
      });
    }
  }

  const isCompleted = Boolean((progressRes.data as StudentLessonProgress | null)?.is_completed);

  return {
    data: {
      lesson,
      topic,
      exam: examRes.data as Exam,
      subject: subjectRes.data as Subject,
      materials: (materialsRes.data ?? []) as LessonMaterial[],
      links: (linksRes.data ?? []) as LessonLink[],
      isCompleted,
      previousLesson,
      nextLesson,
      relatedLessons,
    },
    error: null,
  };
}

export async function setLessonCompletion(
  studentId: string,
  lessonId: string,
  isCompleted: boolean
): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from('student_lesson_progress').upsert(
    {
      student_id: studentId,
      lesson_id: lessonId,
      is_completed: isCompleted,
      completed_at: isCompleted ? nowIso : null,
      last_opened_at: nowIso,
    },
    { onConflict: 'student_id,lesson_id' }
  );

  if (error) {
    return { error: mapDatabaseError(error) };
  }

  return { error: null };
}
