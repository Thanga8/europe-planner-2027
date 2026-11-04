import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, 
  ExternalLink, 
  Navigation, 
  ChevronRight,
  Plane,
  Bed,
  Train,
  Ticket
} from 'lucide-react';
import { DayItinerary, TripBookingItem } from '../types';
import { MapStop, CURATED_DAY_STOPS } from '../data/curatedStops';

interface DayMapComponentProps {
  activeDay: DayItinerary;
  dayBookings: TripBookingItem[];
}

export const DayMapComponent: React.FC<DayMapComponentProps> = ({ activeDay, dayBookings }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [stops, setStops] = useState<MapStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<MapStop | null>(null);

  // Synchronize curated stops for the active day, integrating dynamic hotel name and location
  useEffect(() => {
    const defaultStops = CURATED_DAY_STOPS[activeDay.dayNumber] || CURATED_DAY_STOPS[1];
    const dayStay = dayBookings.find(b => b.category === 'stay');
    const adjustedStops = defaultStops.map(stop => {
      if (stop.category === 'hotel' && dayStay) {
        const cleanName = dayStay.title.replace(/\s*\((?:Night\s*\d+|2\s*Nights|3\s*Nights|\d+\s*Nights)[^)]*\)/i, '').trim();
        return {
          ...stop,
          name: cleanName || stop.name,
          address: dayStay.location || stop.address,
        };
      }
      return stop;
    });
    setStops(adjustedStops);
    setSelectedStop(adjustedStops[0] || null);
  }, [activeDay.dayNumber, dayBookings]);

  // Initialize Map container once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const container = mapContainerRef.current;
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    let map: L.Map | null = null;
    try {
      const initialStops = CURATED_DAY_STOPS[activeDay.dayNumber] || CURATED_DAY_STOPS[1];
      const centerLat = initialStops[0]?.lat || 48.8566;
      const centerLon = initialStops[0]?.lon || 2.3522;

      map = L.map(container, {
        center: [centerLat, centerLon],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: false,
        zoomAnimation: false, // Prevents animation frame race conditions during tab unmount
      });

      // 100% Free OpenStreetMap standard tiles (Zero API key required, crisp street and topographic data)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersLayerRef.current = layerGroup;
    } catch (err) {
      console.warn('Leaflet map creation handled:', err);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Map cleanup handled:', e);
        }
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Update markers, polyline and view whenever stops change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup || stops.length === 0) return;

    try {
      layerGroup.clearLayers();

      const latLngs: L.LatLngExpression[] = [];

      stops.forEach((stop, index) => {
        const pinNumber = index + 1;
        // Distinct semantic color per category
        const bgColor = 
          stop.category === 'hotel' ? '#059669' :     // Emerald for Hotels
          stop.category === 'flight' ? '#4f46e5' :    // Indigo for Airports / Flights
          stop.category === 'station' ? '#d97706' :   // Amber for Trains / Stations
          '#0284c7';                                  // Sky Blue for Sightseeing / Activities

        const customIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `
            <div style="
              background-color: ${bgColor};
              color: #ffffff;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 13px;
              border: 2.5px solid #ffffff;
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              cursor: pointer;
            ">
              ${pinNumber}
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const marker = L.marker([stop.lat, stop.lon], { icon: customIcon });
        marker.on('click', () => {
          setSelectedStop(stop);
        });
        layerGroup.addLayer(marker);
        latLngs.push([stop.lat, stop.lon]);
      });

      // Connecting route polyline between stops
      if (latLngs.length > 1) {
        const polyline = L.polyline(latLngs, {
          color: '#0284c7',
          weight: 3.5,
          opacity: 0.85,
          dashArray: '6, 8',
        });
        layerGroup.addLayer(polyline);

        map.fitBounds(L.latLngBounds(latLngs), { padding: [35, 35], animate: false });
      } else {
        map.setView([stops[0].lat, stops[0].lon], 13, { animate: false });
      }

      // Re-invalidate container size once layout settles
      setTimeout(() => {
        try {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize({ animate: false });
          }
        } catch {}
      }, 100);
    } catch (err) {
      console.warn('Map update handled:', err);
    }
  }, [stops]);

  // Google Maps Multi-Stop Route URL: chains all waypoints into a turn-by-turn route
  const googleMapsRouteUrl = stops.length > 1
    ? `https://www.google.com/maps/dir/?api=1&origin=${stops[0].lat},${stops[0].lon}&destination=${stops[stops.length - 1].lat},${stops[stops.length - 1].lon}&waypoints=${stops.slice(1, -1).map(s => `${s.lat},${s.lon}`).join('|')}`
    : `https://www.google.com/maps/search/?api=1&query=${stops[0]?.lat},${stops[0]?.lon}`;

  const getCategoryIcon = (category: string) => {
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
    <div className="p-5 sm:p-6 rounded-[2.2rem] glass-card space-y-4 shadow-lg overflow-hidden border border-white/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Interactive Route Map
            </h3>
            <span className="text-[10px] text-slate-500 font-bold block">
              {stops.length} Planned Stops for Day {activeDay.dayNumber}
            </span>
          </div>
        </div>

        <a
          href={googleMapsRouteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[11px] shadow-sm flex items-center space-x-1.5 transition active:scale-95"
          title="Open complete day route with all waypoints in Google Maps"
        >
          <span>Open Full Route</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Map Canvas with OpenStreetMap tiles */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 h-64 sm:h-72">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Selected Stop Overlay Pill */}
        {selectedStop && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 p-3 rounded-2xl bg-white/95 backdrop-blur-md shadow-lg border border-slate-200 flex items-center justify-between text-xs animate-in fade-in">
            <div className="truncate pr-2">
              <div className="flex items-center space-x-1.5">
                {getCategoryIcon(selectedStop.category)}
                <span className="text-[9px] uppercase font-black text-slate-600 tracking-wider">
                  {selectedStop.category === 'hotel' ? 'Accomodation' : selectedStop.category === 'station' ? 'Transit Station' : selectedStop.category === 'flight' ? 'Flight Hub' : 'Sightseeing / Activity'}
                </span>
                {selectedStop.time && (
                  <span className="text-[9px] font-mono font-black text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded-md">
                    {selectedStop.time}
                  </span>
                )}
              </div>
              <p className="font-black text-slate-900 truncate text-xs mt-1">
                {selectedStop.name}
              </p>
              {selectedStop.address && (
                <span className="text-[10px] text-slate-500 font-semibold block truncate">
                  {selectedStop.address}
                </span>
              )}
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selectedStop.lat},${selectedStop.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold text-[11px] shrink-0 border border-sky-200 flex items-center space-x-1"
            >
              <span>Directions</span>
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Numbered Stop Sequence Ribbon */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block px-1">
          Stop Sequence ({stops.length}):
        </span>
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {stops.map((stop, idx) => {
            const isSelected = selectedStop?.id === stop.id;
            return (
              <button
                key={stop.id}
                type="button"
                onClick={() => {
                  setSelectedStop(stop);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([stop.lat, stop.lon], 14, { animate: false });
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition active:scale-95 border ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                    : 'glass-subcard hover:bg-white text-slate-700 border-slate-200'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center ${
                  isSelected ? 'bg-white text-sky-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {idx + 1}
                </span>
                <span className="truncate max-w-[130px] text-[11px]">
                  {stop.name.split('(')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
