import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui/States';

export function ResultsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Test Results</h1>
        <p className="text-sm text-slate-600">
          Your submitted practice test scores and answer reviews.
        </p>
      </div>

      <EmptyState
        title="No test results yet"
        description="Multiple-choice tests and graded attempt history will be added in Phase 4 after the student lesson experience and admin content tools are in place."
        action={
          <Link
            to="/app"
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Back to Home
          </Link>
        }
      />
    </div>
  );
}
