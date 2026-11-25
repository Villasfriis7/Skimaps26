import { defaultStart, easiestWay, reachText } from '../utils/reach';
import { buildModel } from '../utils/resortModel';
import { verbier } from '../data/resorts/verbier';
import { miniResort, pt, V, T, M } from './helpers/miniResort';

// "Kan jeg komme derhen?" - teksten på detaljesiden og startpunktet for ruter.

describe('defaultStart', () => {
  const model = buildModel(miniResort({ id: 'mini-reach' }));

  test('uden position: bunden af hovedliften', () => {
    expect(defaultStart(model, null)).toEqual({ point: V, label: 'Village Gondola lift', fromLocation: false });
    expect(defaultStart(model, undefined).fromLocation).toBe(false);
  });

  test('egen position, når den ligger i skiområdet', () => {
    const onPiste = pt(46.0121, 7.0041);
    expect(defaultStart(model, onPiste)).toEqual({ point: onPiste, label: 'your location', fromLocation: true });
  });

  test('sidder brugeren hjemme i København, starter ruten ved hovedliften', () => {
    const copenhagen = pt(55.676, 12.568);
    expect(defaultStart(model, copenhagen)).toEqual({ point: V, label: 'Village Gondola lift', fromLocation: false });
  });

  test('Verbier starter ved Médran', () => {
    const start = defaultStart(buildModel(verbier), null);
    expect(start.label).toBe('Médran 2 lift');
    expect(start.fromLocation).toBe(false);
  });
});

describe('easiestWay', () => {
  const model = buildModel(miniResort({ id: 'mini-reach' }));

  test('prøver "uden ski" først', () => {
    // Toppen kan nås med gondolen alene.
    const way = easiestWay(model, V, T);
    expect(way.level.id).toBe('none');
    expect(way.route.steps.map((step) => step.kind)).toEqual(['lift']);
  });

  test('finder det letteste niveau, der kan nå frem', () => {
    // Bagsiden kræver den røde pist.
    const way = easiestWay(model, V, M);
    expect(way.level).toMatchObject({ id: 'intermediate', label: 'Red' });
    expect(way.route.steps.map((step) => step.name)).toEqual(['Village Gondola', 'Back Bowl']);
    // Hjem igen kan klares på blå.
    expect(easiestWay(model, M, V).level.id).toBe('easy');
  });

  test('et mål uden for skiområdet giver null', () => {
    expect(easiestWay(model, V, pt(55.676, 12.568))).toBeNull();
  });

  test('ingen vej på noget niveau giver null', () => {
    // Uden lifter kan man ikke komme op til toppen.
    const noLifts = buildModel(miniResort({ id: 'mini-no-lifts', lifts: [] }));
    expect(easiestWay(noLifts, V, T)).toBeNull();
  });

  test('bruger landets regler: dobbelt sort i Nordamerika er kun for øverste niveau', () => {
    const pistes = [{ id: 'dd', name: 'Couloir', difficulty: 'expert', coordinates: [T, M] }];
    const lifts = [{ id: 'gondola', name: 'Village Gondola', liftType: 'gondola', coordinates: [V, T] }];
    const elevations = { gondola: [1500, 2200], dd: [2200, 1800] };
    const europe = buildModel(miniResort({ id: 'mini-eu', lifts, pistes, elevations }));
    const canada = buildModel(miniResort({ id: 'mini-ca', lifts, pistes, elevations, convention: 'north_america' }));
    expect(easiestWay(europe, V, M).level.id).toBe('advanced');
    expect(easiestWay(canada, V, M).level.id).toBe('freeride');
  });
});

describe('reachText', () => {
  const route = (seconds, steps = [{ kind: 'walk' }]) => ({ steps, totalSeconds: seconds });
  const way = (id, seconds) => ({ level: { id }, route: route(seconds) });

  test('uden ski', () => {
    expect(reachText(way('none', 1627), 'Médran 2 lift', 'europe')).toBe('27 min without skis from Médran 2 lift');
  });

  test('blå pister - farven følger landet', () => {
    expect(reachText(way('easy', 960), 'Médran 2 lift', 'europe')).toBe('16 min on blue pistes from Médran 2 lift');
    expect(reachText(way('easy', 960), 'your location', 'north_america')).toBe(
      '16 min on green pistes from your location'
    );
    expect(reachText(way('easy', 960), 'Ace Family Quad #1 lift', 'japan')).toBe(
      '16 min on green pistes from Ace Family Quad #1 lift'
    );
  });

  test('rød og sort: "Needs a ... piste"', () => {
    expect(reachText(way('intermediate', 956), 'Médran 2 lift', 'europe')).toBe(
      'Needs a red piste · 16 min from Médran 2 lift'
    );
    expect(reachText(way('intermediate', 956), 'your location', 'north_america')).toBe(
      'Needs a blue piste · 16 min from your location'
    );
    expect(reachText(way('advanced', 5100), 'Médran 2 lift', 'europe')).toBe(
      'Needs a black piste · 1 h 25 min from Médran 2 lift'
    );
  });

  test('off-piste', () => {
    expect(reachText(way('freeride', 2228), 'Médran 2 lift', 'europe')).toBe(
      'Only by an off-piste route · 37 min from Médran 2 lift'
    );
  });

  test('ingen vej, eller allerede fremme (rute uden trin), giver ingen tekst', () => {
    expect(reachText(null, 'Médran 2 lift', 'europe')).toBeNull();
    expect(reachText({ level: { id: 'none' }, route: route(0, []) }, 'Médran 2 lift', 'europe')).toBeNull();
  });

  test('hele vejen i Verbier: teksterne for de fem udvalgte steder', () => {
    const model = buildModel(verbier);
    const start = defaultStart(model, null);
    const text = (id) => reachText(easiestWay(model, start.point, model.findPlace(id)), start.label, model.convention);
    expect(text('1')).toMatch(/^\d+ min without skis from Médran 2 lift$/); // Le Rouge
    expect(text('2')).toBe('Needs a red piste · 16 min from Médran 2 lift'); // Chez Dany
    expect(text('3')).toMatch(/^\d+ min on blue pistes from Médran 2 lift$/); // Le Carrefour
    expect(text('4')).toMatch(/^Needs a red piste · \d+ min from Médran 2 lift$/); // Cabane Mont Fort
    expect(text('5')).toMatch(/^\d+ min without skis from Médran 2 lift$/); // Le Dahu
  });
});
