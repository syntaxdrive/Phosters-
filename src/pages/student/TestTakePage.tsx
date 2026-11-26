import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calculator, CheckCircle2, CloudUpload } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchTestForTaking,
  submitStudentTestAttempt,
} from '../../services/cbtService';
import type { StudentTestPayload } from '../../types/cbt';
import { JambCalculator } from '../../components/cbt/JambCalculator';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function TestTakePage() {
  const { testId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [payload, setPayload] = useState<StudentTestPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmUnanswered, setConfirmUnanswered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const questionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [queuedOfflineState, setQueuedOfflineState] = useState<{
    testTitle: string;
    answeredCount: number;
    totalQuestions: number;
  } | null>(null);

  const loadTest = useCallback(async () => {
    if (!testId) return;
    setLoading(true);
    setError(null);
    const res = await fetchTestForTaking(testId, user?.id);
    if (res.error || !res.payload) {
      setError(res.error || 'Could not load test.');
      setLoading(false);
      return;
    }
    setPayload(res.payload);
    setLoading(false);
  }, [testId, user?.id]);

  useEffect(() => {
    void loadTest();
  }, [loadTest]);

  const selectOption = useCallback((questionId: string, optionId: string) => {
    setConfirmUnanswered(false);
    setSubmitError(null);
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  useEffect(() => {
    if (!payload || payload.questions.length === 0 || queuedOfflineState) return;
    const questions = payload.questions;

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const activeQ = questions[activeQuestionIdx];
      if (!activeQ) return;

      const upper = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E'].includes(upper)) {
        const matched = activeQ.options.find(
          (opt) => opt.option_key.toUpperCase() === upper
        );
        if (matched) {
          selectOption(activeQ.id, matched.id);
        }
      } else if (e.key === 'ArrowRight' || upper === 'N') {
        const nextIdx = Math.min(questions.length - 1, activeQuestionIdx + 1);
        if (nextIdx !== activeQuestionIdx) {
          setActiveQuestionIdx(nextIdx);
          questionRefs.current[nextIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (e.key === 'ArrowLeft' || upper === 'P') {
        const prevIdx = Math.max(0, activeQuestionIdx - 1);
        if (prevIdx !== activeQuestionIdx) {
          setActiveQuestionIdx(prevIdx);
          questionRefs.current[prevIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeQuestionIdx, payload, queuedOfflineState, selectOption]);

  async function executeSubmit() {
    if (!payload) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await submitStudentTestAttempt(payload.test.id, answers, {
      studentId: user?.id,
      testTitle: payload.test.title,
      totalQuestions: payload.questions.length,
    });
    setSubmitting(false);

    if (res.queuedOffline) {
      const answeredCount = payload.questions.filter((q) => Boolean(answers[q.id])).length;
      setQueuedOfflineState({
        testTitle: payload.test.title,
        answeredCount,
        totalQuestions: payload.questions.length,
      });
      return;
    }

    if (res.error || !res.attemptId) {
      setSubmitError(res.error || 'Failed to submit test. Please try again.');
      return;
    }

    navigate(`/app/results/${res.attemptId}`, { replace: true });
  }

  function handleSubmitClick() {
    if (!payload) return;
    const unansweredCount = payload.questions.filter((q) => !answers[q.id]).length;
    if (unansweredCount > 0 && !confirmUnanswered) {
      setConfirmUnanswered(true);
      return;
    }
    void executeSubmit();
  }

  if (loading) return <LoadingState message="Loading test questions..." />;
  if (error || !payload) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Test unavailable"
          message={error || 'This test could not be opened.'}
          onRetry={() => void loadTest()}
        />
        <div className="flex justify-center">
          <Link to="/app/subjects" className="text-sm font-semibold text-phosters-700 hover:underline">
            Back to Subjects
          </Link>
        </div>
      </div>
    );
  }

  if (queuedOfflineState) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <Card padding="lg" className="space-y-4">
          <div className="h-11 w-11 rounded-xl bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400">
            <CloudUpload className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              Answers saved offline for grading
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Your {queuedOfflineState.answeredCount} of {queuedOfflineState.totalQuestions} answers for{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {queuedOfflineState.testTitle}
              </span>{' '}
              are safely stored on this device. They will automatically upload and receive official grading as soon as your internet connection returns.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to="/app/offline"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Open Offline Study Library
            </Link>
            <Link
              to="/app/subjects"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Browse Subjects
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { test, questions } = payload;
  const answeredCount = questions.filter((q) => Boolean(answers[q.id])).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <Link
          to={test.lesson_id ? `/app/lessons/${test.lesson_id}` : '/app/subjects'}
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{test.lesson_id ? 'Back to Lesson' : 'Back to Subjects'}</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {test.title}
            </h1>
            {test.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{test.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 tabular-nums">
              Answered {answeredCount} of {questions.length}
            </p>
            <Button
              type="button"
              variant={calculatorOpen ? 'primary' : 'secondary'}
              onClick={() => setCalculatorOpen((v) => !v)}
            >
              <Calculator className="h-4 w-4" aria-hidden="true" />
              <span>Calculator</span>
            </Button>
          </div>
        </div>
        {questions.length > 0 && (
          <p className="hidden sm:block text-xs text-slate-400 dark:text-slate-50">
            CBT keyboard practice: A–D select answer · N / P move between questions
          </p>
        )}
      </div>

      {questions.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This test does not have any questions yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {questions.map((question, index) => {
            const selectedOptionId = answers[question.id];
            const isFocused = index === activeQuestionIdx;
            return (
              <div
                key={question.id}
                ref={(el) => {
                  questionRefs.current[index] = el;
                }}
                onClick={() => setActiveQuestionIdx(index)}
              >
              <Card
                padding="lg"
                className={[
                  'space-y-4 transition-colors',
                  isFocused ? 'border-phosters-400 dark:border-phosters-600' : '',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold text-phosters-700 dark:text-phosters-400 tabular-nums">
                    Question {index + 1} of {questions.length}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {question.points} {question.points === 1 ? 'mark' : 'marks'}
                  </span>
                </div>

                <p className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-line">
                  {question.question_text}
                </p>

                <div role="radiogroup" aria-label={`Question ${index + 1}`} className="space-y-2.5">
                  {question.options.map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setActiveQuestionIdx(index);
                          selectOption(question.id, opt.id);
                        }}
                        className={[
                          'w-full flex items-center justify-between gap-3 min-h-[52px] px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-phosters-50 dark:bg-phosters-900/40 border-phosters-600 dark:border-phosters-500 text-slate-900 dark:text-slate-100'
                            : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                        ].join(' ')}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className={[
                              'inline-flex items-center justify-center h-7 w-7 rounded-md text-xs font-mono font-semibold shrink-0',
                              isSelected
                                ? 'bg-phosters-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
                            ].join(' ')}
                          >
                            {opt.option_key}
                          </span>
                          <span className="text-sm sm:text-base leading-snug pt-0.5">
                            {opt.option_text}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2
                            className="h-5 w-5 text-phosters-600 dark:text-phosters-400 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
              </div>
            );
          })}

          {submitError && <Alert tone="error">{submitError}</Alert>}

          {confirmUnanswered && (
            <Alert tone="warning" title="Unanswered questions remaining">
              You have {unansweredCount} unanswered{' '}
              {unansweredCount === 1 ? 'question' : 'questions'}. Tap{' '}
              <strong>Submit Test Anyway</strong> below to grade your current answers.
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
              {answeredCount} / {questions.length} answered
            </p>
            <div className="flex gap-3">
              {confirmUnanswered && (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmUnanswered(false)}
                >
                  Keep Answering
                </Button>
              )}
              <Button size="lg" onClick={handleSubmitClick} loading={submitting}>
                {confirmUnanswered ? 'Submit Test Anyway' : 'Submit Test'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <JambCalculator
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />
    </div>
  );
}
