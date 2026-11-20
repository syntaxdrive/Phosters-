import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import {
  deleteTest,
  fetchAdminTestsList,
  updateTestPublished,
} from '../../services/cbtService';
import type { AdminTestListItem } from '../../types/cbt';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

export function AdminTestsPage() {
  const [tests, setTests] = useState<AdminTestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAdminTestsList();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setTests(res.tests);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  async function handleTogglePublish(item: AdminTestListItem) {
    setActionError(null);
    const res = await updateTestPublished(item.id, !item.is_published);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await loadTests();
  }

  async function handleDelete(testId: string) {
    setActionError(null);
    const res = await deleteTest(testId);
    setConfirmDeleteId(null);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await loadTests();
  }

  if (loading) return <LoadingState message="Loading tests..." />;
  if (error) return <ErrorState message={error} onRetry={() => void loadTests()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tests</h1>
          <p className="text-sm text-slate-600">
            Create multiple-choice tests, manage answer keys, and attach them to lessons or topics.
          </p>
        </div>

        <Link
          to="/admin/tests/new"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Create Test</span>
        </Link>
      </div>

      <AdminNav />

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {tests.length === 0 ? (
        <EmptyState
          title="No tests created yet"
          description="Create a multiple-choice test and attach it to any lesson or topic for students to take inside Phosters."
          action={
            <Link
              to="/admin/tests/new"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Create First Test
            </Link>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {tests.map((t) => {
              const isConfirming = confirmDeleteId === t.id;
              return (
                <li key={t.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-base font-semibold text-slate-900">{t.title}</p>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span>{t.targetLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {t.questionCount}{' '}
                          {t.questionCount === 1 ? 'question' : 'questions'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.show_explanations_after_submission
                            ? 'Answer review enabled'
                            : 'Score only'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            t.is_published
                              ? 'font-medium text-phosters-700'
                              : 'font-medium text-amber-700'
                          }
                        >
                          {t.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        onClick={() => void handleTogglePublish(t)}
                      >
                        {t.is_published ? 'Unpublish' : 'Publish'}
                      </Button>

                      <Link
                        to={`/admin/tests/${t.id}`}
                        className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </Link>

                      <button
                        type="button"
                        aria-label={`Delete ${t.title}`}
                        onClick={() =>
                          setConfirmDeleteId(isConfirming ? null : t.id)
                        }
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {isConfirming && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900">
                      <span>Delete this test and all its questions?</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void handleDelete(t.id)}
                        >
                          Delete Test
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
