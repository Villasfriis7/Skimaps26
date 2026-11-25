import { describeStep, routeProgress, ON_ROUTE_M } from '../utils/routeSteps';

// "Now / Then" på kortets rutekort: hvor på ruten står brugeren?

const pt = (latitude, longitude) => ({ latitude, longitude });

// En rute mod nord i tre trin: lift (1,1 km), pist (1,1 km), gåtur (110 m).
const route = {
  destination: pt(46.021, 7.0),
  totalSeconds: 600 + 300 + 100,
  steps: [
    { kind: 'lift', id: 'l1', name: 'Gondola', liftType: 'gondola', seconds: 600, meters: 1100, coordinates: [pt(46.0, 7.0), pt(46.01, 7.0)] },
    { kind: 'piste', id: 'p1', name: 'Blue Run', difficulty: 'easy', seconds: 300, meters: 1100, coordinates: [pt(46.01, 7.0), pt(46.015, 7.0), pt(46.02, 7.0)] },
    { kind: 'walk', seconds: 100, meters: 110, coordinates: [pt(46.02, 7.0), pt(46.021, 7.0)] },
  ],
};

describe('routeProgress', () => {
  test('uden position: første trin og hele rutens tid', () => {
    expect(routeProgress(route, null)).toEqual({
      index: 0,
      onRoute: false,
      arrived: false,
      remainingSeconds: 1000,
      offBy: null,
    });
  });

  test('halvvejs oppe i liften: resten af liften plus de næste trin', () => {
    const progress = routeProgress(route, pt(46.005, 7.0));
    expect(progress).toMatchObject({ index: 0, onRoute: true, arrived: false });
    expect(progress.remainingSeconds).toBeCloseTo(300 + 300 + 100, 0);
  });

  test('på pisten: trin to, og tiden tæller kun det, der er tilbage', () => {
    const progress = routeProgress(route, pt(46.0175, 7.0003));
    expect(progress.index).toBe(1);
    expect(progress.onRoute).toBe(true);
    expect(progress.remainingSeconds).toBeCloseTo(75 + 100, 0);
    expect(progress.offBy).toBeLessThan(40);
  });

  test('langt fra ruten: ikke på ruten, og første trin vises', () => {
    // Ca. 380 m øst for liften.
    const progress = routeProgress(route, pt(46.005, 7.005));
    expect(progress.onRoute).toBe(false);
    expect(progress.index).toBe(0);
    expect(progress.remainingSeconds).toBe(1000);
    expect(progress.offBy).toBeGreaterThan(ON_ROUTE_M);
  });

  test('ved målet: fremme', () => {
    expect(routeProgress(route, pt(46.0211, 7.0))).toMatchObject({ arrived: true, onRoute: true, remainingSeconds: 0 });
  });

  test('to trin oven i hinanden: visningen bliver på det trin, den stod på', () => {
    // En pist lige under liften. Står man midt imellem, afgør det forrige trin.
    const under = {
      ...route,
      steps: [
        route.steps[0],
        { ...route.steps[1], coordinates: [pt(46.01, 7.0001), pt(46.0, 7.0001)] },
      ],
    };
    const between = pt(46.005, 7.00005);
    expect(routeProgress(under, between, 0).index).toBe(0);
    expect(routeProgress(under, between, 1).index).toBe(1);
  });

  test('en rute uden trin giver ikke en fejl', () => {
    expect(routeProgress({ steps: [], totalSeconds: 0, destination: pt(46, 7) }, pt(46.5, 7))).toMatchObject({
      index: 0,
      onRoute: false,
    });
  });
});

describe('describeStep', () => {
  test('lift op og ned, med højder når de kendes', () => {
    const lift = route.steps[0];
    expect(describeStep(lift, 'europe')).toMatchObject({ title: 'Take Gondola', subtitle: 'Gondola · 1.1 km' });
    expect(describeStep(lift, 'europe', { l1: [1531, 2200] }).subtitle).toBe('Gondola · 1,531 → 2,200 m');
    const down = describeStep({ ...lift, down: true }, 'europe', { l1: [1531, 2200] });
    expect(down).toMatchObject({ title: 'Ride Gondola down', subtitle: 'Gondola · 2,200 → 1,531 m', icon: 'arrow-down-circle' });
    // En lift sat sammen af to stykker har ikke ét sæt højder.
    expect(describeStep({ ...lift, joined: true }, 'europe', { l1: [1531, 2200] }).subtitle).toBe('Gondola · 1.1 km');
  });

  test('pist med og uden navn - farven følger landet', () => {
    const piste = route.steps[1];
    expect(describeStep(piste, 'europe')).toMatchObject({ title: 'Ski Blue Run', subtitle: 'Blue (easy) · 1.1 km' });
    const unnamed = describeStep({ ...piste, name: null, difficulty: 'intermediate' }, 'europe');
    expect(unnamed.title).toBe('Ski a red piste');
    expect(unnamed.subtitle).toBe('Red (intermediate) · 1.1 km · no name on the map');
    expect(describeStep({ ...piste, name: null, difficulty: 'intermediate' }, 'north_america').title).toBe('Ski a blue piste');
    expect(describeStep({ ...piste, name: null, difficulty: 'freeride' }, 'europe').title).toBe('Ski an off-piste section');
  });

  test('gåtur', () => {
    expect(describeStep(route.steps[2], 'europe')).toMatchObject({ title: 'Walk 110 m', subtitle: 'On foot', color: null });
  });
});
