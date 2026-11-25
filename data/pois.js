// Kuraterede ("featured") steder i Verbier skiområdet med en håndskrevet
// beskrivelse. Bruges af ExploreScreen (Featured), MapScreen (store nåle) og
// POIDetailScreen.
//
// Koordinater er slået op i OpenStreetMap (november 2026). Telefon,
// hjemmeside, adresse og åbningstider er tjekket mod stedernes egne sider og
// Verbier Tourisme den 25. november 2026; hvor kilderne var uenige eller
// intet sagde, står feltet tomt.
// Afstand til nærmeste lift og selve ruten er IKKE skrevet i hånden længere -
// de beregnes ud fra liftdataene (utils/places.js og utils/routing.js), så de
// ikke kan komme til at modsige kortet.
//
// `tagline` er den korte type-tekst på Featured-kortene på Explore.
//
// `replaces` er id'et på det samme sted i data/places.js, så stedet ikke
// vises to gange på kortet eller i søgningen.
export const pois = [
  {
    id: '1',
    name: 'Le Rouge',
    category: 'restaurant',
    tagline: 'Restaurant & bar',
    featured: true,
    description:
      'Popular restaurant and bar with a sun terrace and a lively atmosphere once the ski day is over.',
    latitude: 46.10055,
    longitude: 7.23033,
    phone: '+41 27 771 80 00',
    website: 'https://www.lerouge-verbier.com/',
    openingHours: null,
  },
  {
    id: '2',
    name: 'Chez Dany',
    category: 'restaurant',
    tagline: 'Mountain restaurant',
    featured: true,
    description:
      'Classic mountain restaurant in the forest hamlet of Clambin, known for home-style food and a cosy atmosphere.',
    latitude: 46.08674,
    longitude: 7.23637,
    address: 'Hameau de Clambin 10',
    phone: '+41 27 771 25 24',
    website: 'https://www.chezdany.ch/',
    openingHours: 'Mo-Su 12:00-22:00',
  },
  {
    id: '3',
    name: 'Le Carrefour',
    category: 'restaurant',
    tagline: 'Restaurant',
    featured: true,
    replaces: 'rest-54',
    description:
      'One of the oldest restaurants on the pistes of Verbier, at the top of the village right by the slope.',
    latitude: 46.10196,
    longitude: 7.24198,
    address: 'Route du Golf 95',
    phone: '+41 27 771 55 55',
    website: 'https://www.lecarrefour.ch/',
    openingHours: null,
  },
  {
    id: '4',
    name: 'Cabane Mont Fort',
    category: 'restaurant',
    tagline: 'Mountain hut',
    featured: true,
    description:
      'Mountain hut at 2,457 m above La Chaux with panoramic views. Reached on skis from Col des Gentianes or on the marked winter trail from La Chaux.',
    latitude: 46.08356,
    longitude: 7.28105,
    phone: '+41 77 269 45 27',
    website: 'https://cabanemontfort.com',
    openingHours: null,
  },
  {
    id: '5',
    name: 'Le Dahu',
    category: 'restaurant',
    tagline: 'Mountain restaurant',
    featured: true,
    replaces: 'rest-59',
    description: 'Sunny restaurant with a large terrace in the La Chaux area, right by the lifts.',
    latitude: 46.08043,
    longitude: 7.26834,
    cuisine: 'regional',
    phone: '+41 27 778 20 00',
    website: 'https://www.ledahu.ch/',
    // Sæsonen 2026/27 ifølge stedets egen side.
    openingHours: 'Dec 05-Apr 25 Mo-Su 08:30-16:15',
  },
];
