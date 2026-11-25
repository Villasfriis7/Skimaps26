import { buildPisteGroups, groupCoordinates } from '../utils/pisteGroups';
import { lineLengthMeters } from '../utils/geo';
import { verbier } from '../data/resorts/verbier';

const pt = (latitude, longitude) => ({ latitude, longitude });
const piste = (id, name, difficulty, coordinates, extra = {}) => ({ id, name, difficulty, coordinates, ...extra });

// 0,001 breddegrad er ca. 111 m. Stykker hænger sammen, når en ende ligger
// højst 80 m fra et punkt på det andet stykke.
describe('buildPisteGroups', () => {
  test('stykker med samme navn og farve, der hænger sammen, bliver til én pist', () => {
    const upper = piste('a', 'Combe', 'intermediate', [pt(46.02, 7), pt(46.015, 7)]);
    const middle = piste('b', 'Combe', 'intermediate', [pt(46.015, 7), pt(46.01, 7)]);
    const lower = piste('c', 'Combe', 'intermediate', [pt(46.0095, 7), pt(46.005, 7)]); // 55 m hul
    const { groups, groupOf } = buildPisteGroups([upper, middle, lower]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: 'a', name: 'Combe', difficulty: 'intermediate', kind: 'downhill' });
    expect(groups[0].pistes.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
    expect(groups[0].meters).toBeCloseTo(
      lineLengthMeters(upper.coordinates) + lineLengthMeters(middle.coordinates) + lineLengthMeters(lower.coordinates),
      6
    );
    expect(groupOf('c')).toBe(groups[0]);
  });

  test('rækkefølgen af stykkerne er ligegyldig', () => {
    const upper = piste('a', 'Combe', 'intermediate', [pt(46.02, 7), pt(46.015, 7)]);
    const middle = piste('b', 'Combe', 'intermediate', [pt(46.015, 7), pt(46.01, 7)]);
    const lower = piste('c', 'Combe', 'intermediate', [pt(46.01, 7), pt(46.005, 7)]);
    // Øverste og nederste rører ikke hinanden - kun via det midterste, der kommer sidst.
    const { groups } = buildPisteGroups([upper, lower, middle]);
    expect(groups).toHaveLength(1);
    expect(groups[0].pistes).toHaveLength(3);
  });

  test('samme navn langt fra hinanden er to forskellige pister', () => {
    const here = piste('a', 'Moneyeu', 'easy', [pt(46.02, 7), pt(46.015, 7)]);
    const elsewhere = piste('b', 'Moneyeu', 'easy', [pt(46.02, 7.05), pt(46.015, 7.05)]);
    const { groups, groupOf } = buildPisteGroups([here, elsewhere]);
    expect(groups).toHaveLength(2);
    expect(groupOf('a')).not.toBe(groupOf('b'));
  });

  test('et stykke kan grene ud midt på et andet', () => {
    const main = piste('a', 'Attelas', 'intermediate', [pt(46.02, 7), pt(46.015, 7), pt(46.01, 7)]);
    const branch = piste('b', 'Attelas', 'intermediate', [pt(46.015, 7.0005), pt(46.012, 7.004)]);
    expect(buildPisteGroups([main, branch]).groups).toHaveLength(1);
  });

  test('samme navn, men forskellig farve, holdes adskilt', () => {
    const blue = piste('a', 'Les Ruinettes - La Chaux', 'easy', [pt(46.02, 7), pt(46.015, 7)]);
    const red = piste('b', 'Les Ruinettes - La Chaux', 'intermediate', [pt(46.015, 7), pt(46.01, 7)]);
    const { groups } = buildPisteGroups([blue, red]);
    expect(groups.map((g) => g.difficulty).sort()).toEqual(['easy', 'intermediate']);
  });

  test('stykker uden navn står alene, selvom de rører hinanden', () => {
    const a = piste('a', null, 'easy', [pt(46.02, 7), pt(46.015, 7)]);
    const b = piste('b', null, 'easy', [pt(46.015, 7), pt(46.01, 7)]);
    const { groups } = buildPisteGroups([a, b]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.name === null)).toBe(true);
  });

  test('en kælkebane er én bane, selvom stykkerne har hver sin sværhedsgrad', () => {
    const upper = piste('a', 'Rodelbahn', 'easy', [pt(46.02, 7), pt(46.015, 7)], { type: 'sled' });
    const lower = piste('b', 'Rodelbahn', 'novice', [pt(46.015, 7), pt(46.01, 7)], { type: 'sled' });
    const { groups } = buildPisteGroups([upper, lower]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('sled');
  });

  test('en pist og en skitur-rute med samme navn blandes ikke', () => {
    const run = piste('a', 'Col', 'intermediate', [pt(46.02, 7), pt(46.015, 7)], { type: 'downhill' });
    const tour = piste('b', 'Col', 'intermediate', [pt(46.015, 7), pt(46.02, 7)], { type: 'skitour' });
    const { groups } = buildPisteGroups([run, tour]);
    expect(groups.map((g) => g.kind).sort()).toEqual(['downhill', 'skitour']);
  });

  test('skitur-rutens navn ryddes op, og en rute uden andet navn beholder det', () => {
    const tagged = piste('a', 'skitour: Arolla - Verbier, Gentianes - La Chaux', 'intermediate', [
      pt(46.02, 7),
      pt(46.015, 7),
    ]);
    const tour = piste('b', 'skitour: Arolla - Verbier, randonnée à ski: Arolla - Verbier', 'unknown', [
      pt(46.03, 7.1),
      pt(46.04, 7.1),
    ]);
    const { groupOf } = buildPisteGroups([tagged, tour]);
    expect(groupOf('a').name).toBe('Gentianes - La Chaux');
    expect(groupOf('b')).toMatchObject({ name: 'Arolla - Verbier', kind: 'skitour' });
  });

  test('top og bund kommer fra højderne for alle stykkerne', () => {
    const upper = piste('a', 'Combe', 'intermediate', [pt(46.02, 7), pt(46.015, 7)]);
    const lower = piste('b', 'Combe', 'intermediate', [pt(46.015, 7), pt(46.01, 7)]);
    const { groups } = buildPisteGroups([upper, lower], { a: [2200, 1900], b: [1900, 1650] });
    expect(groups[0]).toMatchObject({ top: 2200, bottom: 1650 });
  });

  test('uden højder er top og bund ukendte', () => {
    const { groups } = buildPisteGroups([piste('a', 'Combe', 'easy', [pt(46.02, 7), pt(46.015, 7)])]);
    expect(groups[0].top).toBeUndefined();
    expect(groups[0].bottom).toBeUndefined();
  });

  test('groupOf giver null for en pist, der ikke findes', () => {
    expect(buildPisteGroups([]).groupOf('missing')).toBeNull();
    expect(buildPisteGroups([]).groups).toEqual([]);
  });

  test('groupCoordinates samler alle punkter i gruppen', () => {
    const upper = piste('a', 'Combe', 'intermediate', [pt(46.02, 7), pt(46.015, 7)]);
    const lower = piste('b', 'Combe', 'intermediate', [pt(46.015, 7), pt(46.01, 7)]);
    const { groups } = buildPisteGroups([upper, lower]);
    expect(groupCoordinates(groups[0])).toHaveLength(4);
  });
});

