import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Send,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import {
  fetchPendingMockSession,
  submitMockExamAttempt,
} from '../../services/mockExamService';
import type { MockSessionPayload } from '../../types/cbt';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';

function formatCountdown(secondsRemaining: number): string {
  const safe = Math.max(0, Math.floor(secondsRemaining));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export function MockTakePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const { isOnline, refreshVault } = useOfflineSync();
  const navigate = useNavigate();

  const [session, setSession] = useState<MockSessionPayload | null>(null);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(7200);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [queuedOfflineNotice, setQueuedOfflineNotice] = useState(false);

  const autoSubmittedRef = useRef(false);
  const draftStorageKey = attemptId ? `phosters:mock-draft:${attemptId}` : '';

  const loadSession = useCallback(async () => {
    if (!attemptId) {
      setLoadError('Invalid mock exam session ID.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const res = await fetchPendingMockSession(attemptId, user?.id);

    if (res.alreadySubmitted) {
      navigate(`/app/mocks/results/${attemptId}`, { replace: true });
      return;
    }

    if (res.error || !res.session) {
      setLoadError(res.error || 'Could not load mock exam paper.');
      setLoading(false);
      return;
    }

    const totalAllowedSecs = Math.max(60, (res.session.duration_minutes || 120) * 60);
    let restoredRemaining = totalAllowedSecs;

    if (typeof window !== 'undefined' && draftStorageKey) {
      try {
        const raw = window.sessionStorage.getItem(draftStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            answers?: Record<string, string>;
            flagged?: string[];
            remainingSeconds?: number;
          };
          if (parsed.answers && typeof parsed.answers === 'object') {
            setAnswers(parsed.answers);
          }
          if (Array.isArray(parsed.flagged)) {
            setFlaggedIds(new Set(parsed.flagged));
          }
          if (
            typeof parsed.remainingSeconds === 'number' &&
            parsed.remainingSeconds > 0 &&
            parsed.remainingSeconds <= totalAllowedSecs
          ) {
            restoredRemaining = parsed.remainingSeconds;
          }
        }
      } catch {
        // Ignore invalid draft JSON
      }
    }

    setSession(res.session);
    setRemainingSeconds(restoredRemaining);
    setLoading(false);
  }, [attemptId, draftStorageKey, navigate, user?.id]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // Persist local draft state so accidental tab refresh preserves answers & clock
  useEffect(() => {
    if (!session || typeof window === 'undefined' || !draftStorageKey) return;
    try {
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          answers,
          flagged: Array.from(flaggedIds),
          remainingSeconds,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [answers, draftStorageKey, flaggedIds, remainingSeconds, session]);

  const performSubmit = useCallback(async () => {
    if (!session || !attemptId || submitting || queuedOfflineNotice) return;

    setSubmitting(true);
    setSubmitError(null);

    const totalAllowedSecs = Math.max(60, (session.duration_minutes || 120) * 60);
    const elapsedSeconds = Math.max(0, totalAllowedSecs - remainingSeconds);

    const res = await submitMockExamAttempt(attemptId, answers, elapsedSeconds, {
      studentId: user?.id,
      mockTitle: session.title,
      totalQuestions: session.total_questions,
    });

    setSubmitting(false);

    if (res.queuedOffline) {
      if (typeof window !== 'undefined' && draftStorageKey) {
        window.sessionStorage.removeItem(draftStorageKey);
      }
      await refreshVault();
      setConfirmSubmitOpen(false);
      setQueuedOfflineNotice(true);
      return;
    }

    if (res.error || !res.submittedId) {
      setSubmitError(res.error || 'Could not submit mock exam answers.');
      return;
    }

    if (typeof window !== 'undefined' && draftStorageKey) {
      window.sessionStorage.removeItem(draftStorageKey);
    }
    navigate(`/app/mocks/results/${res.submittedId}`, { replace: true });
  }, [
    answers,
    attemptId,
    draftStorageKey,
    navigate,
    queuedOfflineNotice,
    refreshVault,
    remainingSeconds,
    session,
    submitting,
    user?.id,
  ]);

  // Live 1-second CBT countdown timer with auto-submit on expiry
  useEffect(() => {
    if (!session || queuedOfflineNotice || submitting) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            void performSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [performSubmit, queuedOfflineNotice, session, submitting]);

  const sections = session?.sections ?? [];
  const activeSection = sections[activeSectionIdx] ?? null;
  const activeQuestions = activeSection?.questions ?? [];
  const activeQuestion = activeQuestions[activeQuestionIdx] ?? null;

  const totalAnswered = useMemo(() => {
    if (!session) return 0;
    return session.sections.reduce(
      (sum, sec) => sum + sec.questions.filter((q) => Boolean(answers[q.id])).length,
      0
    );
  }, [answers, session]);

  const selectOption = useCallback((questionId: string, optionKey: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const goPrevious = useCallback(() => {
    if (activeQuestionIdx > 0) {
      setActiveQuestionIdx((i) => i - 1);
    } else if (activeSectionIdx > 0) {
      const prevSec = sections[activeSectionIdx - 1];
      setActiveSectionIdx((s) => s - 1);
      setActiveQuestionIdx(Math.max(0, (prevSec?.questions.length ?? 1) - 1));
    }
  }, [activeQuestionIdx, activeSectionIdx, sections]);

  const goNext = useCallback(() => {
    if (activeQuestionIdx < activeQuestions.length - 1) {
      setActiveQuestionIdx((i) => i + 1);
    } else if (activeSectionIdx < sections.length - 1) {
      setActiveSectionIdx((s) => s + 1);
      setActiveQuestionIdx(0);
    }
  }, [activeQuestionIdx, activeQuestions.length, activeSectionIdx, sections.length]);

  // Standard JAMB CBT keyboard shortcuts: A/B/C/D and ArrowLeft/ArrowRight
  useEffect(() => {
    if (!activeQuestion || confirmSubmitOpen || queuedOfflineNotice) return;

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const upper = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E'].includes(upper)) {
        const matched = activeQuestion.options.find(
          (opt) => opt.key.toUpperCase() === upper
        );
        if (matched) {
          selectOption(activeQuestion.id, matched.key);
        }
      } else if (e.key === 'ArrowRight' || upper === 'N') {
        goNext();
      } else if (e.key === 'ArrowLeft' || upper === 'P') {
        goPrevious();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    activeQuestion,
    confirmSubmitOpen,
    goNext,
    goPrevious,
    queuedOfflineNotice,
    selectOption,
  ]);

  if (loading) {
    return <LoadingState message="Preparing your 4-subject CBT exam..." />;
  }

  if (loadError || !session) {
    return (
      <ErrorState
        message={loadError || 'Mock exam session not found.'}
        onRetry={() => void loadSession()}
      />
    );
  }

  if (queuedOfflineNotice) {
    return (
      <div className="max-w-xl mx-auto py-8 space-y-5">
        <Alert tone="success" title="Mock exam saved offline for grading">
          All {totalAnswered} of {session.total_questions} answered questions from{' '}
          <strong className="font-semibold">{session.title}</strong> are safely stored in your
          Offline Study Queue. As soon as your connection returns, Phosters will submit and compute
          your /400 score automatically.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/app/offline"
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
          >
            View Offline Sync Queue
          </Link>
          <Link
            to="/app/mocks"
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Back to Mock Center
          </Link>
        </div>
      </div>
    );
  }

  const isLowTime = remainingSeconds <= 600 && remainingSeconds > 120;
  const isCriticalTime = remainingSeconds <= 120;
  const isFirstGlobalQuestion = activeSectionIdx === 0 && activeQuestionIdx === 0;
  const isLastGlobalQuestion =
    activeSectionIdx === sections.length - 1 &&
    activeQuestionIdx === Math.max(0, activeQuestions.length - 1);

  return (
    <div className="space-y-5">
      {/* Top CBT Header Bar: Title + Live Countdown + Submit */}
      <Card padding="md" className="sticky top-2 z-20 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {session.exam_name} · {totalAnswered}/{session.total_questions} answered
            </p>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              {session.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              role="timer"
              aria-live="off"
              className={[
                'inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-lg border font-mono text-base sm:text-lg font-bold tabular-nums',
                isCriticalTime
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                  : isLowTime
                    ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100',
              ].join(' ')}
            >
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formatCountdown(remainingSeconds)}</span>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={() => setConfirmSubmitOpen(true)}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Submit Exam</span>
            </Button>
          </div>
        </div>

        {/* 4-Subject Paper Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Mock Exam Subject Papers"
          className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto"
        >
          {sections.map((sec, idx) => {
            const answeredInSec = sec.questions.filter((q) => Boolean(answers[q.id])).length;
            const active = idx === activeSectionIdx;
            return (
              <button
                key={sec.subject_id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveSectionIdx(idx);
                  setActiveQuestionIdx(0);
                }}
                className={[
                  'inline-flex items-center gap-2 min-h-[42px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors border',
                  active
                    ? 'bg-phosters-600 text-white border-phosters-600'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                <span>{sec.subject_name}</span>
                <span
                  className={[
                    'text-xs font-mono tabular-nums',
                    active ? 'text-white/90' : 'text-slate-500 dark:text-slate-400',
                  ].join(' ')}
                >
                  {answeredInSec}/{sec.questions.length}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {!isOnline && (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              You are offline. Keep answering — clicking Submit will safely queue your completed mock paper for automatic grading once connected.
            </span>
          </span>
        </Alert>
      )}

      {submitError && <Alert tone="error">{submitError}</Alert>}

      {/* Two-Zone CBT Workspace: Left Question Stage + Right Number Grid Navigator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Question Stage */}
        <div className="lg:col-span-8 space-y-4">
          {activeQuestion ? (
            <Card padding="lg" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-phosters-700 dark:text-phosters-400">
                    {activeSection?.subject_name}
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    Question {activeQuestionIdx + 1} of {activeQuestions.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFlag(activeQuestion.id)}
                  aria-pressed={flaggedIds.has(activeQuestion.id)}
                  className={[
                    'inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors',
                    flaggedIds.has(activeQuestion.id)
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{flaggedIds.has(activeQuestion.id) ? 'Flagged' : 'Flag for Review'}</span>
                </button>
              </div>

              <div className="text-base sm:text-[17px] leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-line font-medium">
                {activeQuestion.question_text}
              </div>

              <div
                role="radiogroup"
                aria-label={`Answer choices for question ${activeQuestionIdx + 1}`}
                className="space-y-2.5"
              >
                {activeQuestion.options.map((opt) => {
                  const selected = answers[activeQuestion.id] === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectOption(activeQuestion.id, opt.key)}
                      className={[
                        'w-full flex items-start gap-3.5 min-h-[52px] p-3.5 rounded-xl border text-left transition-colors cursor-pointer',
                        selected
                          ? 'border-phosters-600 dark:border-phosters-500 bg-phosters-50/75 dark:bg-phosters-900/40 text-slate-900 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/60',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-flex items-center justify-center h-7 w-7 rounded-md font-mono text-xs font-bold shrink-0 mt-0.5 border',
                          selected
                            ? 'bg-phosters-600 text-white border-phosters-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
                        ].join(' ')}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm sm:text-base leading-snug pt-0.5">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isFirstGlobalQuestion}
                  onClick={goPrevious}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Previous</span>
                </Button>

                <p className="hidden sm:block text-xs text-slate-400 dark:text-slate-500">
                  Keys: A–D select · N / P navigate
                </p>

                {isLastGlobalQuestion ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setConfirmSubmitOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Finish &amp; Review Submit</span>
                  </Button>
                ) : (
                  <Button type="button" variant="primary" onClick={goNext}>
                    <span>Next</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <Alert tone="info">No questions loaded in this subject paper.</Alert>
          )}
        </div>

        {/* Right Navigator Palette */}
        <Card padding="md" className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {activeSection?.subject_name} Grid
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {activeQuestions.length} Qs
            </span>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-1.5">
            {activeQuestions.map((q, idx) => {
              const isCurrent = idx === activeQuestionIdx;
              const isAnswered = Boolean(answers[q.id]);
              const isFlagged = flaggedIds.has(q.id);

              return (
                <button
                  key={q.id}
                  type="button"
                  aria-label={`Question ${idx + 1}${isAnswered ? ', answered' : ''}${isFlagged ? ', flagged' : ''}`}
                  onClick={() => setActiveQuestionIdx(idx)}
                  className={[
                    'relative h-10 rounded-lg text-xs font-bold tabular-nums cursor-pointer transition-colors border',
                    isCurrent
                      ? 'ring-2 ring-phosters-600 dark:ring-phosters-400 border-phosters-600 dark:border-phosters-400'
                      : '',
                    isAnswered
                      ? 'bg-phosters-600 text-white border-phosters-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700',
                  ].join(' ')}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-phosters-600 inline-block" aria-hidden="true" />
              <span>Answered</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-slate-200 dark:bg-slate-700 inline-block" aria-hidden="true" />
              <span>Unanswered</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" aria-hidden="true" />
              <span>Flagged</span>
            </span>
          </div>
        </Card>
      </div>

      {/* Confirmation Overlay Before Submission */}
      {confirmSubmitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <Card padding="lg" className="w-full max-w-md space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Submit Mock Examination?
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  You have answered{' '}
                  <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {totalAnswered} of {session.total_questions}
                  </strong>{' '}
                  questions with{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCountdown(remainingSeconds)}
                  </strong>{' '}
                  remaining.
                </p>
              </div>
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3">
              {sections.map((sec) => {
                const count = sec.questions.filter((q) => Boolean(answers[q.id])).length;
                return (
                  <li key={sec.subject_id} className="py-2 flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {sec.subject_name}
                    </span>
                    <span className="font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                      {count}/{sec.questions.length} answered
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => setConfirmSubmitOpen(false)}
              >
                Return to Exam
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                onClick={() => void performSubmit()}
              >
                {isOnline ? 'Submit & Grade Now' : 'Save & Queue Submission'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
