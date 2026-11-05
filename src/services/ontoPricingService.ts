import { TripBookingItem, PriceChangeRecord } from '../types';

export type OntoPriceDropStatus = 
  | 'REBOOK_AND_REFUND'        // >= 5% drop & free cancellation active
  | 'NON_REFUNDABLE_PRICE_DROP'// Rate dropped, but cancellation penalty applies
  | 'MINOR_DROP'               // < 5% drop (within Onto stepSize tolerance)
  | 'BEST_RATE_LOCKED'         // Live rate is higher or equal to booked rate
  | 'UNTRACKED';               // No live rate checked yet

export interface OntoEvaluationResult {
  bookedCostINR: number;
  currentRateINR: number;
  priceDiffINR: number;
  percentageDrop: number;
  isMaterialDrop: boolean;     // Drop >= stepSize (5%)
  stepSizeINR: number;         // 5% of booked cost
  canCancelFree: boolean;
  refundAmountINR: number;
  cancellationPenaltyINR: number;
  status: OntoPriceDropStatus;
  deadlineUrgency: 'SAFE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_DEADLINE';
  hoursRemaining: number | null;
  actionTitle: string;
  actionAdvice: string;
  source: string;
  lastCheckedAt?: string;
}

export interface HotelDeepLinks {
  googleHotelsUrl: string;
  bookingComUrl: string;
  agodaUrl: string;
}

/**
 * Onto Core Step Size Calculation:
 * Extracted from Onto's schema transform (5899-0ba3b52015cfe4a7.js):
 * Defaults to 5% of booked cost if not explicitly specified.
 */
export function calculateOntoStepSize(originalAmountINR: number, customStepSize?: number): number {
  if (customStepSize && customStepSize > 0 && customStepSize < originalAmountINR) {
    return Math.round(customStepSize);
  }
  return Math.round(0.05 * originalAmountINR);
}

/**
 * Dynamic Free Cancellation Deadline Evaluation (Onto's ek() function):
 * Verifies if the booking deadline is currently in the future.
 */
export function evaluateCancellationDeadline(deadlineISO: string | null, isRefundable: boolean) {
  if (!isRefundable) {
    return {
      canCancelFree: false,
      deadlineUrgency: 'EXPIRED' as const,
      hoursRemaining: 0,
      deadlineText: 'Non-Refundable Tariff'
    };
  }

  if (!deadlineISO) {
    return {
      canCancelFree: true,
      deadlineUrgency: 'NO_DEADLINE' as const,
      hoursRemaining: null,
      deadlineText: 'Free cancellation (No cutoff recorded)'
    };
  }

  const now = Date.now();
  const deadlineMs = Date.parse(deadlineISO);

  if (isNaN(deadlineMs)) {
    return {
      canCancelFree: isRefundable,
      deadlineUrgency: 'NO_DEADLINE' as const,
      hoursRemaining: null,
      deadlineText: 'Free cancellation'
    };
  }

  const msRemaining = deadlineMs - now;
  const hoursRemaining = Math.max(0, Math.round(msRemaining / (1000 * 60 * 60)));

  if (msRemaining <= 0) {
    return {
      canCancelFree: false,
      deadlineUrgency: 'EXPIRED' as const,
      hoursRemaining: 0,
      deadlineText: 'Cutoff Expired'
    };
  }

  if (hoursRemaining <= 48) {
    return {
      canCancelFree: true,
      deadlineUrgency: 'EXPIRING_SOON' as const,
      hoursRemaining,
      deadlineText: `Cutoff in ${hoursRemaining}h (${new Date(deadlineMs).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`
    };
  }

  const daysRemaining = Math.ceil(hoursRemaining / 24);
  return {
    canCancelFree: true,
    deadlineUrgency: 'SAFE' as const,
    hoursRemaining,
    deadlineText: `Free cancel until ${new Date(deadlineMs).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} (${daysRemaining} days left)`
  };
}

/**
 * Complete Onto Price Drop & Refund Evaluation:
 * Reconstructs Onto's price history + cancel quote logic.
 */
