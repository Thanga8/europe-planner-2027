import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  TripBookingItem, 
  DigitalPass, 
  DayItinerary, 
  VisaTrackerState, 
  VaultSecurityState,
  PocketExpense,
  ChecklistItem 
} from '../types';
import { 
  INITIAL_BOOKINGS, 
  INITIAL_PASSES, 
  INITIAL_DAY_ITINERARIES, 
  INITIAL_VISA_STATE,
  INITIAL_CHECKLIST_ITEMS 
} from '../data/seedData';
import { 
  hashPin, 
  generateSaltBase64, 
  encryptWithPin, 
  decryptWithPin 
} from '../services/crypto';
import { 
  saveDocumentToVault, 
  getDocumentFromVault, 
  requestPersistentStorage 
} from '../services/documentStorage';

interface ExchangeRates {
  EUR: number; // e.g. 91.5
  CHF: number; // e.g. 94.0
}

interface TripContextType {
  bookings: TripBookingItem[];
  passes: DigitalPass[];
  itineraries: DayItinerary[];
  pocketExpenses: PocketExpense[];
  visaState: VisaTrackerState;
  vaultSecurity: VaultSecurityState;
  exchangeRates: ExchangeRates;
  activePin: string | null;
  
  // Actions
  updateBooking: (item: TripBookingItem) => void;
  addBooking: (item: TripBookingItem) => void;
  deleteBooking: (id: string) => void;

  // Pocket Expenses
  addPocketExpense: (expense: PocketExpense) => void;
  deletePocketExpense: (id: string) => void;
  totalPocketExpensesINR: number;
  
  updatePass: (pass: DigitalPass) => void;
  addPass: (pass: DigitalPass) => void;
  deletePass: (id: string) => void;
  
  updateVisaState: (state: VisaTrackerState) => void;
  setExchangeRates: (rates: ExchangeRates) => void;
  
  // Itinerary Actions
  updateItinerary: (day: DayItinerary) => void;
  toggleItineraryItemCompleted: (dayNumber: number, itemIdOrIndex: string | number) => void;
  resetDayItinerary: (dayNumber: number) => void;
  resetAllItineraries: () => void;
  swapDays: (dayA: number, dayB: number, syncBookings?: boolean) => void;
  moveDay: (fromDayNumber: number, toDayNumber: number, syncBookings?: boolean) => void;
  
  // Checklist Actions
  checklistItems: ChecklistItem[];
  toggleChecklistItem: (id: string) => void;
  addChecklistItem: (item: ChecklistItem) => void;
  deleteChecklistItem: (id: string) => void;
  resetDailyChecklist: () => void;
  resetAllChecklists: () => void;
  preTravelProgress: { completed: number; total: number; percent: number };
  dailyProgress: { completed: number; total: number; percent: number };

  // Security
  setupPin: (pin: string) => Promise<void>;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => void;
  toggleHideSensitive: () => void;
  updateSecuritySettings: (settings: Partial<VaultSecurityState>) => void;
  
  // Backup & Reset
  exportEncryptedBackup: () => Promise<string>;
  importBackup: (backupJson: string, pinForDecrypt?: string) => Promise<boolean>;
  resetToDefaults: () => void;
  
