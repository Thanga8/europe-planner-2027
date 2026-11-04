import React, { useState, useEffect } from 'react';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  ExternalLink, 
  Bell, 
  Check, 
  Sparkles, 
  LocateFixed, 
  AlertCircle,
  Plane,
  Bed,
  Train,
  Ticket
} from 'lucide-react';
import { 
  DepartureGuidance, 
  LiveLocationCoords, 
  calculateDepartureGuidance, 
  getQuickLocationSnapshot, 
  getNotificationPermissionStatus, 
  requestNotificationPermission, 
  sendTestNotification, 
  isNotificationsEnabled, 
  toggleNotificationsEnabled,
  formatDuration
} from '../services/transitNotificationService';
import { MapStop, getStopsForDay, getBasecampForDay } from '../data/curatedStops';

interface DepartureAssistantCardProps {
  dayNumber: number;
}

export const DepartureAssistantCard: React.FC<DepartureAssistantCardProps> = ({ dayNumber }) => {
  const dayStops = getStopsForDay(dayNumber);
  const basecamp = getBasecampForDay(dayNumber);

  // Default to the first non-hotel activity or flight, or second stop
  const candidateTarget = dayStops.find(s => s.category !== 'hotel') || dayStops[1] || dayStops[0];
  const [selectedTargetId, setSelectedTargetId] = useState<string>(candidateTarget?.id || '');
  const [liveCoords, setLiveCoords] = useState<LiveLocationCoords | null>(null);
  const [isFetchingGPS, setIsFetchingGPS] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // Notification state
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const [notificationsOn, setNotificationsOn] = useState<boolean>(false);
  const [testSent, setTestSent] = useState<boolean>(false);

  useEffect(() => {
    // When day changes, reset target stop to first activity of that day
    const stops = getStopsForDay(dayNumber);
    const target = stops.find(s => s.category !== 'hotel') || stops[1] || stops[0];
    setSelectedTargetId(target?.id || '');
  }, [dayNumber]);

  useEffect(() => {
    setNotifPermission(getNotificationPermissionStatus());
    setNotificationsOn(isNotificationsEnabled());
  }, []);

  const activeTargetStop = dayStops.find(s => s.id === selectedTargetId) || candidateTarget;

  const guidance: DepartureGuidance = calculateDepartureGuidance(
    activeTargetStop,
    dayNumber,
    liveCoords
  );

  // Take 1-second location snapshot and sleep
  const handleQuickGpsSnapshot = async () => {
    setIsFetchingGPS(true);
    setGpsNotice(null);
    try {
      const coords = await getQuickLocationSnapshot();
      if (coords) {
        setLiveCoords(coords);
        setGpsNotice('GPS Snapshot updated! GPS powered down to preserve battery.');
      } else {
        setGpsNotice('GPS unavailable. Using your basecamp hotel as origin.');
      }
    } finally {
      setIsFetchingGPS(false);
      setTimeout(() => setGpsNotice(null), 4000);
    }
  };

  // Revert back to basecamp hotel
  const handleUseBasecamp = () => {
    setLiveCoords(null);
    setGpsNotice('Reverted to planned Basecamp Hotel origin.');
    setTimeout(() => setGpsNotice(null), 3000);
  };

  // Toggle or enable system notifications
  const handleToggleNotifications = async () => {
    if (notifPermission !== 'granted') {
      const granted = await requestNotificationPermission();
      setNotifPermission(granted ? 'granted' : 'denied');
      setNotificationsOn(granted);
    } else {
      const next = !notificationsOn;
      toggleNotificationsEnabled(next);
      setNotificationsOn(next);
    }
  };

  // Fire an immediate test notification
  const handleSendTest = async () => {
    setTestSent(true);
    await sendTestNotification();
    setNotifPermission(getNotificationPermissionStatus());
    setNotificationsOn(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const getStopIcon = (category: string) => {
    switch (category) {
      case 'hotel':
        return <Bed className="w-3.5 h-3.5 text-emerald-600" />;
      case 'flight':
        return <Plane className="w-3.5 h-3.5 text-indigo-600" />;
      case 'station':
        return <Train className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <Ticket className="w-3.5 h-3.5 text-sky-600" />;
    }
  };

  return (
    <div className="p-6 rounded-[2.2rem] glass-card space-y-4 shadow-lg border border-sky-100/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 rounded-2xl bg-sky-100 text-sky-800">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-black uppercase text-sky-800 tracking-wider">
                Smart Departure Radar
              </span>
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 font-black text-[9px]">
                Battery-Safe
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900">
              When Should You Leave?
            </h3>
          </div>
        </div>

        {/* Notification Status Button */}
        <button
          type="button"
          onClick={handleSendTest}
          className={`px-3 py-1.5 rounded-xl font-black text-[11px] flex items-center space-x-1.5 transition active:scale-95 shadow-2xs ${
            notificationsOn 
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
              : 'glass-subcard hover:bg-white text-slate-700 border-slate-200'
          }`}
          title="Test system notification on your phone"
        >
          <Bell className="w-3.5 h-3.5 text-emerald-600" />
          <span>{testSent ? 'Sent Chime!' : notificationsOn ? 'Alerts ON' : 'Test Alert'}</span>
        </button>
      </div>

      {/* Target Stop Selector */}
      <div className="space-y-1.5 text-xs">
        <label className="text-slate-600 font-bold block text-[11px]">
          Calculate Transit For Target Event:
        </label>
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {dayStops.map(stop => {
            const isSelected = stop.id === activeTargetStop.id;
            return (
              <button
                key={stop.id}
                type="button"
                onClick={() => setSelectedTargetId(stop.id)}
                className={`py-2 px-3 rounded-2xl font-bold text-xs flex items-center space-x-1.5 whitespace-nowrap transition active:scale-95 border ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                    : 'glass-subcard hover:bg-white text-slate-700 border-slate-200'
                }`}
              >
                {getStopIcon(stop.category)}
                <span className="truncate max-w-[130px]">{stop.name.split('(')[0]}</span>
                {stop.time && (
                  <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-white/20' : 'bg-slate-200/60'}`}>
                    {stop.time.split(' ')[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Departure Guidance Result Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white/90 to-sky-50/90 border border-sky-200/80 shadow-xs space-y-3.5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
              Recommended Departure from {guidance.isUsingLiveGPS ? 'Current GPS' : 'Hotel'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
              {guidance.recommendedDepartureTime}
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Event Start: {guidance.eventTime}</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-black uppercase text-slate-500 block">Total Lead Time</span>
            <span className="text-base font-black text-sky-800 block mt-0.5">
              {formatDuration(guidance.totalLeadMinutes)} before
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {guidance.distanceKm} km transit
            </span>
          </div>
        </div>

        {/* Calculation Breakdown Breakdown (Travel + Venue Buffer) */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-sky-100 text-xs">
          <div className="p-2.5 rounded-xl bg-white/80 border border-sky-100">
            <span className="text-[10px] text-slate-500 font-bold block">1. Estimated Transit</span>
            <span className="font-black text-slate-900 text-sm block mt-0.5">
              ~{formatDuration(guidance.transitMinutes)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              at ~{guidance.targetStop.category === 'flight' ? '65' : '35'} km/h avg speed
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/80 border border-sky-100">
            <span className="text-[10px] text-slate-500 font-bold block">2. Venue Buffer</span>
            <span className="font-black text-slate-900 text-sm block mt-0.5">
              +{formatDuration(guidance.venueBufferMinutes)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {guidance.targetStop.category === 'flight' 
                ? 'Check-in, baggage & security' 
                : guidance.targetStop.category === 'station'
                ? 'Platform & boarding doors'
                : 'Ticket check-in & briefing'}
            </span>
          </div>
        </div>

        {/* Origin Notice & GPS Toggle */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center space-x-1.5 min-w-0 pr-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-600 font-semibold truncate">
              Origin: <strong>{guidance.originName}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {guidance.isUsingLiveGPS ? (
              <button
                type="button"
                onClick={handleUseBasecamp}
                className="text-[11px] text-sky-700 hover:text-sky-900 font-bold underline"
              >
                Use Hotel Basecamp
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickGpsSnapshot}
                disabled={isFetchingGPS}
                className="px-2.5 py-1 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 font-black text-[10px] flex items-center space-x-1 transition active:scale-95"
                title="Takes a 1-second GPS location snapshot and immediately turns off GPS to save battery"
              >
                <LocateFixed className={`w-3 h-3 ${isFetchingGPS ? 'animate-spin' : ''}`} />
                <span>{isFetchingGPS ? 'Reading GPS...' : '1-Tap GPS Check'}</span>
              </button>
            )}
          </div>
        </div>

        {gpsNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center space-x-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>{gpsNotice}</span>
          </div>
        )}
      </div>

      {/* Action Navigation Button */}
      <a
        href={guidance.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-2"
      >
        <span>Open Live Transit & Traffic in Google Maps</span>
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
};