export function evaluateOntoPriceDropAndRefund(item: TripBookingItem): OntoEvaluationResult {
  const bookedCostINR = item.bookedCostINR ?? item.plannedCostINR;
  const currentRateINR = item.currentTrackedRateINR ?? null;
  const stepSizeINR = calculateOntoStepSize(bookedCostINR);
  const deadlineEval = evaluateCancellationDeadline(item.cancellationDeadline, item.isRefundable);

  // If no price tracking recorded yet
  if (currentRateINR === null) {
    return {
      bookedCostINR,
      currentRateINR: bookedCostINR,
      priceDiffINR: 0,
      percentageDrop: 0,
      isMaterialDrop: false,
      stepSizeINR,
      canCancelFree: deadlineEval.canCancelFree,
      refundAmountINR: deadlineEval.canCancelFree ? bookedCostINR : 0,
      cancellationPenaltyINR: deadlineEval.canCancelFree ? 0 : bookedCostINR,
      status: 'UNTRACKED',
      deadlineUrgency: deadlineEval.deadlineUrgency,
      hoursRemaining: deadlineEval.hoursRemaining,
      actionTitle: 'Check Live Rates',
      actionAdvice: 'Track live rates across Booking.com, Agoda & Google Hotels to spot repricing opportunities.',
      source: 'Untracked',
      lastCheckedAt: item.lastPriceCheckDate,
    };
  }

  const priceDiffINR = bookedCostINR - currentRateINR;
  const percentageDrop = bookedCostINR > 0 ? (priceDiffINR / bookedCostINR) * 100 : 0;
  const isMaterialDrop = priceDiffINR >= stepSizeINR; // Onto 5% stepSize rule

  let status: OntoPriceDropStatus = 'BEST_RATE_LOCKED';
  let actionTitle = 'Best Rate Locked';
  let actionAdvice = `Current market rate is ₹${currentRateINR.toLocaleString('en-IN')}. Your booked tariff of ₹${bookedCostINR.toLocaleString('en-IN')} is lower or equal.`;

  if (priceDiffINR > 0) {
    if (!deadlineEval.canCancelFree) {
      status = 'NON_REFUNDABLE_PRICE_DROP';
      actionTitle = 'Lower Rate Detected (Locked)';
      actionAdvice = `Room is currently ₹${currentRateINR.toLocaleString('en-IN')} (-₹${priceDiffINR.toLocaleString('en-IN')}), but cancellation fee applies (100%). Keep your original reservation.`;
    } else if (isMaterialDrop) {
      status = 'REBOOK_AND_REFUND';
      actionTitle = `Save ₹${priceDiffINR.toLocaleString('en-IN')} (${percentageDrop.toFixed(1)}% Drop)`;
      actionAdvice = `Rebook now at ₹${currentRateINR.toLocaleString('en-IN')}, then cancel your original reservation before the cutoff for a 100% full refund (₹${bookedCostINR.toLocaleString('en-IN')}).`;
    } else {
      status = 'MINOR_DROP';
      actionTitle = `Minor Drop: -₹${priceDiffINR.toLocaleString('en-IN')} (${percentageDrop.toFixed(1)}%)`;
      actionAdvice = `Rate dropped slightly, but below Onto's 5% threshold (₹${stepSizeINR.toLocaleString('en-IN')}). Not worth rebooking friction yet.`;
    }
  }

  return {
    bookedCostINR,
    currentRateINR,
    priceDiffINR: Math.max(0, priceDiffINR),
    percentageDrop: Math.max(0, Math.round(percentageDrop * 10) / 10),
    isMaterialDrop,
    stepSizeINR,
    canCancelFree: deadlineEval.canCancelFree,
    refundAmountINR: deadlineEval.canCancelFree ? bookedCostINR : 0,
    cancellationPenaltyINR: deadlineEval.canCancelFree ? 0 : bookedCostINR,
    status,
    deadlineUrgency: deadlineEval.deadlineUrgency,
    hoursRemaining: deadlineEval.hoursRemaining,
    actionTitle,
    actionAdvice,
    source: item.trackedRateSource || 'Market Check',
    lastCheckedAt: item.lastPriceCheckDate,
  };
}

/**
 * Generate 1-Click Real-time Comparison Deep Links:
 * Pre-populates exact hotel name, destination, check-in, check-out, and 2 adults.
 */
