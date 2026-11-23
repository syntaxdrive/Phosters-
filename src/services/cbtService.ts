import {
  cacheStudentAttempts,
  cacheStudentTest,
  enqueueOfflineAction,
  getOfflineKv,
  isDeviceOnline,
  isLikelyNetworkError,
  offlineKeys,
  putOfflineKv,
  type CachedLessonBundle,
  type CachedReviewBundle,
  type CachedSubjectBundle,
} from '../lib/offlineDb';
import { supabase } from '../lib/supabase';
import type {
  AdminTestEditorInput,
  AdminTestListItem,
  AttemptReviewPayload,
  StudentAttemptSummary,
  StudentTestPayload,
} from '../types/cbt';
import type {
  Exam,
  Lesson,
  Question,
  QuestionOption,
  Subject,
  Test,
  TestAttempt,
  Topic,
} from '../types/database';

function mapCbtError(err: { message?: string; code?: string } | null): string {
  if (!err) return 'An unexpected error occurred.';
  const msg = (err.message ?? '').toLowerCase();
  if (err.code === '42P01' || msg.includes('relation')) {
    return 'Test tables are not set up yet. Run the Phase 4 SQL migration in Supabase.';
  }
  if (err.code === '42501') {
    return 'You do not have permission for this test action.';
  }
  if (isLikelyNetworkError(err)) {
    return 'Network unavailable. Connect to the internet or use downloaded tests.';
  }
  return err.message || 'Unable to process test request right now.';
}

// ============================================================================
// Student CBT Operations (Never read answer keys before submission)
// ============================================================================

