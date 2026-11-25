import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import {
  Navigation,
  ExternalLink,
  Car,
  Footprints,
  TrainFront,
  Sparkles,
  Layers,
  Maximize2,
  Globe2,
  Calendar,
  Check,
  Undo2,
  Loader2,
  Plane,
  Bed,
  Train,
  Ticket,
  Utensils,
} from 'lucide-react';
import { DayItinerary, ItineraryStop } from '../types';
import {
  GMP_ATTRIBUTION_ID,
  RouteTravelMode,
  DayRouteSummary,
  RouteLegSummary,
  formatDistanceMeters,
  formatDurationMillis,
  haversineKm,
  estimateFallbackDurationMillis,
  optimizeStopsGeographically,
  isQuotaError,
  reportQuotaExceeded,
} from '../services/googleMapsConfig';

interface DayMapComponentProps {
  activeDay: DayItinerary;
  allDays: DayItinerary[];
  stops: ItineraryStop[];
  selectedStopId: string | null;
  onSelectStop: (stopId: string | null) => void;
  onSelectDay: (dayNumber: number) => void;
  onOptimizeStops: (reorderedStops: ItineraryStop[]) => void;
  onToggleStopCompleted: (stopId: string) => void;
  onRouteSummaryChange?: (summary: DayRouteSummary | null) => void;
}

interface CachedRouteEntry {
  summary: DayRouteSummary;
  paths: google.maps.LatLngLiteral[][];
  isDashedList: boolean[];
}

const CATEGORY_COLORS: Record<string, { bg: string; ring: string; label: string }> = {
  hotel: { bg: '#059669', ring: '#a7f3d0', label: 'Accommodation' },
  flight: { bg: '#4f46e5', ring: '#c7d2fe', label: 'Airport / Flight' },
  station: { bg: '#d97706', ring: '#fde68a', label: 'Rail / Transit' },
  food: { bg: '#e11d48', ring: '#fecdd3', label: 'Dining' },
  activity: { bg: '#0284c7', ring: '#bae6fd', label: 'Experience' },
};

const StopCategoryIcon: React.FC<{ category: string; className?: string }> = ({
  category,
  className = 'w-3.5 h-3.5',
}) => {
  switch (category) {
    case 'hotel':
      return <Bed className={className} />;
    case 'flight':
      return <Plane className={className} />;
    case 'station':
      return <Train className={className} />;
    case 'food':
      return <Utensils className={className} />;
    default:
      return <Ticket className={className} />;
  }
};

interface StopMarkerItemProps {
  stop: ItineraryStop;
  index: number;
  isSelected: boolean;
  onSelect: (stop: ItineraryStop, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}

const StopMarkerItem: React.FC<StopMarkerItemProps> = ({
  stop,
  index,
  isSelected,
  onSelect,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const styleMeta = CATEGORY_COLORS[stop.category] || CATEGORY_COLORS.activity;

  useEffect(() => {
    if (isSelected && marker) {
      onSelect(stop, marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, marker]);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: stop.lat, lng: stop.lng }}
      zIndex={isSelected ? 1000 : 100 + index}
      title={`${index + 1}. ${stop.name}`}
      onClick={() => onSelect(stop, marker)}
    >
      <div
        className="flex items-center justify-center transition-transform duration-150 cursor-pointer select-none"
        style={{
          transform: isSelected ? 'scale(1.18)' : 'scale(1)',
        }}
      >
        <div
          className="relative flex items-center justify-center rounded-full text-white font-extrabold text-xs shadow-lg border-2 border-white"
          style={{
            width: isSelected ? 34 : 30,
            height: isSelected ? 34 : 30,
            backgroundColor: stop.completed ? '#10b981' : styleMeta.bg,
            boxShadow: isSelected
              ? `0 0 0 4px ${styleMeta.ring}, 0 6px 16px rgba(15,23,42,0.3)`
              : '0 4px 10px rgba(15,23,42,0.28)',
          }}
        >
          {stop.completed ? <Check className="w-4 h-4 stroke-[3]" /> : index + 1}
        </div>
      </div>
    </AdvancedMarker>
  );
};

interface MapRouteLayerProps {
  mapScope: 'day' | 'trip';
  activeDayNumber: number;
  stops: ItineraryStop[];
  allDays: DayItinerary[];
  travelMode: RouteTravelMode;
  selectedStopId: string | null;
  fitTrigger: number;
  onRouteComputed: (summary: DayRouteSummary | null, isComputing: boolean) => void;
}

/**
 * Computes and renders real Google Routes API polylines (`Route.computeRoutes`)
 * with automatic fallback to geodesic arcs for long-haul flight or sea segments.
 */
const MapRouteLayer: React.FC<MapRouteLayerProps> = ({
  mapScope,
  activeDayNumber,
  stops,
  allDays,
  travelMode,
  selectedStopId,
  fitTrigger,
  onRouteComputed,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  // Plain object cache to avoid native Map shadowing & conserve API quota
  const routeCacheRef = useRef<Record<string, CachedRouteEntry>>({});

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((line) => line.setMap(null));
    polylinesRef.current = [];
  }, []);

