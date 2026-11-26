import {
  cacheMockAttempts,
  cacheMockSession,
  deleteOfflineKv,
  enqueueOfflineAction,
  getOfflineKv,
  isDeviceOnline,
  isLikelyNetworkError,
  offlineKeys,
  putOfflineKv,
} from '../lib/offlineDb';
import {
  deriveReleaseStatus,
  isItemCurrentlyReleased,
  isMissingReleaseQueueColumnError,
} from '../lib/releaseQueue';
import { supabase } from '../lib/supabase';
import type {
  AdminMockCustomQuestionInput,
  AdminMockExamListItem,
  MockAttemptReviewPayload,
  MockAttemptSummary,
  MockExamMode,
  MockExamRecord,
  MockSessionPayload,
  MockSubjectBreakdown,
  MockSubjectReadiness,
} from '../types/cbt';
import type { Exam, ReleaseStatus, Subject } from '../types/database';
import type { StudentEnrolledExam } from '../types/learning';
import { fetchStudentEnrollments } from './learningService';

function isMissingMockMigrationError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    err.code === '42883' ||
    (msg.includes('mock_') && (msg.includes('does not exist') || msg.includes('schema cache'))) ||
    (msg.includes('start_mock_exam_session') && msg.includes('could not find'))
  );
}

function mapMockError(err: { message?: string; code?: string } | null): string {
  if (!err) return 'An unexpected mock exam error occurred.';
  if (isMissingMockMigrationError(err)) {
    return 'Mock exam tables have not been set up in Supabase yet. Run migrations 012a through 012d in order in Supabase SQL Editor.';
  }
  if (err.code === '42501') {
    return 'You do not have permission for this mock exam action.';
  }
  if (isLikelyNetworkError(err)) {
    return 'Network unavailable. Connect to the internet or open a saved offline mock paper.';
  }
  return err.message || 'Unable to process mock exam request right now.';
}

// ============================================================================
// Student 4-Subject Mock Exam Hub, Session & Grading
// ============================================================================

export interface StudentMockHubData {
  enrollments: StudentEnrolledExam[];
  readinessByExamId: Map<string, MockSubjectReadiness[]>;
  publishedMocks: MockExamRecord[];
  attempts: MockAttemptSummary[];
  migrationMissing: boolean;
  fromCache: boolean;
  error: string | null;
}

