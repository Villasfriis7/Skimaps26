import { distanceMeters } from './geo';
import { cleanPisteName, pisteKind } from './pistes';

// Rutefinding på ski: korteste vej (i tid) gennem et netværk af lifter og
// pister - appens kerneidé, "Google Maps, men via lifter og pister".
//
// Sådan virker det:
//  1. buildGraph() laver en graf. Hvert punkt på en pist og hver liftstation
//     er en knude. Kanterne er:
//       - pist-stykker (kun nedad: OSM tegner pister i køreretningen),
//       - lifter (kun opad - gondoler og kabelbaner kan også tages ned),
//       - korte gå-/skøjtestykker mellem en liftstation/pist-ende og andre
//         linjer i nærheden.
//  2. findRoute() kører Dijkstras algoritme fra startpunktet og vælger den
//     knude nær destinationen, der giver kortest samlet tid inkl. gåturen.
//
// Alle tider er skøn (se hastighederne herunder) - ikke målte tal. Appen
// ved heller ikke, om en lift eller pist er åben i dag.

// Gennemsnitsfart på ski i m/s pr. sværhedsgrad (inkl. småpauser).
const PISTE_SPEED = {
  novice: 4,
  easy: 6,
  intermediate: 7,
  advanced: 6,
  expert: 4,
  // Upræpareret terræn køres langsomt og med pauser: 500 højdemeter tager
  // snarere et kvarter end fem minutter.
  extreme: 2.5,
  freeride: 2.5,
};

// Liftfart i m/s og fast tillæg i sekunder til kø + på-/afstigning.
const LIFT_SPEED = {
  gondola: 5,
  cable_car: 7,
  mixed_lift: 5,
  chair_lift: 4,
  platter: 3,
  drag_lift: 3,
  rope_tow: 2,
  magic_carpet: 0.7,
};
const LIFT_OVERHEAD_S = 240;
// Lifter med lukkede kabiner kan også tages NED - og uden ski. "mixed_lift"
// er en kombineret stole-/gondollift (fx Chaux Express): uden den kunne man
// køre ud til La Chaux på blå pister, men ikke komme hjem igen uden en rød.
const TWO_WAY_LIFTS = new Set(['gondola', 'cable_car', 'mixed_lift']);

// En skiløber tager kun liften NED, når der ikke er en pist: ellers ville
// den hurtigste rute fra en top ofte være "tag kabelbanen ned igen". Tillægget
// tæller kun med i valget af rute - ikke i den tid, vi viser.
const RIDE_DOWN_PENALTY_S = 420;

// Sværhedsgrader fra lettest til sværest - til "sværeste pist på ruten".
const DIFFICULTY_ORDER = ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'extreme', 'freeride'];

// "Chaux Express" og "Chaux-Express" er samme lift, tegnet som to stykker.
const sameLiftName = (a, b) =>
  Boolean(a && b) && a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '');

const WALK_SPEED = 1.1; // m/s i skistøvler
const WALK_DETOUR = 1.3; // fugleflugt -> faktisk gåafstand
const TRANSFER_RADIUS_M = 120; // maks. afstand mellem to linjer, der "hænger sammen"
const TRANSFER_OVERHEAD_S = 30;
const SNAP_RADIUS_M = 600; // hvor langt fra netværket start/mål må ligge
// Liftstationer i samme by (fx Médran og Savoleyres i Verbier) hænger ikke
// sammen via pister, men man kan gå eller tage skibussen imellem dem.
const VILLAGE_RADIUS_M = 1500;
const VILLAGE_MAX_CLIMB_M = 80;
// Uden ski: så langt går man mellem to lifter oppe på bjerget.
const STATION_WALK_M = 350;
const STATION_WALK_CLIMB_M = 40;
// Gå-forbindelserne gælder kun stationer nede i byerne - ellers foreslog ruten
// 2 km "gåture" mellem to liftstationer oppe på bjerget, hvor man ikke kan gå
// i skistøvler. Hvad der er "i en by", afgør skiområdet selv via `isVillage`
// (se utils/resortModel.js).

