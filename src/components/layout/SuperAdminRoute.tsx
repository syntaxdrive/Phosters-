import { Link, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdminUser, SUPER_ADMIN_EMAIL } from '../../lib/superAdmin';
import { Card } from '../ui/Card';
import { LoadingState } from '../ui/States';

export function SuperAdminRoute() {
  const { user, profile, profileLoading } = useAuth();

  if (profileLoading && !profile) {
    return <LoadingState message="Verifying Super Administrator access..." />;
  }

  if (!isSuperAdminUser(user?.email, profile?.role)) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <Card className="text-center" padding="lg">
          <div className="flex flex-col items-center">
            <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
              Super Administrator access required
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Upgrading user accounts to Tutor/Admin access is restricted strictly to the Super Administrator account (
              <span className="font-mono text-xs">{SUPER_ADMIN_EMAIL}</span>).
            </p>
            <div className="mt-6">
              <Link
                to="/admin"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
              >
                Return to Admin Overview
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