export async function fetchStudentMockHub(studentId: string): Promise<StudentMockHubData> {
  const empty: StudentMockHubData = {
    enrollments: [],
    readinessByExamId: new Map(),
    publishedMocks: [],
    attempts: [],
    migrationMissing: false,
    fromCache: false,
    error: null,
  };

  const enrollRes = await fetchStudentEnrollments(studentId);
  if (enrollRes.error) {
    return { ...empty, error: enrollRes.error };
  }

  const enrollments = enrollRes.enrollments;

  const readCachedAttempts = async (): Promise<MockAttemptSummary[]> => {
    const cached = await getOfflineKv<MockAttemptSummary[]>(offlineKeys.mockAttempts(studentId));
    return cached?.value ?? [];
  };

  if (!supabase || !isDeviceOnline()) {
    const cachedAttempts = await readCachedAttempts();
    return {
      ...empty,
      enrollments,
      attempts: cachedAttempts,
      fromCache: true,
    };
  }

  const sb = supabase;

  try {
    const nowIso = new Date().toISOString();
    const fetchHubMocks = async () => {
      const initial = await sb
        .from('mock_exams')
        .select(
          'id, exam_id, title, description, duration_minutes, english_question_count, other_subject_question_count, uses_question_bank, exclude_diagrams, is_published, release_status, scheduled_release_at, show_explanations_after_submission, created_by, created_at, updated_at'
        )
        .or(
          `is_published.eq.true,release_status.eq.published,and(release_status.eq.queued,scheduled_release_at.lte.${nowIso})`
        )
        .order('updated_at', { ascending: false });

      if (initial.error && isMissingReleaseQueueColumnError(initial.error)) {
        return sb
          .from('mock_exams')
          .select(
            'id, exam_id, title, description, duration_minutes, english_question_count, other_subject_question_count, uses_question_bank, exclude_diagrams, is_published, show_explanations_after_submission, created_by, created_at, updated_at'
          )
          .eq('is_published', true)
          .order('updated_at', { ascending: false });
      }
      return initial;
    };

    const [mocksRes, attemptsRes, ...readinessResponses] = await Promise.all([
      fetchHubMocks(),
      sb
        .from('mock_attempts')
        .select(
          'id, exam_id, mock_exam_id, title, mode, duration_minutes, started_at, submitted_at, elapsed_seconds, total_score_400, total_correct, total_questions, percentage, subject_scores'
        )
        .eq('student_id', studentId)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(30),
      ...enrollments.map(async (enr) => {
        const res = await sb.rpc('get_student_mock_readiness', {
          p_exam_id: enr.exam.id,
        });
        return { examId: enr.exam.id, res };
      }),
    ]);

    const firstErr = mocksRes.error || attemptsRes.error || readinessResponses[0]?.res?.error || null;
    if (firstErr && isMissingMockMigrationError(firstErr)) {
      return {
        ...empty,
        enrollments,
        migrationMissing: true,
      };
    }

    if (firstErr && isLikelyNetworkError(firstErr)) {
      const cachedAttempts = await readCachedAttempts();
      return {
        ...empty,
        enrollments,
        attempts: cachedAttempts,
        fromCache: true,
      };
    }

    const examNameById = new Map(enrollments.map((e) => [e.exam.id, e.exam.name]));
    const examSlugById = new Map(enrollments.map((e) => [e.exam.id, e.exam.slug]));

    const readinessByExamId = new Map<string, MockSubjectReadiness[]>();
    for (const item of readinessResponses) {
      if (!item.res.error && Array.isArray(item.res.data)) {
        readinessByExamId.set(item.examId, item.res.data as MockSubjectReadiness[]);
      }
    }

    const attempts: MockAttemptSummary[] = ((attemptsRes.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        id: String(row.id),
        exam_id: String(row.exam_id),
        exam_name: examNameById.get(String(row.exam_id)),
        exam_slug: examSlugById.get(String(row.exam_id)),
        mock_exam_id: row.mock_exam_id ? String(row.mock_exam_id) : null,
        title: String(row.title),
        mode: (row.mode as MockExamMode) || 'full_mock',
        duration_minutes: Number(row.duration_minutes) || 120,
        started_at: String(row.started_at),
        submitted_at: row.submitted_at ? String(row.submitted_at) : null,
        elapsed_seconds: row.elapsed_seconds !== null ? Number(row.elapsed_seconds) : null,
        total_score_400: Number(row.total_score_400) || 0,
        total_correct: Number(row.total_correct) || 0,
        total_questions: Number(row.total_questions) || 0,
        percentage: Number(row.percentage) || 0,
        subject_scores: Array.isArray(row.subject_scores)
          ? (row.subject_scores as MockSubjectBreakdown[])
          : [],
      })
    );

    void cacheMockAttempts(studentId, attempts);

    const publishedMocks = ((mocksRes.data ?? []) as MockExamRecord[]).filter(isItemCurrentlyReleased);

    return {
      enrollments,
      readinessByExamId,
      publishedMocks,
      attempts,
      migrationMissing: false,
      fromCache: false,
      error: null,
    };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cachedAttempts = await readCachedAttempts();
      return {
        ...empty,
        enrollments,
        attempts: cachedAttempts,
        fromCache: true,
      };
    }
    return {
      ...empty,
      enrollments,
      error: 'Unable to load mock exam center right now.',
    };
  }
}

