import { Link, useSearchParams } from 'react-router-dom';
import { Award, BookOpen, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';

function clampParam(value: string | null, maxLen = 80): string {
  if (!value) return '';
  return value.trim().slice(0, maxLen);
}

export function ShareLandingPage() {
  const [searchParams] = useSearchParams();
  const { user, isConfigured } = useAuth();

  const kind = clampParam(searchParams.get('kind'), 20) || 'course';
  const exam = clampParam(searchParams.get('exam'), 60) || 'JAMB UTME & UI Post-UTME';
  const subject = clampParam(searchParams.get('subject'), 80);
  const title = clampParam(searchParams.get('title'), 100);
  const pct = clampParam(searchParams.get('pct'), 10);
  const score = clampParam(searchParams.get('score'), 10);
  const total = clampParam(searchParams.get('total'), 10);
  const examSlug = clampParam(searchParams.get('examSlug'), 60);
  const subjectSlug = clampParam(searchParams.get('subjectSlug'), 60);

  const isTestShare = kind === 'test';
  const openCoursePath =
    examSlug && subjectSlug
      ? `/app/subjects/${encodeURIComponent(examSlug)}/${encodeURIComponent(subjectSlug)}`
      : '/app/subjects';

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-6">
      <Card padding="lg" className="space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0">
            {isTestShare ? (
              <Award className="h-5 w-5" aria-hidden="true" />
            ) : (
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-phosters-700 dark:text-phosters-400">
              Phosters Academy · {exam}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {isTestShare
                ? `Free ${exam} CBT Practice Result`
                : subject
                  ? `Study ${subject} for ${exam} for Free`
                  : `Free ${exam} Study Platform`}
            </h1>
          </div>
        </div>

        {isTestShare ? (
          <div className="rounded-xl border border-phosters-200 dark:border-phosters-800 bg-phosters-50/60 dark:bg-phosters-900/30 p-4 space-y-2">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              &ldquo;I just took a free <strong>{exam}</strong>
              {subject ? ` (${subject})` : ''} test
              {title ? ` — ${title}` : ''} on Phosters Academy for free!&rdquo;
            </p>
            {pct && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm font-bold text-phosters-800 dark:text-phosters-300 tabular-nums">
                <span>Score: {pct}%</span>
                {score && total && (
                  <span>
                    ({score} / {total} points)
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-2">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {title
                ? `Check out "${title}" in ${subject || exam} on Phosters Academy.`
                : `Prepare for ${exam}${subject ? ` (${subject})` : ''} with organised video lessons, downloadable PDF notes, and instant CBT practice tests — completely free.`}
            </p>
          </div>
        )}

        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-phosters-600 dark:text-phosters-400 shrink-0" aria-hidden="true" />
            <span>Free JAMB UTME &amp; UI Post-UTME practice tests with instant grading</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-phosters-600 dark:text-phosters-400 shrink-0" aria-hidden="true" />
            <span>Structured syllabus topics, video lectures &amp; study notes</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-phosters-600 dark:text-phosters-400 shrink-0" aria-hidden="true" />
            <span>Installable as a mobile app with offline study support</span>
          </li>
        </ul>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {user ? (
            <>
              <Link
                to={openCoursePath}
                className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
              >
                {isTestShare ? 'Browse Practice Tests' : 'Open Courses in App'}
              </Link>
              <Link
                to="/app"
                className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Go to Dashboard
              </Link>
            </>
          ) : isConfigured ? (
            <>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
              >
                Take Free Tests &amp; Lessons — Sign Up
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Sign In
              </Link>
            </>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Visit Phosters Academy
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
