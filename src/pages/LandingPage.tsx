import { Link, Navigate } from 'react-router-dom';
import { BookOpen, CheckSquare, FileDown, PlayCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { LoadingState } from '../components/ui/States';

const studyPillars = [
  {
    icon: PlayCircle,
    title: 'Focused video lessons',
    description:
      'Follow topics arranged in clear order for JAMB UTME and University of Ibadan Post-UTME without distractions.',
  },
  {
    icon: FileDown,
    title: 'Direct study notes',
    description:
      'Open or download lesson notes and practice handouts directly on your phone with low data overhead.',
  },
  {
    icon: CheckSquare,
    title: 'Integrated practice tests',
    description:
      'Answer multiple-choice questions inside Phosters and review your graded score immediately after submission.',
  },
];

export function LandingPage() {
  const { isConfigured, loading, user } = useAuth();

  if (loading) {
    return <LoadingState message="Loading Phosters..." />;
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="space-y-10 sm:space-y-12 py-2 sm:py-6">
      {!isConfigured && (
        <Alert tone="warning" title="Supabase setup required">
          Authentication is paused until{' '}
          <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code>{' '}
          and{' '}
          <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>{' '}
          are configured.{' '}
          <Link to="/setup" className="font-semibold underline hover:text-amber-900">
            View setup instructions
          </Link>
        </Alert>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
          <p className="text-sm font-medium text-phosters-700">
            Phosters Tutorial Centre · JAMB UTME &amp; UI Post-UTME
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Structured exam preparation built for mobile study
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
            Study your exact JAMB UTME and University of Ibadan Post-UTME subject combinations with organised video lessons, downloadable notes, and practice tests.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            {isConfigured ? (
              <>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg bg-phosters-600 text-white text-base font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap"
                >
                  Create Student Account
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-base font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  Sign In
                </Link>
              </>
            ) : (
              <Link
                to="/setup"
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg bg-phosters-600 text-white text-base font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap"
              >
                Open Supabase Setup Guide
              </Link>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 flex">
          <Card padding="lg" className="w-full flex flex-col justify-between bg-white">
            <div className="space-y-4">
              <div className="h-10 w-10 rounded-lg bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-700">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Two examinations, separate subject plans
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Prepare for JAMB UTME, UI Post-UTME, or both. Your subject choices for each examination are stored independently so you always see the right lessons.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2.5 text-sm">
              <div className="flex items-center justify-between py-1">
                <span className="font-medium text-slate-900">JAMB UTME</span>
                <span className="text-slate-500">English + 3 selected subjects</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="font-medium text-slate-900">UI Post-UTME</span>
                <span className="text-slate-500">Course-specific combination</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section aria-labelledby="pillars-heading" className="space-y-4">
        <h2 id="pillars-heading" className="text-lg font-bold text-slate-900">
          What is inside Phosters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {studyPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Card key={pillar.title} padding="md">
                <div className="h-9 w-9 rounded-lg bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-700">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {pillar.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {pillar.description}
                </p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