export async function fetchStudentMockAttempts(
  studentId: string,
  limit = 20
): Promise<{ attempts: MockAttemptSummary[]; fromCache?: boolean; error: string | null }> {
  const readCache = async () => {
    const cached = await getOfflineKv<MockAttemptSummary[]>(offlineKeys.mockAttempts(studentId));
    return cached?.value ?? [];
  };

  if (!supabase || !isDeviceOnline()) {
    return { attempts: (await readCache()).slice(0, limit), fromCache: true, error: null };
  }

  try {
    const [attemptsRes, examsRes] = await Promise.all([
      supabase
        .from('mock_attempts')
        .select(
          'id, exam_id, mock_exam_id, title, mode, duration_minutes, started_at, submitted_at, elapsed_seconds, total_score_400, total_correct, total_questions, percentage, subject_scores'
        )
        .eq('student_id', studentId)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(limit),
      supabase.from('exams').select('id, name, slug'),
    ]);

    if (attemptsRes.error) {
      if (isMissingMockMigrationError(attemptsRes.error)) {
        return { attempts: [], error: null };
      }
      if (isLikelyNetworkError(attemptsRes.error)) {
        return { attempts: (await readCache()).slice(0, limit), fromCache: true, error: null };
      }
      return { attempts: [], error: mapMockError(attemptsRes.error) };
    }

    const examMetaMap = new Map(
      ((examsRes.data ?? []) as Array<Pick<Exam, 'id' | 'name' | 'slug'>>).map((e) => [
        e.id,
        { name: e.name, slug: e.slug },
      ])
    );

    const attempts: MockAttemptSummary[] = ((attemptsRes.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => {
        const meta = examMetaMap.get(String(row.exam_id));
        return {
          id: String(row.id),
          exam_id: String(row.exam_id),
          exam_name: meta?.name,
          exam_slug: meta?.slug,
          mock_exam_id: row.mock_exam_id ? String(row.mock_exam_id) : null,
          title: String(row.title),
          mode: (row.mode as MockExamMode) || 'full_mock',
          duration_minutes: Number(row.duration_minutes) || 120,
          started_at: String(row.started_at),
          submitted_at: row.submitted_at ? String(row.submitted_at) : null,
          elapsed_seconds: row.elapsed_seconds !== null ? Number(row.elapsed_seconds) : null,
          total_score_400: Number(row.total_score_400) || 0,
          total_correct: Number(row.total_correct) || 0,
          total_questions: Number(row.total_questions) || 0,
          percentage: Number(row.percentage) || 0,
          subject_scores: Array.isArray(row.subject_scores)
            ? (row.subject_scores as MockSubjectBreakdown[])
            : [],
        };
      }
    );

    void cacheMockAttempts(studentId, attempts);
    return { attempts, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      return { attempts: (await readCache()).slice(0, limit), fromCache: true, error: null };
    }
    return { attempts: [], error: 'Network error while loading mock exam history.' };
  }
}

export async function startMockExamSession(params: {
  examId: string;
  mockExamId?: string | null;
  mode?: MockExamMode;
  studentId?: string;
  pinOffline?: boolean;
}): Promise<{ session: MockSessionPayload | null; error: string | null }> {
  if (!supabase) return { session: null, error: 'Supabase is not configured.' };
  if (!isDeviceOnline()) {
    return {
      session: null,
      error:
        'Connect to the internet to assemble a new mock paper, or open a paper you already saved in Offline Study.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('start_mock_exam_session', {
      p_exam_id: params.examId,
      p_mock_exam_id: params.mockExamId ?? null,
      p_mode: params.mode ?? 'full_mock',
    });

    if (error) {
      return { session: null, error: mapMockError(error) };
    }

    const session = data as MockSessionPayload;
    if (params.studentId && session?.attempt_id) {
      await cacheMockSession(params.studentId, session, Boolean(params.pinOffline));
    }
    return { session, error: null };
  } catch {
    return { session: null, error: 'Failed to generate mock exam session.' };
  }
}

