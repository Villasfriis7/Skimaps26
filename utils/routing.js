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
  expert: 5,
  extreme: 4,
  freeride: 4,
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

const WALK_SPEED = 1.1; // m/s i skistøvler
const WALK_DETOUR = 1.3; // fugleflugt -> faktisk gåafstand
const TRANSFER_RADIUS_M = 120; // maks. afstand mellem to linjer, der "hænger sammen"
const TRANSFER_OVERHEAD_S = 30;
const SNAP_RADIUS_M = 600; // hvor langt fra netværket start/mål må ligge
// Liftstationer i samme by (fx Médran og Savoleyres i Verbier) hænger ikke
// sammen via pister, men man kan gå eller tage skibussen imellem dem.
const VILLAGE_RADIUS_M = 1500;
const VILLAGE_MAX_CLIMB_M = 80;
// Kun stationer nede i byerne. Uden denne grænse foreslog ruten 2 km "gåture"
// mellem to liftstationer oppe på bjerget, hvor man ikke kan gå i skistøvler.
const VILLAGE_MAX_ELEVATION_M = 1800;

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

// Groft gitter (ca. 110 x 80 m pr. celle), så "hvilke knuder ligger tæt på
// dette punkt?" ikke kræver et gennemløb af alle knuder.
const CELL = 0.001;
const cellKey = (lat, lon) => `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;

function nodesNear(graph, point, radius) {
  const reach = Math.ceil(radius / 75) + 1;
  const baseLat = Math.floor(point.latitude / CELL);
  const baseLon = Math.floor(point.longitude / CELL);
  const found = [];
  for (let dLat = -reach; dLat <= reach; dLat++) {
    for (let dLon = -reach; dLon <= reach; dLon++) {
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

export function buildGraph({ lifts, pistes, elevations = {} }) {
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
    const speed = PISTE_SPEED[piste.difficulty];
    if (!speed) continue;
    const step = {
      kind: 'piste',
      id: piste.id,
      name: cleanPisteName(piste.name),
      difficulty: piste.difficulty,
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
    const step = { kind: 'lift', id: lift.id, name: lift.name, liftType: lift.liftType };
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
    }
    terminals.push({ index: bottom, lineId: lift.id });
    terminals.push({ index: top, lineId: lift.id });
    if (startElev !== undefined) {
      stations.push({ index: bottom, elevation: Math.min(startElev, endElev) });
      stations.push({ index: top, elevation: Math.max(startElev, endElev) });
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
      if (from.elevation > VILLAGE_MAX_ELEVATION_M || to.elevation > VILLAGE_MAX_ELEVATION_M) continue;
      if (Math.abs(from.elevation - to.elevation) > VILLAGE_MAX_CLIMB_M) continue;
      const meters = distanceMeters(graph.nodes[from.index], graph.nodes[to.index]);
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
export function findRoute(graph, from, to, { skill = 'intermediate' } = {}) {
  const level = skillLevels.find((l) => l.id === skill) || skillLevels[2];
  const allowed = new Set(level.allowed);

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
      if (edge.step.kind === 'piste' && !allowed.has(edge.step.difficulty)) continue;
      if (level.cabinsOnly && edge.step.kind === 'lift' && !TWO_WAY_LIFTS.has(edge.step.liftType)) continue;
      const next = cost + edge.cost;
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
  const visible = steps.filter((step) => {
    if (step.kind === 'walk') return step.meters >= 40;
    if (step.kind === 'piste') return step.meters >= (step.name ? 120 : 200);
    return true;
  });

  // Når en skjult pist-stump lå mellem to gå-stykker, står de nu lige efter
  // hinanden i listen - slå dem sammen til ét.
  const listed = [];
  for (const step of visible) {
    const last = listed[listed.length - 1];
    if (last && last.kind === 'walk' && step.kind === 'walk') {
      last.seconds += step.seconds;
      last.meters += step.meters;
      last.coordinates = [...last.coordinates, ...step.coordinates];
    } else {
      listed.push({ ...step });
    }
  }

  return {
    steps: listed.map((step, index) => ({ ...step, key: `${index}-${step.kind}-${step.id || 'walk'}` })),
    totalSeconds: steps.reduce((sum, step) => sum + step.seconds, 0),
    totalMeters: steps.reduce((sum, step) => sum + step.meters, 0),
    coordinates: steps.flatMap((step) => step.coordinates),
  };
}
