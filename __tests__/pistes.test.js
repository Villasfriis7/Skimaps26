import {
  pisteKind,
  cleanPisteName,
  pisteDisplayName,
  pisteColor,
  difficultyLabel,
  shortDifficulty,
  pisteLegend,
  skillLabel,
  skillColor,
  pisteLabel,
  liftTypeLabels,
  OFF_PISTE_COLOR,
  UNKNOWN_PISTE_COLOR,
} from '../utils/pistes';
import { skillLevels } from '../utils/routing';

const GREEN = '#1e8e3e';
const BLUE = '#1565c0';
const RED = '#d32f2f';
const BLACK = '#1a1a1a';

describe('pisteKind', () => {
  test('hentede områder har typen direkte fra OpenStreetMap', () => {
    expect(pisteKind({ type: 'sled', name: 'Rodelbahn', difficulty: 'easy' })).toBe('sled');
    expect(pisteKind({ type: 'skitour', name: null, difficulty: 'unknown' })).toBe('skitour');
    // En rigtig pist uden sværhedsgrad er stadig en pist.
    expect(pisteKind({ type: 'downhill', name: null, difficulty: 'unknown' })).toBe('downhill');
  });

  test('i Verbier-datasættet gættes typen ud fra navn og sværhedsgrad', () => {
    expect(pisteKind({ name: 'Piste de luge de La Tzoumaz', difficulty: 'easy' })).toBe('sled');
    expect(pisteKind({ name: 'skitour: Arolla - Verbier', difficulty: 'unknown' })).toBe('skitour');
    expect(pisteKind({ name: null, difficulty: 'unknown' })).toBe('other');
    expect(pisteKind({ name: 'Combe', difficulty: 'intermediate' })).toBe('downhill');
    expect(pisteKind({ name: null, difficulty: 'easy' })).toBe('downhill');
  });

  test('"luge" skal være et helt ord', () => {
    expect(pisteKind({ name: 'Lugeon', difficulty: 'easy' })).toBe('downhill');
  });
});

describe('cleanPisteName og pisteDisplayName', () => {
  test('skitur-rutens navn fjernes fra en almindelig pist', () => {
    expect(
      cleanPisteName('skitour: Arolla - Verbier, randonnée à ski: Arolla - Verbier, Gentianes - La Chaux')
    ).toBe('Gentianes - La Chaux');
  });

  test('gentagelser fjernes, og flere rigtige navne beholdes', () => {
    expect(cleanPisteName('Combe, Combe')).toBe('Combe');
    expect(cleanPisteName('Moneyeu, Pissevache')).toBe('Moneyeu, Pissevache');
  });

  test('intet rigtigt navn giver null', () => {
    expect(cleanPisteName(null)).toBeNull();
    expect(cleanPisteName('')).toBeNull();
    expect(cleanPisteName('skitour: Arolla - Verbier, randonnée à ski: Arolla - Verbier')).toBeNull();
  });

  test('en skitur-rute vises med rutens navn', () => {
    expect(
      pisteDisplayName({ name: 'skitour: Arolla - Verbier, randonnée à ski: Arolla - Verbier' })
    ).toBe('Arolla - Verbier');
    expect(pisteDisplayName({ name: 'Combe' })).toBe('Combe');
    expect(pisteDisplayName({ name: null })).toBeNull();
  });
});

