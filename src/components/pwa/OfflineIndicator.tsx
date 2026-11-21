import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-900/70 text-amber-950 dark:text-amber-100"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 text-xs sm:text-sm font-medium">
        <WifiOff className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
        <span>
          You are offline. Reconnect to stream lesson videos, save progress, or submit tests.
        </span>
      </div>
    </div>
  );
}
