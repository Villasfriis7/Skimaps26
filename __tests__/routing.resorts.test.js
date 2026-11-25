import { bundledResorts, bundledResort } from '../data/resorts';
import { buildModel } from '../utils/resortModel';
import { findRoute, isOnNetwork, skillLevels } from '../utils/routing';
import { defaultStart, easiestWay } from '../utils/reach';
import { distanceMeters } from '../utils/geo';

// RUTEFINDING I ALLE DE INDBYGGEDE SKIOMRÅDER
//
// For hvert område (Verbier + de ti i data/resorts/*.json) beregnes ruten fra
// områdets standard-startpunkt til HVERT sted på HVERT niveau - omkring
// 11.000 ruter i alt - og så tjekkes de regler, der altid skal gælde. Det er
// sikkerhedsnettet for utils/routing.js: en ændring, der sender en begynder
// ned ad en sort pist et eller andet sted i verden, bliver fanget her.

// Hvad hvert niveau må køre. Skrevet af her (og ikke hentet fra routing.js),
// så testen har sin egen facitliste.
const ALLOWED = {
  none: [],
  easy: ['novice', 'easy'],
  intermediate: ['novice', 'easy', 'intermediate'],
  advanced: ['novice', 'easy', 'intermediate', 'advanced', 'expert'],
  freeride: ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'extreme', 'freeride'],
};
// Lifter med lukkede kabiner: de eneste, man må tage uden ski - og ned.
const CABINS = ['gondola', 'cable_car', 'mixed_lift'];
const LEVELS = ['none', 'easy', 'intermediate', 'advanced', 'freeride'];

