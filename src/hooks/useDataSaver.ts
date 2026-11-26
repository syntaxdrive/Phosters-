import { useCallback, useEffect, useState } from 'react';

const DATA_SAVER_STORAGE_KEY = 'phosters_data_lite_mode';
const DATA_SAVER_EVENT = 'phosters:data-lite-changed';

function readStoredDataSaver(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DATA_SAVER_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDataSaverPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DATA_SAVER_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(DATA_SAVER_EVENT, { detail: enabled }));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function useDataSaver() {
  const [dataLite, setDataLiteState] = useState<boolean>(readStoredDataSaver);

  useEffect(() => {
    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setDataLiteState(typeof detail === 'boolean' ? detail : readStoredDataSaver());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DATA_SAVER_STORAGE_KEY) {
        setDataLiteState(readStoredDataSaver());
      }
    };

    window.addEventListener(DATA_SAVER_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(DATA_SAVER_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setDataLite = useCallback((enabled: boolean) => {
    setDataLiteState(enabled);
    setDataSaverPreference(enabled);
  }, []);

  const toggleDataLite = useCallback(() => {
    setDataLiteState((prev) => {
      const next = !prev;
      setDataSaverPreference(next);
      return next;
    });
  }, []);

  return { dataLite, setDataLite, toggleDataLite };
}
