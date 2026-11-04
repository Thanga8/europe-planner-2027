import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Lock, 
  Download, 
  Wifi, 
  WifiOff,
  Plane,
  Smartphone,
  X,
  FileDown,
  RefreshCw
} from 'lucide-react';
import { useTrip } from '../context/TripContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface MobileHeaderProps {
  onOpenVaultSettings: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onOpenVaultSettings }) => {
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
      (window.navigator as any).standalone === true
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
      setBackupNotice('Backup saved to Downloads!');
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
      <header className="sticky top-0 z-40 bg-white/65 backdrop-blur-2xl border-b border-white/80 px-5 py-3 pt-safe shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          {/* Left: App Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 p-[1.5px] shadow-sm shadow-sky-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-white/90 backdrop-blur-sm rounded-[14px] flex items-center justify-center">
                <Plane className="w-4 h-4 text-sky-600 -rotate-45" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-black tracking-tight text-slate-900">Europe &apos;27</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80">
                  Feb 6–17
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">Paris • Titlis • Lapland</p>
            </div>
          </div>

          {/* Right: Security, Privacy & Android PWA Actions */}
          <div className="flex items-center space-x-2">
            {/* Online / Offline status badge */}
            <div 
              title={isOnline ? 'Online mode' : 'Offline mode'}
              className={`p-2 rounded-xl transition ${isOnline ? 'text-emerald-600 bg-emerald-50/80 border border-emerald-200/60' : 'text-amber-600 bg-amber-50/80 border border-amber-200/60'}`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>

            {/* Quick Field Masking Toggle */}
            <button
              onClick={toggleHideSensitive}
              title={vaultSecurity.hideSensitive ? 'Unmask sensitive figures' : 'Mask sensitive figures'}
              className="p-2 rounded-xl bg-white/70 hover:bg-white border border-white/80 text-slate-600 active:scale-95 transition shadow-xs"
            >
              {vaultSecurity.hideSensitive ? (
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-sky-600" />
              )}
            </button>

            {/* Quick Vault Backup Button */}
            <button
              onClick={handleQuickBackup}
              title="Download backup file of all documents and bookings"
              className="p-2 rounded-xl bg-white/70 hover:bg-white border border-white/80 text-slate-600 hover:text-sky-700 active:scale-95 transition shadow-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
            </button>

            {/* Vault Lock / Security Status Button */}
            <button
              onClick={vaultSecurity.isVaultLocked ? onOpenVaultSettings : lockVault}
              title={vaultSecurity.isVaultLocked ? 'Unlock Safe' : 'Lock Safe Now'}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs active:scale-95 transition shadow-xs border ${
                vaultSecurity.isVaultLocked
                  ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
              }`}
            >
              {vaultSecurity.isVaultLocked ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span className="hidden sm:inline">Encrypted</span>
                  <span className="sm:hidden">Safe</span>
                </>
              )}
            </button>

            {/* Android Install Button (if not already standalone) */}
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition"
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
        <div className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-xs font-bold py-2 px-5 flex items-center justify-between sticky top-[57px] z-30 shadow-md">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>New Europe &apos;27 update ready!</span>
          </div>
          <button
            onClick={handleApplyUpdate}
            className="px-3 py-1 rounded-xl bg-white text-sky-900 font-black text-[11px] shadow-sm active:scale-95 transition"
          >
            Update Now
          </button>
        </div>
      )}

      {/* Backup Download Toast */}
      {backupNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-900/90 text-white text-xs font-black shadow-xl backdrop-blur-md flex items-center space-x-2 animate-in fade-in">
          <span>✓ {backupNotice}</span>
        </div>
      )}

      {/* Android Install instructions dialog for users where automatic prompt didn't fire */}
      {showInstallHelp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2rem] p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-sky-100 text-sky-700">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Install Europe &apos;27 App</h3>
                  <p className="text-xs text-slate-500">Add to your Android Home Screen</p>
                </div>
              </div>
              <button 
                onClick={() => setShowInstallHelp(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 bg-white/60 p-4 rounded-2xl border border-white/80">
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                <p>Tap the <strong>three dots menu (⋮)</strong> at the top right corner of Chrome.</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                <p>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                <p>Tap <strong>Install</strong> to add Europe &apos;27 to your app drawer with 100% offline access.</p>
              </div>
            </div>

            <button
              onClick={() => setShowInstallHelp(false)}
              className="w-full py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs active:scale-95 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
