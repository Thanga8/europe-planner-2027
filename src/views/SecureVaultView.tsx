import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  KeyRound, 
  FileLock2, 
  Download, 
  Upload, 
  Printer, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Paperclip, 
  Trash2, 
  DollarSign,
  Info
} from 'lucide-react';
import { useTrip } from '../context/TripContext';

interface SecureVaultViewProps {
  onOpenPinModal: () => void;
}

export const SecureVaultView: React.FC<SecureVaultViewProps> = ({ onOpenPinModal }) => {
  const { 
    vaultSecurity, 
    lockVault, 
    toggleHideSensitive, 
    exchangeRates, 
    setExchangeRates,
    exportEncryptedBackup,
    importBackup,
    resetToDefaults,
  } = useTrip();

  const [eurRate, setEurRate] = useState<number>(exchangeRates.EUR);
  const [chfRate, setChfRate] = useState<number>(exchangeRates.CHF);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Vault document upload
  const [vaultDocs, setVaultDocs] = useState<{ id: string; name: string; size: string; date: string }[]>([
    { id: 'doc-pass-1', name: 'Passport_Front_Back_Scans.pdf', size: '1.4 MB', date: 'Oct 28, 2026' },
    { id: 'doc-ins-1', name: 'Schengen_Travel_Insurance_EUR30k.pdf', size: '480 KB', date: 'Nov 01, 2026' },
    { id: 'doc-dl-1', name: 'International_Driving_Permit_DL.pdf', size: '820 KB', date: 'Nov 01, 2026' },
  ]);

  const handleUpdateRates = () => {
    setExchangeRates({ EUR: Number(eurRate), CHF: Number(chfRate) });
    alert('Exchange rates updated successfully!');
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const backupJson = await exportEncryptedBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Europe2027_Encrypted_Backup_${new Date().toISOString().slice(0, 10)}.tripvault`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error exporting backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await importBackup(content);
      if (success) {
        setImportStatus('Backup restored successfully!');
      } else {
        setImportStatus('Failed to import backup. Check file integrity or PIN.');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
  };

  const handleUploadVaultDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVaultDocs(prev => [
        ...prev,
        {
          id: `doc-${Date.now()}`,
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          date: 'Just now',
        }
      ]);
    }
  };

  return (
    <div className="space-y-6 pb-36 px-5 sm:px-6 pt-5 max-w-xl mx-auto">
      {/* Security Status Hero Card */}
      <div className="p-6 sm:p-7 rounded-[2rem] glass-card-elevated space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className={`p-3.5 rounded-2xl ${
              vaultSecurity.hasPinSet 
                ? 'bg-emerald-100/90 text-emerald-700 border border-emerald-300' 
                : 'bg-amber-100/90 text-amber-700 border border-amber-300'
            }`}>
              {vaultSecurity.hasPinSet ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <span>Zero-Knowledge Vault</span>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-slate-200/80 text-sky-800 font-extrabold">
                  AES-256
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {vaultSecurity.hasPinSet 
                  ? (vaultSecurity.isVaultLocked ? '🔒 Safe is currently LOCKED' : '🔓 Safe is UNLOCKED & active') 
                  : 'Master PIN not configured yet'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenPinModal}
            className="p-3 rounded-2xl glass-subcard hover:bg-white text-slate-700 active:scale-95 transition shadow-xs"
            title="PIN Settings"
          >
            <KeyRound className="w-5 h-5 text-amber-600" />
          </button>
        </div>

        {/* Security Controls Bar */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/60 text-xs">
          <button
            onClick={toggleHideSensitive}
            className="p-3.5 rounded-2xl glass-subcard hover:bg-white flex items-center justify-between transition shadow-xs"
          >
            <div className="flex items-center space-x-2.5">
              {vaultSecurity.hideSensitive ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-emerald-600" />}
              <span className="text-xs font-bold text-slate-800">
                {vaultSecurity.hideSensitive ? 'Masking: ON' : 'Masking: OFF'}
              </span>
            </div>
          </button>

          <button
            onClick={vaultSecurity.isVaultLocked ? onOpenPinModal : lockVault}
            className={`p-3.5 rounded-2xl border flex items-center justify-between transition shadow-xs ${
              vaultSecurity.isVaultLocked
                ? 'bg-rose-100/80 border-rose-300 text-rose-800 font-bold'
                : 'bg-emerald-100/80 border-emerald-300 text-emerald-800 font-bold'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {vaultSecurity.isVaultLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="text-xs font-bold">
                {vaultSecurity.isVaultLocked ? 'Tap to Unlock' : 'Lock Safe Now'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Travel Documents Safe */}
      <div className="p-6 sm:p-7 rounded-[2rem] glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <FileLock2 className="w-5 h-5 text-sky-700" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
              Encrypted Document Safe
            </h3>
          </div>
          <label className="cursor-pointer flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl glass-subcard hover:bg-white text-sky-800 text-xs font-bold transition shadow-xs">
            <Paperclip className="w-4 h-4" />
            <span>Add File</span>
            <input type="file" onChange={handleUploadVaultDoc} className="hidden" />
          </label>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Store digital scans of your Passport, Schengen Visa approval, Travel Insurance, and Driving License.
        </p>

        <div className="space-y-2.5">
          {vaultDocs.map(doc => (
            <div key={doc.id} className="p-4 rounded-2xl glass-subcard flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700 shrink-0">
                  <FileLock2 className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <span className="font-bold text-slate-900 block truncate">{doc.name}</span>
                  <span className="text-[11px] text-slate-500">{doc.size} • Added {doc.date}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 shrink-0">
                <button
                  onClick={() => alert(`Opening secure preview for ${doc.name}`)}
                  className="px-3.5 py-1.5 rounded-xl glass-card text-slate-800 hover:bg-white text-xs font-bold"
                >
                  View
                </button>
                <button
                  onClick={() => setVaultDocs(prev => prev.filter(d => d.id !== doc.id))}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Currency Converter & Exchange Rates Settings */}
      <div className="p-6 sm:p-7 rounded-[2rem] glass-card space-y-4">
        <div className="flex items-center space-x-2.5">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
            Trip Forex Exchange Rates
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-600 block mb-1.5 font-bold">1 EUR (€) in INR</label>
            <input
              type="number"
              step="0.1"
              value={eurRate}
              onChange={e => setEurRate(Number(e.target.value))}
              className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="text-slate-600 block mb-1.5 font-bold">1 CHF (Fr.) in INR</label>
            <input
              type="number"
              step="0.1"
              value={chfRate}
              onChange={e => setChfRate(Number(e.target.value))}
              className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
        <button
          onClick={handleUpdateRates}
          className="w-full py-3.5 rounded-2xl glass-subcard hover:bg-white text-slate-800 text-xs font-extrabold transition shadow-xs"
        >
          Save Exchange Rates
        </button>
      </div>

      {/* Emergency Printable Pocket Handbook */}
      <div className="p-6 sm:p-7 rounded-[2rem] glass-card space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Printer className="w-5 h-5 text-sky-700" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
              Printable Travel Cheat-Sheet
            </h3>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold text-xs border border-sky-300 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Generate an emergency 2-page printout with all flight PNRs, hotel voucher references, cancellation dates, and emergency contacts for your backpack.
        </p>
      </div>

      {/* Encrypted Backup & Restore */}
      <div className="p-6 sm:p-7 rounded-[2rem] glass-card space-y-4">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
          Data Sovereignty & Encrypted Backup
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Export an encrypted `.tripvault` file. Your data stays 100% on your device with zero third-party cloud leakage.
        </p>

        {importStatus && (
          <div className="p-3.5 rounded-2xl bg-emerald-100 border border-emerald-300 text-xs text-emerald-900 flex items-center space-x-2 font-bold">
            <Info className="w-4 h-4 text-emerald-700" />
            <span>{importStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="py-3.5 rounded-2xl glass-subcard hover:bg-white text-slate-800 font-bold flex items-center justify-center space-x-2 transition active:scale-95"
          >
            <Download className="w-4 h-4 text-sky-700" />
            <span>Export Backup</span>
          </button>

          <label className="py-3.5 rounded-2xl glass-subcard hover:bg-white text-slate-800 font-bold flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-700" />
            <span>Import Backup</span>
            <input type="file" accept=".tripvault,.json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>

        <div className="pt-3 border-t border-white/60">
          <button
            onClick={() => {
              if (confirm('Reset all bookings and itinerary back to the original Excel plan?')) {
                resetToDefaults();
                alert('Reset complete');
              }
            }}
            className="text-xs text-rose-600 hover:text-rose-700 flex items-center space-x-1.5 font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset to Original Excel Seed Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