export async function fetchPendingMockSession(
  attemptId: string,
  studentId?: string
): Promise<{
  session: MockSessionPayload | null;
  alreadySubmitted?: boolean;
  fromCache?: boolean;
  error: string | null;
}> {
  const readCache = async (): Promise<MockSessionPayload | null> => {
    if (!studentId) return null;
    const cached = await getOfflineKv<MockSessionPayload>(offlineKeys.mock(studentId, attemptId));
    return cached?.value ?? null;
  };

  if (!supabase || !isDeviceOnline()) {
    const cached = await readCache();
    if (cached) return { session: cached, fromCache: true, error: null };
    return {
      session: null,
      error: 'You are offline and this mock paper was not saved on this device.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_pending_mock_session', {
      p_attempt_id: attemptId,
    });

    if (error) {
      if ((error.message || '').includes('ALREADY_SUBMITTED')) {
        return { session: null, alreadySubmitted: true, error: null };
      }
      if (isLikelyNetworkError(error)) {
        const cached = await readCache();
        if (cached) return { session: cached, fromCache: true, error: null };
      }
      return { session: null, error: mapMockError(error) };
    }

    const session = data as MockSessionPayload;
    if (studentId && session?.attempt_id) {
      void cacheMockSession(studentId, session, false);
    }
    return { session, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cached = await readCache();
      if (cached) return { session: cached, fromCache: true, error: null };
    }
    return { session: null, error: 'Network error while loading mock exam session.' };
  }
}

export async function submitMockExamAttempt(
  attemptId: string,
  answers: Record<string, string>,
  elapsedSeconds: number,
  offlineMeta?: {
    studentId?: string;
    mockTitle?: string;
    totalQuestions?: number;
  }
): Promise<{ submittedId: string | null; queuedOffline?: boolean; error: string | null }> {
  if (!supabase) return { submittedId: null, error: 'Supabase is not configured.' };

  const queueSubmission = async (): Promise<{
    submittedId: string | null;
    queuedOffline?: boolean;
    error: string | null;
  }> => {
    if (!offlineMeta?.studentId) {
      return {
        submittedId: null,
        error: 'You are offline. Reconnect to submit your mock exam.',
      };
    }

    const answeredCount = Object.keys(answers).filter((k) => Boolean(answers[k])).length;
    await enqueueOfflineAction({
      id: `ms:${offlineMeta.studentId}:${attemptId}`,
      userId: offlineMeta.studentId,
      kind: 'mock_submission',
      createdAt: Date.now(),
      payload: {
        attemptId,
        mockTitle: offlineMeta.mockTitle ?? '4-Subject CBT Mock',
        answers,
        elapsedSeconds: Math.max(0, Math.round(elapsedSeconds)),
        answeredCount,
        totalQuestions: offlineMeta.totalQuestions ?? answeredCount,
      },
    });
    return { submittedId: null, queuedOffline: true, error: null };
  };

  if (!isDeviceOnline()) {
    return queueSubmission();
  }

  try {
    const { data, error } = await supabase.rpc('submit_mock_attempt', {
      p_attempt_id: attemptId,
      p_answers: answers,
      p_elapsed_seconds: Math.max(0, Math.round(elapsedSeconds)),
    });

    if (error) {
      if (isLikelyNetworkError(error)) {
        return queueSubmission();
      }
      return { submittedId: null, error: mapMockError(error) };
    }

    if (offlineMeta?.studentId) {
      void deleteOfflineKv(offlineKeys.mock(offlineMeta.studentId, attemptId));
    }

    return { submittedId: data as string, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      return queueSubmission();
    }
    return { submittedId: null, error: 'Failed to submit mock exam. Please try again.' };
  }
}

export async function fetchMockAttemptReview(
  attemptId: string,
  studentId?: string
): Promise<{ review: MockAttemptReviewPayload | null; fromCache?: boolean; error: string | null }> {
  const readCache = async (): Promise<MockAttemptReviewPayload | null> => {
    if (!studentId) return null;
    const cached = await getOfflineKv<MockAttemptReviewPayload>(
      offlineKeys.mockReview(studentId, attemptId)
    );
    return cached?.value ?? null;
  };

  if (!supabase || !isDeviceOnline()) {
    const cached = await readCache();
    if (cached) return { review: cached, fromCache: true, error: null };
    return {
      review: null,
      error: 'You are offline and this mock exam result has not been opened online on this device yet.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_mock_attempt_review', {
      p_attempt_id: attemptId,
    });

    if (error) {
      if (isLikelyNetworkError(error)) {
        const cached = await readCache();
        if (cached) return { review: cached, fromCache: true, error: null };
      }
      return { review: null, error: mapMockError(error) };
    }

    const review = data as MockAttemptReviewPayload;
    if (studentId && review) {
      void putOfflineKv<MockAttemptReviewPayload>({
        key: offlineKeys.mockReview(studentId, attemptId),
        userId: studentId,
        category: 'mockReview',
        value: review,
        updatedAt: Date.now(),
      });
    }

    return { review, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cached = await readCache();
      if (cached) return { review: cached, fromCache: true, error: null };
    }
    return { review: null, error: 'Network error while loading mock exam score breakdown.' };
  }
}

