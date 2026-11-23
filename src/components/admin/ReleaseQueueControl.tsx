import { CalendarClock, CheckCircle2, Clock3, FileEdit } from 'lucide-react';
import type { ReleaseStatus } from '../../types/database';

interface ReleaseQueueControlProps {
  releaseStatus: ReleaseStatus;
  scheduledReleaseLocal: string;
  onChangeStatus: (next: ReleaseStatus) => void;
  onChangeSchedule: (nextLocal: string) => void;
  entityLabel: 'test' | 'mock exam';
  disabled?: boolean;
}

const OPTIONS: Array<{
  value: ReleaseStatus;
  title: string;
  description: string;
}> = [
  {
    value: 'draft',
    title: 'Draft',
    description: 'Work in progress · hidden from students',
  },
  {
    value: 'queued',
    title: 'Queue (Awaiting Release)',
    description: 'Prepared ahead of time · release manually or on schedule',
  },
  {
    value: 'published',
    title: 'Publish Now',
    description: 'Live immediately for enrolled students',
  },
];

export function ReleaseQueueControl({
  releaseStatus,
  scheduledReleaseLocal,
  onChangeStatus,
  onChangeSchedule,
  entityLabel,
  disabled = false,
}: ReleaseQueueControlProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Release status &amp; queue
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Prepare this {entityLabel} now and keep it queued until you click Release Now, or schedule automatic release.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {OPTIONS.map((opt) => {
          const selected = releaseStatus === opt.value;
          const Icon =
            opt.value === 'published'
              ? CheckCircle2
              : opt.value === 'queued'
                ? Clock3
                : FileEdit;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChangeStatus(opt.value)}
              className={[
                'text-left rounded-lg border p-3 transition-colors min-h-[44px] cursor-pointer disabled:opacity-50',
                selected
                  ? 'border-phosters-600 bg-white dark:bg-slate-900 ring-2 ring-phosters-600/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={[
                    'h-4 w-4 shrink-0',
                    selected
                      ? 'text-phosters-600 dark:text-phosters-400'
                      : 'text-slate-400 dark:text-slate-500',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {opt.title}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-snug">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      {releaseStatus === 'queued' && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex-1 space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <CalendarClock className="h-3.5 w-3.5 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
                <span>Scheduled auto-release date &amp; time (optional)</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledReleaseLocal}
                disabled={disabled}
                onChange={(e) => onChangeSchedule(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
              />
            </div>

            {scheduledReleaseLocal && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChangeSchedule('')}
                className="min-h-[44px] px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Hold for Manual Release
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {scheduledReleaseLocal
              ? `Students will automatically unlock this ${entityLabel} at the scheduled time, or sooner if you click Release Now.`
              : `No date set — this ${entityLabel} stays hidden in your Release Queue until you click Release Now.`}
          </p>
        </div>
      )}
    </div>
  );
}