// Hvilke sværhedsgrader er tilladt for hvert niveau i UI'et.
export const skillLevels = [
  // Uden ski: kun til fods og med lifter med lukkede kabiner.
  { id: 'none', label: 'No skis', allowed: [], cabinsOnly: true },
  { id: 'easy', label: 'Blue', allowed: ['novice', 'easy'] },
  { id: 'intermediate', label: 'Red', allowed: ['novice', 'easy', 'intermediate'] },
  {
    id: 'advanced',
    label: 'Black',
    allowed: ['novice', 'easy', 'intermediate', 'advanced', 'expert'],
  },
  // Markerede, men upræparerede ski-ruter ("itinéraires") - fx Tortin.
  {
    id: 'freeride',
    label: 'Off-piste',
    allowed: ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'extreme', 'freeride'],
  },
];

const walkSeconds = (meters) => (meters * WALK_DETOUR) / WALK_SPEED;

// En simpel min-heap (prioritetskø) til Dijkstra.
class MinHeap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].cost <= items[i].cost) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left].cost < items[smallest].cost) smallest = left;
        if (right < items.length && items[right].cost < items[smallest].cost) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// Groft gitter (ca. 110 x 50-80 m pr. celle), så "hvilke knuder ligger tæt på
// dette punkt?" ikke kræver et gennemløb af alle knuder.
const CELL = 0.001;
const cellKey = (lat, lon) => `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;

function nodesNear(graph, point, radius) {
  // En celle er 111 m høj overalt, men smallere jo længere mod nord: 77 m i
  // Verbier, 50 m i Åre. Derfor regnes rækkevidden ud for stedets breddegrad.
  const cellMeters = 111320 * CELL;
  const latReach = Math.ceil(radius / cellMeters) + 1;
  const lonReach = Math.ceil(radius / (cellMeters * Math.max(0.2, Math.cos((point.latitude * Math.PI) / 180)))) + 1;
  const baseLat = Math.floor(point.latitude / CELL);
  const baseLon = Math.floor(point.longitude / CELL);
  const found = [];
  for (let dLat = -latReach; dLat <= latReach; dLat++) {
    for (let dLon = -lonReach; dLon <= lonReach; dLon++) {
      const bucket = graph.grid.get(`${baseLat + dLat}:${baseLon + dLon}`);
      if (!bucket) continue;
      for (const index of bucket) {
        const meters = distanceMeters(point, graph.nodes[index]);
        if (meters <= radius) found.push({ index, meters });
      }
    }
  }
  return found;
}

// `pedestrianLifts` er en liste med navne på de lifter, man må tage uden ski
// (kun de områder, hvor vi har slået det op - se data/resorts/verbier.js).
// Uden listen gætter vi: lifter med lukkede kabiner.
export function buildGraph({ lifts, pistes, elevations = {}, isVillage = () => false, pedestrianLifts = null }) {
  const walkOn = pedestrianLifts ? new Set(pedestrianLifts) : null;
  const pedestrianOk = (lift) => (walkOn ? walkOn.has(lift.name) : TWO_WAY_LIFTS.has(lift.liftType));
  const graph = { nodes: [], edges: [], grid: new Map(), lineOf: [] };
  const indexByKey = new Map();

  // Punkter med (næsten) samme koordinat bliver til samme knude. Det er sådan
  // to pister, der deler et OSM-punkt, bliver forbundet.
  const nodeFor = (point, lineId) => {
    const key = `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
    let index = indexByKey.get(key);
    if (index === undefined) {
      index = graph.nodes.length;
      indexByKey.set(key, index);
      graph.nodes.push({ latitude: point.latitude, longitude: point.longitude });
      graph.edges.push([]);
      graph.lineOf.push(new Set());
      const cell = cellKey(point.latitude, point.longitude);
      if (!graph.grid.has(cell)) graph.grid.set(cell, []);
      graph.grid.get(cell).push(index);
    }
    graph.lineOf[index].add(lineId);
    return index;
  };

  const terminals = [];
  const stations = []; // liftstationer med højde, til landsby-forbindelserne

  for (const piste of pistes) {
    if (pisteKind(piste) !== 'downhill') continue; // skiture og kælkebane er ikke pister
    // En rigtig pist uden sværhedsgrad i OpenStreetMap (kun hentede områder
    // har `type`) kan vi ikke love er let: den regnes som sort i ruterne, men
    // vises stadig som "Unclassified".
    const untagged = piste.type === 'downhill' && piste.difficulty === 'unknown';
    const speed = PISTE_SPEED[untagged ? 'advanced' : piste.difficulty];
    if (!speed) continue;
    const step = {
      kind: 'piste',
      id: piste.id,
      name: cleanPisteName(piste.name),
      difficulty: piste.difficulty,
      ...(untagged ? { routeAs: 'advanced' } : null),
    };
    // OSM tegner pister i køreretningen. Kun hvis højdedata ikke viser et
    // klart fald (flade forbindelsesstykker), må stykket køres begge veje.
    const [startElev, endElev] = elevations[piste.id] || [];
    const clearlyDownhill = startElev === undefined || startElev - endElev >= 10;
    const indexes = piste.coordinates.map((point) => nodeFor(point, piste.id));
    for (let i = 1; i < indexes.length; i++) {
      const from = indexes[i - 1];
      const to = indexes[i];
      if (from === to) continue;
      const meters = distanceMeters(graph.nodes[from], graph.nodes[to]);
      graph.edges[from].push({ to, cost: meters / speed, meters, step });
      if (!clearlyDownhill) {
        graph.edges[to].push({ to: from, cost: meters / (speed / 2), meters, step });
      }
    }
    terminals.push({ index: indexes[0], lineId: piste.id });
    terminals.push({ index: indexes[indexes.length - 1], lineId: piste.id });
  }

  for (const lift of lifts) {
    const speed = LIFT_SPEED[lift.liftType] || 3;
    const first = lift.coordinates[0];
    const last = lift.coordinates[lift.coordinates.length - 1];
    // Bundstationen er den laveste ende (falder tilbage til tegneretningen).
    const [startElev, endElev] = elevations[lift.id] || [];
    const flipped = startElev !== undefined && endElev < startElev - 10;
    const bottom = nodeFor(flipped ? last : first, lift.id);
    const top = nodeFor(flipped ? first : last, lift.id);
    const meters = distanceMeters(graph.nodes[bottom], graph.nodes[top]);
    const cost = LIFT_OVERHEAD_S + meters / speed;
    const step = {
      kind: 'lift',
      id: lift.id,
      name: lift.name,
      liftType: lift.liftType,
      pedestrian: pedestrianOk(lift),
    };
    const coordinates = flipped ? [...lift.coordinates].reverse() : lift.coordinates;
    graph.edges[bottom].push({ to: top, cost, meters, step, coordinates });
    if (TWO_WAY_LIFTS.has(lift.liftType)) {
      graph.edges[top].push({
        to: bottom,
        cost,
        meters,
        step: { ...step, down: true },
        coordinates: [...coordinates].reverse(),
      });
    } else if (step.pedestrian) {
      // En stolelift, fodgængere må tage: de skal også kunne komme ned igen.
      // Skiløbere kører ned og får ikke denne mulighed (`walkersOnly`).
      graph.edges[top].push({
        to: bottom,
        cost,
        meters,
        step: { ...step, down: true },
        walkersOnly: true,
        coordinates: [...coordinates].reverse(),
      });
    }
    terminals.push({ index: bottom, lineId: lift.id });
    terminals.push({ index: top, lineId: lift.id });
    if (startElev !== undefined) {
      const station = { pedestrian: step.pedestrian, liftId: lift.id };
      stations.push({ ...station, index: bottom, elevation: Math.min(startElev, endElev), village: isVillage(graph.nodes[bottom]) });
      stations.push({ ...station, index: top, elevation: Math.max(startElev, endElev), village: isVillage(graph.nodes[top]) });
    }
  }

  // Forbind hver liftstation/pist-ende med det nærmeste punkt på hver anden
  // linje inden for rækkevidde - man kan gå/skøjte det korte stykke.
  const walkStep = { kind: 'walk' };
  const linked = new Set();
  for (const terminal of terminals) {
    const nearestPerLine = new Map();
    for (const candidate of nodesNear(graph, graph.nodes[terminal.index], TRANSFER_RADIUS_M)) {
      if (candidate.index === terminal.index) continue;
      for (const lineId of graph.lineOf[candidate.index]) {
        if (lineId === terminal.lineId) continue;
        const best = nearestPerLine.get(lineId);
        if (!best || candidate.meters < best.meters) nearestPerLine.set(lineId, candidate);
      }
    }
    for (const { index, meters } of nearestPerLine.values()) {
      const pair = terminal.index < index ? `${terminal.index}-${index}` : `${index}-${terminal.index}`;
      if (linked.has(pair)) continue;
      linked.add(pair);
      const cost = TRANSFER_OVERHEAD_S + walkSeconds(meters);
      graph.edges[terminal.index].push({ to: index, cost, meters, step: walkStep });
      graph.edges[index].push({ to: terminal.index, cost, meters, step: walkStep });
    }
  }

  for (let a = 0; a < stations.length; a++) {
    for (let b = a + 1; b < stations.length; b++) {
      const from = stations[a];
      const to = stations[b];
      if (from.index === to.index) continue;
      const meters = distanceMeters(graph.nodes[from.index], graph.nodes[to.index]);
      // Uden ski går man mellem to nabostationer oppe på bjerget ad den
      // trampede sti (La Chaux: 230 m fra Chaux Express til Jumbo). Skiløbere
      // får ikke den forbindelse - de kører.
      if (
        from.pedestrian &&
        to.pedestrian &&
        from.liftId !== to.liftId &&
        meters > TRANSFER_RADIUS_M &&
        meters <= STATION_WALK_M &&
        Math.abs(from.elevation - to.elevation) <= STATION_WALK_CLIMB_M &&
        !(from.village && to.village)
      ) {
        const edge = { cost: TRANSFER_OVERHEAD_S + walkSeconds(meters), meters: meters * WALK_DETOUR, step: walkStep, walkersOnly: true };
        graph.edges[from.index].push({ ...edge, to: to.index });
        graph.edges[to.index].push({ ...edge, to: from.index });
        continue;
      }
      if (!from.village || !to.village) continue;
      if (Math.abs(from.elevation - to.elevation) > VILLAGE_MAX_CLIMB_M) continue;
      if (meters <= TRANSFER_RADIUS_M || meters > VILLAGE_RADIUS_M) continue;
      const cost = walkSeconds(meters);
      graph.edges[from.index].push({ to: to.index, cost, meters: meters * WALK_DETOUR, step: walkStep });
      graph.edges[to.index].push({ to: from.index, cost, meters: meters * WALK_DETOUR, step: walkStep });
    }
  }

  return graph;
}