// ============================================================================
// Admin / Tutor Mock Exam Management
// ============================================================================

export async function fetchAdminMockExamsData(): Promise<{
  exams: Exam[];
  subjects: Subject[];
  mockExams: AdminMockExamListItem[];
  bankCountsBySubject: Map<string, number>;
  migrationMissing: boolean;
  releaseQueueMigrationMissing: boolean;
  error: string | null;
}> {
  if (!supabase) {
    return {
      exams: [],
      subjects: [],
      mockExams: [],
      bankCountsBySubject: new Map(),
      migrationMissing: false,
      releaseQueueMigrationMissing: false,
      error: 'Supabase is not configured.',
    };
  }

  let releaseQueueMigrationMissing = false;

  const [examsRes, subjectsRes, initialMocksRes, customQRes, bankRes] = await Promise.all([
    supabase.from('exams').select('*').order('name', { ascending: true }),
    supabase.from('subjects').select('*').order('name', { ascending: true }),
    supabase
      .from('mock_exams')
      .select(
        'id, exam_id, title, description, duration_minutes, english_question_count, other_subject_question_count, uses_question_bank, exclude_diagrams, is_published, release_status, scheduled_release_at, show_explanations_after_submission, created_by, created_at, updated_at'
      )
      .order('updated_at', { ascending: false }),
    supabase.from('mock_exam_custom_questions').select('id, mock_exam_id'),
    supabase
      .from('question_bank')
      .select('subject_id')
      .eq('status', 'approved')
      .eq('needs_diagram', false),
  ]);

  let mocksRes = initialMocksRes;
  if (mocksRes.error && isMissingReleaseQueueColumnError(mocksRes.error)) {
    releaseQueueMigrationMissing = true;
    const fallback = await supabase
      .from('mock_exams')
      .select(
        'id, exam_id, title, description, duration_minutes, english_question_count, other_subject_question_count, uses_question_bank, exclude_diagrams, is_published, show_explanations_after_submission, created_by, created_at, updated_at'
      )
      .order('updated_at', { ascending: false });
    mocksRes = fallback as typeof initialMocksRes;
  }

  const mockErr = mocksRes.error || customQRes.error;
  if (mockErr && isMissingMockMigrationError(mockErr)) {
    return {
      exams: (examsRes.data ?? []) as Exam[],
      subjects: (subjectsRes.data ?? []) as Subject[],
      mockExams: [],
      bankCountsBySubject: new Map(),
      migrationMissing: true,
      releaseQueueMigrationMissing: false,
      error: null,
    };
  }

  const firstErr = examsRes.error || subjectsRes.error || mockErr;
  if (firstErr) {
    return {
      exams: [],
      subjects: [],
      mockExams: [],
      bankCountsBySubject: new Map(),
      migrationMissing: false,
      releaseQueueMigrationMissing,
      error: mapMockError(firstErr),
    };
  }

  const exams = (examsRes.data ?? []) as Exam[];
  const subjects = (subjectsRes.data ?? []) as Subject[];
  const examNameMap = new Map(exams.map((e) => [e.id, e.name]));

  const customCounts = new Map<string, number>();
  for (const row of (customQRes.data ?? []) as Array<{ id: string; mock_exam_id: string }>) {
    customCounts.set(row.mock_exam_id, (customCounts.get(row.mock_exam_id) ?? 0) + 1);
  }

  const bankCountsBySubject = new Map<string, number>();
  if (!bankRes.error && bankRes.data) {
    for (const row of bankRes.data as Array<{ subject_id: string | null }>) {
      if (!row.subject_id) continue;
      bankCountsBySubject.set(row.subject_id, (bankCountsBySubject.get(row.subject_id) ?? 0) + 1);
    }
  }

  const mockExams: AdminMockExamListItem[] = ((mocksRes.data ?? []) as MockExamRecord[]).map(
    (m) => ({
      ...m,
      release_status: deriveReleaseStatus(m),
      scheduled_release_at: m.scheduled_release_at ?? null,
      examName: examNameMap.get(m.exam_id) ?? 'Examination',
      customQuestionCount: customCounts.get(m.id) ?? 0,
    })
  );

  return {
    exams,
    subjects,
    mockExams,
    bankCountsBySubject,
    migrationMissing: false,
    releaseQueueMigrationMissing,
    error: null,
  };
}

