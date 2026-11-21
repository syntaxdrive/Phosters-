import { Database, KeyRound } from 'lucide-react';
import { Alert } from './Alert';
import { Card } from './Card';

interface SetupRequiredNoticeProps {
  reason: string | null;
}

export function SetupRequiredNotice({ reason }: SetupRequiredNoticeProps) {
  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10">
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-600 dark:text-phosters-400 shrink-0">
            <Database className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Connect Supabase to activate Phosters
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Authentication and student profiles require a live Supabase project. Phosters never uses fake login or placeholder accounts.
            </p>
          </div>
        </div>

        {reason && (
          <Alert tone="warning" title="Configuration needed" className="mt-5">
            {reason}
          </Alert>
        )}

        <div className="mt-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
            <span>Required setup steps</span>
          </h2>
          <ol className="list-decimal pl-5 space-y-2.5 leading-relaxed">
            <li>
              Create a project at Supabase and copy your <strong>Project URL</strong> and{' '}
              <strong>anon / publishable key</strong> from Project Settings → API.
            </li>
            <li>
              Add these environment variables in your <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">.env</code> file (or deployment environment settings):
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-800 text-slate-100 p-3 text-xs font-mono">
{`VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY`}
              </pre>
            </li>
            <li>
              Open the Supabase SQL Editor and run <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">supabase/migrations/001_phase1_profiles_and_auth.sql</code> to create the <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">profiles</code> table, signup trigger, and RLS policies.
            </li>
            <li>
              Restart the development server after updating your environment variables.
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
