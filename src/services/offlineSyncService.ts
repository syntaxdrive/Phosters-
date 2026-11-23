import { saveMaterialForOffline, validateMaterialUrl } from '../lib/materialLinks';
import {
  cacheStudentTest,
  deleteOfflineKv,
  deleteOfflineMaterial,
  getOfflineKv,
  isDeviceOnline,
  isLikelyNetworkError,
  listOfflineKvByUser,
  listOfflineMaterialsByUser,
  listOfflineSyncQueue,
  offlineKeys,
  putOfflineKv,
  removeOfflineSyncAction,
  type CachedLessonBundle,
  type CachedSubjectBundle,
  type OfflineMaterialRecord,
  type OfflineSyncAction,
} from '../lib/offlineDb';
import { supabase } from '../lib/supabase';
import type { MockSessionPayload, StudentTestPayload } from '../types/cbt';
import {
  fetchPublishedTestsForLesson,
  fetchPublishedTopicTests,
  fetchTestForTaking,
} from './cbtService';
import { fetchLessonDetail, fetchSubjectTopicsAndLessons } from './learningService';

export interface SavedOfflineSubjectItem {
  key: string;
  examName: string;
  examSlug: string;
  subjectName: string;
  subjectSlug: string;
  topicCount: number;
  lessonCount: number;
  updatedAt: number;
}

export interface SavedOfflineLessonItem {
  key: string;
  lessonId: string;
  title: string;
  subjectName: string;
  examName: string;
  topicTitle: string;
  materialsCount: number;
  attachedTestsCount: number;
  updatedAt: number;
}

export interface SavedOfflineTestItem {
  key: string;
  testId: string;
  title: string;
  questionCount: number;
  updatedAt: number;
  pinned: boolean;
}

export interface SavedOfflineMockItem {
  key: string;
  attemptId: string;
  title: string;
  examName: string;
  subjectCount: number;
  questionCount: number;
  durationMinutes: number;
  updatedAt: number;
  pinned: boolean;
}

export interface OfflineVaultSummary {
  savedSubjects: SavedOfflineSubjectItem[];
  savedLessons: SavedOfflineLessonItem[];
  savedTests: SavedOfflineTestItem[];
  savedMocks: SavedOfflineMockItem[];
  savedMaterials: OfflineMaterialRecord[];
  pendingActions: OfflineSyncAction[];
  downloadedLessonIds: Set<string>;
  downloadedSubjectKeys: Set<string>;
  totalBytes: number;
}

export interface SyncRunResult {
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  error: string | null;
}

const activeSyncPromises = new Map<string, Promise<SyncRunResult>>();

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

