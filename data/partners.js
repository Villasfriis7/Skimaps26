// Mock-data for partner-rabatter - eksempeldata til at vise UI'et for
// Partners-fanen. Virksomhederne findes, men rabatterne og koderne er
// opdigtede: der er ingen rigtige aftaler og ingen kode-integration endnu
// (Partners-fanen skriver det også til brugeren).
//
// `placeId` peger på det samme sted i data/pois.js eller data/places.js, så
// kortet kan vise partnerens rigtige placering. Partnere uden `placeId` har
// i stedet en kort `location`-tekst.
export const partnerCategories = [
  { id: 'rental', name: 'Ski rental', icon: 'snow-outline' },
  { id: 'lift', name: 'Lift passes', icon: 'triangle-outline' },
  { id: 'hotel', name: 'Hotels', icon: 'bed-outline' },
  { id: 'restaurant', name: 'Restaurants', icon: 'restaurant-outline' },
];

export const partners = [
  {
    id: 'p1',
    name: 'Verbier Rental',
    category: 'rental',
    categoryLabel: 'Ski rental',
    discount: '20% off',
    description: '20% off ski rental for SkiMaps users.',
    location: 'Verbier village',
    code: 'SKIMAPS20',
  },
  {
    id: 'p2',
    name: 'Téléverbier',
    category: 'lift',
    categoryLabel: 'Lift passes',
    discount: '10% off',
    description: '10% off day and multi-day lift passes.',
    location: 'Médran lift station',
    code: 'SKIMAPS10',
  },
  {
    id: 'p3',
    name: 'W Verbier',
    category: 'hotel',
    categoryLabel: 'Hotels',
    discount: '15% off',
    description: '15% off your stay when you book directly.',
    placeId: 'hotel-198',
    code: 'SKIMAPSTAY15',
  },
  {
    id: 'p4',
    name: 'Le Rouge',
    category: 'restaurant',
    categoryLabel: 'Restaurants',
    discount: '10% off',
    description: '10% off food and drinks all day.',
    placeId: '1',
    code: 'SKIMAPSFOOD10',
  },
  {
    id: 'p5',
    name: 'Chez Dany',
    category: 'restaurant',
    categoryLabel: 'Restaurants',
    discount: '10% off',
    description: '10% off the menu - show the code at your table.',
    placeId: '2',
    code: 'SKIMAPSDANY',
  },
];
