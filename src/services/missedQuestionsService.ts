import {
  getOfflineKv,
  isDeviceOnline,
  listOfflineKvByUser,
  offlineKeys,
  type CachedReviewBundle,
} from '../lib/offlineDb';
import type { MockAttemptReviewPayload } from '../types/cbt';
import { fetchAttemptReview, fetchStudentAttempts } from './cbtService';
import { fetchMockAttemptReview, fetchStudentMockAttempts } from './mockExamService';

export interface MissedQuestionOption {
  key: string;
  text: string;
  isCorrect: boolean;
}

export interface MissedQuestionItem {
  dedupeKey: string;
  sourceType: 'test' | 'mock';
  sourceTitle: string;
  subjectName: string;
  questionText: string;
  explanation: string | null;
  lastWrongAnswerText: string | null;
  options: MissedQuestionOption[];
  correctKey: string;
  seenAt: string;
}

const MASTERED_STORAGE_PREFIX = 'phosters:mastered-missed:';

function normalizeQuestionKey(questionText: string): string {
  return questionText.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 220);
}

export function getMasteredMissedKeys(userId: string): Set<string> {
  if (typeof window === 'undefined' || !userId) return new Set();
  try {
    const raw = window.localStorage.getItem(`${MASTERED_STORAGE_PREFIX}${userId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveMasteredMissedKeys(userId: string, keys: Set<string>): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(
      `${MASTERED_STORAGE_PREFIX}${userId}`,
      JSON.stringify(Array.from(keys))
    );
  } catch {
    // Ignore storage quota errors
  }
}

function collectFromTestReview(
  bundle: CachedReviewBundle,
  target: Map<string, MissedQuestionItem>
) {
  const { review, courseContext } = bundle;
  if (!review?.review_items) return;
  const subjectLabel = courseContext?.subjectName || 'Topic Practice Test';
  const submittedAt = review.attempt?.submitted_at || '';

  for (const item of review.review_items) {
    if (item.is_correct) continue;
    const dedupeKey = normalizeQuestionKey(item.question_text);
    if (!dedupeKey) continue;

    const correctOpt =
      item.options.find((o) => o.is_correct || o.id === item.correct_option_id) ?? null;
    if (!correctOpt) continue;

    const wrongOpt = item.selected_option_id
      ? item.options.find((o) => o.id === item.selected_option_id)
      : null;

    const existing = target.get(dedupeKey);
    if (existing && existing.seenAt > submittedAt) continue;

    target.set(dedupeKey, {
      dedupeKey,
      sourceType: 'test',
      sourceTitle: review.attempt?.test_title || 'Practice Test',
      subjectName: subjectLabel,
      questionText: item.question_text,
      explanation: item.explanation || null,
      lastWrongAnswerText: wrongOpt
        ? `${wrongOpt.option_key}. ${wrongOpt.option_text}`
        : null,
      options: item.options.map((o) => ({
        key: o.option_key,
        text: o.option_text,
        isCorrect: Boolean(o.is_correct || o.id === item.correct_option_id),
      })),
      correctKey: correctOpt.option_key,
      seenAt: submittedAt,
    });
  }
}

function collectFromMockReview(
  review: MockAttemptReviewPayload,
  target: Map<string, MissedQuestionItem>
) {
  if (!review?.sections) return;
  const submittedAt = review.attempt?.submitted_at || '';

  for (const sec of review.sections) {
    for (const item of sec.items) {
      if (item.is_correct) continue;
      const dedupeKey = normalizeQuestionKey(item.question_text);
      if (!dedupeKey) continue;

      const wrongOpt = item.selected_option_key
        ? item.options.find((o) => o.key === item.selected_option_key)
        : null;

      const existing = target.get(dedupeKey);
      if (existing && existing.seenAt > submittedAt) continue;

      target.set(dedupeKey, {
        dedupeKey,
        sourceType: 'mock',
        sourceTitle: review.attempt?.title || 'Mock Exam',
        subjectName: sec.subject_name,
        questionText: item.question_text,
        explanation: item.explanation || null,
        lastWrongAnswerText: wrongOpt ? `${wrongOpt.key}. ${wrongOpt.text}` : null,
        options: item.options.map((o) => ({
          key: o.key,
          text: o.text,
          isCorrect: o.key === item.correct_option_key,
        })),
        correctKey: item.correct_option_key,
        seenAt: submittedAt,
      });
    }
  }
}

/**
 * Loads missed questions from cached test/mock reviews AND warms up any uncached
 * recent attempts when online so underserved students never miss weak-area practice.
 */
export async function loadStudentMissedQuestions(userId: string): Promise<{
  items: MissedQuestionItem[];
  fromOfflineOnly: boolean;
  error: string | null;
}> {
  if (!userId) {
    return { items: [], fromOfflineOnly: false, error: 'Sign in required.' };
  }

  let fromOfflineOnly = !isDeviceOnline();

  if (isDeviceOnline()) {
    try {
      const [testsRes, mocksRes] = await Promise.all([
        fetchStudentAttempts(userId, 12),
        fetchStudentMockAttempts(userId, 6),
      ]);

      const uncachedTestIds: string[] = [];
      for (const att of testsRes.attempts) {
        if (att.percentage >= 100) continue;
        const cached = await getOfflineKv<CachedReviewBundle>(
          offlineKeys.review(userId, att.id)
        );
        if (!cached?.value) {
          uncachedTestIds.push(att.id);
        }
      }

      const uncachedMockIds: string[] = [];
      for (const mock of mocksRes.attempts) {
        if (mock.percentage >= 100) continue;
        const cached = await getOfflineKv<MockAttemptReviewPayload>(
          offlineKeys.mockReview(userId, mock.id)
        );
        if (!cached?.value) {
          uncachedMockIds.push(mock.id);
        }
      }

      await Promise.all([
        ...uncachedTestIds.slice(0, 8).map((id) => fetchAttemptReview(id, userId)),
        ...uncachedMockIds.slice(0, 4).map((id) => fetchMockAttemptReview(id, userId)),
      ]);
    } catch {
      fromOfflineOnly = true;
    }
  }

  const allKv = await listOfflineKvByUser(userId);
  const byKey = new Map<string, MissedQuestionItem>();

  for (const record of allKv) {
    if (record.category === 'review' && record.value) {
      collectFromTestReview(record.value as CachedReviewBundle, byKey);
    } else if (record.category === 'mockReview' && record.value) {
      collectFromMockReview(record.value as MockAttemptReviewPayload, byKey);
    }
  }

  const items = Array.from(byKey.values()).sort((a, b) =>
    b.seenAt.localeCompare(a.seenAt)
  );

  return { items, fromOfflineOnly, error: null };
}