export async function syncOfflineActionsForUser(userId: string): Promise<SyncRunResult> {
  const existing = activeSyncPromises.get(userId);
  if (existing) return existing;

  const run = (async (): Promise<SyncRunResult> => {
    if (!supabase) {
      return {
        syncedCount: 0,
        failedCount: 0,
        remainingCount: 0,
        error: 'Supabase is not configured.',
      };
    }

    const queue = await listOfflineSyncQueue(userId);
    if (queue.length === 0) {
      return { syncedCount: 0, failedCount: 0, remainingCount: 0, error: null };
    }

    if (!isDeviceOnline()) {
      return {
        syncedCount: 0,
        failedCount: 0,
        remainingCount: queue.length,
        error: 'Device is offline. Connect to sync pending actions.',
      };
    }

    let syncedCount = 0;
    let failedCount = 0;
    let lastError: string | null = null;

    for (const action of queue) {
      try {
        if (action.kind === 'lesson_completion') {
          const nowIso = new Date().toISOString();
          const { error } = await supabase.from('student_lesson_progress').upsert(
            {
              student_id: userId,
              lesson_id: action.payload.lessonId,
              is_completed: action.payload.isCompleted,
              completed_at: action.payload.isCompleted ? nowIso : null,
              last_opened_at: nowIso,
            },
            { onConflict: 'student_id,lesson_id' }
          );

          if (error) {
            if (isLikelyNetworkError(error)) {
              lastError = 'Connection dropped while syncing. Remaining items will retry automatically.';
              break;
            }
            failedCount += 1;
            lastError = error.message || 'Could not sync a lesson completion update.';
            continue;
          }

          await removeOfflineSyncAction(action.id);
          syncedCount += 1;
        } else if (action.kind === 'test_submission') {
          const { error } = await supabase.rpc('submit_test_attempt', {
            p_test_id: action.payload.testId,
            p_answers: action.payload.answers,
          });

          if (error) {
            if (isLikelyNetworkError(error)) {
              lastError = 'Connection dropped while submitting offline test answers.';
              break;
            }
            failedCount += 1;
            lastError = error.message || `Could not submit "${action.payload.testTitle}".`;
            continue;
          }

          await removeOfflineSyncAction(action.id);
          syncedCount += 1;
        } else if (action.kind === 'mock_submission') {
          const { error } = await supabase.rpc('submit_mock_attempt', {
            p_attempt_id: action.payload.attemptId,
            p_answers: action.payload.answers,
            p_elapsed_seconds: action.payload.elapsedSeconds,
          });

          if (error) {
            if (isLikelyNetworkError(error)) {
              lastError = 'Connection dropped while submitting offline mock exam answers.';
              break;
            }
            failedCount += 1;
            lastError = error.message || `Could not submit "${action.payload.mockTitle}".`;
            continue;
          }

          await deleteOfflineKv(offlineKeys.mock(userId, action.payload.attemptId));
          await removeOfflineSyncAction(action.id);
          syncedCount += 1;
        }
      } catch (err) {
        if (isLikelyNetworkError(err)) {
          lastError = 'Connection lost during sync. Pending actions are safely stored on device.';
          break;
        }
        failedCount += 1;
        lastError = 'Unexpected error while syncing offline changes.';
      }
    }

    const remaining = await listOfflineSyncQueue(userId);
    return {
      syncedCount,
      failedCount,
      remainingCount: remaining.length,
      error: lastError,
    };
  })();

  activeSyncPromises.set(userId, run);
  try {
    return await run;
  } finally {
    activeSyncPromises.delete(userId);
  }
}

export async function discardOfflineSyncAction(actionId: string): Promise<void> {
  await removeOfflineSyncAction(actionId);
}

export async function downloadLessonPackForOffline(
  userId: string,
  lessonId: string,
  options?: { allowDrafts?: boolean; includeMaterials?: boolean }
): Promise<{
  materialsSaved: number;
  testsSaved: number;
  warnings: string[];
  error: string | null;
}> {
  if (!isDeviceOnline()) {
    return {
      materialsSaved: 0,
      testsSaved: 0,
      warnings: [],
      error: 'Connect to the internet to save this lesson for offline study.',
    };
  }

  const detailRes = await fetchLessonDetail(userId, lessonId, {
    allowDrafts: options?.allowDrafts,
  });

  if (detailRes.error || !detailRes.data) {
    return {
      materialsSaved: 0,
      testsSaved: 0,
      warnings: [],
      error: detailRes.error || 'Could not download lesson details.',
    };
  }

  const detail = detailRes.data;
  const testsRes = await fetchPublishedTestsForLesson(detail.lesson.id, detail.topic.id, userId);

  await putOfflineKv<CachedLessonBundle>({
    key: offlineKeys.lesson(userId, lessonId),
    userId,
    category: 'lesson',
    value: {
      detail,
      attachedTests: testsRes.tests,
    },
    updatedAt: Date.now(),
    pinned: true,
  });

  const warnings: string[] = [];
  let testsSaved = 0;
  for (const tst of testsRes.tests) {
    const testRes = await fetchTestForTaking(tst.id, userId);
    if (testRes.payload) {
      await cacheStudentTest(userId, testRes.payload, true);
      testsSaved += 1;
    } else if (testRes.error) {
      warnings.push(`${tst.title}: ${testRes.error}`);
    }
  }

  let materialsSaved = 0;
  if (options?.includeMaterials !== false) {
    for (const mat of detail.materials) {
      if (!validateMaterialUrl(mat.file_url).valid) {
        continue;
      }
      const saveRes = await saveMaterialForOffline(userId, mat.file_url, mat.title, mat.file_type);
      if (saveRes.error) {
        warnings.push(saveRes.error);
      } else {
        materialsSaved += 1;
      }
    }
  }

  return {
    materialsSaved,
    testsSaved,
    warnings,
    error: null,
  };
}

