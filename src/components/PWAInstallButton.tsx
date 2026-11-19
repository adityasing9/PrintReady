import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  // Native Chromium/Android/Desktop install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'card'
            ? 'inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap'
            : 'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-3.5 h-3.5" />
        Install App
      </button>
    );
  }

  // iOS Safari guided flow (and optional install instructions inside Settings card)
  if (isIOS || variant === 'card') {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={
            variant === 'card'
              ? 'inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors whitespace-nowrap'
              : 'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0'
          }
        >
          <Smartphone className="w-3.5 h-3.5" />
          {isIOS ? 'Install on iOS' : 'Add to Home Screen'}
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {isIOS ? 'Install PrintReady on iOS' : 'Install PrintReady App'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close install instructions"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {isIOS ? (
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Tap the <strong>Share</strong> button in your Safari toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong>Add</strong> to launch PrintReady full-screen like a native app.
                  </li>
                </ol>
              ) : (
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Open your browser menu (Chrome, Edge, or Brave address bar icon).
                  </li>
                  <li>
                    Select <strong>Install PrintReady</strong> or <strong>Add to Home Screen</strong>.
                  </li>
                  <li>
                    Launch PrintReady anytime from your home screen with offline vault access.
                  </li>
                </ol>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
