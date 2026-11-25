import { buildGraph, findRoute, isOnNetwork, skillLevels } from '../utils/routing';
import { distanceMeters, lineLengthMeters } from '../utils/geo';
import { network, pt, V, T, M, gondola, chair, blueUpper, blueLower, black, red, elevations } from './helpers/miniResort';

// Rutefinding i det lille, opdigtede skiområde fra helpers/miniResort.js (se
// tegningen dér). De rigtige skiområder testes i routing.resorts.test.js.

// Tallene fra utils/routing.js, skrevet af her med vilje: ændrer nogen en
// fart eller et tillæg, skal testen opdage det.
const LIFT_OVERHEAD_S = 240;
const GONDOLA_SPEED = 5;
const CHAIR_SPEED = 4;
const BLUE_SPEED = 6;
const RED_SPEED = 7;
const WALK_SPEED = 1.1;
const WALK_DETOUR = 1.3;
const walkSeconds = (meters) => (meters * WALK_DETOUR) / WALK_SPEED;

const kinds = (route) => route.steps.map((step) => `${step.kind}:${step.name || ''}`);
const route = (graph, from, to, skill, convention) => findRoute(graph, from, to, { skill, convention });

describe('skillLevels', () => {
  test('fem niveauer fra "uden ski" til off-piste, og hvert niveau må alt det, de lettere må', () => {
    expect(skillLevels.map((level) => level.id)).toEqual(['none', 'easy', 'intermediate', 'advanced', 'freeride']);
    expect(skillLevels.map((level) => level.label)).toEqual(['No skis', 'Blue', 'Red', 'Black', 'Off-piste']);
    for (let i = 1; i < skillLevels.length; i++) {
      expect(skillLevels[i].allowed).toEqual(expect.arrayContaining(skillLevels[i - 1].allowed));
    }
  });

  test('hvilke pister hvert niveau må køre', () => {
    const allowed = Object.fromEntries(skillLevels.map((level) => [level.id, [...level.allowed].sort()]));
    expect(allowed).toEqual({
      none: [],
      easy: ['easy', 'novice'],
      intermediate: ['easy', 'intermediate', 'novice'],
      advanced: ['advanced', 'easy', 'expert', 'intermediate', 'novice'],
      freeride: ['advanced', 'easy', 'expert', 'extreme', 'freeride', 'intermediate', 'novice'],
    });
    // Kun "uden ski" er begrænset til lukkede kabiner.
    expect(skillLevels.filter((level) => level.cabinsOnly).map((level) => level.id)).toEqual(['none']);
  });
});