export async function fetchMockCustomQuestionsForAdmin(mockExamId: string): Promise<{
  questions: AdminMockCustomQuestionInput[];
  error: string | null;
}> {
  if (!supabase) return { questions: [], error: 'Supabase is not configured.' };

  const qRes = await supabase
    .from('mock_exam_custom_questions')
    .select('*')
    .eq('mock_exam_id', mockExamId)
    .order('display_order', { ascending: true });

  if (qRes.error) {
    return { questions: [], error: mapMockError(qRes.error) };
  }

  const rows = qRes.data ?? [];
  if (rows.length === 0) return { questions: [], error: null };

  const ids = rows.map((r) => r.id);
  const optRes = await supabase
    .from('mock_exam_custom_options')
    .select('*')
    .in('custom_question_id', ids)
    .order('display_order', { ascending: true });

  if (optRes.error) {
    return { questions: [], error: mapMockError(optRes.error) };
  }

  const optsByQ = new Map<string, typeof optRes.data>();
  for (const o of optRes.data ?? []) {
    const arr = optsByQ.get(o.custom_question_id) ?? [];
    arr.push(o);
    optsByQ.set(o.custom_question_id, arr);
  }

  const questions: AdminMockCustomQuestionInput[] = rows.map((q) => ({
    subject_id: q.subject_id,
    question_text: q.question_text,
    explanation: q.explanation ?? '',
    difficulty: q.difficulty,
    points: q.points,
    options: (optsByQ.get(q.id) ?? []).map((o) => ({
      localKey: o.id,
      option_key: o.option_key,
      option_text: o.option_text,
      is_correct: o.is_correct,
    })),
  }));

  return { questions, error: null };
}

