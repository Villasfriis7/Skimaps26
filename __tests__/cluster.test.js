import { clusterPoints, spreadMeters } from '../utils/cluster';

// Et udsnit på størrelse med en by set på en telefon: højere end det er bredt.
const region = { latitude: 46.1, longitude: 7.23, latitudeDelta: 0.024, longitudeDelta: 0.014 };

const point = (id, latitude, longitude) => ({ id, latitude, longitude });

// To steder oven i hinanden og ét et helt andet sted i udsnittet.
const hotelA = point('hotel-a', 46.1, 7.23);
const hotelB = point('hotel-b', 46.1, 7.23);
const hut = point('hut', 46.108, 7.235);

// To naboer ca. 70 m fra hinanden. Med udsnittet ovenfor er felterne ca.
// 0.002 grader på hver led, og de to ligger i samme felt.
const neighbours = [point('a', 46.1, 7.23), point('b', 46.1006, 7.2302)];

const total = (clusters) => clusters.reduce((sum, cluster) => sum + cluster.count, 0);

describe('clusterPoints', () => {
  test('et sted, der står alene, kommer tilbage som sig selv med count 1', () => {
    const result = clusterPoints([hut], region);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 'hut', latitude: 46.108, longitude: 7.235, count: 1, points: [hut] });
  });

  test('steder i samme felt bliver til én klynge, resten står alene', () => {
    const result = clusterPoints([hotelA, hut, hotelB], region);
    expect(result).toHaveLength(2);
    const cluster = result.find((item) => item.count > 1);
    expect(cluster.count).toBe(2);
    expect(cluster.points).toEqual([hotelA, hotelB]);
    expect(result.find((item) => item.count === 1).id).toBe('hut');
  });

  test('en klynge står i gennemsnittet af sine steder', () => {
    const a = point('a', 46.1, 7.23);
    const b = point('b', 46.10004, 7.23002);
    const result = clusterPoints([a, b], region);
    expect(result).toHaveLength(1);
    expect(result[0].latitude).toBeCloseTo(46.10002, 8);
    expect(result[0].longitude).toBeCloseTo(7.23001, 8);
  });

  test('id er det samme for de samme steder og skifter, når antallet gør', () => {
    const two = clusterPoints([hotelA, hotelB], region);
    const twoAgain = clusterPoints([hotelA, hotelB], region);
    const three = clusterPoints([hotelA, hotelB, point('hotel-c', 46.1, 7.23)], region);
    expect(two[0].id).toBe('cluster-hotel-a-2');
    expect(twoAgain[0].id).toBe(two[0].id);
    expect(three[0].id).toBe('cluster-hotel-a-3');
  });

  test('alle steder tælles præcis én gang, og alle id er forskellige', () => {
    // 600 steder spredt jævnt ud over udsnittet.
    const points = [];
    for (let i = 0; i < 600; i++) {
      points.push(
        point(
          `p${i}`,
          region.latitude + ((i % 30) / 30 - 0.5) * region.latitudeDelta * 0.9,
          region.longitude + (Math.floor(i / 30) / 20 - 0.5) * region.longitudeDelta * 0.9
        )
      );
    }
    const result = clusterPoints(points, region);
    expect(total(result)).toBe(600);
    expect(new Set(result.map((item) => item.id)).size).toBe(result.length);
    expect(new Set(result.flatMap((item) => item.points)).size).toBe(600);
    expect(result.length).toBeLessThan(600);
    for (const item of result) expect(item.count).toBe(item.points.length);
  });

  test('zoomer man ind, skilles en klynge ad', () => {
    const [a, b] = neighbours;
    const zoomedIn = { ...region, latitudeDelta: 0.003, longitudeDelta: 0.002 };
    expect(clusterPoints([a, b], region)).toHaveLength(1);
    expect(clusterPoints([a, b], zoomedIn)).toHaveLength(2);
  });

  test('rows og columns styrer, hvor fint gitteret er', () => {
    const [a, b] = neighbours;
    expect(clusterPoints([a, b], region)).toHaveLength(1);
    expect(clusterPoints([a, b], region, { rows: 200, columns: 200 })).toHaveLength(2);
  });

  test('steder langt uden for udsnittet udelades, alt synligt er med', () => {
    const farAway = point('far', 47.5, 9.1);
    const corner = point('corner', region.latitude + region.latitudeDelta / 2, region.longitude - region.longitudeDelta / 2);
    const result = clusterPoints([hut, farAway, corner], region);
    expect(result.map((item) => item.id).sort()).toEqual(['corner', 'hut']);
  });

  test('klyngerne ændrer sig ikke, når kortet flyttes en smule', () => {
    const points = [hotelA, hotelB, hut, point('bar', 46.1041, 7.2262), point('cafe', 46.1042, 7.2263)];
    const moved = { ...region, latitude: region.latitude + 0.0013, longitude: region.longitude - 0.0009 };
    expect(clusterPoints(points, moved)).toEqual(clusterPoints(points, region));
  });

  test('et udsnit uden udstrækning giver ingen klynger', () => {
    const flat = { ...region, latitudeDelta: 0, longitudeDelta: 0 };
    const result = clusterPoints([hotelA, hotelB], flat);
    expect(result).toHaveLength(2);
    expect(result.every((item) => item.count === 1)).toBe(true);
  });

  test('ingen steder giver en tom liste', () => {
    expect(clusterPoints([], region)).toEqual([]);
  });
});

describe('spreadMeters', () => {
  test('er 0 for steder oven i hinanden', () => {
    expect(spreadMeters([hotelA, hotelB])).toBe(0);
    expect(spreadMeters([])).toBe(0);
  });

  test('måler afstanden på tværs af stederne', () => {
    // 0.001 breddegrad er ca. 111 m.
    const meters = spreadMeters([point('a', 46.1, 7.23), point('b', 46.101, 7.23), point('c', 46.1005, 7.23)]);
    expect(meters).toBeGreaterThan(105);
    expect(meters).toBeLessThan(117);
  });
});
