// Små geografi-hjælpere, der bruges på tværs af kort, rutefinding og lister.

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

// Afstand i meter mellem to { latitude, longitude }-punkter (haversine).
export function distanceMeters(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Samlet længde i meter af en linje (liste af punkter).
export function lineLengthMeters(coordinates) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += distanceMeters(coordinates[i - 1], coordinates[i]);
  }
  return total;
}

// "350 m" / "1.2 km" / "1,240 km"
export function formatDistance(meters) {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  if (meters < 100000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000).toLocaleString('en-US')} km`;
}

// "8 min" / "1 h 25 min"
export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${Math.floor(minutes / 60)} h`;
}

// Et kortudsnit, der lige netop rummer alle punkterne (plus lidt luft).
export function regionForCoordinates(coordinates, padding = 1.4) {
  const lats = coordinates.map((c) => c.latitude);
  const lons = coordinates.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.006, (maxLat - minLat) * padding),
    longitudeDelta: Math.max(0.006, (maxLon - minLon) * padding),
  };
}
