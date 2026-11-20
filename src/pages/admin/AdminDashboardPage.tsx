import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';

export function AdminDashboardPage() {
  const { user, profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Admin Dashboard
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>Signed in as {profile?.full_name}</span>
          <span aria-hidden="true">·</span>
          <span>{user?.email}</span>
        </div>
      </div>

      <Alert tone="success" title="Protected administrator session verified">
        Your account holds the <code className="font-mono text-xs bg-phosters-100 px-1 py-0.5 rounded">admin</code> role in Supabase. Student accounts are blocked from this route and from admin database policies.
      </Alert>

      <Card padding="lg" className="space-y-3">
        <div className="h-10 w-10 rounded-lg bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-700">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-slate-900">
          Phase 1 Foundation Complete
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
          Content management tools for examinations, subjects, topics, lessons, YouTube links, GitHub raw materials (Phase 3), and tests (Phase 4) will be added to this protected workspace next.
        </p>
        <div className="pt-2">
          <Link
            to="/app"
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Switch to Student View
          </Link>
        </div>
      </Card>
    </div>
  );
}
