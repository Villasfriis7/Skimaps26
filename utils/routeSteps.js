import { distanceMeters, formatDistance } from './geo';
import { difficultyLabel, liftTypeLabels, pisteColor, shortDifficulty } from './pistes';

// Ét trin i en rute som tekst + ikon. Bruges både af trin-listen
// (RouteScreen) og af "næste trin" på kortets rutekort.
// `color` er kun sat for pister (pistens farve); skærmen vælger selv farve
// til lifter og gå-stykker.
// Med `elevations` (model.elevations) får lifter deres højder med:
// "Gondola · 1,531 → 2,200 m" - det er dem, man orienterer sig efter i et
// område, man ikke kender.
export function describeStep(step, convention, elevations = null) {
  const length = formatDistance(step.meters);
  if (step.kind === 'lift') {
    const type = liftTypeLabels[step.liftType] || liftTypeLabels.unknown;
    // En lift, der er sat sammen af to stykker, har ikke ét sæt højder.
    const [a, b] = (!step.joined && elevations && elevations[step.id]) || [];
    const heights =
      a !== undefined && Math.abs(a - b) >= 10
        ? step.down
          ? `${Math.max(a, b).toLocaleString('en-US')} → ${Math.min(a, b).toLocaleString('en-US')} m`
          : `${Math.min(a, b).toLocaleString('en-US')} → ${Math.max(a, b).toLocaleString('en-US')} m`
        : null;
    return {
      // Gondoler og kabelbaner kan også tages ned - så skal der stå "down".
      icon: step.down ? 'arrow-down-circle' : 'arrow-up-circle',
      color: null,
      title: step.down ? `Ride ${step.name} down` : `Take ${step.name}`,
      subtitle: `${type} · ${heights || length}`,
    };
  }
  if (step.kind === 'piste') {
    const off = step.difficulty === 'freeride';
    return {
      icon: 'ellipse',
      color: pisteColor(step.difficulty, convention),
      // Halvdelen af pist-stykkerne i OpenStreetMap har ikke noget navn. Så er
      // farven det, man kan kende dem på: "Ski a red piste".
      title: step.name
        ? `Ski ${step.name}`
        : off
          ? 'Ski an off-piste section'
          : `Ski a ${shortDifficulty(step.difficulty, convention).toLowerCase()} piste`,
      subtitle: `${difficultyLabel(step.difficulty, convention)} · ${length}${step.name ? '' : ' · no name on the map'}`,
    };
  }
  return {
    icon: 'walk',
    color: null,
    title: `Walk ${length}`,
    subtitle: 'On foot',
  };
}

// Afstand i meter fra et punkt til et linjestykke a-b, og hvor langt henne
// ad stykket (0-1) det nærmeste punkt ligger. Jorden regnes som flad -
// fint på de få hundrede meter, det handler om her.
function toSegment(point, a, b) {
  const metersPerLat = 111320;
  const metersPerLon = 111320 * Math.cos((point.latitude * Math.PI) / 180);
  const ax = (a.longitude - point.longitude) * metersPerLon;
  const ay = (a.latitude - point.latitude) * metersPerLat;
  const bx = (b.longitude - point.longitude) * metersPerLon;
  const by = (b.latitude - point.latitude) * metersPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return { meters: Math.hypot(ax + t * dx, ay + t * dy), t, length: Math.sqrt(lengthSquared) };
}

// Nærmeste punkt på et trin: afstand dertil og hvor stor en del af trinnet
// (0-1), der ligger bag det punkt.
function toStep(point, coordinates) {
  if (coordinates.length < 2) {
    return { meters: coordinates.length ? distanceMeters(point, coordinates[0]) : Infinity, done: 0 };
  }
  let best = { meters: Infinity, before: 0 };
  let walked = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const hit = toSegment(point, coordinates[i - 1], coordinates[i]);
    if (hit.meters < best.meters) best = { meters: hit.meters, before: walked + hit.t * hit.length };
    walked += hit.length;
  }
  return { meters: best.meters, done: walked > 0 ? best.before / walked : 0 };
}

// Så langt fra ruten må man være, før vi siger "du er ikke på ruten".
// GPS i bjerge er ofte 20-50 m ved siden af, og en bred pist er 60 m.
export const ON_ROUTE_M = 120;
const ARRIVED_M = 40;
// To trin kan ligge oven i hinanden på kortet (en lift op og pisten ned
// under den). Så længe et senere trin er næsten lige så tæt på som det
// trin, vi sidst stod på, bliver vi på det sidste - ellers ville "næste
// trin" hoppe frem og tilbage.
const STICKY_M = 25;

// Hvor på ruten er brugeren?
//   route: activeRoute fra RouteContext ({ steps, destination, totalSeconds })
//   location: { latitude, longitude } | null
//   previousIndex: det trin, vi viste sidst (til at holde visningen rolig)
// Giver { index, onRoute, arrived, remainingSeconds, offBy }:
//   onRoute = false, når positionen mangler eller ligger langt fra ruten -
//   så peger index på første trin, og remainingSeconds er hele ruten.
export function routeProgress(route, location, previousIndex = 0) {
  const steps = route.steps;
  const whole = { index: 0, onRoute: false, arrived: false, remainingSeconds: route.totalSeconds, offBy: null };
  if (!location || steps.length === 0) return whole;

  if (route.destination && distanceMeters(location, route.destination) <= ARRIVED_M) {
    return { index: steps.length - 1, onRoute: true, arrived: true, remainingSeconds: 0, offBy: 0 };
  }

  const hits = steps.map((step) => toStep(location, step.coordinates));
  let index = 0;
  hits.forEach((hit, i) => {
    if (hit.meters < hits[index].meters) index = i;
  });
  const previous = hits[previousIndex];
  if (previous && previousIndex !== index && previous.meters <= hits[index].meters + STICKY_M) {
    index = previousIndex;
  }
  if (hits[index].meters > ON_ROUTE_M) return { ...whole, offBy: hits[index].meters };

  let remainingSeconds = steps[index].seconds * (1 - hits[index].done);
  for (let i = index + 1; i < steps.length; i++) remainingSeconds += steps[i].seconds;
  return { index, onRoute: true, arrived: false, remainingSeconds, offBy: hits[index].meters };
}
