import { buildModel, modelFor } from '../utils/resortModel';
import { bundledResorts, bundledResort } from '../data/resorts';
import { verbier } from '../data/resorts/verbier';
import { findRoute } from '../utils/routing';
import { placeCategory } from '../utils/places';
import { distanceMeters } from '../utils/geo';
import { miniResort, places, pt, V, T, M, gondola, chair } from './helpers/miniResort';

// buildModel() lægger alt det afledte oven på et skiområdes rå data.

describe('buildModel på det lille, opdigtede skiområde', () => {
  const model = buildModel(miniResort());

  test('grunddata føres videre', () => {
    expect(model).toMatchObject({
      id: 'mini',
      name: 'Mini Valley',
      convention: 'europe',
      timeZone: 'Europe/Zurich',
      curated: false,
    });
    expect(model.lifts).toHaveLength(2);
    expect(model.toilets).toHaveLength(1);
    expect(model.towns).toHaveLength(1);
    expect(model.partners).toEqual([]);
  });

  test('manglende felter får fornuftige standardværdier', () => {
    const bare = buildModel({ id: 'bare', name: 'Bare', lifts: [gondola], pistes: [] });
    expect(bare).toMatchObject({ convention: 'europe', timeZone: null, towns: [], toilets: [], partners: [], elevations: {} });
    expect(bare.allPlaces).toEqual([]);
    expect(bare.featured).toEqual([]);
    expect(bare.findPlace('x')).toBeNull();
    expect(bare.sledRun).toBeNull();
    expect(bare.pisteKm).toBe(0);
  });

  test('findPlace slår et sted op på id', () => {
    expect(model.findPlace('hut')).toBe(places.find((p) => p.id === 'hut'));
    expect(model.findPlace('missing')).toBeNull();
  });

  test('nearestLiftStation: nærmeste lift, om det er top eller bund, og afstanden', () => {
    const nearTop = model.nearestLiftStation(pt(46.0203, 7.0));
    // Både gondolens top og stoleliftens top ligger i T; den første i listen vinder.
    expect(nearTop.end).toBe('top');
    expect(nearTop.meters).toBeCloseTo(distanceMeters(pt(46.0203, 7.0), T), 6);
    expect(model.nearestLiftStation(pt(46.0001, 7.0))).toMatchObject({ lift: gondola, end: 'bottom' });
    // Stoleliften er tegnet fra top til bund - højderne afgør, at M er bunden.
    expect(model.nearestLiftStation(M)).toMatchObject({ lift: chair, end: 'bottom', meters: 0 });
  });

  test('nearestLiftStation giver null i et område uden lifter', () => {
    const noLifts = buildModel(miniResort({ id: 'no-lifts', lifts: [] }));
    expect(noLifts.nearestLiftStation(V)).toBeNull();
    expect(noLifts.defaultLift).toBeNull();
    expect(noLifts.friends).toEqual([]);
  });

  test('liftBottom er den laveste ende', () => {
    expect(model.liftBottom(gondola)).toEqual(V);
    expect(model.liftBottom(chair)).toEqual(M);
  });

  test('uden højder er bunden dér, hvor liften er tegnet fra', () => {
    const drawn = buildModel(miniResort({ id: 'no-heights', elevations: {} }));
    expect(drawn.liftBottom(chair)).toEqual(T);
  });

  test('hovedliften er den, hvis bundstation ligger midt i flest steder', () => {
    expect(model.defaultLift).toBe(gondola);
  });

  test('et børnebånd midt i byen bliver ikke hovedlift, når der findes rigtige lifter', () => {
    const carpet = { id: 'carpet', name: 'Kids Carpet', liftType: 'magic_carpet', coordinates: [pt(46.0003, 7.0002), pt(46.0008, 7.0002)] };
    // Gondolen flyttes væk fra byen, så båndet er det eneste med steder omkring sig.
    const remote = { ...gondola, coordinates: [pt(46.0, 7.05), pt(46.02, 7.05)] };
    const withMain = buildModel(miniResort({ id: 'carpet-1', lifts: [carpet, remote], pistes: [], elevations: {} }));
    expect(withMain.defaultLift).toBe(remote);
    // Har området kun bånd og træklifter, må et af dem gerne være hovedlift.
    const onlySmall = buildModel(miniResort({ id: 'carpet-2', lifts: [carpet], pistes: [], elevations: {} }));
    expect(onlySmall.defaultLift).toBe(carpet);
  });

  test('defaultLiftName vælger hovedliften ved navn', () => {
    const named = buildModel(miniResort({ id: 'named', defaultLiftName: 'Back' }));
    expect(named.defaultLift).toBe(chair);
    // Findes navnet ikke, vælges liften som ellers.
    const typo = buildModel(miniResort({ id: 'typo', defaultLiftName: 'Nope' }));
    expect(typo.defaultLift).toBe(gondola);
  });

  test('vejret hentes ved hovedliftens bund - med mindre punktet er skrevet fast', () => {
    expect(model.weatherPoint).toEqual(V);
    const fixed = buildModel(miniResort({ id: 'fixed', weatherPointFixed: true }));
    expect(fixed.weatherPoint).toEqual({ latitude: 46.015, longitude: 7.0 });
  });

  test('pisteKm tæller kun rigtige pister - ikke kælkebaner, skiture og off-piste', () => {
    const base = model.pisteKm;
    expect(base).toBe(6); // 2,3 km blå + 2,2 km sort + 1,2 km rød
    const extra = [
      { id: 's', name: 'Rodelbahn', type: 'sled', difficulty: 'easy', coordinates: [T, V] },
      { id: 't', name: 'Aufstieg', type: 'skitour', difficulty: 'unknown', coordinates: [V, T] },
      { id: 'f', name: 'Couloir', difficulty: 'freeride', coordinates: [T, V] },
    ];
    const more = buildModel(miniResort({ id: 'more', pistes: [...miniResort().pistes, ...extra] }));
    expect(more.pisteKm).toBe(base);
  });

  test('sledRun er den længste kælkebane', () => {
    expect(model.sledRun).toBeNull();
    const sleds = [
      { id: 's1', name: 'Kort bane', type: 'sled', difficulty: 'easy', coordinates: [pt(46.01, 7.03), pt(46.009, 7.03)] },
      { id: 's2', name: 'Lang bane', type: 'sled', difficulty: 'easy', coordinates: [pt(46.02, 7.04), pt(46.0, 7.04)] },
    ];
    const withSleds = buildModel(miniResort({ id: 'sleds', pistes: [...miniResort().pistes, ...sleds] }));
    expect(withSleds.sledRun).toMatchObject({ name: 'Lang bane', kind: 'sled' });
  });

  test('pisteGroups samler stykkerne, og pisteGroupOf finder gruppen', () => {
    expect(model.pisteGroupOf('blue-2')).toBe(model.pisteGroupOf('blue-1'));
    expect(model.pisteGroupOf('blue-1').pistes).toHaveLength(2);
    expect(model.pisteGroups).toHaveLength(3);
  });

  test('grafen bygges først, når nogen beder om den, og genbruges', () => {
    const fresh = buildModel(miniResort({ id: 'lazy' }));
    const graph = fresh.getGraph();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(fresh.getGraph()).toBe(graph);
  });

  test('liftstationer i byen forbindes til fods - "by" er, hvor der ligger mindst fire steder', () => {
    // En ekstra gondol 770 m øst for landsbyen, med fire steder omkring bunden.
    const E = pt(46.0, 7.01);
    const east = { id: 'east', name: 'East Gondola', liftType: 'gondola', coordinates: [E, pt(46.015, 7.02)] };
    const around = (id, dLat, dLon) => ({ id, name: `Chalet ${id}`, category: 'hotel', latitude: E.latitude + dLat, longitude: E.longitude + dLon });
    const eastPlaces = [around('e1', 0.0005, 0), around('e2', -0.0005, 0), around('e3', 0, 0.0005), around('e4', 0, -0.0005)];
    const resort = (id, extraPlaces) =>
      miniResort({
        id,
        lifts: [gondola, chair, east],
        elevations: { ...miniResort().elevations, east: [1520, 2100] },
        places: [...places, ...extraPlaces],
      });
    const town = buildModel(resort('two-villages', eastPlaces));
    const walk = findRoute(town.getGraph(), V, east.coordinates[1], { skill: 'none' });
    expect(walk.steps.map((step) => step.kind)).toEqual(['walk', 'lift']);
    // Uden steder omkring den østlige station er den ikke "i en by".
    const lonely = buildModel(resort('one-village', []));
    expect(findRoute(lonely.getGraph(), V, east.coordinates[1], { skill: 'none' })).toBeNull();
  });
});