  const fitStopsInView = useCallback(
    (points: { lat: number; lng: number }[]) => {
      if (!map || points.length === 0) return;
      if (points.length === 1) {
        map.panTo(points[0]);
        map.setZoom(14);
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      points.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { top: 64, right: 48, bottom: 72, left: 48 });
    },
    [map]
  );

  // Smooth pan to selected stop when user clicks a card in the timeline
  useEffect(() => {
    if (!map || mapScope !== 'day' || !selectedStopId) return;
    const match = stops.find((s) => s.id === selectedStopId);
    if (match) {
      map.panTo({ lat: match.lat, lng: match.lng });
      const currentZoom = map.getZoom() ?? 12;
      if (currentZoom < 13) {
        map.setZoom(14);
      }
    }
  }, [map, mapScope, selectedStopId, stops]);

  // Refit bounds when day, scope, stop count, or manual recenter trigger changes
  useEffect(() => {
    if (!map) return;
    if (mapScope === 'trip') {
      const tripPts = allDays
        .map((d) => d.stops?.[0])
        .filter((s): s is ItineraryStop => Boolean(s))
        .map((s) => ({ lat: s.lat, lng: s.lng }));
      fitStopsInView(tripPts);
    } else {
      fitStopsInView(stops.map((s) => ({ lat: s.lat, lng: s.lng })));
    }
  }, [map, mapScope, activeDayNumber, fitTrigger, stops.length, allDays, fitStopsInView]);

  // Draw route polylines for either full 11-day overview or active day
  useEffect(() => {
    if (!map) return;
    clearPolylines();

    // All-trip overview mode: draw geodesic journey arc connecting each day's hub
    if (mapScope === 'trip') {
      const dayHubs = allDays
        .map((d) => d.stops?.[0])
        .filter((s): s is ItineraryStop => Boolean(s))
        .map((s) => ({ lat: s.lat, lng: s.lng }));

      if (dayHubs.length > 1) {
        const overviewLine = new google.maps.Polyline({
          path: dayHubs,
          geodesic: true,
          strokeColor: '#0284c7',
          strokeOpacity: 0,
          icons: [
            {
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 0.85,
                scale: 3,
                strokeColor: '#0284c7',
              },
              offset: '0',
              repeat: '16px',
            },
          ],
          map,
        });
        polylinesRef.current = [overviewLine];
      }
      onRouteComputed(null, false);
      return () => clearPolylines();
    }

    if (stops.length < 2) {
      onRouteComputed(null, false);
      return () => clearPolylines();
    }

    // Helper to build geodesic fallback legs (used for flights / sea-ice or if Routes API has no road path)
    const buildFallbackEntry = (): CachedRouteEntry => {
      const legs: RouteLegSummary[] = [];
      let totalDistanceMeters = 0;
      let totalDurationMillis = 0;
      const paths: google.maps.LatLngLiteral[][] = [];
      const isDashedList: boolean[] = [];

      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];
        const distKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
        const isFlightLeg = distKm > 350 || (a.category === 'flight' && b.category === 'flight');
        const distM = Math.round(distKm * 1000);
        const durMs = estimateFallbackDurationMillis(distKm, travelMode, isFlightLeg);

        legs.push({
          fromStopId: a.id,
          toStopId: b.id,
          distanceMeters: distM,
          durationMillis: durMs,
          isGeodesicFallback: true,
        });
        totalDistanceMeters += distM;
        totalDurationMillis += durMs;
        paths.push([
          { lat: a.lat, lng: a.lng },
          { lat: b.lat, lng: b.lng },
        ]);
        isDashedList.push(true);
      }

