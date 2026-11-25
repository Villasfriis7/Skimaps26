import {
  distanceMeters,
  lineLengthMeters,
  formatDistance,
  formatDuration,
  regionForCoordinates,
} from '../utils/geo';

const pt = (latitude, longitude) => ({ latitude, longitude });

describe('distanceMeters', () => {
  test('samme punkt er 0 m', () => {
    expect(distanceMeters(pt(46.1, 7.2), pt(46.1, 7.2))).toBe(0);
  });

  test('én breddegrad er ca. 111,2 km', () => {
    expect(distanceMeters(pt(46, 7), pt(47, 7))).toBeCloseTo(111195, -1);
  });

  test('en længdegrad er kortere, jo længere mod nord man er', () => {
    const equator = distanceMeters(pt(0, 7), pt(0, 8));
    const alps = distanceMeters(pt(46, 7), pt(46, 8));
    const lapland = distanceMeters(pt(68, 7), pt(68, 8));
    expect(equator).toBeCloseTo(111195, -1);
    expect(alps / equator).toBeCloseTo(Math.cos((46 * Math.PI) / 180), 3);
    expect(lapland).toBeLessThan(alps);
  });

  test('afstanden er den samme begge veje', () => {
    const a = pt(46.0961, 7.2286);
    const b = pt(46.0867, 7.2364);
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  test('virker også på den sydlige halvkugle og hen over datolinjen', () => {
    // Skiområder findes også i New Zealand og Chile.
    expect(distanceMeters(pt(-45, 168), pt(-45.001, 168))).toBeCloseTo(111.2, 0);
    expect(distanceMeters(pt(0, 179.9995), pt(0, -179.9995))).toBeCloseTo(111.2, 0);
  });
});

describe('lineLengthMeters', () => {
  test('summen af stykkerne', () => {
    const line = [pt(46, 7), pt(46.001, 7), pt(46.002, 7)];
    expect(lineLengthMeters(line)).toBeCloseTo(2 * distanceMeters(line[0], line[1]), 6);
  });

  test('tom linje og enkelt punkt har længden 0', () => {
    expect(lineLengthMeters([])).toBe(0);
    expect(lineLengthMeters([pt(46, 7)])).toBe(0);
  });
});

describe('formatDistance', () => {
  test.each([
    [0, '10 m'], // aldrig "0 m" - det ser forkert ud
    [14, '10 m'],
    [15, '20 m'],
    [349, '350 m'],
    [944, '940 m'],
    [949, '950 m'],
    [960, '1.0 km'],
    [1240, '1.2 km'],
    [15999, '16.0 km'],
    [100000, '100 km'],
    [1240000, '1,240 km'],
  ])('%d m -> "%s"', (meters, text) => {
    expect(formatDistance(meters)).toBe(text);
  });
});

describe('formatDuration', () => {
  test.each([
    [0, '1 min'], // aldrig "0 min"
    [29, '1 min'],
    [89, '1 min'],
    [90, '2 min'],
    [956, '16 min'],
    [3569, '59 min'],
    [3570, '1 h'],
    [3600, '1 h'],
    [5100, '1 h 25 min'],
    [7200, '2 h'],
  ])('%d s -> "%s"', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('regionForCoordinates', () => {
  test('midtpunkt og udstrækning med luft omkring', () => {
    const region = regionForCoordinates([pt(46.0, 7.0), pt(46.1, 7.2), pt(46.05, 7.1)]);
    expect(region.latitude).toBeCloseTo(46.05, 6);
    expect(region.longitude).toBeCloseTo(7.1, 6);
    expect(region.latitudeDelta).toBeCloseTo(0.1 * 1.4, 6);
    expect(region.longitudeDelta).toBeCloseTo(0.2 * 1.4, 6);
  });

  test('luften kan vælges', () => {
    const region = regionForCoordinates([pt(46.0, 7.0), pt(46.1, 7.2)], 2);
    expect(region.latitudeDelta).toBeCloseTo(0.2, 6);
    expect(region.longitudeDelta).toBeCloseTo(0.4, 6);
  });

  test('et enkelt punkt giver et lille, men ikke uendeligt lille udsnit', () => {
    // Uden en nedre grænse ville kortet zoome helt ind til ingenting.
    const region = regionForCoordinates([pt(46.0, 7.0)]);
    expect(region).toEqual({ latitude: 46.0, longitude: 7.0, latitudeDelta: 0.006, longitudeDelta: 0.006 });
  });
});