describe('pistefarver følger landet', () => {
  test('Europa: grøn, blå, rød, sort', () => {
    expect(pisteColor('novice', 'europe')).toBe(GREEN);
    expect(pisteColor('easy', 'europe')).toBe(BLUE);
    expect(pisteColor('intermediate', 'europe')).toBe(RED);
    expect(pisteColor('advanced', 'europe')).toBe(BLACK);
    expect(pisteColor('expert', 'europe')).toBe(BLACK);
  });

  test('Nordamerika: grøn cirkel, blå firkant, sort diamant', () => {
    expect(pisteColor('novice', 'north_america')).toBe(GREEN);
    expect(pisteColor('easy', 'north_america')).toBe(GREEN);
    expect(pisteColor('intermediate', 'north_america')).toBe(BLUE);
    expect(pisteColor('advanced', 'north_america')).toBe(BLACK);
    expect(pisteColor('expert', 'north_america')).toBe(BLACK);
  });

  test('Japan: grøn, rød, sort', () => {
    expect(pisteColor('easy', 'japan')).toBe(GREEN);
    expect(pisteColor('intermediate', 'japan')).toBe(RED);
    expect(pisteColor('advanced', 'japan')).toBe(BLACK);
  });

  test('off-piste og ukendt har deres egne farver i alle lande', () => {
    for (const convention of ['europe', 'north_america', 'japan']) {
      expect(pisteColor('freeride', convention)).toBe(OFF_PISTE_COLOR);
      expect(pisteColor('unknown', convention)).toBe(UNKNOWN_PISTE_COLOR);
      expect(pisteColor(undefined, convention)).toBe(UNKNOWN_PISTE_COLOR);
    }
  });

  test('et ukendt land bruger de europæiske farver', () => {
    expect(pisteColor('easy', 'atlantis')).toBe(BLUE);
    expect(pisteColor('easy', undefined)).toBe(BLUE);
    expect(difficultyLabel('intermediate', undefined)).toBe('Red (intermediate)');
  });
});

describe('tekster for sværhedsgrad', () => {
  test('difficultyLabel', () => {
    expect(difficultyLabel('novice', 'europe')).toBe('Green (beginner)');
    expect(difficultyLabel('easy', 'europe')).toBe('Blue (easy)');
    expect(difficultyLabel('intermediate', 'europe')).toBe('Red (intermediate)');
    expect(difficultyLabel('advanced', 'europe')).toBe('Black (difficult)');
    expect(difficultyLabel('easy', 'north_america')).toBe('Green circle (easy)');
    expect(difficultyLabel('intermediate', 'north_america')).toBe('Blue square (intermediate)');
    expect(difficultyLabel('advanced', 'north_america')).toBe('Black diamond (difficult)');
    expect(difficultyLabel('expert', 'north_america')).toBe('Double black diamond (expert)');
    expect(difficultyLabel('easy', 'japan')).toBe('Green (beginner)');
    expect(difficultyLabel('intermediate', 'japan')).toBe('Red (intermediate)');
  });

  test('off-piste, ekstrem og ukendt hedder det samme overalt', () => {
    for (const convention of ['europe', 'north_america', 'japan']) {
      expect(difficultyLabel('freeride', convention)).toBe('Off-piste / ski route');
      expect(difficultyLabel('extreme', convention)).toBe('Extreme');
      expect(difficultyLabel('unknown', convention)).toBe('Unclassified');
    }
  });

  test('shortDifficulty', () => {
    expect(shortDifficulty('easy', 'europe')).toBe('Blue');
    expect(shortDifficulty('easy', 'north_america')).toBe('Green');
    expect(shortDifficulty('easy', 'japan')).toBe('Green');
    expect(shortDifficulty('intermediate', 'europe')).toBe('Red');
    expect(shortDifficulty('intermediate', 'north_america')).toBe('Blue');
    expect(shortDifficulty('intermediate', 'japan')).toBe('Red');
    expect(shortDifficulty('expert', 'europe')).toBe('Black');
    expect(shortDifficulty('expert', 'north_america')).toBe('Double black');
    expect(shortDifficulty('freeride', 'japan')).toBe('Off-piste');
    expect(shortDifficulty('unknown', 'europe')).toBe('Unclassified');
  });

  test('pisteLabel siger, hvad linjen er', () => {
    expect(pisteLabel({ type: 'sled', difficulty: 'easy' }, 'europe')).toBe('Sled run');
    expect(pisteLabel({ type: 'skitour', difficulty: 'unknown' }, 'europe')).toBe('Ski touring route (uphill)');
    expect(pisteLabel({ name: null, difficulty: 'unknown' }, 'europe')).toBe('Unclassified route');
    expect(pisteLabel({ name: 'Combe', difficulty: 'intermediate' }, 'europe')).toBe('Red (intermediate)');
    expect(pisteLabel({ name: 'Combe', difficulty: 'intermediate' }, 'north_america')).toBe(
      'Blue square (intermediate)'
    );
    // En hentet pist uden sværhedsgrad er en pist, bare uden farve.
    expect(pisteLabel({ type: 'downhill', difficulty: 'unknown' }, 'europe')).toBe('Unclassified');
  });
});

