import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  MapPin, 
  Ticket, 
  ChevronRight, 
  ThermometerSnowflake, 
  Shirt, 
  Clock, 
  Plane, 
  Bed, 
  Calendar,
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  X,
  Sparkles,
  FileText,
  ArrowLeftRight,
  CloudSnow,
  CloudRain,
  Navigation,
  Wallet,
  Coins,
  Receipt,
  RefreshCw,
  Utensils,
  ShoppingBag
} from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { getItemImage } from '../data/travelImages';
import { DayItinerary, DayItineraryItem, PocketExpense, PocketExpenseCategory } from '../types';
import { DayMapComponent } from '../components/DayMapComponent';
import { DepartureAssistantCard } from '../components/DepartureAssistantCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { fetchLiveWeather, LiveWeatherReport } from '../services/weatherService';

interface DayByDayHandbookViewProps {
  onOpenPass: (passId: string) => void;
}

export const DayByDayHandbookView: React.FC<DayByDayHandbookViewProps> = ({ onOpenPass }) => {
  const { 
    itineraries, 
    updateItinerary, 
    toggleItineraryItemCompleted, 
    resetDayItinerary, 
    swapDays,
    moveDay,
    bookings, 
    passes,
    pocketExpenses,
    addPocketExpense,
    deletePocketExpense,
    exchangeRates
  } = useTrip();

  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [isEditingDay, setIsEditingDay] = useState<boolean>(false);
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

  const activeDay = itineraries.find(d => d.dayNumber === selectedDayNumber) || itineraries[0];
  const targetDay = itineraries.find(d => d.dayNumber === swapTargetDayNumber) || itineraries.find(d => d.dayNumber !== activeDay.dayNumber) || itineraries[0];

  // Fetch live weather when active day destination changes
  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      setIsFetchingWeather(true);
      try {
        const report = await fetchLiveWeather(activeDay.location);
        if (isMounted) {
          setLiveWeather(report);
        }
      } catch (err) {
        console.warn('Weather fetch error:', err);
      } finally {
        if (isMounted) {
          setIsFetchingWeather(false);
        }
      }
    };
    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [activeDay.location]);

  // Active day's timeline items with backward-compatibility fallback
  const timelineItems: DayItineraryItem[] = activeDay.timelineItems && activeDay.timelineItems.length > 0
    ? activeDay.timelineItems
    : activeDay.highlights.map((h, i) => ({
        id: `item-${activeDay.dayNumber}-${i}`,
        text: h,
        completed: false,
      }));

  // Linked bookings for this day (by day number, explicit itemIds link, or merged multi-night stay)
  const dayBookings = bookings.filter(b => 
    b.dayNumber === activeDay.dayNumber || 
    (activeDay.itemIds && activeDay.itemIds.includes(b.id)) ||
    (b.mergedDayNumbers && b.mergedDayNumbers.includes(activeDay.dayNumber))
  );

  // Linked passes
  const dayPasses = passes.filter(p => {
    return dayBookings.some(b => b.passId === p.id) || (activeDay.dayNumber === 11 && p.id === 'pass-flight-hyd-cdg');
  });

  // Filter pocket expenses for active day
  const todayPocketExpenses = pocketExpenses.filter(e => 
    e.dayNumber === activeDay.dayNumber || e.date === activeDay.date
  );

  const todayPocketTotalINR = todayPocketExpenses.reduce((sum, e) => sum + (e.amountINR || 0), 0);

  const dayBannerImage = getItemImage(activeDay.title, 'activity', activeDay.location);

  // Open the Editor for the current active day
  const handleOpenEditModal = () => {
    setEditTitle(activeDay.title);
    setEditLocation(activeDay.location);
    setEditDaylight(activeDay.daylightHours);
    setEditWeather(activeDay.weatherTip);
    setEditClothing(activeDay.clothingTip);
    setEditNotes(activeDay.notes || '');
    setEditTimelineItems(timelineItems.map(item => ({ ...item })));
    setIsEditingDay(true);
  };

  // Open the Swap / Move modal
  const handleOpenSwapModal = () => {
    const candidateTarget = selectedDayNumber === itineraries.length 
      ? selectedDayNumber - 1 
      : selectedDayNumber + 1;
    setSwapTargetDayNumber(candidateTarget > 0 ? candidateTarget : 1);
    setSwapMode('swap');
    setSyncBookingsWithSwap(true);
    setSwapNotice(null);
    setIsSwapModalOpen(true);
  };

  // Execute Swap or Move
  const handleExecuteSwapOrMove = () => {
    if (swapMode === 'swap') {
      swapDays(activeDay.dayNumber, swapTargetDayNumber, syncBookingsWithSwap);
      setSwapNotice(`Day ${activeDay.dayNumber} and Day ${swapTargetDayNumber} swapped successfully!`);
    } else {
      moveDay(activeDay.dayNumber, swapTargetDayNumber, syncBookingsWithSwap);
      setSwapNotice(`Day ${activeDay.dayNumber} moved to Day ${swapTargetDayNumber} position!`);
    }

    const nextSelected = swapTargetDayNumber;
    setTimeout(() => {
      setSelectedDayNumber(nextSelected);
      setSwapNotice(null);
      setIsSwapModalOpen(false);
    }, 700);
  };

  // Quick 1-tap swap with adjacent day
  const handleQuickSwap = (adjacentDayNum: number) => {
    if (adjacentDayNum < 1 || adjacentDayNum > itineraries.length) return;
    swapDays(activeDay.dayNumber, adjacentDayNum, true);
    setSelectedDayNumber(adjacentDayNum);
  };

  // Save changes back to TripContext
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
      highlights: editTimelineItems.map(item => item.text),
    };

    updateItinerary(updated);
    setIsEditingDay(false);
  };

  // Add a new activity stop
  const handleAddTimelineItem = () => {
    const newItem: DayItineraryItem = {
      id: `item-${activeDay.dayNumber}-${Date.now()}`,
      text: '',
      time: '',
      completed: false,
    };
    setEditTimelineItems([...editTimelineItems, newItem]);
  };

  // Remove an activity stop
  const handleRemoveTimelineItem = (index: number) => {
    setEditTimelineItems(editTimelineItems.filter((_, idx) => idx !== index));
  };

  // Update a single stop's field
  const handleUpdateItemField = (index: number, field: 'text' | 'time', value: string) => {
    setEditTimelineItems(editTimelineItems.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Reset to default baseline itinerary
  const handleResetToDefault = () => {
    if (confirm(`Reset Day ${activeDay.dayNumber} back to the original default itinerary?`)) {
      resetDayItinerary(activeDay.dayNumber);
      setIsEditingDay(false);
    }
  };

  // Open pocket expense modal with contextual currency
  const handleOpenPocketModal = () => {
    const loc = activeDay.location.toLowerCase();
    if (loc.includes('zurich') || loc.includes('lucerne') || loc.includes('switzerland') || loc.includes('titlis') || loc.includes('engelberg')) {
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

  // Add new pocket expense
  const handleAddPocketExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(pocketAmount);
    if (!pocketDesc.trim() || isNaN(amtNum) || amtNum <= 0) return;

    let inrVal = amtNum;
    if (pocketCurrency === 'EUR') {
      inrVal = Math.round(amtNum * (exchangeRates.EUR || 106.25));
    } else if (pocketCurrency === 'CHF') {
      inrVal = Math.round(amtNum * (exchangeRates.CHF || 110.50));
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

  // Manual refresh of live weather
  const handleRefreshWeather = async () => {
    setIsFetchingWeather(true);
    try {
      const report = await fetchLiveWeather(activeDay.location);
      setLiveWeather(report);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  return (
    <div className="space-y-6 pb-36 px-5 sm:px-6 pt-4 max-w-xl mx-auto">
      {/* Horizontal Day Selector Ribbon with Large Bold Buttons */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Feb 2027 • 11-Day Journey
          </span>
          <span className="text-xs text-sky-800 font-black">
            Day {activeDay.dayNumber} of 11
          </span>
        </div>

        <div className="flex space-x-2.5 overflow-x-auto pb-2 scrollbar-none">
          {itineraries.map(day => {
            const isSelected = day.dayNumber === selectedDayNumber;
            const dateObj = new Date(day.date);
            const dateDisplay = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

            return (
              <button
                key={day.dayNumber}
                onClick={() => setSelectedDayNumber(day.dayNumber)}
                className={`flex flex-col items-center justify-center min-w-[80px] py-3.5 px-2 rounded-2xl transition-all duration-200 active:scale-95 shadow-xs ${
                  isSelected
                    ? 'glass-pill-active font-black'
                    : 'glass-pill text-slate-700 hover:text-slate-900'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider opacity-85 leading-none font-bold">
                  Day {day.dayNumber}
                </span>
                <span className="text-sm font-black mt-1 leading-none">
                  {dateDisplay}
                </span>
                <span className="text-[10px] opacity-80 mt-1 truncate max-w-[68px] font-bold">
                  {day.location.split(',')[0].replace(' → ', '→')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Shift & Swap Navigation Bar */}
        <div className="flex items-center justify-between px-1 text-xs pt-0.5">
          <button
            type="button"
            disabled={activeDay.dayNumber <= 1}
            onClick={() => handleQuickSwap(activeDay.dayNumber - 1)}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] flex items-center space-x-1 transition active:scale-95 ${
              activeDay.dayNumber > 1
                ? 'glass-subcard hover:bg-white text-slate-700'
                : 'opacity-30 cursor-not-allowed text-slate-400'
            }`}
            title={`Swap Day ${activeDay.dayNumber} with Day ${activeDay.dayNumber - 1}`}
          >
            <span>← Swap Day {activeDay.dayNumber - 1}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenSwapModal}
            className="text-indigo-700 hover:text-indigo-950 font-black text-[11px] flex items-center space-x-1.5 py-1 px-2.5 rounded-xl glass-subcard transition active:scale-95 shadow-2xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
            <span>Switch / Move Day</span>
          </button>

          <button
            type="button"
            disabled={activeDay.dayNumber >= itineraries.length}
            onClick={() => handleQuickSwap(activeDay.dayNumber + 1)}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] flex items-center space-x-1 transition active:scale-95 ${
              activeDay.dayNumber < itineraries.length
                ? 'glass-subcard hover:bg-white text-slate-700'
                : 'opacity-30 cursor-not-allowed text-slate-400'
            }`}
            title={`Swap Day ${activeDay.dayNumber} with Day ${activeDay.dayNumber + 1}`}
          >
            <span>Swap Day {activeDay.dayNumber + 1} →</span>
          </button>
        </div>
      </div>

      {/* GetYourGuide Style Active Day Destination Card with Image Header */}
      <div className="rounded-[2.2rem] overflow-hidden glass-card shadow-lg relative group">
        {/* Destination Photo Header */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-slate-200">
          <img 
            src={dayBannerImage} 
            alt={activeDay.title} 
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-black/20" />

          {/* Floating Day & Action Tags */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Day {activeDay.dayNumber} • {new Date(activeDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            </span>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleOpenSwapModal}
                className="px-2.5 py-1.5 rounded-full bg-white/85 hover:bg-white text-indigo-950 text-xs font-black flex items-center space-x-1 backdrop-blur-md transition active:scale-95 shadow-md"
                title="Swap or Move this day to another date"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
                <span>Move</span>
              </button>
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="px-2.5 py-1.5 rounded-full bg-white/85 hover:bg-white text-slate-900 text-xs font-black flex items-center space-x-1 backdrop-blur-md transition active:scale-95 shadow-md"
                title="Edit Day Title, Activities & Weather"
              >
                <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                <span>Edit</span>
              </button>
              <span className="px-2.5 py-1.5 rounded-full bg-sky-500/90 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider shadow-sm">
                {activeDay.dayName}
              </span>
            </div>
          </div>

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-white/90">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>{activeDay.location}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1 tracking-tight leading-snug drop-shadow-sm">
              {activeDay.title}
            </h2>
          </div>
        </div>

        {/* Day Weather & Daylight Widgets (GYG Style) */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-2xl glass-subcard flex items-start space-x-3">
              <Sun className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-amber-800 font-black uppercase tracking-wider block">Daylight Window</span>
                <span className="text-sm font-black text-slate-900 block mt-1">{activeDay.daylightHours}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl glass-subcard flex items-start space-x-3">
              <ThermometerSnowflake className="w-5 h-5 text-cyan-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-cyan-800 font-black uppercase tracking-wider block">Weather Advisory</span>
                <span className="text-sm font-black text-slate-900 block truncate mt-1">{activeDay.weatherTip}</span>
              </div>
            </div>
          </div>

          {/* Clothing & Layering Tip */}
          <div className="p-4 rounded-2xl glass-subcard flex items-center space-x-3 text-xs text-indigo-950 font-semibold">
            <Shirt className="w-5 h-5 text-indigo-700 shrink-0" />
            <span><strong>Clothing Guide:</strong> {activeDay.clothingTip}</span>
          </div>

          {/* Live Open-Meteo Satellite Weather Forecast */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50/90 to-indigo-50/90 border border-sky-200/80 text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-black text-sky-900 uppercase tracking-wider text-[10px]">
                <Sparkles className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                <span>Live Open-Meteo Forecast • {liveWeather ? liveWeather.city : activeDay.location.split(',')[0]}</span>
              </div>
              <button
                type="button"
                onClick={handleRefreshWeather}
                disabled={isFetchingWeather}
                className="p-1 rounded-lg text-sky-700 hover:text-sky-900 hover:bg-sky-100/60 transition active:scale-95 flex items-center space-x-1 text-[10px] font-bold"
                title="Refresh Live Weather"
              >
                <RefreshCw className={`w-3 h-3 ${isFetchingWeather ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {liveWeather ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-slate-800">
                <div className="bg-white/80 p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] text-slate-500 font-bold block">Current Temp</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5">
                    {liveWeather.currentTemp}°C
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Feels {liveWeather.apparentTemp}°C
                  </span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] text-slate-500 font-bold block">Conditions</span>
                  <span className="text-xs font-black text-slate-900 block mt-1 truncate">
                    {liveWeather.conditionText}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    H: {liveWeather.maxTemp}° • L: {liveWeather.minTemp}°
                  </span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] text-slate-500 font-bold block">
                    {liveWeather.isSnowing || liveWeather.snowfallSumCm > 0 ? 'Snow Alert' : 'Rain Chance'}
                  </span>
                  <div className="flex items-center space-x-1 mt-0.5">
                    {liveWeather.snowfallSumCm > 0 ? (
                      <>
                        <CloudSnow className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                        <span className="text-xs font-black text-slate-900">{liveWeather.snowfallSumCm} cm snow</span>
                      </>
                    ) : (
                      <>
                        <CloudRain className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span className="text-xs font-black text-slate-900">{liveWeather.precipitationProbability}% precip</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Probability</span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-sky-100">
                  <span className="text-[10px] text-slate-500 font-bold block">Sun Times</span>
                  <span className="text-[11px] font-black text-slate-900 block mt-0.5">
                    🌅 {liveWeather.sunrise || '--:--'}
                  </span>
                  <span className="text-[11px] font-black text-slate-700 block">
                    🌇 {liveWeather.sunset || '--:--'}
                  </span>
                </div>
              </div>
            ) : isFetchingWeather ? (
              <div className="py-2.5 text-center text-xs font-bold text-sky-700 animate-pulse">
                Fetching real-time satellite weather data...
              </div>
            ) : (
              <div className="py-1 text-center text-xs text-slate-500 font-medium">
                Live forecast available when online. Using planned advisory: {activeDay.weatherTip}
              </div>
            )}
          </div>

          {/* Custom Day Notes & Reminders (if present) */}
          {activeDay.notes && (
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-xs text-amber-950 font-medium space-y-1">
              <div className="flex items-center space-x-1.5 font-black text-amber-900 uppercase tracking-wider text-[10px]">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>Personal Day Reminders & Notes:</span>
              </div>
              <p className="whitespace-pre-line text-slate-800 font-bold leading-relaxed">
                {activeDay.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Visual Map for Today's Route & Stops */}
      <ErrorBoundary fallbackTitle="Map currently unavailable" fallbackMessage="Map view can be opened directly in Google Maps.">
        <DayMapComponent activeDay={activeDay} dayBookings={dayBookings} />
      </ErrorBoundary>

      {/* Smart Departure Assistant Card (Dynamic Transit & Departure Time) */}
      <ErrorBoundary fallbackTitle="Departure Assistant unavailable">
        <DepartureAssistantCard dayNumber={activeDay.dayNumber} />
      </ErrorBoundary>

      {/* Interactive Curated Experiences Plan (Option C: Checklist + Time Tags) */}
      <div className="p-6 sm:p-7 rounded-[2rem] glass-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-sky-700" />
            <span>Curated Experiences Plan</span>
          </h3>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-slate-500">
              {timelineItems.filter(i => i.completed).length}/{timelineItems.length} Done
            </span>
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="text-sky-800 hover:text-sky-950 font-black text-xs flex items-center space-x-1"
            >
              <Edit3 className="w-3 h-3" />
              <span>Customize</span>
            </button>
          </div>
        </div>

        <div className="relative pl-7 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300">
          {timelineItems.map((item, index) => {
            const isDone = Boolean(item.completed);

            return (
              <div 
                key={item.id || index} 
                className="relative group flex items-start space-x-3 cursor-pointer select-none"
                onClick={() => toggleItineraryItemCompleted(activeDay.dayNumber, item.id || index)}
              >
                {/* Interactive Completion Checkmark Icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItineraryItemCompleted(activeDay.dayNumber, item.id || index);
                  }}
                  className="absolute -left-[27px] top-0.5 transition active:scale-90"
                  title={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100 shadow-xs" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-white border-2 border-sky-500 shadow-xs group-hover:scale-110 transition" />
                  )}
                </button>

                <div className="flex-1">
                  {item.time && (
                    <span className="inline-block px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-black mr-2 uppercase tracking-wide">
                      {item.time}
                    </span>
                  )}
                  <span className={`text-sm leading-relaxed transition ${
                    isDone 
                      ? 'line-through text-slate-400 font-medium' 
                      : 'text-slate-900 font-bold'
                  }`}>
                    {item.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Pocket Expenses Section (On-the-go incidentals) */}
      <div className="p-6 sm:p-7 rounded-[2rem] glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Today's Pocket Expenses
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black text-emerald-800">
              ₹{todayPocketTotalINR.toLocaleString('en-IN')}
            </span>
            <button
              type="button"
              onClick={handleOpenPocketModal}
              className="px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black text-[11px] flex items-center space-x-1 transition active:scale-95 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Expense</span>
            </button>
          </div>
        </div>

        {todayPocketExpenses.length === 0 ? (
          <div className="p-4 rounded-2xl glass-subcard text-center space-y-1">
            <p className="text-xs font-bold text-slate-600">No incidental expenses logged for Day {activeDay.dayNumber}.</p>
            <p className="text-[11px] text-slate-500">Track on-the-go coffees, snacks, metro tickets, or souvenirs in EUR/CHF/INR.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayPocketExpenses.map(expense => (
              <div key={expense.id} className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
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
                    <h4 className="text-xs font-black text-slate-900 truncate">{expense.description}</h4>
                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
                      <span className="capitalize font-bold">{expense.category}</span>
                      <span>•</span>
                      <span className="capitalize font-semibold">{expense.paymentMode.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2.5 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 block">
                      {expense.currency === 'EUR' ? '€' : expense.currency === 'CHF' ? 'CHF ' : '₹'}{expense.amount}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 block">
                      ≈ ₹{expense.amountINR.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deletePocketExpense(expense.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
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

      {/* Passes & Tickets Linked to This Day (GYG Ticket Voucher Style) */}
      {dayPasses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-black text-slate-800 uppercase tracking-wider text-xs flex items-center space-x-2">
              <Ticket className="w-4 h-4 text-sky-700" />
              <span>Digital Vouchers For Today ({dayPasses.length})</span>
            </span>
          </div>

          <div className="space-y-3">
            {dayPasses.map(pass => (
              <div
                key={pass.id}
                onClick={() => onOpenPass(pass.id)}
                className="p-5 rounded-[2rem] glass-card hover:bg-white/80 cursor-pointer transition active:scale-98 flex items-center justify-between"
              >
                <div className="flex items-center space-x-4">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0"
                    style={{ backgroundColor: pass.themeColor }}
                  >
                    {pass.type === 'boarding_pass' ? <Plane className="w-6 h-6" /> : pass.type === 'hotel_reservation' ? <Bed className="w-6 h-6" /> : <Ticket className="w-6 h-6" />}
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-900">{pass.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{pass.subtitle} • {pass.time}</p>
                    <span className="text-[11px] font-mono text-sky-800 font-black block mt-0.5">Ref: {pass.bookingReference}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-slate-400">
                  <span className="text-xs font-black uppercase px-3 py-1.5 rounded-xl glass-subcard text-slate-800">
                    View
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Move / Swap Day Modal */}
      {isSwapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-md max-h-[92vh] overflow-y-auto p-6 sm:p-7 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-indigo-700 font-black uppercase tracking-wider block">
                  Itinerary Reorganizer
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Switch or Move Day {activeDay.dayNumber}
                </h3>
              </div>
              <button 
                onClick={() => setIsSwapModalOpen(false)} 
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {swapNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
                <Check className="w-4 h-4 shrink-0" />
                <span>{swapNotice}</span>
              </div>
            )}

            {/* Current Active Day Summary */}
            <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200 text-xs space-y-1">
              <span className="text-[10px] text-sky-800 font-black uppercase tracking-wider block">
                Current Selected Day:
              </span>
              <p className="font-black text-slate-900">
                Day {activeDay.dayNumber} ({new Date(activeDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}): {activeDay.title}
              </p>
              <p className="text-[11px] text-slate-600 font-semibold">
                Location: {activeDay.location}
              </p>
            </div>

            {/* Mode Segmented Controls */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-700 font-bold block text-xs">
                Action Mode:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSwapMode('swap')}
                  className={`py-2.5 px-3 rounded-2xl font-black text-xs transition active:scale-95 border ${
                    swapMode === 'swap'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'glass-subcard hover:bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  ⇄ Swap Two Days
                </button>
                <button
                  type="button"
                  onClick={() => setSwapMode('move')}
                  className={`py-2.5 px-3 rounded-2xl font-black text-xs transition active:scale-95 border ${
                    swapMode === 'move'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'glass-subcard hover:bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  ⤵ Move & Shift Slot
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-medium px-1">
                {swapMode === 'swap' 
                  ? 'Exchanges plans between Day ' + activeDay.dayNumber + ' and target day directly.' 
                  : 'Moves Day ' + activeDay.dayNumber + ' into target slot and shifts the intermediate days.'}
              </p>
            </div>

            {/* Target Day Selector */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-700 font-bold block text-xs">
                Select Target Day:
              </label>
              <select
                value={swapTargetDayNumber}
                onChange={e => setSwapTargetDayNumber(Number(e.target.value))}
                className="w-full glass-subcard rounded-2xl px-3.5 py-3 text-slate-900 font-bold text-xs border border-indigo-200"
              >
                {itineraries
                  .filter(d => d.dayNumber !== activeDay.dayNumber)
                  .map(d => (
                    <option key={d.dayNumber} value={d.dayNumber}>
                      Day {d.dayNumber} ({new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}): {d.title}
                    </option>
                  ))}
              </select>
            </div>

            {/* Booking Sync Checkbox */}
            <label className="flex items-center space-x-2 pt-1 text-xs text-slate-700 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={syncBookingsWithSwap}
                onChange={e => setSyncBookingsWithSwap(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Also update linked hotel/flight bookings to match the new date</span>
            </label>

            {/* Preview Box */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-indigo-950 tracking-wider block">
                Itinerary Preview After {swapMode === 'swap' ? 'Swap' : 'Move'}:
              </span>
              <div className="space-y-1.5">
                <div className="flex items-start space-x-1.5">
                  <span className="font-mono font-black text-sky-800 text-[11px] shrink-0">
                    Day {activeDay.dayNumber} ({new Date(activeDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}):
                  </span>
                  <span className="font-bold text-slate-900 text-xs truncate">
                    {targetDay?.title}
                  </span>
                </div>
                <div className="flex items-start space-x-1.5">
                  <span className="font-mono font-black text-indigo-800 text-[11px] shrink-0">
                    Day {swapTargetDayNumber} ({targetDay ? new Date(targetDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}):
                  </span>
                  <span className="font-bold text-slate-900 text-xs truncate">
                    {activeDay.title}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleExecuteSwapOrMove}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-1.5"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Confirm {swapMode === 'swap' ? 'Swap Days' : 'Move Day'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSwapModalOpen(false)}
                className="px-5 py-3 rounded-2xl glass-subcard text-slate-700 font-bold text-xs hover:bg-white active:scale-95 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Day Plan Modal */}
      {isEditingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 sm:p-7 text-slate-800 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-sky-800 font-black uppercase tracking-wider block">
                  Itinerary Customizer
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Edit Day {activeDay.dayNumber} Plan
                </h3>
              </div>
              <button 
                onClick={() => setIsEditingDay(false)} 
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Destination & Title */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Day Title / Theme</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="e.g. Paris Arrival & Evening Seine Cruise"
                  className="w-full glass-subcard rounded-2xl px-3.5 py-2.5 text-slate-900 font-bold text-xs border border-slate-300"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Destination / Route</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                  placeholder="e.g. Paris, France"
                  className="w-full glass-subcard rounded-2xl px-3.5 py-2.5 text-slate-900 font-bold text-xs border border-slate-300"
                />
              </div>
            </div>

            {/* Interactive Timeline Stops */}
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-black uppercase tracking-wider text-[11px]">
                  Curated Stops & Activities ({editTimelineItems.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddTimelineItem}
                  className="px-2.5 py-1 rounded-xl bg-sky-100 text-sky-800 hover:bg-sky-200 font-black text-[11px] flex items-center space-x-1 transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Stop</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {editTimelineItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-white/80 border border-slate-200 flex items-start space-x-2">
                    <div className="w-20 shrink-0">
                      <input
                        type="text"
                        value={item.time || ''}
                        onChange={e => handleUpdateItemField(idx, 'time', e.target.value)}
                        placeholder="e.g. 09:30 AM"
                        className="w-full glass-subcard rounded-xl px-2 py-1.5 text-slate-800 font-bold text-[10px] border border-slate-200 text-center"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.text}
                        onChange={e => handleUpdateItemField(idx, 'text', e.target.value)}
                        placeholder="Activity description..."
                        className="w-full glass-subcard rounded-xl px-3 py-1.5 text-slate-900 font-bold text-xs border border-slate-200"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTimelineItem(idx)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                      title="Remove activity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Advisories & Weather */}
            <div className="space-y-3 pt-2 text-xs">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">
                Weather & Packing Guide:
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Daylight Window</label>
                  <input
                    type="text"
                    value={editDaylight}
                    onChange={e => setEditDaylight(e.target.value)}
                    placeholder="e.g. 08:15 - 17:50 (~9.5h daylight)"
                    className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-bold text-xs border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Weather Advisory</label>
                  <input
                    type="text"
                    value={editWeather}
                    onChange={e => setEditWeather(e.target.value)}
                    placeholder="e.g. 4°C to 8°C • Chilly & breezy"
                    className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-bold text-xs border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1">Clothing Guide</label>
                <input
                  type="text"
                  value={editClothing}
                  onChange={e => setEditClothing(e.target.value)}
                  placeholder="e.g. Warm wool coat, thermal innerwear, comfortable boots"
                  className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-bold text-xs border border-slate-200"
                />
              </div>
            </div>

            {/* Personal Notes & Scratchpad */}
            <div className="space-y-1.5 pt-1 text-xs">
              <label className="text-slate-700 font-bold block">
                Personal Notes & Reminders (Optional):
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="e.g. Dinner reservation at 8 PM, Metro entrance 3, buy tickets at kiosk..."
                className="w-full glass-subcard rounded-2xl p-3 text-slate-900 font-medium text-xs border border-slate-300"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveDayEdit}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Day Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDay(false)}
                  className="px-5 py-3 rounded-2xl glass-subcard text-slate-700 font-bold text-xs hover:bg-white active:scale-95 transition"
                >
                  Cancel
                </button>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[11px] text-slate-500 hover:text-rose-600 font-bold flex items-center space-x-1 py-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Day {activeDay.dayNumber} to Default Baseline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pocket Expense Logging Modal */}
      {isPocketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-md max-h-[92vh] overflow-y-auto p-6 sm:p-7 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-800 font-black uppercase tracking-wider block">
                    Day {activeDay.dayNumber} Pocket Expense
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Log On-the-Go Expense
                  </h3>
                </div>
              </div>
              <button 
                onClick={() => setIsPocketModalOpen(false)} 
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPocketExpense} className="space-y-4">
              {/* Category Selection */}
              <div className="space-y-1.5 text-xs">
                <label className="text-slate-700 font-bold block">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'food', label: 'Food & Coffee', icon: Utensils },
                    { id: 'transport', label: 'Metro / Cab', icon: Navigation },
                    { id: 'shopping', label: 'Souvenirs', icon: ShoppingBag },
                    { id: 'activity', label: 'Activity Tip', icon: Ticket },
                    { id: 'misc', label: 'Incidentals', icon: Coins },
                  ].map(cat => {
                    const Icon = cat.icon;
                    const isSel = pocketCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setPocketCategory(cat.id as PocketExpenseCategory)}
                        className={`p-2.5 rounded-2xl flex flex-col items-center justify-center text-center space-y-1 border transition active:scale-95 ${
                          isSel
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm font-black'
                            : 'glass-subcard hover:bg-white text-slate-700 border-slate-200 font-bold'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px] leading-tight">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1 text-xs">
                <label className="text-slate-700 font-bold block">Description</label>
                <input
                  type="text"
                  required
                  value={pocketDesc}
                  onChange={e => setPocketDesc(e.target.value)}
                  placeholder="e.g. Croissant & Cappuccino, Metro single ride..."
                  className="w-full glass-subcard rounded-2xl px-3.5 py-2.5 text-slate-900 font-bold text-xs border border-slate-300"
                />
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={pocketAmount}
                    onChange={e => setPocketAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full glass-subcard rounded-2xl px-3.5 py-2.5 text-slate-900 font-black text-sm border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Currency</label>
                  <select
                    value={pocketCurrency}
                    onChange={e => setPocketCurrency(e.target.value as 'EUR' | 'CHF' | 'INR')}
                    className="w-full glass-subcard rounded-2xl px-3.5 py-2.5 text-slate-900 font-black text-xs border border-slate-300"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="CHF">CHF (Swiss Franc)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>

              {/* Converted INR Preview */}
              {pocketAmount && !isNaN(parseFloat(pocketAmount)) && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between">
                  <span className="text-emerald-900 font-bold">Estimated Cost in INR:</span>
                  <span className="text-sm font-black text-emerald-950">
                    ≈ ₹{
                      pocketCurrency === 'EUR'
                        ? Math.round(parseFloat(pocketAmount) * (exchangeRates.EUR || 106.25)).toLocaleString('en-IN')
                        : pocketCurrency === 'CHF'
                        ? Math.round(parseFloat(pocketAmount) * (exchangeRates.CHF || 110.50)).toLocaleString('en-IN')
                        : parseFloat(pocketAmount).toLocaleString('en-IN')
                    }
                  </span>
                </div>
              )}

              {/* Payment Mode */}
              <div className="space-y-1.5 text-xs">
                <label className="text-slate-700 font-bold block">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'forex_card', label: 'Forex Card' },
                    { id: 'cash', label: 'Cash' },
                    { id: 'credit_card', label: 'Credit Card' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPocketPaymentMode(mode.id as any)}
                      className={`py-2 px-2 rounded-xl text-center text-xs transition active:scale-95 border ${
                        pocketPaymentMode === mode.id
                          ? 'bg-slate-900 text-white font-black border-slate-900'
                          : 'glass-subcard hover:bg-white text-slate-700 font-bold border-slate-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Pocket Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPocketModalOpen(false)}
                  className="px-5 py-3 rounded-2xl glass-subcard text-slate-700 font-bold text-xs hover:bg-white active:scale-95 transition"
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
};
