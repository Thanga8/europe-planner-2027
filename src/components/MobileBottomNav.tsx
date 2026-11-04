import React from 'react';
import { 
  ShieldAlert, 
  Wallet, 
  CalendarDays, 
  ReceiptIndianRupee, 
  LockKeyhole,
  ListChecks 
} from 'lucide-react';
import { useTrip } from '../context/TripContext';

export type TabType = 'radar' | 'expenses' | 'handbook' | 'checklist' | 'wallet' | 'vault';

interface MobileBottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onSelectTab }) => {
  const { bookings, vaultSecurity } = useTrip();

  // Urgent count (only active, booked reservations)
  const urgentCount = bookings.filter(b => {
    if (!b.cancellationDeadline || b.bookingStatus === 'cancelled' || b.bookingStatus === 'not_booked') return false;
    const deadline = new Date(b.cancellationDeadline).getTime();
    const now = new Date().getTime();
    const daysLeft = (deadline - now) / (1000 * 3600 * 24);
    return daysLeft >= 0 && daysLeft <= 14;
  }).length;

  const tabs = [
    {
      id: 'radar' as TabType,
      label: 'Radar',
      icon: ShieldAlert,
      badge: urgentCount > 0 ? urgentCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'expenses' as TabType,
      label: 'Budget',
      icon: ReceiptIndianRupee,
    },
    {
      id: 'handbook' as TabType,
      label: 'Handbook',
      icon: CalendarDays,
    },
    {
      id: 'checklist' as TabType,
      label: 'Checklist',
      icon: ListChecks,
    },
    {
      id: 'wallet' as TabType,
      label: 'Wallet',
      icon: Wallet,
    },
    {
      id: 'vault' as TabType,
      label: 'Vault',
      icon: LockKeyhole,
      badge: vaultSecurity.isVaultLocked ? '🔒' : undefined,
      badgeColor: 'bg-indigo-600 text-white text-[9px]',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-nav pb-safe">
      <div className="max-w-xl mx-auto grid grid-cols-6 px-1.5 py-1.5 sm:px-3 sm:py-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 relative rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive 
                  ? 'text-sky-600 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {/* Active Tab glass pill indicator */}
              {isActive && (
                <span className="absolute -top-1 w-7 sm:w-9 h-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 shadow-sm shadow-sky-500/40" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 text-sky-600' : ''}`} />
                {tab.badge !== undefined && (
                  <span className={`absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full flex items-center justify-center font-bold text-[9px] ${tab.badgeColor} shadow-xs`}>
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] tracking-tight mt-1 leading-none font-bold">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