describe('steder: udvalgte (pois) og almindelige', () => {
  const poi = { id: 'p1', name: 'Chez Martin', category: 'restaurant', replaces: 'r1', description: 'Curated.', latitude: 46.0002, longitude: 7.0006 };

  test('et udvalgt sted erstatter sin OSM-udgave, så det ikke står to gange', () => {
    const model = buildModel(miniResort({ id: 'curated', pois: [poi] }));
    expect(model.findPlace('r1')).toBeNull();
    expect(model.findPlace('p1')).toBe(poi);
    expect(model.allPlaces).toHaveLength(places.length);
    expect(model.allPlaces[0]).toBe(poi); // de udvalgte står først
    expect(model.curated).toBe(true);
    expect(model.featured).toEqual([poi]);
  });

  test('uden udvalgte steder vises de bedst beskrevne spisesteder', () => {
    const model = buildModel(miniResort());
    // Chez Martin har åbningstider, hjemmeside, telefon og køkken (5 point),
    // Back Hut åbningstider (2), L'Avalanche Café køkken (1), Summit Café intet.
    expect(model.featured.map((p) => p.name)).toEqual(['Chez Martin', 'Back Hut', "L'Avalanche Café", 'Summit Café']);
    // Kun restauranter og caféer - ikke hoteller og barer.
    expect(model.featured.every((p) => ['restaurant', 'cafe'].includes(placeCategory(p)))).toBe(true);
  });

  test('højst fem steder på forsiden', () => {
    const many = Array.from({ length: 12 }, (unused, i) => ({ id: `m${i}`, name: `Bistro ${String(i).padStart(2, '0')}`, category: 'restaurant', latitude: 46.0, longitude: 7.0 }));
    const model = buildModel(miniResort({ id: 'many', places: many }));
    expect(model.featured.map((p) => p.name)).toEqual(['Bistro 00', 'Bistro 01', 'Bistro 02', 'Bistro 03', 'Bistro 04']);
  });
});

