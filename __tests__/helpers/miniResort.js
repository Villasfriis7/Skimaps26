// Et lille, opdigtet skiområde til tests - så man kan regne efter i hovedet.
//
//                     M  (bagside, 1800 m)   46.030
//                     |  \
//      "Back Chair"   |   "Back Bowl" (rød)
//      stolelift      |  /
//                     T  (top, 2200 m)       46.020
//                   / | \
//   "Direct" (sort)/  |  \ "Home Run" (blå, to stykker)
//                 |   |   |
//                  \  |  /   "Village Gondola"
//                   \ | /
//                     V  (landsby, 1500 m)   46.000
//
// 0,001 breddegrad er ca. 111 m, så V-T er ca. 2,2 km og T-M ca. 1,1 km.
// Alt ligger længere fra hinanden end de 600 m, rutefindingen må "gå" for at
// komme ind på netværket - ellers ville alle ruter bare blive gåture.

export const pt = (latitude, longitude) => ({ latitude, longitude });

export const V = pt(46.0, 7.0);
export const T = pt(46.02, 7.0);
export const M = pt(46.03, 7.0);

export const gondola = {
  id: 'gondola',
  name: 'Village Gondola',
  liftType: 'gondola',
  coordinates: [V, T],
};

// Tegnet fra top til bund - højderne skal vende den om.
export const chair = {
  id: 'chair',
  name: 'Back Chair',
  liftType: 'chair_lift',
  coordinates: [T, M],
};

// Blå hjem til landsbyen, delt i to stykker ligesom i OpenStreetMap.
export const blueUpper = {
  id: 'blue-1',
  name: 'Home Run',
  difficulty: 'easy',
  coordinates: [T, pt(46.012, 7.004)],
};
export const blueLower = {
  id: 'blue-2',
  name: 'Home Run',
  difficulty: 'easy',
  coordinates: [pt(46.012, 7.004), V],
};

// Sort og næsten lige ned - kortere og derfor hurtigere end den blå.
export const black = {
  id: 'black',
  name: 'Direct',
  difficulty: 'advanced',
  coordinates: [T, pt(46.01, 6.9995), V],
};

// Rød ned ad bagsiden til M.
export const red = {
  id: 'red',
  name: 'Back Bowl',
  difficulty: 'intermediate',
  coordinates: [T, pt(46.025, 7.002), M],
};

export const elevations = {
  gondola: [1500, 2200],
  chair: [2200, 1800],
  'blue-1': [2200, 1900],
  'blue-2': [1900, 1500],
  black: [2200, 1500],
  red: [2200, 1800],
};

// Lifter og pister til buildGraph(). `overrides` kan udskifte lister.
export const network = (overrides = {}) => ({
  lifts: [gondola, chair],
  pistes: [blueUpper, blueLower, black, red],
  elevations,
  ...overrides,
});

const place = (id, name, category, point, extra = {}) => ({
  id,
  name,
  category,
  ...point,
  phone: null,
  website: null,
  openingHours: null,
  cuisine: null,
  address: null,
  ...extra,
});

// Fem steder i landsbyen (så V tæller som "by"), ét på toppen og ét på bagsiden.
export const places = [
  place('h1', 'Hotel Alpina', 'hotel', pt(46.0004, 7.0003)),
  place('h2', 'Hôtel du Glacier', 'hotel', pt(46.0006, 6.9996)),
  place('r1', 'Chez Martin', 'restaurant', pt(46.0002, 7.0006), {
    cuisine: 'regional;pizza',
    openingHours: 'Mo-Su 12:00-22:00',
    website: 'www.chezmartin.example',
    phone: '+41 27 000 00 00',
  }),
  place('c1', "L'Avalanche Café", 'cafe', pt(45.9998, 7.0004), { cuisine: 'coffee_shop' }),
  place('a1', 'Mont-Blanc Bar', 'apres_ski', pt(46.0003, 6.9998)),
  place('top', 'Summit Café', 'cafe', pt(46.0203, 7.0)),
  place('hut', 'Back Hut', 'restaurant', M, { openingHours: 'Mo-Su 09:00-16:00' }),
];

export const toilets = [{ id: 'wc-1', latitude: 46.0001, longitude: 7.0001 }];

// Et helt skiområde i samme form som data/resorts/verbier.js.
export const miniResort = (overrides = {}) => ({
  id: 'mini',
  name: 'Mini Valley',
  country: 'Testland',
  convention: 'europe',
  bundled: false,
  fetchedAt: 1,
  region: { latitude: 46.015, longitude: 7.0, latitudeDelta: 0.04, longitudeDelta: 0.02 },
  weatherPoint: { latitude: 46.015, longitude: 7.0 },
  weatherElevation: 1500,
  timeZone: 'Europe/Zurich',
  towns: [{ id: 't1', name: 'Mini', latitude: 46.0, longitude: 7.0 }],
  ...network(),
  places,
  pois: [],
  toilets,
  partners: [],
  ...overrides,
});
