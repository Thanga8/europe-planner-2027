import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, Plus, X, MapPin, Loader2, Clock } from 'lucide-react';
import { ItineraryStop, ItineraryStopCategory } from '../types';
import { isQuotaError, reportQuotaExceeded } from '../services/googleMapsConfig';

interface PlaceSearchAddStopProps {
  dayNumber: number;
  dayLocation: string;
  biasCenter?: { lat: number; lng: number };
  onAddStop: (stop: ItineraryStop) => void;
  onClose?: () => void;
}

const CATEGORY_OPTIONS: { id: ItineraryStopCategory; label: string }[] = [
  { id: 'activity', label: 'Sightseeing' },
  { id: 'food', label: 'Dining' },
  { id: 'hotel', label: 'Stay' },
  { id: 'station', label: 'Transit' },
  { id: 'flight', label: 'Airport' },
];

export const PlaceSearchAddStop: React.FC<PlaceSearchAddStopProps> = ({
  dayNumber,
  dayLocation,
  biasCenter,
  onAddStop,
  onClose,
}) => {
  const placesLib = useMapsLibrary('places');

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedPlace, setSelectedPlace] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
    placeId?: string;
    inferredCategory: ItineraryStopCategory;
  } | null>(null);
  const [stopTime, setStopTime] = useState('');
  const [stopCategory, setStopCategory] = useState<ItineraryStopCategory>('activity');

  // Manage session token lifecycle strictly per Places API (New) guidelines
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  useEffect(() => {
    if (!placesLib || !query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const request: google.maps.places.AutocompleteRequest = {
          input: query.trim(),
          sessionToken: sessionTokenRef.current,
          ...(biasCenter
            ? {
                locationBias: {
                  north: biasCenter.lat + 0.35,
                  south: biasCenter.lat - 0.35,
                  east: biasCenter.lng + 0.5,
                  west: biasCenter.lng - 0.5,
                },
              }
            : {}),
        };

        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (!cancelled) {
          setSuggestions(response.suggestions || []);
        }
      } catch (err) {
        if (!cancelled) {
          if (isQuotaError(err)) {
            reportQuotaExceeded();
            setSearchError('Places search limit reached. Please try again later.');
          } else {
            console.warn('Places autocomplete error:', err);
            setSearchError('Could not load place suggestions right now.');
          }
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, query, biasCenter]);

  const inferCategory = (types?: string[]): ItineraryStopCategory => {
    if (!types || types.length === 0) return 'activity';
    const joined = types.join(' ').toLowerCase();
    if (joined.includes('airport')) return 'flight';
    if (joined.includes('train') || joined.includes('transit') || joined.includes('station') || joined.includes('subway')) return 'station';
    if (joined.includes('lodging') || joined.includes('hotel')) return 'hotel';
    if (joined.includes('restaurant') || joined.includes('cafe') || joined.includes('bakery') || joined.includes('bar') || joined.includes('food')) return 'food';
    return 'activity';
  };

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!placesLib || !suggestion.placePrediction) return;
    setIsFetchingDetails(true);
    setSearchError(null);

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'id', 'types'],
      });

      const loc = place.location;
      if (!loc) {
        setSearchError('Selected place did not return map coordinates.');
        return;
      }

      const category = inferCategory(place.types || undefined);
      setSelectedPlace({
        name: place.displayName || suggestion.placePrediction.mainText?.text || 'Selected Place',
        address: place.formattedAddress || suggestion.placePrediction.secondaryText?.text || dayLocation,
        lat: loc.lat(),
        lng: loc.lng(),
        placeId: place.id,
        inferredCategory: category,
      });
      setStopCategory(category);
      setQuery('');
      resetSession();
    } catch (err) {
      if (isQuotaError(err)) {
        reportQuotaExceeded();
        setSearchError('Google Maps quota reached while fetching place details.');
      } else {
        console.warn('Place fetchFields error:', err);
        setSearchError('Unable to fetch place details.');
      }
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleConfirmAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace) return;

    const newStop: ItineraryStop = {
      id: `stop-d${dayNumber}-${Date.now()}`,
      name: selectedPlace.name,
      address: selectedPlace.address,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      placeId: selectedPlace.placeId,
      category: stopCategory,
      time: stopTime.trim() || undefined,
      completed: false,
    };

    onAddStop(newStop);
    setSelectedPlace(null);
    setStopTime('');
    setQuery('');
    if (onClose) onClose();
  };

  return (
    <div className="p-4 rounded-2xl bg-white/90 border border-sky-200/90 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-900">
          Add Place to Day {dayNumber}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close place search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!selectedPlace ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search landmarks, cafes, stations near ${dayLocation.split(',')[0]}...`}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              autoFocus
            />
            {(isSearching || isFetchingDetails) && (
              <Loader2 className="w-4 h-4 text-sky-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {searchError && (
            <p className="text-[11px] font-medium text-rose-600 px-1">{searchError}</p>
          )}

          {suggestions.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden max-h-56 overflow-y-auto shadow-xs">
              {suggestions.map((s, idx) => {
                const pred = s.placePrediction;
                if (!pred) return null;
                return (
                  <li key={pred.placeId || idx}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-3 py-2.5 hover:bg-sky-50 transition-colors flex items-start gap-2.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {pred.mainText?.text || pred.text.text}
                        </div>
                        {pred.secondaryText?.text && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {pred.secondaryText.text}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!placesLib && (
            <p className="text-[11px] text-slate-500 px-1">
              Loading Google Places search...
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleConfirmAdd} className="space-y-3">
          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{selectedPlace.name}</p>
              <p className="text-[11px] text-slate-600 truncate mt-0.5">{selectedPlace.address}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlace(null)}
              className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 whitespace-nowrap shrink-0"
            >
              Change
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Scheduled Time (Optional)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stopTime}
                  onChange={(e) => setStopTime(e.target.value)}
                  placeholder="e.g. 03:30 PM"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Stop Category
              </label>
              <select
                value={stopCategory}
                onChange={(e) => setStopCategory(e.target.value as ItineraryStopCategory)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stop to Route</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlace(null)}
              className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
