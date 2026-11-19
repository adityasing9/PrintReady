import React, { useState } from 'react';
import {
  Bell,
  FileText,
  Home,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Package,
  Printer,
  ScanLine,
  Settings,
  ShoppingBag,
  Store,
  Sun,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { usePrintReady } from '../context/PrintReadyContext';
import { PWAInstallButton } from './PWAInstallButton';

interface NavItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const {
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    isCloudMode,
    isOnline,
    userProfile,
    signInWithGoogle,
    signOutUser,
    basket,
    orders,
    notifications,
    markAllNotificationsRead,
    toasts,
    dismissToast,
  } = usePrintReady();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const activeRequestCount = orders.filter(
    (o) => !['completed', 'cancelled', 'rejected', 'refunded'].includes(o.status)
  ).length;
  const customerNotifs = notifications.filter((n) => n.portal === 'customer');
  const unreadCount = customerNotifs.filter((n) => !n.read).length;

  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', shortLabel: 'Home', icon: Home },
    { id: 'vault', label: 'Document Vault', shortLabel: 'Vault', icon: FileText },
    { id: 'scanner', label: 'Scanner & PDF Tools', shortLabel: 'Scan', icon: ScanLine },
    { id: 'basket', label: 'Print Basket', shortLabel: 'Basket', icon: ShoppingBag, badge: basket.length },
    { id: 'shops', label: 'Print Shops', shortLabel: 'Shops', icon: Store },
    { id: 'orders', label: 'Print Requests', shortLabel: 'Requests', icon: Package, badge: activeRequestCount },
    { id: 'account', label: 'Account & Security', shortLabel: 'Account', icon: Settings },
  ];

  const mobileBottomTabs: NavItem[] = [
    navItems[0], // Home
    navItems[1], // Vault
    navItems[2], // Scan
    navItems[3], // Basket
    navItems[5], // Requests
  ];

  const currentItem = navItems.find((n) => n.id === activeTab) || navItems[0];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Brand Wordmark */}
      <div className="px-5 h-16 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap shrink-0 flex items-center gap-2.5"
        >
          <span className="w-7 h-7 rounded-lg bg-indigo-700 text-white flex items-center justify-center">
            <Printer className="w-4 h-4" />
          </span>
          PrintReady
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="PrintReady navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="font-mono tabular-nums text-xs text-indigo-700 dark:text-indigo-300 font-semibold shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account & Theme Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{userProfile.displayName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {isCloudMode ? 'Cloud Synced' : 'Local Vault'} · {userProfile.subscriptionPlan === 'premium' ? 'Pro' : 'Free'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {isCloudMode ? (
          <button
            type="button"
            onClick={signOutUser}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        ) : (
          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In with Google
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumbs left, concise actions right */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline whitespace-nowrap">PrintReady</span>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 dark:text-white truncate">{currentItem.label}</h1>
            </div>
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 ml-2 whitespace-nowrap">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton variant="header" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label={`Notifications (${unreadCount} unread)`}
                className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-indigo-700 text-white text-[10px] font-mono tabular-nums font-semibold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllNotificationsRead('customer')}
                        className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {customerNotifs.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 dark:text-slate-400">No notifications yet.</p>
                    ) : (
                      customerNotifs.slice(0, 10).map((n) => (
                        <div key={n.id} className={`p-3.5 text-left ${!n.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}`}>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">{n.title}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{n.body}</p>
                          <p className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('vault')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload File
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Customer Bottom Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-5 gap-1">
          {mobileBottomTabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/50'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className="relative">
                  <Icon className="w-4 h-4" />
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 bg-indigo-700 text-white text-[9px] font-mono tabular-nums font-semibold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 truncate">{item.shortLabel || item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-20 lg:bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:max-w-sm pointer-events-none"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3.5 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    t.tone === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : t.tone === 'error'
                      ? 'text-red-700 dark:text-red-400'
                      : t.tone === 'warning'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {t.title}
                </p>
                {t.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
