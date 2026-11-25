import { distanceMeters, lineLengthMeters } from './geo';

// HENT ET VILKÅRLIGT SKIOMRÅDE
//
// Verbier ligger indbygget i appen (data/). Alle andre skiområder hentes,
// når brugeren vælger dem:
//
//   1. Søgning efter området:  OpenSkiMaps søge-API (navn, land, midtpunkt,
//      udstrækning og nøgletal).
//   2. Lifter, pister, steder, toiletter og bynavne:  OpenStreetMap via
//      Overpass API - én forespørgsel for et kvadrat omkring området.
//   3. Højder for hver lifts og pists ender:  Open-Meteos højde-API (samme
//      kilde som for Verbier). Højderne afgør, hvad der er op og ned.
//   4. Tidszone (til "Open now"):  Open-Meteos vejr-API.
//
// Alt er gratis og uden API-nøgle, men serverne har grænser for, hvor meget
// man må hente - derfor gemmes et hentet område på telefonen
// (utils/resortStore.js) og hentes ikke igen.
//
// Resultatet har samme form som det indbyggede Verbier (data/resorts/verbier.js),
// så resten af appen ikke kan se forskel.

const SEARCH_URL = 'https://api.openskimap.org/search';
// Flere servere med de samme data: svarer den første ikke, prøves den næste.
const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// Overpass-serverne afviser kald uden et rigtigt app-navn (telefonens
// standard-"User-Agent" giver fejl 406), så appen siger, hvem den er.
const APP_HEADERS = { 'User-Agent': 'SkiMaps/1.0 (ski resort companion app)' };
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Større områder end dette (radius i meter) hentes ikke: forespørgslen ville
// blive for tung for de gratis servere og for telefonen.
const MAX_RADIUS_M = 16000;
export const MAX_RESORT_RADIUS_M = MAX_RADIUS_M;
const PLACE_MAX_DISTANCE_M = 1000; // steder længere fra lifter/pister hører ikke til området
const SIMPLIFY_TOLERANCE_M = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, options = {}, timeoutMs = 25000, controller = new AbortController()) {
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// --- 1. Søgning ---------------------------------------------------------------

// "ニセコユナイテッド, Niseko United" -> "Niseko United": vælg det første navn
// med latinske bogstaver, hvis der er flere.
function displayName(name) {
  if (!name) return null;
  const parts = name.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.find((part) => /[A-Za-zÀ-ÿ]/.test(part)) || parts[0] || null;
}

function sumStats(byGroup, field) {
  return Object.values(byGroup || {}).reduce((sum, item) => sum + (item[field] || 0), 0);
}

// Gør et søgeresultat fra OpenSkiMap til det, resort-vælgeren viser.
function toArea(feature) {
  const p = feature.properties || {};
  const hint = p.viewportHint || {};
  const point = feature.geometry && feature.geometry.type === 'Point' ? feature.geometry.coordinates : null;
  const center = Array.isArray(hint.center) ? hint.center : point;
  const name = displayName(p.name);
  if (!name || !center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return null;
  const place = (p.places || [])[0] || {};
  const localized = (place.localized && place.localized.en) || {};
  const downhill = p.statistics?.runs?.byActivity?.downhill?.byDifficulty;
  const width = hint.rotatedWidthMeters || 0;
  const height = hint.rotatedHeightMeters || 0;
  return {
    id: p.id,
    name,
    country: localized.country || place.iso3166_1Alpha2 || '',
    region: localized.region || '',
    status: p.status || 'operating',
    convention: p.runConvention || 'europe',
    center: { latitude: center[1], longitude: center[0] },
    // Kassen er drejet, så vi bruger dens diagonal som radius for at få alt med.
    // Kender vi ikke udstrækningen, gætter vi på et mellemstort område.
    radiusMeters: width && height ? Math.sqrt(width * width + height * height) / 2 : 4000,
    liftCount: sumStats(p.statistics?.lifts?.byType, 'count'),
    pisteKm: Math.round(sumStats(downhill, 'lengthInKm')),
    hasDownhill: (p.activities || []).includes('downhill'),
  };
}

const plain = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Skiområder, der matcher søgningen. Dem, hvis navn begynder med det søgte,
// står først (søger man "Åre", skal Åre stå over et større område, der bare
// ligner); derefter OpenSkiMaps egen rækkefølge.
export async function searchSkiAreas(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const features = await fetchJson(`${SEARCH_URL}?query=${encodeURIComponent(q)}`, {}, 12000);
  const wanted = plain(q);
  const rank = (area) => {
    const name = plain(area.name);
    if (name.startsWith(wanted)) return 0;
    return name.includes(wanted) ? 1 : 2;
  };
  return (Array.isArray(features) ? features : [])
    .filter((feature) => feature.properties?.type === 'skiArea')
    .map(toArea)
    .filter((area) => area && area.hasDownhill && area.status !== 'abandoned' && area.liftCount > 0)
    .map((area, order) => ({ area, order }))
    .sort((a, b) => rank(a.area) - rank(b.area) || a.order - b.order)
    .map(({ area }) => area);
}

// --- 2. OpenStreetMap ------------------------------------------------------------

function bboxAround(center, radiusMeters) {
  const dLat = radiusMeters / 111320;
  const dLon = radiusMeters / (111320 * Math.cos((center.latitude * Math.PI) / 180));
  return {
    south: center.latitude - dLat,
    north: center.latitude + dLat,
    west: center.longitude - dLon,
    east: center.longitude + dLon,
  };
}

function overpassQuery({ south, west, north, east }) {
  const box = [south, west, north, east].map((n) => n.toFixed(5)).join(',');
  return `[out:json][timeout:60][bbox:${box}];
(
  way["piste:type"~"^(downhill|sled|skitour)$"];
  way["aerialway"~"^(gondola|cable_car|chair_lift|mixed_lift|drag_lift|t-bar|j-bar|platter|rope_tow|magic_carpet)$"];
);
out tags geom qt;
(
  nwr["amenity"~"^(restaurant|cafe|bar|pub|toilets|ski_rental)$"];
  nwr["tourism"~"^(hotel|guest_house|hostel|alpine_hut)$"];
  nwr["shop"="ski"];
  node["place"~"^(town|village)$"];
);
out tags center qt;`;
}

// Overpass-serverne er gratis og ofte langsomme eller overbelastede. Vi
// spørger den første, og svarer den ikke inden for 15 sekunder, spørger vi
// også den næste (og så den tredje). Det første brugbare svar vinder, og de
// andre kald afbrydes.
const OVERPASS_STAGGER_MS = 15000;
const OVERPASS_TIMEOUT_MS = 80000;

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const controllers = [];
    let timer = null;
    let next = 0; // næste server, der skal spørges
    let failures = 0;
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      controllers.forEach((controller) => controller.abort());
      fn(value);
    };
    const ask = () => {
      clearTimeout(timer);
      if (done || next >= OVERPASS_URLS.length) return;
      const url = OVERPASS_URLS[next];
      next += 1;
      // Er der flere servere, så spørg den næste, hvis denne er længe om det.
      if (next < OVERPASS_URLS.length) timer = setTimeout(ask, OVERPASS_STAGGER_MS);
      const controller = new AbortController();
      controllers.push(controller);
      fetchJson(
        url,
        {
          method: 'POST',
          headers: { ...APP_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        },
        OVERPASS_TIMEOUT_MS,
        controller
      )
        .then((data) => {
          // En overbelastet server kan svare 200 med en fejltekst i "remark"
          // og kun en del af dataene - det svar må vi ikke bruge.
          if (!data || !Array.isArray(data.elements) || data.remark) throw new Error('incomplete answer');
          finish(resolve, data);
        })
        .catch((error) => {
          failures += 1;
          if (failures === OVERPASS_URLS.length) finish(reject, error);
          // Fejlede serveren med det samme (fx uden net), så vent ikke på uret.
          else if (!done) ask();
        });
    };
    ask();
  });
}