describe('buildPisteGroups på Verbiers rigtige data', () => {
  const { groups, groupOf } = buildPisteGroups(verbier.pistes, verbier.elevations);

  test('hvert stykke hører til præcis én gruppe', () => {
    const seen = new Map();
    for (const group of groups) {
      for (const member of group.pistes) {
        expect(seen.has(member.id)).toBe(false);
        seen.set(member.id, group);
      }
    }
    expect(seen.size).toBe(verbier.pistes.length);
    for (const member of verbier.pistes) expect(groupOf(member.id)).toBe(seen.get(member.id));
  });

  test('OpenStreetMaps mange små stykker er samlet til færre, hele pister', () => {
    expect(groups.length).toBeLessThan(verbier.pistes.length);
    // "Gentianes - La Chaux" er README'ens eksempel på en pist i mange stykker.
    const gentianes = groups.filter((g) => g.name === 'Gentianes - La Chaux' && g.difficulty === 'intermediate');
    expect(gentianes).toHaveLength(1);
    expect(gentianes[0].pistes.length).toBeGreaterThan(5);
    expect(gentianes[0].meters).toBeGreaterThan(3000);
  });

  test('den samlede længde er den samme før og efter', () => {
    const before = verbier.pistes.reduce((sum, p) => sum + lineLengthMeters(p.coordinates), 0);
    const after = groups.reduce((sum, g) => sum + g.meters, 0);
    expect(after).toBeCloseTo(before, 3);
  });

  test('toppen ligger aldrig under bunden', () => {
    for (const group of groups) {
      if (group.top !== undefined) expect(group.top).toBeGreaterThanOrEqual(group.bottom);
    }
  });
});