export async function saveAdminMockExam(input: {
  id?: string;
  exam_id: string;
  title: string;
  description: string;
  duration_minutes: number;
  english_question_count: number;
  other_subject_question_count: number;
  uses_question_bank: boolean;
  exclude_diagrams: boolean;
  is_published: boolean;
  release_status?: ReleaseStatus;
  scheduled_release_at?: string | null;
  show_explanations_after_submission: boolean;
  created_by: string;
  customQuestions: AdminMockCustomQuestionInput[];
}): Promise<{ mockExamId: string | null; warning?: string | null; error: string | null }> {
  if (!supabase) return { mockExamId: null, error: 'Supabase is not configured.' };
  if (input.title.trim().length < 2) {
    return { mockExamId: null, error: 'Mock exam title must be at least 2 characters.' };
  }

  for (let i = 0; i < input.customQuestions.length; i++) {
    const q = input.customQuestions[i];
    if (!q.question_text.trim()) {
      return { mockExamId: null, error: `Custom question #${i + 1} needs question text.` };
    }
    if (q.options.filter((o) => o.option_text.trim()).length < 2) {
      return {
        mockExamId: null,
        error: `Custom question #${i + 1} needs at least 2 answer options.`,
      };
    }
    if (q.options.filter((o) => o.is_correct).length !== 1) {
      return {
        mockExamId: null,
        error: `Custom question #${i + 1} must have exactly one correct option.`,
      };
    }
  }

  const releaseStatus: ReleaseStatus =
    input.release_status ?? (input.is_published ? 'published' : 'draft');
  const isPublished = releaseStatus === 'published';
  const scheduledReleaseAt =
    releaseStatus === 'queued' ? (input.scheduled_release_at ?? null) : null;

  const basePayload = {
    exam_id: input.exam_id,
    title: input.title.trim(),
    description: input.description.trim() || null,
    duration_minutes: Math.max(5, Math.min(360, Math.round(input.duration_minutes) || 120)),
    english_question_count: Math.max(1, Math.min(100, Math.round(input.english_question_count) || 60)),
    other_subject_question_count: Math.max(
      1,
      Math.min(100, Math.round(input.other_subject_question_count) || 40)
    ),
    uses_question_bank: input.uses_question_bank,
    exclude_diagrams: input.exclude_diagrams,
    is_published: isPublished,
    show_explanations_after_submission: input.show_explanations_after_submission,
  };

  const fullPayload = {
    ...basePayload,
    release_status: releaseStatus,
    scheduled_release_at: scheduledReleaseAt,
  };

  let mockExamId = input.id ?? null;
  let warning: string | null = null;

  if (mockExamId) {
    let updateRes = await supabase.from('mock_exams').update(fullPayload).eq('id', mockExamId);
    if (updateRes.error && isMissingReleaseQueueColumnError(updateRes.error)) {
      if (releaseStatus === 'queued') {
        warning =
          'Mock exam template and questions were saved as Draft. Run migrations 014a–014c in Supabase to enable queuing and scheduled release.';
      }
      updateRes = await supabase.from('mock_exams').update(basePayload).eq('id', mockExamId);
    }
    if (updateRes.error) return { mockExamId: null, error: mapMockError(updateRes.error) };

    const delRes = await supabase
      .from('mock_exam_custom_questions')
      .delete()
      .eq('mock_exam_id', mockExamId);
    if (delRes.error) return { mockExamId, error: mapMockError(delRes.error) };
  } else {
    const insertFullRes = await supabase
      .from('mock_exams')
      .insert({ ...fullPayload, created_by: input.created_by })
      .select('id')
      .single();

    if (insertFullRes.error && isMissingReleaseQueueColumnError(insertFullRes.error)) {
      if (releaseStatus === 'queued') {
        warning =
          'Mock exam template and questions were saved as Draft. Run migrations 014a–014c in Supabase to enable queuing and scheduled release.';
      }
      const fallbackRes = await supabase
        .from('mock_exams')
        .insert({ ...basePayload, created_by: input.created_by })
        .select('id')
        .single();
      if (fallbackRes.error || !fallbackRes.data) {
        return { mockExamId: null, error: mapMockError(fallbackRes.error) };
      }
      mockExamId = fallbackRes.data.id;
    } else if (insertFullRes.error || !insertFullRes.data) {
      return { mockExamId: null, error: mapMockError(insertFullRes.error) };
    } else {
      mockExamId = insertFullRes.data.id;
    }
  }

  for (let qi = 0; qi < input.customQuestions.length; qi++) {
    const q = input.customQuestions[qi];
    const qRes = await supabase
      .from('mock_exam_custom_questions')
      .insert({
        mock_exam_id: mockExamId,
        subject_id: q.subject_id,
        question_text: q.question_text.trim(),
        explanation: q.explanation.trim() || null,
        difficulty: q.difficulty,
        points: Math.max(1, q.points || 1),
        display_order: qi + 1,
      })
      .select('id')
      .single();

    if (qRes.error || !qRes.data) {
      return { mockExamId, error: mapMockError(qRes.error) };
    }

    const optRows = q.options
      .filter((o) => o.option_text.trim())
      .map((o, oi) => ({
        custom_question_id: qRes.data.id,
        option_key: o.option_key || String.fromCharCode(65 + oi),
        option_text: o.option_text.trim(),
        is_correct: o.is_correct,
        display_order: oi + 1,
      }));

    const optRes = await supabase.from('mock_exam_custom_options').insert(optRows);
    if (optRes.error) {
      return { mockExamId, error: mapMockError(optRes.error) };
    }
  }

  return { mockExamId, warning, error: null };
}

