import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Shield, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';

export function HomePage() {
  const { user, profile } = useAuth();
  const displayName = profile?.full_name || 'Student';
  const roleLabel = profile?.role === 'admin' ? 'Administrator' : 'Student';

  return (
    <div className="space-y-6">
      <section className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Welcome, {displayName}
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>{roleLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{user?.email}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card padding="md" className="flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-700">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Examination profiles &amp; subjects
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your account is active. Examination selection (JAMB UTME and UI Post-UTME), subject combinations, and published lessons will appear here in Phase 2.
            </p>
          </div>
          <div>
            <Link
              to="/app/subjects"
              className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-phosters-700 hover:text-phosters-800 hover:underline"
            >
              <span>Open Subjects</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card padding="md" className="flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <User className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Your student profile
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Review your account details, update your display name or phone number, or manage your session.
            </p>
          </div>
          <div>
            <Link
              to="/app/profile"
              className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-phosters-700 hover:text-phosters-800 hover:underline"
            >
              <span>Manage Profile</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </div>

      {profile?.role === 'admin' && (
        <Card padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-700 shrink-0">
              <Shield className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Administrator access enabled</h2>
              <p className="text-sm text-slate-600">
                Your profile has administrator permissions. Open the protected admin area to review system status.
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
          >
            Open Admin Area
          </Link>
        </Card>
      )}
    </div>
  );
}
