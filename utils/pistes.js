// Oprydning i OpenSkiMap-dataene, så vi ikke skal rette i den store,
// genererede data/verbierMap.js. Datasættet "pistes" indeholder nemlig mere
// end alpine pister: skitur-ruter (opstigning på ski) og en kælkebane, og
// nogle pistenavne har fået skitur-rutens navn klistret på.

const TOUR_PREFIXES = ['skitour:', 'randonnée à ski:'];

// 'downhill' = almindelig pist, 'sled' = kælkebane, 'skitour' = skitur-rute,
// 'other' = linje uden sværhedsgrad, som vi ikke ved, hvad er.
export function pisteKind(piste) {
  const name = piste.name || '';
  if (/\bluge\b/i.test(name)) return 'sled';
  if (piste.difficulty === 'unknown') return /skitour/i.test(name) ? 'skitour' : 'other';
  return 'downhill';
}

// "skitour: Arolla - Verbier, randonnée à ski: Arolla - Verbier, Gentianes - La Chaux"
// -> "Gentianes - La Chaux". Returnerer null, hvis der ikke er et rigtigt navn.
// (Skitur-ruter beholder deres rutenavn - se pisteDisplayName.)
export function cleanPisteName(name) {
  if (!name) return null;
  const parts = name
    .split(', ')
    .map((part) => part.trim())
    .filter((part) => part && !TOUR_PREFIXES.some((prefix) => part.startsWith(prefix)));
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(', ') : null;
}

// Navnet, som kortet viser for en linje. En skitur-rute hedder fx
// "skitour: Arolla - Verbier, randonnée à ski: Arolla - Verbier" -> "Arolla - Verbier".
export function pisteDisplayName(piste) {
  const cleaned = cleanPisteName(piste.name);
  if (cleaned) return cleaned;
  const tour = (piste.name || '').match(/skitour:\s*([^,]+)/i);
  return tour ? tour[1].trim() : null;
}

export const difficultyLabels = {
  novice: 'Green (beginner)',
  easy: 'Blue (easy)',
  intermediate: 'Red (intermediate)',
  advanced: 'Black (difficult)',
  expert: 'Black (expert)',
  extreme: 'Extreme',
  freeride: 'Off-piste / ski route',
  unknown: 'Unclassified',
};

export const liftTypeLabels = {
  gondola: 'Gondola',
  chair_lift: 'Chairlift',
  cable_car: 'Cable car',
  mixed_lift: 'Combined lift',
  platter: 'Platter lift',
  drag_lift: 'Drag lift',
  magic_carpet: 'Magic carpet',
  rope_tow: 'Rope tow',
  unknown: 'Lift',
};

// Tekst til info-kortet/rutetrin: hvad er denne linje for noget?
export function pisteLabel(piste) {
  const kind = pisteKind(piste);
  if (kind === 'sled') return 'Sled run';
  if (kind === 'skitour') return 'Ski touring route (uphill)';
  if (kind === 'other') return 'Unclassified route';
  return difficultyLabels[piste.difficulty] || difficultyLabels.unknown;
}
