// Mock-data for partner-rabatter - eksempeldata til at vise UI'et for
// "Partners"-fanen. Ingen rigtig betalings-/kode-integration endnu.
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
    description: '20% off ski rental for Skimaps-brugere.',
    distance: '400 m fra Médran',
    code: 'SKIMAPS20',
  },
  {
    id: 'p2',
    name: 'Téléverbier',
    category: 'lift',
    categoryLabel: 'Lift passes',
    discount: '10% off',
    description: '10% off day- og multi-day liftkort.',
    distance: 'Médran-bundstation',
    code: 'SKIMAPS10',
  },
  {
    id: 'p3',
    name: 'W Verbier',
    category: 'hotel',
    categoryLabel: 'Hotels',
    discount: '15% off',
    description: '15% off dit ophold ved booking direkte.',
    distance: '600 m fra Verbier centrum',
    code: 'SKIMAPSTAY15',
  },
  {
    id: 'p4',
    name: 'Le Rouge',
    category: 'restaurant',
    categoryLabel: 'Restaurants',
    discount: '10% off',
    description: '10% off mad og drikke hele dagen.',
    distance: '2 min fra Médran-liften',
    code: 'SKIMAPSFOOD10',
  },
  {
    id: 'p5',
    name: 'Chez Dany',
    category: 'restaurant',
    categoryLabel: 'Restaurants',
    discount: '10% off',
    description: '10% off på menuen - vis koden ved bordet.',
    distance: '10 min fra Savoleyres-liften',
    code: 'SKIMAPSDANY',
  },
];
