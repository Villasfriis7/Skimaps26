// Mock-data for venner - ingen rigtig backend/login endnu, så dette er
// eksempeldata, der viser, hvordan "venner på kortet" og Friends-fanen skal
// fungere. Koordinaterne passer med det sted, vennens status nævner (samme
// koordinater som i data/pois.js og data/places.js), så nålene på kortet
// stemmer med teksten. Afstanden til vennen beregnes ud fra brugerens egen
// GPS-position (se FriendsScreen) og står derfor ikke her.
export const friends = [
  {
    id: 'f1',
    name: 'Emma',
    initials: 'E',
    color: '#e5673f',
    online: true,
    status: 'At Le Rouge',
    latitude: 46.10055,
    longitude: 7.23033,
  },
  {
    id: 'f2',
    name: 'Lucas',
    initials: 'L',
    color: '#3fa7d6',
    online: true,
    status: 'Skiing to Attelas',
    latitude: 46.0946,
    longitude: 7.2598,
  },
  {
    id: 'f3',
    name: 'Oliver',
    initials: 'O',
    color: '#2ecc71',
    online: true,
    status: 'At La Chaux',
    latitude: 46.08043,
    longitude: 7.26834,
  },
  {
    id: 'f4',
    name: 'Sophie',
    initials: 'S',
    color: '#9b59b6',
    online: false,
    status: 'Last seen at Le Farinet',
    latitude: 46.09597,
    longitude: 7.2294,
  },
];
