import { categoryMeta } from '../data/categoryMeta';
import { placeCategory } from './places';
import { liftTypeLabels, pisteLabel } from './pistes';
import { formatDistance } from './geo';

// Søgning på tværs af steder, lifter og pister.
//
// Sammenligningen ser bort fra accenter, store/små bogstaver og krøllede
// apostroffer, så "medran" finder Médran, "chable" finder Le Châble og
// "l’av" (iPhones apostrof) finder L'Aviation.
export function fold(text) {
  let s = String(text || '');
  try {
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    // normalize() mangler på enkelte ældre JS-motorer - så søger vi bare uden.
  }
  // Bindestreger tæller som mellemrum: "mont fort" skal finde "Mont-Fort".
  return s
    .replace(/[’‘`´]/g, "'")
    .replace(/[-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

// Ord, folk skriver, når de mener en hel kategori ("hotels", "coffee", "bar").
const CATEGORY_WORDS = {
  restaurant: ['restaurant', 'restaurants', 'food', 'eat', 'lunch', 'dinner'],
  cafe: ['cafe', 'cafes', 'coffee'],
  apres_ski: ['apres', 'apres ski', 'bar', 'bars', 'drinks'],
  hotel: ['hotel', 'hotels', 'accommodation'],
  ski_rental: ['rental', 'ski rental', 'rent', 'hire', 'ski hire'],
  // Ikke stedkategorier, men kortlag: se `category` i resultatet.
  toilets: ['toilet', 'toilets', 'wc', 'restroom', 'bathroom'],
  lifts: ['lift', 'lifts', 'gondola', 'chairlift', 'cable car'],
};

const SLED_WORDS = ['sled', 'sledding', 'sledge', 'toboggan'];

// Mindst tre bogstaver, så "ba" ikke bliver til alle barer ("wc" er undtaget).
function categoryFor(q) {
  if (q === 'wc') return 'toilets';
  if (q.length < 3) return null;
  for (const [category, words] of Object.entries(CATEGORY_WORDS)) {
    if (words.some((word) => word === q || (q.length >= 4 && word.startsWith(q)))) return category;
  }
  return null;
}

// 0 = navnet starter med søgningen, 1 = et ord i navnet gør, 2 = navnet
// indeholder den, -1 = ingen træf på navnet.
function nameRank(name, q) {
  const folded = fold(name);
  if (folded.startsWith(q)) return 0;
  if (folded.split(/[\s\-|,/'()]+/).some((word) => word.startsWith(q))) return 1;
  if (folded.includes(q)) return 2;
  return -1;
}

function nearLiftText(model, place) {
  const nearest = model.nearestLiftStation(place);
  return nearest ? `${formatDistance(nearest.meters)} from ${nearest.lift.name} lift` : '';
}

function liftSubtitle(model, lift) {
  const type = liftTypeLabels[lift.liftType] || liftTypeLabels.unknown;
  const [a, b] = model.elevations[lift.id] || [];
  if (a === undefined || Math.abs(a - b) < 10) return type;
  return `${type} · ${Math.min(a, b)} → ${Math.max(a, b)} m`;
}

// Returnerer null for en tom søgning, ellers
//   { results: [{ kind: 'place'|'lift'|'piste', id, title, subtitle, data }], total, category }
// `category` er sat, når søgningen er et kategoriord ("hotels", "toilets",
// "lifts") - så kan skærmen tilbyde at vise hele kategorien på kortet.
// `model` er det valgte skiområde (utils/resortModel.js).
export function search(model, query, limit = 25) {
  const q = fold(query);
  if (!q) return null;
  const { allPlaces, lifts, pisteGroups } = model;
  const category = categoryFor(q);
  const matches = [];

  for (const place of allPlaces) {
    let rank = nameRank(place.name, q);
    if (rank === -1 && category && placeCategory(place) === category) rank = 3;
    if (rank === -1 && fold(place.cuisine).replace(/[_;]/g, ' ').includes(q)) rank = 3;
    if (rank === -1 && fold(place.description).includes(q)) rank = 4;
    if (rank === -1) continue;
    const meta = categoryMeta[placeCategory(place)];
    matches.push({
      rank,
      kind: 'place',
      id: place.id,
      title: place.name,
      subtitle: [meta?.singular, nearLiftText(model, place)].filter(Boolean).join(' · '),
      data: place,
    });
  }

  for (const lift of lifts) {
    let rank = nameRank(lift.name, q);
    if (rank === -1 && category === 'lifts') rank = 3;
    if (rank === -1) continue;
    matches.push({
      rank,
      kind: 'lift',
      id: lift.id,
      title: lift.name,
      subtitle: liftSubtitle(model, lift),
      data: lift,
    });
  }

  // Samme pistenavn kan findes flere steder (adskilte stykker) - vis kun det
  // længste, så listen ikke får ni ens rækker.
  const sledWord = SLED_WORDS.some((word) => word === q || (q.length >= 4 && word.startsWith(q)));
  const bestPiste = new Map();
  for (const group of pisteGroups) {
    if (!group.name) continue;
    let rank = nameRank(group.name, q);
    if (rank === -1 && sledWord && group.kind === 'sled') rank = 3;
    if (rank === -1) continue;
    const key = group.kind === 'sled' ? group.name : `${group.name}|${group.difficulty}`;
    const best = bestPiste.get(key);
    if (!best || group.meters > best.group.meters) bestPiste.set(key, { group, rank });
  }
  for (const { group, rank } of bestPiste.values()) {
    matches.push({
      rank,
      kind: 'piste',
      id: group.id,
      title: group.name,
      subtitle: `${pisteLabel(group.pistes[0], model.convention)} · ${formatDistance(group.meters)}`,
      data: group,
    });
  }

  // Bedste navnetræf først; ved lighed lifter og pister før steder (dem er
  // der få af, og de drukner ellers blandt 300 steder), derefter alfabetisk.
  const kindOrder = { lift: 0, piste: 1, place: 2 };
  matches.sort(
    (a, b) =>
      a.rank - b.rank ||
      kindOrder[a.kind] - kindOrder[b.kind] ||
      a.title.localeCompare(b.title)
  );

  return { results: matches.slice(0, limit), total: matches.length, category };
}
