import { pois } from '../data/pois';
import { places } from '../data/places';
import { lifts } from '../data/verbierMap';
import { elevations } from '../data/elevations';
import { distanceMeters } from './geo';

// Ét samlet opslag over alle steder i appen: de kuraterede (data/pois.js)
// plus de rigtige OSM-steder (data/places.js). Et kurateret sted erstatter
// sin OSM-udgave via `replaces`, så det samme sted aldrig optræder to gange.
const replacedIds = new Set(pois.map((poi) => poi.replaces).filter(Boolean));

export const osmPlaces = places.filter((place) => !replacedIds.has(place.id));
export const allPlaces = [...pois, ...osmPlaces];

const placesById = new Map(allPlaces.map((place) => [place.id, place]));

export const findPlace = (id) => placesById.get(id) || null;

// Ældre gemte steder kan have feltet `type` i stedet for `category`.
export const placeCategory = (place) => place.category || place.type;

// Alle liftstationer (bund og top) med navn og højde - til "nærmeste lift".
const stations = lifts.flatMap((lift) => {
  const first = lift.coordinates[0];
  const last = lift.coordinates[lift.coordinates.length - 1];
  const [startElev, endElev] = elevations[lift.id] || [];
  const firstIsBottom = startElev === undefined || startElev <= endElev;
  return [
    { lift, end: firstIsBottom ? 'bottom' : 'top', ...first },
    { lift, end: firstIsBottom ? 'top' : 'bottom', ...last },
  ];
});

// Nærmeste liftstation til et punkt: { lift, end: 'bottom'|'top', meters }.
export function nearestLiftStation(point) {
  let best = null;
  for (const station of stations) {
    const meters = distanceMeters(point, station);
    if (!best || meters < best.meters) best = { lift: station.lift, end: station.end, meters };
  }
  return best;
}

// Bundstationen for en lift - bruges som startpunkt i rutefindingen.
export function liftBottom(lift) {
  const station = stations.find((s) => s.lift.id === lift.id && s.end === 'bottom');
  return { latitude: station.latitude, longitude: station.longitude };
}

// "kebab;tacos" (OSM-format) -> "Kebab, tacos"
export function formatCuisine(cuisine) {
  if (!cuisine) return null;
  const text = cuisine
    .split(';')
    .map((part) => part.trim().replace(/_/g, ' '))
    .filter(Boolean)
    .join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
