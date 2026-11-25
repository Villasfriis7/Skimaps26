import { lifts } from '../data/verbierMap';
import { findRoute, isOnNetwork, skillLevels } from './routing';
import { liftBottom } from './places';
import { formatDuration } from './geo';

// "Kan jeg komme derhen?" - fælles for detaljesiden, listerne og rute-skærmen.

// Médran er Verbiers hovedlift og derfor et fornuftigt startpunkt, når vi
// ikke kender brugerens position.
export const defaultLift = lifts.find((lift) => lift.name.startsWith('Médran')) || lifts[0];

// Hvor starter en rute, når brugeren ikke selv har valgt? Egen position, hvis
// den ligger i skiområdet - ellers bunden af Médran.
export function defaultStart(graph, location) {
  if (location && isOnNetwork(graph, location)) {
    return { point: location, label: 'your location', fromLocation: true };
  }
  return { point: liftBottom(defaultLift), label: `${defaultLift.name} lift`, fromLocation: false };
}

// Det letteste niveau, der kan nå frem: prøver "uden ski", blå, rød, sort,
// off-piste i den rækkefølge. Returnerer { level, route } eller null.
export function easiestWay(graph, from, to) {
  if (!isOnNetwork(graph, to)) return null;
  for (const level of skillLevels) {
    const route = findRoute(graph, from, to, { skill: level.id });
    if (route) return { level, route };
  }
  return null;
}

const NEEDS = {
  intermediate: 'Needs a red piste',
  advanced: 'Needs a black piste',
  freeride: 'Only by an off-piste route',
};

// Kort tekst til detaljesiden: "16 min on blue pistes from Médran 2 lift".
export function reachText(way, startLabel) {
  if (!way) return null;
  const time = formatDuration(way.route.totalSeconds);
  if (way.route.steps.length === 0) return null;
  if (way.level.id === 'none') return `${time} without skis from ${startLabel}`;
  if (way.level.id === 'easy') return `${time} on blue pistes from ${startLabel}`;
  return `${NEEDS[way.level.id]} · ${time} from ${startLabel}`;
}
