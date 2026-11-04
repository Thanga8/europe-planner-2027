// Curated high-resolution travel photography for Europe '27 (Paris, Switzerland, Lapland, Helsinki)
// Styled after GetYourGuide's iconic destination banners
// Every image is meticulously matched to its exact activity, hotel, flight, or tour.

export const TRAVEL_IMAGES: Record<string, string> = {
  // Flights
  'flight-international': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop&q=80', // Airliner in sky
  'flight-arctic': 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&auto=format&fit=crop&q=80', // Airplane over snow landscape
  
  // Paris
  'paris-eiffel': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80', // Paris Eiffel Tower
  'paris-hotel': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&auto=format&fit=crop&q=80', // Chic boutique hotel room
  'paris-louvre': 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&auto=format&fit=crop&q=80', // Paris Louvre / historic Paris
  
  // Switzerland & Alpine Transit
  'tgv-train': 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&auto=format&fit=crop&q=80', // High-speed European train
  'swiss-alpine-train': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80', // Alpine scenic rail through mountains
  'lucerne-titlis': 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800&auto=format&fit=crop&q=80', // Mount Titlis glacier & snow peaks
  'lindt-chocolate': 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800&auto=format&fit=crop&q=80', // Artisanal Swiss chocolates
  'lucerne-hotel': 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&auto=format&fit=crop&q=80', // Warm Swiss hotel room with cozy duvet
  'zurich-city': 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&auto=format&fit=crop&q=80', // Zurich Old Town
  
  // Lapland & Rovaniemi
  'lapland-aurora': 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=800&auto=format&fit=crop&q=80', // Aurora Borealis dancing over snow cabin
  'lapland-glass-igloo': 'https://images.unsplash.com/photo-1517824806704-9040b037703b?w=800&auto=format&fit=crop&q=80', // Glowing glass cabin in winter forest
  'reindeer-safari': 'https://images.unsplash.com/photo-1544985361-b5523954608c?w=800&auto=format&fit=crop&q=80', // Reindeer in Arctic Lapland snow
  'husky-snowmobile': 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=800&auto=format&fit=crop&q=80', // Siberian husky in deep snow
  'rovaniemi-apartment': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80', // Modern Nordic apartment with cozy wooden sofa & interior (NO BOATS!)
  'santa-village': 'https://images.unsplash.com/photo-1543258103-a62bdc069871?w=800&auto=format&fit=crop&q=80', // Festive snowy Santa Claus Village
  'icebreaker-arctic': 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?w=800&auto=format&fit=crop&q=80', // Dramatic Arctic frozen ice field
  'santa-express-train': 'https://images.unsplash.com/photo-1515165562839-978bbcf18277?w=800&auto=format&fit=crop&q=80', // Night train sleeper through snowy pine trees

  // Helsinki
  'helsinki-city': 'https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5?w=800&auto=format&fit=crop&q=80', // Helsinki Cathedral & neoclassical square
  'helsinki-sauna': 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&auto=format&fit=crop&q=80', // Nordic wooden sauna experience
  
  // General Travel & Admin
  'visa-passport': 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80', // Passport, boarding passes & travel documents
  'food-dining': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80', // Warm cozy European restaurant dining table
};

// Direct 1-to-1 Mapping by Item ID for 100% precision
export const BOOKING_IMAGE_MAP: Record<string, string> = {
  // Flights
  'book-flight-hyd-cdg': TRAVEL_IMAGES['flight-international'],
  'book-flight-zrh-rvn': TRAVEL_IMAGES['flight-arctic'],
  'book-flight-hel-hyd': TRAVEL_IMAGES['flight-international'],

  // Paris
  'book-stay-paris-night1': TRAVEL_IMAGES['paris-hotel'],
  'book-stay-paris-night2': TRAVEL_IMAGES['paris-hotel'],

  // Switzerland
  'book-train-paris-zurich': TRAVEL_IMAGES['tgv-train'],
  'book-act-lindt': TRAVEL_IMAGES['lindt-chocolate'],
  'book-stay-lucerne-night1': TRAVEL_IMAGES['lucerne-hotel'],
  'book-travel-titlis-transit': TRAVEL_IMAGES['swiss-alpine-train'],
  'book-act-titlis': TRAVEL_IMAGES['lucerne-titlis'],
  'book-stay-lucerne-night2': TRAVEL_IMAGES['lucerne-hotel'],

  // Lapland / Rovaniemi
  'book-act-santa-aurora': TRAVEL_IMAGES['reindeer-safari'],
  'book-stay-rvn-apt-night1': TRAVEL_IMAGES['rovaniemi-apartment'], // Cozy modern Nordic apartment interior!
  'book-act-husky-snowmobile': TRAVEL_IMAGES['husky-snowmobile'],
  'book-stay-rvn-apt-night2': TRAVEL_IMAGES['rovaniemi-apartment'],
  'book-stay-glass-igloo': TRAVEL_IMAGES['lapland-glass-igloo'],
  'book-act-igloo-experience': TRAVEL_IMAGES['lapland-aurora'],
  'book-act-icebreaker': TRAVEL_IMAGES['icebreaker-arctic'],
  'book-stay-rvn-apt-night3': TRAVEL_IMAGES['rovaniemi-apartment'],
  'book-train-rvn-hel': TRAVEL_IMAGES['santa-express-train'],

  // Admin & Food
  'book-visa-schengen': TRAVEL_IMAGES['visa-passport'],
  'book-food-budget': TRAVEL_IMAGES['food-dining'],
};