describe('findRoute i det lille skiområde', () => {
  const graph = buildGraph(network());

  test('op med gondolen: tid = fast tillæg + længde / fart', () => {
    const result = route(graph, V, T, 'easy');
    const meters = distanceMeters(V, T);
    expect(kinds(result)).toEqual(['lift:Village Gondola']);
    expect(result.steps[0]).toMatchObject({ kind: 'lift', id: 'gondola', liftType: 'gondola' });
    expect(result.steps[0].down).toBeUndefined();
    expect(result.totalSeconds).toBeCloseTo(LIFT_OVERHEAD_S + meters / GONDOLA_SPEED, 6);
    expect(result.totalMeters).toBeCloseTo(meters, 6);
  });

  test('rød pist kræver niveauet "Red": gondol op og rød ned ad bagsiden', () => {
    expect(route(graph, V, M, 'none')).toBeNull();
    expect(route(graph, V, M, 'easy')).toBeNull();
    const result = route(graph, V, M, 'intermediate');
    expect(kinds(result)).toEqual(['lift:Village Gondola', 'piste:Back Bowl']);
    expect(result.steps[1]).toMatchObject({ kind: 'piste', id: 'red', difficulty: 'intermediate' });
    expect(result.totalSeconds).toBeCloseTo(
      LIFT_OVERHEAD_S + distanceMeters(V, T) / GONDOLA_SPEED + lineLengthMeters(red.coordinates) / RED_SPEED,
      6
    );
  });

  test('pister kan kun køres nedad', () => {
    // Uden lifter er der ingen vej op - heller ikke ad pisten.
    const noLifts = buildGraph(network({ lifts: [] }));
    expect(route(noLifts, V, T, 'freeride')).toBeNull();
    expect(route(noLifts, T, V, 'easy')).not.toBeNull();
  });

  test('en stolelift kan kun tages op - og bunden er den laveste ende, uanset tegneretning', () => {
    // "Back Chair" er tegnet fra top (T) til bund (M); højderne vender den.
    const up = route(graph, M, T, 'easy');
    expect(kinds(up)).toEqual(['lift:Back Chair']);
    expect(up.steps[0].coordinates).toEqual([M, T]);
    expect(up.totalSeconds).toBeCloseTo(LIFT_OVERHEAD_S + distanceMeters(M, T) / CHAIR_SPEED, 6);
    // Ned ad bagsiden med stoleliften går ikke: uden ski er der ingen vej.
    expect(route(graph, V, M, 'none')).toBeNull();
  });

  test('uden højder bruges tegneretningen', () => {
    const drawn = buildGraph(network({ elevations: {} }));
    // Nu er T "bunden" af stoleliften, fordi den er tegnet T -> M.
    expect(kinds(route(drawn, T, M, 'easy'))).toEqual(['lift:Back Chair']);
    // ... og den anden vej (M -> T) kan liften ikke længere tages.
    const back = route(drawn, M, T, 'easy');
    expect(back.steps.some((step) => step.kind === 'lift')).toBe(false);
  });

  // OVERRASKENDE, MEN SÅDAN VIRKER DET I DAG: start og mål må hver ligge op
  // til 600 m fra netværket, og begge "gåture" må gå til den SAMME knude. To
  // punkter med en fælles knude inden for 600 m forbindes derfor altid af en
  // gåtur på op til 2 x 600 m i fugleflugt - uden hensyn til højdeforskel.
  // Her foreslår appen at gå 1,5 km og 400 højdemeter op ad den røde pist fra
  // M til T, fordi stoleliften ikke må tages uden ski. Testen står her, så en
  // ændring af den opførsel bliver et bevidst valg.
  test('uden ski kan en rute være en ren gåtur op ad bjerget via en pist-knude', () => {
    const result = route(graph, M, T, 'none');
    const bend = red.coordinates[1];
    expect(kinds(result)).toEqual(['walk:']);
    expect(result.steps[0].coordinates).toEqual([M, bend, T]);
    expect(result.totalMeters).toBeCloseTo((distanceMeters(M, bend) + distanceMeters(bend, T)) * WALK_DETOUR, 6);
    expect(result.totalMeters).toBeGreaterThan(1400);
    expect(elevations.chair[0] - elevations.chair[1]).toBe(400); // T ligger 400 m over M
  });

  test('en gondol kan også tages ned - og er den eneste vej uden ski', () => {
    const down = route(graph, T, V, 'none');
    expect(kinds(down)).toEqual(['lift:Village Gondola']);
    expect(down.steps[0]).toMatchObject({ kind: 'lift', id: 'gondola', down: true });
    expect(down.steps[0].coordinates).toEqual([T, V]);
  });

  test('hjem fra bagsiden på blå: stolelift op og den blå ned som ét trin', () => {
    const result = route(graph, M, V, 'easy');
    expect(kinds(result)).toEqual(['lift:Back Chair', 'piste:Home Run']);
    // OpenStreetMaps to stykker er slået sammen til ét trin.
    const home = result.steps[1];
    expect(home.meters).toBeCloseTo(
      lineLengthMeters(blueUpper.coordinates) + lineLengthMeters(blueLower.coordinates),
      6
    );
    expect(home.seconds).toBeCloseTo(home.meters / BLUE_SPEED, 6);
    expect(home.coordinates).toEqual([T, pt(46.012, 7.004), V]);
    // Uden ski er man strandet på bagsiden.
    expect(route(graph, M, V, 'none')).toBeNull();
  });

  test('et højere niveau må tage den hurtigere, sværere pist', () => {
    expect(kinds(route(graph, T, V, 'easy'))).toEqual(['piste:Home Run']);
    expect(kinds(route(graph, T, V, 'intermediate'))).toEqual(['piste:Home Run']);
    expect(kinds(route(graph, T, V, 'advanced'))).toEqual(['piste:Direct']);
    expect(kinds(route(graph, T, V, 'freeride'))).toEqual(['piste:Direct']);
    expect(route(graph, T, V, 'advanced').totalSeconds).toBeLessThan(route(graph, T, V, 'easy').totalSeconds);
  });

  test('uden angivet niveau regnes der med "Red"', () => {
    expect(kinds(findRoute(graph, V, M))).toEqual(['lift:Village Gondola', 'piste:Back Bowl']);
    expect(kinds(findRoute(graph, T, V))).toEqual(['piste:Home Run']);
    // Et niveau, appen ikke kender (fx en gammel gemt værdi), giver også "Red".
    expect(kinds(route(graph, T, V, 'superhero'))).toEqual(['piste:Home Run']);
  });

  test('resultatet har trin med nøgle, tid, længde og koordinater - og en samlet linje til kortet', () => {
    const result = route(graph, V, M, 'intermediate');
    expect(result.steps.map((step) => step.key)).toEqual(['0-lift-gondola', '1-piste-red']);
    for (const step of result.steps) {
      expect(step.seconds).toBeGreaterThan(0);
      expect(step.meters).toBeGreaterThan(0);
      expect(step.coordinates.length).toBeGreaterThanOrEqual(2);
    }
    expect(result.totalSeconds).toBeCloseTo(result.steps[0].seconds + result.steps[1].seconds, 6);
    expect(result.totalMeters).toBeCloseTo(result.steps[0].meters + result.steps[1].meters, 6);
    expect(result.coordinates[0]).toEqual(V);
    expect(result.coordinates[result.coordinates.length - 1]).toEqual(M);
  });
});

