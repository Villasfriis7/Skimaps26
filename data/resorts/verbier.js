import { lifts as rawLifts, pistes, verbierRegion, towns } from '../verbierMap';
import { elevations } from '../elevations';
import { places } from '../places';
import { pois } from '../pois';
import { toilets } from '../toilets';
import { friends } from '../friends';
import { partners } from '../partners';
import { distanceMeters } from '../../utils/geo';

// RETTELSER TIL DE GENEREREDE DATA
// Slået op hos Téléverbier, Verbier Tourisme og stedernes egne sider i
// november 2026. Rettelserne ligger her og ikke i de store, genererede
// datafiler, så man kan se, hvad der er ændret i hånden.

// To "lifter" i OpenStreetMap-udtrækket er ikke skilifter: en privat
// svævebane til en vingård i Rhônedalen og en lille tjenestebane ved Fionnay.
const NOT_SKI_LIFTS = ['Mazembroz-Beudon', 'Fionnay-Plan du Tsenau'];
// Byliften i Lourtier hedder "Téléski du Dzora" og hænger ikke sammen med
// resten af området.
const LIFT_NAMES = { 'Téléski de Lourtier': 'Téléski du Dzora' };
const lifts = rawLifts
  .filter((lift) => !NOT_SKI_LIFTS.includes(lift.name))
  .map((lift) => (LIFT_NAMES[lift.name] ? { ...lift, name: LIFT_NAMES[lift.name] } : lift));

// Højderne i data/elevations.js kommer fra en højdemodel med 90 m opløsning
// og rammer op til 75 m forkert ved de stejle topstationer (Mont-Fort stod
// som 3.253 m). Her er de vigtigste stationer med de officielle tal:
// [lift, 'start' | 'end' (i liftens tegneretning), meter over havet].
const STATION_HEIGHTS = [
  ['Médran 2', 'start', 1531], // Verbier, Médran
  ['Médran 2', 'end', 2200], // Les Ruinettes
  ['Funispace', 'start', 2200],
  ['Funispace', 'end', 2727], // Les Attelas
  ['Jumbo', 'start', 2260], // La Chaux
  ['Mont-Gelé', 'end', 3002],
  ['Mont-Fort', 'end', 3300],
  ['Siviez', 'start', 1730],
];
const STATION_RADIUS_M = 70;

// Alle linjer, der ender ved stationen, får stationens højde.
function withStationHeights(source) {
  const fixed = { ...source };
  const spots = STATION_HEIGHTS.map(([name, end, meters]) => {
    const lift = lifts.find((l) => l.name === name);
    if (!lift) return null;
    const point = end === 'start' ? lift.coordinates[0] : lift.coordinates[lift.coordinates.length - 1];
    return { point, meters };
  }).filter(Boolean);
  for (const line of [...lifts, ...pistes]) {
    const pair = fixed[line.id];
    if (!pair) continue;
    const ends = [line.coordinates[0], line.coordinates[line.coordinates.length - 1]];
    const next = [...pair];
    ends.forEach((point, i) => {
      const spot = spots.find((s) => distanceMeters(s.point, point) <= STATION_RADIUS_M);
      if (spot) next[i] = spot.meters;
    });
    fixed[line.id] = next;
  }
  return fixed;
}

// Lifter, man må tage uden ski om vinteren (Téléverbiers fodgængerbilletter
// og bloggen "A day on foot"). Andre gondoler og kabelbaner - fx Mont-Gelé,
// som kun betjener off-piste - er ikke bekræftet og er derfor ikke med.
const PEDESTRIAN_LIFTS = [
  'Châble - Verbier',
  'Médran 2',
  'Médran 4',
  'Chaux Express',
  'Chaux-Express',
  'Jumbo',
  'Mont-Fort',
  'Tzoumaz',
  'Châble - Mayens de Bruson',
  'Pasay',
];

// Verbier er det skiområde, appen er bygget omkring, og det eneste med
// håndlavet indhold: fem udvalgte steder med beskrivelser, eksempel-venner og
// eksempel-partnere. Det ligger indbygget, så appen altid virker - også uden
// net og til en fremvisning.
//
// Alle skiområder har denne form (se også utils/resortData.js, der bygger
// den samme form for hentede områder):
//   id, name, country
//   convention     'europe' | 'north_america' | 'japan' - pistefarverne
//   region         kortudsnit, der viser hele området
//   weatherPoint   hvor vejret hentes for (landsbyen), weatherElevation i meter
//   timeZone       til "Open now"
//   lifts, pistes, elevations, towns, places, toilets
//   pois           udvalgte steder med egen beskrivelse (kun Verbier)
//   friends, partners   eksempeldata (kun Verbier)
//   pedestrianLifts     lifter, man må tage uden ski (kun Verbier - ellers gættes)
export const verbier = {
  id: 'verbier',
  name: 'Verbier',
  country: 'Switzerland',
  convention: 'europe',
  bundled: true,
  region: verbierRegion,
  weatherPoint: { latitude: 46.0961, longitude: 7.2286 },
  weatherPointFixed: true,
  weatherElevation: 1500,
  timeZone: 'Europe/Zurich',
  // Médran er Verbiers hovedlift og derfor startpunkt, når vi ikke kender
  // brugerens position.
  defaultLiftName: 'Médran',
  towns,
  lifts,
  pistes,
  elevations: withStationHeights(elevations),
  places,
  pois,
  toilets,
  friends,
  partners,
  pedestrianLifts: PEDESTRIAN_LIFTS,
};
