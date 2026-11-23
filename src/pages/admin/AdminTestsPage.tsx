import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Plus, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getReleaseStatusMeta } from '../../lib/releaseQueue';
import {
  deleteTest,
  fetchAdminTestsList,
  updateTestReleaseStatus,
} from '../../services/cbtService';
import { fetchMyTutorSubjectScope } from '../../services/tutorScopeService';
import type { AdminTestListItem } from '../../types/cbt';
import type { ReleaseStatus } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

type FilterTab = 'all' | ReleaseStatus;

export function AdminTestsPage() {
  const { user, profile } = useAuth();
  const [tests, setTests] = useState<AdminTestListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [releaseQueueMigrationMissing, setReleaseQueueMigrationMissing] = useState(false);
  const [noSubjectsAssigned, setNoSubjectsAssigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [res, scope] = await Promise.all([
      fetchAdminTestsList(),
      fetchMyTutorSubjectScope(user?.email, profile?.role),
    ]);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    const allowedSet =
      scope.assignedSubjectIds !== null ? new Set(scope.assignedSubjectIds) : null;
    const scopedTests = allowedSet
      ? res.tests.filter((t) => Boolean(t.subjectId && allowedSet.has(t.subjectId)))
      : res.tests;

    setReleaseQueueMigrationMissing(res.releaseQueueMigrationMissing);
    setNoSubjectsAssigned(!scope.isSuperAdmin && allowedSet !== null && allowedSet.size === 0);
    setTests(scopedTests);
    setLoading(false);
  }, [profile?.role, user?.email]);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  const counts = useMemo(() => {
    let queued = 0;
    let draft = 0;
    let published = 0;
    for (const t of tests) {
      if (t.release_status === 'queued') queued += 1;
      else if (t.release_status === 'published') published += 1;
      else draft += 1;
    }
    return { all: tests.length, queued, draft, published };
  }, [tests]);

  const filteredTests = useMemo(() => {
    if (statusFilter === 'all') return tests;
    return tests.filter((t) => t.release_status === statusFilter);
  }, [statusFilter, tests]);

  async function handleStatusTransition(
    item: AdminTestListItem,
    nextStatus: ReleaseStatus
  ) {
    setActionError(null);
    setActionNotice(null);
    setBusyId(item.id);
    const res = await updateTestReleaseStatus(
      item.id,
      nextStatus,
      nextStatus === 'queued' ? item.scheduled_release_at : null
    );
    setBusyId(null);

    if (res.releaseQueueMigrationMissing) {
      setReleaseQueueMigrationMissing(true);
    }
    if (res.error) {
      setActionError(res.error);
      return;
    }

    const label =
      nextStatus === 'published'
        ? `"${item.title}" is now released to students.`
        : nextStatus === 'queued'
          ? `"${item.title}" moved to the Release Queue.`
          : `"${item.title}" moved to Drafts.`;
    setActionNotice(label);
    await loadTests();
  }

  async function handleDelete(testId: string) {
    setActionError(null);
    setActionNotice(null);
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Tests</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Create multiple-choice tests, queue upcoming assessments awaiting release, and publish when ready.
          </p>
        </div>

        <Link
          to="/admin/tests/new"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Create Test</span>
        </Link>
      </div>

      <AdminNav />

      {releaseQueueMigrationMissing && (
        <Alert tone="info" title="Enable Release Queue &amp; Scheduled Release">
          Ask Super Admin to run{' '}
          <code className="font-mono text-xs">supabase/migrations/014a</code>,{' '}
          <code className="font-mono text-xs">014b</code>, and{' '}
          <code className="font-mono text-xs">014c</code> in the Supabase SQL Editor to queue or schedule tests and mock exams.
        </Alert>
      )}

      {noSubjectsAssigned && (
        <Alert tone="warning" title="No subjects assigned to your Tutor account">
          Ask Super Admin (<code className="font-mono text-xs">oyasordaniel@gmail.com</code>) to assign one or more subjects to your account before creating tests.
        </Alert>
      )}

      {actionError && <Alert tone="error">{actionError}</Alert>}
      {actionNotice && <Alert tone="success">{actionNotice}</Alert>}

      {tests.length > 0 && (
        <div
          role="tablist"
          aria-label="Filter tests by release status"
          className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800"
        >
          {(
            [
              { key: 'all', label: 'All Tests', count: counts.all },
              { key: 'queued', label: 'Queued (Awaiting Release)', count: counts.queued },
              { key: 'draft', label: 'Drafts', count: counts.draft },
              { key: 'published', label: 'Published', count: counts.published },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(tab.key)}
                className={[
                  'min-h-[42px] px-3.5 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer tabular-nums',
                  active
                    ? 'border-phosters-600 text-phosters-700 dark:text-phosters-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
                ].join(' ')}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>
      )}

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
      ) : filteredTests.length === 0 ? (
        <EmptyState
          title={`No ${statusFilter === 'queued' ? 'queued' : statusFilter} tests`}
          description={
            statusFilter === 'queued'
              ? 'Queue any draft test here or in the test editor when it is prepared and awaiting release.'
              : 'No tests currently match this filter.'
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTests.map((t) => {
              const isConfirming = confirmDeleteId === t.id;
              const isBusy = busyId === t.id;
              const meta = getReleaseStatusMeta(t);

              return (
                <li key={t.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
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
                        <span className={`font-semibold ${meta.toneClass}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {meta.status === 'draft' && (
                        <>
                          <Button
                            variant="secondary"
                            loading={isBusy}
                            onClick={() => void handleStatusTransition(t, 'queued')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <Clock3 className="h-4 w-4" aria-hidden="true" />
                            <span>Queue</span>
                          </Button>
                          <Button
                            variant="primary"
                            loading={isBusy}
                            onClick={() => void handleStatusTransition(t, 'published')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <Send className="h-4 w-4" aria-hidden="true" />
                            <span>Release Now</span>
                          </Button>
                        </>
                      )}

                      {meta.status === 'queued' && (
                        <>
                          <Button
                            variant="primary"
                            loading={isBusy}
                            onClick={() => void handleStatusTransition(t, 'published')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <Send className="h-4 w-4" aria-hidden="true" />
                            <span>Release Now</span>
                          </Button>
                          <Button
                            variant="secondary"
                            loading={isBusy}
                            onClick={() => void handleStatusTransition(t, 'draft')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <span>Move to Draft</span>
                          </Button>
                        </>
                      )}

                      {meta.status === 'published' && (
                        <Button
                          variant="secondary"
                          loading={isBusy}
                          onClick={() => void handleStatusTransition(t, 'draft')}
                          className="whitespace-nowrap shrink-0"
                        >
                          <span>Move to Draft</span>
                        </Button>
                      )}

                      <Link
                        to={`/admin/tests/${t.id}`}
                        className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        Edit
                      </Link>

                      <button
                        type="button"
                        aria-label={`Delete ${t.title}`}
                        onClick={() =>
                          setConfirmDeleteId(isConfirming ? null : t.id)
                        }
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {isConfirming && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/70 p-3 text-xs text-red-900 dark:text-red-200">
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