describe('start og mål uden for netværket', () => {
  const graph = buildGraph(network());

  test('isOnNetwork: højst 600 m fra en lift eller pist', () => {
    expect(isOnNetwork(graph, V)).toBe(true);
    expect(isOnNetwork(graph, pt(45.995, 7.0))).toBe(true); // ca. 556 m syd for V
    expect(isOnNetwork(graph, pt(45.994, 7.0))).toBe(false); // ca. 667 m
    expect(isOnNetwork(graph, pt(55.676, 12.568))).toBe(false); // København
  });

  test('ingen rute fra eller til et punkt uden for netværket', () => {
    const copenhagen = pt(55.676, 12.568);
    expect(route(graph, copenhagen, T, 'freeride')).toBeNull();
    expect(route(graph, V, copenhagen, 'freeride')).toBeNull();
  });

  test('gåturen hen til netværket og fra netværket til målet tæller med', () => {
    const hotel = pt(45.999, 7.0); // ca. 111 m syd for gondolens bund
    const cafe = pt(46.0203, 7.0); // ca. 33 m nord for toppen
    const result = route(graph, hotel, cafe, 'none');
    const first = distanceMeters(hotel, V);
    const last = distanceMeters(T, cafe);
    expect(kinds(result)).toEqual(['walk:', 'lift:Village Gondola', 'walk:']);
    expect(result.steps[0].meters).toBeCloseTo(first * WALK_DETOUR, 6);
    expect(result.steps[0].seconds).toBeCloseTo(walkSeconds(first), 6);
    expect(result.steps[0].coordinates).toEqual([hotel, V]);
    expect(result.steps[2].coordinates).toEqual([T, cafe]);
    expect(result.totalSeconds).toBeCloseTo(
      walkSeconds(first) + LIFT_OVERHEAD_S + distanceMeters(V, T) / GONDOLA_SPEED + walkSeconds(last),
      6
    );
  });

  test('et sted inden for 600 m kan nås til fods, selvom ingen lift eller pist fører derhen', () => {
    // 400 m øst for landsbyen: ingen linjer, men tæt nok på til at gå.
    const chalet = pt(46.0, 7.0052);
    const result = route(graph, V, chalet, 'none');
    expect(kinds(result)).toEqual(['walk:']);
    expect(result.totalMeters).toBeCloseTo(distanceMeters(V, chalet) * WALK_DETOUR, 6);
  });

  test('start og mål samme sted: en rute uden trin', () => {
    // RouteScreen viser "You are already there", når steps er tom.
    expect(route(graph, V, V, 'easy')).toEqual({ steps: [], totalSeconds: 0, totalMeters: 0, coordinates: [], hardest: null });
  });

  // En celle i søge-gitteret er 0,001 længdegrad og dermed smallere mod nord (50 m i Åre).
  // Før blev et punkt 450-600 m øst eller vest for netværket regnet som "uden for skiområdet".
  test('isOnNetwork virker også 550 m øst og vest for en lift i Åre (63° N)', () => {
    const lift = { id: 'vm8', name: 'VM 8:an', liftType: 'chair_lift', coordinates: [pt(63.4, 13.08), pt(63.41, 13.08)] };
    const are = buildGraph({ lifts: [lift], pistes: [] });
    const metersPerDegree = distanceMeters(pt(63.4, 13), pt(63.4, 14));
    const east = pt(63.4, 13.08 + 550 / metersPerDegree);
    const west = pt(63.4, 13.08 - 550 / metersPerDegree);
    expect(distanceMeters(east, lift.coordinates[0])).toBeLessThan(600);
    expect(isOnNetwork(are, east)).toBe(true);
    expect(isOnNetwork(are, west)).toBe(true);
  });

  test('samme afstand virker i Alperne (46° N) og mod nord/syd i Åre', () => {
    const alps = buildGraph({ lifts: [{ ...gondola, coordinates: [pt(46, 7), pt(46.01, 7)] }], pistes: [] });
    const perDegreeAlps = distanceMeters(pt(46, 7), pt(46, 8));
    expect(isOnNetwork(alps, pt(46, 7 + 550 / perDegreeAlps))).toBe(true);
    expect(isOnNetwork(alps, pt(46, 7 - 550 / perDegreeAlps))).toBe(true);

    const are = buildGraph({
      lifts: [{ ...gondola, coordinates: [pt(63.4, 13.08), pt(63.41, 13.08)] }],
      pistes: [],
    });
    expect(isOnNetwork(are, pt(63.4 - 550 / 111195, 13.08))).toBe(true);
  });
});

