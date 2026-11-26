import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Share2, Target, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  computeUiAggregate,
  getUiPostUtmeScore100,
  isUiPostUtmeExam,
} from '../../data/admissionGuide';
import { fetchMockAttemptReview } from '../../services/mockExamService';
import type { MockAttemptReviewPayload } from '../../types/cbt';
import type { SharePayload } from '../../types/engagement';
import { ShareDialog, buildTestResultSharePayload } from '../../components/social/ShareDialog';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';

function formatElapsed(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function MockResultDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();

  const [review, setReview] = useState<MockAttemptReviewPayload | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string>('all');
  const [incorrectOnly, setIncorrectOnly] = useState(false);
  const [jambPreviewScore, setJambPreviewScore] = useState<number>(260);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    if (!attemptId) {
      setError('Invalid mock result ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetchMockAttemptReview(attemptId, user?.id);
    if (res.error || !res.review) {
      setError(res.error || 'Could not load mock exam result.');
      setLoading(false);
      return;
    }
    setReview(res.review);
    if (res.review.sections.length > 0) {
      setActiveSubjectId(res.review.sections[0].subject_id);
    }
    setLoading(false);
  }, [attemptId, user?.id]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const visibleSections = useMemo(() => {
    if (!review) return [];
    const filteredBySubject =
      activeSubjectId === 'all'
        ? review.sections
        : review.sections.filter((s) => s.subject_id === activeSubjectId);

    return filteredBySubject
      .map((sec) => ({
        ...sec,
        items: incorrectOnly ? sec.items.filter((i) => !i.is_correct) : sec.items,
      }))
      .filter((sec) => sec.items.length > 0);
  }, [activeSubjectId, incorrectOnly, review]);

  if (loading) {
    return <LoadingState message="Loading mock exam score breakdown..." />;
  }

  if (error || !review) {
    return (
      <ErrorState
        message={error || 'Mock result not found.'}
        onRetry={() => void loadReview()}
      />
    );
  }

  const { attempt } = review;
  const isUiPostUtme = isUiPostUtmeExam(attempt.exam_slug, attempt.exam_name, attempt.title);
  const uiScore100 = getUiPostUtmeScore100(attempt.percentage);
  const uiAgg = computeUiAggregate(jambPreviewScore, uiScore100);
  const meetsUiBar = uiScore100 >= 50;

  const submittedLabel = new Date(attempt.submitted_at).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/mocks"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Mock Center</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {attempt.total_correct < attempt.total_questions && (
            <Link
              to="/app/missed-questions"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Target className="h-4 w-4" aria-hidden="true" />
              <span>Practice Missed</span>
            </Link>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setSharePayload(
                buildTestResultSharePayload({
                  testTitle: isUiPostUtme
                    ? `${attempt.title} (${uiScore100}/100)`
                    : `${attempt.title} (${attempt.total_score_400}/400)`,
                  percentage: attempt.percentage,
                  score: isUiPostUtme ? uiScore100 : attempt.total_score_400,
                  totalPoints: isUiPostUtme ? 100 : 400,
                  examName: attempt.exam_name,
                })
              )
            }
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            <span>Share Score</span>
          </Button>
        </div>
      </div>

      {/* Aggregate Score Hero Card */}
      <Card padding="lg" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-phosters-700 dark:text-phosters-400">
              {attempt.exam_name} · Submitted {submittedLabel}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {attempt.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums inline-flex flex-wrap items-center gap-2">
              <span>
                {attempt.total_correct} of {attempt.total_questions} questions correct (
                {Math.round(attempt.percentage)}%)
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Time used: {formatElapsed(attempt.elapsed_seconds)}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-phosters-200 dark:border-phosters-800 bg-phosters-50/70 dark:bg-phosters-950/40 px-5 py-3 text-center shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-phosters-700 dark:text-phosters-400">
              {isUiPostUtme ? 'UI Post-UTME Score' : 'JAMB Aggregate'}
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {isUiPostUtme ? uiScore100 : attempt.total_score_400}{' '}
              <span className="text-base font-semibold text-slate-500 dark:text-slate-400">
                {isUiPostUtme ? '/ 100' : '/ 400'}
              </span>
            </p>
            {isUiPostUtme && (
              <p
                className={[
                  'mt-1 text-[11px] font-semibold',
                  meetsUiBar
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400',
                ].join(' ')}
              >
                {meetsUiBar ? 'Meets 50/100 screening bar' : 'Below 50/100 screening bar'}
              </p>
            )}
          </div>
        </div>

        {/* 4-Subject Score Breakdown Grid */}
        {attempt.subject_scores.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {attempt.subject_scores.map((sub) => {
              const subjPct = Math.min(100, Math.max(0, Math.round(sub.percentage)));
              return (
                <div
                  key={sub.subject_id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {sub.subject_name}
                    </p>
                    <span className="text-sm font-bold text-phosters-700 dark:text-phosters-400 tabular-nums shrink-0">
                      {isUiPostUtme ? `${subjPct}%` : `${sub.jamb_score_100}/100`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-phosters-600"
                      style={{
                        width: `${isUiPostUtme ? subjPct : Math.min(100, Math.max(0, sub.jamb_score_100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {sub.correct} / {sub.total} correct ({subjPct}%)
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Inline Combined UI Aggregate Preview for UI Post-UTME */}
        {isUiPostUtme && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Combined UI Admission Aggregate Preview
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                Formula: (JAMB ÷ 8) + ({uiScore100} ÷ 2) ={' '}
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  {uiAgg.totalAggregate.toFixed(2)}%
                </strong>{' '}
                ({uiAgg.jambPart.toFixed(1)} + {uiAgg.postUtmePart.toFixed(1)})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>JAMB (/400):</span>
                <input
                  type="number"
                  min={0}
                  max={400}
                  value={jambPreviewScore}
                  onChange={(e) =>
                    setJambPreviewScore(
                      Math.min(400, Math.max(0, Number(e.target.value) || 0))
                    )
                  }
                  className="w-20 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </label>

              <Link
                to="/app/admission-guide"
                className="inline-flex items-center justify-center min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-phosters-700 dark:text-phosters-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Full Aggregate Guide
              </Link>
            </div>
          </div>
        )}
      </Card>

      {!attempt.show_explanations_after_submission ? (
        <Alert tone="info">
          Answer review and explanations are turned off by the tutor for this mock exam.
        </Alert>
      ) : (
        <section aria-labelledby="mock-review-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2
              id="mock-review-heading"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Answer Key &amp; Explanations
            </h2>

            <label className="inline-flex items-center gap-2 min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={incorrectOnly}
                onChange={(e) => setIncorrectOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                Show missed questions only
              </span>
            </label>
          </div>

          {/* Subject Filter Tabs */}
          {review.sections.length > 1 && (
            <div
              role="tablist"
              aria-label="Filter answer review by subject"
              className="flex items-center gap-1.5 overflow-x-auto pb-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSubjectId === 'all'}
                onClick={() => setActiveSubjectId('all')}
                className={[
                  'min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 cursor-pointer transition-colors',
                  activeSubjectId === 'all'
                    ? 'bg-phosters-600 text-white border-phosters-600'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700',
                ].join(' ')}
              >
                All Subjects
              </button>
              {review.sections.map((sec) => (
                <button
                  key={sec.subject_id}
                  type="button"
                  role="tab"
                  aria-selected={activeSubjectId === sec.subject_id}
                  onClick={() => setActiveSubjectId(sec.subject_id)}
                  className={[
                    'min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 cursor-pointer transition-colors',
                    activeSubjectId === sec.subject_id
                      ? 'bg-phosters-600 text-white border-phosters-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700',
                  ].join(' ')}
                >
                  {sec.subject_name}
                </button>
              ))}
            </div>
          )}

          {visibleSections.length === 0 ? (
            <Card padding="md">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {incorrectOnly
                  ? 'No missed questions in this subject section!'
                  : 'No review items available.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {visibleSections.map((sec) => (
                <div key={sec.subject_id} className="space-y-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {sec.subject_name}
                  </h3>

                  {sec.items.map((item) => (
                    <Card key={item.id} padding="md" className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                          Question {item.question_order}
                        </p>
                        {item.is_correct ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Correct</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400">
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {item.selected_option_key
                                ? `Answered ${item.selected_option_key}`
                                : 'Unanswered'}
                            </span>
                          </span>
                        )}
                      </div>

                      <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line">
                        {item.question_text}
                      </p>

                      <div className="space-y-1.5">
                        {item.options.map((opt) => {
                          const isCorrectOpt =
                            opt.key.toUpperCase() === item.correct_option_key.toUpperCase();
                          const isChosenWrong =
                            !item.is_correct &&
                            item.selected_option_key &&
                            opt.key.toUpperCase() === item.selected_option_key.toUpperCase();

                          return (
                            <div
                              key={opt.key}
                              className={[
                                'flex items-start gap-2.5 px-3 py-2 rounded-lg border text-sm',
                                isCorrectOpt
                                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-slate-900 dark:text-slate-100 font-medium'
                                  : isChosenWrong
                                    ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/40 text-slate-900 dark:text-slate-100'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300',
                              ].join(' ')}
                            >
                              <span className="font-mono text-xs font-bold pt-0.5 shrink-0">
                                {opt.key}.
                              </span>
                              <span className="flex-1">{opt.text}</span>
                              {isCorrectOpt && (
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {item.explanation && (
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            Explanation:{' '}
                          </span>
                          {item.explanation}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <ShareDialog
        open={Boolean(sharePayload)}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
}