// Fallback search with smart keyword matching
export const getItemImage = (itemId?: string, title: string = '', category: string = '', location: string = ''): string => {
  // 1. Direct ID match first (guarantees 100% accuracy)
  if (itemId && BOOKING_IMAGE_MAP[itemId]) {
    return BOOKING_IMAGE_MAP[itemId];
  }

  const t = title.toLowerCase();
  const loc = location.toLowerCase();

  // 2. Specific keyword matching
  if (t.includes('igloo') || t.includes('apukka') || t.includes('kakslauttanen')) {
    return TRAVEL_IMAGES['lapland-glass-igloo'];
  }
  if (t.includes('reindeer') || t.includes('santa claus')) {
    return TRAVEL_IMAGES['reindeer-safari'];
  }
  if (t.includes('husky') || t.includes('snowmobile') || t.includes('sled')) {
    return TRAVEL_IMAGES['husky-snowmobile'];
  }
  if (t.includes('aurora') || t.includes('northern lights')) {
    return TRAVEL_IMAGES['lapland-aurora'];
  }
  if (t.includes('icebreaker') || t.includes('polar')) {
    return TRAVEL_IMAGES['icebreaker-arctic'];
  }
  if (t.includes('titlis') || loc.includes('titlis') || loc.includes('engelberg') || t.includes('glacier')) {
    return TRAVEL_IMAGES['lucerne-titlis'];
  }
  if (t.includes('lindt') || t.includes('chocolate')) {
    return TRAVEL_IMAGES['lindt-chocolate'];
  }
  if (t.includes('tgv') || t.includes('lyria') || (category === 'train' && loc.includes('paris'))) {
    return TRAVEL_IMAGES['tgv-train'];
  }
  if (t.includes('night train') || t.includes('sleeper') || t.includes('express')) {
    return TRAVEL_IMAGES['santa-express-train'];
  }
  if (t.includes('flight') || category === 'flight') {
    return (loc.includes('rvn') || loc.includes('rovaniemi')) ? TRAVEL_IMAGES['flight-arctic'] : TRAVEL_IMAGES['flight-international'];
  }
  if (t.includes('visa') || t.includes('passport') || t.includes('insurance')) {
    return TRAVEL_IMAGES['visa-passport'];
  }
  if (t.includes('food') || t.includes('dining') || t.includes('dinner')) {
    return TRAVEL_IMAGES['food-dining'];
  }

  // 3. Stays matching by location (Never a boat!)
  if (category === 'stay' || t.includes('hotel') || t.includes('apartment') || t.includes('stay')) {
    if (loc.includes('rovaniemi') || t.includes('rovaniemi') || loc.includes('finland')) {
      return TRAVEL_IMAGES['rovaniemi-apartment'];
    }
    if (loc.includes('paris') || t.includes('paris')) {
      return TRAVEL_IMAGES['paris-hotel'];
    }
    if (loc.includes('lucerne') || loc.includes('zurich') || loc.includes('switzerland')) {
      return TRAVEL_IMAGES['lucerne-hotel'];
    }
    return TRAVEL_IMAGES['rovaniemi-apartment'];
  }

  // 4. General destination matching
  if (loc.includes('helsinki') || t.includes('helsinki')) {
    return TRAVEL_IMAGES['helsinki-city'];
  }
  if (loc.includes('zurich') || t.includes('zurich')) {
    return TRAVEL_IMAGES['zurich-city'];
  }
  if (loc.includes('lucerne') || loc.includes('titlis')) {
    return TRAVEL_IMAGES['lucerne-titlis'];
  }
  if (loc.includes('rovaniemi') || loc.includes('lapland')) {
    return TRAVEL_IMAGES['lapland-aurora'];
  }

  return TRAVEL_IMAGES['paris-eiffel'];
};
