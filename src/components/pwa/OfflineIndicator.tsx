import { CheckCircle2, RefreshCw, WifiOff, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export function OfflineIndicator() {
  const { user } = useAuth();
  const {
    isOnline,
    isSyncing,
    pendingCount,
    syncMessage,
    syncError,
    syncNow,
    clearSyncNotice,
  } = useOfflineSync();

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-50 dark:bg-amber-950/75 border-b border-amber-200 dark:border-amber-900/70 text-amber-950 dark:text-amber-100"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff
              className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0"
              aria-hidden="true"
            />
            <span>
              Offline Mode — Open saved lessons, PDFs, and downloaded tests.
              {pendingCount > 0 ? ` (${pendingCount} queued to sync)` : ''}
            </span>
          </div>
          {user && (
            <Link
              to="/app/offline"
              className="text-xs font-semibold text-amber-900 dark:text-amber-200 underline underline-offset-4 hover:text-amber-700 dark:hover:text-white shrink-0"
            >
              Offline Study
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!user || (pendingCount === 0 && !isSyncing && !syncMessage && !syncError)) {
    return null;
  }

  if (syncError) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-red-50 dark:bg-red-950/70 border-b border-red-200 dark:border-red-900/70 text-red-900 dark:text-red-100"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
          <span>{syncError}</span>
          <div className="flex items-center gap-2 shrink-0">
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => void syncNow()}
                className="font-semibold underline underline-offset-4 cursor-pointer"
              >
                Retry Sync
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss sync error"
              onClick={clearSyncNotice}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pendingCount > 0 || isSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-phosters-50 dark:bg-phosters-950/80 border-b border-phosters-200 dark:border-phosters-900 text-phosters-900 dark:text-phosters-100"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <RefreshCw
              className={`h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>
              {isSyncing
                ? `Syncing ${pendingCount} offline ${pendingCount === 1 ? 'item' : 'items'}...`
                : `${pendingCount} offline ${pendingCount === 1 ? 'action' : 'actions'} ready to sync.`}
            </span>
          </div>
          {!isSyncing && (
            <button
              type="button"
              onClick={() => void syncNow()}
              className="text-xs font-semibold text-phosters-800 dark:text-phosters-300 underline underline-offset-4 hover:text-phosters-600 cursor-pointer"
            >
              Sync Now
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-phosters-50 dark:bg-phosters-950/80 border-b border-phosters-200 dark:border-phosters-900 text-phosters-900 dark:text-phosters-100"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2">
          <CheckCircle2
            className="h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0"
            aria-hidden="true"
          />
          <span>{syncMessage}</span>
        </div>
        <button
          type="button"
          aria-label="Dismiss sync confirmation"
          onClick={clearSyncNotice}
          className="p-1 rounded hover:bg-phosters-100 dark:hover:bg-phosters-900/60 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