const LIFT_TYPES = { 't-bar': 'drag_lift', 'j-bar': 'drag_lift' };

// Navnet på en lift, pist eller et sted. Er det lokale navn skrevet uden
// latinske bogstaver (fx japansk), bruges det engelske, hvis OpenStreetMap
// har et - appens brugerflade er på engelsk.
function nameOf(tags, fallbackKey) {
  const local = (fallbackKey && tags[fallbackKey]) || tags.name;
  const english = tags['name:en'];
  if (local && !/[A-Za-zÀ-ÿ]/.test(local) && english) return english;
  return local || english || null;
}
const DIFFICULTIES = ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'freeride', 'extreme'];
const round5 = (n) => Math.round(n * 1e5) / 1e5;

// Douglas-Peucker: fjern punkter, der ligger (næsten) på en ret linje mellem
// deres naboer. Halverer typisk antallet af punkter uden synlig forskel.
function simplify(points, toleranceMeters) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const a = points[first];
    const b = points[last];
    const scale = Math.cos((a.latitude * Math.PI) / 180);
    const bx = (b.longitude - a.longitude) * scale;
    const by = b.latitude - a.latitude;
    const length2 = bx * bx + by * by;
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const px = (points[i].longitude - a.longitude) * scale;
      const py = points[i].latitude - a.latitude;
      const t = length2 ? Math.max(0, Math.min(1, (px * bx + py * by) / length2)) : 0;
      const dx = px - t * bx;
      const dy = py - t * by;
      const meters = Math.sqrt(dx * dx + dy * dy) * 111320;
      if (meters > worst) {
        worst = meters;
        index = i;
      }
    }
    if (worst > toleranceMeters && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function toLine(way) {
  const tags = way.tags || {};
  const raw = (way.geometry || []).map((p) => ({ latitude: round5(p.lat), longitude: round5(p.lon) }));
  if (raw.length < 2) return null;
  if (tags.access === 'private' || tags.access === 'no') return null;
  const closed = raw[0].latitude === raw[raw.length - 1].latitude && raw[0].longitude === raw[raw.length - 1].longitude;
  const coordinates = simplify(raw, SIMPLIFY_TOLERANCE_M);

  if (tags.aerialway) {
    return {
      kind: 'lift',
      id: `w${way.id}`,
      name: nameOf(tags) || tags.ref || 'Lift',
      liftType: LIFT_TYPES[tags.aerialway] || tags.aerialway,
      coordinates,
    };
  }
  // Pister tegnet som flader (omrids) i stedet for linjer kan vi ikke bruge.
  if (closed || tags.area === 'yes') return null;
  const type = tags['piste:type'];
  if (lineLengthMeters(coordinates) < 30) return null;
  return {
    kind: 'piste',
    id: `w${way.id}`,
    name: nameOf(tags, 'piste:name') || (tags.ref ? `Piste ${tags.ref}` : null),
    type, // 'downhill' | 'sled' | 'skitour'
    difficulty: DIFFICULTIES.includes(tags['piste:difficulty']) ? tags['piste:difficulty'] : 'unknown',
    coordinates,
  };
}

const PLACE_CATEGORY = {
  restaurant: 'restaurant',
  alpine_hut: 'restaurant',
  cafe: 'cafe',
  bar: 'apres_ski',
  pub: 'apres_ski',
  hotel: 'hotel',
  guest_house: 'hotel',
  hostel: 'hotel',
  ski_rental: 'ski_rental',
  ski: 'ski_rental',
};

function addressOf(tags) {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  return street || null;
}

function toPoint(element) {
  const position = element.type === 'node' ? element : element.center;
  if (!position) return null;
  const tags = element.tags || {};
  const point = { latitude: round5(position.lat), longitude: round5(position.lon) };
  const id = `${element.type[0]}${element.id}`;
  if (tags.place) {
    return nameOf(tags) ? { kind: 'town', id, name: nameOf(tags), population: Number(tags.population) || 0, rank: tags.place === 'town' ? 1 : 0, ...point } : null;
  }
  if (tags.amenity === 'toilets') {
    return tags.access === 'private' ? null : { kind: 'toilet', id, ...point };
  }
  const category = PLACE_CATEGORY[tags.amenity] || PLACE_CATEGORY[tags.tourism] || PLACE_CATEGORY[tags.shop];
  const name = nameOf(tags);
  if (!category || !name) return null;
  return {
    kind: 'place',
    id,
    name,
    category,
    ...point,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    openingHours: tags.opening_hours || null,
    cuisine: tags.cuisine || null,
    address: addressOf(tags),
  };
}

// Hurtigt "er der en lift eller pist i nærheden?": alle linjepunkter lagt i
// et gitter på ca. 500 m.
function nearLines(lines) {
  const CELL = 0.005;
  const key = (lat, lon) => `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
  const grid = new Map();
  for (const line of lines) {
    for (const p of line.coordinates) {
      const k = key(p.latitude, p.longitude);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(p);
    }
  }
  return (point, maxMeters) => {
    const reach = Math.ceil(maxMeters / 111320 / CELL) + 1;
    const lat0 = Math.floor(point.latitude / CELL);
    const lon0 = Math.floor(point.longitude / CELL);
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach * 2; j <= reach * 2; j++) {
        const cell = grid.get(`${lat0 + i}:${lon0 + j}`);
        if (cell && cell.some((p) => distanceMeters(p, point) <= maxMeters)) return true;
      }
    }
    return false;
  };
}

// --- 3. Højder --------------------------------------------------------------------

// Højden i meter for en liste af punkter (Open-Meteo tager 100 ad gangen).
//
// Open-Meteo tæller hvert punkt som ét kald og tillader ca. 600 i minuttet.
// De første 500 punkter hentes derfor med det samme; har området flere, går
// resten i roligt tempo. Punkter, vi ikke får svar på, får højden null - så
// bruger appen den retning, linjen er tegnet i.
const FAST_POINTS = 500;
const SLOW_GAP_MS = 10500;

async function fetchElevations(points, onProgress) {
  const result = new Array(points.length).fill(null);
  const BATCH = 100;
  let waits = 0; // hvor mange gange vi har måttet vente på kvoten
  for (let start = 0; start < points.length; start += BATCH) {
    if (start >= FAST_POINTS) await sleep(SLOW_GAP_MS);
    const batch = points.slice(start, start + BATCH);
    const url =
      `${ELEVATION_URL}?latitude=${batch.map((p) => p.latitude).join(',')}` +
      `&longitude=${batch.map((p) => p.longitude).join(',')}`;
    let data = null;
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      try {
        data = await fetchJson(url, {}, 20000);
      } catch (error) {
        if (error.status === 429) {
          // For mange kald. Minut-kvoten kommer igen efter lidt ventetid, men
          // er time-kvoten brugt, hjælper det ikke at vente - så giv op.
          waits += 1;
          if (waits > 3) return result;
          await sleep(20000);
        } else {
          await sleep(1200);
        }
      }
    }
    if (data && Array.isArray(data.elevation)) {
      data.elevation.forEach((meters, i) => {
        result[start + i] = Number.isFinite(meters) ? Math.round(meters) : null;
      });
    }
    if (onProgress) onProgress(Math.min(1, (start + BATCH) / points.length));
    await sleep(150);
  }
  return result;
}

// --- Det hele ------------------------------------------------------------------------

// Henter og bygger ét skiområde. `area` kommer fra searchSkiAreas().
// onProgress(tekst) kaldes undervejs, så skærmen kan vise, hvad der sker.
// Kaster en Error med .code = 'too_large' | 'empty' | 'network' | 'busy'.
export async function downloadResort(area, onProgress = () => {}) {
  const fail = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
  };
  if (area.radiusMeters > MAX_RADIUS_M) {
    throw fail('too_large', `${area.name} is too large to download.`);
  }

  onProgress('Finding lifts and pistes...');
  const radius = Math.max(1500, area.radiusMeters + 600);
  let osm;
  try {
    osm = await fetchOverpass(overpassQuery(bboxAround(area.center, radius)));
  } catch {
    throw fail('network', 'Could not reach the map server.');
  }

  const lines = [];
  const points = [];
  for (const element of osm.elements || []) {
    if (element.type === 'way' && element.geometry && (element.tags?.aerialway || element.tags?.['piste:type'])) {
      const line = toLine(element);
      if (line) lines.push(line);
    } else {
      const point = toPoint(element);
      if (point) points.push(point);
    }
  }
  const lifts = lines.filter((line) => line.kind === 'lift').map(({ kind, ...lift }) => lift);
  const pistes = lines.filter((line) => line.kind === 'piste').map(({ kind, ...piste }) => piste);
  if (lifts.length === 0 || pistes.length === 0) {
    throw fail('empty', `OpenStreetMap has no lifts or pistes for ${area.name} yet.`);
  }

  // Tidszonen bruges til "Open now". Hentes før højderne, som kan bruge
  // hele minuttets kvote hos Open-Meteo.
  let timeZone = null;
  try {
    const forecast = await fetchJson(
      `${FORECAST_URL}?latitude=${area.center.latitude}&longitude=${area.center.longitude}&current=temperature_2m&timezone=auto`,
      {},
      12000
    );
    timeZone = forecast.timezone || null;
  } catch {
    // Uden tidszone bruger "Open now" telefonens tid.
  }

  onProgress('Looking up elevations...');
  // Start og slut for hver linje - mange ender deler punkt, så slå dem sammen.
  const wanted = new Map();
  // Afrundet til ca. 100 m - højdemodellen er selv kun 90 m fin.
  const endKey = (p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`;
  // Lifterne først: deres top og bund er det vigtigste, hvis vi ikke når alt.
  for (const line of [...lines.filter((l) => l.kind === 'lift'), ...lines.filter((l) => l.kind === 'piste')]) {
    for (const p of [line.coordinates[0], line.coordinates[line.coordinates.length - 1]]) {
      if (!wanted.has(endKey(p))) wanted.set(endKey(p), p);
    }
  }
  const keys = [...wanted.keys()];
  const heights = await fetchElevations([...wanted.values()], (share) =>
    onProgress(`Looking up elevations... ${Math.round(share * 100)}%`)
  );
  const heightOf = new Map(keys.map((key, i) => [key, heights[i]]));
  const elevations = {};
  for (const line of lines) {
    const start = heightOf.get(endKey(line.coordinates[0]));
    const end = heightOf.get(endKey(line.coordinates[line.coordinates.length - 1]));
    if (start !== null && start !== undefined && end !== null && end !== undefined) {
      elevations[line.id] = [start, end];
    }
  }

  // Uden lifternes højder ved vi ikke, hvad der er top og bund, og så bliver
  // ruterne forkerte. Det sker, når højde-tjenestens kvote er brugt op - så
  // hellere sige det end at gemme et halvt område på telefonen. (Mangler kun
  // nogle pister en højde, bruges den retning, pisten er tegnet i.)
  if (lines.some((line) => line.kind === 'lift' && !elevations[line.id])) {
    throw fail('busy', 'The elevation service is busy.');
  }

  onProgress('Sorting places...');
  const isNear = nearLines(lines);
  const seen = new Set();
  const places = points
    .filter((point) => point.kind === 'place' && isNear(point, PLACE_MAX_DISTANCE_M))
    .filter((place) => {
      // Samme sted kan stå både som punkt og bygning i OpenStreetMap.
      const key = `${place.name.toLowerCase()}|${place.category}|${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ kind, ...place }) => place)
    .sort((a, b) => a.name.localeCompare(b.name));
  const toilets = points
    .filter((point) => point.kind === 'toilet' && isNear(point, PLACE_MAX_DISTANCE_M))
    .map(({ kind, ...toilet }) => toilet);
  const towns = points
    .filter((point) => point.kind === 'town' && isNear(point, 1500))
    .sort((a, b) => b.rank - a.rank || b.population - a.population)
    // To navne oven i hinanden kan ikke læses: spring byer over, der ligger
    // tæt på en, vi allerede har med.
    .reduce((kept, town) => (kept.some((other) => distanceMeters(other, town) < 900) ? kept : [...kept, town]), [])
    .slice(0, 5)
    .map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude }));

  // Kortudsnit, der rummer alle lifter og almindelige pister. Skitur-ruter
  // tæller ikke med: de kan gå mange kilometer væk fra selve skiområdet og
  // ville gøre området til en lille klat midt på kortet.
  const all = lines
    .filter((line) => line.kind === 'lift' || line.type === 'downhill')
    .flatMap((line) => line.coordinates);
  const lats = all.map((p) => p.latitude);
  const lons = all.map((p) => p.longitude);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  const region = {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.max(0.02, (north - south) * 1.25),
    longitudeDelta: Math.max(0.02, (east - west) * 1.25),
  };

  // Vejret hentes for den lavest liggende liftstation (landsbyen), ligesom i
  // Verbier.
  let base = area.center;
  let baseHeight = Infinity;
  for (const lift of lifts) {
    const pair = elevations[lift.id];
    if (!pair) continue;
    const firstIsBottom = pair[0] <= pair[1];
    const height = Math.min(pair[0], pair[1]);
    if (height < baseHeight) {
      baseHeight = height;
      base = firstIsBottom ? lift.coordinates[0] : lift.coordinates[lift.coordinates.length - 1];
    }
  }
  return {
    id: area.id,
    name: area.name,
    country: area.country,
    convention: area.convention,
    bundled: false,
    fetchedAt: Date.now(),
    region,
    weatherPoint: { latitude: base.latitude, longitude: base.longitude },
    weatherElevation: Number.isFinite(baseHeight) ? baseHeight : null,
    timeZone,
    towns,
    lifts,
    pistes,
    elevations,
    places,
    pois: [],
    toilets,
    partners: [],
  };
}
