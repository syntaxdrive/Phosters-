import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderGit2, PlayCircle, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdminUser } from '../../lib/superAdmin';
import { fetchAdminOverviewCounts } from '../../services/adminService';
import type { AdminOverviewCounts } from '../../types/admin';
import { AdminNav } from '../../components/admin/AdminNav';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function AdminDashboardPage() {
  const { user, profile } = useAuth();
  const isSuperAdmin = isSuperAdminUser(user?.email, profile?.role);
  const [counts, setCounts] = useState<AdminOverviewCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAdminOverviewCounts();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setCounts(res.counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Admin Workspace
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500 dark:text-slate-400">
            <span>{profile?.full_name}</span>
            <span aria-hidden="true">·</span>
            <span>{user?.email}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link
            to="/admin/guide"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <PlayCircle className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
            <span>Watch Tutor Guide</span>
          </Link>
          <Link
            to="/admin/lessons/new"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Lesson</span>
          </Link>
        </div>
      </div>

      <AdminNav />

      {loading ? (
        <LoadingState message="Loading real database counts..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadCounts()} />
      ) : counts ? (
        <section aria-label="Database counts" className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { label: 'Examinations', value: counts.examsCount, to: '/admin/examinations' },
            { label: 'Subjects', value: counts.subjectsCount, to: '/admin/subjects' },
            { label: 'Topics', value: counts.topicsCount, to: '/admin/topics' },
            { label: 'Published Lessons', value: counts.publishedLessonsCount, to: '/admin/lessons' },
            { label: 'Draft Lessons', value: counts.draftLessonsCount, to: '/admin/lessons' },
            { label: 'Students', value: counts.studentsCount, to: '/admin/students' },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-phosters-600 dark:hover:border-phosters-500 transition-colors"
            >
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {item.value}
              </p>
            </Link>
          ))}
        </section>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Content workflow</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>Configure active examinations and their allowed subjects.</li>
            <li>Organise each examination and subject into ordered topics.</li>
            <li>Create lessons with YouTube video links and downloadable notes.</li>
            <li>Publish topics and lessons when ready for students.</li>
          </ol>
          <div className="pt-1 flex flex-wrap gap-3">
            <Link
              to="/admin/topics"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Manage Topics</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/admin/lessons"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Manage Lessons</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/admin/tests"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Manage Tests</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/admin/students"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Student Statistics</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/admin/announcements"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Broadcast Announcements</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {isSuperAdmin && (
              <>
                <Link
                  to="/admin/question-bank"
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-phosters-200 dark:border-phosters-800 bg-phosters-50/70 dark:bg-phosters-950/40 text-sm font-semibold text-phosters-800 dark:text-phosters-300 hover:bg-phosters-100/70 dark:hover:bg-phosters-900/50 transition-colors"
                >
                  <span>Question Bank</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/admin/accounts"
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-phosters-200 dark:border-phosters-800 bg-phosters-50/70 dark:bg-phosters-950/40 text-sm font-semibold text-phosters-800 dark:text-phosters-300 hover:bg-phosters-100/70 dark:hover:bg-phosters-900/50 transition-colors"
                >
                  <span>Upgrade Tutor Accounts</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </Card>

        <Card padding="lg" className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 dark:bg-phosters-950/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0">
              <FolderGit2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Study materials storage policy
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Upload public study PDFs and handouts to the single Phosters-owned central GitHub materials repository, then paste each file&apos;s direct <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">https://raw.githubusercontent.com/...</code> URL into the Lesson Editor.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Repository collaborator permissions must be configured by the Phosters repository owner following least privilege. Never commit student data, private files, or secrets to the public materials repository.
          </p>
        </Card>
      </div>
    </div>
  );
}
