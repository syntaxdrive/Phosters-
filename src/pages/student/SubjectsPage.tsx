import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui/States';

export function SubjectsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subjects</h1>
        <p className="text-sm text-slate-600">
          JAMB UTME and UI Post-UTME subject browsing and lessons.
        </p>
      </div>

      <EmptyState
        title="Subject selection arrives in Phase 2"
        description="Once the Phase 1 authentication and profile foundation is verified, Phase 2 will enable examination selection, separate JAMB UTME and UI Post-UTME subject combinations, and lesson browsing."
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
