import { ItineraryStop } from '../types';

export const GOOGLE_MAPS_API_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (typeof process !== 'undefined' ? (process.env?.GOOGLE_MAPS_API_KEY as string | undefined) : undefined) ||
  '';

// Mandatory attribution ID for Google Maps Platform usage tracking
export const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

export type RouteTravelMode = 'DRIVING' | 'WALKING' | 'TRANSIT';

export interface RouteLegSummary {
  fromStopId: string;
  toStopId: string;
  distanceMeters: number;
  durationMillis: number;
  isGeodesicFallback?: boolean;
}

export interface DayRouteSummary {
  totalDistanceMeters: number;
  totalDurationMillis: number;
  legs: RouteLegSummary[];
  travelMode: RouteTravelMode;
  isFallbackOnly: boolean;
}

export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === 'string'
      ? err
      : err instanceof Error
      ? err.message
      : JSON.stringify(err);
  const upper = msg.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('OVERQUOTAMAPERROR') ||
    upper.includes('QUOTAEXCEEDEDERROR') ||
    upper.includes('429')
  );
}

export function reportQuotaExceeded(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

export function formatDurationMillis(millis: number): string {
  if (!Number.isFinite(millis) || millis <= 0) return '1 min';
  const totalMinutes = Math.max(1, Math.round(millis / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function estimateFallbackDurationMillis(distanceKm: number, mode: RouteTravelMode, isFlightLeg: boolean): number {
  if (isFlightLeg) {
    // Average regional/international cruise + taxiing
    return Math.round(((distanceKm / 720) * 60 + 35) * 60000);
  }
  const speedKmh = mode === 'WALKING' ? 4.5 : mode === 'TRANSIT' ? 40 : 45;
  return Math.max(3, Math.round((distanceKm / speedKmh) * 60)) * 60000;
}

/**
 * Exact (for <= 8 intermediates) or nearest-neighbor geographic route optimization
 * keeping the first (origin) and last (destination) stops fixed.
 * Used as a clean fallback when a day includes flight or sea legs that cannot be road-routed.
 */
export function optimizeStopsGeographically(stops: ItineraryStop[]): {
  reordered: ItineraryStop[];
  changed: boolean;
  savedKm: number;
} {
  if (stops.length <= 2) {
    return { reordered: stops, changed: false, savedKm: 0 };
  }

  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const intermediates = stops.slice(1, -1);

  const pathDistance = (ordered: ItineraryStop[]): number => {
    let total = 0;
    for (let i = 0; i < ordered.length - 1; i++) {
      total += haversineKm(ordered[i].lat, ordered[i].lng, ordered[i + 1].lat, ordered[i + 1].lng);
    }
    return total;
  };

  const originalDist = pathDistance(stops);

  if (intermediates.length <= 7) {
    // Exact Held-Karp / permutation search for optimal ordering
    let bestOrder: ItineraryStop[] = intermediates;
    let bestDist = originalDist;

    const permute = (current: ItineraryStop[], remaining: ItineraryStop[], currentDist: number) => {
      if (currentDist >= bestDist) return;
      if (remaining.length === 0) {
        const lastNode = current.length > 0 ? current[current.length - 1] : origin;
        const totalDist = currentDist + haversineKm(lastNode.lat, lastNode.lng, destination.lat, destination.lng);
        if (totalDist < bestDist - 0.01) {
          bestDist = totalDist;
          bestOrder = [...current];
        }
        return;
      }
      const prevNode = current.length > 0 ? current[current.length - 1] : origin;
      for (let i = 0; i < remaining.length; i++) {
        const nextNode = remaining[i];
        const stepDist = haversineKm(prevNode.lat, prevNode.lng, nextNode.lat, nextNode.lng);
        const nextRemaining = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
        permute([...current, nextNode], nextRemaining, currentDist + stepDist);
      }
    };

    permute([], intermediates, 0);
    const reordered = [origin, ...bestOrder, destination];
    const changed = reordered.some((s, idx) => s.id !== stops[idx].id);
    return {
      reordered,
      changed,
      savedKm: Math.max(0, originalDist - bestDist),
    };
  }

  // Greedy nearest-neighbor fallback for larger intermediate lists
  const remaining = [...intermediates];
  const ordered: ItineraryStop[] = [];
  let cursor = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cursor.lat, cursor.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    const [picked] = remaining.splice(bestIdx, 1);
    ordered.push(picked);
    cursor = picked;
  }

  const reordered = [origin, ...ordered, destination];
  const newDist = pathDistance(reordered);
  const changed = reordered.some((s, idx) => s.id !== stops[idx].id);
  return {
    reordered,
    changed,
    savedKm: Math.max(0, originalDist - newDist),
  };
}