export async function downloadSubjectPackForOffline(
  userId: string,
  examSlug: string,
  subjectSlug: string,
  onProgress?: (done: number, total: number, currentTitle: string) => void
): Promise<{
  lessonsSaved: number;
  testsSaved: number;
  materialsSaved: number;
  warnings: string[];
  error: string | null;
}> {
  if (!isDeviceOnline()) {
    return {
      lessonsSaved: 0,
      testsSaved: 0,
      materialsSaved: 0,
      warnings: [],
      error: 'Connect to the internet to download this subject for offline study.',
    };
  }

  const subjRes = await fetchSubjectTopicsAndLessons(userId, examSlug, subjectSlug);
  if (subjRes.error || !subjRes.exam || !subjRes.subject) {
    return {
      lessonsSaved: 0,
      testsSaved: 0,
      materialsSaved: 0,
      warnings: [],
      error: subjRes.error || 'Could not load subject syllabus for download.',
    };
  }

  if (!subjRes.hasAccess) {
    return {
      lessonsSaved: 0,
      testsSaved: 0,
      materialsSaved: 0,
      warnings: [],
      error: 'Add this subject to your examination profile before downloading.',
    };
  }

  const topicIds = subjRes.topics.map((t) => t.id);
  const testsRes = await fetchPublishedTopicTests(topicIds, userId, { examSlug, subjectSlug });

  await putOfflineKv<CachedSubjectBundle>({
    key: offlineKeys.subject(userId, examSlug, subjectSlug),
    userId,
    category: 'subject',
    value: {
      exam: subjRes.exam,
      subject: subjRes.subject,
      topics: subjRes.topics,
      testsByTopicEntries: Array.from(testsRes.testsByTopic.entries()),
      hasAccess: true,
    },
    updatedAt: Date.now(),
    pinned: true,
  });

  const topicTests = Array.from(testsRes.testsByTopic.values()).flat();
  const lessons = subjRes.topics.flatMap((t) => t.lessons);
  const totalItems = topicTests.length + lessons.length;

  let done = 0;
  let testsSaved = 0;
  let lessonsSaved = 0;
  let materialsSaved = 0;
  const warnings: string[] = [];

  for (const tst of topicTests) {
    done += 1;
    onProgress?.(done, totalItems, tst.title);
    const tRes = await fetchTestForTaking(tst.id, userId);
    if (tRes.payload) {
      await cacheStudentTest(userId, tRes.payload, true);
      testsSaved += 1;
    } else if (tRes.error) {
      warnings.push(`${tst.title}: ${tRes.error}`);
    }
  }

  for (const lesson of lessons) {
    done += 1;
    onProgress?.(done, totalItems, lesson.title);
    const lRes = await downloadLessonPackForOffline(userId, lesson.id, {
      includeMaterials: true,
    });
    if (lRes.error) {
      warnings.push(`${lesson.title}: ${lRes.error}`);
    } else {
      lessonsSaved += 1;
      testsSaved += lRes.testsSaved;
      materialsSaved += lRes.materialsSaved;
      warnings.push(...lRes.warnings);
    }
  }

  return {
    lessonsSaved,
    testsSaved,
    materialsSaved,
    warnings,
    error: null,
  };
}

export async function removeOfflineLesson(userId: string, lessonId: string): Promise<void> {
  const key = offlineKeys.lesson(userId, lessonId);
  const existing = await getOfflineKv<CachedLessonBundle>(key);
  if (existing) {
    await deleteOfflineKv(key);
  }
}

export async function removeOfflineSubject(
  userId: string,
  examSlug: string,
  subjectSlug: string
): Promise<void> {
  await deleteOfflineKv(offlineKeys.subject(userId, examSlug, subjectSlug));
}

export async function removeOfflineTest(userId: string, testId: string): Promise<void> {
  await deleteOfflineKv(offlineKeys.test(userId, testId));
}

export async function removeOfflineMock(userId: string, attemptId: string): Promise<void> {
  await deleteOfflineKv(offlineKeys.mock(userId, attemptId));
}

