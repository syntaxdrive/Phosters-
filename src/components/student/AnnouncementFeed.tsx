import { useState } from 'react';
import { ExternalLink, Megaphone, Pin } from 'lucide-react';
import type { AnnouncementFeedItem } from '../../types/announcement';
import { Card } from '../ui/Card';

type AnnouncementFeedProps = {
  items: AnnouncementFeedItem[];
  heading?: string;
  initialVisibleCount?: number;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AnnouncementFeed({
  items,
  heading = 'Announcements',
  initialVisibleCount = 2,
}: AnnouncementFeedProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const visibleItems = expanded ? items : items.slice(0, initialVisibleCount);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <section aria-labelledby="announcements-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-phosters-700 dark:text-phosters-400" aria-hidden="true" />
          <h2 id="announcements-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
            {heading}
          </h2>
        </div>

        {items.length > initialVisibleCount && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-semibold text-phosters-700 dark:text-phosters-400 hover:underline cursor-pointer min-h-[36px] px-1"
          >
            {expanded ? 'Show fewer' : `Show all (${items.length})`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {visibleItems.map((item) => (
          <Card
            key={item.id}
            padding="md"
            className={
              item.is_pinned
                ? 'border-phosters-300 dark:border-phosters-700 bg-phosters-50/40 dark:bg-phosters-900/30'
                : undefined
            }
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                {item.is_pinned && (
                  <>
                    <span className="inline-flex items-center gap-1 font-semibold text-phosters-800 dark:text-phosters-300">
                      <Pin className="h-3 w-3" aria-hidden="true" />
                      <span>Pinned</span>
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="font-medium text-phosters-700 dark:text-phosters-400">{item.audienceLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDate(item.created_at)}</span>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {item.title}
              </h3>

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {item.message}
              </p>

              {item.links.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-2">
                  {item.links.map((lnk) => (
                    <a
                      key={lnk.id}
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold text-phosters-700 dark:text-phosters-300 hover:border-phosters-600 dark:hover:border-phosters-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span>{lnk.title}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs font-semibold text-phosters-700 dark:text-phosters-400 hover:underline cursor-pointer"
        >
          View {hiddenCount} earlier {hiddenCount === 1 ? 'announcement' : 'announcements'}
        </button>
      )}
    </section>
  );
}
