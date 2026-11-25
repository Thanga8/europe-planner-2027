import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  Sun,
  MapPin,
  Ticket,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ThermometerSnowflake,
  Shirt,
  Clock,
  Plane,
  Bed,
  Train,
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  X,
  FileText,
  ArrowLeftRight,
  CloudSnow,
  CloudRain,
  Navigation,
  Wallet,
  Coins,
  RefreshCw,
  Utensils,
  ShoppingBag,
  Map as MapIcon,
  ListChecks,
  AlertCircle,
} from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { getItemImage } from '../data/travelImages';
import {
  DayItinerary,
  DayItineraryItem,
  ItineraryStop,
  PocketExpense,
  PocketExpenseCategory,
} from '../types';
import { DayMapComponent } from '../components/DayMapComponent';
import { PlaceSearchAddStop } from '../components/PlaceSearchAddStop';
import { DepartureAssistantCard } from '../components/DepartureAssistantCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { fetchLiveWeather, LiveWeatherReport } from '../services/weatherService';
import {
  GOOGLE_MAPS_API_KEY,
  DayRouteSummary,
  formatDistanceMeters,
  formatDurationMillis,
} from '../services/googleMapsConfig';

interface DayByDayHandbookViewProps {
  onOpenPass: (passId: string) => void;
}

type DetailTab = 'notes' | 'weather' | 'logistics' | 'expenses';

const STOP_COLORS: Record<string, string> = {
  hotel: '#059669',
  flight: '#4f46e5',
  station: '#d97706',
  food: '#e11d48',
  activity: '#0284c7',
};

const STOP_CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Stay',
  flight: 'Flight',
  station: 'Transit',
  food: 'Dining',
  activity: 'Activity',
};

