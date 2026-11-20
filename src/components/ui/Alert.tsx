import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type AlertTone = 'info' | 'success' | 'error' | 'warning';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

const toneStyles: Record<AlertTone, { container: string; icon: string }> = {
  info: {
    container: 'bg-slate-50 border-slate-200 text-slate-800',
    icon: 'text-slate-600',
  },
  success: {
    container: 'bg-phosters-50 border-phosters-200 text-phosters-900',
    icon: 'text-phosters-600',
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-900',
    icon: 'text-red-600',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-950',
    icon: 'text-amber-700',
  },
};

export function Alert({ tone = 'info', title, children, className = '' }: AlertProps) {
  const styles = toneStyles[tone];
  const Icon =
    tone === 'success' ? CheckCircle2 : tone === 'error' || tone === 'warning' ? AlertCircle : Info;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={[
        'flex items-start gap-3 rounded-xl border p-4 text-sm',
        styles.container,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${styles.icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
