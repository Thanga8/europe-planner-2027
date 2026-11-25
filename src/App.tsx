import React, { useState, useEffect } from 'react';
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
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setMapsQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  const handleOpenPassFromHandbook = (passId: string) => {
    setSelectedPassIdForWallet(passId);
    setActiveTab('wallet');
  };

  return (
    <div className="min-h-screen bg-[#fffbf2] text-[#1a1a1a] flex flex-col font-sans antialiased relative selection:bg-[#ff5e3a] selection:text-white">
      {/* Variation 9: Organic Fluid Background Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-48 -left-48 w-[760px] h-[760px] rounded-full blur-[110px]"
          style={{ backgroundColor: '#ff5e3a', opacity: 0.1 }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[620px] h-[620px] rounded-full blur-[110px]"
          style={{ backgroundColor: '#4ecdc4', opacity: 0.08 }}
        />
      </div>

      {/* On-Screen Mobile & Desktop UI */}
      <div className="print:hidden flex flex-col min-h-screen relative z-10">
        {mapsQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Top Editorial Fluid Travel Header with Desktop Gaegu Nav */}
        <MobileHeader
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenVaultSettings={() => setIsPinModalOpen(true)}
        />

        {/* Main Dynamic View Screen */}
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

        {/* Mobile Bottom Navigation */}
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
