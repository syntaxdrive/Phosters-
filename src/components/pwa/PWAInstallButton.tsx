import { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from '../ui/Button';

type PWAInstallButtonProps = {
  variant?: 'header' | 'card';
};

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const iosModal = showIOSGuide ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-lg space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/src/assets/images/phosters_logo_1795220277630.jpg"
              alt="Phosters logo"
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white"
            />
            <h3 id="ios-install-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              Install Phosters on iPhone / iPad
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close instructions"
            onClick={() => setShowIOSGuide(false)}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <li>
            Tap the <strong className="inline-flex items-center gap-1">Share <Share className="h-3.5 w-3.5 inline" aria-hidden="true" /></strong> button in Safari&apos;s toolbar.
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong> to place Phosters on your home screen.
          </li>
        </ol>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => setShowIOSGuide(false)}
        >
          Done
        </Button>
      </div>
    </div>
  ) : null;

  if (variant === 'card') {
    if (!isInstallable && !isIOS) {
      return null;
    }

    return (
      <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-phosters-200 dark:border-phosters-800 bg-phosters-50/40 dark:bg-phosters-900/30 p-4">
          <div className="flex items-start gap-3">
            <img
              src="/src/assets/images/phosters_logo_1795220277630.jpg"
              alt="Phosters app icon"
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-xl border border-slate-200 dark:border-slate-700 object-contain bg-white shrink-0"
            />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Install Phosters mobile app
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Add Phosters to your home screen for full-screen study and quick launch.
              </p>
            </div>
          </div>
          {isInstallable ? (
            <Button
              type="button"
              onClick={() => void install()}
              className="self-start sm:self-auto shrink-0"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Install App</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowIOSGuide(true)}
              className="self-start sm:self-auto shrink-0"
            >
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              <span>Install on iOS</span>
            </Button>
          )}
        </div>
        {iosModal}
      </>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border border-phosters-600 dark:border-phosters-500 bg-phosters-50 dark:bg-phosters-900/50 text-xs sm:text-sm font-semibold text-phosters-800 dark:text-phosters-300 hover:bg-phosters-100 dark:hover:bg-phosters-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="h-4 w-4 text-phosters-700 dark:text-phosters-400" aria-hidden="true" />
          <span>Install</span>
        </button>
        {iosModal}
      </>
    );
  }

  return null;
}
