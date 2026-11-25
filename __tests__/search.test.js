import { fold, search } from '../utils/search';
import { buildModel } from '../utils/resortModel';
import { placeCategory } from '../utils/places';
import { verbier } from '../data/resorts/verbier';
import { miniResort, places, network, pt } from './helpers/miniResort';

const titles = (found) => found.results.map((result) => result.title);

describe('fold - det, søgningen sammenligner på', () => {
  test.each([
    ['Médran', 'medran'],
    ['Le Châble', 'le chable'],
    ['Åre', 'are'],
    ['Sölden', 'solden'],
    ['ÉCOLE', 'ecole'],
    // iPhones krøllede apostrof skal finde den lige i dataene - og omvendt.
    ['L’Aviation', "l'aviation"],
    ['L‘Aviation', "l'aviation"],
    ["L'Aviation", "l'aviation"],
    // Bindestreger tæller som mellemrum.
    ['Mont-Fort', 'mont fort'],
    ['Mont – Fort', 'mont fort'],
    ['  Mont   Fort ', 'mont fort'],
  ])('"%s" -> "%s"', (text, folded) => {
    expect(fold(text)).toBe(folded);
  });

  test('ingenting bliver til en tom tekst', () => {
    expect(fold(null)).toBe('');
    expect(fold(undefined)).toBe('');
    expect(fold('')).toBe('');
  });
});

