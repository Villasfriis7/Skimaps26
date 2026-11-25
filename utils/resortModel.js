import { buildGraph } from './routing';
import { buildPisteGroups } from './pisteGroups';
import { pisteKind } from './pistes';
import { placeCategory } from './places';
import { distanceMeters, lineLengthMeters } from './geo';

// ALT, APPEN VED OM DET VALGTE SKIOMRÅDE
//
// Et skiområde (data/resorts/verbier.js eller et hentet fra
// utils/resortData.js) er rå data: lifter, pister, steder. buildModel() lægger
// alt det afledte ovenpå - opslag, "nærmeste lift", hele pister samlet af
// stykker, grafen til rutefinding, hvor ruter starter - så skærmene ikke selv
// skal regne det ud, og så intet i appen længere antager, at vi er i Verbier.
//
// Skærmene får modellen via useResort() (context/ResortContext.js).

const VILLAGE_RADIUS_M = 350;
const VILLAGE_MIN_PLACES = 4;
const MAIN_LIFT_TYPES = ['gondola', 'cable_car', 'mixed_lift', 'chair_lift'];

// Tæller hurtigt steder i nærheden af et punkt (gitter på ca. 400 m).
function placeCounter(places) {
  const CELL = 0.004;
  const grid = new Map();
  for (const place of places) {
    const key = `${Math.floor(place.latitude / CELL)}:${Math.floor(place.longitude / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(place);
  }
  return (point, radius) => {
    const lat0 = Math.floor(point.latitude / CELL);
    const lon0 = Math.floor(point.longitude / CELL);
    let count = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -2; j <= 2; j++) {
        for (const place of grid.get(`${lat0 + i}:${lon0 + j}`) || []) {
          if (distanceMeters(place, point) <= radius) count += 1;
        }
      }
    }
    return count;
  };
}

// Eksempel-venner til skiområder uden håndlavet indhold: de samme fire
// opdigtede personer, stillet ved rigtige steder i området, så "venner på
// kortet" kan prøves overalt. (Verbier har sine egne i data/friends.js.)
const DEMO_FRIENDS = [
  { id: 'f1', name: 'Emma', initials: 'E', color: '#c2410c', online: true },
  { id: 'f2', name: 'Lucas', initials: 'L', color: '#1d6f8f', online: true },
  { id: 'f3', name: 'Oliver', initials: 'O', color: '#17734a', online: true },
  { id: 'f4', name: 'Sophie', initials: 'S', color: '#7d3c98', online: false },
];

function demoFriends({ allPlaces, defaultLift, liftBottom }) {
  if (!defaultLift) return [];
  const base = liftBottom(defaultLift);
  const nudge = (point) => ({ latitude: point.latitude + 0.00017, longitude: point.longitude + 0.00029 });
  const byDistance = (list) =>
    [...list].sort((a, b) => distanceMeters(a, base) - distanceMeters(b, base));
  const eating = allPlaces.filter((p) => ['restaurant', 'cafe'].includes(placeCategory(p)));
  const bars = allPlaces.filter((p) => placeCategory(p) === 'apres_ski');
  const inVillage = byDistance(eating)[0];
  const onMountain = byDistance(eating).reverse().find((p) => distanceMeters(p, base) < 6000);
  const bar = byDistance(bars)[0] || byDistance(eating)[1];
  const middle = defaultLift.coordinates[Math.floor(defaultLift.coordinates.length / 2)];

  const spots = [
    inVillage && { status: `At ${inVillage.name}`, ...nudge(inVillage) },
    { status: `On the ${defaultLift.name} lift`, ...middle },
    onMountain && onMountain !== inVillage && { status: `At ${onMountain.name}`, ...nudge(onMountain) },
    bar && bar !== inVillage && { status: `Last seen at ${bar.name}`, ...nudge(bar) },
  ];
  return DEMO_FRIENDS.map((friend, i) => (spots[i] ? { ...friend, ...spots[i] } : null)).filter(Boolean);
}

// Uden håndplukkede steder viser Explore de spisesteder, vi ved mest om.
function bestDocumented(allPlaces) {
  const score = (p) => (p.openingHours ? 2 : 0) + (p.website ? 1 : 0) + (p.phone ? 1 : 0) + (p.cuisine ? 1 : 0);
  return allPlaces
    .filter((p) => ['restaurant', 'cafe'].includes(placeCategory(p)))
    .map((place) => ({ place, score: score(place) }))
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .slice(0, 5)
    .map(({ place }) => place);
}

export function buildModel(resort) {
  const { lifts, pistes } = resort;
  const elevations = resort.elevations || {};
  const pois = resort.pois || [];

  // Ét samlet opslag over alle steder: de kuraterede (pois) plus OSM-stederne.
  // Et kurateret sted erstatter sin OSM-udgave via `replaces`, så det samme
  // sted aldrig optræder to gange.
  const replacedIds = new Set(pois.map((poi) => poi.replaces).filter(Boolean));
  const osmPlaces = (resort.places || []).filter((place) => !replacedIds.has(place.id));
  const allPlaces = [...pois, ...osmPlaces];
  const placesById = new Map(allPlaces.map((place) => [place.id, place]));
  const findPlace = (id) => placesById.get(id) || null;

  // Alle liftstationer (bund og top) med navn - til "nærmeste lift".
  const stations = lifts.flatMap((lift) => {
    const first = lift.coordinates[0];
    const last = lift.coordinates[lift.coordinates.length - 1];
    const [startElev, endElev] = elevations[lift.id] || [];
    const firstIsBottom = startElev === undefined || startElev <= endElev;
    return [
      { lift, end: firstIsBottom ? 'bottom' : 'top', elevation: firstIsBottom ? startElev : endElev, ...first },
      { lift, end: firstIsBottom ? 'top' : 'bottom', elevation: firstIsBottom ? endElev : startElev, ...last },
    ];
  });

  // Nærmeste liftstation til et punkt: { lift, end: 'bottom'|'top', meters }.
  const nearestLiftStation = (point) => {
    let best = null;
    for (const station of stations) {
      const meters = distanceMeters(point, station);
      if (!best || meters < best.meters) best = { lift: station.lift, end: station.end, meters };
    }
    return best;
  };

  // Bundstationen for en lift - bruges som startpunkt i rutefindingen.
  const liftBottom = (lift) => {
    const station = stations.find((s) => s.lift.id === lift.id && s.end === 'bottom');
    return { latitude: station.latitude, longitude: station.longitude };
  };

  const { groups: pisteGroups, groupOf: pisteGroupOf } = buildPisteGroups(pistes, elevations);

  // "Ligger punktet i en by?" - der er mange hoteller og spisesteder lige
  // omkring. Bruges til gå-forbindelser mellem liftstationer (kun i byer) og
  // til at finde områdets hovedlift.
  const placesNear = placeCounter(allPlaces);
  const isVillage = (point) => placesNear(point, VILLAGE_RADIUS_M) >= VILLAGE_MIN_PLACES;

  // Grafen over lifter og pister bygges første gang, nogen beder om en rute
  // (omkring 20 ms for Verbier), og genbruges derefter.
  let graph = null;
  const getGraph = () => {
    if (!graph) graph = buildGraph({ lifts, pistes, elevations, isVillage });
    return graph;
  };

  // Hvor starter en rute, når vi ikke kender brugerens position? Ved
  // hovedliften: den navngivne (Verbier: Médran), ellers den lift, hvis
  // bundstation ligger midt i flest steder - altså nede i byen.
  let defaultLift = resort.defaultLiftName
    ? lifts.find((lift) => lift.name.startsWith(resort.defaultLiftName))
    : null;
  if (!defaultLift) {
    // Kun rigtige lifter (gondol, kabelbane, stolelift), hvis området har
    // nogen - ellers kunne et børnebånd midt i byen blive "hovedliften".
    const hasMain = lifts.some((lift) => MAIN_LIFT_TYPES.includes(lift.liftType));
    let bestScore = -1;
    for (const station of stations) {
      if (station.end !== 'bottom') continue;
      if (hasMain && !MAIN_LIFT_TYPES.includes(station.lift.liftType)) continue;
      const score = placesNear(station, 400);
      if (score > bestScore) {
        bestScore = score;
        defaultLift = station.lift;
      }
    }
  }
  defaultLift = defaultLift || lifts[0] || null;

  // Kun rigtige alpine pister tæller med i tallet - ikke skitur-ruter,
  // kælkebaner og off-piste. Vi viser samlet længde og ikke et antal, fordi
  // OpenStreetMap deler hver pist op i mange stykker.
  const pisteKm = Math.round(
    pistes
      .filter((piste) => pisteKind(piste) === 'downhill' && piste.difficulty !== 'freeride')
      .reduce((sum, piste) => sum + lineLengthMeters(piste.coordinates), 0) / 1000
  );

  const sledRun =
    pisteGroups.filter((group) => group.kind === 'sled').sort((a, b) => b.meters - a.meters)[0] || null;

  const friends = resort.friends || demoFriends({ allPlaces, defaultLift, liftBottom });

  // Vejret vises som "i landsbyen". Verbier har sit punkt skrevet ind; i
  // hentede områder er landsbyen dér, hvor hovedliften starter (den lavest
  // liggende lift kan være en dalstation langt fra byen).
  const weatherPoint =
    resort.weatherPointFixed || !defaultLift ? resort.weatherPoint : liftBottom(defaultLift);

  return {
    resort,
    id: resort.id,
    name: resort.name,
    convention: resort.convention || 'europe',
    timeZone: resort.timeZone || null,
    region: resort.region,
    weatherPoint,
    towns: resort.towns || [],
    lifts,
    pistes,
    elevations,
    toilets: resort.toilets || [],
    partners: resort.partners || [],
    friends,
    allPlaces,
    findPlace,
    // Explore: håndplukkede steder, hvis området har nogen - ellers de bedst
    // beskrevne spisesteder.
    featured: pois.length ? pois : bestDocumented(allPlaces),
    curated: pois.length > 0,
    nearestLiftStation,
    liftBottom,
    pisteGroups,
    pisteGroupOf,
    getGraph,
    defaultLift,
    pisteKm,
    sledRun,
  };
}

// Modellen for et skiområde bygges én gang og genbruges.
const cache = new Map();
export function modelFor(resort) {
  const key = `${resort.id}:${resort.fetchedAt || 0}`;
  if (!cache.has(key)) {
    cache.clear(); // kun ét skiområde ad gangen i hukommelsen
    cache.set(key, buildModel(resort));
  }
  return cache.get(key);
}
