import { Link, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../ui/Card';
import { LoadingState } from '../ui/States';

export function AdminRoute() {
  const { profile, profileLoading } = useAuth();

  if (profileLoading && !profile) {
    return <LoadingState message="Verifying administrator access..." />;
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto py-8">
        <Card className="text-center" padding="lg">
          <div className="flex flex-col items-center">
            <div className="h-11 w-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-slate-900">
              Administrator access required
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              This section is restricted to authorised Phosters administrators. Student accounts cannot access administrative tools.
            </p>
            <div className="mt-6">
              <Link
                to="/app"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