      return {
        summary: {
          totalDistanceMeters,
          totalDurationMillis,
          legs,
          travelMode,
          isFallbackOnly: true,
        },
        paths,
        isDashedList,
      };
    };

    const renderCachedEntry = (entry: CachedRouteEntry) => {
      clearPolylines();
      const created: google.maps.Polyline[] = [];
      const strokeColor =
        travelMode === 'WALKING'
          ? '#059669'
          : travelMode === 'TRANSIT'
          ? '#4f46e5'
          : '#0284c7';

      entry.paths.forEach((path, idx) => {
        const isDashed = entry.isDashedList[idx];
        const poly = new google.maps.Polyline(
          isDashed
            ? {
                path,
                geodesic: true,
                strokeColor,
                strokeOpacity: 0,
                icons: [
                  {
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 0.9,
                      scale: 3,
                      strokeColor,
                    },
                    offset: '0',
                    repeat: '14px',
                  },
                ],
                map,
              }
            : {
                path,
                geodesic: true,
                strokeColor,
                strokeOpacity: 0.88,
                strokeWeight: 5,
                map,
              }
        );
        created.push(poly);
      });
      polylinesRef.current = created;
      onRouteComputed(entry.summary, false);
    };

    // Detect if the day contains a long-haul air/sea leg (> 450 km) where continuous road routing won't apply
    const hasLongHaulLeg = stops.some((stop, idx) => {
      if (idx === stops.length - 1) return false;
      const next = stops[idx + 1];
      return haversineKm(stop.lat, stop.lng, next.lat, next.lng) > 450;
    });

    const cacheKey = `${activeDayNumber}:${travelMode}:${stops
      .map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`)
      .join('|')}`;

    const cached = routeCacheRef.current[cacheKey];
    if (cached) {
      renderCachedEntry(cached);
      return () => clearPolylines();
    }

    if (hasLongHaulLeg || !routesLib) {
      const fallback = buildFallbackEntry();
      renderCachedEntry(fallback);
      return () => clearPolylines();
    }

    let cancelled = false;
    onRouteComputed(null, true);

    const computeDayRoute = async () => {
      try {
        // Routes API TRANSIT mode supports origin -> destination without intermediates,
        // so for multi-stop TRANSIT we fall back to DRIVING or compute 2-stop TRANSIT cleanly.
        const effectiveMode: RouteTravelMode =
          travelMode === 'TRANSIT' && stops.length > 2 ? 'DRIVING' : travelMode;

        const origin = { lat: stops[0].lat, lng: stops[0].lng };
        const destination = {
          lat: stops[stops.length - 1].lat,
          lng: stops[stops.length - 1].lng,
        };
        const intermediates: google.maps.routes.Waypoint[] =
          stops.length > 2
            ? stops.slice(1, -1).map((s) => ({
                location: { lat: s.lat, lng: s.lng },
              }))
            : [];

        const request: google.maps.routes.ComputeRoutesRequest = {
          origin,
          destination,
          ...(intermediates.length > 0 ? { intermediates } : {}),
          travelMode: effectiveMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
          internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
        };

        const response = await routesLib.Route.computeRoutes(request);
        if (cancelled) return;

        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          const fallback = buildFallbackEntry();
          routeCacheRef.current[cacheKey] = fallback;
          renderCachedEntry(fallback);
          return;
        }

        // Render official SDK polylines cleanly & also cache their coordinate arrays
        const sdkPolylines = primaryRoute.createPolylines();
        const extractedPaths: google.maps.LatLngLiteral[][] = [];
        const isDashedList: boolean[] = [];

        sdkPolylines.forEach((p) => {
          const pathArray = p
            .getPath()
            .getArray()
            .map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));
          if (pathArray.length > 0) {
            extractedPaths.push(pathArray);
            isDashedList.push(travelMode === 'WALKING');
          }
          p.setMap(null);
        });

        const legs: RouteLegSummary[] = (primaryRoute.legs || []).map((leg, i) => ({
          fromStopId: stops[i]?.id || `stop-${i}`,
          toStopId: stops[i + 1]?.id || `stop-${i + 1}`,
          distanceMeters: leg.distanceMeters ?? 0,
          durationMillis: leg.durationMillis ?? 0,
          isGeodesicFallback: false,
        }));

        const entry: CachedRouteEntry = {
          summary: {
            totalDistanceMeters:
              primaryRoute.distanceMeters ??
              legs.reduce((sum, l) => sum + l.distanceMeters, 0),
            totalDurationMillis:
              primaryRoute.durationMillis ??
              legs.reduce((sum, l) => sum + l.durationMillis, 0),
            legs,
            travelMode,
            isFallbackOnly: false,
          },
          paths: extractedPaths.length > 0 ? extractedPaths : [stops.map((s) => ({ lat: s.lat, lng: s.lng }))],
          isDashedList: isDashedList.length > 0 ? isDashedList : [false],
        };

        routeCacheRef.current[cacheKey] = entry;
        renderCachedEntry(entry);
      } catch (err) {
        if (cancelled) return;
        if (isQuotaError(err)) {
          reportQuotaExceeded();
        } else {
          console.warn('Routes API fallback engaged:', err);
        }
        const fallback = buildFallbackEntry();
        renderCachedEntry(fallback);
      }
    };

    computeDayRoute();

    return () => {
      cancelled = true;
      clearPolylines();
    };
  }, [map, routesLib, mapScope, activeDayNumber, stops, allDays, travelMode, clearPolylines, onRouteComputed]);

  return null;
};

/**
 * Headless helper component inside `<GoogleMap>` that exposes Routes API waypoint optimization
 * via callback to the outer toolbar button (`Optimize Route`).
 */
const RouteOptimizerBridge: React.FC<{
  registerOptimizer: (fn: (stops: ItineraryStop[], mode: RouteTravelMode) => Promise<{
    reordered: ItineraryStop[];
    changed: boolean;
    savedMeters: number;
    savedMillis: number;
    usedRoutesApi: boolean;
  }>) => void;
}> = ({ registerOptimizer }) => {
  const routesLib = useMapsLibrary('routes');

  useEffect(() => {
    registerOptimizer(async (stops, mode) => {
      if (stops.length < 3) {
        return {
          reordered: stops,
          changed: false,
          savedMeters: 0,
          savedMillis: 0,
          usedRoutesApi: false,
        };
      }

      const hasLongHaul = stops.some((s, i) => {
        if (i === stops.length - 1) return false;
        return haversineKm(s.lat, s.lng, stops[i + 1].lat, stops[i + 1].lng) > 450;
      });

      if (routesLib && !hasLongHaul) {
        try {
          const optMode: 'DRIVING' | 'WALKING' = mode === 'WALKING' ? 'WALKING' : 'DRIVING';
          const origin = { lat: stops[0].lat, lng: stops[0].lng };
          const destination = {
            lat: stops[stops.length - 1].lat,
            lng: stops[stops.length - 1].lng,
          };
          const intermediates: google.maps.routes.Waypoint[] = stops.slice(1, -1).map((s) => ({
            location: { lat: s.lat, lng: s.lng },
          }));

          // Fetch baseline distance/duration + optimized order in parallel
          const [baselineRes, optimizedRes] = await Promise.all([
            routesLib.Route.computeRoutes({
              origin,
              destination,
              intermediates,
              travelMode: optMode,
              fields: ['distanceMeters', 'durationMillis'],
              internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
            }),
            routesLib.Route.computeRoutes({
              origin,
              destination,
              intermediates,
              travelMode: optMode,
              optimizeWaypointOrder: true,
              fields: [
                'distanceMeters',
                'durationMillis',
                'optimizedIntermediateWaypointIndices',
              ],
              internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
            }),
          ]);

          const optRoute = optimizedRes?.routes?.[0];
          const baseRoute = baselineRes?.routes?.[0];
          const indices = optRoute?.optimizedIntermediateWaypointIndices;

          if (indices && indices.length === stops.length - 2) {
            const middleStops = stops.slice(1, -1);
            const reorderedMiddle = indices.map((i) => middleStops[i]).filter(Boolean);
            if (reorderedMiddle.length === middleStops.length) {
              const reordered = [stops[0], ...reorderedMiddle, stops[stops.length - 1]];
              const changed = reordered.some((s, idx) => s.id !== stops[idx].id);
              const savedMeters = Math.max(
                0,
                (baseRoute?.distanceMeters ?? 0) - (optRoute?.distanceMeters ?? 0)
              );
              const savedMillis = Math.max(
                0,
                (baseRoute?.durationMillis ?? 0) - (optRoute?.durationMillis ?? 0)
              );
              return {
                reordered,
                changed,
                savedMeters,
                savedMillis,
                usedRoutesApi: true,
              };
            }
          }
        } catch (err) {
          if (isQuotaError(err)) {
            reportQuotaExceeded();
          } else {
            console.warn('Routes API waypoint optimization fell back to geographic solver:', err);
          }
        }
      }

      // Geographic shortest-path fallback (handles flights, sea crossings, or offline mode)
      const geo = optimizeStopsGeographically(stops);
      return {
        reordered: geo.reordered,
        changed: geo.changed,
        savedMeters: Math.round(geo.savedKm * 1000),
        savedMillis: estimateFallbackDurationMillis(geo.savedKm, mode, false),
        usedRoutesApi: false,
      };
    });
  }, [routesLib, registerOptimizer]);

  return null;
};

export const DayMapComponent: React.FC<DayMapComponentProps> = ({
  activeDay,
  allDays,
  stops,
  selectedStopId,
  onSelectStop,
  onSelectDay,
  onOptimizeStops,
  onToggleStopCompleted,
  onRouteSummaryChange,
}) => {
  const [travelMode, setTravelMode] = useState<RouteTravelMode>('DRIVING');
  const [mapScope, setMapScope] = useState<'day' | 'trip'>('day');
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [fitTrigger, setFitTrigger] = useState(0);

  const [routeSummary, setRouteSummary] = useState<DayRouteSummary | null>(null);
  const [isComputingRoute, setIsComputingRoute] = useState(false);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeToast, setOptimizeToast] = useState<{
    message: string;
    previousStops?: ItineraryStop[];
  } | null>(null);

  const [anchoredMarker, setAnchoredMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  const optimizerFnRef = useRef<
    | ((
        stops: ItineraryStop[],
        mode: RouteTravelMode
      ) => Promise<{
        reordered: ItineraryStop[];
        changed: boolean;
        savedMeters: number;
        savedMillis: number;
        usedRoutesApi: boolean;
      }>)
    | null
  >(null);

  const registerOptimizer = useCallback(
    (
      fn: (
        stops: ItineraryStop[],
        mode: RouteTravelMode
      ) => Promise<{
        reordered: ItineraryStop[];
        changed: boolean;
        savedMeters: number;
        savedMillis: number;
        usedRoutesApi: boolean;
      }>
    ) => {
      optimizerFnRef.current = fn;
    },
    []
  );

  // Clear stale toast & marker anchor when switching days
  useEffect(() => {
    setOptimizeToast(null);
    setAnchoredMarker(null);
  }, [activeDay.dayNumber]);

  const handleRouteComputed = useCallback(
    (summary: DayRouteSummary | null, computing: boolean) => {
      setIsComputingRoute(computing);
      if (!computing) {
        setRouteSummary(summary);
        onRouteSummaryChange?.(summary);
      }
    },
    [onRouteSummaryChange]
  );

  const handleMarkerSelect = useCallback(
    (stop: ItineraryStop, marker: google.maps.marker.AdvancedMarkerElement | null) => {
      onSelectStop(stop.id);
      setAnchoredMarker(marker);
    },
    [onSelectStop]
  );

  const handleOptimizeRouteClick = async () => {
    if (stops.length < 3 || isOptimizing || !optimizerFnRef.current) return;
    setIsOptimizing(true);
    setOptimizeToast(null);

    try {
      const previousStops = [...stops];
      const result = await optimizerFnRef.current(stops, travelMode);

      if (result.changed) {
        onOptimizeStops(result.reordered);
        const savingsText =
          result.savedMeters >= 100
            ? `Saved ${formatDistanceMeters(result.savedMeters)}${
                result.savedMillis >= 60000 ? ` (${formatDurationMillis(result.savedMillis)})` : ''
              }`
            : 'Reordered for shortest path';

        setOptimizeToast({
          message: `Route optimized · ${savingsText}`,
          previousStops,
        });
      } else {
        setOptimizeToast({
          message: 'Day itinerary is already in the most efficient order',
        });
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleUndoOptimization = () => {
    if (optimizeToast?.previousStops) {
      onOptimizeStops(optimizeToast.previousStops);
      setOptimizeToast(null);
    }
  };

  const selectedStop = useMemo(
    () => stops.find((s) => s.id === selectedStopId) || null,
    [stops, selectedStopId]
  );

  const defaultCenter = useMemo(() => {
    if (stops.length > 0) {
      return { lat: stops[0].lat, lng: stops[0].lng };
    }
    return { lat: 48.8566, lng: 2.3522 };
  }, [stops]);

  const googleMapsExternalUrl = useMemo(() => {
    if (stops.length === 0) return 'https://www.google.com/maps';
    if (stops.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${stops[0].lat},${stops[0].lng}`;
    }
    const origin = `${stops[0].lat},${stops[0].lng}`;
    const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
    const waypoints = stops
      .slice(1, -1)
      .map((s) => `${s.lat},${s.lng}`)
      .join('|');
    const modeParam =
      travelMode === 'WALKING' ? 'walking' : travelMode === 'TRANSIT' ? 'transit' : 'driving';
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
      waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''
    }&travelmode=${modeParam}`;
  }, [stops, travelMode]);

  return (
    <div className="rounded-3xl glass-card overflow-hidden flex flex-col">
      {/* Top Map Control Bar */}
      <div className="px-4 py-3 border-b border-[#1a1a1a]/10 bg-[#fffdf8] flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Scope Switcher (Active Day vs Full 11-Day Trip) */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#fffbf2] border border-[#1a1a1a]/10">
          <button
            type="button"
            onClick={() => setMapScope('day')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              mapScope === 'day'
                ? 'bg-[#1a1a1a] text-[#fffbf2]'
                : 'text-[#1a1a1a]/65 hover:text-[#1a1a1a]'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${mapScope === 'day' ? 'text-[#ff5e3a]' : 'text-[#1a1a1a]/50'}`} />
            <span>Day {activeDay.dayNumber}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapScope('trip')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              mapScope === 'trip'
                ? 'bg-[#1a1a1a] text-[#fffbf2]'
                : 'text-[#1a1a1a]/65 hover:text-[#1a1a1a]'
            }`}
          >
            <Globe2 className={`w-3.5 h-3.5 ${mapScope === 'trip' ? 'text-[#4ecdc4]' : 'text-[#1a1a1a]/50'}`} />
            <span>All 11 Days</span>
          </button>
        </div>

        {/* Center/Right: Travel Modes & Optimize Route CTA */}
        <div className="flex items-center flex-wrap gap-2">
          {mapScope === 'day' && (
            <div className="flex items-center gap-0.5 p-1 rounded-xl bg-[#fffbf2] border border-[#1a1a1a]/10">
              {(
                [
                  { id: 'DRIVING', label: 'Drive', icon: Car },
                  { id: 'WALKING', label: 'Walk', icon: Footprints },
                  { id: 'TRANSIT', label: 'Transit', icon: TrainFront },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = travelMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTravelMode(m.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#1a1a1a] text-[#fffbf2]'
                        : 'text-[#1a1a1a]/65 hover:text-[#1a1a1a]'
                    }`}
                    title={`Route via ${m.label}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Optimize Route Primary Action Button */}
          {mapScope === 'day' && (
            <button
              type="button"
              onClick={handleOptimizeRouteClick}
              disabled={stops.length < 3 || isOptimizing}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                stops.length < 3
                  ? 'bg-[#1a1a1a]/8 text-[#1a1a1a]/35 cursor-not-allowed'
                  : 'bg-[#ff5e3a] hover:bg-[#e84f2d] text-white active:scale-[0.98]'
              }`}
              title={
                stops.length < 3
                  ? 'Add at least 3 stops to optimize route order'
                  : 'Automatically reorder intermediate stops for the fastest, shortest travel path'
              }
            >
              {isOptimizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-white" />
              )}
              <span>{isOptimizing ? 'Optimizing...' : 'Optimize Route'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Explicit-Height Google Map Canvas (CF2 compliant) */}
      <div className="relative w-full h-[360px] sm:h-[430px] lg:h-[calc(100vh-230px)] lg:min-h-[540px] bg-slate-100">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={defaultCenter}
          defaultZoom={12}
          mapTypeId={mapTypeId}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
          internalUsageAttributionIds={[GMP_ATTRIBUTION_ID]}
          onClick={() => {
            onSelectStop(null);
            setAnchoredMarker(null);
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <MapRouteLayer
            mapScope={mapScope}
            activeDayNumber={activeDay.dayNumber}
            stops={stops}
            allDays={allDays}
            travelMode={travelMode}
            selectedStopId={selectedStopId}
            fitTrigger={fitTrigger}
            onRouteComputed={handleRouteComputed}
          />

          <RouteOptimizerBridge registerOptimizer={registerOptimizer} />

          {/* Active Day Stop Pins */}
          {mapScope === 'day' &&
            stops.map((stop, idx) => (
              <StopMarkerItem
                key={stop.id}
                stop={stop}
                index={idx}
                isSelected={selectedStopId === stop.id}
                onSelect={handleMarkerSelect}
              />
            ))}

          {/* All 11 Days Overview Pins */}
          {mapScope === 'trip' &&
            allDays.map((day) => {
              const hub = day.stops?.[0];
              if (!hub) return null;
              const isCurrent = day.dayNumber === activeDay.dayNumber;
              return (
                <AdvancedMarker
                  key={`trip-day-${day.dayNumber}`}
                  position={{ lat: hub.lat, lng: hub.lng }}
                  zIndex={isCurrent ? 1000 : 100 + day.dayNumber}
                  title={`Day ${day.dayNumber}: ${day.title}`}
                  onClick={() => {
                    onSelectDay(day.dayNumber);
                    setMapScope('day');
                  }}
                >
                  <div
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border-2 border-white shadow-md cursor-pointer transition-transform hover:scale-105 ${
                      isCurrent
                        ? 'bg-[#ff5e3a] text-white'
                        : 'bg-[#1a1a1a] text-[#fffbf2]'
                    }`}
                  >
                    D{day.dayNumber}
                  </div>
                </AdvancedMarker>
              );
            })}

          {/* Anchored InfoWindow for Selected Stop */}
          {mapScope === 'day' && selectedStop && anchoredMarker && (
            <InfoWindow
              anchor={anchoredMarker}
              pixelOffset={[0, -6]}
              onCloseClick={() => {
                onSelectStop(null);
                setAnchoredMarker(null);
              }}
            >
              <div className="p-1 max-w-[240px] space-y-2 text-[#1a1a1a]">
                <div className="flex items-center gap-1.5 text-[11px] text-[#1a1a1a]/60 font-medium">
                  <StopCategoryIcon category={selectedStop.category} className="w-3.5 h-3.5 text-[#ff5e3a]" />
                  <span>{(CATEGORY_COLORS[selectedStop.category] || CATEGORY_COLORS.activity).label}</span>
                  {selectedStop.time && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-fluid tabular-nums text-[#1a1a1a] font-semibold">
                        {selectedStop.time}
                      </span>
                    </>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-extrabold text-[#1a1a1a] leading-snug">
                    {selectedStop.name}
                  </h4>
                  {selectedStop.address && (
                    <p className="text-xs text-[#1a1a1a]/60 mt-0.5 leading-snug">
                      {selectedStop.address}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onToggleStopCompleted(selectedStop.id)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                      selectedStop.completed
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-[#fffbf2] hover:bg-[#1a1a1a]/5 text-[#1a1a1a] border border-[#1a1a1a]/15'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{selectedStop.completed ? 'Visited' : 'Mark Done'}</span>
                  </button>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStop.lat},${selectedStop.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2.5 rounded-lg bg-[#ff5e3a] hover:bg-[#e84f2d] text-white text-xs font-bold flex items-center gap-1"
                  >
                    <span>Go</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Top-Right Floating Map Utility Buttons (Recenter & Map/Satellite) */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setFitTrigger((c) => c + 1)}
            className="min-h-[38px] min-w-[38px] rounded-xl bg-white/95 hover:bg-white text-slate-700 shadow-md border border-slate-200/80 flex items-center justify-center transition-colors"
            title="Fit all stops in view"
            aria-label="Fit all stops in view"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setMapTypeId((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))}
            className={`min-h-[38px] min-w-[38px] rounded-xl shadow-md border flex items-center justify-center transition-colors ${
              mapTypeId === 'hybrid'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-white/95 hover:bg-white text-slate-700 border-slate-200/80'
            }`}
            title={mapTypeId === 'roadmap' ? 'Switch to Satellite view' : 'Switch to Map view'}
            aria-label="Toggle map or satellite view"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        {/* Optimization Result Notification Toast */}
        {optimizeToast && (
          <div className="absolute top-3 left-3 right-14 z-10 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-slate-900/95 text-white text-xs font-semibold shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{optimizeToast.message}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {optimizeToast.previousStops && (
                <button
                  type="button"
                  onClick={handleUndoOptimization}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOptimizeToast(null)}
                className="text-slate-300 hover:text-white text-xs px-1"
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Route Summary Footer Bar */}
      <div className="px-4 py-3 border-t border-[#1a1a1a]/10 bg-[#fffdf8] flex flex-wrap items-center justify-between gap-2 text-xs">
        {mapScope === 'trip' ? (
          <div className="flex items-center gap-2 text-[#1a1a1a]/70 font-medium">
            <Globe2 className="w-4 h-4 text-[#ff5e3a] shrink-0" />
            <span>
              Full 11-day Europe route · Click any day marker (D1–D11) to open its itinerary
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 text-[#1a1a1a]/75 font-medium min-w-0">
              <Navigation className="w-4 h-4 text-[#ff5e3a] shrink-0" />
              {isComputingRoute ? (
                <span className="text-[#1a1a1a]/50">Calculating route...</span>
              ) : routeSummary ? (
                <div className="flex items-center gap-2 flex-wrap font-mono-fluid tabular-nums">
                  <span className="font-bold text-[#1a1a1a]">
                    {formatDistanceMeters(routeSummary.totalDistanceMeters)}
                  </span>
                  <span aria-hidden="true" className="text-[#1a1a1a]/30">
                    ·
                  </span>
                  <span className="font-semibold text-[#1a1a1a]/75">
                    {formatDurationMillis(routeSummary.totalDurationMillis)}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ·
                  </span>
                  <span className="text-slate-500">
                    {stops.length} stops
                    {routeSummary.isFallbackOnly ? ' (air / direct path)' : ''}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500">
                  {stops.length} {stops.length === 1 ? 'stop' : 'stops'} on Day {activeDay.dayNumber}
                </span>
              )}
            </div>

            <a
              href={googleMapsExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </>
        )}
      </div>
    </div>
  );
};
