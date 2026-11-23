import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { OFFLINE_CHANGE_EVENT, type OfflineSyncAction } from '../lib/offlineDb';
import {
  getOfflineVaultSummary,
  syncOfflineActionsForUser,
  type OfflineVaultSummary,
  type SyncRunResult,
} from '../services/offlineSyncService';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';

interface OfflineSyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  summary: OfflineVaultSummary | null;
  pendingCount: number;
  pendingActions: OfflineSyncAction[];
  downloadedLessonIds: Set<string>;
  downloadedSubjectKeys: Set<string>;
  totalBytes: number;
  syncMessage: string | null;
  syncError: string | null;
  lastSyncedAt: number | null;
  refreshVault: () => Promise<void>;
  syncNow: () => Promise<SyncRunResult | null>;
  clearSyncNotice: () => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  const [summary, setSummary] = useState<OfflineVaultSummary | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const prevOnlineRef = useRef<boolean>(isOnline);

  const refreshVault = useCallback(async () => {
    if (!user) {
      setSummary(null);
      return;
    }
    const next = await getOfflineVaultSummary(user.id);
    setSummary(next);
  }, [user]);

  const syncNow = useCallback(async (): Promise<SyncRunResult | null> => {
    if (!user) return null;
    setIsSyncing(true);
    setSyncError(null);

    const res = await syncOfflineActionsForUser(user.id);
    setIsSyncing(false);

    if (res.syncedCount > 0) {
      setLastSyncedAt(Date.now());
      setSyncMessage(
        `Synced ${res.syncedCount} offline ${res.syncedCount === 1 ? 'action' : 'actions'} to your account.`
      );
    }
    if (res.error) {
      setSyncError(res.error);
    }

    await refreshVault();
    return res;
  }, [user, refreshVault]);

  const clearSyncNotice = useCallback(() => {
    setSyncMessage(null);
    setSyncError(null);
  }, []);

  useEffect(() => {
    void refreshVault();
  }, [refreshVault]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVaultChange = () => {
      void refreshVault();
    };
    window.addEventListener(OFFLINE_CHANGE_EVENT, handleVaultChange);
    return () => window.removeEventListener(OFFLINE_CHANGE_EVENT, handleVaultChange);
  }, [refreshVault]);

  useEffect(() => {
    if (!user) return;
    const reconnected = !prevOnlineRef.current && isOnline;
    prevOnlineRef.current = isOnline;

    if (isOnline && ((summary?.pendingActions.length ?? 0) > 0 || reconnected)) {
      if ((summary?.pendingActions.length ?? 0) > 0) {
        void syncNow();
      } else {
        void refreshVault();
      }
    }
  }, [isOnline, user, summary?.pendingActions.length, syncNow, refreshVault]);

  useEffect(() => {
    if (!syncMessage) return;
    const timer = window.setTimeout(() => setSyncMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [syncMessage]);

  const emptyLessonSet = useMemo(() => new Set<string>(), []);
  const emptySubjectSet = useMemo(() => new Set<string>(), []);

  const value = useMemo<OfflineSyncContextValue>(
    () => ({
      isOnline,
      isSyncing,
      summary,
      pendingCount: summary?.pendingActions.length ?? 0,
      pendingActions: summary?.pendingActions ?? [],
      downloadedLessonIds: summary?.downloadedLessonIds ?? emptyLessonSet,
      downloadedSubjectKeys: summary?.downloadedSubjectKeys ?? emptySubjectSet,
      totalBytes: summary?.totalBytes ?? 0,
      syncMessage,
      syncError,
      lastSyncedAt,
      refreshVault,
      syncNow,
      clearSyncNotice,
    }),
    [
      isOnline,
      isSyncing,
      summary,
      emptyLessonSet,
      emptySubjectSet,
      syncMessage,
      syncError,
      lastSyncedAt,
      refreshVault,
      syncNow,
      clearSyncNotice,
    ]
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSync must be used within an OfflineSyncProvider');
  }
  return ctx;
}