// Nærmeste knude(r) på netværket til et vilkårligt punkt (sted/GPS-position).
function snapPoints(graph, point) {
  const near = nodesNear(graph, point, SNAP_RADIUS_M);
  near.sort((a, b) => a.meters - b.meters);
  return near.slice(0, 25);
}

// Er punktet tæt nok på netværket til, at vi kan lave en rute fra/til det?
export function isOnNetwork(graph, point) {
  return nodesNear(graph, point, SNAP_RADIUS_M).length > 0;
}

// Finder hurtigste rute fra `from` til `to` (begge { latitude, longitude }).
// Returnerer { steps, totalSeconds, totalMeters } eller null, hvis der ikke
// findes en rute med de tilladte sværhedsgrader.
//
// `convention` er landets pistefarver (se utils/pistes.js). I Nordamerika er
// "expert" en dobbelt sort diamant - et trin over almindelig sort - så dér
// hører den til det øverste niveau og ikke til "Black".
export function findRoute(graph, from, to, { skill = 'intermediate', convention = 'europe' } = {}) {
  const level = skillLevels.find((l) => l.id === skill) || skillLevels[2];
  const allowed = new Set(level.allowed);
  if (convention === 'north_america' && level.id === 'advanced') allowed.delete('expert');

  const starts = snapPoints(graph, from);
  const targets = snapPoints(graph, to);
  if (!starts.length || !targets.length) return null;

  const count = graph.nodes.length;
  const dist = new Float64Array(count).fill(Infinity);
  const prevNode = new Int32Array(count).fill(-1);
  const prevEdge = new Array(count).fill(null);
  const startWalk = new Map();
  const heap = new MinHeap();

  for (const start of starts) {
    const cost = walkSeconds(start.meters);
    if (cost < dist[start.index]) {
      dist[start.index] = cost;
      startWalk.set(start.index, start.meters);
      heap.push({ index: start.index, cost });
    }
  }

  while (heap.size) {
    const { index, cost } = heap.pop();
    if (cost > dist[index]) continue;
    for (const edge of graph.edges[index]) {
      if (edge.step.kind === 'piste' && !allowed.has(edge.step.routeAs || edge.step.difficulty)) continue;
      if (level.cabinsOnly && edge.step.kind === 'lift' && !edge.step.pedestrian) continue;
      if (edge.walkersOnly && !level.cabinsOnly) continue;
      const next = cost + edge.cost + (edge.step.down && !level.cabinsOnly ? RIDE_DOWN_PENALTY_S : 0);
      if (next < dist[edge.to]) {
        dist[edge.to] = next;
        prevNode[edge.to] = index;
        prevEdge[edge.to] = edge;
        heap.push({ index: edge.to, cost: next });
      }
    }
  }

  // Vælg den knude nær målet, der giver kortest tid inkl. den sidste gåtur.
  let best = null;
  for (const target of targets) {
    if (dist[target.index] === Infinity) continue;
    const total = dist[target.index] + walkSeconds(target.meters);
    if (!best || total < best.total) best = { ...target, total };
  }
  if (!best) return null;

  // Gå baglæns fra målet til start og saml kanterne i rækkefølge.
  const path = [];
  let cursor = best.index;
  while (prevNode[cursor] !== -1) {
    path.push({ edge: prevEdge[cursor], from: prevNode[cursor] });
    cursor = prevNode[cursor];
  }
  path.reverse();

  // Slå kanter sammen til trin, brugeren kan læse. OSM deler ofte én pist op
  // i mange små stykker, så stykker med samme navn og farve bliver til ét trin.
  const steps = [];
  const addStep = (step, seconds, meters, coordinates) => {
    const last = steps[steps.length - 1];
    const samePiste =
      last &&
      step.kind === 'piste' &&
      last.kind === 'piste' &&
      (last.id === step.id || (last.name === step.name && last.difficulty === step.difficulty));
    const sameWalk = last && step.kind === 'walk' && last.kind === 'walk';
    if (samePiste || sameWalk) {
      last.seconds += seconds;
      last.meters += meters;
      last.coordinates.push(...coordinates.slice(1));
    } else {
      steps.push({ ...step, seconds, meters, coordinates: [...coordinates] });
    }
  };

  const firstWalk = startWalk.get(cursor) || 0;
  if (firstWalk > 25) {
    addStep({ kind: 'walk' }, walkSeconds(firstWalk), firstWalk * WALK_DETOUR, [from, graph.nodes[cursor]]);
  }
  for (const { edge, from: fromIndex } of path) {
    const coordinates = edge.coordinates || [graph.nodes[fromIndex], graph.nodes[edge.to]];
    addStep(edge.step, edge.cost, edge.meters, coordinates);
  }
  if (best.meters > 25) {
    addStep({ kind: 'walk' }, walkSeconds(best.meters), best.meters * WALK_DETOUR, [graph.nodes[best.index], to]);
  }

  // Ryd op i listen: helt korte gå-stykker og korte pist-stumper (under 120 m
  // med navn, under 200 m uden - forbindelser mellem to pister) er bare støj
  // for brugeren. De tæller
  // stadig med i den samlede tid og tegnes stadig på kortet.
  const worthListing = (step) => {
    if (step.kind === 'walk') return step.meters >= 40;
    if (step.kind === 'piste') return step.meters >= (step.name ? 120 : 200);
    return true;
  };
  // ... men en kort rute, der KUN består af den slags stumper (150 m ned ad en
  // pist til hotellet), skal stadig have trin - ellers stod der "du er der
  // allerede" om et sted 150 m væk.
  const visible = steps.some(worthListing) ? steps.filter(worthListing) : steps;

  // Når en skjult pist-stump lå mellem to gå-stykker, står de nu lige efter
  // hinanden i listen - slå dem sammen til ét.
  const listed = [];
  const absorb = (into, step) => {
    into.seconds += step.seconds;
    into.meters += step.meters;
    into.coordinates = [...into.coordinates, ...step.coordinates];
  };
  for (const step of visible) {
    const last = listed[listed.length - 1];
    const beforeLast = listed[listed.length - 2];
    if (last && last.kind === 'walk' && step.kind === 'walk') {
      absorb(last, step);
    } else if (step.kind === 'lift' && last && last.kind === 'lift' && sameLiftName(last.name, step.name)) {
      // Én lift, tegnet som to stykker i OpenStreetMap (Chaux Express går op
      // over en ryg og ned igen): for brugeren er det ét trin. Går det ene
      // stykke op og det andet ned, er det bare "Take Chaux Express".
      absorb(last, step);
      last.down = Boolean(last.down && step.down);
      last.joined = true;
    } else if (
      step.kind === 'lift' &&
      last &&
      last.kind === 'walk' &&
      last.meters < 100 &&
      beforeLast &&
      beforeLast.kind === 'lift' &&
      sameLiftName(beforeLast.name, step.name)
    ) {
      // ... også når der står et par skridt mellem de to stykker.
      listed.pop();
      absorb(beforeLast, last);
      absorb(beforeLast, step);
      beforeLast.down = Boolean(beforeLast.down && step.down);
      beforeLast.joined = true;
    } else {
      listed.push({ ...step });
    }
  }

  // Sværeste pist på ruten - regnet på ALLE stykker, også de korte
  // forbindelser, der ikke står i listen. Ellers kunne en rute hedde
  // "hardest piste: Blue" og alligevel gå 150 m ad en rød.
  let hardest = null;
  for (const step of steps) {
    if (step.kind !== 'piste') continue;
    const difficulty = step.routeAs || step.difficulty;
    if (!hardest || DIFFICULTY_ORDER.indexOf(difficulty) > DIFFICULTY_ORDER.indexOf(hardest)) hardest = difficulty;
  }

  return {
    steps: listed.map((step, index) => ({ ...step, key: `${index}-${step.kind}-${step.id || 'walk'}` })),
    totalSeconds: steps.reduce((sum, step) => sum + step.seconds, 0),
    totalMeters: steps.reduce((sum, step) => sum + step.meters, 0),
    coordinates: steps.flatMap((step) => step.coordinates),
    hardest,
  };
}