  // Computed helpers
  totalPlannedINR: number;
  totalBookedINR: number;
  totalVarianceINR: number;
  totalRefundableAtStakeINR: number;
  totalNonRefundableLossINR: number;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

const STORAGE_KEYS = {
  BOOKINGS: 'europe27_bookings',
  PASSES: 'europe27_passes',
  ITINERARIES: 'europe27_itineraries',
  POCKET_EXPENSES: 'europe27_pocket_expenses',
  CHECKLISTS: 'europe27_checklists_v1',
  VISA: 'europe27_visa',
  SECURITY: 'europe27_security',
  RATES: 'europe27_rates',
};

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Exchange Rates (Updated to live realistic forex market rate: ~₹106.25/EUR, ~₹110.50/CHF)
  const [exchangeRates, setExchangeRatesState] = useState<ExchangeRates>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RATES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.EUR === 91.5) {
          return { EUR: 106.25, CHF: 110.50 };
        }
        return parsed;
      } catch {}
    }
    return { EUR: 106.25, CHF: 110.50 };
  });

  // Bookings
  const [bookings, setBookings] = useState<TripBookingItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (!saved) return INITIAL_BOOKINGS;
    try {
      const parsed: TripBookingItem[] = JSON.parse(saved);
      let list = parsed;
      // Seamless migration: Unify separate flight bookings into single multi-city itinerary if present
      const hasHelFlight = list.some(b => b.id === 'book-flight-hel-hyd');
      if (hasHelFlight) {
        list = list
          .filter(b => b.id !== 'book-flight-hel-hyd')
          .map(b => {
            if (b.id === 'book-flight-hyd-cdg') {
              return {
                ...b,
                title: 'Multi-City Flights: HYD ✈ CDG & HEL ✈ HYD',
                location: 'Hyderabad ↔ Paris & Helsinki ↔ Hyderabad',
                details: 'Single multi-city international return itinerary (Etihad Airways). Outbound Feb 6: HYD → CDG. Return Feb 16: HEL → HYD. Single PNR: EY849201.',
                plannedCostINR: 150000,
                bookedCostINR: 146800,
                bookedCostOriginal: 146800,
                provider: 'Etihad Airways',
                confirmationNumber: 'EY849201',
              };
            }
            return b;
          });
      }

      // Sanitize unbooked items: "To Book" items must not have refundability attached until booked
      return list.map(b => {
        if (b.bookingStatus === 'not_booked') {
          return {
            ...b,
            isRefundable: false,
            refundPolicy: (!b.refundPolicy || b.refundPolicy.toLowerCase().includes('free cancellation') || b.refundPolicy.toLowerCase().includes('flexible') || b.refundPolicy.toLowerCase().includes('saver day pass'))
              ? 'Not booked yet' 
              : b.refundPolicy,
            cancellationDeadline: null,
          };
        }
        return b;
      });
    } catch (e) {
      return INITIAL_BOOKINGS;
    }
  });

  // Passes
  const [passes, setPasses] = useState<DigitalPass[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PASSES);
    return saved ? JSON.parse(saved) : INITIAL_PASSES;
  });

  // Itineraries (editable day-by-day reference)
  const [itineraries, setItineraries] = useState<DayItinerary[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ITINERARIES);
      if (saved) {
        const parsed: DayItinerary[] = JSON.parse(saved);
        return parsed.map(day => ({
          ...day,
          timelineItems: day.timelineItems || day.highlights.map((h, i) => ({
            id: `item-${day.dayNumber}-${i}`,
            text: h,
            completed: false,
          })),
        }));
      }
    } catch (e) {
      console.warn('Failed to parse saved itineraries', e);
    }
    return INITIAL_DAY_ITINERARIES.map(day => ({
      ...day,
      timelineItems: day.highlights.map((h, i) => ({
        id: `item-${day.dayNumber}-${i}`,
        text: h,
        completed: false,
      })),
    }));
  });

  // Daily Pocket Expenses (On-the-go incidentals)
  const [pocketExpenses, setPocketExpenses] = useState<PocketExpense[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POCKET_EXPENSES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Checklists (Pre-Travel & Daily)
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHECKLISTS);
      if (!saved) return INITIAL_CHECKLIST_ITEMS;
      const parsed: ChecklistItem[] = JSON.parse(saved);
      // Seamlessly merge any new seed items while preserving user's completion states
      const savedIds = new Set(parsed.map(i => i.id));
      const missingSeedItems = INITIAL_CHECKLIST_ITEMS.filter(i => !savedIds.has(i.id));
      return [...parsed, ...missingSeedItems];
    } catch {
      return INITIAL_CHECKLIST_ITEMS;
    }
  });

  // Visa
  const [visaState, setVisaState] = useState<VisaTrackerState>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VISA);
    return saved ? JSON.parse(saved) : INITIAL_VISA_STATE;
  });

  // Security Vault
  const [vaultSecurity, setVaultSecurity] = useState<VaultSecurityState>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SECURITY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        isVaultLocked: parsed.hasPinSet ? true : false,
        lastActiveTimestamp: Date.now(),
      };
    }
    return {
      isVaultLocked: false,
      hasPinSet: false,
      pinHash: null,
      pinSalt: null,
      autoLockMinutes: 5,
      hideSensitive: true,
      biometricsEnabled: false,
      lastActiveTimestamp: Date.now(),
    };
  });

  // In-memory decrypted session key (never written to localStorage)
  const [activePin, setActivePin] = useState<string | null>(null);

  // Auto-lock listener on window blur / visibility change / inactivity
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && vaultSecurity.hasPinSet && vaultSecurity.autoLockMinutes === 0) {
        lockVault();
      }
    };

    const interval = setInterval(() => {
      if (
        vaultSecurity.hasPinSet && 
        !vaultSecurity.isVaultLocked && 
        vaultSecurity.autoLockMinutes > 0
      ) {
        const elapsedMinutes = (Date.now() - vaultSecurity.lastActiveTimestamp) / 60000;
        if (elapsedMinutes >= vaultSecurity.autoLockMinutes) {
          lockVault();
        }
      }
    }, 10000);

    const resetActivity = () => {
      if (!vaultSecurity.isVaultLocked) {
        setVaultSecurity(prev => ({ ...prev, lastActiveTimestamp: Date.now() }));
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('touchstart', resetActivity);
    window.addEventListener('click', resetActivity);
    window.addEventListener('keydown', resetActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('touchstart', resetActivity);
      window.removeEventListener('click', resetActivity);
      window.removeEventListener('keydown', resetActivity);
    };
  }, [vaultSecurity]);

  // Request persistent storage & rehydrate large document blobs from IndexedDB
  useEffect(() => {
    requestPersistentStorage();

    const rehydrateAttachments = async () => {
      let bookingsModified = false;
      const updatedBookings = await Promise.all(
        bookings.map(async (b) => {
          if (b.attachment && !b.attachment.dataBase64) {
            const stored = await getDocumentFromVault(b.attachment.id);
            if (stored?.dataBase64) {
              bookingsModified = true;
              return { ...b, attachment: { ...b.attachment, dataBase64: stored.dataBase64 } };
            }
          }
          return b;
        })
      );
      if (bookingsModified) {
        setBookings(updatedBookings);
      }

      let passesModified = false;
      const updatedPasses = await Promise.all(
        passes.map(async (p) => {
          let hasMissing = false;
          const updatedAttachments = await Promise.all(
            (p.attachments || []).map(async (a) => {
              if (!a.dataBase64) {
                const stored = await getDocumentFromVault(a.id);
                if (stored?.dataBase64) {
                  hasMissing = true;
                  return { ...a, dataBase64: stored.dataBase64 };
                }
              }
              return a;
            })
          );

          let updatedBoardingPass = p.boardingPassAttachment;
          if (p.boardingPassAttachment && !p.boardingPassAttachment.dataBase64) {
            const stored = await getDocumentFromVault(p.boardingPassAttachment.id);
            if (stored?.dataBase64) {
              hasMissing = true;
              updatedBoardingPass = { ...p.boardingPassAttachment, dataBase64: stored.dataBase64 };
            }
          }

          if (hasMissing) {
            passesModified = true;
            return {
              ...p,
              attachments: updatedAttachments,
              boardingPassAttachment: updatedBoardingPass,
            };
          }
          return p;
        })
      );
      if (passesModified) {
        setPasses(updatedPasses);
      }
    };

    rehydrateAttachments();
  }, []);

  // Persist state updates to localStorage + IndexedDB with quota-exhaustion fallback
  useEffect(() => {
    try {
      // 1. Mirror document attachments into IndexedDB
      bookings.forEach((b) => {
        if (b.attachment?.dataBase64) {
          saveDocumentToVault({
            id: b.attachment.id,
            fileName: b.attachment.fileName,
            fileType: b.attachment.fileType,
            fileSize: b.attachment.fileSize,
            dataBase64: b.attachment.dataBase64,
            uploadedAt: b.attachment.uploadedAt,
          });
        }
      });

      // 2. Try saving to localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
      } catch (quotaErr) {
        console.warn('LocalStorage quota limit reached for bookings, saving lean metadata:', quotaErr);
        const leanBookings = bookings.map((b) => {
          if (b.attachment) {
            const { dataBase64, ...rest } = b.attachment;
            return { ...b, attachment: { ...rest, dataBase64: '' } };
          }
          return b;
        });
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(leanBookings));
      }
    } catch (e) {
      console.warn('Failed to persist bookings:', e);
    }
  }, [bookings]);

  useEffect(() => {
    try {
      // 1. Mirror pass attachments into IndexedDB
      passes.forEach((p) => {
        if (p.attachments) {
          p.attachments.forEach((a) => {
            if (a.dataBase64) {
              saveDocumentToVault({
                id: a.id,
                fileName: a.fileName,
                fileType: a.fileType,
                fileSize: a.fileSize,
                dataBase64: a.dataBase64,
                uploadedAt: a.uploadedAt,
              });
            }
          });
        }
        if (p.boardingPassAttachment?.dataBase64) {
          saveDocumentToVault({
            id: p.boardingPassAttachment.id,
            fileName: p.boardingPassAttachment.fileName,
            fileType: p.boardingPassAttachment.fileType,
            fileSize: p.boardingPassAttachment.fileSize,
            dataBase64: p.boardingPassAttachment.dataBase64,
            uploadedAt: p.boardingPassAttachment.uploadedAt,
          });
        }
      });

      // 2. Try saving to localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.PASSES, JSON.stringify(passes));
      } catch (quotaErr) {
        console.warn('LocalStorage quota limit reached for passes, saving lean metadata:', quotaErr);
        const leanPasses = passes.map((p) => {
          const leanAttachments = p.attachments?.map((a) => {
            const { dataBase64, ...rest } = a;
            return { ...rest, dataBase64: '' };
          });
          let leanBoardingPass = p.boardingPassAttachment;
          if (p.boardingPassAttachment) {
            const { dataBase64, ...rest } = p.boardingPassAttachment;
            leanBoardingPass = { ...rest, dataBase64: '' };
          }
          return {
            ...p,
            attachments: leanAttachments || [],
            boardingPassAttachment: leanBoardingPass,
          };
        });
        localStorage.setItem(STORAGE_KEYS.PASSES, JSON.stringify(leanPasses));
      }
    } catch (e) {
      console.warn('Failed to persist passes:', e);
    }
  }, [passes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ITINERARIES, JSON.stringify(itineraries));
    } catch (e) {
      console.warn('Failed to persist itineraries:', e);
    }
  }, [itineraries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VISA, JSON.stringify(visaState));
    } catch (e) {
      console.warn('Failed to persist visaState:', e);
    }
  }, [visaState]);

  useEffect(() => {
    try {
      const toSave = { ...vaultSecurity, isVaultLocked: true };
      localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to persist security state:', e);
    }
  }, [vaultSecurity.hasPinSet, vaultSecurity.pinHash, vaultSecurity.pinSalt, vaultSecurity.autoLockMinutes, vaultSecurity.hideSensitive, vaultSecurity.biometricsEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(exchangeRates));
    } catch (e) {
      console.warn('Failed to persist rates:', e);
    }
  }, [exchangeRates]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.POCKET_EXPENSES, JSON.stringify(pocketExpenses));
    } catch (e) {
      console.warn('Failed to persist pocketExpenses:', e);
    }
  }, [pocketExpenses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHECKLISTS, JSON.stringify(checklistItems));
    } catch (e) {
      console.warn('Failed to persist checklistItems:', e);
    }
  }, [checklistItems]);

  // Checklist Actions
  const toggleChecklistItem = (id: string) => {
    setChecklistItems(prev => prev.map(item => 
      item.id === id ? { ...item, isCompleted: !item.isCompleted } : item
    ));
  };

  const addChecklistItem = (item: ChecklistItem) => {
    setChecklistItems(prev => [item, ...prev]);
  };

  const deleteChecklistItem = (id: string) => {
    setChecklistItems(prev => prev.filter(item => item.id !== id));
  };

  const resetDailyChecklist = () => {
    setChecklistItems(prev => prev.map(item => 
      item.type === 'daily' ? { ...item, isCompleted: false } : item
    ));
  };

  const resetAllChecklists = () => {
    setChecklistItems(INITIAL_CHECKLIST_ITEMS);
  };

  // Pocket Expenses Actions
  const addPocketExpense = (expense: PocketExpense) => {
    setPocketExpenses(prev => [expense, ...prev]);
  };

  const deletePocketExpense = (id: string) => {
    setPocketExpenses(prev => prev.filter(p => p.id !== id));
  };

  const totalPocketExpensesINR = pocketExpenses.reduce((sum, p) => sum + (p.amountINR || 0), 0);

  // Actions
  const updateBooking = (item: TripBookingItem) => {
    setBookings(prev => prev.map(b => (b.id === item.id ? item : b)));
  };

  const addBooking = (item: TripBookingItem) => {
    setBookings(prev => [item, ...prev]);
  };

  const deleteBooking = (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const updatePass = (pass: DigitalPass) => {
    setPasses(prev => prev.map(p => (p.id === pass.id ? pass : p)));
  };

  const addPass = (pass: DigitalPass) => {
    setPasses(prev => [pass, ...prev]);
  };

  const deletePass = (id: string) => {
    setPasses(prev => prev.filter(p => p.id !== id));
  };

  const updateVisaState = (state: VisaTrackerState) => {
    setVisaState(state);
  };

  const setExchangeRates = (rates: ExchangeRates) => {
    setExchangeRatesState(rates);
  };

  // Itinerary Actions
  const updateItinerary = (day: DayItinerary) => {
    setItineraries(prev => prev.map(d => (d.dayNumber === day.dayNumber ? day : d)));
  };

  const toggleItineraryItemCompleted = (dayNumber: number, itemIdOrIndex: string | number) => {
    setItineraries(prev => prev.map(d => {
      if (d.dayNumber !== dayNumber) return d;
      const items = d.timelineItems || d.highlights.map((h, i) => ({
        id: `item-${d.dayNumber}-${i}`,
        text: h,
        completed: false,
      }));

      const updatedItems = items.map((item, idx) => {
        if (typeof itemIdOrIndex === 'number' ? idx === itemIdOrIndex : item.id === itemIdOrIndex) {
          return { ...item, completed: !item.completed };
        }
        return item;
      });

      return {
        ...d,
        timelineItems: updatedItems,
      };
    }));
  };

  const resetDayItinerary = (dayNumber: number) => {
    const defaultDay = INITIAL_DAY_ITINERARIES.find(d => d.dayNumber === dayNumber);
    if (!defaultDay) return;
    const restored: DayItinerary = {
      ...defaultDay,
      timelineItems: defaultDay.highlights.map((h, i) => ({
        id: `item-${defaultDay.dayNumber}-${i}`,
        text: h,
        completed: false,
      })),
    };
    setItineraries(prev => prev.map(d => (d.dayNumber === dayNumber ? restored : d)));
  };

  const resetAllItineraries = () => {
    setItineraries(INITIAL_DAY_ITINERARIES.map(day => ({
      ...day,
      timelineItems: day.highlights.map((h, i) => ({
        id: `item-${day.dayNumber}-${i}`,
        text: h,
        completed: false,
      })),
    })));
  };

  const swapDays = (dayANum: number, dayBNum: number, syncBookings: boolean = true) => {
    if (dayANum === dayBNum) return;

    const dayA = itineraries.find(d => d.dayNumber === dayANum);
    const dayB = itineraries.find(d => d.dayNumber === dayBNum);
    if (!dayA || !dayB) return;

    // We preserve calendar chronology: Day A keeps dayANum, dayA.date, dayA.dayName
    // Day B keeps dayBNum, dayB.date, dayB.dayName, but swap the content payload:
    const newDayA: DayItinerary = {
      ...dayA,
      title: dayB.title,
      location: dayB.location,
      daylightHours: dayB.daylightHours,
      weatherTip: dayB.weatherTip,
      clothingTip: dayB.clothingTip,
      notes: dayB.notes,
      highlights: [...dayB.highlights],
      timelineItems: dayB.timelineItems ? [...dayB.timelineItems] : undefined,
      itemIds: [...dayB.itemIds],
    };

    const newDayB: DayItinerary = {
      ...dayB,
      title: dayA.title,
      location: dayA.location,
      daylightHours: dayA.daylightHours,
      weatherTip: dayA.weatherTip,
      clothingTip: dayA.clothingTip,
      notes: dayA.notes,
      highlights: [...dayA.highlights],
      timelineItems: dayA.timelineItems ? [...dayA.timelineItems] : undefined,
      itemIds: [...dayA.itemIds],
    };

    setItineraries(prev => prev.map(d => {
      if (d.dayNumber === dayANum) return newDayA;
      if (d.dayNumber === dayBNum) return newDayB;
      return d;
    }));

    if (syncBookings) {
      setBookings(prev => prev.map(b => {
        if (b.dayNumber === dayANum) {
          return { ...b, dayNumber: dayBNum, date: dayB.date };
        }
        if (b.dayNumber === dayBNum) {
          return { ...b, dayNumber: dayANum, date: dayA.date };
        }
        return b;
      }));
    }
  };

  const moveDay = (fromDayNum: number, toDayNum: number, syncBookings: boolean = true) => {
    if (fromDayNum === toDayNum) return;

    const sorted = [...itineraries].sort((a, b) => a.dayNumber - b.dayNumber);
    const fromIndex = sorted.findIndex(d => d.dayNumber === fromDayNum);
    const toIndex = sorted.findIndex(d => d.dayNumber === toDayNum);
    if (fromIndex === -1 || toIndex === -1) return;

    // Extract content payload in new order
    const contentList = sorted.map(d => ({
      title: d.title,
      location: d.location,
      daylightHours: d.daylightHours,
      weatherTip: d.weatherTip,
      clothingTip: d.clothingTip,
      notes: d.notes,
      highlights: d.highlights,
      timelineItems: d.timelineItems,
      itemIds: d.itemIds,
    }));

    const [movedContent] = contentList.splice(fromIndex, 1);
    contentList.splice(toIndex, 0, movedContent);

    // Apply new content order onto the fixed date slots
    const newItineraries = sorted.map((slot, idx) => ({
      ...slot,
      ...contentList[idx],
    }));

    setItineraries(newItineraries);

    if (syncBookings) {
      const dayNumberOrder = sorted.map(d => d.dayNumber);
      const [movedDayNum] = dayNumberOrder.splice(fromIndex, 1);
      dayNumberOrder.splice(toIndex, 0, movedDayNum);

      const mapping = new Map<number, { newDayNum: number; newDate: string }>();
      dayNumberOrder.forEach((oldDayNum, newIdx) => {
        mapping.set(oldDayNum, {
          newDayNum: sorted[newIdx].dayNumber,
          newDate: sorted[newIdx].date,
        });
      });

      setBookings(prev => prev.map(b => {
        const target = mapping.get(b.dayNumber);
        if (target) {
          return { ...b, dayNumber: target.newDayNum, date: target.newDate };
        }
        return b;
      }));
    }
  };

  // Security Implementation
  const setupPin = async (pin: string) => {
    const saltBase64 = generateSaltBase64();
    const saltBuffer = new Uint8Array(
      window.atob(saltBase64).split('').map(c => c.charCodeAt(0))
    );
    const hash = await hashPin(pin, saltBuffer);

    setVaultSecurity(prev => ({
      ...prev,
      hasPinSet: true,
      pinHash: hash,
      pinSalt: saltBase64,
      isVaultLocked: false,
      lastActiveTimestamp: Date.now(),
    }));
    setActivePin(pin);
  };

  const unlockVault = async (pin: string): Promise<boolean> => {
    if (!vaultSecurity.pinSalt || !vaultSecurity.pinHash) {
      setActivePin(pin);
      setVaultSecurity(prev => ({ ...prev, isVaultLocked: false }));
      return true;
    }

    const saltBuffer = new Uint8Array(
      window.atob(vaultSecurity.pinSalt).split('').map(c => c.charCodeAt(0))
    );
    const computedHash = await hashPin(pin, saltBuffer);

    if (computedHash === vaultSecurity.pinHash) {
      setActivePin(pin);
      setVaultSecurity(prev => ({
        ...prev,
        isVaultLocked: false,
        lastActiveTimestamp: Date.now(),
      }));
      return true;
    }
    return false;
  };

  const lockVault = () => {
    setActivePin(null);
    setVaultSecurity(prev => ({ ...prev, isVaultLocked: true }));
  };

  const toggleHideSensitive = () => {
    setVaultSecurity(prev => ({ ...prev, hideSensitive: !prev.hideSensitive }));
  };

  const updateSecuritySettings = (settings: Partial<VaultSecurityState>) => {
    setVaultSecurity(prev => ({ ...prev, ...settings }));
  };

  // Backup & Restore
  const exportEncryptedBackup = async (): Promise<string> => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      bookings,
      passes,
      itineraries,
      pocketExpenses,
      checklistItems,
      visaState,
      exchangeRates,
    };
    const jsonString = JSON.stringify(data, null, 2);

    if (activePin) {
      const encrypted = await encryptWithPin(jsonString, activePin);
      return JSON.stringify({
        isEncrypted: true,
        payload: encrypted,
        exportedAt: data.exportedAt,
      }, null, 2);
    }

    return JSON.stringify({
      isEncrypted: false,
      data,
    }, null, 2);
  };

  const importBackup = async (backupJson: string, pinForDecrypt?: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(backupJson);
      let tripData: any;

      if (parsed.isEncrypted) {
        const pinToUse = pinForDecrypt || activePin;
        if (!pinToUse) {
          throw new Error('PIN required to decrypt backup');
        }
        const decryptedStr = await decryptWithPin(parsed.payload, pinToUse);
        tripData = JSON.parse(decryptedStr);
      } else {
        tripData = parsed.data || parsed;
      }

      if (tripData.bookings) setBookings(tripData.bookings);
      if (tripData.passes) setPasses(tripData.passes);
      if (tripData.itineraries) setItineraries(tripData.itineraries);
      if (tripData.pocketExpenses) setPocketExpenses(tripData.pocketExpenses);
      if (tripData.checklistItems) setChecklistItems(tripData.checklistItems);
      if (tripData.visaState) setVisaState(tripData.visaState);
      if (tripData.exchangeRates) setExchangeRatesState(tripData.exchangeRates);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  };

  const resetToDefaults = () => {
    setBookings(INITIAL_BOOKINGS);
    setPasses(INITIAL_PASSES);
    setVisaState(INITIAL_VISA_STATE);
    setPocketExpenses([]);
    setChecklistItems(INITIAL_CHECKLIST_ITEMS);
    resetAllItineraries();
  };

  // Computed Checklist Progress
  const preTravelItems = checklistItems.filter(i => i.type === 'pre_travel');
  const preTravelCompleted = preTravelItems.filter(i => i.isCompleted).length;
  const preTravelTotal = preTravelItems.length;
  const preTravelProgress = {
    completed: preTravelCompleted,
    total: preTravelTotal,
    percent: preTravelTotal > 0 ? Math.round((preTravelCompleted / preTravelTotal) * 100) : 0,
  };

  const dailyItems = checklistItems.filter(i => i.type === 'daily');
  const dailyCompleted = dailyItems.filter(i => i.isCompleted).length;
  const dailyTotal = dailyItems.length;
  const dailyProgress = {
    completed: dailyCompleted,
    total: dailyTotal,
    percent: dailyTotal > 0 ? Math.round((dailyCompleted / dailyTotal) * 100) : 0,
  };

  // Computed Financials
  const totalPlannedINR = bookings.reduce((sum, item) => sum + item.plannedCostINR, 0);

  const totalBookedINR = bookings.reduce((sum, item) => {
    if (item.bookingStatus === 'confirmed' || item.bookingStatus === 'reserved') {
      return sum + (item.bookedCostINR ?? item.plannedCostINR);
    }
    return sum;
  }, 0);

  // Variance: Difference between actual booked price and excel planned price for items with a booked price
  const totalVarianceINR = bookings.reduce((sum, item) => {
    if (item.bookedCostINR !== null && item.bookingStatus !== 'cancelled') {
      return sum + (item.bookedCostINR - item.plannedCostINR);
    }
    return sum;
  }, 0);

  // Visa Risk Metrics
  const totalRefundableAtStakeINR = bookings.reduce((sum, item) => {
    if (
      (item.bookingStatus === 'confirmed' || item.bookingStatus === 'reserved') &&
      item.isRefundable &&
      item.cancellationDeadline !== null
    ) {
      const amountPaid = item.bookedCostINR ?? item.plannedCostINR;
      const recoverable = Math.max(0, amountPaid - (item.cancellationFeeINR || 0));
      return sum + recoverable;
    }
    return sum;
  }, 0);

  const totalNonRefundableLossINR = bookings.reduce((sum, item) => {
    if (
      (item.bookingStatus === 'confirmed' || item.bookingStatus === 'reserved') &&
      (!item.isRefundable || (item.cancellationDeadline && new Date(item.cancellationDeadline) < new Date()))
    ) {
      return sum + (item.bookedCostINR ?? item.plannedCostINR);
    }
    return sum;
  }, 0);

  return (
    <TripContext.Provider
      value={{
        bookings,
        passes,
        itineraries,
        pocketExpenses,
        visaState,
        vaultSecurity,
        exchangeRates,
        activePin,
        updateBooking,
        addBooking,
        deleteBooking,
        addPocketExpense,
        deletePocketExpense,
        totalPocketExpensesINR,
        checklistItems,
        toggleChecklistItem,
        addChecklistItem,
        deleteChecklistItem,
        resetDailyChecklist,
        resetAllChecklists,
        preTravelProgress,
        dailyProgress,
        updatePass,
        addPass,
        deletePass,
        updateVisaState,
        setExchangeRates,
        updateItinerary,
        toggleItineraryItemCompleted,
        resetDayItinerary,
        resetAllItineraries,
        swapDays,
        moveDay,
        setupPin,
        unlockVault,
        lockVault,
        toggleHideSensitive,
        updateSecuritySettings,
        exportEncryptedBackup,
        importBackup,
        resetToDefaults,
        totalPlannedINR,
        totalBookedINR,
        totalVarianceINR,
        totalRefundableAtStakeINR,
        totalNonRefundableLossINR,
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = () => {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
};

