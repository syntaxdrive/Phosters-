import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchStudentAttempts } from '../../services/cbtService';
import type { StudentAttemptSummary } from '../../types/cbt';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

export function ResultsPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<StudentAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      {attempts.length === 0 ? (
        <EmptyState
          title="No test attempts yet"
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
                <li key={attempt.id}>
                  <Link
                    to={`/app/results/${attempt.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 min-h-[64px] hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
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
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
