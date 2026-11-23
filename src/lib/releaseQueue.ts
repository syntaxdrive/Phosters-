import type { ReleaseStatus } from '../types/database';

export interface ReleaseTrackable {
  is_published?: boolean | null;
  release_status?: ReleaseStatus | string | null;
  scheduled_release_at?: string | null;
}

export function isMissingReleaseQueueColumnError(
  err: { message?: string; code?: string } | null
): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    msg.includes('release_status') ||
    msg.includes('scheduled_release_at')
  );
}

export function deriveReleaseStatus(item: ReleaseTrackable): ReleaseStatus {
  if (
    item.release_status === 'published' ||
    item.release_status === 'queued' ||
    item.release_status === 'draft'
  ) {
    return item.release_status;
  }
  return item.is_published ? 'published' : 'draft';
}

export function isItemCurrentlyReleased(item: ReleaseTrackable): boolean {
  if (item.is_published || item.release_status === 'published') return true;
  if (item.release_status === 'queued' && item.scheduled_release_at) {
    const ts = new Date(item.scheduled_release_at).getTime();
    return Number.isFinite(ts) && ts <= Date.now();
  }
  return false;
}

export function formatScheduledRelease(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(dt);
}

export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function datetimeLocalToIso(localVal: string): string | null {
  const trimmed = localVal.trim();
  if (!trimmed) return null;
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function getReleaseStatusMeta(item: ReleaseTrackable): {
  status: ReleaseStatus;
  releasedNow: boolean;
  label: string;
  detail: string | null;
  toneClass: string;
} {
  const status = deriveReleaseStatus(item);

  if (status === 'published') {
    return {
      status,
      releasedNow: true,
      label: 'Published',
      detail: 'Live to students',
      toneClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }

  if (status === 'queued') {
    const formatted = formatScheduledRelease(item.scheduled_release_at);
    const due = isItemCurrentlyReleased(item);
    if (formatted) {
      return {
        status,
        releasedNow: due,
        label: due
          ? `Released via Schedule (${formatted})`
          : `Queued · Releases ${formatted}`,
        detail: due ? 'Scheduled release time reached — live to students' : 'Auto-releases at scheduled time',
        toneClass: due
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-phosters-700 dark:text-phosters-400',
      };
    }
    return {
      status,
      releasedNow: false,
      label: 'Queued · Awaiting Release',
      detail: 'Ready in queue — awaiting manual release',
      toneClass: 'text-phosters-700 dark:text-phosters-400',
    };
  }

  return {
    status: 'draft',
    releasedNow: false,
    label: 'Draft',
    detail: 'Hidden from students',
    toneClass: 'text-amber-700 dark:text-amber-400',
  };
}
