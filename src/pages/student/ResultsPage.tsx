import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CloudUpload, RefreshCw, Share2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { fetchStudentAttempts } from '../../services/cbtService';
import type { StudentAttemptSummary } from '../../types/cbt';
import type { SharePayload } from '../../types/engagement';
import { ShareDialog, buildTestResultSharePayload } from '../../components/social/ShareDialog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

export function ResultsPage() {
  const { user } = useAuth();
  const { isOnline, isSyncing, pendingActions, syncNow } = useOfflineSync();
  const [attempts, setAttempts] = useState<StudentAttemptSummary[]>([]);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pendingTests = pendingActions.filter((a) => a.kind === 'test_submission');

  const loadResults = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const res = await fetchStudentAttempts(user.id);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setAttempts(res.attempts);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  if (loading) return <LoadingState message="Loading your test results..." />;
  if (error) return <ErrorState message={error} onRetry={() => void loadResults()} />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Test Results</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your submitted practice test scores and answer reviews.
        </p>
      </div>

      {pendingTests.length > 0 && (
        <Card
          padding="md"
          className="border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/35 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CloudUpload
                className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {pendingTests.length} offline{' '}
                  {pendingTests.length === 1 ? 'test awaiting sync & grading' : 'tests awaiting sync & grading'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Your answers are saved safely on this device and will be graded once uploaded.
                </p>
              </div>
            </div>
            {isOnline && (
              <Button
                variant="secondary"
                loading={isSyncing}
                onClick={async () => {
                  await syncNow();
                  await loadResults();
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Sync &amp; Grade Now</span>
              </Button>
            )}
          </div>
          <ul className="divide-y divide-amber-200/70 dark:divide-amber-900/50 text-xs">
            {pendingTests.map((act) => (
              <li key={act.id} className="py-1.5 flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {act.payload.testTitle}
                </span>
                <span className="text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
                  {act.payload.answeredCount}/{act.payload.totalQuestions} answered · Queued
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {attempts.length === 0 ? (
        <EmptyState
          title="No graded test attempts yet"
          description="Open a lesson or topic with an attached practice test to submit your first attempt and view your score here."
          action={
            <Link
              to="/app/subjects"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Browse Subjects
            </Link>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {attempts.map((attempt) => {
              const dateLabel = new Date(attempt.submitted_at).toLocaleDateString('en-NG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              return (
                <li
                  key={attempt.id}
                  className="flex items-center justify-between gap-2 px-5 py-4 min-h-[64px] hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <Link
                    to={`/app/results/${attempt.id}`}
                    className="flex-1 flex items-center justify-between gap-4 min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {attempt.test_title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {dateLabel} · Score {attempt.score} / {attempt.total_points}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-bold text-phosters-700 dark:text-phosters-400 tabular-nums">
                        {Math.round(attempt.percentage)}%
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Share ${attempt.test_title} result`}
                    onClick={() =>
                      setSharePayload(
                        buildTestResultSharePayload({
                          testTitle: attempt.test_title,
                          percentage: attempt.percentage,
                          score: attempt.score,
                          totalPoints: attempt.total_points,
                        })
                      )
                    }
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-phosters-700 dark:hover:text-phosters-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ShareDialog
        open={Boolean(sharePayload)}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
}
