import React, { useState } from 'react';
import { TripProvider, useTrip } from './context/TripContext';
import { MobileHeader } from './components/MobileHeader';
import { MobileBottomNav, TabType } from './components/MobileBottomNav';
import { VaultLockModal } from './components/VaultLockModal';
import { CancellationRadarView } from './views/CancellationRadarView';
import { BudgetVarianceView } from './views/BudgetVarianceView';
import { DayByDayHandbookView } from './views/DayByDayHandbookView';
import { TravelChecklistView } from './views/TravelChecklistView';
import { GoogleWalletPassView } from './views/GoogleWalletPassView';
import { SecureVaultView } from './views/SecureVaultView';
import { PrintableSummary } from './components/PrintableSummary';
import { ErrorBoundary } from './components/ErrorBoundary';

const MainApp: React.FC = () => {
  const { vaultSecurity } = useTrip();
  const [activeTab, setActiveTab] = useState<TabType>('radar');
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [selectedPassIdForWallet, setSelectedPassIdForWallet] = useState<string | null>(null);

  const handleOpenPassFromHandbook = (passId: string) => {
    setSelectedPassIdForWallet(passId);
    setActiveTab('wallet');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased relative selection:bg-sky-500 selection:text-white">
      {/* Dynamic Aurora Ambient Background Orbs with rich pastel saturation so glassmorphic frosted cards pop */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-Right Sky & Cyan glow */}
        <div className="absolute -top-24 -right-24 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-sky-400/40 via-cyan-400/35 to-blue-300/25 blur-[90px]" />
        
        {/* Mid-Left Royal Indigo & Purple glow */}
        <div className="absolute top-[22%] -left-32 w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-indigo-400/35 via-violet-300/30 to-purple-200/20 blur-[95px]" />
        
        {/* Center Aurora Teal & Mint glow */}
        <div className="absolute top-[55%] -right-28 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-teal-300/35 via-emerald-300/28 to-cyan-200/20 blur-[100px]" />
        
        {/* Bottom-Left Warm Sunset Amber & Rose glow */}
        <div className="absolute -bottom-28 left-4 w-[460px] h-[460px] rounded-full bg-gradient-to-tr from-amber-300/40 via-rose-300/30 to-orange-200/25 blur-[90px]" />
      </div>

      {/* On-Screen Mobile UI */}
      <div className="print:hidden flex flex-col min-h-screen relative z-10">
        {/* Mobile Top Frosted Glass Header */}
        <MobileHeader 
          onOpenVaultSettings={() => setIsPinModalOpen(true)} 
        />

        {/* Main Dynamic View Screen with Natural Native Scrolling */}
        <main className="flex-1">
          <ErrorBoundary>
            {activeTab === 'radar' && (
              <CancellationRadarView onOpenPass={handleOpenPassFromHandbook} />
            )}
            {activeTab === 'expenses' && <BudgetVarianceView />}
            {activeTab === 'handbook' && (
              <DayByDayHandbookView onOpenPass={handleOpenPassFromHandbook} />
            )}
            {activeTab === 'checklist' && <TravelChecklistView />}
            {activeTab === 'wallet' && (
              <GoogleWalletPassView
                initialOpenPassId={selectedPassIdForWallet}
                onClearInitialPassId={() => setSelectedPassIdForWallet(null)}
              />
            )}
            {activeTab === 'vault' && (
              <SecureVaultView onOpenPinModal={() => setIsPinModalOpen(true)} />
            )}
          </ErrorBoundary>
        </main>

        {/* Mobile Floating Frosted Glass Bottom Navigation */}
        <MobileBottomNav 
          activeTab={activeTab} 
          onSelectTab={setActiveTab} 
        />

        {/* Master PIN / Lock Screen Modal */}
        <VaultLockModal
          isOpen={isPinModalOpen || vaultSecurity.isVaultLocked}
          onClose={() => setIsPinModalOpen(false)}
          requiredAction={vaultSecurity.isVaultLocked ? 'unlock' : 'settings'}
        />
      </div>

      {/* Printable Emergency Travel Handbook */}
      <PrintableSummary />
    </div>
  );
};

export default function App() {
  return (
    <TripProvider>
      <MainApp />
    </TripProvider>
  );
}
