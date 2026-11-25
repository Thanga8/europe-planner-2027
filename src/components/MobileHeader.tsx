import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Download,
  Wifi,
  WifiOff,
  Smartphone,
  X,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { TabType } from './MobileBottomNav';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface MobileHeaderProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenVaultSettings: () => void;
}

const DESKTOP_NAV_ITEMS: { id: TabType; label: string }[] = [
  { id: 'radar', label: 'Radar' },
  { id: 'handbook', label: 'Handbook' },
  { id: 'expenses', label: 'Budget' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'vault', label: 'Vault' },
];

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenVaultSettings,
}) => {
  const { vaultSecurity, lockVault, toggleHideSensitive, exportEncryptedBackup } = useTrip();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showInstallHelp, setShowInstallHelp] = useState<boolean>(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener('app-update-ready', handleUpdate);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('app-update-ready', handleUpdate);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleQuickBackup = async () => {
    try {
      const backupJson = await exportEncryptedBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Europe2027_Documents_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupNotice('Backup saved to Downloads');
      setTimeout(() => setBackupNotice(null), 3000);
    } catch (e) {
      console.warn('Backup error:', e);
    }
  };

  const handleApplyUpdate = () => {
    window.location.reload();
  };

  const handleInstallClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallPrompt(null);
      }
    } else {
      setShowInstallHelp(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#fffbf2]/90 backdrop-blur-xl border-b border-[#1a1a1a]/10 px-4 sm:px-8 py-3 pt-safe">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          {/* Zone 1: Expressive Gaegu Brand Wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('radar')}
            className="text-left shrink-0 group focus:outline-none"
          >
            <span className="font-gaegu text-3xl sm:text-4xl font-bold leading-none tracking-tight text-[#ff5e3a] inline-block -rotate-2 group-hover:rotate-0 transition-transform whitespace-nowrap">
              Europe &apos;27
            </span>
          </button>

          {/* Zone 2: Desktop Expressive Gaegu Navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 lg:gap-8"
          >
            {DESKTOP_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`font-gaegu text-2xl leading-none transition-all whitespace-nowrap shrink-0 cursor-pointer pb-1 border-b-2 ${
                    isActive
                      ? 'text-[#ff5e3a] border-[#ff5e3a] opacity-100'
                      : 'text-[#1a1a1a] border-transparent opacity-40 hover:opacity-85'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Compact Utility & Vault Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div
              title={isOnline ? 'Online' : 'Offline'}
              className={`p-2 rounded-lg border transition ${
                isOnline
                  ? 'text-[#16a34a] bg-[#fffdf8] border-[#1a1a1a]/10'
                  : 'text-[#ff5e3a] bg-[#fffdf8] border-[#ff5e3a]/30'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>

            <button
              type="button"
              onClick={toggleHideSensitive}
              title={vaultSecurity.hideSensitive ? 'Unmask sensitive figures' : 'Mask sensitive figures'}
              className="p-2 rounded-lg bg-[#fffdf8] hover:bg-white border border-[#1a1a1a]/12 text-[#1a1a1a]/75 hover:text-[#1a1a1a] active:scale-95 transition"
            >
              {vaultSecurity.hideSensitive ? (
                <EyeOff className="w-3.5 h-3.5 text-[#1a1a1a]/45" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-[#ff5e3a]" />
              )}
            </button>

            <button
              type="button"
              onClick={handleQuickBackup}
              title="Download backup of documents and bookings"
              className="hidden sm:inline-flex p-2 rounded-lg bg-[#fffdf8] hover:bg-white border border-[#1a1a1a]/12 text-[#1a1a1a]/75 hover:text-[#1a1a1a] active:scale-95 transition"
            >
              <FileDown className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={vaultSecurity.isVaultLocked ? onOpenVaultSettings : lockVault}
              title={vaultSecurity.isVaultLocked ? 'Unlock Vault' : 'Lock Vault'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-fluid text-[11px] font-semibold uppercase tracking-wider active:scale-95 transition border whitespace-nowrap shrink-0 ${
                vaultSecurity.isVaultLocked
                  ? 'bg-[#fdf2f2] text-[#ef4444] border-[#ef4444]/40'
                  : 'bg-[#1a1a1a] text-[#fffbf2] border-[#1a1a1a] hover:bg-[#333333]'
              }`}
            >
              {vaultSecurity.isVaultLocked ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3 text-[#4ecdc4]" />
                  <span className="hidden sm:inline">Safe</span>
                </>
              )}
            </button>

            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ff5e3a] hover:bg-[#e84f2d] text-white font-bold text-xs active:scale-95 transition whitespace-nowrap shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* App Update Available Banner */}
      {updateAvailable && (
        <div className="bg-[#1a1a1a] text-[#fffbf2] text-xs font-semibold py-2 px-5 flex items-center justify-between sticky top-[57px] z-30">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-3.5 h-3.5 text-[#ff5e3a] animate-spin" />
            <span>New Europe &apos;27 update ready</span>
          </div>
          <button
            type="button"
            onClick={handleApplyUpdate}
            className="px-3 py-1 rounded bg-[#ff5e3a] text-white font-bold text-[11px] active:scale-95 transition"
          >
            Update Now
          </button>
        </div>
      )}

      {/* Backup Download Toast */}
      {backupNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1a1a1a] text-[#fffbf2] font-mono-fluid text-xs font-semibold shadow-xl flex items-center space-x-2">
          <span>✓ {backupNotice}</span>
        </div>
      )}

      {/* Install instructions dialog */}
      {showInstallHelp && (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a]/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="glass-card-elevated rounded-3xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-[#ff5e3a]/10 text-[#ff5e3a]">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1a1a1a] text-sm">Install Europe &apos;27 App</h3>
                  <p className="text-xs text-[#1a1a1a]/60">Add to your Home Screen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className="p-1 rounded-full text-[#1a1a1a]/40 hover:text-[#1a1a1a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#1a1a1a]/80 bg-[#fffbf2] p-4 rounded-2xl border border-[#1a1a1a]/10">
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-[#ff5e3a] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                  1
                </span>
                <p>Tap the <strong>browser menu (⋮)</strong> at the top right corner.</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-[#ff5e3a] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                  2
                </span>
                <p>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-[#ff5e3a] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                  3
                </span>
                <p>Tap <strong>Install</strong> to access Europe &apos;27 offline anytime.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInstallHelp(false)}
              className="w-full py-3 rounded-xl bg-[#1a1a1a] text-[#fffbf2] font-bold text-xs active:scale-95 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