describe('landets regler og pister uden sværhedsgrad', () => {
  test('Nordamerika: dobbelt sort ("expert") hører til det øverste niveau, ikke til "Black"', () => {
    const doubleBlack = { ...black, difficulty: 'expert' };
    // En lang blå udenom: langsommere end den dobbelt sorte, hurtigere end gondolen ned.
    const scenic = { id: 'scenic', name: 'Scenic', difficulty: 'easy', coordinates: [T, pt(46.01, 7.02), V] };
    const graph = buildGraph(
      network({ pistes: [scenic, doubleBlack], elevations: { ...elevations, scenic: [2200, 1500] } })
    );
    // I Europa er "expert" bare en sort pist.
    expect(kinds(route(graph, T, V, 'advanced', 'europe'))).toEqual(['piste:Direct']);
    expect(kinds(route(graph, T, V, 'advanced', 'japan'))).toEqual(['piste:Direct']);
    // I Nordamerika må "Black" ikke køre den ...
    expect(kinds(route(graph, T, V, 'advanced', 'north_america'))).toEqual(['piste:Scenic']);
    // ... men det må øverste niveau ("Double black").
    expect(kinds(route(graph, T, V, 'freeride', 'north_america'))).toEqual(['piste:Direct']);
  });

  test('Nordamerika: almindelig sort ("advanced") må stadig køres på "Black"', () => {
    const graph = buildGraph(network());
    expect(kinds(route(graph, T, V, 'advanced', 'north_america'))).toEqual(['piste:Direct']);
  });

  test('en hentet pist uden sværhedsgrad regnes som sort, men hedder stadig "unknown"', () => {
    const untagged = { ...black, type: 'downhill', difficulty: 'unknown' };
    const typed = [blueUpper, blueLower, red].map((piste) => ({ ...piste, type: 'downhill' }));
    const graph = buildGraph(network({ pistes: [...typed, untagged] }));
    expect(kinds(route(graph, T, V, 'intermediate'))).toEqual(['piste:Home Run']);
    const result = route(graph, T, V, 'advanced');
    expect(kinds(result)).toEqual(['piste:Direct']);
    expect(result.steps[0]).toMatchObject({ difficulty: 'unknown', routeAs: 'advanced' });
  });

  test('i Verbier-datasættet (uden type) er en linje uden sværhedsgrad slet ikke en pist', () => {
    const mystery = { ...black, difficulty: 'unknown' };
    const graph = buildGraph(network({ pistes: [blueUpper, blueLower, mystery, red] }));
    expect(kinds(route(graph, T, V, 'freeride'))).toEqual(['piste:Home Run']);
  });

  test('off-piste-ruter og ekstreme pister er kun for øverste niveau', () => {
    for (const difficulty of ['freeride', 'extreme']) {
      const itinerary = { ...black, difficulty };
      const graph = buildGraph(network({ pistes: [itinerary, red] }));
      // På "Black" er gondolen ned den eneste vej hjem ...
      const careful = route(graph, T, V, 'advanced');
      expect(kinds(careful)).toEqual(['lift:Village Gondola']);
      expect(careful.steps[0].down).toBe(true);
      // ... mens øverste niveau kører ruten.
      expect(kinds(route(graph, T, V, 'freeride'))).toEqual(['piste:Direct']);
    }
  });

  test('begynderpister ("novice") må køres af alle med ski', () => {
    const nursery = { ...black, difficulty: 'novice' };
    const graph = buildGraph(network({ pistes: [nursery] }));
    expect(kinds(route(graph, T, V, 'none'))).toEqual(['lift:Village Gondola']);
    expect(kinds(route(graph, T, V, 'easy'))).toEqual(['piste:Direct']);
  });

  test('kælkebaner og skitur-ruter indgår ikke i rutefindingen', () => {
    const straight = [T, V];
    const sled = { id: 'sled', name: 'Rodelbahn', type: 'sled', difficulty: 'easy', coordinates: straight };
    const luge = { id: 'luge', name: 'Piste de luge', difficulty: 'easy', coordinates: straight };
    const tour = { id: 'tour', name: 'Aufstieg', type: 'skitour', difficulty: 'easy', coordinates: straight };
    const graph = buildGraph(network({ lifts: [], pistes: [sled, luge, tour] }));
    expect(graph.nodes).toHaveLength(0);
    expect(route(graph, T, V, 'freeride')).toBeNull();
  });
});

