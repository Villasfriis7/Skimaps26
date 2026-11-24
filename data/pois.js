// Kuraterede ("featured") steder i Verbier skiområdet med en håndskrevet
// beskrivelse. Bruges af ExploreScreen (Featured), MapScreen (store nåle) og
// POIDetailScreen.
//
// Koordinater og kontaktinfo er slået op i OpenStreetMap (november 2026).
// Afstand til nærmeste lift og selve ruten er IKKE skrevet i hånden længere -
// de beregnes ud fra liftdataene (utils/places.js og utils/routing.js), så de
// ikke kan komme til at modsige kortet.
//
// `replaces` er id'et på det samme sted i data/places.js, så stedet ikke
// vises to gange på kortet eller i søgningen.
export const pois = [
  {
    id: '1',
    name: 'Le Rouge',
    category: 'restaurant',
    featured: true,
    description:
      'Popular restaurant and bar with a sun terrace and a lively atmosphere once the ski day is over.',
    latitude: 46.10055,
    longitude: 7.23033,
    phone: '+41 27 771 80 00',
    website: null,
    openingHours: null,
  },
  {
    id: '2',
    name: 'Chez Dany',
    category: 'restaurant',
    featured: true,
    description:
      'Classic mountain restaurant in the forest hamlet of Clambin, known for home-style food and a cosy atmosphere.',
    latitude: 46.08674,
    longitude: 7.23637,
    address: 'Hameau de Clambin',
    phone: '+41 27 771 25 24',
    website: 'https://www.chezdany.ch/',
    openingHours: 'Mo-Su 12:00-22:00',
  },
  {
    id: '3',
    name: 'Le Carrefour',
    category: 'restaurant',
    featured: true,
    replaces: 'rest-54',
    description: 'Restaurant on the hillside just above Verbier village.',
    latitude: 46.10196,
    longitude: 7.24198,
    phone: null,
    website: null,
    openingHours: null,
  },
  {
    id: '4',
    name: 'Cabane Mont Fort',
    category: 'restaurant',
    featured: true,
    description:
      'Mountain hut at 2,457 m above La Chaux with panoramic views. A popular stop for confident skiers.',
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
    featured: true,
    replaces: 'rest-59',
    description: 'Sunny restaurant with a large terrace in the La Chaux area, right by the lifts.',
    latitude: 46.08043,
    longitude: 7.26834,
    cuisine: 'regional',
    phone: null,
    website: null,
    openingHours: null,
  },
];
