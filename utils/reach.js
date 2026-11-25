import { findRoute, isOnNetwork, skillLevels } from './routing';
import { shortDifficulty } from './pistes';
import { formatDuration } from './geo';

// "Kan jeg komme derhen?" - fælles for detaljesiden, listerne og rute-skærmen.
// `model` er det valgte skiområde (utils/resortModel.js).

// Hvor starter en rute, når brugeren ikke selv har valgt? Egen position, hvis
// den ligger i skiområdet - ellers bunden af områdets hovedlift.
export function defaultStart(model, location) {
  const graph = model.getGraph();
  if (location && isOnNetwork(graph, location)) {
    return { point: location, label: 'your location', fromLocation: true };
  }
  const lift = model.defaultLift;
  return { point: model.liftBottom(lift), label: `${lift.name} lift`, fromLocation: false };
}

// Det letteste niveau, der kan nå frem: prøver "uden ski" og derefter hvert
// pisteniveau fra det letteste. Returnerer { level, route } eller null.
export function easiestWay(model, from, to) {
  const graph = model.getGraph();
  if (!isOnNetwork(graph, to)) return null;
  for (const level of skillLevels) {
    const route = findRoute(graph, from, to, { skill: level.id, convention: model.convention });
    if (route) return { level, route };
  }
  return null;
}

// Kort tekst til detaljesiden: "16 min on blue pistes from Médran 2 lift".
// Farvenavnene følger landets skilte (blå i Europa er grøn i Nordamerika).
export function reachText(way, startLabel, convention) {
  if (!way || way.route.steps.length === 0) return null;
  const time = formatDuration(way.route.totalSeconds);
  const color = (difficulty) => shortDifficulty(difficulty, convention).toLowerCase();
  if (way.level.id === 'none') return `${time} without skis from ${startLabel}`;
  if (way.level.id === 'easy') return `${time} on ${color('easy')} pistes from ${startLabel}`;
  if (way.level.id === 'freeride') return `Only by an off-piste route · ${time} from ${startLabel}`;
  return `Needs a ${color(way.level.id)} piste · ${time} from ${startLabel}`;
}
