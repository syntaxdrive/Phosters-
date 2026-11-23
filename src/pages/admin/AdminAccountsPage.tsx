import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserMinus,
} from 'lucide-react';
import {
  fetchManagedAccounts,
  setManagedAccountRole,
  setTutorAssignedSubjects,
  type ManagedAccountRow,
} from '../../services/superAdminService';
import type { Subject, UserRole } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

type RoleFilter = 'all' | 'admin' | 'student';

function formatShortDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<ManagedAccountRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [assignmentsMigrationMissing, setAssignmentsMigrationMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [confirmDemoteId, setConfirmDemoteId] = useState<string | null>(null);

  // Subject assignment editor state
  const [editingSubjectsUserId, setEditingSubjectsUserId] = useState<string | null>(null);
  const [draftSubjectIds, setDraftSubjectIds] = useState<string[]>([]);
  const [savingSubjects, setSavingSubjects] = useState(false);

  const [notice, setNotice] = useState<{
    tone: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchManagedAccounts();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setMigrationMissing(res.migrationMissing);
    setAssignmentsMigrationMissing(res.assignmentsMigrationMissing);
    setAccounts(res.accounts);
    setSubjects(res.subjects);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const counts = useMemo(() => {
    const tutorsCount = accounts.filter((a) => a.role === 'admin').length;
    const studentsCount = accounts.filter((a) => a.role === 'student').length;
    return {
      total: accounts.length,
      tutors: tutorsCount,
      students: studentsCount,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (roleFilter !== 'all' && acc.role !== roleFilter) {
        return false;
      }
      if (!q) return true;
      const assignedNames = acc.assignedSubjectIds
        .map((id) => subjectMap.get(id)?.name ?? '')
        .join(' ');
      const haystack = [acc.fullName, acc.email ?? '', acc.phone ?? '', assignedNames]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [accounts, roleFilter, searchQuery, subjectMap]);

  function openSubjectEditor(account: ManagedAccountRow) {
    setNotice(null);
    setConfirmDemoteId(null);
    if (editingSubjectsUserId === account.userId) {
      setEditingSubjectsUserId(null);
      return;
    }
    setEditingSubjectsUserId(account.userId);
    setDraftSubjectIds(account.assignedSubjectIds);
  }

  function toggleDraftSubject(subjectId: string) {
    setDraftSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  }

  async function handleSaveSubjects(account: ManagedAccountRow) {
    setNotice(null);
    setSavingSubjects(true);
    const res = await setTutorAssignedSubjects(account.userId, draftSubjectIds);
    setSavingSubjects(false);

    if (res.error || !res.assignedSubjectIds) {
      setNotice({
        tone: 'error',
        message: res.error || 'Could not save tutor subject assignments.',
      });
      return;
    }

    setAccounts((prev) =>
      prev.map((row) =>
        row.userId === account.userId
          ? { ...row, assignedSubjectIds: res.assignedSubjectIds! }
          : row
      )
    );
    setEditingSubjectsUserId(null);

    const assignedNames = res.assignedSubjectIds
      .map((id) => subjectMap.get(id)?.name)
      .filter(Boolean);

    setNotice({
      tone: 'success',
      message:
        assignedNames.length > 0
          ? `Assigned ${assignedNames.join(', ')} to ${account.fullName}.`
          : `Cleared all subject assignments for ${account.fullName}.`,
    });
  }

  async function handleRoleChange(account: ManagedAccountRow, nextRole: UserRole) {
    setNotice(null);
    setConfirmDemoteId(null);
    if (editingSubjectsUserId === account.userId) {
      setEditingSubjectsUserId(null);
    }
    setUpdatingUserId(account.userId);

    const res = await setManagedAccountRole(account.userId, nextRole);
    setUpdatingUserId(null);

    if (res.error || !res.role) {
      setNotice({
        tone: 'error',
        message: res.error || 'Could not update account role.',
      });
      return;
    }

    setAccounts((prev) =>
      prev.map((row) =>
        row.userId === account.userId
          ? {
              ...row,
              role: res.role!,
              assignedSubjectIds: res.role === 'student' ? [] : row.assignedSubjectIds,
            }
          : row
      )
    );

    if (res.role === 'admin' && !assignmentsMigrationMissing) {
      setEditingSubjectsUserId(account.userId);
      setDraftSubjectIds(account.assignedSubjectIds);
    }

    setNotice({
      tone: 'success',
      message:
        res.role === 'admin'
          ? `${account.fullName} (${account.email || 'account'}) has been upgraded to Tutor / Admin access. Select one or more subjects to assign below.`
          : `${account.fullName} (${account.email || 'account'}) has been returned to Student access.`,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tutor &amp; Account Access
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Super Admin control</span>
            <span aria-hidden="true">·</span>
            <span>Upgrade Tutors and assign one or multiple subjects per Tutor</span>
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={() => void loadAccounts()}
          className="self-start sm:self-auto"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Refresh Accounts</span>
        </Button>
      </div>

      <AdminNav />

      {loading ? (
        <LoadingState message="Loading registered accounts..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadAccounts()} />
      ) : migrationMissing ? (
        <Alert tone="info" title="One-time database migration required">
          Run{' '}
          <code className="font-mono text-xs bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            supabase/migrations/010_super_admin_role_management.sql
          </code>{' '}
          once in your Supabase SQL Editor. After this one-time script, you can upgrade any student account to a Tutor account directly from this page with zero SQL.
        </Alert>
      ) : (
        <>
          {assignmentsMigrationMissing && (
            <Alert tone="info" title="Run migrations 013a–013c for Tutor Subject Assignments">
              Run{' '}
              <code className="font-mono text-xs bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                013a_tutor_subject_assignments.sql
              </code>
              ,{' '}
              <code className="font-mono text-xs bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                013b_tutor_subject_rls_enforcement.sql
              </code>
              , and{' '}
              <code className="font-mono text-xs bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                013c_tutor_rls_tests_bank_and_mocks.sql
              </code>{' '}
              in order in Supabase SQL Editor to enable multi-subject Tutor assignment and database enforcement.
            </Alert>
          )}

          {/* Summary KPI strip */}
          <section
            aria-label="Account role counts"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <Card padding="md">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Registered Accounts
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {counts.total}
              </p>
            </Card>
            <Card padding="md">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tutors &amp; Admins
              </p>
              <p className="mt-1.5 text-2xl font-bold text-phosters-700 dark:text-phosters-400 tabular-nums">
                {counts.tutors}
              </p>
            </Card>
            <Card padding="md">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Student Accounts
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {counts.students}
              </p>
            </Card>
          </section>

          {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

          {/* Filter & Search Bar */}
          <Card padding="md" className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Filter accounts by role"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 self-start"
              >
                {(
                  [
                    { key: 'all', label: `All (${counts.total})` },
                    { key: 'admin', label: `Tutors (${counts.tutors})` },
                    { key: 'student', label: `Students (${counts.students})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={roleFilter === tab.key}
                    onClick={() => setRoleFilter(tab.key)}
                    className={[
                      'min-h-[38px] px-3 rounded-md text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 transition-colors cursor-pointer',
                      roleFilter === tab.key
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-80">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, phone, or subject..."
                  aria-label="Search accounts by name, email, phone, or subject"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-phosters-600"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ask new tutors to register normally through <code className="font-mono">/signup</code>, click <strong>Upgrade to Tutor</strong>, then click <strong>Assign Subjects</strong> to grant access to one or multiple subjects across Topics, Lessons, Tests, and Mock Exams.
            </p>
          </Card>

          {/* Accounts Directory */}
          {filteredAccounts.length === 0 ? (
            <EmptyState
              title="No matching accounts found"
              description="Try clearing your search or switching the role filter tab above."
            />
          ) : (
            <Card padding="sm">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAccounts.map((acc) => {
                  const isBusy = updatingUserId === acc.userId;
                  const isConfirmingDemote = confirmDemoteId === acc.userId;
                  const isEditingSubjects = editingSubjectsUserId === acc.userId;
                  const assignedNames = acc.assignedSubjectIds
                    .map((id) => subjectMap.get(id)?.name)
                    .filter((n): n is string => Boolean(n));

                  return (
                    <div key={acc.userId} className="p-4 space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {acc.fullName}
                            </span>
                            <span aria-hidden="true" className="text-slate-400">
                              ·
                            </span>
                            <span
                              className={[
                                'text-xs font-semibold inline-flex items-center gap-1',
                                acc.isSuperAdmin
                                  ? 'text-phosters-700 dark:text-phosters-400'
                                  : acc.role === 'admin'
                                    ? 'text-phosters-700 dark:text-phosters-400'
                                    : 'text-slate-600 dark:text-slate-400',
                              ].join(' ')}
                            >
                              {acc.isSuperAdmin && (
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              <span>
                                {acc.isSuperAdmin
                                  ? 'Super Admin'
                                  : acc.role === 'admin'
                                    ? 'Tutor / Admin'
                                    : 'Student'}
                              </span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {acc.email || 'No email'}
                            </span>
                            {acc.phone && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">{acc.phone}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              Joined {formatShortDate(acc.createdAt)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              Last sign-in {formatShortDate(acc.lastSignInAt)}
                            </span>
                          </div>

                          {acc.isSuperAdmin ? (
                            <p className="text-xs font-medium text-phosters-700 dark:text-phosters-400">
                              Assigned subjects: All subjects (unrestricted)
                            </p>
                          ) : acc.role === 'admin' ? (
                            <p className="text-xs">
                              <span className="text-slate-500 dark:text-slate-400">
                                Assigned subjects:{' '}
                              </span>
                              {assignmentsMigrationMissing ? (
                                <span className="text-slate-500 dark:text-slate-400">
                                  Pending migration 013a
                                </span>
                              ) : assignedNames.length > 0 ? (
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {assignedNames.join(' · ')}
                                </span>
                              ) : (
                                <span className="font-semibold text-amber-700 dark:text-amber-400">
                                  No subjects assigned yet
                                </span>
                              )}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {acc.isSuperAdmin ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-2 whitespace-nowrap">
                              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Protected</span>
                            </span>
                          ) : acc.role === 'student' ? (
                            <Button
                              type="button"
                              loading={isBusy}
                              onClick={() => void handleRoleChange(acc, 'admin')}
                            >
                              <UserCheck className="h-4 w-4" aria-hidden="true" />
                              <span>Upgrade to Tutor</span>
                            </Button>
                          ) : isConfirmingDemote ? (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="danger"
                                loading={isBusy}
                                onClick={() => void handleRoleChange(acc, 'student')}
                              >
                                Confirm Revert
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setConfirmDemoteId(null)}
                                disabled={isBusy}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant={isEditingSubjects ? 'primary' : 'secondary'}
                                disabled={assignmentsMigrationMissing || isBusy}
                                onClick={() => openSubjectEditor(acc)}
                              >
                                <BookOpen className="h-4 w-4" aria-hidden="true" />
                                <span>
                                  {isEditingSubjects ? 'Close Subjects' : 'Assign Subjects'}
                                </span>
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                loading={isBusy}
                                onClick={() => setConfirmDemoteId(acc.userId)}
                              >
                                <UserMinus className="h-4 w-4" aria-hidden="true" />
                                <span>Revert to Student</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditingSubjects && acc.role === 'admin' && !acc.isSuperAdmin && (
                        <div className="rounded-xl border border-phosters-200 dark:border-phosters-800/80 bg-phosters-50/40 dark:bg-phosters-950/30 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Assign subjects to {acc.fullName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                Select one or multiple subjects ({draftSubjectIds.length} selected)
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-semibold">
                              <button
                                type="button"
                                onClick={() => setDraftSubjectIds(subjects.map((s) => s.id))}
                                className="text-phosters-700 dark:text-phosters-400 hover:underline cursor-pointer"
                              >
                                Select All
                              </button>
                              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                                |
                              </span>
                              <button
                                type="button"
                                onClick={() => setDraftSubjectIds([])}
                                className="text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {subjects.map((subj) => {
                              const checked = draftSubjectIds.includes(subj.id);
                              return (
                                <label
                                  key={subj.id}
                                  className={[
                                    'flex items-center gap-2.5 min-h-[42px] px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors',
                                    checked
                                      ? 'bg-white dark:bg-slate-900 border-phosters-500 dark:border-phosters-500 text-slate-900 dark:text-slate-100 font-semibold'
                                      : 'bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700',
                                  ].join(' ')}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleDraftSubject(subj.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
                                  />
                                  <span className="truncate">{subj.name}</span>
                                </label>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={savingSubjects}
                              onClick={() => setEditingSubjectsUserId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              loading={savingSubjects}
                              onClick={() => void handleSaveSubjects(acc)}
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                              <span>Save Subject Assignments</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
