import React, { useState } from 'react';
import { Download, RefreshCw, Shield, Smartphone, Sparkles, Store, User } from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import { formatFileSize } from '../../domain/fileValidation';
import { PWAInstallButton } from '../PWAInstallButton';
import {
  checkForUpdate,
  CURRENT_APP_VERSION,
  installUpdate,
  isNativeAndroid,
  ReleaseInfo,
} from '../../services/autoUpdateService';

export function AccountSettingsView() {
  const {
    userProfile,
    updateUserProfile,
    isCloudMode,
    signInWithGoogle,
    signOutUser,
    documents,
    folders,
    orders,
    coupons,
    notify,
    setIsAuthModalOpen,
  } = usePrintReady();

  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [email, setEmail] = useState(userProfile.email || '');
  const [phone, setPhone] = useState(userProfile.phone);
  const [language, setLanguage] = useState(userProfile.preferredLanguage);

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateRelease, setUpdateRelease] = useState<ReleaseInfo | null>(null);
  const [updateStatusText, setUpdateStatusText] = useState<string>('');

  const handleManualCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatusText('Checking GitHub Releases for updates...');
    const release = await checkForUpdate();
    setCheckingUpdate(false);
    if (release && release.isNewer) {
      setUpdateRelease(release);
      setUpdateStatusText(`New update found: ${release.version}`);
      notify('Update Found', `Version ${release.version} is available!`, 'success');
    } else {
      setUpdateRelease(null);
      setUpdateStatusText(`You are on the latest version (v${CURRENT_APP_VERSION})`);
      notify('Up to Date', `PrintReady v${CURRENT_APP_VERSION} is the latest version.`, 'info');
    }
  };

  const usedBytes = documents.filter((d) => !d.isTrashed).reduce((s, d) => s + d.sizeBytes, 0);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      displayName: displayName.trim() || userProfile.displayName,
      email: email.trim(),
      phone: phone.trim(),
      preferredLanguage: language,
    });
    notify('Profile updated', 'Your account preferences were saved.', 'success');
  };

  const handleExportAccountData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: userProfile,
      folders,
      documents: documents.map(({ previewDataUrl: _omit, ...meta }) => meta),
      orders,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PrintReady_Account_Export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    notify('Data export ready', 'Downloaded complete JSON archive of your vault metadata and orders.', 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Account & Privacy</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage your profile, Google Cloud backup, AI assistance preferences, storage plan, and app installation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            Profile Details
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="acc-name" className="block text-slate-500 mb-1">Full Name</label>
              <input
                id="acc-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="acc-email" className="block text-slate-500 mb-1">Email Address</label>
              <input
                id="acc-email"
                type="email"
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="acc-phone" className="block text-slate-500 mb-1">Phone / WhatsApp</label>
                <input
                  id="acc-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="acc-lang" className="block text-slate-500 mb-1">Language</label>
                <select
                  id="acc-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Kannada">Kannada</option>
                  <option value="Tamil">Tamil</option>
                </select>
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
          >
            Save Profile Changes
          </button>
        </form>

        {/* Security, Privacy & Cloud Sync */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Security, Privacy & Cloud Sync
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Google Account Sync</p>
                <p className="text-slate-500">
                  {isCloudMode
                    ? `Signed in (${userProfile.email}) · Synced across devices`
                    : 'Saved on this device · Sign in with Google to back up to the cloud'}
                </p>
              </div>
              {isCloudMode ? (
                <button
                  type="button"
                  onClick={signOutUser}
                  className="px-3 py-1.5 font-medium border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 py-1.5 font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg whitespace-nowrap"
                >
                  Connect Account
                </button>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <p className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  AI Document Intelligence
                </p>
                <p className="text-slate-500">Allow server-side Gemini classification, OCR, and natural-language search.</p>
              </div>
              <input
                type="checkbox"
                checked={userProfile.aiEnabled}
                onChange={(e) => updateUserProfile({ aiEnabled: e.target.checked })}
                className="accent-indigo-700 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Cloud Vault Backup</p>
                <p className="text-slate-500">Sync private vault metadata across authenticated devices.</p>
              </div>
              <input
                type="checkbox"
                checked={userProfile.cloudBackupEnabled}
                onChange={(e) => updateUserProfile({ cloudBackupEnabled: e.target.checked })}
                className="accent-indigo-700 w-4 h-4"
              />
            </label>

            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportAccountData}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                Export Account Data (JSON)
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Subscription Plans & Loyalty */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Subscription & Storage Plans</h3>
            <p className="text-xs text-slate-500">
              Current usage: <span className="font-mono tabular-nums">{formatFileSize(usedBytes)}</span> · Loyalty Balance:{' '}
              <span className="font-mono tabular-nums font-semibold text-indigo-700 dark:text-indigo-400">{userProfile.loyaltyPoints} pts</span>
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Active Coupons: {coupons.filter((c) => c.active).map((c) => c.code).join(' · ')}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              userProfile.subscriptionPlan === 'free'
                ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900 dark:text-white">For Everyday Printing — Free</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">₹0 / mo</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              250 MB local vault · Saved shops · Direct WhatsApp & Email sharing · Basic print presets.
            </p>
            <button
              type="button"
              onClick={() => updateUserProfile({ subscriptionPlan: 'free', storageQuotaBytes: 250 * 1024 * 1024 })}
              className="px-3 py-1.5 font-medium border border-slate-200 dark:border-slate-700 rounded-md"
            >
              {userProfile.subscriptionPlan === 'free' ? 'Current Plan' : 'Switch to Free'}
            </button>
          </div>

          <div
            className={`p-4 rounded-xl border space-y-2 ${
              userProfile.subscriptionPlan === 'premium'
                ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900 dark:text-white">For Power Users & Students — Premium</span>
              <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">Configurable Tier</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              5 GB Cloud Sync · Unlimited AI Classification & OCR · Full PDF Tools · Priority Shop Orders.
            </p>
            <button
              type="button"
              onClick={() => updateUserProfile({ subscriptionPlan: 'premium', storageQuotaBytes: 5 * 1024 * 1024 * 1024 })}
              className="px-3 py-1.5 font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-md"
            >
              {userProfile.subscriptionPlan === 'premium' ? 'Active Plan' : 'Activate Premium'}
            </button>
          </div>
        </div>
      </section>

      {/* Install Mobile/Desktop App & Direct Sharing Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Android App & In-App Auto Updater Card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Android App & Updates
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                v{CURRENT_APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Official Android app signed with a permanent release keystore. Checks GitHub Releases for updates and installs with zero signature conflicts.
            </p>
            {updateStatusText && (
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg">
                {updateStatusText}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={checkingUpdate}
              onClick={handleManualCheckUpdate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
              {checkingUpdate ? 'Checking...' : 'Check for Updates'}
            </button>
            {updateRelease?.apkDownloadUrl && (
              <a
                href={updateRelease.apkDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-xl transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download {updateRelease.version} APK
              </a>
            )}
            <a
              href={`https://github.com/adityasing9/PrintReady/releases`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              All Releases
            </a>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              Install as Web PWA
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Add PrintReady to your phone or desktop browser home screen for instant camera scanning, offline document access, and one-tap sharing.
            </p>
          </div>
          <div>
            <PWAInstallButton variant="card" />
          </div>
        </section>
      </div>
    </div>
  );
}
