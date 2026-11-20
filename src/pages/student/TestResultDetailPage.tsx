import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { fetchAttemptReview } from '../../services/cbtService';
import type { AttemptReviewPayload } from '../../types/cbt';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function TestResultDetailPage() {
  const { attemptId = '' } = useParams();

  const [review, setReview] = useState<AttemptReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    setError(null);
    const res = await fetchAttemptReview(attemptId);
    if (res.error || !res.review) {
      setError(res.error || 'Result not found.');
      setLoading(false);
      return;
    }
    setReview(res.review);
    setLoading(false);
  }, [attemptId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  if (loading) return <LoadingState message="Loading your test result..." />;
  if (error || !review) {
    return <ErrorState message={error || 'Result unavailable.'} onRetry={() => void loadReview()} />;
  }

  const { attempt, review_items } = review;
  const submittedLabel = new Date(attempt.submitted_at).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/results"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>All Results</span>
        </Link>

        <Link
          to={`/app/tests/${attempt.test_id}`}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Retake Test</span>
        </Link>
      </div>

      <Card padding="lg" className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Submitted {submittedLabel}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {attempt.test_title}
          </h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-phosters-50 border border-phosters-200">
            <p className="text-xs font-medium text-phosters-800">Percentage</p>
            <p className="mt-1 text-2xl font-bold text-phosters-900 tabular-nums">
              {Math.round(Number(attempt.percentage))}%
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-medium text-slate-600">Score</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
              {attempt.score} / {attempt.total_points}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-medium text-slate-600">Correct answers</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
              {attempt.correct_count} / {attempt.total_questions}
            </p>
          </div>
        </div>

        {attempt.lesson_id && (
          <div>
            <Link
              to={`/app/lessons/${attempt.lesson_id}`}
              className="text-sm font-semibold text-phosters-700 hover:underline"
            >
              Return to lesson
            </Link>
          </div>
        )}
      </Card>

      {!attempt.show_explanations_after_submission ? (
        <Alert tone="info">
          Answer review and explanations are turned off for this test.
        </Alert>
      ) : (
        <section aria-labelledby="review-heading" className="space-y-4">
          <h2 id="review-heading" className="text-lg font-bold text-slate-900">
            Answer review
          </h2>

          {review_items.map((item, idx) => (
            <Card key={item.question_id} padding="lg" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  Question {idx + 1} · {item.points_awarded} / {item.points} marks
                </span>
                <span
                  className={[
                    'inline-flex items-center gap-1.5 text-xs font-semibold',
                    item.is_correct ? 'text-phosters-700' : 'text-red-600',
                  ].join(' ')}
                >
                  {item.is_correct ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>Correct</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      <span>Incorrect</span>
                    </>
                  )}
                </span>
              </div>

              <p className="text-base font-semibold text-slate-900 whitespace-pre-line">
                {item.question_text}
              </p>

              <div className="space-y-2">
                {item.options.map((opt) => {
                  const isSelected = opt.id === item.selected_option_id;
                  const isCorrectOpt = opt.id === item.correct_option_id || opt.is_correct;

                  let styleClass = 'border-slate-200 bg-white text-slate-700';
                  let marker = '';
                  if (isCorrectOpt) {
                    styleClass = 'border-phosters-600 bg-phosters-50 text-slate-900';
                    marker = isSelected ? 'Your choice · Correct' : 'Correct answer';
                  } else if (isSelected) {
                    styleClass = 'border-red-300 bg-red-50 text-red-900';
                    marker = 'Your choice';
                  }

                  return (
                    <div
                      key={opt.id}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-sm ${styleClass}`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="font-mono font-semibold text-xs pt-0.5 shrink-0">
                          {opt.option_key}.
                        </span>
                        <span>{opt.option_text}</span>
                      </div>
                      {marker && (
                        <span className="text-xs font-semibold shrink-0">{marker}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {item.explanation && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Explanation: </span>
                  <span>{item.explanation}</span>
                </div>
              )}
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
