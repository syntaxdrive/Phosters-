import type { AnnouncementFeedItem } from '../types/announcement';
import type {
  AttemptReviewPayload,
  MockAttemptSummary,
  MockSessionPayload,
  StudentAttemptSummary,
  StudentTestPayload,
} from '../types/cbt';
import type { MaterialFileType, Profile, Test } from '../types/database';
import type {
  LessonDetailData,
  RecentLessonItem,
  StudentEnrolledExam,
  TopicWithLessons,
} from '../types/learning';

const DB_NAME = 'phosters-offline-vault';
const DB_VERSION = 1;

export const OFFLINE_CHANGE_EVENT = 'phosters:offline-vault-changed';

export type OfflineKvCategory =
  | 'profile'
  | 'enrollments'
  | 'lessonCounts'
  | 'recentLesson'
  | 'attempts'
  | 'announcements'
  | 'subject'
  | 'lesson'
  | 'test'
  | 'review'
  | 'mock'
  | 'mockAttempts'
  | 'mockReview';

export interface OfflineKvRecord<T = unknown> {
  key: string;
  userId: string;
  category: OfflineKvCategory;
  value: T;
  updatedAt: number;
  pinned?: boolean;
}

export interface OfflineMaterialRecord {
  key: string; // `${userId}::${url}`
  userId: string;
  url: string;
  title: string;
  fileType: MaterialFileType;
  blob: Blob;
  sizeBytes: number;
  savedAt: number;
}

export type OfflineSyncAction =
  | {
      id: string;
      userId: string;
      kind: 'lesson_completion';
      createdAt: number;
      payload: {
        lessonId: string;
        lessonTitle?: string;
        isCompleted: boolean;
      };
    }
  | {
      id: string;
      userId: string;
      kind: 'test_submission';
      createdAt: number;
      payload: {
        testId: string;
        testTitle: string;
        answers: Record<string, string>;
        answeredCount: number;
        totalQuestions: number;
      };
    }
  | {
      id: string;
      userId: string;
      kind: 'mock_submission';
      createdAt: number;
      payload: {
        attemptId: string;
        mockTitle: string;
        answers: Record<string, string>;
        elapsedSeconds: number;
        answeredCount: number;
        totalQuestions: number;
      };
    };

export interface CachedSubjectBundle {
  exam: NonNullable<StudentEnrolledExam['exam']>;
  subject: StudentEnrolledExam['selectedSubjects'][number];
  topics: TopicWithLessons[];
  testsByTopicEntries: Array<[string, Test[]]>;
  hasAccess: boolean;
}

export interface CachedLessonBundle {
  detail: LessonDetailData;
  attachedTests: Test[];
}

export interface CachedReviewBundle {
  review: AttemptReviewPayload;
  courseContext: { examName: string | null; subjectName: string | null };
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function notifyVaultChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_CHANGE_EVENT));
  }
}