describe('search i et lille, opdigtet skiområde', () => {
  // Det lille område fra helpers/miniResort.js plus nogle steder, der er
  // valgt, så hver slags træf findes præcis én gang.
  const extra = (id, name, category, more = {}) => ({
    id,
    name,
    category,
    latitude: 46.0005,
    longitude: 7.0005,
    cuisine: null,
    ...more,
  });
  const model = buildModel(
    miniResort({
      id: 'mini-search',
      places: [
        ...places,
        extra('x1', 'Alpina Lodge', 'hotel'),
        extra('x2', 'Sealpoint', 'ski_rental'),
        extra('x3', 'Pizza Roma', 'restaurant'),
      ],
      pois: [
        extra('p1', 'Chalet Soleil', 'restaurant', {
          description: 'Sunny terrace with a view of the Alps.',
        }),
      ],
      pistes: [
        ...network().pistes,
        // Samme navn og farve et helt andet sted - og kortere.
        { id: 'blue-far', name: 'Home Run', difficulty: 'easy', coordinates: [pt(46.05, 7.05), pt(46.049, 7.05)] },
        { id: 'sled', name: 'Rodelbahn', type: 'sled', difficulty: 'novice', coordinates: [pt(46.02, 7.01), pt(46.0, 7.01)] },
      ],
    })
  );

  test('tom søgning giver null (ikke en tom liste)', () => {
    expect(search(model, '')).toBeNull();
    expect(search(model, '   ')).toBeNull();
    expect(search(model, null)).toBeNull();
  });

  test('ingen træf giver en tom liste', () => {
    expect(search(model, 'xyzzy')).toEqual({ results: [], total: 0, category: null });
  });

  test('et resultat har type, id, titel, undertekst og selve tingen', () => {
    const found = search(model, 'chez martin');
    expect(found.total).toBe(1);
    expect(found.results[0]).toMatchObject({
      kind: 'place',
      id: 'r1',
      title: 'Chez Martin',
      data: model.findPlace('r1'),
    });
    expect(found.results[0].subtitle).toMatch(/^Restaurant · \d+ m from Village Gondola lift$/);
  });

  test('navn, der starter med søgningen, før ord i navnet, før "indeholder", før beskrivelse', () => {
    expect(titles(search(model, 'alp'))).toEqual([
      'Alpina Lodge', // navnet starter med "alp"
      'Hotel Alpina', // et ord i navnet starter med "alp"
      'Sealpoint', // navnet indeholder "alp"
      'Chalet Soleil', // kun beskrivelsen nævner "Alps"
    ]);
  });

  test('ved samme slags træf kommer lifter før pister før steder', () => {
    expect(search(model, 'back').results.map((r) => `${r.kind}:${r.title}`)).toEqual([
      'lift:Back Chair',
      'piste:Back Bowl',
      'place:Back Hut',
    ]);
    // "ack" står midt i et ord i alle tre navne.
    expect(search(model, 'ack').results.map((r) => r.kind)).toEqual(['lift', 'piste', 'place']);
  });

  test('et bedre navnetræf på et sted slår et dårligere på en lift', () => {
    // "Summit Café" starter med "summ"; ingen lift gør.
    expect(search(model, 'summ').results[0]).toMatchObject({ kind: 'place', title: 'Summit Café' });
    // "Village Gondola" har kun "gondola" som andet ord; der findes ingen steder med det navn.
    expect(search(model, 'gondola').results[0]).toMatchObject({ kind: 'lift', title: 'Village Gondola' });
  });

  test('accenter, apostroffer og bindestreger er ligegyldige', () => {
    expect(titles(search(model, 'hotel du'))).toEqual(['Hôtel du Glacier']);
    expect(titles(search(model, 'HÔTEL DU'))).toEqual(['Hôtel du Glacier']);
    expect(titles(search(model, 'l’ava'))).toEqual(["L'Avalanche Café"]);
    expect(titles(search(model, "l'ava"))).toEqual(["L'Avalanche Café"]);
    expect(titles(search(model, 'mont blanc'))).toEqual(['Mont-Blanc Bar']);
    expect(titles(search(model, 'mont-blanc'))).toEqual(['Mont-Blanc Bar']);
    expect(titles(search(model, 'cafe'))).toEqual(expect.arrayContaining(["L'Avalanche Café", 'Summit Café']));
  });

  test('køkkentype findes også: "pizza"', () => {
    // Navnetræf først, derefter stedet der bare serverer pizza.
    expect(titles(search(model, 'pizza'))).toEqual(['Pizza Roma', 'Chez Martin']);
    // OSM skriver "coffee_shop" - understregen tæller som mellemrum.
    expect(titles(search(model, 'coffee shop'))).toEqual(["L'Avalanche Café"]);
  });

  describe('kategoriord', () => {
    test('"hotels" giver alle hoteller og fortæller skærmen, at det er en kategori', () => {
      const found = search(model, 'hotels');
      expect(found.category).toBe('hotel');
      expect(titles(found)).toEqual(['Alpina Lodge', 'Hotel Alpina', 'Hôtel du Glacier']);
    });

    test.each([
      ['restaurants', 'restaurant'],
      ['food', 'restaurant'],
      ['eat', 'restaurant'],
      ['coffee', 'cafe'],
      ['café', 'cafe'],
      ['bar', 'apres_ski'],
      ['après-ski', 'apres_ski'],
      ['drinks', 'apres_ski'],
      ['accommodation', 'hotel'],
      ['ski rental', 'ski_rental'],
      ['hire', 'ski_rental'],
      ['toilets', 'toilets'],
      ['wc', 'toilets'],
      ['WC', 'toilets'],
      ['restroom', 'toilets'],
      ['lifts', 'lifts'],
      ['gondola', 'lifts'],
      ['cable car', 'lifts'],
      // Mindst fire bogstaver af et kategoriord er nok.
      ['rest', 'restaurant'],
      ['hote', 'hotel'],
      ['toil', 'toilets'],
      ['chairl', 'lifts'],
    ])('"%s" -> %s', (query, category) => {
      expect(search(model, query).category).toBe(category);
    });

    test.each([['ba'], ['hot'], ['caf'], ['li'], ['w'], ['back'], ['skilift']])(
      '"%s" er ikke et kategoriord',
      (query) => {
        expect(search(model, query).category).toBeNull();
      }
    );

    test('"ba" bliver ikke til alle barer - kun navne, der matcher', () => {
      expect(titles(search(model, 'ba'))).toEqual([
        'Back Chair',
        'Back Bowl',
        'Back Hut',
        'Mont-Blanc Bar', // ordet "Bar" starter med "ba"
        'Rodelbahn', // "ba" midt i navnet
      ]);
    });

    test('"wc" og "toilets" har ingen rækker - toiletter er et kortlag, ikke steder', () => {
      expect(search(model, 'wc')).toEqual({ results: [], total: 0, category: 'toilets' });
      expect(search(model, 'toilets')).toEqual({ results: [], total: 0, category: 'toilets' });
    });

    test('"lifts" giver alle lifter i alfabetisk rækkefølge', () => {
      const found = search(model, 'lifts');
      expect(found.results.map((r) => `${r.kind}:${r.title}`)).toEqual(['lift:Back Chair', 'lift:Village Gondola']);
    });

    test('"sled" finder kælkebanen, selvom den hedder noget andet', () => {
      for (const query of ['sled', 'sledding', 'sledge', 'toboggan', 'tobo']) {
        const found = search(model, query);
        expect(found.results).toHaveLength(1);
        expect(found.results[0]).toMatchObject({ kind: 'piste', title: 'Rodelbahn' });
        expect(found.results[0].subtitle).toMatch(/^Sled run · /);
      }
    });
  });

  describe('lifter og pister', () => {
    test('liftens undertekst viser type og højde', () => {
      expect(search(model, 'village gondola').results[0].subtitle).toBe('Gondola · 1500 → 2200 m');
      // Stoleliften er tegnet fra top til bund, men højderne står altid nedefra og op.
      expect(search(model, 'back chair').results[0].subtitle).toBe('Chairlift · 1800 → 2200 m');
    });

    test('uden højder står der kun typen', () => {
      const flat = buildModel(miniResort({ id: 'mini-flat', elevations: {} }));
      expect(search(flat, 'village gondola').results[0].subtitle).toBe('Gondola');
    });

    test('samme pistenavn flere steder vises kun én gang - den længste', () => {
      const found = search(model, 'home run');
      expect(found.total).toBe(1);
      const [result] = found.results;
      expect(result).toMatchObject({ kind: 'piste', title: 'Home Run' });
      // Den lange består af to stykker (blue-1 + blue-2); den korte er "blue-far".
      expect(result.data.pistes.map((p) => p.id).sort()).toEqual(['blue-1', 'blue-2']);
      expect(result.subtitle).toMatch(/^Blue \(easy\) · 2\.\d km$/);
    });

    test('pistens undertekst følger landets farver', () => {
      const canada = buildModel(miniResort({ id: 'mini-canada', convention: 'north_america' }));
      expect(search(canada, 'home run').results[0].subtitle).toMatch(/^Green circle \(easy\) · /);
      expect(search(canada, 'back bowl').results[0].subtitle).toMatch(/^Blue square \(intermediate\) · /);
    });
  });

  test('limit skærer listen af, men total tæller alle træf', () => {
    const found = search(model, 'a', 3);
    expect(found.results).toHaveLength(3);
    expect(found.total).toBeGreaterThan(3);
    expect(search(model, 'a', 1000).results).toHaveLength(found.total);
  });
});