describe('pisteLegend', () => {
  test('Europa har fire rækker, de andre tre', () => {
    expect(pisteLegend('europe')).toEqual([
      { label: 'Green · beginner', color: GREEN },
      { label: 'Blue · easy', color: BLUE },
      { label: 'Red · intermediate', color: RED },
      { label: 'Black · difficult', color: BLACK },
    ]);
    expect(pisteLegend('north_america')).toEqual([
      { label: 'Green · easy', color: GREEN },
      { label: 'Blue · intermediate', color: BLUE },
      { label: 'Black · difficult', color: BLACK },
    ]);
    expect(pisteLegend('japan')).toEqual([
      { label: 'Green · beginner', color: GREEN },
      { label: 'Red · intermediate', color: RED },
      { label: 'Black · advanced', color: BLACK },
    ]);
  });
});

describe('niveauerne i rutefindingen', () => {
  test('skillLabel: "Blue" i Europa er "Green" i Nordamerika og Japan', () => {
    expect(skillLabel('none', 'europe')).toBe('No skis');
    expect(skillLabel('easy', 'europe')).toBe('Blue');
    expect(skillLabel('intermediate', 'europe')).toBe('Red');
    expect(skillLabel('advanced', 'europe')).toBe('Black');
    expect(skillLabel('freeride', 'europe')).toBe('Off-piste');

    expect(skillLabel('none', 'north_america')).toBe('No skis');
    expect(skillLabel('easy', 'north_america')).toBe('Green');
    expect(skillLabel('intermediate', 'north_america')).toBe('Blue');
    expect(skillLabel('advanced', 'north_america')).toBe('Black');
    // Øverste niveau i Nordamerika er dobbelt sort diamant.
    expect(skillLabel('freeride', 'north_america')).toBe('Double black');

    expect(skillLabel('easy', 'japan')).toBe('Green');
    expect(skillLabel('intermediate', 'japan')).toBe('Red');
    expect(skillLabel('advanced', 'japan')).toBe('Black');
    expect(skillLabel('freeride', 'japan')).toBe('Off-piste');
  });

  test('skillColor', () => {
    expect(skillColor('easy', 'europe')).toBe(BLUE);
    expect(skillColor('easy', 'north_america')).toBe(GREEN);
    expect(skillColor('intermediate', 'north_america')).toBe(BLUE);
    expect(skillColor('intermediate', 'japan')).toBe(RED);
    expect(skillColor('advanced', 'europe')).toBe(BLACK);
    expect(skillColor('freeride', 'europe')).toBe(OFF_PISTE_COLOR);
    expect(skillColor('none', 'europe')).toBe(UNKNOWN_PISTE_COLOR);
  });

  test('alle niveauer i routing.js har et navn og en farve i alle lande', () => {
    for (const level of skillLevels) {
      for (const convention of ['europe', 'north_america', 'japan']) {
        expect(skillLabel(level.id, convention)).toEqual(expect.any(String));
        expect(skillLabel(level.id, convention)).not.toBe('Unclassified');
        expect(skillColor(level.id, convention)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe('liftTypeLabels', () => {
  test('alle lifttyper fra rutefindingen har et engelsk navn', () => {
    for (const type of [
      'gondola',
      'cable_car',
      'mixed_lift',
      'chair_lift',
      'platter',
      'drag_lift',
      'rope_tow',
      'magic_carpet',
    ]) {
      expect(liftTypeLabels[type]).toEqual(expect.any(String));
    }
    expect(liftTypeLabels.unknown).toBe('Lift');
  });
});
