import { Eye, Heart, MessageSquare, Share2 } from 'lucide-react';

interface EngagementBarProps {
  likesCount: number;
  likedByMe: boolean;
  viewsCount: number;
  commentsCount?: number;
  liking?: boolean;
  onToggleLike: () => void;
  onShare?: () => void;
  shareLabel?: string;
  compact?: boolean;
}

export function EngagementBar({
  likesCount,
  likedByMe,
  viewsCount,
  commentsCount,
  liking = false,
  onToggleLike,
  onShare,
  shareLabel = 'Share',
  compact = false,
}: EngagementBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleLike}
        disabled={liking}
        aria-pressed={likedByMe}
        aria-label={likedByMe ? 'Unlike' : 'Like'}
        className={[
          'inline-flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60',
          compact ? 'min-h-[38px] px-2.5' : 'min-h-[44px] px-3.5',
          likedByMe
            ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
        ].join(' ')}
      >
        <Heart
          className={`h-4 w-4 ${likedByMe ? 'fill-current' : ''}`}
          aria-hidden="true"
        />
        <span className="tabular-nums">{likesCount}</span>
        {!compact && <span>{likesCount === 1 ? 'Like' : 'Likes'}</span>}
      </button>

      <div
        className={[
          'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-300',
          compact ? 'min-h-[38px] px-2.5' : 'min-h-[44px] px-3.5',
        ].join(' ')}
      >
        <Eye className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <span className="tabular-nums">{viewsCount}</span>
        <span>{viewsCount === 1 ? 'view' : 'views'}</span>
      </div>

      {typeof commentsCount === 'number' && (
        <div
          className={[
            'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-300',
            compact ? 'min-h-[38px] px-2.5' : 'min-h-[44px] px-3.5',
          ].join(' ')}
        >
          <MessageSquare className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="tabular-nums">{commentsCount}</span>
          {!compact && (
            <span>{commentsCount === 1 ? 'comment' : 'comments'}</span>
          )}
        </div>
      )}

      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer',
            compact ? 'min-h-[38px] px-2.5' : 'min-h-[44px] px-3.5',
          ].join(' ')}
        >
          <Share2 className="h-4 w-4 text-phosters-700 dark:text-phosters-400" aria-hidden="true" />
          <span>{shareLabel}</span>
        </button>
      )}
    </div>
  );
}
