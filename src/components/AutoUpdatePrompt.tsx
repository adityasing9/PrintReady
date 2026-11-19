import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, CheckCircle2, Download, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  checkForUpdate,
  CURRENT_APP_VERSION,
  installUpdate,
  isNativeAndroid,
  ReleaseInfo,
} from '../services/autoUpdateService';

export function AutoUpdatePrompt() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    checkForUpdate().then((info) => {
      if (isMounted && info && info.isNewer) {
        setRelease(info);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!release || !release.isNewer || dismissed) {
    return null;
  }

  const handleUpdate = async () => {
    if (!release.apkDownloadUrl) {
      window.open(release.htmlUrl, '_blank');
      return;
    }

    setIsUpdating(true);
    setErrorMsg('');
    try {
      await installUpdate(release.apkDownloadUrl, (msg) => setUpdateStatus(msg));
    } catch (err) {
      console.error('Update failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Update installation failed.');
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-top-4">
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-indigo-500/30 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Update Available
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  {release.version}
                </span>
              </div>
              <p className="text-xs text-slate-200 font-semibold">
                {release.name || `PrintReady ${release.version}`}
              </p>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                {release.notes}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-300 bg-rose-950/40 p-2 rounded-lg mt-2">
            {errorMsg}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">
            Current: v{CURRENT_APP_VERSION} · Signed release
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg"
            >
              Later
            </button>
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleUpdate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {updateStatus || 'Updating...'}
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Update Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
