// Oprydning i OpenSkiMap-dataene, så vi ikke skal rette i den store,
// genererede data/verbierMap.js. Datasættet "pistes" indeholder nemlig mere
// end alpine pister: skitur-ruter (opstigning på ski) og en kælkebane, og
// nogle pistenavne har fået skitur-rutens navn klistret på.

const TOUR_PREFIXES = ['skitour:', 'randonnée à ski:'];

// 'downhill' = almindelig pist, 'sled' = kælkebane, 'skitour' = skitur-rute,
// 'other' = linje uden sværhedsgrad, som vi ikke ved, hvad er.
// Hentede skiområder (utils/resortData.js) har typen direkte fra
// OpenStreetMap i `piste.type`; i det indbyggede Verbier-datasæt må vi gætte
// ud fra navn og sværhedsgrad.
export function pisteKind(piste) {
  if (piste.type) return piste.type;
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

// PISTEFARVER ER IKKE ENS I HELE VERDEN
//
//   Europa:        grøn (begynder) · blå · rød · sort
//   Nordamerika:   grøn cirkel · blå firkant · sort diamant · dobbelt sort
//   Japan:         grøn · rød · sort
//
// OpenStreetMap bruger de samme fem trin overalt (novice, easy, intermediate,
// advanced, expert); her oversættes de til den farve og tekst, der står på
// skiltene i det land, skiområdet ligger i (`resort.convention`).
// Farverne er mørke nok til at kunne ses på det hvide sneterræn i sollys.
const GREEN = '#1e8e3e';
const BLUE = '#1565c0';
const RED = '#d32f2f';
const BLACK = '#1a1a1a';
const OFF_PISTE = '#c2600a';
const GREY = '#616161';

const CONVENTIONS = {
  europe: {
    colors: { novice: GREEN, easy: BLUE, intermediate: RED, advanced: BLACK, expert: BLACK, extreme: BLACK },
    short: { novice: 'Green', easy: 'Blue', intermediate: 'Red', advanced: 'Black', expert: 'Black', extreme: 'Black' },
    labels: {
      novice: 'Green (beginner)',
      easy: 'Blue (easy)',
      intermediate: 'Red (intermediate)',
      advanced: 'Black (difficult)',
      expert: 'Black (expert)',
    },
    legend: [
      ['novice', 'Green · beginner'],
      ['easy', 'Blue · easy'],
      ['intermediate', 'Red · intermediate'],
      ['advanced', 'Black · difficult'],
    ],
  },
  north_america: {
    colors: { novice: GREEN, easy: GREEN, intermediate: BLUE, advanced: BLACK, expert: BLACK, extreme: BLACK },
    short: { novice: 'Green', easy: 'Green', intermediate: 'Blue', advanced: 'Black', expert: 'Double black', extreme: 'Double black' },
    labels: {
      novice: 'Green circle (beginner)',
      easy: 'Green circle (easy)',
      intermediate: 'Blue square (intermediate)',
      advanced: 'Black diamond (difficult)',
      expert: 'Double black diamond (expert)',
    },
    legend: [
      ['easy', 'Green · easy'],
      ['intermediate', 'Blue · intermediate'],
      ['advanced', 'Black · difficult'],
    ],
  },
  japan: {
    colors: { novice: GREEN, easy: GREEN, intermediate: RED, advanced: BLACK, expert: BLACK, extreme: BLACK },
    short: { novice: 'Green', easy: 'Green', intermediate: 'Red', advanced: 'Black', expert: 'Black', extreme: 'Black' },
    labels: {
      novice: 'Green (beginner)',
      easy: 'Green (beginner)',
      intermediate: 'Red (intermediate)',
      advanced: 'Black (advanced)',
      expert: 'Black (expert)',
    },
    legend: [
      ['easy', 'Green · beginner'],
      ['intermediate', 'Red · intermediate'],
      ['advanced', 'Black · advanced'],
    ],
  },
};

const conventionOf = (convention) => CONVENTIONS[convention] || CONVENTIONS.europe;

export const OFF_PISTE_COLOR = OFF_PISTE;
export const UNKNOWN_PISTE_COLOR = GREY;

// Farven på en pist med den sværhedsgrad.
export function pisteColor(difficulty, convention) {
  if (difficulty === 'freeride') return OFF_PISTE;
  return conventionOf(convention).colors[difficulty] || GREY;
}

// "Red (intermediate)" - til info-kort og rutetrin.
export function difficultyLabel(difficulty, convention) {
  if (difficulty === 'freeride') return 'Off-piste / ski route';
  if (difficulty === 'extreme') return 'Extreme';
  return conventionOf(convention).labels[difficulty] || 'Unclassified';
}

// "Red" - til korte tekster som "Needs a red piste".
export function shortDifficulty(difficulty, convention) {
  if (difficulty === 'freeride') return 'Off-piste';
  return conventionOf(convention).short[difficulty] || 'Unclassified';
}

// Rækkerne i kortets signaturforklaring: [{ label, color }].
export function pisteLegend(convention) {
  const c = conventionOf(convention);
  return c.legend.map(([difficulty, label]) => ({ label, color: c.colors[difficulty] }));
}

// Navn og farve på et niveau i rutefindingen (se skillLevels i routing.js):
// "Blue" i Europa er "Green" i Nordamerika og Japan.
const SKILL_DIFFICULTY = { easy: 'easy', intermediate: 'intermediate', advanced: 'advanced', freeride: 'freeride' };
export function skillLabel(levelId, convention) {
  if (levelId === 'none') return 'No skis';
  // Øverste niveau i Nordamerika rummer også dobbelt sort (se findRoute).
  if (levelId === 'freeride' && convention === 'north_america') return 'Double black';
  return shortDifficulty(SKILL_DIFFICULTY[levelId], convention);
}
export function skillColor(levelId, convention) {
  return pisteColor(SKILL_DIFFICULTY[levelId], convention);
}

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
export function pisteLabel(piste, convention) {
  const kind = pisteKind(piste);
  if (kind === 'sled') return 'Sled run';
  if (kind === 'skitour') return 'Ski touring route (uphill)';
  if (kind === 'other') return 'Unclassified route';
  return difficultyLabel(piste.difficulty, convention);
}