export async function updateMockReleaseStatus(
  mockExamId: string,
  releaseStatus: ReleaseStatus,
  scheduledReleaseAt?: string | null
): Promise<{ releaseQueueMigrationMissing?: boolean; error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const isPublished = releaseStatus === 'published';
  const payload = {
    release_status: releaseStatus,
    scheduled_release_at: releaseStatus === 'queued' ? (scheduledReleaseAt ?? null) : null,
    is_published: isPublished,
  };

  const { error } = await supabase
    .from('mock_exams')
    .update(payload)
    .eq('id', mockExamId);

  if (error && isMissingReleaseQueueColumnError(error)) {
    if (releaseStatus === 'queued') {
      return {
        releaseQueueMigrationMissing: true,
        error:
          'Release Queue requires database migrations 014a–014c in Supabase SQL Editor.',
      };
    }
    const fallback = await supabase
      .from('mock_exams')
      .update({ is_published: isPublished })
      .eq('id', mockExamId);
    return {
      releaseQueueMigrationMissing: true,
      error: fallback.error ? mapMockError(fallback.error) : null,
    };
  }

  return { error: error ? mapMockError(error) : null };
}

export async function saveTutorMockSubjectQuestions(input: {
  mockExamId: string;
  allowedSubjectIds: string[] | null;
  customQuestions: AdminMockCustomQuestionInput[];
}): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  if (input.allowedSubjectIds !== null && input.allowedSubjectIds.length === 0) {
    return { error: 'No subjects are assigned to your Tutor account yet.' };
  }

  const allowedSet =
    input.allowedSubjectIds !== null ? new Set(input.allowedSubjectIds) : null;

  for (let i = 0; i < input.customQuestions.length; i++) {
    const q = input.customQuestions[i];
    if (allowedSet && !allowedSet.has(q.subject_id)) {
      return {
        error: `Question #${i + 1} targets a subject not assigned to your Tutor account.`,
      };
    }
    if (!q.question_text.trim()) {
      return { error: `Your question #${i + 1} needs question text.` };
    }
    if (q.options.filter((o) => o.option_text.trim()).length < 2) {
      return { error: `Your question #${i + 1} needs at least 2 answer options.` };
    }
    if (q.options.filter((o) => o.is_correct).length !== 1) {
      return { error: `Your question #${i + 1} must have exactly one correct option.` };
    }
  }

  const delQuery = supabase
    .from('mock_exam_custom_questions')
    .delete()
    .eq('mock_exam_id', input.mockExamId);

  const delRes =
    input.allowedSubjectIds !== null
      ? await delQuery.in('subject_id', input.allowedSubjectIds)
      : await delQuery;

  if (delRes.error) {
    return { error: mapMockError(delRes.error) };
  }

  for (let qi = 0; qi < input.customQuestions.length; qi++) {
    const q = input.customQuestions[qi];
    const qRes = await supabase
      .from('mock_exam_custom_questions')
      .insert({
        mock_exam_id: input.mockExamId,
        subject_id: q.subject_id,
        question_text: q.question_text.trim(),
        explanation: q.explanation.trim() || null,
        difficulty: q.difficulty,
        points: Math.max(1, q.points || 1),
        display_order: qi + 1,
      })
      .select('id')
      .single();

    if (qRes.error || !qRes.data) {
      return { error: mapMockError(qRes.error) };
    }

    const optRows = q.options
      .filter((o) => o.option_text.trim())
      .map((o, oi) => ({
        custom_question_id: qRes.data.id,
        option_key: o.option_key || String.fromCharCode(65 + oi),
        option_text: o.option_text.trim(),
        is_correct: o.is_correct,
        display_order: oi + 1,
      }));

    const optRes = await supabase.from('mock_exam_custom_options').insert(optRows);
    if (optRes.error) {
      return { error: mapMockError(optRes.error) };
    }
  }

  return { error: null };
}

export async function deleteAdminMockExam(mockExamId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('mock_exams').delete().eq('id', mockExamId);
  return { error: error ? mapMockError(error) : null };
}