export const DayByDayHandbookView: React.FC<DayByDayHandbookViewProps> = ({ onOpenPass }) => {
  const {
    itineraries,
    updateItinerary,
    toggleItineraryItemCompleted,
    updateDayStops,
    addDayStop,
    removeDayStop,
    toggleDayStopCompleted,
    reorderDayStops,
    resetDayItinerary,
    swapDays,
    moveDay,
    bookings,
    passes,
    pocketExpenses,
    addPocketExpense,
    deletePocketExpense,
    exchangeRates,
  } = useTrip();

  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<DayRouteSummary | null>(null);
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState<boolean>(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('notes');
  const [mobileShowMap, setMobileShowMap] = useState<boolean>(true);

  const [isEditingDay, setIsEditingDay] = useState<boolean>(false);
  const [confirmResetPending, setConfirmResetPending] = useState<boolean>(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);

  // Edit form states
  const [editTitle, setEditTitle] = useState<string>('');
  const [editLocation, setEditLocation] = useState<string>('');
  const [editDaylight, setEditDaylight] = useState<string>('');
  const [editWeather, setEditWeather] = useState<string>('');
  const [editClothing, setEditClothing] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editTimelineItems, setEditTimelineItems] = useState<DayItineraryItem[]>([]);

  // Swap / Move Day states
  const [swapTargetDayNumber, setSwapTargetDayNumber] = useState<number>(2);
  const [swapMode, setSwapMode] = useState<'swap' | 'move'>('swap');
  const [syncBookingsWithSwap, setSyncBookingsWithSwap] = useState<boolean>(true);
  const [swapNotice, setSwapNotice] = useState<string | null>(null);

  // Live Weather states
  const [liveWeather, setLiveWeather] = useState<LiveWeatherReport | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState<boolean>(false);

  // Pocket Expense states
  const [isPocketModalOpen, setIsPocketModalOpen] = useState<boolean>(false);
  const [pocketDesc, setPocketDesc] = useState<string>('');
  const [pocketAmount, setPocketAmount] = useState<string>('');
  const [pocketCurrency, setPocketCurrency] = useState<'EUR' | 'CHF' | 'INR'>('EUR');
  const [pocketCategory, setPocketCategory] = useState<PocketExpenseCategory>('food');
  const [pocketPaymentMode, setPocketPaymentMode] = useState<'cash' | 'forex_card' | 'credit_card'>('forex_card');

  // Stop card DOM refs for smooth scroll-into-view when user clicks a map marker
  const stopRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeDay =
    itineraries.find((d) => d.dayNumber === selectedDayNumber) || itineraries[0];
  const targetDay =
    itineraries.find((d) => d.dayNumber === swapTargetDayNumber) ||
    itineraries.find((d) => d.dayNumber !== activeDay.dayNumber) ||
    itineraries[0];

  // Linked bookings for this day
  const dayBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.dayNumber === activeDay.dayNumber ||
          (activeDay.itemIds && activeDay.itemIds.includes(b.id)) ||
          (b.mergedDayNumbers && b.mergedDayNumbers.includes(activeDay.dayNumber))
      ),
    [bookings, activeDay]
  );

  // Live day stops with dynamic hotel name sync from bookings
  const dayStops: ItineraryStop[] = useMemo(() => {
    const rawStops = activeDay.stops || [];
    const dayStay = dayBookings.find((b) => b.category === 'stay');
    if (!dayStay) return rawStops;
    const cleanName = dayStay.title
      .replace(/\s*\((?:Night\s*\d+|2\s*Nights|3\s*Nights|\d+\s*Nights)[^)]*\)/i, '')
      .trim();
    return rawStops.map((stop) => {
      if (stop.category === 'hotel' && !stop.placeId) {
        return {
          ...stop,
          name: cleanName || stop.name,
          address: dayStay.location || stop.address,
        };
      }
      return stop;
    });
  }, [activeDay.stops, dayBookings]);

  // Reset selected stop & add-place panel when switching days
  useEffect(() => {
    setSelectedStopId(null);
    setIsAddPlaceOpen(false);
    setRouteSummary(null);
  }, [activeDay.dayNumber]);

  // Scroll matching timeline stop into view when clicked on map
  const handleSelectStopFromMap = useCallback((stopId: string | null) => {
    setSelectedStopId(stopId);
    if (stopId && stopRefs.current[stopId]) {
      stopRefs.current[stopId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, []);

  // Fetch live weather when active day destination changes
  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      setIsFetchingWeather(true);
      try {
        const report = await fetchLiveWeather(activeDay.location);
        if (isMounted) setLiveWeather(report);
      } catch (err) {
        console.warn('Weather fetch error:', err);
      } finally {
        if (isMounted) setIsFetchingWeather(false);
      }
    };
    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [activeDay.location]);

  // Active day's checklist timeline items
  const timelineItems: DayItineraryItem[] =
    activeDay.timelineItems && activeDay.timelineItems.length > 0
      ? activeDay.timelineItems
      : activeDay.highlights.map((h, i) => ({
          id: `item-${activeDay.dayNumber}-${i}`,
          text: h,
          completed: false,
        }));

  // Linked passes
  const dayPasses = passes.filter(
    (p) =>
      dayBookings.some((b) => b.passId === p.id) ||
      (activeDay.dayNumber === 11 && p.id === 'pass-flight-hyd-cdg')
  );

  // Filter pocket expenses for active day
  const todayPocketExpenses = pocketExpenses.filter(
    (e) => e.dayNumber === activeDay.dayNumber || e.date === activeDay.date
  );
  const todayPocketTotalINR = todayPocketExpenses.reduce(
    (sum, e) => sum + (e.amountINR || 0),
    0
  );

  const dayBannerImage = getItemImage(
    undefined,
    activeDay.title,
    'activity',
    activeDay.location
  );

  const completedStopsCount = dayStops.filter((s) => s.completed).length;

  const biasCenter = useMemo(() => {
    if (dayStops.length === 0) return undefined;
    const avgLat = dayStops.reduce((acc, s) => acc + s.lat, 0) / dayStops.length;
    const avgLng = dayStops.reduce((acc, s) => acc + s.lng, 0) / dayStops.length;
    return { lat: avgLat, lng: avgLng };
  }, [dayStops]);

  // Handlers
  const handleOpenEditModal = () => {
    setEditTitle(activeDay.title);
    setEditLocation(activeDay.location);
    setEditDaylight(activeDay.daylightHours);
    setEditWeather(activeDay.weatherTip);
    setEditClothing(activeDay.clothingTip);
    setEditNotes(activeDay.notes || '');
    setEditTimelineItems(timelineItems.map((item) => ({ ...item })));
    setConfirmResetPending(false);
    setIsEditingDay(true);
  };

  const handleOpenSwapModal = () => {
    const candidateTarget =
      selectedDayNumber === itineraries.length
        ? selectedDayNumber - 1
        : selectedDayNumber + 1;
    setSwapTargetDayNumber(candidateTarget > 0 ? candidateTarget : 1);
    setSwapMode('swap');
    setSyncBookingsWithSwap(true);
    setSwapNotice(null);
    setIsSwapModalOpen(true);
  };

  const handleExecuteSwapOrMove = () => {
    if (swapMode === 'swap') {
      swapDays(activeDay.dayNumber, swapTargetDayNumber, syncBookingsWithSwap);
      setSwapNotice(`Day ${activeDay.dayNumber} and Day ${swapTargetDayNumber} swapped.`);
    } else {
      moveDay(activeDay.dayNumber, swapTargetDayNumber, syncBookingsWithSwap);
      setSwapNotice(`Day ${activeDay.dayNumber} moved to Day ${swapTargetDayNumber}.`);
    }
    const nextSelected = swapTargetDayNumber;
    window.setTimeout(() => {
      setSelectedDayNumber(nextSelected);
      setSwapNotice(null);
      setIsSwapModalOpen(false);
    }, 650);
  };

  const handleSaveDayEdit = () => {
    const updated: DayItinerary = {
      ...activeDay,
      title: editTitle.trim() || activeDay.title,
      location: editLocation.trim() || activeDay.location,
      daylightHours: editDaylight.trim() || activeDay.daylightHours,
      weatherTip: editWeather.trim() || activeDay.weatherTip,
      clothingTip: editClothing.trim() || activeDay.clothingTip,
      notes: editNotes.trim() || undefined,
      timelineItems: editTimelineItems,
      highlights: editTimelineItems.map((item) => item.text),
    };
    updateItinerary(updated);
    setIsEditingDay(false);
  };

  const handleAddTimelineItem = () => {
    setEditTimelineItems([
      ...editTimelineItems,
      {
        id: `item-${activeDay.dayNumber}-${Date.now()}`,
        text: '',
        time: '',
        completed: false,
      },
    ]);
  };

  const handleRemoveTimelineItem = (index: number) => {
    setEditTimelineItems(editTimelineItems.filter((_, idx) => idx !== index));
  };

  const handleUpdateItemField = (index: number, field: 'text' | 'time', value: string) => {
    setEditTimelineItems(
      editTimelineItems.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleConfirmResetDay = () => {
    resetDayItinerary(activeDay.dayNumber);
    setConfirmResetPending(false);
    setIsEditingDay(false);
  };

  const handleOpenPocketModal = () => {
    const loc = activeDay.location.toLowerCase();
    if (
      loc.includes('zurich') ||
      loc.includes('lucerne') ||
      loc.includes('switzerland') ||
      loc.includes('titlis') ||
      loc.includes('engelberg')
    ) {
      setPocketCurrency('CHF');
    } else if (loc.includes('india') || loc.includes('hyderabad')) {
      setPocketCurrency('INR');
    } else {
      setPocketCurrency('EUR');
    }
    setPocketDesc('');
    setPocketAmount('');
    setPocketCategory('food');
    setPocketPaymentMode('forex_card');
    setIsPocketModalOpen(true);
  };

  const handleAddPocketExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(pocketAmount);
    if (!pocketDesc.trim() || isNaN(amtNum) || amtNum <= 0) return;

    let inrVal = amtNum;
    if (pocketCurrency === 'EUR') {
      inrVal = Math.round(amtNum * (exchangeRates.EUR || 106.25));
    } else if (pocketCurrency === 'CHF') {
      inrVal = Math.round(amtNum * (exchangeRates.CHF || 110.5));
    }

    const newExpense: PocketExpense = {
      id: `pocket-${Date.now()}`,
      dayNumber: activeDay.dayNumber,
      date: activeDay.date,
      description: pocketDesc.trim(),
      amount: amtNum,
      currency: pocketCurrency,
      amountINR: inrVal,
      category: pocketCategory,
      paymentMode: pocketPaymentMode,
      createdAt: new Date().toISOString(),
    };
    addPocketExpense(newExpense);
    setIsPocketModalOpen(false);
  };

  const handleRefreshWeather = async () => {
    setIsFetchingWeather(true);
    try {
      const report = await fetchLiveWeather(activeDay.location);
      setLiveWeather(report);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const handleAddPlaceStop = (stop: ItineraryStop) => {
    addDayStop(activeDay.dayNumber, stop);
    setSelectedStopId(stop.id);
  };

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'hotel':
        return <Bed className="w-3.5 h-3.5" />;
      case 'flight':
        return <Plane className="w-3.5 h-3.5" />;
      case 'station':
        return <Train className="w-3.5 h-3.5" />;
      case 'food':
        return <Utensils className="w-3.5 h-3.5" />;
      default:
        return <Ticket className="w-3.5 h-3.5" />;
    }
  };

  const content = (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-28 md:pb-14 space-y-6">
      {/* Top 11-Day Selector Ribbon & Quick Actions */}
      <section className="space-y-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3 px-0.5">
          <div>
            <p className="font-mono-fluid text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/50">
              Interactive Route · Day {activeDay.dayNumber} of {itineraries.length} · {activeDay.dayName}
            </p>
            <h1 className="font-gaegu text-4xl sm:text-5xl font-bold leading-none text-[#ff5e3a] -rotate-1 inline-block mt-1">
              Day-by-Day Handbook
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenSwapModal}
              className="px-3.5 py-2 rounded-xl glass-subcard hover:bg-white text-[#1a1a1a] font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#ff5e3a]" />
              <span>Swap / Move Day</span>
            </button>
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="px-3.5 py-2 rounded-xl bg-[#1a1a1a] hover:bg-[#333333] text-[#fffbf2] font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#ff5e3a]" />
              <span>Edit Day</span>
            </button>
          </div>
        </div>

        {/* Scrollable 11-Day Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
          {itineraries.map((day) => {
            const isSelected = day.dayNumber === selectedDayNumber;
            const dateObj = new Date(day.date);
            const dateDisplay = dateObj.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
            });
            const cityLabel = day.location.split(',')[0].split('→')[0].trim();

            return (
              <button
                key={day.dayNumber}
                type="button"
                onClick={() => setSelectedDayNumber(day.dayNumber)}
                className={`flex flex-col items-start justify-center min-w-[92px] sm:min-w-[104px] min-h-[58px] px-3 py-2 rounded-2xl transition-all duration-150 shrink-0 text-left ${
                  isSelected
                    ? 'glass-pill-active text-white'
                    : 'glass-pill text-slate-700 hover:bg-white/80'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-1.5">
                  <span className="text-[11px] font-bold opacity-85 tabular-nums whitespace-nowrap">
                    Day {day.dayNumber}
                  </span>
                  <span className="text-[10px] opacity-75 tabular-nums whitespace-nowrap">
                    {dateDisplay}
                  </span>
                </div>
                <span className="text-xs font-bold mt-0.5 truncate w-full">
                  {cityLabel}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Mobile Map Visibility Toggle */}
      <div className="flex lg:hidden items-center gap-1 p-1 rounded-2xl bg-[#fffdf8] border border-[#1a1a1a]/12">
        <button
          type="button"
          onClick={() => setMobileShowMap(true)}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
            mobileShowMap
              ? 'bg-[#1a1a1a] text-[#fffbf2]'
              : 'text-[#1a1a1a]/65 hover:text-[#1a1a1a]'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Map &amp; Route</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileShowMap(false)}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
            !mobileShowMap
              ? 'bg-[#1a1a1a] text-[#fffbf2]'
              : 'text-[#1a1a1a]/65 hover:text-[#1a1a1a]'
          }`}
        >
          <ListChecks className="w-3.5 h-3.5" />
          <span>Schedule ({dayStops.length})</span>
        </button>
      </div>

      {/* Main Responsive Split Workspace: Itinerary Left, Sticky Google Map Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* RIGHT COLUMN (Rendered first on mobile when Map tab active, sticky right on desktop) */}
        <div
          className={`lg:col-span-7 lg:order-2 lg:sticky lg:top-[76px] ${
            mobileShowMap ? 'block' : 'hidden lg:block'
          }`}
        >
          {GOOGLE_MAPS_API_KEY ? (
            <ErrorBoundary
              fallbackTitle="Google Map temporarily unavailable"
              fallbackMessage="Your day itinerary and stops remain accessible below."
            >
              <DayMapComponent
                activeDay={activeDay}
                allDays={itineraries}
                stops={dayStops}
                selectedStopId={selectedStopId}
                onSelectStop={handleSelectStopFromMap}
                onSelectDay={(dayNum) => setSelectedDayNumber(dayNum)}
                onOptimizeStops={(reordered) => updateDayStops(activeDay.dayNumber, reordered)}
                onToggleStopCompleted={(stopId) =>
                  toggleDayStopCompleted(activeDay.dayNumber, stopId)
                }
                onRouteSummaryChange={setRouteSummary}
              />
            </ErrorBoundary>
          ) : (
            <div className="rounded-3xl glass-card p-8 text-center space-y-2.5 min-h-[360px] flex flex-col items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Google Maps API key not detected
              </h3>
              <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
                Enable Google Maps Platform or configure <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to load the interactive route map.
              </p>
            </div>
          )}
        </div>

        {/* LEFT COLUMN: Interactive Day Itinerary + Stops + Contextual Details */}
        <div
          className={`lg:col-span-5 lg:order-1 space-y-5 ${
            !mobileShowMap ? 'block' : 'block'
          }`}
        >
          {/* Compact Day Header Card */}
          <div className="rounded-3xl overflow-hidden glass-card">
            <div className="relative h-36 sm:h-40 w-full overflow-hidden bg-slate-200">
              <img
                src={dayBannerImage}
                alt={activeDay.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/35 to-black/15" />
              <div className="absolute inset-x-4 bottom-3.5 text-white space-y-1">
                <div className="flex items-center gap-2 text-xs text-white/85 font-medium">
                  <span>
                    Day {activeDay.dayNumber} ·{' '}
                    {new Date(activeDay.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{activeDay.location}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight leading-snug text-balance">
                  {activeDay.title}
                </h2>
              </div>
            </div>

            {/* Quiet Summary Metadata Strip (Zero-Pill Discipline) */}
            <div className="px-4 py-3 bg-white/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 border-t border-white/80">
              <div className="flex items-center gap-2 tabular-nums">
                <span className="font-semibold text-slate-900">
                  {completedStopsCount}/{dayStops.length} stops visited
                </span>
                {routeSummary && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{formatDistanceMeters(routeSummary.totalDistanceMeters)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDurationMillis(routeSummary.totalDurationMillis)}</span>
                  </>
                )}
              </div>
              {liveWeather && (
                <div className="flex items-center gap-1.5 text-slate-700 font-semibold tabular-nums">
                  <span>{liveWeather.currentTemp}°C</span>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span className="truncate max-w-[110px]">{liveWeather.conditionText}</span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Stop-by-Stop Route Itinerary Card */}
          <div className="rounded-3xl glass-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Day {activeDay.dayNumber} Stops & Route Order
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any stop to focus on Google Maps, or reorder stops below
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPlaceOpen((prev) => !prev)}
                className="px-3.5 py-2 rounded-xl bg-[#ff5e3a] hover:bg-[#e84f2d] text-white text-xs font-extrabold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Place</span>
              </button>
            </div>

            {/* Inline Google Places Search to Add a Stop */}
            {isAddPlaceOpen && (
              <PlaceSearchAddStop
                dayNumber={activeDay.dayNumber}
                dayLocation={activeDay.location}
                biasCenter={biasCenter}
                onAddStop={handleAddPlaceStop}
                onClose={() => setIsAddPlaceOpen(false)}
              />
            )}

            {/* Interactive Stop Sequence List */}
            {dayStops.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#fffbf2] border border-[#1a1a1a]/12 text-center space-y-2">
                <MapPin className="w-6 h-6 text-[#1a1a1a]/40 mx-auto" />
                <p className="text-xs font-semibold text-[#1a1a1a]/75">
                  No map stops planned for Day {activeDay.dayNumber} yet.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddPlaceOpen(true)}
                  className="text-xs font-bold text-[#ff5e3a] hover:text-[#e84f2d] underline"
                >
                  Search Google Places to add your first stop
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {dayStops.map((stop, idx) => {
                  const isSelected = selectedStopId === stop.id;
                  const pinColor = stop.completed
                    ? '#16a34a'
                    : STOP_COLORS[stop.category] || '#ff5e3a';
                  const leg = routeSummary?.legs?.[idx];

                  return (
                    <React.Fragment key={stop.id}>
                      <div
                        ref={(el) => {
                          stopRefs.current[stop.id] = el;
                        }}
                        onClick={() => {
                          setSelectedStopId(stop.id);
                          setMobileShowMap(true);
                        }}
                        className={`group p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? 'bg-white border-[#ff5e3a] shadow-sm ring-2 ring-[#ff5e3a]/15'
                            : 'bg-[#fffbf2]/80 hover:bg-white border-[#1a1a1a]/10'
                        }`}
                      >
                        {/* Numbered Pin Marker */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDayStopCompleted(activeDay.dayNumber, stop.id);
                          }}
                          className="w-8 h-8 rounded-full text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs transition-transform active:scale-95"
                          style={{ backgroundColor: pinColor }}
                          title={stop.completed ? 'Mark stop as unvisited' : 'Mark stop as visited'}
                          aria-label={stop.completed ? 'Mark stop as unvisited' : 'Mark stop as visited'}
                        >
                          {stop.completed ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                        </button>

                        {/* Stop Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                            <span className="text-slate-600 flex items-center gap-1">
                              {renderCategoryIcon(stop.category)}
                              <span>{STOP_CATEGORY_LABELS[stop.category] || 'Stop'}</span>
                            </span>
                            {stop.time && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums text-sky-800 font-semibold">
                                  {stop.time}
                                </span>
                              </>
                            )}
                          </div>

                          <h4
                            className={`text-sm font-bold mt-0.5 leading-snug ${
                              stop.completed ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {stop.name}
                          </h4>

                          {stop.address && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {stop.address}
                            </p>
                          )}
                        </div>

                        {/* Reorder & Remove Controls */}
                        <div
                          className="flex flex-col items-center gap-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => reorderDayStops(activeDay.dayNumber, idx, idx - 1)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                              title="Move stop earlier"
                              aria-label="Move stop earlier"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === dayStops.length - 1}
                              onClick={() => reorderDayStops(activeDay.dayNumber, idx, idx + 1)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                              title="Move stop later"
                              aria-label="Move stop later"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedStopId === stop.id) setSelectedStopId(null);
                                removeDayStop(activeDay.dayNumber, stop.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Remove stop"
                              aria-label="Remove stop"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Route Leg Connector Between Stops */}
                      {idx < dayStops.length - 1 && (
                        <div className="flex items-center gap-2.5 pl-7 py-1">
                          <div className="w-px h-5 bg-slate-300" />
                          {leg ? (
                            <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                              {formatDurationMillis(leg.durationMillis)} ·{' '}
                              {formatDistanceMeters(leg.distanceMeters)}
                              {leg.isGeodesicFallback ? ' (direct)' : ''}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Next leg</span>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* Secondary Day Details Tabs (Keeps existing Handbook tools clean & uncluttered) */}
          <div className="rounded-3xl glass-card p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100/90">
              {(
                [
                  { id: 'notes', label: 'Plan' },
                  { id: 'weather', label: 'Weather' },
                  { id: 'logistics', label: 'Transit' },
                  { id: 'expenses', label: 'Spend' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id)}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    detailTab === t.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Experiences Checklist & Notes */}
            {detailTab === 'notes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    <span>Curated Experiences Checklist</span>
                  </h4>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {timelineItems.filter((i) => i.completed).length}/{timelineItems.length} done
                  </span>
                </div>

                <div className="space-y-2.5">
                  {timelineItems.map((item, index) => {
                    const isDone = Boolean(item.completed);
                    return (
                      <div
                        key={item.id || index}
                        onClick={() =>
                          toggleItineraryItemCompleted(activeDay.dayNumber, item.id || index)
                        }
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/70 transition-colors cursor-pointer select-none"
                      >
                        <div className="mt-0.5 shrink-0">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-sky-500 bg-white" />
                          )}
                        </div>
                        <div className="flex-1 text-xs leading-relaxed">
                          {item.time && (
                            <span className="font-mono font-semibold text-sky-800 mr-2 tabular-nums">
                              {item.time}
                            </span>
                          )}
                          <span
                            className={
                              isDone
                                ? 'line-through text-slate-400 font-medium'
                                : 'text-slate-800 font-semibold'
                            }
                          >
                            {item.text}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeDay.notes && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>Personal Notes</span>
                    </div>
                    <p className="whitespace-pre-line text-slate-800 leading-relaxed">
                      {activeDay.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Live Weather, Daylight & Clothing */}
            {detailTab === 'weather' && (
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 flex items-start gap-2.5">
                    <Sun className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 block">
                        Daylight Window
                      </span>
                      <span className="text-xs font-bold text-slate-900 block mt-0.5">
                        {activeDay.daylightHours}
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 flex items-start gap-2.5">
                    <ThermometerSnowflake className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 block">
                        Weather Advisory
                      </span>
                      <span className="text-xs font-bold text-slate-900 block mt-0.5">
                        {activeDay.weatherTip}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/70 flex items-start gap-2.5 text-slate-800">
                  <Shirt className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-bold">Clothing Guide:</strong> {activeDay.clothingTip}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-900">
                      Live Forecast · {liveWeather ? liveWeather.city : activeDay.location.split(',')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={handleRefreshWeather}
                      disabled={isFetchingWeather}
                      className="px-2 py-1 rounded-lg text-sky-700 hover:bg-sky-100 text-xs font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingWeather ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {liveWeather ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums">
                      <div className="bg-white/90 p-2.5 rounded-xl border border-sky-100">
                        <span className="text-[11px] text-slate-500 block">Current</span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">
                          {liveWeather.currentTemp}°C
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Feels {liveWeather.apparentTemp}°C
                        </span>
                      </div>
                      <div className="bg-white/90 p-2.5 rounded-xl border border-sky-100">
                        <span className="text-[11px] text-slate-500 block">Sky</span>
                        <span className="text-xs font-bold text-slate-900 block mt-1 truncate">
                          {liveWeather.conditionText}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          H {liveWeather.maxTemp}° / L {liveWeather.minTemp}°
                        </span>
                      </div>
                      <div className="bg-white/90 p-2.5 rounded-xl border border-sky-100">
                        <span className="text-[11px] text-slate-500 block">Precipitation</span>
                        <div className="flex items-center gap-1 mt-1 font-bold text-slate-900">
                          {liveWeather.snowfallSumCm > 0 ? (
                            <>
                              <CloudSnow className="w-3.5 h-3.5 text-cyan-600" />
                              <span>{liveWeather.snowfallSumCm} cm</span>
                            </>
                          ) : (
                            <>
                              <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                              <span>{liveWeather.precipitationProbability}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="bg-white/90 p-2.5 rounded-xl border border-sky-100">
                        <span className="text-[11px] text-slate-500 block">Sun</span>
                        <span className="text-xs font-bold text-slate-900 block mt-0.5">
                          Up {liveWeather.sunrise || '--:--'}
                        </span>
                        <span className="text-[11px] text-slate-600 block">
                          Set {liveWeather.sunset || '--:--'}
                        </span>
                      </div>
                    </div>
                  ) : isFetchingWeather ? (
                    <p className="text-xs text-sky-700 py-2">Loading forecast...</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Offline mode. Planned advisory: {activeDay.weatherTip}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Departure Assistant & Linked Passes */}
            {detailTab === 'logistics' && (
              <div className="space-y-4">
                <ErrorBoundary fallbackTitle="Departure Assistant unavailable">
                  <DepartureAssistantCard
                    dayNumber={activeDay.dayNumber}
                    customStops={dayStops}
                  />
                </ErrorBoundary>

                {dayPasses.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-sky-600" />
                      <span>Linked Digital Vouchers ({dayPasses.length})</span>
                    </h4>
                    {dayPasses.map((pass) => (
                      <button
                        key={pass.id}
                        type="button"
                        onClick={() => onOpenPass(pass.id)}
                        className="w-full text-left p-3.5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/80 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: pass.themeColor }}
                          >
                            {pass.type === 'boarding_pass' ? (
                              <Plane className="w-5 h-5" />
                            ) : pass.type === 'hotel_reservation' ? (
                              <Bed className="w-5 h-5" />
                            ) : (
                              <Ticket className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {pass.title}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {pass.subtitle} · {pass.time}
                            </p>
                            <span className="text-[11px] font-mono font-semibold text-sky-800 block">
                              Ref: {pass.bookingReference}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Daily Pocket Expenses */}
            {detailTab === 'expenses' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Day {activeDay.dayNumber} Pocket Expenses
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-emerald-800 tabular-nums">
                      ₹{todayPocketTotalINR.toLocaleString('en-IN')}
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenPocketModal}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Expense</span>
                    </button>
                  </div>
                </div>

                {todayPocketExpenses.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-white/70 border border-slate-200/70 text-center text-xs text-slate-500">
                    No incidental expenses logged for Day {activeDay.dayNumber}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayPocketExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="p-3 rounded-2xl bg-white/85 border border-slate-200/80 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                            {expense.category === 'food' ? (
                              <Utensils className="w-4 h-4" />
                            ) : expense.category === 'transport' ? (
                              <Navigation className="w-4 h-4" />
                            ) : expense.category === 'shopping' ? (
                              <ShoppingBag className="w-4 h-4" />
                            ) : (
                              <Coins className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {expense.description}
                            </p>
                            <p className="text-[11px] text-slate-500 capitalize">
                              {expense.category} · {expense.paymentMode.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-900 block">
                              {expense.currency === 'EUR'
                                ? '€'
                                : expense.currency === 'CHF'
                                ? 'CHF '
                                : '₹'}
                              {expense.amount}
                            </span>
                            <span className="text-[11px] text-emerald-800 font-semibold block">
                              ≈ ₹{expense.amountINR.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => deletePocketExpense(expense.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Move / Swap Day Modal */}
      {isSwapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="glass-card-elevated rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs text-indigo-700 font-semibold block">
                  Itinerary Reorganizer
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Switch or Move Day {activeDay.dayNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSwapModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {swapNotice && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{swapNotice}</span>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200 text-xs space-y-1">
              <span className="text-sky-800 font-semibold block">Selected Day</span>
              <p className="font-bold text-slate-900">
                Day {activeDay.dayNumber} (
                {new Date(activeDay.date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
                ): {activeDay.title}
              </p>
              <p className="text-slate-600">{activeDay.location}</p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-slate-700 font-semibold block">Action Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSwapMode('swap')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-colors ${
                    swapMode === 'swap'
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Swap Two Days
                </button>
                <button
                  type="button"
                  onClick={() => setSwapMode('move')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-colors ${
                    swapMode === 'move'
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Move & Shift
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-slate-700 font-semibold block">Target Day</label>
              <select
                value={swapTargetDayNumber}
                onChange={(e) => setSwapTargetDayNumber(Number(e.target.value))}
                className="w-full bg-white rounded-xl px-3 py-2.5 text-slate-900 font-semibold text-xs border border-slate-300"
              >
                {itineraries
                  .filter((d) => d.dayNumber !== activeDay.dayNumber)
                  .map((d) => (
                    <option key={d.dayNumber} value={d.dayNumber}>
                      Day {d.dayNumber} (
                      {new Date(d.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      ): {d.title}
                    </option>
                  ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={syncBookingsWithSwap}
                onChange={(e) => setSyncBookingsWithSwap(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Update linked hotel/flight bookings to match new date</span>
            </label>

            <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-xs space-y-1">
              <p className="font-semibold text-indigo-950">Preview</p>
              <p className="text-slate-700 truncate">
                Day {activeDay.dayNumber} → {targetDay?.title}
              </p>
              <p className="text-slate-700 truncate">
                Day {swapTargetDayNumber} → {activeDay.title}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleExecuteSwapOrMove}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Confirm {swapMode === 'swap' ? 'Swap' : 'Move'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSwapModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Day Plan Modal */}
      {isEditingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="glass-card-elevated rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs text-sky-800 font-semibold block">
                  Itinerary Customizer
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Day {activeDay.dayNumber} Plan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingDay(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Day Title / Theme
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 font-semibold text-xs border border-slate-300"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Destination / Route
                </label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 font-semibold text-xs border border-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold">
                  Checklist Items ({editTimelineItems.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddTimelineItem}
                  className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 hover:bg-sky-200 font-bold text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {editTimelineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={item.time || ''}
                      onChange={(e) => handleUpdateItemField(idx, 'time', e.target.value)}
                      placeholder="09:30 AM"
                      className="w-20 shrink-0 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-800 font-semibold text-[11px] border border-slate-200 text-center"
                    />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => handleUpdateItemField(idx, 'text', e.target.value)}
                      placeholder="Activity description..."
                      className="flex-1 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-900 font-medium text-xs border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTimelineItem(idx)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Daylight Window</label>
                <input
                  type="text"
                  value={editDaylight}
                  onChange={(e) => setEditDaylight(e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 font-medium text-xs border border-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Weather Advisory</label>
                <input
                  type="text"
                  value={editWeather}
                  onChange={(e) => setEditWeather(e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 font-medium text-xs border border-slate-200"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="text-slate-600 font-semibold block mb-1">Clothing Guide</label>
              <input
                type="text"
                value={editClothing}
                onChange={(e) => setEditClothing(e.target.value)}
                className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 font-medium text-xs border border-slate-200"
              />
            </div>

            <div className="text-xs">
              <label className="text-slate-700 font-semibold block mb-1">
                Personal Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Dinner reservations, pickup points, reminders..."
                className="w-full bg-white rounded-xl p-3 text-slate-900 text-xs border border-slate-300"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDayEdit}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Day Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDay(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                {confirmResetPending ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-rose-700 font-semibold">Reset Day {activeDay.dayNumber} stops & plan?</span>
                    <button
                      type="button"
                      onClick={handleConfirmResetDay}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetPending(false)}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetPending(true)}
                    className="text-xs text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Day {activeDay.dayNumber} to Default</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pocket Expense Logging Modal */}
      {isPocketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="glass-card-elevated rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs text-emerald-700 font-semibold block">
                  Day {activeDay.dayNumber} Expense
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Log Pocket Expense
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPocketModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPocketExpense} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'food', label: 'Food', icon: Utensils },
                  { id: 'transport', label: 'Transit', icon: Navigation },
                  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
                  { id: 'activity', label: 'Activity', icon: Ticket },
                  { id: 'misc', label: 'Misc', icon: Coins },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSel = pocketCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPocketCategory(cat.id as PocketExpenseCategory)}
                      className={`p-2.5 rounded-xl flex flex-col items-center gap-1 border transition-colors ${
                        isSel
                          ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 font-semibold hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={pocketDesc}
                  onChange={(e) => setPocketDesc(e.target.value)}
                  placeholder="Coffee, metro ticket, souvenir..."
                  className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 font-medium border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={pocketAmount}
                    onChange={(e) => setPocketAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 font-bold border border-slate-300 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Currency</label>
                  <select
                    value={pocketCurrency}
                    onChange={(e) => setPocketCurrency(e.target.value as 'EUR' | 'CHF' | 'INR')}
                    className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 font-semibold border border-slate-300"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="CHF">CHF</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>

              {pocketAmount && !isNaN(parseFloat(pocketAmount)) && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between tabular-nums">
                  <span className="text-emerald-900 font-semibold">Estimated INR</span>
                  <span className="font-bold text-emerald-950">
                    ≈ ₹
                    {pocketCurrency === 'EUR'
                      ? Math.round(parseFloat(pocketAmount) * (exchangeRates.EUR || 106.25)).toLocaleString('en-IN')
                      : pocketCurrency === 'CHF'
                      ? Math.round(parseFloat(pocketAmount) * (exchangeRates.CHF || 110.5)).toLocaleString('en-IN')
                      : parseFloat(pocketAmount).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'forex_card', label: 'Forex Card' },
                  { id: 'cash', label: 'Cash' },
                  { id: 'credit_card', label: 'Credit Card' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setPocketPaymentMode(mode.id as 'cash' | 'forex_card' | 'credit_card')
                    }
                    className={`py-2 px-2 rounded-xl text-center text-xs border transition-colors ${
                      pocketPaymentMode === mode.id
                        ? 'bg-slate-900 text-white font-bold border-slate-900'
                        : 'bg-white text-slate-700 font-semibold border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPocketModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return content;
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      libraries={['marker', 'routes', 'places']}
      language="en"
      region="EU"
    >
      {content}
    </APIProvider>
  );
};
