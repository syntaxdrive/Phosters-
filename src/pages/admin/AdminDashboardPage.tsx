import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderGit2, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAdminOverviewCounts } from '../../services/adminService';
import type { AdminOverviewCounts } from '../../types/admin';
import { AdminNav } from '../../components/admin/AdminNav';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function AdminDashboardPage() {
  const { user, profile } = useAuth();
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Admin Workspace
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
            <span>{profile?.full_name}</span>
            <span aria-hidden="true">·</span>
            <span>{user?.email}</span>
          </div>
        </div>

        <Link
          to="/admin/lessons/new"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New Lesson</span>
        </Link>
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
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-phosters-600 transition-colors"
            >
              <p className="text-xs font-medium text-slate-500">{item.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
                {item.value}
              </p>
            </Link>
          ))}
        </section>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Content workflow</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
            <li>Configure active examinations and their allowed subjects.</li>
            <li>Organise each examination and subject into ordered topics.</li>
            <li>Create lessons with YouTube video links and downloadable notes.</li>
            <li>Publish topics and lessons when ready for students.</li>
          </ol>
          <div className="pt-1 flex flex-wrap gap-3">
            <Link
              to="/admin/topics"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <span>Manage Topics</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/admin/lessons"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <span>Manage Lessons</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/admin/tests"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <span>Manage Tests</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/admin/students"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <span>Student Statistics</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card padding="lg" className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-700 shrink-0">
              <FolderGit2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Study materials storage policy
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Upload public study PDFs and handouts to the single Phosters-owned central GitHub materials repository, then paste each file&apos;s direct <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">https://raw.githubusercontent.com/...</code> URL into the Lesson Editor.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Repository collaborator permissions must be configured by the Phosters repository owner following least privilege. Never commit student data, private files, or secrets to the public materials repository.
          </p>
        </Card>
      </div>
    </div>
  );
}
