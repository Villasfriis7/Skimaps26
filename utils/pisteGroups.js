import { pistes } from '../data/verbierMap';
import { elevations } from '../data/elevations';
import { distanceMeters, lineLengthMeters } from './geo';
import { pisteKind, pisteDisplayName, cleanPisteName } from './pistes';

// En almindelig pist, der kun har fået en skitur-rutes navn klistret på i
// OSM, har ikke noget rigtigt navn - den skal ikke hedde "Arolla - Verbier".
const nameOf = (piste) =>
  pisteKind(piste) === 'downhill' || pisteKind(piste) === 'sled'
    ? cleanPisteName(piste.name)
    : pisteDisplayName(piste);

// OpenStreetMap deler hver pist op i mange små stykker (Gentianes - La Chaux
// er fx 10 stykker, nogle på 10 m). For brugeren er det ÉN pist, så her
// samles stykkerne: samme navn, samme sværhedsgrad, og enderne skal ligge
// tæt på hinanden (ellers er det to forskellige pister med samme navn).
// Stykker uden navn står alene.
//
//   group: { id, name, difficulty, kind, pistes: [stykker], meters, top, bottom }
const JOIN_RADIUS_M = 80;

const endsOf = (piste) => [piste.coordinates[0], piste.coordinates[piste.coordinates.length - 1]];

// To stykker hænger sammen, hvis en ende af det ene ligger tæt på et punkt
// på det andet (en pist kan også grene ud midt på en anden).
function endNear(a, b) {
  for (const p of endsOf(a)) {
    for (const q of b.coordinates) {
      if (distanceMeters(p, q) <= JOIN_RADIUS_M) return true;
    }
  }
  return false;
}
const touches = (a, b) => endNear(a, b) || endNear(b, a);

function buildGroups() {
  // Sortér stykkerne i bunker efter navn + sværhedsgrad ...
  const buckets = new Map();
  const groups = [];
  for (const piste of pistes) {
    const name = nameOf(piste);
    if (!name) {
      groups.push([piste]);
      continue;
    }
    // En kælkebane er én bane, selvom OSM har givet stykkerne hver sin
    // sværhedsgrad - derfor tæller sværhedsgraden kun med for skipister.
    const kind = pisteKind(piste);
    const key = kind === 'sled' ? `${name}|sled` : `${name}|${piste.difficulty}|${kind}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(piste);
  }
  // ... og del hver bunke i sammenhængende kæder.
  for (const bucket of buckets.values()) {
    const left = new Set(bucket);
    while (left.size) {
      const [first] = left;
      left.delete(first);
      const chain = [first];
      for (let i = 0; i < chain.length; i++) {
        for (const other of [...left]) {
          if (touches(chain[i], other)) {
            left.delete(other);
            chain.push(other);
          }
        }
      }
      groups.push(chain);
    }
  }
  return groups.map((members) => {
    const heights = members.flatMap((piste) => elevations[piste.id] || []);
    return {
      id: members[0].id,
      name: nameOf(members[0]),
      difficulty: members[0].difficulty,
      kind: pisteKind(members[0]),
      pistes: members,
      meters: members.reduce((sum, piste) => sum + lineLengthMeters(piste.coordinates), 0),
      top: heights.length ? Math.max(...heights) : undefined,
      bottom: heights.length ? Math.min(...heights) : undefined,
    };
  });
}

export const pisteGroups = buildGroups();

const groupByPisteId = new Map();
for (const group of pisteGroups) {
  for (const piste of group.pistes) groupByPisteId.set(piste.id, group);
}

// Hele pisten, som et stykke hører til.
export const pisteGroupOf = (pisteId) => groupByPisteId.get(pisteId) || null;

// Alle punkter i en gruppe - til at zoome kortet hen til pisten.
export const groupCoordinates = (group) => group.pistes.flatMap((piste) => piste.coordinates);
