import type { ReactNode } from 'react';
import { AlertCircle, BookOpen, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div
        aria-hidden="true"
        className="h-7 w-7 rounded-full border-2 border-phosters-600 border-t-transparent animate-spin"
      />
      <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <Card className="max-w-lg mx-auto text-center">
      <div className="flex flex-col items-center">
        <div className="h-11 w-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{message}</p>
        {onRetry && (
          <div className="mt-5">
            <Button variant="secondary" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{retryLabel}</span>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="text-center">
      <div className="flex flex-col items-center py-4">
        <div className="h-11 w-11 rounded-xl bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-600">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1.5 max-w-md text-sm text-slate-600 leading-relaxed">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </Card>
  );
}