describe('eksempel-venner i områder uden håndlavet indhold', () => {
  test('områdets egne venner bruges, hvis det har nogen', () => {
    const friends = [{ id: 'x', name: 'Xavier', latitude: 46, longitude: 7 }];
    expect(buildModel(miniResort({ id: 'friends', friends })).friends).toBe(friends);
  });

  test('ellers stilles fire opdigtede venner ved rigtige steder i området', () => {
    const model = buildModel(miniResort());
    expect(model.friends.map((f) => f.name)).toEqual(['Emma', 'Lucas', 'Oliver', 'Sophie']);
    const [village, onLift, mountain, bar] = model.friends;
    // Nærmeste spisested til hovedliften er L'Avalanche Café; længst væk er Back Hut.
    expect(village.status).toBe("At L'Avalanche Café");
    expect(onLift.status).toBe('On the Village Gondola lift');
    expect(mountain.status).toBe('At Back Hut');
    expect(bar.status).toBe('Last seen at Mont-Blanc Bar');
    for (const friend of model.friends) {
      expect(Number.isFinite(friend.latitude)).toBe(true);
      expect(Number.isFinite(friend.longitude)).toBe(true);
    }
    // Vennen står 25-30 m fra stedet, så nålene ikke ligger oven i hinanden.
    const cafe = model.findPlace('c1');
    expect(distanceMeters(village, cafe)).toBeGreaterThan(15);
    expect(distanceMeters(village, cafe)).toBeLessThan(40);
  });
});