describe('search i Verbier (de rigtige data)', () => {
  const model = buildModel(verbier);

  test('"medran" finder Médran - lifterne først', () => {
    const found = search(model, 'medran');
    expect(found.results.slice(0, 2).map((r) => `${r.kind}:${r.title}`)).toEqual(['lift:Médran 2', 'lift:Médran 4']);
    expect(titles(found)).toContain('Médran Café');
    expect(found.results[0].subtitle).toBe('Gondola · 1529 → 2165 m');
    // Med og uden accent giver det samme.
    expect(titles(search(model, 'Médran'))).toEqual(titles(found));
  });

  test('"mont fort" finder Mont-Fort med bindestreg og Mont Fort uden', () => {
    const found = search(model, 'mont fort');
    expect(found.results[0]).toMatchObject({ kind: 'lift', title: 'Mont-Fort' });
    expect(titles(found)).toEqual(expect.arrayContaining(['Cabane Mont Fort', 'Café du Mont-Fort', 'Pub Mont Fort']));
  });

  test('"l’av" (iPhones apostrof) finder L\'Aviation', () => {
    const found = search(model, 'l’av');
    expect(found.results.map((r) => `${r.kind}:${r.title}`)).toEqual(["lift:L'Aviation"]);
    expect(search(model, "l'av").results.map((r) => r.id)).toEqual(found.results.map((r) => r.id));
  });

  test('"chable" finder Le Châble', () => {
    expect(titles(search(model, 'chable'))).toEqual(
      expect.arrayContaining(['Châble - Verbier', 'Châble - Mayens de Bruson', 'Itinéraire Le Châble'])
    );
  });

  test('"hotels" giver alle hoteller', () => {
    const found = search(model, 'hotels', 1000);
    const hotels = model.allPlaces.filter((p) => placeCategory(p) === 'hotel');
    expect(found.category).toBe('hotel');
    expect(hotels.length).toBeGreaterThan(100);
    expect(found.results.map((r) => r.id)).toEqual(expect.arrayContaining(hotels.map((p) => p.id)));
  });

  test('"wc" er kortlaget med toiletter', () => {
    expect(search(model, 'wc')).toEqual({ results: [], total: 0, category: 'toilets' });
  });

  test('"lifts" giver alle 47 lifter', () => {
    const found = search(model, 'lifts', 1000);
    expect(found.category).toBe('lifts');
    expect(found.results.filter((r) => r.kind === 'lift')).toHaveLength(model.lifts.length);
    expect(model.lifts).toHaveLength(47);
  });

  test('"sled" finder kælkebanen i La Tzoumaz', () => {
    const found = search(model, 'sled');
    expect(found.results).toHaveLength(1);
    expect(found.results[0]).toMatchObject({ kind: 'piste', title: 'Piste de luge de La Tzoumaz' });
    expect(found.results[0].subtitle).toMatch(/^Sled run · \d\.\d km$/);
  });

  test('"pizza" finder steder ud fra køkkentypen', () => {
    expect(titles(search(model, 'pizza'))).toEqual(expect.arrayContaining(['Borsalino', 'Fer à Cheval']));
  });

  test('"Moneyeu" findes tre steder på bjerget, men står kun én gang på listen', () => {
    const same = model.pisteGroups.filter((g) => g.name === 'Moneyeu' && g.difficulty === 'easy');
    expect(same.length).toBeGreaterThan(1);
    const rows = search(model, 'moneyeu', 1000).results.filter((r) => r.kind === 'piste' && r.title === 'Moneyeu');
    expect(rows).toHaveLength(1);
    expect(rows[0].data.meters).toBe(Math.max(...same.map((g) => g.meters)));
  });

  test('et udvalgt sted står ikke også som almindeligt sted', () => {
    // "Le Carrefour" over Verbier er både kurateret (id 3) og et OSM-sted
    // (rest-54). Der findes også et andet Le Carrefour nede i dalen (rest-53).
    const ids = search(model, 'le carrefour').results.map((r) => r.id);
    expect(ids).toContain('3');
    expect(ids).toContain('rest-53');
    expect(ids).not.toContain('rest-54');
  });

  test('stedets undertekst siger, hvor langt der er til nærmeste lift', () => {
    const [dany] = search(model, 'chez dany').results;
    expect(dany).toMatchObject({ kind: 'place', id: '2', title: 'Chez Dany' });
    expect(dany.subtitle).toMatch(/^Restaurant · \d+ m from Médran \d lift$/);
  });

  test('ingen træf', () => {
    expect(search(model, 'xyzzy')).toEqual({ results: [], total: 0, category: null });
  });
});
