import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, RefreshCw, Search, ShieldCheck, UserCheck, UserMinus } from 'lucide-react';
import {
  fetchManagedAccounts,
  setManagedAccountRole,
  type ManagedAccountRow,
} from '../../services/superAdminService';
import type { UserRole } from '../../types/database';
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
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [confirmDemoteId, setConfirmDemoteId] = useState<string | null>(null);
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
    setAccounts(res.accounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

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
      const haystack = [acc.fullName, acc.email ?? '', acc.phone ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [accounts, roleFilter, searchQuery]);

  async function handleRoleChange(account: ManagedAccountRow, nextRole: UserRole) {
    setNotice(null);
    setConfirmDemoteId(null);
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
        row.userId === account.userId ? { ...row, role: res.role! } : row
      )
    );

    setNotice({
      tone: 'success',
      message:
        res.role === 'admin'
          ? `${account.fullName} (${account.email || 'account'}) has been upgraded to Tutor / Admin access.`
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
            <span>Upgrade registered users to Tutor accounts without SQL</span>
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
                  placeholder="Search by name, email, or phone..."
                  aria-label="Search accounts by name, email, or phone"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-phosters-600"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ask new tutors to register normally through <code className="font-mono">/signup</code>, then click <strong>Upgrade to Tutor</strong> beside their account below. Upgraded tutors immediately gain access to <code className="font-mono">/admin</code>, while only the Super Admin can manage roles.
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

                  return (
                    <div
                      key={acc.userId}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
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
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
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
                          <Button
                            type="button"
                            variant="secondary"
                            loading={isBusy}
                            onClick={() => setConfirmDemoteId(acc.userId)}
                          >
                            <UserMinus className="h-4 w-4" aria-hidden="true" />
                            <span>Revert to Student</span>
                          </Button>
                        )}
                      </div>
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
