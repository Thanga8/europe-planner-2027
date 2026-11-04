export interface MapStop {
  id: string;
  name: string;
  category: 'hotel' | 'activity' | 'station' | 'flight';
  lat: number;
  lon: number;
  time?: string;
  address?: string;
}

export const CURATED_DAY_STOPS: Record<number, MapStop[]> = {
  // Day 1: Hyderabad -> Paris CDG
  1: [
    { id: 'd1-cdg', name: 'Paris Charles de Gaulle (CDG) Airport', category: 'flight', lat: 49.0097, lon: 2.5479, time: '14:30 PM', address: 'Terminal 1 / 2, Roissy-en-France' },
    { id: 'd1-hotel', name: 'Central Paris Boutique Hotel', category: 'hotel', lat: 48.8698, lon: 2.3308, time: '16:30 PM', address: '14 Rue de la Paix, Paris' },
    { id: 'd1-seine', name: 'Boulevard Saint-Germain & Seine Walk', category: 'activity', lat: 48.8530, lon: 2.3330, time: '18:30 PM', address: 'Saint-Germain-des-Prés, Paris' },
  ],
  // Day 2: Parisian Highlights
  2: [
    { id: 'd2-hotel', name: 'Paris Boutique Hotel', category: 'hotel', lat: 48.8698, lon: 2.3308, time: '09:00 AM', address: 'Central Paris' },
    { id: 'd2-louvre', name: 'Louvre Museum & Tuileries Garden', category: 'activity', lat: 48.8606, lon: 2.3376, time: '10:30 AM', address: 'Rue de Rivoli, Paris' },
    { id: 'd2-montmartre', name: 'Montmartre & Sacré-Cœur Basilica', category: 'activity', lat: 48.8867, lon: 2.3431, time: '14:30 PM', address: '35 Rue du Chevalier de la Barre, Paris' },
    { id: 'd2-eiffel', name: 'Eiffel Tower & Seine Cruise', category: 'activity', lat: 48.8584, lon: 2.2945, time: '18:00 PM', address: 'Champ de Mars, Paris' },
  ],
  // Day 3: Paris -> Zurich -> Lucerne
  3: [
    { id: 'd3-garelyon', name: 'Paris Gare de Lyon (TGV Lyria)', category: 'station', lat: 48.8443, lon: 2.3730, time: '07:22 AM', address: 'Pl. Louis Armand, Paris' },
    { id: 'd3-zurichhb', name: 'Zurich Hauptbahnhof (HB)', category: 'station', lat: 47.3782, lon: 8.5402, time: '11:26 AM', address: 'Bahnhofplatz, Zurich' },
    { id: 'd3-lindt', name: 'Lindt Home of Chocolate', category: 'activity', lat: 47.3247, lon: 8.5528, time: '12:30 PM', address: 'Schokoladenplatz 1, Kilchberg' },
    { id: 'd3-lucernestation', name: 'Lucerne Central Station', category: 'station', lat: 47.0502, lon: 8.3093, time: '16:00 PM', address: 'Zentralstrasse 1, Lucerne' },
    { id: 'd3-monopol', name: 'Hotel Monopol & Chapel Bridge', category: 'hotel', lat: 47.0498, lon: 8.3090, time: '17:00 PM', address: 'Pilatusstrasse 1, Lucerne' },
  ],
  // Day 4: Mount Titlis Alpine Summit
  4: [
    { id: 'd4-hotel', name: 'Hotel Monopol Lucerne', category: 'hotel', lat: 47.0498, lon: 8.3090, time: '08:30 AM', address: 'Lucerne, Switzerland' },
    { id: 'd4-engelberg', name: 'Engelberg Alpine Village Station', category: 'station', lat: 46.8206, lon: 8.4069, time: '09:30 AM', address: 'Klosterstrasse, Engelberg' },
    { id: 'd4-rotair', name: 'TITLIS Rotair Cable Car', category: 'activity', lat: 46.8150, lon: 8.4100, time: '10:15 AM', address: 'Poststrasse 3, Engelberg' },
    { id: 'd4-summit', name: 'Titlis Cliff Walk & Summit (3,020m)', category: 'activity', lat: 46.7722, lon: 8.4378, time: '11:30 AM', address: 'Mount Titlis Glacier Summit' },
    { id: 'd4-trubsee', name: 'Trübsee Snow Park & Tobogganing', category: 'activity', lat: 46.7970, lon: 8.4060, time: '14:00 PM', address: 'Trübsee Station, Engelberg' },
  ],
  // Day 5: Zurich -> Rovaniemi (Lapland)
  5: [
    { id: 'd5-lucerne', name: 'Lucerne Railway Station', category: 'station', lat: 47.0502, lon: 8.3093, time: '08:00 AM', address: 'Lucerne' },
    { id: 'd5-zrh', name: 'Zurich Airport (ZRH)', category: 'flight', lat: 47.4582, lon: 8.5555, time: '09:15 AM', address: 'Kloten, Switzerland' },
    { id: 'd5-hel', name: 'Helsinki Vantaa Airport (HEL Transit)', category: 'flight', lat: 60.3172, lon: 24.9633, time: '14:45 PM', address: 'Vantaa, Finland' },
    { id: 'd5-rvn', name: 'Rovaniemi Arctic Airport (RVN)', category: 'flight', lat: 66.5647, lon: 25.8304, time: '17:45 PM', address: 'Lentokentäntie, Rovaniemi' },
    { id: 'd5-apt', name: 'Rovaniemi City Center Apartment & Sauna', category: 'hotel', lat: 66.5039, lon: 25.7294, time: '18:45 PM', address: 'Koskikatu, Rovaniemi' },
  ],
  // Day 6: Santa Claus Village & Aurora Chase
  6: [
    { id: 'd6-apt', name: 'Rovaniemi City Apartment', category: 'hotel', lat: 66.5039, lon: 25.7294, time: '09:30 AM', address: 'Rovaniemi' },
    { id: 'd6-santa', name: 'Santa Claus Holiday Village & Arctic Circle', category: 'activity', lat: 66.5436, lon: 25.8473, time: '10:30 AM', address: 'Tähtikuja 1, Rovaniemi' },
    { id: 'd6-reindeer', name: 'Reindeer Forest Sleigh Ride', category: 'activity', lat: 66.5445, lon: 25.8490, time: '13:00 PM', address: 'Arctic Circle Pine Woods' },
    { id: 'd6-aurora', name: 'Taiga Wilderness Aurora Borealis Camp', category: 'activity', lat: 66.5900, lon: 25.9200, time: '19:30 PM', address: 'Deep Taiga Forest, Rovaniemi' },
  ],
  // Day 7: Husky Safari & Snowmobiles
  7: [
    { id: 'd7-apt', name: 'Rovaniemi City Apartment', category: 'hotel', lat: 66.5039, lon: 25.7294, time: '09:00 AM', address: 'Rovaniemi' },
    { id: 'd7-husky', name: 'Self-Drive Husky Sledding Safari', category: 'activity', lat: 66.5750, lon: 26.0120, time: '10:00 AM', address: 'Wilderness Husky Trail' },
    { id: 'd7-snowmobile', name: 'Snowmobile Safari Across Frozen Lakes', category: 'activity', lat: 66.5100, lon: 25.7700, time: '14:00 PM', address: 'Ounasvaara Wilderness' },
  ],
  // Day 8: Apukka Glass Igloos
  8: [
    { id: 'd8-center', name: 'Rovaniemi City Center Departure', category: 'station', lat: 66.5039, lon: 25.7294, time: '11:00 AM', address: 'Rovaniemi' },
    { id: 'd8-apukka', name: 'Apukka Resort (Heated Glass Igloos)', category: 'hotel', lat: 66.5772, lon: 26.0152, time: '14:00 PM', address: 'Tutkijantie 1, Rovaniemi' },
    { id: 'd8-sauna', name: 'Lakeside Sauna & Snow Bath', category: 'activity', lat: 66.5780, lon: 26.0160, time: '17:00 PM', address: 'Lake Olkkajärvi Shore' },
    { id: 'd8-night', name: 'Aurora Viewing from Glass Dome', category: 'activity', lat: 66.5790, lon: 26.0180, time: '21:00 PM', address: 'Apukka Wilderness' },
  ],
  // Day 9: Polar Explorer Icebreaker
  9: [
    { id: 'd9-apukka', name: 'Apukka Resort Lapland', category: 'hotel', lat: 66.5772, lon: 26.0152, time: '07:00 AM', address: 'Rovaniemi' },
    { id: 'd9-icebreaker', name: 'Bothnian Sea Polar Explorer Icebreaker', category: 'activity', lat: 65.7333, lon: 24.5667, time: '09:30 AM', address: 'Axelsvik Port, Bothnian Bay' },
    { id: 'd9-floating', name: 'Ice Floating in Survival Suit', category: 'activity', lat: 65.7350, lon: 24.5700, time: '11:30 AM', address: 'Frozen Bothnian Sea' },
    { id: 'd9-station', name: 'Rovaniemi Station (VR Santa Claus Express)', category: 'station', lat: 66.4975, lon: 25.7058, time: '20:30 PM', address: 'Ratakatun, Rovaniemi' },
  ],
  // Day 10: Helsinki Highlights
  10: [
    { id: 'd10-station', name: 'Helsinki Central Railway Station', category: 'station', lat: 60.1708, lon: 24.9414, time: '07:30 AM', address: 'Kaivokatu 1, Helsinki' },
    { id: 'd10-cathedral', name: 'Senate Square & Helsinki Cathedral', category: 'activity', lat: 60.1695, lon: 24.9523, time: '10:00 AM', address: 'Unioninkatu 29, Helsinki' },
    { id: 'd10-market', name: 'Market Square & Old Market Hall', category: 'activity', lat: 60.1670, lon: 24.9535, time: '13:00 PM', address: 'Eteläranta, Helsinki' },
    { id: 'd10-hotel', name: 'Central Helsinki Boutique Hotel', category: 'hotel', lat: 60.1685, lon: 24.9450, time: '15:30 PM', address: 'Kluuvi, Helsinki' },
  ],
  // Day 11: Helsinki -> Hyderabad (Return)
  11: [
    { id: 'd11-hotel', name: 'Central Helsinki Hotel Check-out', category: 'hotel', lat: 60.1685, lon: 24.9450, time: '09:00 AM', address: 'Helsinki' },
    { id: 'd11-hel', name: 'Helsinki Vantaa Airport (HEL)', category: 'flight', lat: 60.3172, lon: 24.9633, time: '11:00 AM', address: 'Lentoasemantie 1, Vantaa' },
  ],
};

/**
 * Returns the basecamp (hotel or primary departure origin) for any given day
 */
export function getBasecampForDay(dayNumber: number): MapStop {
  const stops = CURATED_DAY_STOPS[dayNumber] || CURATED_DAY_STOPS[1];
  const hotel = stops.find(s => s.category === 'hotel');
  return hotel || stops[0];
}

/**
 * Returns all planned stops for a day
 */
export function getStopsForDay(dayNumber: number): MapStop[] {
  return CURATED_DAY_STOPS[dayNumber] || CURATED_DAY_STOPS[1];
}