export function generateHotelDeepLinks(item: TripBookingItem): HotelDeepLinks {
  const checkIn = item.date || '2027-02-06';
  let checkOut = item.checkOutDate;
  if (!checkOut) {
    const d = new Date(checkIn);
    d.setDate(d.getDate() + (item.nightsCount || 1));
    checkOut = d.toISOString().split('T')[0];
  }

  const query = encodeURIComponent(`${item.title} ${item.location}`);

  // 1. Google Hotels Search Link
  const googleHotelsUrl = `https://www.google.com/travel/hotels?q=${query}&dates=${checkIn},${checkOut}&adults=2`;

  // 2. Booking.com Search Link
  const bookingComUrl = `https://www.booking.com/searchresults.html?ss=${query}&checkin=${checkIn}&checkout=${checkOut}&group_adults=2&no_rooms=1`;

  // 3. Agoda Search Link
  const agodaUrl = `https://www.agoda.com/search?text=${encodeURIComponent(item.title)}&checkIn=${checkIn}&checkOut=${checkOut}&rooms=1&adults=2`;

  return {
    googleHotelsUrl,
    bookingComUrl,
    agodaUrl,
  };
}

/**
 * Record a new price check on a booking item.
 */
export function recordPriceCheckOnItem(
  item: TripBookingItem,
  newPriceINR: number,
  source: string
): TripBookingItem {
  const newRecord: PriceChangeRecord = {
    checkedAt: new Date().toISOString(),
    amountINR: newPriceINR,
    source,
    isBooked: false,
  };

  const existingHistory = item.priceDropHistory || [];
  
  // If first check, seed original booked rate in history as well
  const historyWithOriginal = existingHistory.length === 0
    ? [
        {
          checkedAt: item.date ? `${item.date}T10:00:00.000Z` : new Date().toISOString(),
          amountINR: item.bookedCostINR ?? item.plannedCostINR,
          source: item.provider || 'Initial Booking',
          isBooked: true,
        },
        newRecord,
      ]
    : [...existingHistory, newRecord];

  return {
    ...item,
    currentTrackedRateINR: newPriceINR,
    trackedRateSource: source,
    lastPriceCheckDate: newRecord.checkedAt,
    priceDropHistory: historyWithOriginal,
  };
}

/**
 * Realistic Mock Live Market Rates for Instant Testing:
 * Simulates real-world OTA fluctuations for the European itinerary.
 */
export function getMockLiveMarketRates(item: TripBookingItem): {
  suggestedRates: Array<{ source: string; rateINR: number; note: string }>;
} {
  const baseCost = item.bookedCostINR ?? item.plannedCostINR;
  const isParis = item.location.toLowerCase().includes('paris') || item.title.toLowerCase().includes('paris');
  const isLucerne = item.location.toLowerCase().includes('lucerne') || item.title.toLowerCase().includes('lucerne');
  const isRovaniemi = item.location.toLowerCase().includes('rovaniemi') || item.title.toLowerCase().includes('rovaniemi');
  const isIgloo = item.title.toLowerCase().includes('igloo') || item.title.toLowerCase().includes('glass dome');

  if (isParis) {
    // 12% price drop on Agoda
    const agodaDrop = Math.round(baseCost * 0.88);
    const bookingRate = Math.round(baseCost * 0.95);
    return {
      suggestedRates: [
        { source: 'Agoda Flash Deal', rateINR: agodaDrop, note: '12% drop • Free cancellation until Jan 31' },
        { source: 'Booking.com', rateINR: bookingRate, note: '5% drop • Genius member rate' },
        { source: 'Expedia', rateINR: baseCost, note: 'Same as booked tariff' },
      ]
    };
  }

  if (isRovaniemi && !isIgloo) {
    // 14% drop on City Apartment
    const dropRate = Math.round(baseCost * 0.86);
    return {
      suggestedRates: [
        { source: 'Booking.com Promo', rateINR: dropRate, note: '14% drop • Nordic Winter Special' },
        { source: 'Agoda', rateINR: Math.round(baseCost * 0.91), note: '9% drop' },
      ]
    };
  }

  if (isLucerne) {
    // Swiss hotel high season demand -> rate increased
    const higherRate = Math.round(baseCost * 1.08);
    return {
      suggestedRates: [
        { source: 'Google Hotels Best', rateINR: higherRate, note: '+8% surge due to Mt. Titlis winter weekend' },
        { source: 'Official Hotel Web', rateINR: Math.round(baseCost * 1.12), note: '+12% higher' },
      ]
    };
  }

  // Default fallback: 8% drop
  return {
    suggestedRates: [
      { source: 'Agoda', rateINR: Math.round(baseCost * 0.92), note: '8% price drop detected' },
      { source: 'Google Hotels', rateINR: Math.round(baseCost * 0.94), note: '6% price drop detected' },
    ]
  };
}
