import { MapStop, getBasecampForDay, getStopsForDay } from '../data/curatedStops';

export interface DepartureGuidance {
  targetStop: MapStop;
  originName: string;
  originCategory: string;
  originLat: number;
  originLon: number;
  isUsingLiveGPS: boolean;
  distanceKm: number;
  transitMinutes: number;
  venueBufferMinutes: number;
  totalLeadMinutes: number;
  recommendedDepartureTime: string;
  eventTime: string;
  googleMapsUrl: string;
}

export interface LiveLocationCoords {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}

// Storage keys
const STORAGE_KEYS = {
  NOTIFICATIONS_ENABLED: 'europe27_notifications_enabled',
  NOTIFIED_ALERTS: 'europe27_notified_alerts',
  CACHED_GPS: 'europe27_cached_gps',
};

/**
 * Calculates distance in kilometers between two GPS coordinates (Haversine formula)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimates realistic European transit travel time based on distance & category
 */
export function estimateTransitMinutes(distanceKm: number, category: string): number {
  if (distanceKm <= 0.8) {
    // Short walking distance
    return Math.max(10, Math.round((distanceKm / 4.5) * 60 + 5));
  }

  if (category === 'flight') {
    // Airport Highway & RER / Regional Rail transit
    const hours = distanceKm / 65;
    return Math.max(30, Math.round(hours * 60 + 15));
  }

  // Urban metro / taxi / scenic Swiss train
  const hours = distanceKm / 35;
  return Math.max(15, Math.round(hours * 60 + 10));
}

/**
 * Arrival buffer needed before the scheduled start at the venue
 */
export function getVenueArrivalBuffer(targetStop: MapStop): number {
  const normName = targetStop.name.toLowerCase();

  // International Flights (HYD, CDG, HEL international return)
  if (targetStop.category === 'flight') {
    if (normName.includes('cdg') || normName.includes('hyderabad') || normName.includes('return')) {
      return 180; // 3 hours before international flights
    }
    return 90; // 1.5 hours before Schengen European flights (ZRH, RVN, HEL transit)
  }

  // High-Speed Trains (TGV Lyria, VR Night Train)
  if (targetStop.category === 'station') {
    return 30; // 30 minutes before high-speed rail departure
  }

  // Activities, Guided Safaris, Icebreaker
  if (normName.includes('icebreaker') || normName.includes('husky') || normName.includes('snowmobile')) {
    return 30; // 30 minutes for thermal suit fittings & gear briefing
  }

  return 20; // 20 minutes standard arrival buffer for museums / cable cars
}

/**
 * Parse time string (e.g. "14:30 PM", "07:22 AM", "10:15 AM") into hours and minutes
 */
function parseTimeString(timeStr?: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toUpperCase();
  const match = clean.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3];

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  return { hours, minutes };
}

/**
 * Format total minutes as human readable string "Xh Ym" or "Ym"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Computes dynamic departure guidance for a target stop
 */
export function calculateDepartureGuidance(
  targetStop: MapStop,
  dayNumber: number,
  liveCoords?: LiveLocationCoords | null
): DepartureGuidance {
  let originName = 'Basecamp Hotel';
  let originCategory = 'hotel';
  let originLat: number;
  let originLon: number;
  let isUsingLiveGPS = false;

  if (liveCoords) {
    originName = 'Current Location (GPS)';
    originCategory = 'gps';
    originLat = liveCoords.lat;
    originLon = liveCoords.lon;
    isUsingLiveGPS = true;
  } else {
    const basecamp = getBasecampForDay(dayNumber);
    originName = basecamp.name;
    originCategory = basecamp.category;
    originLat = basecamp.lat;
    originLon = basecamp.lon;
  }

  const distanceKm = calculateDistanceKm(originLat, originLon, targetStop.lat, targetStop.lon);
  const transitMinutes = estimateTransitMinutes(distanceKm, targetStop.category);
  const venueBufferMinutes = getVenueArrivalBuffer(targetStop);
  const totalLeadMinutes = transitMinutes + venueBufferMinutes;

  // Calculate recommended departure clock time
  let recommendedDepartureTime = '--:--';
  const parsedTime = parseTimeString(targetStop.time);
  if (parsedTime) {
    const totalTargetMins = parsedTime.hours * 60 + parsedTime.minutes;
    let departureMins = totalTargetMins - totalLeadMinutes;
    if (departureMins < 0) departureMins += 24 * 60;

    const depH = Math.floor(departureMins / 60) % 24;
    const depM = departureMins % 60;
    const period = depH >= 12 ? 'PM' : 'AM';
    const displayH = depH % 12 === 0 ? 12 : depH % 12;
    recommendedDepartureTime = `${String(displayH).padStart(2, '0')}:${String(depM).padStart(2, '0')} ${period}`;
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${targetStop.lat},${targetStop.lon}&travelmode=transit`;

  return {
    targetStop,
    originName,
    originCategory,
    originLat,
    originLon,
    isUsingLiveGPS,
    distanceKm,
    transitMinutes,
    venueBufferMinutes,
    totalLeadMinutes,
    recommendedDepartureTime,
    eventTime: targetStop.time || 'Scheduled Day Event',
    googleMapsUrl,
  };
}

/**
 * 1-Tap Quick GPS Snapshot: Grabs device location in 1-2 seconds and immediately sleeps
 */
export async function getQuickLocationSnapshot(): Promise<LiveLocationCoords | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: LiveLocationCoords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
        };
        try {
          localStorage.setItem(STORAGE_KEYS.CACHED_GPS, JSON.stringify(coords));
        } catch {}
        resolve(coords);
      },
      (err) => {
        console.warn('GPS snapshot unavailable/denied:', err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 120000, // Reuse cached position within 2 minutes
      }
    );
  });
}

/**
 * Notification Permissions & Trigger Engine
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const res = await Notification.requestPermission();
    const isGranted = res === 'granted';
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, isGranted ? 'true' : 'false');
    return isGranted;
  } catch {
    return false;
  }
}

export function isNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED) === 'true' &&
    Notification.permission === 'granted'
  );
}

export function toggleNotificationsEnabled(enabled: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');
  }
}

/**
 * Fire system notification via Service Worker (with fallback to window Notification)
 */
export async function dispatchSystemNotification(
  title: string,
  body: string,
  urlToOpen?: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const options: any = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag: `europe27-alert-${Date.now()}`,
    data: {
      url: urlToOpen || '/',
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return true;
      }
    }

    new Notification(title, options);
    return true;
  } catch (err) {
    console.warn('Notification dispatch error:', err);
    return false;
  }
}

/**
 * Send an immediate Test Travel Notification so user can verify on their device
 */
export async function sendTestNotification(): Promise<boolean> {
  const perm = await requestNotificationPermission();
  if (!perm) return false;

  return dispatchSystemNotification(
    '✈️ Europe 2027 Travel Radar Active',
    'Departure alerts ready! We will notify you dynamically based on travel distance to flights, trains, and activities.',
    '/'
  );
}