describe('forbindelser mellem linjer', () => {
  test('to linjer, der ender højst 120 m fra hinanden, forbindes med et gå-stykke', () => {
    // En træklift, der starter ca. 83 m fra gondolens bund og går 865 m mod øst.
    const towBottom = pt(46.0005, 7.0008);
    const towTop = pt(46.0005, 7.012);
    const tow = { id: 'tow', name: 'Nursery Tow', liftType: 'drag_lift', coordinates: [towBottom, towTop] };
    const graph = buildGraph(
      network({ lifts: [gondola, chair, tow], elevations: { ...elevations, tow: [1500, 1560] } })
    );
    const gap = distanceMeters(V, towBottom);
    expect(gap).toBeGreaterThan(80);
    expect(gap).toBeLessThan(120);

    // Fra toppen: blå ned til landsbyen, gå over til trækliften, op med den.
    const result = route(graph, T, towTop, 'easy');
    expect(kinds(result)).toEqual(['piste:Home Run', 'walk:', 'lift:Nursery Tow']);
    // Skiftet koster 30 sekunder plus gåtiden.
    expect(result.steps[1].seconds).toBeCloseTo(30 + walkSeconds(gap), 6);
    expect(result.steps[1].meters).toBeCloseTo(gap, 6);
    // Uden ski må man ikke tage trækliften.
    expect(route(graph, T, towTop, 'none')).toBeNull();
  });

  test('linjer længere end 120 m fra hinanden hænger ikke sammen', () => {
    // Samme træklift, men 200 m væk og med toppen uden for gå-afstand af alt andet.
    const tow = {
      id: 'tow',
      name: 'Far Tow',
      liftType: 'drag_lift',
      coordinates: [pt(46.0, 7.0026), pt(46.0, 7.02)],
    };
    const graph = buildGraph(network({ lifts: [gondola, chair, tow], elevations: { ...elevations, tow: [1500, 1700] } }));
    expect(distanceMeters(V, tow.coordinates[0])).toBeGreaterThan(120);
    // Man kan stadig gå derhen fra STARTEN (inden for 600 m), og så er det en gåtur + lift.
    expect(kinds(route(graph, V, tow.coordinates[1], 'easy'))).toEqual(['walk:', 'lift:Far Tow']);
    // Men kommer man ned ad pisten fra toppen, er der ingen forbindelse videre.
    expect(route(graph, T, tow.coordinates[1], 'easy')).toBeNull();
  });

  test('to pister, der deler et punkt, hænger sammen uden gå-stykke', () => {
    const graph = buildGraph(network());
    const result = route(graph, T, V, 'easy');
    expect(result.steps.some((step) => step.kind === 'walk')).toBe(false);
  });

  test('en kort forbindelsespist skjules på listen, men tæller med i tid og længde', () => {
    // 67 m "Link" fra toppen hen til pisten "Main".
    const joint = pt(46.0195, 7.0005);
    const link = { id: 'link', name: 'Link', difficulty: 'easy', coordinates: [T, joint] };
    const main = { id: 'main', name: 'Main', difficulty: 'easy', coordinates: [joint, pt(46.01, 7.003), V] };
    const graph = buildGraph({ lifts: [gondola], pistes: [link, main], elevations: { gondola: [1500, 2200], link: [2200, 2180], main: [2180, 1500] } });
    const result = route(graph, T, V, 'easy');
    const linkMeters = lineLengthMeters(link.coordinates);
    const mainMeters = lineLengthMeters(main.coordinates);
    expect(linkMeters).toBeLessThan(120);
    expect(kinds(result)).toEqual(['piste:Main']);
    expect(result.totalMeters).toBeCloseTo(linkMeters + mainMeters, 6);
    expect(result.totalSeconds).toBeCloseTo((linkMeters + mainMeters) / BLUE_SPEED, 6);
    // Kortet tegner hele vejen, også det skjulte stykke.
    expect(result.coordinates[0]).toEqual(T);
  });

  test('en flad pist (under 10 m fald) kan køres begge veje - den "forkerte" vej i halv fart', () => {
    const a = pt(46.02, 7.0);
    const b = pt(46.02, 7.02);
    const traverse = { id: 'flat', name: 'Traverse', difficulty: 'easy', coordinates: [a, b] };
    const graph = buildGraph({ lifts: [], pistes: [traverse], elevations: { flat: [2000, 1995] } });
    const there = route(graph, a, b, 'easy');
    const back = route(graph, b, a, 'easy');
    expect(there.totalSeconds).toBeCloseTo(distanceMeters(a, b) / BLUE_SPEED, 6);
    expect(back.totalSeconds).toBeCloseTo(2 * there.totalSeconds, 6);
  });

  test('en pist med tydeligt fald, eller uden højder, kan kun køres i tegneretningen', () => {
    const a = pt(46.02, 7.0);
    const b = pt(46.02, 7.02);
    const run = { id: 'run', name: 'Run', difficulty: 'easy', coordinates: [a, b] };
    for (const heights of [{ run: [2000, 1800] }, {}]) {
      const graph = buildGraph({ lifts: [], pistes: [run], elevations: heights });
      expect(route(graph, a, b, 'easy')).not.toBeNull();
      expect(route(graph, b, a, 'easy')).toBeNull();
    }
  });
});