export function isDeviceOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function isLikelyNetworkError(err: { message?: string; code?: string } | unknown): boolean {
  if (!isDeviceOnline()) return true;
  const msg =
    typeof err === 'string'
      ? err.toLowerCase()
      : err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
        ? ((err as { message: string }).message || '').toLowerCase()
        : '';

  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('fetcherror')
  );
}

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('kv')) {
          const kvStore = db.createObjectStore('kv', { keyPath: 'key' });
          kvStore.createIndex('userId', 'userId', { unique: false });
          kvStore.createIndex('category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains('materials')) {
          const matStore = db.createObjectStore('materials', { keyPath: 'key' });
          matStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('userId', 'userId', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

export async function putOfflineKv<T>(record: OfflineKvRecord<T>): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(record);
      tx.oncomplete = () => {
        if (record.pinned) notifyVaultChanged();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getOfflineKv<T>(key: string): Promise<OfflineKvRecord<T> | null> {
  const db = await openVaultDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => resolve((req.result as OfflineKvRecord<T> | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteOfflineKv(key: string): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(key);
      tx.oncomplete = () => {
        notifyVaultChanged();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function listOfflineKvByUser(userId: string): Promise<OfflineKvRecord[]> {
  const db = await openVaultDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('kv', 'readonly');
      const idx = tx.objectStore('kv').index('userId');
      const req = idx.getAll(IDBKeyRange.only(userId));
      req.onsuccess = () => resolve((req.result as OfflineKvRecord[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export function buildMaterialKey(userId: string, url: string): string {
  return `${userId}::${url}`;
}

export async function putOfflineMaterial(record: OfflineMaterialRecord): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('materials', 'readwrite');
      tx.objectStore('materials').put(record);
      tx.oncomplete = () => {
        notifyVaultChanged();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getOfflineMaterial(
  userId: string,
  url: string
): Promise<OfflineMaterialRecord | null> {
  const db = await openVaultDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('materials', 'readonly');
      const req = tx.objectStore('materials').get(buildMaterialKey(userId, url));
      req.onsuccess = () => resolve((req.result as OfflineMaterialRecord | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function listOfflineMaterialsByUser(userId: string): Promise<OfflineMaterialRecord[]> {
  const db = await openVaultDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('materials', 'readonly');
      const idx = tx.objectStore('materials').index('userId');
      const req = idx.getAll(IDBKeyRange.only(userId));
      req.onsuccess = () => resolve((req.result as OfflineMaterialRecord[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteOfflineMaterial(userId: string, url: string): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('materials', 'readwrite');
      tx.objectStore('materials').delete(buildMaterialKey(userId, url));
      tx.oncomplete = () => {
        notifyVaultChanged();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function enqueueOfflineAction(action: OfflineSyncAction): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');

      // Deduplicate pending lesson_completion toggles for the same user & lesson
      if (action.kind === 'lesson_completion') {
        const idx = store.index('userId');
        const req = idx.getAll(IDBKeyRange.only(action.userId));
        req.onsuccess = () => {
          const existing = (req.result as OfflineSyncAction[]) ?? [];
          for (const item of existing) {
            if (
              item.kind === 'lesson_completion' &&
              item.payload.lessonId === action.payload.lessonId
            ) {
              store.delete(item.id);
            }
          }
          store.put(action);
        };
        req.onerror = () => {
          store.put(action);
        };
      } else {
        store.put(action);
      }

      tx.oncomplete = () => {
        notifyVaultChanged();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function listOfflineSyncQueue(userId: string): Promise<OfflineSyncAction[]> {
  const db = await openVaultDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('syncQueue', 'readonly');
      const idx = tx.objectStore('syncQueue').index('userId');
      const req = idx.getAll(IDBKeyRange.only(userId));
      req.onsuccess = () => {
        const items = ((req.result as OfflineSyncAction[]) ?? []).sort(
          (a, b) => a.createdAt - b.createdAt
        );
        resolve(items);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function removeOfflineSyncAction(id: string): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('syncQueue', 'readwrite');
      tx.objectStore('syncQueue').delete(id);
      tx.oncomplete = () => {
        notifyVaultChanged();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAllOfflineDataForUser(userId: string): Promise<void> {
  const db = await openVaultDb();
  if (!db) return;

  const deleteByUserInStore = (storeName: 'kv' | 'materials' | 'syncQueue') =>
    new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const idx = store.index('userId');
        const req = idx.getAllKeys(IDBKeyRange.only(userId));
        req.onsuccess = () => {
          for (const key of req.result ?? []) {
            store.delete(key);
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });

  await Promise.all([
    deleteByUserInStore('kv'),
    deleteByUserInStore('materials'),
    deleteByUserInStore('syncQueue'),
  ]);
  notifyVaultChanged();
}

// ============================================================================
// Typed Cache Key Helpers
// ============================================================================

export const offlineKeys = {
  profile: (userId: string) => `profile:${userId}`,
  enrollments: (userId: string) => `enrollments:${userId}`,
  lessonCounts: (userId: string) => `lessonCounts:${userId}`,
  recentLesson: (userId: string) => `recentLesson:${userId}`,
  attempts: (userId: string) => `attempts:${userId}`,
  announcements: (userId: string, examId?: string, subjectId?: string) =>
    `announcements:${userId}:${examId || 'all'}:${subjectId || 'all'}`,
  subject: (userId: string, examSlug: string, subjectSlug: string) =>
    `subject:${userId}:${examSlug}:${subjectSlug}`,
  lesson: (userId: string, lessonId: string) => `lesson:${userId}:${lessonId}`,
  test: (userId: string, testId: string) => `test:${userId}:${testId}`,
  review: (userId: string, attemptId: string) => `review:${userId}:${attemptId}`,
  mock: (userId: string, attemptId: string) => `mock:${userId}:${attemptId}`,
  mockAttempts: (userId: string) => `mockAttempts:${userId}`,
  mockReview: (userId: string, attemptId: string) => `mockReview:${userId}:${attemptId}`,
};

export async function cacheProfile(userId: string, profile: Profile): Promise<void> {
  await putOfflineKv({
    key: offlineKeys.profile(userId),
    userId,
    category: 'profile',
    value: profile,
    updatedAt: Date.now(),
  });
}

export async function cacheAnnouncements(
  userId: string,
  announcements: AnnouncementFeedItem[],
  examId?: string,
  subjectId?: string
): Promise<void> {
  await putOfflineKv({
    key: offlineKeys.announcements(userId, examId, subjectId),
    userId,
    category: 'announcements',
    value: announcements,
    updatedAt: Date.now(),
  });
}

export async function cacheRecentLesson(
  userId: string,
  recentLesson: RecentLessonItem | null
): Promise<void> {
  await putOfflineKv({
    key: offlineKeys.recentLesson(userId),
    userId,
    category: 'recentLesson',
    value: recentLesson,
    updatedAt: Date.now(),
  });
}

export async function cacheStudentAttempts(
  userId: string,
  attempts: StudentAttemptSummary[]
): Promise<void> {
  await putOfflineKv({
    key: offlineKeys.attempts(userId),
    userId,
    category: 'attempts',
    value: attempts,
    updatedAt: Date.now(),
  });
}

export async function cacheStudentTest(
  userId: string,
  payload: StudentTestPayload,
  pinned = false
): Promise<void> {
  const existing = await getOfflineKv<StudentTestPayload>(offlineKeys.test(userId, payload.test.id));
  await putOfflineKv({
    key: offlineKeys.test(userId, payload.test.id),
    userId,
    category: 'test',
    value: payload,
    updatedAt: Date.now(),
    pinned: pinned || Boolean(existing?.pinned),
  });
}

export async function cacheMockSession(
  userId: string,
  payload: MockSessionPayload,
  pinned = false
): Promise<void> {
  const existing = await getOfflineKv<MockSessionPayload>(
    offlineKeys.mock(userId, payload.attempt_id)
  );
  await putOfflineKv({
    key: offlineKeys.mock(userId, payload.attempt_id),
    userId,
    category: 'mock',
    value: payload,
    updatedAt: Date.now(),
    pinned: pinned || Boolean(existing?.pinned),
  });
}

export async function cacheMockAttempts(
  userId: string,
  attempts: MockAttemptSummary[]
): Promise<void> {
  await putOfflineKv({
    key: offlineKeys.mockAttempts(userId),
    userId,
    category: 'mockAttempts',
    value: attempts,
    updatedAt: Date.now(),
  });
}

