import React from 'react';
import {
  ShieldAlert,
  Wallet,
  CalendarDays,
  ReceiptIndianRupee,
  LockKeyhole,
  ListChecks,
} from 'lucide-react';
import { useTrip } from '../context/TripContext';

export type TabType = 'radar' | 'expenses' | 'handbook' | 'checklist' | 'wallet' | 'vault';

interface MobileBottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onSelectTab }) => {
  const { bookings, vaultSecurity } = useTrip();

  const urgentCount = bookings.filter((b) => {
    if (!b.cancellationDeadline || b.bookingStatus === 'cancelled' || b.bookingStatus === 'not_booked')
      return false;
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
      badgeColor: 'bg-[#ef4444] text-white',
    },
    {
      id: 'handbook' as TabType,
      label: 'Handbook',
      icon: CalendarDays,
    },
    {
      id: 'expenses' as TabType,
      label: 'Budget',
      icon: ReceiptIndianRupee,
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
      badge: vaultSecurity.isVaultLocked ? '!' : undefined,
      badgeColor: 'bg-[#1a1a1a] text-[#fffbf2] text-[9px]',
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-nav pb-safe">
      <div className="max-w-xl mx-auto grid grid-cols-6 px-1.5 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1.5 px-0.5 relative rounded-xl transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-[#ff5e3a] font-extrabold'
                  : 'text-[#1a1a1a]/45 hover:text-[#1a1a1a]/80'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1 w-7 h-1 rounded-full bg-[#ff5e3a]" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-110 text-[#ff5e3a]' : ''
                  }`}
                />
                {tab.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full flex items-center justify-center font-bold text-[9px] ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] tracking-tight mt-1 leading-none font-bold whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