describe('modelFor - modellen bygges én gang pr. skiområde', () => {
  test('samme område giver samme model', () => {
    const resort = miniResort({ id: 'cache-a', fetchedAt: 10 });
    expect(modelFor(resort)).toBe(modelFor(resort));
    // Også for en kopi af dataene (fx læst fra telefonen igen).
    expect(modelFor({ ...resort })).toBe(modelFor(resort));
  });

  test('et nyt område - eller samme område hentet igen - giver en ny model', () => {
    const first = modelFor(miniResort({ id: 'cache-a', fetchedAt: 10 }));
    const refreshed = modelFor(miniResort({ id: 'cache-a', fetchedAt: 20 }));
    expect(refreshed).not.toBe(first);
    const other = modelFor(miniResort({ id: 'cache-b', fetchedAt: 10 }));
    expect(other.id).toBe('cache-b');
    // Kun ét område ad gangen i hukommelsen: det første bygges forfra.
    expect(modelFor(miniResort({ id: 'cache-a', fetchedAt: 20 }))).not.toBe(refreshed);
  });
});

describe('Verbier (det håndlavede område)', () => {
  const model = buildModel(verbier);

  test('nøgletal, som README og appen nævner', () => {
    // 47 i OpenStreetMap-udtrækket minus to, der ikke er skilifter (data/resorts/verbier.js).
    expect(model.lifts).toHaveLength(45);
    // 144 km minus 9 km upræpareret nedkørsel fra Rosablanche, der tegnes som off-piste.
    expect(model.pisteKm).toBe(134);
    expect(model.toilets).toHaveLength(20);
    expect(model.allPlaces).toHaveLength(322);
    expect(model.timeZone).toBe('Europe/Zurich');
    expect(model.convention).toBe('europe');
  });

  test('hovedliften er Médran, og vejret hentes for landsbyen', () => {
    expect(model.defaultLift.name).toBe('Médran 2');
    expect(model.weatherPoint).toEqual({ latitude: 46.0961, longitude: 7.2286 });
  });

  test('fem udvalgte steder, egne venner og partnere', () => {
    expect(model.curated).toBe(true);
    expect(model.featured.map((p) => p.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(model.friends).toBe(verbier.friends);
    expect(model.partners.length).toBeGreaterThan(0);
  });

  test('alle "replaces" peger på et sted, der findes - og det er fjernet fra listen', () => {
    const osmIds = new Set(verbier.places.map((p) => p.id));
    const replaced = verbier.pois.map((poi) => poi.replaces).filter(Boolean);
    expect(replaced.length).toBeGreaterThan(0);
    for (const id of replaced) {
      expect(osmIds.has(id)).toBe(true);
      expect(model.findPlace(id)).toBeNull();
    }
  });

  test('kælkebanen i La Tzoumaz er fundet', () => {
    expect(model.sledRun).toMatchObject({ name: 'Piste de luge de La Tzoumaz', kind: 'sled' });
  });

  test('Chez Dany ligger nærmest Médran', () => {
    const nearest = model.nearestLiftStation(model.findPlace('2'));
    expect(nearest.lift.name).toMatch(/^Médran/);
    expect(nearest.meters).toBeGreaterThan(500);
    expect(nearest.meters).toBeLessThan(1000);
  });
});

// De indbyggede skiområder er data, ikke kode - men en fil, der er gået i
// stykker, eller et område, der mangler højder, opdages først, når nogen
// vælger området i appen. Derfor tjekkes formen her.
describe.each(bundledResorts.map((item) => [item.name, item]))('indbygget område: %s', (name, item) => {
  const resort = item.load();
  const model = buildModel(resort);

  test('id, navn og land passer med listen i resort-vælgeren', () => {
    expect(resort.id).toBe(item.id);
    expect(resort.name).toBe(item.name);
    expect(resort.country).toBe(item.country);
    expect(resort.bundled).toBe(true);
    expect(bundledResort(item.id)).toBe(item);
  });

  test('pistefarver og tidszone er kendte', () => {
    expect(['europe', 'north_america', 'japan']).toContain(resort.convention);
    // Kaster en fejl, hvis tidszonen ikke findes.
    expect(() => new Intl.DateTimeFormat('en-GB', { timeZone: resort.timeZone })).not.toThrow();
  });

  test('kortudsnit og vejrpunkt er gyldige koordinater', () => {
    for (const value of [
      resort.region.latitude,
      resort.region.longitude,
      resort.region.latitudeDelta,
      resort.region.longitudeDelta,
      model.weatherPoint.latitude,
      model.weatherPoint.longitude,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(resort.region.latitudeDelta).toBeGreaterThan(0);
    expect(resort.region.longitudeDelta).toBeGreaterThan(0);
  });

  test('lifter og pister har id, mindst to punkter og gyldige koordinater', () => {
    expect(resort.lifts.length).toBeGreaterThan(10);
    expect(resort.pistes.length).toBeGreaterThan(50);
    const bad = [...resort.lifts, ...resort.pistes].filter(
      (line) =>
        !line.id ||
        line.coordinates.length < 2 ||
        !line.coordinates.every((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    );
    expect(bad.map((line) => line.id)).toEqual([]);
  });

  test('alle id\'er er forskellige', () => {
    const duplicates = (list) => list.map((x) => x.id).filter((id, i, all) => all.indexOf(id) !== i);
    expect(duplicates(resort.lifts)).toEqual([]);
    expect(duplicates(resort.pistes)).toEqual([]);
    expect(duplicates(model.allPlaces)).toEqual([]);
    expect(duplicates(model.toilets)).toEqual([]);
  });

  test('alle lifter har navn, en kendt type og højder (ellers ved vi ikke, hvad der er op)', () => {
    const types = ['gondola', 'cable_car', 'mixed_lift', 'chair_lift', 'platter', 'drag_lift', 'rope_tow', 'magic_carpet'];
    const bad = resort.lifts.filter((lift) => {
      const heights = model.elevations[lift.id];
      return !lift.name || !types.includes(lift.liftType) || !heights || !heights.every(Number.isFinite);
    });
    expect(bad.map((lift) => `${lift.name} (${lift.liftType})`)).toEqual([]);
  });

  test('alle pister har en kendt sværhedsgrad', () => {
    const known = ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'extreme', 'freeride', 'unknown'];
    const bad = resort.pistes.filter((piste) => !known.includes(piste.difficulty));
    expect(bad.map((piste) => `${piste.name}: ${piste.difficulty}`)).toEqual([]);
  });

  test('alle steder har id, navn, en kendt kategori og koordinater', () => {
    const categories = ['restaurant', 'cafe', 'apres_ski', 'hotel', 'ski_rental'];
    const bad = model.allPlaces.filter(
      (place) =>
        !place.id ||
        !place.name ||
        !categories.includes(placeCategory(place)) ||
        !Number.isFinite(place.latitude) ||
        !Number.isFinite(place.longitude)
    );
    expect(bad.map((place) => place.id)).toEqual([]);
    expect(model.allPlaces.length).toBeGreaterThan(10);
  });

  test('modellen kan bygges: hovedlift, venner og forside', () => {
    expect(model.defaultLift).toBeTruthy();
    expect(model.pisteKm).toBeGreaterThan(20);
    expect(model.friends.length).toBeGreaterThanOrEqual(3);
    expect(model.featured.length).toBeGreaterThan(0);
    expect(model.featured.length).toBeLessThanOrEqual(5);
    expect(model.pisteGroups.length).toBeLessThanOrEqual(resort.pistes.length);
  });
});

describe('Verbier: rettelser slået op hos liftselskabet (data/resorts/verbier.js)', () => {
  const model = buildModel(verbier);
  const lift = (name) => model.lifts.find((item) => item.name === name);

  test('to linjer i OpenStreetMap-udtrækket er ikke skilifter og er taget ud', () => {
    expect(lift('Mazembroz-Beudon')).toBeUndefined();
    expect(lift('Fionnay-Plan du Tsenau')).toBeUndefined();
    expect(lift('Téléski du Dzora')).toBeDefined();
  });

  test('de vigtigste stationer har de officielle højder', () => {
    expect(model.elevations[lift('Médran 2').id]).toEqual([1531, 2200]);
    expect(model.elevations[lift('Funispace').id]).toEqual([2200, 2727]);
    expect(model.elevations[lift('Mont-Fort').id][1]).toBe(3300);
    expect(model.elevations[lift('Mont-Gelé').id][1]).toBe(3002);
    expect(model.weatherLevels.find((level) => level.id === 'top').elevation).toBe(3300);
  });

  test('uden ski: kun lifter, fodgængere må tage - også en stolelift, men ikke Mont-Gelé', () => {
    const graph = model.getGraph();
    const from = model.liftBottom(model.defaultLift);
    const top = (name) => {
      const item = lift(name);
      return item.coordinates[item.coordinates.length - 1];
    };
    expect(findRoute(graph, from, top('Mont-Fort'), { skill: 'none' })).not.toBeNull();
    expect(findRoute(graph, from, top('Mont-Gelé'), { skill: 'none' })).toBeNull();
    // Alle lift-trin uden ski er mærket som fodgænger-lifter.
    const route = findRoute(graph, from, model.findPlace('5'), { skill: 'none' });
    expect(route.steps.filter((step) => step.kind === 'lift').every((step) => step.pedestrian)).toBe(true);
  });

  test('en upræpareret linje uden navn tegnes og regnes som off-piste', () => {
    const marked = verbier.pistes.filter((piste) => ['expert', 'extreme'].includes(piste.difficulty));
    expect(marked.length).toBeGreaterThan(0);
    for (const piste of marked) {
      expect(model.pistes.find((item) => item.id === piste.id).difficulty).toBe('freeride');
    }
  });

  test('"oppe på bjerget": ikke landsbyen, ikke dalen', () => {
    expect(model.onMountain(model.findPlace('5'))).toBe(true); // Le Dahu ved La Chaux
    expect(model.onMountain(model.findPlace('hotel-198'))).toBe(false); // W Verbier i landsbyen
    const valley = model.allPlaces.find((place) => place.name === 'Café de La Place'); // Le Châble
    expect(model.onMountain(valley)).toBe(false);
  });

  test('toppen af kælkebanen er der, hvor man starter', () => {
    const top = model.pisteTop(model.sledRun);
    const bottoms = model.sledRun.pistes.flatMap((piste) => [piste.coordinates[0], piste.coordinates[piste.coordinates.length - 1]]);
    expect(bottoms.some((point) => distanceMeters(point, top) < 1)).toBe(true);
    // Ved Savoleyres, ikke nede i La Tzoumaz.
    expect(model.nearestLiftStation(top).meters).toBeLessThan(400);
  });

  test('nærmeste lift er en bundstation, når den ligger næsten lige så tæt på', () => {
    // Le Farinet ligger i landsbyen: "ved Médran", ikke "ved toppen af gondolen fra dalen".
    expect(model.nearestLiftStation(model.findPlace('apres-12'))).toMatchObject({ end: 'bottom' });
  });
});