function allowedFor(levelId, convention) {
  const allowed = new Set(ALLOWED[levelId]);
  // I Nordamerika er "expert" dobbelt sort diamant - over niveauet "Black".
  if (convention === 'north_america' && levelId === 'advanced') allowed.delete('expert');
  return allowed;
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const goodPoint = (p) => p && finite(p.latitude) && finite(p.longitude);

test('testens niveauer er de samme som appens', () => {
  expect(skillLevels.map((level) => level.id)).toEqual(LEVELS);
});

describe.each(bundledResorts.map((item) => [item.name, item]))('%s', (name, item) => {
  let model;
  let graph;
  let start;
  // Én række pr. sted: { place, onNetwork, routes: [rute eller null pr. niveau] }
  let rows;
  // Alle fundne ruter fladt: { place, level, route }
  let found;

  beforeAll(() => {
    model = buildModel(item.load());
    graph = model.getGraph();
    start = defaultStart(model, null);
    rows = model.allPlaces.map((place) => ({
      place,
      onNetwork: isOnNetwork(graph, place),
      routes: LEVELS.map((level) => findRoute(graph, start.point, place, { skill: level, convention: model.convention })),
    }));
    found = rows.flatMap(({ place, routes }) =>
      routes.map((route, i) => ({ place, level: LEVELS[i], route })).filter(({ route }) => route)
    );
  });

  afterAll(() => {
    model = graph = rows = found = null; // slip de store data igen
  });

  // Samler alle brud på en regel i én liste, så en fejl viser, HVOR det gik
  // galt, i stedet for bare "forventede true".
  const problems = (check) => {
    const list = [];
    for (const entry of found) {
      const message = check(entry);
      if (message) list.push(`${entry.place.name} (${entry.place.id}) på niveau "${entry.level}": ${message}`);
    }
    return list.slice(0, 10);
  };

  test('standard-startpunktet er bunden af hovedliften og ligger på netværket', () => {
    expect(start.fromLocation).toBe(false);
    expect(start.label).toBe(`${model.defaultLift.name} lift`);
    expect(goodPoint(start.point)).toBe(true);
    expect(isOnNetwork(graph, start.point)).toBe(true);
  });

  test('testen er ikke tom: de fleste steder kan nås på mindst ét niveau', () => {
    const reachable = rows.filter(({ routes }) => routes.some(Boolean)).length;
    expect(rows.length).toBeGreaterThan(10);
    expect(reachable / rows.length).toBeGreaterThan(0.6);
  });

  test('ingen rute indeholder en pist, der er sværere end niveauet tillader', () => {
    expect(
      problems(({ level, route }) => {
        const allowed = allowedFor(level, model.convention);
        // En pist uden sværhedsgrad regnes som sort (`routeAs`), men hedder stadig "unknown".
        const bad = route.steps.find((step) => step.kind === 'piste' && !allowed.has(step.routeAs || step.difficulty));
        return bad && `pisten "${bad.name}" er ${bad.routeAs || bad.difficulty}`;
      })
    ).toEqual([]);
  });

  test('uden ski: kun gåture og lifter, fodgængere må tage', () => {
    // Hvor skiområdet har en liste over fodgænger-lifter (Verbier), gælder
    // den - ellers lifter med lukkede kabiner.
    const walkOn = model.resort.pedestrianLifts;
    const allowed = (step) => (walkOn ? walkOn.includes(step.name) : CABINS.includes(step.liftType));
    expect(
      problems(({ level, route }) => {
        if (level !== 'none') return null;
        const bad = route.steps.find((step) => step.kind === 'piste' || (step.kind === 'lift' && !allowed(step)));
        return bad && `${bad.kind} "${bad.name}" (${bad.liftType || bad.difficulty})`;
      })
    ).toEqual([]);
  });

  test('skiløbere tager kun gondoler, kabelbaner og kombinerede lifter ned', () => {
    // Uden ski må man også tage en stolelift ned, hvis den står på
    // skiområdets liste over fodgænger-lifter.
    expect(
      problems(({ level, route }) => {
        if (level === 'none') return null;
        const bad = route.steps.find((step) => step.kind === 'lift' && step.down && !CABINS.includes(step.liftType));
        return bad && `${bad.liftType} "${bad.name}" tages ned`;
      })
    ).toEqual([]);
  });

  test('samlet tid og længde er endelige tal og større end nul', () => {
    expect(
      problems(({ place, route }) => {
        if (!finite(route.totalSeconds) || !finite(route.totalMeters)) return 'tid eller længde er ikke et tal';
        if (route.totalSeconds < 0 || route.totalMeters < 0) return 'negativ tid eller længde';
        // Et sted lige ved startpunktet (under 25 m til samme knude) giver en
        // rute uden trin og med 0 sekunder - se testen om Médran Café nederst.
        const rightHere = distanceMeters(start.point, place) < 50;
        if (!rightHere && !(route.totalSeconds > 0 && route.totalMeters > 0)) return 'tid eller længde er 0';
        if (route.steps.length > 0 && !(route.totalSeconds > 0 && route.totalMeters > 0)) return 'trin, men ingen tid';
        return null;
      })
    ).toEqual([]);
  });

  test('hvert trin har en kendt type, tid, længde og mindst to koordinater', () => {
    expect(
      problems(({ route }) => {
        for (const step of route.steps) {
          if (!['walk', 'lift', 'piste'].includes(step.kind)) return `ukendt trin "${step.kind}"`;
          if (!(finite(step.seconds) && step.seconds > 0)) return `${step.kind} uden tid`;
          if (!(finite(step.meters) && step.meters > 0)) return `${step.kind} uden længde`;
          if (!Array.isArray(step.coordinates) || step.coordinates.length < 2) return `${step.kind} uden koordinater`;
          if (!step.coordinates.every(goodPoint)) return `${step.kind} med ugyldigt koordinat`;
          if (step.kind === 'lift' && (!step.name || !step.liftType)) return 'lift uden navn eller type';
          if (step.kind === 'piste' && !step.difficulty) return 'pist uden sværhedsgrad';
        }
        return null;
      })
    ).toEqual([]);
  });

  test('trinene har hver sin nøgle (React-lister kræver det)', () => {
    expect(
      problems(({ route }) => {
        const keys = route.steps.map((step) => step.key);
        return new Set(keys).size !== keys.length && `ens nøgler: ${keys.join(', ')}`;
      })
    ).toEqual([]);
  });

  test('den samlede tid og længde er mindst summen af de viste trin', () => {
    // Korte stumper skjules på listen, men tæller stadig med i totalen.
    expect(
      problems(({ route }) => {
        const seconds = route.steps.reduce((sum, step) => sum + step.seconds, 0);
        const meters = route.steps.reduce((sum, step) => sum + step.meters, 0);
        if (seconds > route.totalSeconds + 1e-6) return `trinene tager ${seconds} s, ruten ${route.totalSeconds} s`;
        if (meters > route.totalMeters + 1e-6) return `trinene er ${meters} m, ruten ${route.totalMeters} m`;
        return null;
      })
    ).toEqual([]);
  });

  test('linjen til kortet har gyldige koordinater', () => {
    expect(
      problems(({ route }) => {
        if (!route.coordinates.every(goodPoint)) return 'ugyldigt koordinat';
        if (route.totalMeters > 0 && route.coordinates.length < 2) return 'ingen linje at tegne';
        return null;
      })
    ).toEqual([]);
  });

  test('et højere niveau finder altid en rute, når et lavere gør - og aldrig en langsommere', () => {
    // Gåture under 25 m i hver ende tælles ikke med i tiden (ca. 30 s hver),
    // så to niveauer kan afvige op til et minut, selvom ruten er "den samme".
    // Derudover vælger en skiløber hellere en pist end at tage liften ned,
    // selvom pisten er op til syv minutter langsommere (RIDE_DOWN_PENALTY_S i
    // utils/routing.js) - og det sker oftere, jo flere pister man må køre.
    const SLACK_S = 60 + 420;
    const list = [];
    for (const { place, routes } of rows) {
      for (let low = 0; low < routes.length; low++) {
        if (!routes[low]) continue;
        for (let high = low + 1; high < routes.length; high++) {
          if (!routes[high]) {
            list.push(`${place.name}: rute på "${LEVELS[low]}", men ikke på "${LEVELS[high]}"`);
          } else if (routes[high].totalSeconds > routes[low].totalSeconds + SLACK_S) {
            list.push(`${place.name}: "${LEVELS[high]}" er langsommere end "${LEVELS[low]}"`);
          }
        }
      }
    }
    expect(list.slice(0, 10)).toEqual([]);
  });

  test('steder uden for netværket får ingen rute', () => {
    const list = rows
      .filter(({ onNetwork, routes }) => !onNetwork && routes.some(Boolean))
      .map(({ place }) => place.name);
    expect(list).toEqual([]);
  });

  test('ruten fra startpunktet til startpunktet selv er tom', () => {
    expect(findRoute(graph, start.point, start.point, { skill: 'easy', convention: model.convention })).toEqual({
      steps: [],
      totalSeconds: 0,
      totalMeters: 0,
      coordinates: [],
      hardest: null,
    });
  });
});

// Faste forventninger til Verbier - det område, appen vises frem i. Ændrer
// en af dem sig, er det enten en fejl eller en bevidst ændring af
// rutefindingen, som så skal rettes her.
describe('Verbier: kendte ruter', () => {
  const model = buildModel(bundledResort('verbier').load());
  const graph = model.getGraph();
  const start = defaultStart(model, null);
  const to = (id, skill) => findRoute(graph, start.point, model.findPlace(id), { skill, convention: model.convention });
  const stepNames = (route) => route.steps.map((step) => (step.kind === 'walk' ? 'walk' : step.name));

  test('ruter starter ved Médran, når vi ikke kender brugerens position', () => {
    expect(start.label).toBe('Médran 2 lift');
    expect(start.point).toEqual({ latitude: 46.09362, longitude: 7.23359 });
  });

  test('Médran -> Chez Dany kræver en rød pist og tager ca. 16 minutter', () => {
    expect(to('2', 'none')).toBeNull();
    expect(to('2', 'easy')).toBeNull();
    const route = to('2', 'intermediate');
    expect(route.totalSeconds / 60).toBeGreaterThan(14);
    expect(route.totalSeconds / 60).toBeLessThan(18);
    expect(route.steps[0]).toMatchObject({ kind: 'lift', name: 'Médran 2', liftType: 'gondola' });
    expect(route.steps.some((step) => step.kind === 'piste' && step.difficulty === 'intermediate')).toBe(true);
    // Sidste stykke er den blå pist ned til Clambin.
    expect(stepNames(route)).toContain('Piste de Clambin, Clambin');
    expect(easiestWay(model, start.point, model.findPlace('2')).level.id).toBe('intermediate');
  });

  test('Le Dahu kan nås uden ski - med gondol og kombineret lift', () => {
    const route = to('5', 'none');
    expect(route).not.toBeNull();
    const lifts = route.steps.filter((step) => step.kind === 'lift');
    // Chaux Express er tegnet som to stykker i OpenStreetMap, men er ét trin.
    expect(lifts.map((step) => step.liftType)).toEqual(['gondola', 'mixed_lift']);
    expect(lifts[1]).toMatchObject({ name: 'Chaux-Express', joined: true, down: false });
    expect(lifts[0].name).toBe('Médran 2');
    expect(route.steps.some((step) => step.kind === 'piste')).toBe(false);
    expect(route.totalSeconds / 60).toBeGreaterThan(22);
    expect(route.totalSeconds / 60).toBeLessThan(32);
    expect(easiestWay(model, start.point, model.findPlace('5')).level.id).toBe('none');
  });

  test('Le Dahu på blå er hurtigere end uden ski, og rød er hurtigere endnu', () => {
    expect(to('5', 'easy').totalSeconds).toBeLessThan(to('5', 'none').totalSeconds);
    expect(to('5', 'intermediate').totalSeconds).toBeLessThan(to('5', 'easy').totalSeconds);
    expect(to('5', 'easy').steps.some((step) => step.kind === 'piste' && step.difficulty === 'easy')).toBe(true);
  });

  test('hjem fra Le Dahu til W Verbier uden ski: kun lifter ned og gåture', () => {
    // Uden "mixed_lift" som lift, man kan tage ned, var man strandet i La
    // Chaux uden en rød pist (se kommentaren ved TWO_WAY_LIFTS i routing.js).
    const dahu = model.findPlace('5');
    const hotel = model.findPlace('hotel-198');
    expect(hotel.name).toBe('W Verbier');
    for (const skill of ['none', 'easy']) {
      const route = findRoute(graph, dahu, hotel, { skill, convention: model.convention });
      expect(route).not.toBeNull();
      expect(route.steps.every((step) => step.kind !== 'piste' || ['novice', 'easy'].includes(step.difficulty))).toBe(true);
      expect(route.totalSeconds / 60).toBeGreaterThan(20);
      expect(route.totalSeconds / 60).toBeLessThan(40);
    }
    const walking = findRoute(graph, dahu, hotel, { skill: 'none', convention: model.convention });
    const lifts = walking.steps.filter((step) => step.kind === 'lift');
    expect(lifts.length).toBeGreaterThanOrEqual(2);
    expect(lifts[lifts.length - 1]).toMatchObject({ name: 'Médran 2', down: true });
    expect(lifts.filter((step) => step.down).every((step) => CABINS.includes(step.liftType))).toBe(true);
  });

  test('med røde pister er vejen hjem fra Le Dahu hurtigere', () => {
    const dahu = model.findPlace('5');
    const hotel = model.findPlace('hotel-198');
    const blue = findRoute(graph, dahu, hotel, { skill: 'easy' });
    const red = findRoute(graph, dahu, hotel, { skill: 'intermediate' });
    expect(red.totalSeconds).toBeLessThan(blue.totalSeconds);
  });

  test('W Verbier ligger et par minutters gang fra Médran', () => {
    const route = to('hotel-198', 'none');
    expect(stepNames(route)).toEqual(['walk']);
    expect(route.totalSeconds / 60).toBeLessThan(5);
  });

  test('Cabane Mont Fort kræver en rød pist; off-piste er der en hurtigere vej over Mont-Gelé', () => {
    expect(to('4', 'easy')).toBeNull();
    const red = to('4', 'intermediate');
    const offPiste = to('4', 'freeride');
    expect(red).not.toBeNull();
    expect(offPiste.totalSeconds).toBeLessThan(red.totalSeconds);
    expect(offPiste.steps.some((step) => step.kind === 'piste' && step.difficulty === 'freeride')).toBe(true);
    expect(red.steps.some((step) => step.difficulty === 'freeride')).toBe(false);
  });

  test('Médran Café ligger lige ved startpunktet: en rute uden trin', () => {
    // RouteScreen viser "You are already there", når `steps` er tom.
    const cafe = model.findPlace('cafe-21');
    expect(distanceMeters(start.point, cafe)).toBeLessThan(25);
    expect(to('cafe-21', 'none')).toEqual({ steps: [], totalSeconds: 0, totalMeters: 0, coordinates: [], hardest: null });
  });
});

describe("Alpe d'Huez: en rute, hvor alle trin er skjult", () => {
  const item = bundledResorts.find((resort) => resort.name.startsWith("Alpe d'Huez"));
  const model = buildModel(item.load());
  const graph = model.getGraph();
  const start = defaultStart(model, null);
  const hotel = model.findPlace('n1214617096'); // Hôtel Peer Gynt

  test('hotellet ligger knap 100 m fra startpunktet, og ruten på ski er ca. 160 m', () => {
    expect(hotel.name).toBe('Hôtel Peer Gynt');
    expect(start.label).toBe('Télécentre lift');
    expect(distanceMeters(start.point, hotel)).toBeGreaterThan(80);
    const route = findRoute(graph, start.point, hotel, { skill: 'easy' });
    expect(route.totalMeters).toBeGreaterThan(100);
    expect(route.totalSeconds).toBeGreaterThan(60);
  });

  // Hele ruten består af korte stumper (gåtur + navnløs pist-stump + gåtur), som normalt
  // skjules som støj. Før blev listen tom, og appen skrev "You are already there".
  test('en rute på over 100 m har mindst ét trin på listen', () => {
    const route = findRoute(graph, start.point, hotel, { skill: 'easy' });
    expect(route.steps.length).toBeGreaterThan(0);
  });

  test('uden ski vises samme tur som et gå-trin', () => {
    const route = findRoute(graph, start.point, hotel, { skill: 'none' });
    expect(route.steps.map((step) => step.kind)).toEqual(['walk']);
  });
});

describe('Verbier: sværeste pist og lift ned (fra brugertesten)', () => {
  const model = buildModel(bundledResort('verbier').load());
  const graph = model.getGraph();
  const start = defaultStart(model, null);

  test('"hardest" tæller alle stykker - også de korte, der ikke står på listen', () => {
    const order = ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'extreme', 'freeride'];
    for (const place of model.allPlaces) {
      const route = findRoute(graph, start.point, place, { skill: 'intermediate' });
      if (!route) continue;
      for (const step of route.steps) {
        if (step.kind !== 'piste') continue;
        expect(order.indexOf(route.hardest)).toBeGreaterThanOrEqual(order.indexOf(step.difficulty));
      }
      // Aldrig sværere end det niveau, ruten er regnet for.
      if (route.hardest) expect(order.indexOf(route.hardest)).toBeLessThanOrEqual(order.indexOf('intermediate'));
    }
  });

  test('fra toppen af Mont-Fort kører en sort-løber ned ad pisten i stedet for at tage kabelbanen ned', () => {
    const lift = model.lifts.find((item) => item.name === 'Mont-Fort');
    const top = lift.coordinates[lift.coordinates.length - 1];
    const down = findRoute(graph, top, model.findPlace('hotel-198'), { skill: 'advanced' });
    expect(down.steps[0]).toMatchObject({ kind: 'piste', difficulty: 'advanced' });
    // På rødt niveau er kabelbanen eneste vej ned fra toppen.
    const red = findRoute(graph, top, model.findPlace('hotel-198'), { skill: 'intermediate' });
    expect(red.steps[0]).toMatchObject({ kind: 'lift', down: true });
  });
});