export async function fetchPublishedTestsForLesson(
  lessonId: string,
  topicId: string,
  studentId?: string
): Promise<{ tests: Test[]; error: string | null }> {
  if (!supabase) return { tests: [], error: 'Supabase is not configured.' };

  const readCache = async (): Promise<Test[] | null> => {
    if (!studentId) return null;
    const cached = await getOfflineKv<CachedLessonBundle>(offlineKeys.lesson(studentId, lessonId));
    return cached?.value?.attachedTests ?? null;
  };

  if (!isDeviceOnline()) {
    const cached = await readCache();
    return { tests: cached ?? [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('tests')
      .select(
        'id, title, description, topic_id, lesson_id, is_published, show_explanations_after_submission, created_at, updated_at'
      )
      .eq('is_published', true)
      .or(`lesson_id.eq.${lessonId},and(topic_id.eq.${topicId},lesson_id.is.null)`)
      .order('created_at', { ascending: true });

    if (error) {
      if (isLikelyNetworkError(error)) {
        const cached = await readCache();
        if (cached) return { tests: cached, error: null };
      }
      // Gracefully handle before Phase 4 SQL migration is applied
      if (error.code === '42P01') return { tests: [], error: null };
      return { tests: [], error: mapCbtError(error) };
    }

    const tests = (data ?? []) as Test[];
    if (studentId) {
      const key = offlineKeys.lesson(studentId, lessonId);
      const existing = await getOfflineKv<CachedLessonBundle>(key);
      if (existing?.value) {
        void putOfflineKv<CachedLessonBundle>({
          ...existing,
          value: {
            ...existing.value,
            attachedTests: tests,
          },
          updatedAt: Date.now(),
        });
      }
    }

    return { tests, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cached = await readCache();
      if (cached) return { tests: cached, error: null };
    }
    return { tests: [], error: 'Network error while loading lesson tests.' };
  }
}

export async function fetchPublishedTopicTests(
  topicIds: string[],
  studentId?: string,
  subjectRef?: { examSlug: string; subjectSlug: string }
): Promise<{ testsByTopic: Map<string, Test[]>; error: string | null }> {
  const testsByTopic = new Map<string, Test[]>();
  if (!supabase || topicIds.length === 0) {
    return { testsByTopic, error: null };
  }

  const readCache = async (): Promise<Map<string, Test[]> | null> => {
    if (!studentId || !subjectRef) return null;
    const cached = await getOfflineKv<CachedSubjectBundle>(
      offlineKeys.subject(studentId, subjectRef.examSlug, subjectRef.subjectSlug)
    );
    if (!cached?.value?.testsByTopicEntries) return null;
    return new Map<string, Test[]>(cached.value.testsByTopicEntries);
  };

  if (!isDeviceOnline()) {
    const cached = await readCache();
    return { testsByTopic: cached ?? testsByTopic, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('tests')
      .select(
        'id, title, description, topic_id, lesson_id, is_published, show_explanations_after_submission, created_at, updated_at'
      )
      .eq('is_published', true)
      .in('topic_id', topicIds)
      .is('lesson_id', null)
      .order('created_at', { ascending: true });

    if (error) {
      if (isLikelyNetworkError(error)) {
        const cached = await readCache();
        if (cached) return { testsByTopic: cached, error: null };
      }
      if (error.code === '42P01') return { testsByTopic, error: null };
      return { testsByTopic, error: mapCbtError(error) };
    }

    for (const t of (data ?? []) as Test[]) {
      if (!t.topic_id) continue;
      const list = testsByTopic.get(t.topic_id) ?? [];
      list.push(t);
      testsByTopic.set(t.topic_id, list);
    }

    if (studentId && subjectRef) {
      const key = offlineKeys.subject(studentId, subjectRef.examSlug, subjectRef.subjectSlug);
      const existing = await getOfflineKv<CachedSubjectBundle>(key);
      if (existing?.value) {
        void putOfflineKv<CachedSubjectBundle>({
          ...existing,
          value: {
            ...existing.value,
            testsByTopicEntries: Array.from(testsByTopic.entries()),
          },
          updatedAt: Date.now(),
        });
      }
    }

    return { testsByTopic, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cached = await readCache();
      if (cached) return { testsByTopic: cached, error: null };
    }
    return { testsByTopic, error: 'Network error while loading topic tests.' };
  }
}

export async function fetchTestForTaking(
  testId: string,
  studentId?: string
): Promise<{ payload: StudentTestPayload | null; fromCache?: boolean; error: string | null }> {
  if (!supabase) return { payload: null, error: 'Supabase is not configured.' };

  const readCache = async (): Promise<StudentTestPayload | null> => {
    if (!studentId) return null;
    const cached = await getOfflineKv<StudentTestPayload>(offlineKeys.test(studentId, testId));
    return cached?.value ?? null;
  };

  if (!isDeviceOnline()) {
    const cached = await readCache();
    if (cached) return { payload: cached, fromCache: true, error: null };
    return {
      payload: null,
      error: 'You are offline and this practice test has not been saved for offline study yet.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_published_test_for_student', {
      p_test_id: testId,
    });

    if (error) {
      if (isLikelyNetworkError(error)) {
        const cached = await readCache();
        if (cached) return { payload: cached, fromCache: true, error: null };
      }
      return { payload: null, error: mapCbtError(error) };
    }

    const payload = data as StudentTestPayload;
    if (studentId && payload?.test?.id) {
      void cacheStudentTest(studentId, payload, false);
    }

    return { payload, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cached = await readCache();
      if (cached) return { payload: cached, fromCache: true, error: null };
    }
    return { payload: null, error: 'Network error while loading test questions.' };
  }
}

export async function submitStudentTestAttempt(
  testId: string,
  answers: Record<string, string>,
  offlineMeta?: {
    studentId?: string;
    testTitle?: string;
    totalQuestions?: number;
  }
): Promise<{ attemptId: string | null; queuedOffline?: boolean; error: string | null }> {
  if (!supabase) return { attemptId: null, error: 'Supabase is not configured.' };

  const queueSubmission = async (): Promise<{
    attemptId: string | null;
    queuedOffline?: boolean;
    error: string | null;
  }> => {
    if (!offlineMeta?.studentId) {
      return {
        attemptId: null,
        error: 'You are offline. Reconnect to submit your test answers.',
      };
    }

    const answeredCount = Object.keys(answers).filter((k) => Boolean(answers[k])).length;
    await enqueueOfflineAction({
      id: `ts:${offlineMeta.studentId}:${testId}:${Date.now()}`,
      userId: offlineMeta.studentId,
      kind: 'test_submission',
      createdAt: Date.now(),
      payload: {
        testId,
        testTitle: offlineMeta.testTitle ?? 'Practice Test',
        answers,
        answeredCount,
        totalQuestions: offlineMeta.totalQuestions ?? answeredCount,
      },
    });
    return { attemptId: null, queuedOffline: true, error: null };
  };

  if (!isDeviceOnline()) {
    return queueSubmission();
  }

  try {
    const { data, error } = await supabase.rpc('submit_test_attempt', {
      p_test_id: testId,
      p_answers: answers,
    });

    if (error) {
      if (isLikelyNetworkError(error)) {
        return queueSubmission();
      }
      return { attemptId: null, error: mapCbtError(error) };
    }

    return { attemptId: data as string, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      return queueSubmission();
    }
    return { attemptId: null, error: 'Failed to submit test. Please try again.' };
  }
}

export async function fetchStudentAttempts(
  studentId: string,
  limit = 30
): Promise<{ attempts: StudentAttemptSummary[]; fromCache?: boolean; error: string | null }> {
  if (!supabase) return { attempts: [], error: 'Supabase is not configured.' };

  const readCache = async (): Promise<StudentAttemptSummary[] | null> => {
    const cached = await getOfflineKv<StudentAttemptSummary[]>(offlineKeys.attempts(studentId));
    return cached?.value ?? null;
  };

  if (!isDeviceOnline()) {
    const cached = await readCache();
    if (cached) return { attempts: cached.slice(0, limit), fromCache: true, error: null };
    return { attempts: [], fromCache: true, error: null };
  }

  try {
    const attemptsRes = await supabase
      .from('test_attempts')
      .select('id, test_id, score, total_points, percentage, submitted_at')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (attemptsRes.error) {
      if (isLikelyNetworkError(attemptsRes.error)) {
        const cached = await readCache();
        if (cached) return { attempts: cached.slice(0, limit), fromCache: true, error: null };
      }
      if (attemptsRes.error.code === '42P01') return { attempts: [], error: null };
      return { attempts: [], error: mapCbtError(attemptsRes.error) };
    }

    const rows = (attemptsRes.data ?? []) as Array<
      Pick<TestAttempt, 'id' | 'test_id' | 'score' | 'total_points' | 'percentage' | 'submitted_at'>
    >;
    if (rows.length === 0) {
      void cacheStudentAttempts(studentId, []);
      return { attempts: [], error: null };
    }

    const testIds = Array.from(new Set(rows.map((r) => r.test_id)));
    const testsRes = await supabase
      .from('tests')
      .select('id, title')
      .in('id', testIds);

    const testTitleMap = new Map<string, string>();
    if (!testsRes.error && testsRes.data) {
      for (const t of testsRes.data as Array<{ id: string; title: string }>) {
        testTitleMap.set(t.id, t.title);
      }
    }

    const attempts: StudentAttemptSummary[] = rows.map((r) => ({
      id: r.id,
      test_id: r.test_id,
      test_title: testTitleMap.get(r.test_id) ?? 'Phosters Test',
      score: r.score,
      total_points: r.total_points,
      percentage: Number(r.percentage),
      submitted_at: r.submitted_at,
    }));

    void cacheStudentAttempts(studentId, attempts);
    return { attempts, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cached = await readCache();
      if (cached) return { attempts: cached.slice(0, limit), fromCache: true, error: null };
    }
    return { attempts: [], error: 'Network error while loading test attempts.' };
  }
}

export async function fetchAttemptReview(
  attemptId: string,
  studentId?: string
): Promise<{ review: AttemptReviewPayload | null; fromCache?: boolean; error: string | null }> {
  if (!supabase) return { review: null, error: 'Supabase is not configured.' };

  const readCache = async (): Promise<AttemptReviewPayload | null> => {
    if (!studentId) return null;
    const cached = await getOfflineKv<CachedReviewBundle>(offlineKeys.review(studentId, attemptId));
    return cached?.value?.review ?? null;
  };

  if (!isDeviceOnline()) {
    const cached = await readCache();
    if (cached) return { review: cached, fromCache: true, error: null };
    return {
      review: null,
      error: 'You are offline and this test review was not opened online on this device yet.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_test_attempt_review', {
      p_attempt_id: attemptId,
    });

    if (error) {
      if (isLikelyNetworkError(error)) {
        const cached = await readCache();
        if (cached) return { review: cached, fromCache: true, error: null };
      }
      return { review: null, error: mapCbtError(error) };
    }

    const review = data as AttemptReviewPayload;
    if (studentId && review) {
      const existing = await getOfflineKv<CachedReviewBundle>(offlineKeys.review(studentId, attemptId));
      void putOfflineKv<CachedReviewBundle>({
        key: offlineKeys.review(studentId, attemptId),
        userId: studentId,
        category: 'review',
        value: {
          review,
          courseContext: existing?.value?.courseContext ?? { examName: null, subjectName: null },
        },
        updatedAt: Date.now(),
      });
    }

    return { review, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cached = await readCache();
      if (cached) return { review: cached, fromCache: true, error: null };
    }
    return { review: null, error: 'Network error while loading test result.' };
  }
}

export async function fetchTestCourseContext(
  topicId: string | null,
  lessonId: string | null,
  studentId?: string,
  attemptId?: string
): Promise<{
  examName: string | null;
  subjectName: string | null;
}> {
  if (!supabase) return { examName: null, subjectName: null };

  const readCache = async () => {
    if (!studentId || !attemptId) return null;
    const cached = await getOfflineKv<CachedReviewBundle>(offlineKeys.review(studentId, attemptId));
    return cached?.value?.courseContext ?? null;
  };

  if (!isDeviceOnline()) {
    return (await readCache()) ?? { examName: null, subjectName: null };
  }

  try {
    let resolvedTopicId = topicId;
    if (!resolvedTopicId && lessonId) {
      const lessonRes = await supabase
        .from('lessons')
        .select('topic_id')
        .eq('id', lessonId)
        .maybeSingle();
      resolvedTopicId = lessonRes.data?.topic_id ?? null;
    }

    if (!resolvedTopicId) {
      return { examName: null, subjectName: null };
    }

    const topicRes = await supabase
      .from('topics')
      .select('exam_id, subject_id')
      .eq('id', resolvedTopicId)
      .maybeSingle();

    if (!topicRes.data) {
      return { examName: null, subjectName: null };
    }

    const [examRes, subjectRes] = await Promise.all([
      supabase.from('exams').select('name').eq('id', topicRes.data.exam_id).maybeSingle(),
      supabase.from('subjects').select('name').eq('id', topicRes.data.subject_id).maybeSingle(),
    ]);

    const ctx = {
      examName: examRes.data?.name ?? null,
      subjectName: subjectRes.data?.name ?? null,
    };

    if (studentId && attemptId) {
      const existing = await getOfflineKv<CachedReviewBundle>(offlineKeys.review(studentId, attemptId));
      if (existing?.value) {
        void putOfflineKv<CachedReviewBundle>({
          ...existing,
          value: {
            ...existing.value,
            courseContext: ctx,
          },
          updatedAt: Date.now(),
        });
      }
    }

    return ctx;
  } catch {
    return (await readCache()) ?? { examName: null, subjectName: null };
  }
}

// ============================================================================
// Admin CBT Management
// ============================================================================

export async function fetchAdminTestsList(): Promise<{
  tests: AdminTestListItem[];
  error: string | null;
}> {
  if (!supabase) return { tests: [], error: 'Supabase is not configured.' };

  const [testsRes, questionsRes, topicsRes, lessonsRes, examsRes, subjectsRes] =
    await Promise.all([
      supabase
        .from('tests')
        .select(
          'id, title, description, topic_id, lesson_id, is_published, show_explanations_after_submission, created_at, updated_at'
        )
        .order('updated_at', { ascending: false }),
      supabase.from('questions').select('id, test_id'),
      supabase.from('topics').select('id, title, exam_id, subject_id'),
      supabase.from('lessons').select('id, title, topic_id'),
      supabase.from('exams').select('id, name'),
      supabase.from('subjects').select('id, name'),
    ]);

  const firstErr =
    testsRes.error ||
    questionsRes.error ||
    topicsRes.error ||
    lessonsRes.error ||
    examsRes.error ||
    subjectsRes.error;

  if (firstErr) {
    return { tests: [], error: mapCbtError(firstErr) };
  }

  const questionCounts = new Map<string, number>();
  for (const q of (questionsRes.data ?? []) as Array<{ id: string; test_id: string }>) {
    questionCounts.set(q.test_id, (questionCounts.get(q.test_id) ?? 0) + 1);
  }

  const examMap = new Map(((examsRes.data ?? []) as Array<Pick<Exam, 'id' | 'name'>>).map((e) => [e.id, e.name]));
  const subjectMap = new Map(
    ((subjectsRes.data ?? []) as Array<Pick<Subject, 'id' | 'name'>>).map((s) => [s.id, s.name])
  );
  const topicMap = new Map(
    ((topicsRes.data ?? []) as Array<Pick<Topic, 'id' | 'title' | 'exam_id' | 'subject_id'>>).map(
      (t) => [t.id, t]
    )
  );
  const lessonMap = new Map(
    ((lessonsRes.data ?? []) as Array<Pick<Lesson, 'id' | 'title' | 'topic_id'>>).map((l) => [
      l.id,
      l,
    ])
  );

  const items: AdminTestListItem[] = ((testsRes.data ?? []) as Test[]).map((t) => {
    let targetLabel = 'Unattached';
    if (t.lesson_id) {
      const lesson = lessonMap.get(t.lesson_id);
      const topic = lesson ? topicMap.get(lesson.topic_id) : undefined;
      const examName = topic ? examMap.get(topic.exam_id) : undefined;
      const subjName = topic ? subjectMap.get(topic.subject_id) : undefined;
      targetLabel = [examName, subjName, lesson?.title ? `Lesson: ${lesson.title}` : null]
        .filter(Boolean)
        .join(' · ');
    } else if (t.topic_id) {
      const topic = topicMap.get(t.topic_id);
      const examName = topic ? examMap.get(topic.exam_id) : undefined;
      const subjName = topic ? subjectMap.get(topic.subject_id) : undefined;
      targetLabel = [examName, subjName, topic?.title ? `Topic: ${topic.title}` : null]
        .filter(Boolean)
        .join(' · ');
    }

    return {
      id: t.id,
      title: t.title,
      description: t.description,
      topic_id: t.topic_id,
      lesson_id: t.lesson_id,
      is_published: t.is_published,
      show_explanations_after_submission: t.show_explanations_after_submission,
      updated_at: t.updated_at,
      questionCount: questionCounts.get(t.id) ?? 0,
      targetLabel: targetLabel || 'Unattached',
    };
  });

  return { tests: items, error: null };
}

export async function fetchTestForAdminEditor(testId: string): Promise<{
  test: Test | null;
  questions: Array<Question & { options: QuestionOption[] }>;
  error: string | null;
}> {
  if (!supabase) {
    return { test: null, questions: [], error: 'Supabase is not configured.' };
  }

  const [testRes, questionsRes] = await Promise.all([
    supabase
      .from('tests')
      .select(
        'id, title, description, topic_id, lesson_id, is_published, show_explanations_after_submission, created_at, updated_at'
      )
      .eq('id', testId)
      .maybeSingle(),
    supabase
      .from('questions')
      .select('id, test_id, question_text, explanation, display_order, points')
      .eq('test_id', testId)
      .order('display_order', { ascending: true }),
  ]);

  if (testRes.error) {
    return { test: null, questions: [], error: mapCbtError(testRes.error) };
  }
  if (!testRes.data) {
    return { test: null, questions: [], error: 'Test not found.' };
  }
  if (questionsRes.error) {
    return { test: null, questions: [], error: mapCbtError(questionsRes.error) };
  }

  const questions = (questionsRes.data ?? []) as Question[];
  const questionIds = questions.map((q) => q.id);

  const optionsByQuestion = new Map<string, QuestionOption[]>();
  if (questionIds.length > 0) {
    const optRes = await supabase
      .from('question_options')
      .select('id, question_id, option_text, option_key, is_correct, display_order')
      .in('question_id', questionIds)
      .order('display_order', { ascending: true });

    if (optRes.error) {
      return { test: null, questions: [], error: mapCbtError(optRes.error) };
    }

    for (const o of (optRes.data ?? []) as QuestionOption[]) {
      const list = optionsByQuestion.get(o.question_id) ?? [];
      list.push(o);
      optionsByQuestion.set(o.question_id, list);
    }
  }

  return {
    test: testRes.data as Test,
    questions: questions.map((q) => ({
      ...q,
      options: optionsByQuestion.get(q.id) ?? [],
    })),
    error: null,
  };
}

export async function saveAdminTest(
  input: AdminTestEditorInput
): Promise<{ testId: string | null; error: string | null }> {
  if (!supabase) return { testId: null, error: 'Supabase is not configured.' };

  if (input.title.trim().length < 2) {
    return { testId: null, error: 'Test title must be at least 2 characters.' };
  }
  if (!input.topic_id && !input.lesson_id) {
    return { testId: null, error: 'Attach this test to a topic or a lesson.' };
  }
  if (input.questions.length === 0) {
    return { testId: null, error: 'Add at least one question before saving.' };
  }

  for (let i = 0; i < input.questions.length; i++) {
    const q = input.questions[i];
    if (!q.question_text.trim()) {
      return { testId: null, error: `Question #${i + 1} needs question text.` };
    }
    if (q.points < 1) {
      return { testId: null, error: `Question #${i + 1} points must be at least 1.` };
    }
    if (q.options.length < 2) {
      return {
        testId: null,
        error: `Question #${i + 1} must have at least 2 answer options.`,
      };
    }
    const emptyOpt = q.options.find((o) => !o.option_text.trim());
    if (emptyOpt) {
      return {
        testId: null,
        error: `Question #${i + 1} option ${emptyOpt.option_key} cannot be empty.`,
      };
    }
    const correctCount = q.options.filter((o) => o.is_correct).length;
    if (correctCount !== 1) {
      return {
        testId: null,
        error: `Question #${i + 1} must have exactly one correct answer selected.`,
      };
    }
  }

  const testPayload = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    topic_id: input.topic_id,
    lesson_id: input.lesson_id,
    is_published: input.is_published,
    show_explanations_after_submission: input.show_explanations_after_submission,
  };

  let testId = input.id ?? null;

  if (testId) {
    const { error } = await supabase
      .from('tests')
      .update(testPayload)
      .eq('id', testId);
    if (error) return { testId: null, error: mapCbtError(error) };

    // Remove previous questions (cascades to question_options) and replace cleanly
    const delRes = await supabase.from('questions').delete().eq('test_id', testId);
    if (delRes.error) return { testId, error: mapCbtError(delRes.error) };
  } else {
    const { data, error } = await supabase
      .from('tests')
      .insert(testPayload)
      .select('id')
      .single();
    if (error) return { testId: null, error: mapCbtError(error) };
    testId = data.id;
  }

  for (let qi = 0; qi < input.questions.length; qi++) {
    const q = input.questions[qi];
    const qRes = await supabase
      .from('questions')
      .insert({
        test_id: testId,
        question_text: q.question_text.trim(),
        explanation: q.explanation.trim() || null,
        display_order: qi + 1,
        points: q.points,
      })
      .select('id')
      .single();

    if (qRes.error) {
      return { testId, error: mapCbtError(qRes.error) };
    }

    const optionRows = q.options.map((opt, oi) => ({
      question_id: qRes.data.id,
      option_text: opt.option_text.trim(),
      option_key: opt.option_key,
      is_correct: opt.is_correct,
      display_order: oi + 1,
    }));

    const optRes = await supabase.from('question_options').insert(optionRows);
    if (optRes.error) {
      return { testId, error: mapCbtError(optRes.error) };
    }
  }

  return { testId, error: null };
}

export async function updateTestPublished(
  testId: string,
  isPublished: boolean
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('tests')
    .update({ is_published: isPublished })
    .eq('id', testId);
  return { error: error ? mapCbtError(error) : null };
}

export async function deleteTest(testId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('tests').delete().eq('id', testId);
  return { error: error ? mapCbtError(error) : null };
}
