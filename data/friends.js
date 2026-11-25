// Mock-data for venner - ingen rigtig backend/login endnu, så dette er
// eksempeldata, der viser, hvordan "venner på kortet" og Friends-fanen skal
// fungere. Koordinaterne passer med det sted, vennens status nævner (samme
// koordinater som i data/pois.js og data/places.js), så nålene på kortet
// stemmer med teksten (rykket 25-30 m, så vennen ikke står præcis oven i
// stedets egen markør). Afstanden til vennen beregnes ud fra brugerens egen
// GPS-position (se FriendsScreen) og står derfor ikke her.
export const friends = [
  {
    id: 'f1',
    name: 'Emma',
    initials: 'E',
    color: '#c2410c',
    online: true,
    status: 'At Le Rouge',
    latitude: 46.10072,
    longitude: 7.23062,
  },
  {
    id: 'f2',
    name: 'Lucas',
    initials: 'L',
    color: '#1d6f8f',
    online: true,
    status: 'Skiing to Attelas',
    latitude: 46.0946,
    longitude: 7.2598,
  },
  {
    id: 'f3',
    name: 'Oliver',
    initials: 'O',
    color: '#17734a',
    online: true,
    status: 'At La Chaux',
    latitude: 46.08058,
    longitude: 7.26866,
  },
  {
    id: 'f4',
    name: 'Sophie',
    initials: 'S',
    color: '#7d3c98',
    online: false,
    status: 'Last seen at Le Farinet',
    latitude: 46.09597,
    longitude: 7.2294,
  },
];