export async function removeOfflineMaterial(userId: string, url: string): Promise<void> {
  await deleteOfflineMaterial(userId, url);
}

export async function getOfflineVaultSummary(userId: string): Promise<OfflineVaultSummary> {
  const [kvRecords, materials, pendingActions] = await Promise.all([
    listOfflineKvByUser(userId),
    listOfflineMaterialsByUser(userId),
    listOfflineSyncQueue(userId),
  ]);

  const savedSubjects: SavedOfflineSubjectItem[] = [];
  const savedLessons: SavedOfflineLessonItem[] = [];
  const savedTests: SavedOfflineTestItem[] = [];
  const savedMocks: SavedOfflineMockItem[] = [];
  const downloadedLessonIds = new Set<string>();
  const downloadedSubjectKeys = new Set<string>();

  let kvApproxBytes = 0;

  for (const rec of kvRecords) {
    try {
      kvApproxBytes += JSON.stringify(rec.value ?? null).length;
    } catch {
      // Ignore unserializable edge cases
    }

    if (rec.category === 'subject' && rec.pinned) {
      const bundle = rec.value as CachedSubjectBundle;
      if (bundle?.exam && bundle?.subject) {
        const lessonCount = (bundle.topics ?? []).reduce(
          (acc, t) => acc + (t.lessons?.length ?? 0),
          0
        );
        savedSubjects.push({
          key: rec.key,
          examName: bundle.exam.name,
          examSlug: bundle.exam.slug,
          subjectName: bundle.subject.name,
          subjectSlug: bundle.subject.slug,
          topicCount: bundle.topics?.length ?? 0,
          lessonCount,
          updatedAt: rec.updatedAt,
        });
        downloadedSubjectKeys.add(`${bundle.exam.slug}:${bundle.subject.slug}`);
      }
    } else if (rec.category === 'lesson' && rec.pinned) {
      const bundle = rec.value as CachedLessonBundle;
      if (bundle?.detail?.lesson) {
        savedLessons.push({
          key: rec.key,
          lessonId: bundle.detail.lesson.id,
          title: bundle.detail.lesson.title,
          subjectName: bundle.detail.subject.name,
          examName: bundle.detail.exam.name,
          topicTitle: bundle.detail.topic.title,
          materialsCount: bundle.detail.materials?.length ?? 0,
          attachedTestsCount: bundle.attachedTests?.length ?? 0,
          updatedAt: rec.updatedAt,
        });
        downloadedLessonIds.add(bundle.detail.lesson.id);
      }
    } else if (rec.category === 'test') {
      const payload = rec.value as StudentTestPayload;
      if (payload?.test) {
        savedTests.push({
          key: rec.key,
          testId: payload.test.id,
          title: payload.test.title,
          questionCount: payload.questions?.length ?? 0,
          updatedAt: rec.updatedAt,
          pinned: Boolean(rec.pinned),
        });
      }
    } else if (rec.category === 'mock') {
      const payload = rec.value as MockSessionPayload;
      if (payload?.attempt_id) {
        savedMocks.push({
          key: rec.key,
          attemptId: payload.attempt_id,
          title: payload.title,
          examName: payload.exam_name,
          subjectCount: payload.sections?.length ?? 0,
          questionCount: payload.total_questions ?? 0,
          durationMinutes: payload.duration_minutes ?? 120,
          updatedAt: rec.updatedAt,
          pinned: Boolean(rec.pinned),
        });
      }
    }
  }

  savedSubjects.sort((a, b) => b.updatedAt - a.updatedAt);
  savedLessons.sort((a, b) => b.updatedAt - a.updatedAt);
  savedTests.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  savedMocks.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

  const sortedMaterials = [...materials].sort((a, b) => b.savedAt - a.savedAt);
  const materialsBytes = sortedMaterials.reduce((sum, m) => sum + (m.sizeBytes || 0), 0);

  return {
    savedSubjects,
    savedLessons,
    savedTests,
    savedMocks,
    savedMaterials: sortedMaterials,
    pendingActions,
    downloadedLessonIds,
    downloadedSubjectKeys,
    totalBytes: materialsBytes + kvApproxBytes,
  };
}
