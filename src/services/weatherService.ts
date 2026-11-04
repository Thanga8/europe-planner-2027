export interface DestinationCoordinates {
  name: string;
  lat: number;
  lon: number;
}

export const DESTINATION_COORDINATES: Record<string, DestinationCoordinates> = {
  paris: { name: 'Paris, France', lat: 48.8566, lon: 2.3522 },
  zurich: { name: 'Zurich, Switzerland', lat: 47.3769, lon: 8.5417 },
  lucerne: { name: 'Lucerne, Switzerland', lat: 47.0502, lon: 8.3093 },
  titlis: { name: 'Mt. Titlis / Engelberg', lat: 46.7722, lon: 8.4378 },
  engelberg: { name: 'Engelberg, Switzerland', lat: 46.8206, lon: 8.4069 },
  rovaniemi: { name: 'Rovaniemi, Lapland', lat: 66.5039, lon: 25.7294 },
  lapland: { name: 'Rovaniemi, Lapland', lat: 66.5039, lon: 25.7294 },
  apukka: { name: 'Apukka Resort, Lapland', lat: 66.5772, lon: 26.0152 },
  helsinki: { name: 'Helsinki, Finland', lat: 60.1699, lon: 24.9384 },
};

export interface LiveWeatherReport {
  city: string;
  currentTemp: number;
  apparentTemp: number;
  minTemp: number;
  maxTemp: number;
  conditionText: string;
  precipitationProbability: number;
  snowfallSumCm: number;
  isSnowing: boolean;
  sunrise: string;
  sunset: string;
  fetchedAt: string;
}

const WEATHER_CODE_MAP: Record<number, string> = {
  0: 'Clear sky ☀️',
  1: 'Mainly clear 🌤️',
  2: 'Partly cloudy ⛅',
  3: 'Overcast ☁️',
  45: 'Foggy 🌫️',
  48: 'Depositing rime fog 🌫️',
  51: 'Light drizzle 🌦️',
  53: 'Moderate drizzle 🌧️',
  55: 'Dense drizzle 🌧️',
  61: 'Slight rain 🌧️',
  63: 'Moderate rain 🌧️',
  65: 'Heavy rain 🌧️',
  71: 'Slight snowfall 🌨️',
  73: 'Moderate snowfall ❄️',
  75: 'Heavy snowfall ❄️',
  77: 'Snow grains 🌨️',
  80: 'Slight rain showers 🌦️',
  81: 'Moderate rain showers 🌧️',
  82: 'Violent rain showers ⛈️',
  85: 'Slight snow showers 🌨️',
  86: 'Heavy snow showers ❄️',
  95: 'Thunderstorm ⛈️',
  96: 'Thunderstorm with hail ⛈️',
  99: 'Thunderstorm with heavy hail ⛈️',
};

// In-memory cache to prevent repetitive calls within 15 minutes
const weatherCache = new Map<string, { data: LiveWeatherReport; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Resolve coordinates from a location string or itinerary title
 */
export function getCoordinatesForLocation(locationStr: string): DestinationCoordinates {
  const norm = (locationStr || '').toLowerCase();
  for (const [key, coords] of Object.entries(DESTINATION_COORDINATES)) {
    if (norm.includes(key)) {
      return coords;
    }
  }
  return DESTINATION_COORDINATES.paris;
}

/**
 * Fetch live weather from Open-Meteo API (100% Free, Zero API Keys)
 */
export async function fetchLiveWeather(locationStr: string): Promise<LiveWeatherReport | null> {
  const coords = getCoordinatesForLocation(locationStr);
  const cacheKey = `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`;

  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum,sunrise,sunset&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn('Weather API response status:', res.status);
      return null;
    }

    const data = await res.json();
    const current = data.current || {};
    const daily = data.daily || {};

    const code = current.weather_code ?? daily.weather_code?.[0] ?? 0;
    const condition = WEATHER_CODE_MAP[code] || 'Partly cloudy ⛅';
    const isSnow = code >= 71 && code <= 86;

    const sunriseIso = daily.sunrise?.[0] || '';
    const sunsetIso = daily.sunset?.[0] || '';
    const formatTime = (iso: string) => {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      } catch {
        return '';
      }
    };

    const report: LiveWeatherReport = {
      city: coords.name,
      currentTemp: Math.round(current.temperature_2m ?? daily.temperature_2m_max?.[0] ?? 0),
      apparentTemp: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
      minTemp: Math.round(daily.temperature_2m_min?.[0] ?? current.temperature_2m ?? 0),
      maxTemp: Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? 0),
      conditionText: condition,
      precipitationProbability: daily.precipitation_probability_max?.[0] ?? 0,
      snowfallSumCm: Math.round((daily.snowfall_sum?.[0] ?? 0) * 10) / 10,
      isSnowing: isSnow,
      sunrise: formatTime(sunriseIso),
      sunset: formatTime(sunsetIso),
      fetchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    weatherCache.set(cacheKey, { data: report, timestamp: Date.now() });
    return report;
  } catch (err) {
    console.warn('Live weather fetch error:', err);
    return null;
  }
}