describe('gå-forbindelser mellem liftstationer i en by', () => {
  // To gondoler, hvis bundstationer ligger ca. 770 m fra hinanden.
  const E = pt(46.0, 7.01);
  const eastTop = pt(46.015, 7.02);
  const east = { id: 'east', name: 'East Gondola', liftType: 'gondola', coordinates: [E, eastTop] };
  const lifts = [gondola, east];
  const heights = { gondola: [1500, 2200], east: [1520, 2100] };

  test('i en by kan man gå mellem stationerne', () => {
    const graph = buildGraph({ lifts, pistes: [], elevations: heights, isVillage: () => true });
    const result = route(graph, V, eastTop, 'none');
    const gap = distanceMeters(V, E);
    expect(kinds(result)).toEqual(['walk:', 'lift:East Gondola']);
    expect(result.steps[0].seconds).toBeCloseTo(walkSeconds(gap), 6);
    expect(result.steps[0].meters).toBeCloseTo(gap * WALK_DETOUR, 6);
  });

  test('uden for byerne er der ingen gå-forbindelse', () => {
    const graph = buildGraph({ lifts, pistes: [], elevations: heights });
    expect(route(graph, V, eastTop, 'none')).toBeNull();
    // Begge stationer skal ligge i en by.
    const onlyWest = buildGraph({
      lifts,
      pistes: [],
      elevations: heights,
      isVillage: (point) => point.longitude < 7.005,
    });
    expect(route(onlyWest, V, eastTop, 'none')).toBeNull();
  });

  test('ikke hvis der er mere end 80 højdemeter imellem', () => {
    const graph = buildGraph({
      lifts,
      pistes: [],
      elevations: { gondola: [1500, 2200], east: [1600, 2100] },
      isVillage: () => true,
    });
    expect(route(graph, V, eastTop, 'none')).toBeNull();
  });

  test('ikke hvis stationerne ligger mere end 1,5 km fra hinanden', () => {
    const farBottom = pt(46.0, 7.02); // ca. 1,54 km
    const far = { ...east, coordinates: [farBottom, pt(46.015, 7.03)] };
    const graph = buildGraph({ lifts: [gondola, far], pistes: [], elevations: heights, isVillage: () => true });
    expect(distanceMeters(V, farBottom)).toBeGreaterThan(1500);
    expect(route(graph, V, far.coordinates[1], 'none')).toBeNull();
  });

  test('uden højder for liften ved vi ikke, om stationen ligger i dalen - ingen forbindelse', () => {
    const graph = buildGraph({ lifts, pistes: [], elevations: {}, isVillage: () => true });
    expect(route(graph, V, eastTop, 'none')).toBeNull();
  });
});
