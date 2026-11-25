import { distanceMeters } from './geo';

// Klynger til kortet: steder, der ligger så tæt, at deres markører ville dække
// hinanden (ca. 200 hoteller i Verbier by), samles til ét punkt med et antal.
// Ren beregning uden React, så den kan afprøves for sig selv.

// Gitterets felter følger zoom i faste trin (hvert trin er ca. 1,4 gange det
// forrige) og ligger fast på jordkloden - ikke på skærmen. Ellers ville
// klyngerne blive delt på en ny måde, hver gang man flytter kortet en smule,
// og markørerne ville hoppe rundt under fingeren.
const snapCell = (size) => 2 ** (Math.round(Math.log2(size) * 2) / 2);

function toCluster(members) {
  const [first] = members;
  if (members.length === 1) {
    return { id: first.id, latitude: first.latitude, longitude: first.longitude, count: 1, points: members };
  }
  let latitude = 0;
  let longitude = 0;
  for (const point of members) {
    latitude += point.latitude;
    longitude += point.longitude;
  }
  return {
    // Samme steder giver samme id (første sted + antal), så kortet kan genbruge
    // markøren - og et nyt antal giver et nyt id, så tallet bliver tegnet om.
    id: `cluster-${first.id}-${members.length}`,
    latitude: latitude / members.length,
    longitude: longitude / members.length,
    count: members.length,
    points: members,
  };
}

// Deler `points` ({ id, latitude, longitude }) op efter, hvilket felt de
// ligger i, når kortudsnittet `region` deles i ca. `rows` x `columns` felter
// (flere rækker end kolonner: en telefonskærm er højere, end den er bred).
//
// Returnerer [{ id, latitude, longitude, count, points }] i den rækkefølge,
// stederne kom ind i. Et sted, der står alene, kommer tilbage med count 1; en
// klynge står i gennemsnittet af sine steder.
//
// Steder langt uden for udsnittet udelades - `margin` er, hvor mange
// skærmfulde der tages med til hver side, så der er markører klar, når man
// flytter kortet. Et felt tages altid helt med eller slet ikke; ellers ville
// en klynge i kanten skifte antal, mens man panorerer.
export function clusterPoints(points, region, options = {}) {
  const { rows = 12, columns = 7, margin = 1 } = options;
  const cellLat = snapCell(region.latitudeDelta / rows);
  const cellLon = snapCell(region.longitudeDelta / columns);
  // Et udsnit uden udstrækning kan ikke deles i felter: vis alt hver for sig.
  if (!(cellLat > 0 && cellLon > 0 && Number.isFinite(cellLat + cellLon))) {
    return points.map((point) => toCluster([point]));
  }

  const reachLat = region.latitudeDelta * (0.5 + margin);
  const reachLon = region.longitudeDelta * (0.5 + margin);
  const minRow = Math.floor((region.latitude - reachLat) / cellLat);
  const maxRow = Math.floor((region.latitude + reachLat) / cellLat);
  const minColumn = Math.floor((region.longitude - reachLon) / cellLon);
  const maxColumn = Math.floor((region.longitude + reachLon) / cellLon);

  const cells = new Map();
  for (const point of points) {
    const row = Math.floor(point.latitude / cellLat);
    const column = Math.floor(point.longitude / cellLon);
    if (row < minRow || row > maxRow || column < minColumn || column > maxColumn) continue;
    const key = `${row}:${column}`;
    const members = cells.get(key);
    if (members) members.push(point);
    else cells.set(key, [point]);
  }
  return [...cells.values()].map(toCluster);
}

// Hvor langt er der højst mellem stederne i en klynge? Målt som diagonalen i
// den kasse, der rummer dem alle - aldrig mindre end den største afstand
// mellem to af dem, og hurtigere end at måle alle par.
export function spreadMeters(points) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const point of points) {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
  }
  if (points.length === 0) return 0;
  return distanceMeters(
    { latitude: minLat, longitude: minLon },
    { latitude: maxLat, longitude: maxLon }
  );
}
