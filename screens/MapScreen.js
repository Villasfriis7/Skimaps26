import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  TouchableOpacity,
  Platform,
  Keyboard,
  Linking,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Circle, Marker, UrlTile } from 'react-native-maps';
import { lifts, pistes, pisteColors, verbierRegion, towns } from '../data/verbierMap';
import { elevations } from '../data/elevations';
import { toilets } from '../data/toilets';
import { friends } from '../data/friends';
import { categoryMeta } from '../data/categoryMeta';
import { useLocation } from '../context/LocationContext';
import { useRoute } from '../context/RouteContext';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { allPlaces, findPlace, placeCategory, nearestLiftStation, liftBottom } from '../utils/places';
import { pisteKind, pisteLabel, liftTypeLabels } from '../utils/pistes';
import { pisteGroups, pisteGroupOf, groupCoordinates } from '../utils/pisteGroups';
import { search } from '../utils/search';
import { isOpenNow } from '../utils/openingHours';
import {
  distanceMeters,
  lineLengthMeters,
  formatDistance,
  formatDuration,
  regionForCoordinates,
} from '../utils/geo';
import { openLink } from '../utils/links';
import { styles, colors } from '../styles/styles';

// Filter-chips øverst på kortet. "toilets" og "friends" er ikke
// stedkategorier fra places.js, men har deres egne datakilder.
const filterChips = [
  { id: 'restaurant', label: 'Restaurants', icon: categoryMeta.restaurant.icon },
  { id: 'cafe', label: 'Cafés', icon: categoryMeta.cafe.icon },
  { id: 'apres_ski', label: 'Après-ski', icon: categoryMeta.apres_ski.icon },
  { id: 'toilets', label: 'Toilets', icon: 'water-outline' },
  { id: 'hotel', label: 'Hotels', icon: categoryMeta.hotel.icon },
  { id: 'ski_rental', label: 'Ski rental', icon: categoryMeta.ski_rental.icon },
  { id: 'friends', label: 'Friends', icon: 'people-outline' },
];

const allOff = Object.fromEntries(filterChips.map((chip) => [chip.id, false]));

// Default: restauranter/caféer, toiletter og venner vist med det samme. De
// øvrige (hoteller er langt de fleste) slås til manuelt for at holde kortet roligt.
const defaultActive = { ...allOff, restaurant: true, cafe: true, toilets: true, friends: true };

// Kun rigtige alpine pister tæller med i tallet - datasættet rummer også
// skitur-ruter og en kælkebane (se utils/pistes.js). Vi viser samlet længde
// og ikke et antal: OSM deler hver pist op i mange stykker.
const pisteKm = Math.round(
  pistes
    .filter((piste) => pisteKind(piste) === 'downhill' && piste.difficulty !== 'freeride')
    .reduce((sum, piste) => sum + lineLengthMeters(piste.coordinates), 0) / 1000
);

const LIFT_COLOR = '#2b3a42';
const LIFT_COLOR_ON_SATELLITE = '#ffffff'; // mørke lifter forsvinder på et satellitfoto

const legendItems = [
  { label: 'Lift', color: LIFT_COLOR, lift: true },
  { label: 'Green · beginner', color: pisteColors.novice },
  { label: 'Blue · easy', color: pisteColors.easy },
  { label: 'Red · intermediate', color: pisteColors.intermediate },
  { label: 'Black · difficult', color: pisteColors.advanced },
  { label: 'Off-piste route', color: pisteColors.freeride, dashed: true },
  { label: 'Ski tour (uphill)', color: pisteColors.unknown, dashed: true },
  { label: 'Sled run', color: colors.sled, dashed: true },
];

// BAGGRUNDSKORT - et snedækket landskab i hele verden, ikke kun i Verbier.
//
// Lagene i terrænvisningen, nederst først:
//   1. Telefonens eget kort (Apple Maps / Google Maps). Det ses kun, hvis
//      lagene ovenpå ikke kan hentes - så er der aldrig en tom flade - og det
//      leverer stednavnene, som Apple tegner oven på alt andet.
//   2. snowTerrain: EOX' "Terrain Light" - hvidt terræn med gråt relief,
//      højdekurver, veje og søer. Dækker hele kloden, zoom 0-18, uden
//      API-nøgle. EOX tillader brug i egne apps mod kildeangivelse og et link
//      til maps.eox.at (se showMapSources). Deres server er "best effort" og
//      kan begrænse trafikken ved høj belastning.
//   3. swissRelief: swisstopos terrænskygge - skarpere relief, men kun i
//      Schweiz. Uden for Schweiz er fliserne gennemsigtige, så lag 2 ses.
//      Kræver teksten "©swisstopo".
//
// (Et fjerde lag - swisstopos landkort, svagt ovenpå helt tæt på - er taget
// ud igen: de halvt synlige stednavne og bygninger lignede en fejl bag
// appens egne navne, og kortet så anderledes ud i Schweiz end alle andre steder.)
//
// Lag-knappen skifter til satellit: telefonens satellitfoto uden lagene ovenpå.
const nativeMapType = {
  terrain: Platform.OS === 'android' ? 'terrain' : 'mutedStandard',
  satellite: 'hybrid',
};

const EOX = 'https://tiles.maps.eox.at/wmts/1.0.0';
const snowTerrain = `${EOX}/terrain-light_3857/default/g/{z}/{y}/{x}.jpg`;
const SNOW_MAX_ZOOM = 18;

const SWISSTOPO = 'https://wmts.geo.admin.ch/1.0.0';
const swissRelief = `${SWISSTOPO}/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/{z}/{x}/{y}.png`;
const MAX_TILE_ZOOM = 19;

// Hvor tæt er der zoomet ind? Styrer stregtykkelse og hvor mange detaljer,
// der vises, så oversigten ikke drukner i streger og nåle.
//   far:  hele skiområdet    mid: et delområde    near: en by / en lift
function zoomLevelFor(region) {
  if (region.latitudeDelta > 0.08) return 'far';
  if (region.latitudeDelta > 0.03) return 'mid';
  return 'near';
}
const PISTE_WIDTH = { far: 3, mid: 3.5, near: 5 };
const LIFT_WIDTH = { far: 1.5, mid: 2, near: 3 };
// Omtrentlig køretid for en lift (m/s), kun til info-kortet.
const LIFT_SPEED = { gondola: 5, cable_car: 7, mixed_lift: 5, chair_lift: 4, platter: 3, drag_lift: 3 };
// Lifter, hvis navn også vises på mellem-zoom (de store, man orienterer sig efter).
const MAIN_LIFTS = new Set(['gondola', 'cable_car', 'mixed_lift']);
// Liftstationernes ringe har radius i meter. Tæt på skal den være mindre,
// ellers fylder de som store bolde.
const STATION_RADIUS = { far: 26, mid: 18, near: 11 };

const middleOf = (coordinates) => coordinates[Math.floor(coordinates.length / 2)];

// Midtpunktet på en lige linje - her står liftens navn, når man er zoomet ind.
function midpointOf(coordinates) {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return {
    latitude: (first.latitude + last.latitude) / 2,
    longitude: (first.longitude + last.longitude) / 2,
  };
}

// Navneskilte til pisterne (kun zoomet helt ind): ét pr. pistenavn, sat midt
// på det længste stykke. OSM-navne som "Piste de Clambin, Hattey" (to navne
// på samme stykke) forkortes til det første, og hvert navn vises kun én gang,
// så skiltene ikke ligger oven i hinanden.
const pisteLabels = (() => {
  const byName = new Map();
  for (const group of pisteGroups) {
    if (!group.name || group.meters < 400 || group.kind === 'skitour' || group.kind === 'other') continue;
    const label = group.name.split(',')[0].split('(')[0].trim();
    const key = `${label}|${group.difficulty}`;
    const best = byName.get(key);
    if (!best || group.meters > best.group.meters) byName.set(key, { group, label });
  }
  return [...byName.values()].map(({ group, label }) => {
    const longest = group.pistes.reduce((x, y) => (y.coordinates.length > x.coordinates.length ? y : x));
    return { group, label, coordinate: middleOf(longest.coordinates) };
  });
})();

// Navneskilte til lifterne. Lifter, der løber side om side (Médran 2 og 4),
// har samme midtpunkt - de deler ét skilt i stedet for to oven i hinanden.
const liftLabels = (() => {
  const labels = [];
  for (const lift of lifts) {
    const coordinate = midpointOf(lift.coordinates);
    const near = labels.find((label) => distanceMeters(label.coordinate, coordinate) < 90);
    if (near) {
      if (!near.names.includes(lift.name)) near.names.push(lift.name);
      near.main = near.main || MAIN_LIFTS.has(lift.liftType);
    } else {
      labels.push({ lift, coordinate, names: [lift.name], main: MAIN_LIFTS.has(lift.liftType) });
    }
  }
  return labels;
})();

// Alle liftstationer (begge ender af hver lift) - tegnes som små ringe.
const liftStations = lifts.flatMap((lift) => [
  { id: `${lift.id}-a`, ...lift.coordinates[0] },
  { id: `${lift.id}-b`, ...lift.coordinates[lift.coordinates.length - 1] },
]);

const regionAround = (point, delta = 0.012) => ({
  latitude: point.latitude,
  longitude: point.longitude,
  latitudeDelta: delta,
  longitudeDelta: delta,
});

const inRegion = (point, region) =>
  Math.abs(point.latitude - region.latitude) <= region.latitudeDelta / 2 &&
  Math.abs(point.longitude - region.longitude) <= region.longitudeDelta / 2;

// "#1565c0" + 0.35 -> "rgba(21,101,192,0.35)". Bruges til at dæmpe alle andre
// linjer, mens en rute vises, så ruten er det tydeligste på kortet.
function withAlpha(hex, alpha) {
  if (alpha >= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
const DIMMED = 0.35;

function pisteStyle(piste, level) {
  const kind = pisteKind(piste);
  const width = PISTE_WIDTH[level];
  if (kind === 'sled') return { color: colors.sled, width: width - 1, dash: [6, 4] };
  if (kind !== 'downhill') return { color: pisteColors.unknown, width: 1.5, dash: [3, 5] };
  if (piste.difficulty === 'freeride') {
    // Off-piste: tyndere og stiplet, så den ikke ligner en præpareret pist.
    return { color: pisteColors.freeride, width: width - 1, dash: [7, 6] };
  }
  return { color: pisteColors[piste.difficulty] || pisteColors.unknown, width };
}

function liftSubtitle(lift) {
  const type = liftTypeLabels[lift.liftType] || liftTypeLabels.unknown;
  const length = formatDistance(lineLengthMeters(lift.coordinates));
  const [a, b] = elevations[lift.id] || [];
  const height = a !== undefined && Math.abs(a - b) >= 10 ? ` · ${Math.min(a, b)} → ${Math.max(a, b)} m` : '';
  const ride = Math.max(1, Math.round(lineLengthMeters(lift.coordinates) / (LIFT_SPEED[lift.liftType] || 3) / 60));
  return `${type} · ${length}${height} · about ${ride} min ride`;
}

function pisteSubtitle(group) {
  const drop =
    group.top !== undefined && group.top - group.bottom >= 10 ? ` · ↓ ${group.top - group.bottom} m` : '';
  return `${pisteLabel(group.pistes[0])} · ${formatDistance(group.meters)}${drop}`;
}

function placeSubtitle(place) {
  const parts = [categoryMeta[placeCategory(place)]?.singular];
  const open = isOpenNow(place.openingHours);
  if (open !== null) parts.push(open ? 'Open now' : 'Closed now');
  const nearest = nearestLiftStation(place);
  if (nearest) parts.push(`${formatDistance(nearest.meters)} from ${nearest.lift.name} lift`);
  return parts.filter(Boolean).join(' · ');
}

// Ét info-kort nederst på kortet. Alle typer (sted, lift, pist, ven, toilet,
// rute) bruger samme opbygning: titel + luk-knap øverst, handlinger nederst.
function MapCard({ icon, iconColor, title, subtitle, accent, onClose, closeLabel, children }) {
  return (
    <View style={[styles.mapCard, accent && { borderLeftWidth: 4, borderLeftColor: accent }]}>
      <View style={styles.mapCardTop}>
        {icon ? <Ionicons name={icon} size={20} color={iconColor || colors.primary} style={styles.mapCardIcon} /> : null}
        <View style={styles.mapCardText}>
          <Text style={styles.mapCardTitle} numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.mapCardSubtitle} maxFontSizeMultiplier={1.4}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.mapCardClose}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel || 'Close'}
        >
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      {children ? <View style={styles.mapCardActions}>{children}</View> : null}
    </View>
  );
}

function CardButton({ label, icon, primary, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.mapCardButton, primary && styles.mapCardButtonPrimary]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={primary ? colors.white : colors.primary} style={{ marginRight: 6 }} />
      ) : null}
      <Text
        style={[styles.mapCardButtonText, primary && styles.mapCardButtonTextPrimary]}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Rigtigt interaktivt kort over Verbier. Lifter og pister er ægte geodata
// (data/verbierMap.js), steder kommer fra OpenStreetMap (data/places.js) og
// filtreres med chips øverst. Kortet fylder hele skærmen; søgefelt, filtre og
// knapper ligger oven på det.
//
// ÉN måde at vælge på: et tryk på et sted, en lift, en pist, en ven eller et
// toilet viser et info-kort nederst med handlinger. Et tryk på tomt kort
// lukker det igen.
//
// Andre skærme kan styre kortet via route.params (altid sammen med en ny
// `focusKey`, så samme genvej virker flere gange i træk):
//   { focusCategory }  vis kun én kategori ('lifts' = ingen steder)
//   { focusLiftId }    zoom til og markér en lift
//   { focusPlaceId }   zoom til og markér et sted
//   { focusFriendId }  zoom til og markér en ven
//   { showRoute }      zoom til den aktive rute fra RouteContext
export default function MapScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const mapRef = useRef(null);
  const mapReady = useRef(false);
  const pendingRegion = useRef(null);
  const searchInput = useRef(null);
  // Tidspunktet for sidste tryk på en markør/linje - se onMapPress.
  const lastOverlayPress = useRef(0);
  const { permission, location, locate, requestLocation } = useLocation();
  const { activeRoute, clearRoute } = useRoute();
  const { savedPlaces, isSaved, toggleSave } = useSavedPlaces();

  const [active, setActive] = useState(defaultActive);
  // Det, brugeren har trykket på / er sendt hen til: { kind, item }, hvor
  // kind er 'lift' | 'piste' | 'place' | 'friend' | 'toilet'. For 'piste' er
  // item hele pisten (en gruppe af stykker, se utils/pisteGroups.js).
  const [selected, setSelected] = useState(null);
  const [region, setRegion] = useState(verbierRegion);
  const [level, setLevel] = useState(() => zoomLevelFor(verbierRegion));
  const [baseMap, setBaseMap] = useState('terrain'); // 'terrain' | 'satellite'
  const [legendOpen, setLegendOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Kaldes, når brugeren er færdig med at panorere/zoome. Udsnittet gemmes
  // kun som state, når man er zoomet ind (det bruges til pist-skiltene), så
  // oversigten ikke tegnes om ved hver panorering.
  const lastRegion = useRef(verbierRegion);
  const onRegionChangeComplete = (next) => {
    lastRegion.current = next;
    const nextLevel = zoomLevelFor(next);
    setLevel(nextLevel);
    if (nextLevel === 'near') setRegion(next);
  };

  // iOS lægger en linje ØVERST, hver gang dens udseende ændres. Når zoom
  // skifter stregtykkelsen på pister og lifter, ville de derfor lande oven på
  // ruten og markeringen af den valgte linje. `overlayEpoch` tæller op lige
  // efter sådan en ændring og bruges som `key`, så rute og markering tegnes
  // igen bagefter - og dermed ender øverst.
  const [overlayEpoch, setOverlayEpoch] = useState(0);
  const routeShown = Boolean(activeRoute);
  useEffect(() => {
    setOverlayEpoch((epoch) => epoch + 1);
  }, [level, baseMap, routeShown]);

  // Skift mellem terrænkort og satellit. Kortet bygges forfra (key={baseMap}
  // på MapView) i det udsnit, man stod i: på iOS ender flise-lag, der tilføjes
  // efter de andre lag, ellers OVEN PÅ pister og lifter.
  const toggleBaseMap = () => {
    mapReady.current = false;
    setBaseMap((current) => (current === 'terrain' ? 'satellite' : 'terrain'));
  };

  const toggleFilter = (id) => {
    setActive((prev) => ({ ...prev, [id]: !prev[id] }));
    // Slukker man laget for det, der er valgt, forsvinder info-kortet også.
    setSelected((current) => {
      if (!current) return current;
      const layer =
        current.kind === 'friend' ? 'friends' : current.kind === 'toilet' ? 'toilets' : null;
      return layer === id && active[id] ? null : current;
    });
  };

  // Flyt kortet - eller husk udsnittet, hvis kortet ikke er klar endnu (første
  // gang fanen åbnes via en genvej fra en anden skærm).
  const moveTo = useCallback((next) => {
    if (mapReady.current && mapRef.current) {
      mapRef.current.animateToRegion(next, 600);
    } else {
      pendingRegion.current = next;
    }
  }, []);

  const onMapReady = () => {
    mapReady.current = true;
    if (pendingRegion.current) {
      mapRef.current?.animateToRegion(pendingRegion.current, 0);
      pendingRegion.current = null;
    }
  };

  // Vælg noget på kortet. `lastOverlayPress` fortæller onMapPress, at trykket
  // ramte en markør/linje og ikke det tomme kort.
  const select = useCallback((kind, item) => {
    lastOverlayPress.current = Date.now();
    setSelected({ kind, item });
    setLegendOpen(false);
  }, []);

  // Et tryk på tomt kort lukker info-kort, signaturforklaring og tastatur.
  // (iOS sender også kortets onPress lige efter et tryk på en linje eller
  // markør - de tryk springes over.)
  const onMapPress = () => {
    if (Date.now() - lastOverlayPress.current < 400) return;
    setSelected(null);
    setLegendOpen(false);
    Keyboard.dismiss();
  };

  // Bed om lokationstilladelse, første gang kortet åbnes - uden den viser
  // hverken iOS eller Android den blå "her er du"-prik.
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Androids tilbage-knap lukker først søgning/info-kort, før den forlader fanen.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (query || searchFocused) {
          setQuery('');
          Keyboard.dismiss();
          return true;
        }
        if (selected || legendOpen) {
          setSelected(null);
          setLegendOpen(false);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [query, searchFocused, selected, legendOpen])
  );

  // Genveje fra andre skærme (se kommentaren over komponenten).
  const params = route.params;
  const focusKey = params?.focusKey;
  useEffect(() => {
    if (!focusKey) return;
    if (params.focusCategory === 'toilets') {
      // Toiletter er kun relevante tæt på: zoom til brugeren (eller byen).
      // Vælg det nærmeste med det samme, så svaret står i info-kortet.
      setActive({ ...allOff, toilets: true });
      const here = location && distanceMeters(location, verbierRegion) < 30000 ? location : towns[0];
      const nearestToilet = toilets.reduce((best, wc) =>
        distanceMeters(here, wc) < distanceMeters(here, best) ? wc : best
      );
      setSelected({ kind: 'toilet', item: nearestToilet });
      moveTo(regionForCoordinates([here, nearestToilet], 2.2));
    } else if (params.focusCategory) {
      const only = params.focusCategory === 'lifts' ? {} : { [params.focusCategory]: true };
      setActive({ ...allOff, ...only });
      setSelected(null);
      moveTo(verbierRegion);
    } else if (params.focusLiftId) {
      const lift = lifts.find((l) => l.id === params.focusLiftId);
      if (!lift) return;
      setSelected({ kind: 'lift', item: lift });
      moveTo(regionForCoordinates(lift.coordinates));
    } else if (params.focusPisteId) {
      const group = pisteGroupOf(params.focusPisteId);
      if (!group) return;
      setSelected({ kind: 'piste', item: group });
      moveTo(regionForCoordinates(groupCoordinates(group)));
    } else if (params.focusPlaceId) {
      // Stedet vises som valgt markør, uanset hvilke filtre der er slået til -
      // vi tænder ikke for hele kategorien (det gav fx 196 hoteller på kortet).
      const place = findPlace(params.focusPlaceId);
      if (!place) return;
      setSelected({ kind: 'place', item: place });
      moveTo(regionAround(place));
    } else if (params.focusFriendId) {
      const friend = friends.find((f) => f.id === params.focusFriendId);
      if (!friend) return;
      setActive((prev) => ({ ...prev, friends: true }));
      setSelected({ kind: 'friend', item: friend });
      moveTo(regionAround(friend));
    } else if (params.showRoute && activeRoute) {
      setSelected(null);
      moveTo(regionForCoordinates([...activeRoute.coordinates, activeRoute.destination]));
    }
    // Kun focusKey skal udløse genvejen - ikke hver gang ruten/kortet ændrer sig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Kildeangivelse med links. EOX beder om et link tilbage til maps.eox.at,
  // og OpenStreetMap/swisstopo kræver, at kilden kan ses. (Android viser højst
  // tre knapper i en Alert - derfor præcis tre.)
  const showMapSources = () =>
    Alert.alert(
      'Map sources',
      'Lifts, pistes and places: © OpenStreetMap contributors, via OpenSkiMap.\n\n' +
        'Snow terrain: Terrain Light { Data © OpenStreetMap contributors and others, Rendering © EOX }.\n\n' +
        'Switzerland: Federal Office of Topography ©swisstopo.',
      [
        { text: 'OpenStreetMap', onPress: () => openLink('https://www.openstreetmap.org/copyright') },
        { text: 'EOX Maps', onPress: () => openLink('https://maps.eox.at') },
        { text: 'Close', style: 'cancel' },
      ]
    );

  const goToMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    const { point, reason } = await locate();
    setLocating(false);
    if (reason === 'denied') {
      Alert.alert(
        'Location is switched off',
        'Allow location access for SkiMaps in your phone settings to see where you are on the map.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    if (!point) {
      Alert.alert(
        'Could not find your position',
        'Your phone did not get a GPS position. Try again in a moment - it often helps to stand outside.'
      );
      return;
    }
    const meters = distanceMeters(point, verbierRegion);
    if (meters > 30000) {
      Alert.alert(
        'You are not in Verbier',
        `You are about ${formatDistance(meters)} away. The map only has lifts and pistes for the Verbier ski area.`
      );
      return;
    }
    moveTo(regionAround(point));
  };

  // --- Søgning direkte på kortet -------------------------------------------
  const found = useMemo(() => search(query, 20), [query]);

  const closeSearch = () => {
    setQuery('');
    Keyboard.dismiss();
  };

  const openResult = (result) => {
    closeSearch();
    if (result.kind === 'lift') {
      setSelected({ kind: 'lift', item: result.data });
      moveTo(regionForCoordinates(result.data.coordinates));
    } else if (result.kind === 'piste') {
      setSelected({ kind: 'piste', item: result.data });
      moveTo(regionForCoordinates(groupCoordinates(result.data)));
    } else {
      setSelected({ kind: 'place', item: result.data });
      moveTo(regionAround(result.data));
    }
  };

  const showCategory = (category) => {
    closeSearch();
    setSelected(null);
    setActive({ ...allOff, ...(category === 'lifts' ? {} : { [category]: true }) });
    moveTo(verbierRegion);
  };

  // --- Linjer ---------------------------------------------------------------
  // Lifter og pister bygges kun forfra, når zoom-niveauet skifter (tre
  // niveauer) - ikke hver gang man trykker på en filter-chip.
  const liftColor = baseMap === 'satellite' ? LIFT_COLOR_ON_SATELLITE : LIFT_COLOR;
  const lineAlpha = activeRoute ? DIMMED : 1;
  const liftLines = useMemo(
    () =>
      lifts.map((lift) => (
        <Polyline
          key={lift.id}
          coordinates={lift.coordinates}
          strokeColor={withAlpha(liftColor, lineAlpha)}
          strokeWidth={LIFT_WIDTH[level] + (baseMap === 'satellite' ? 0.5 : 0)}
          zIndex={2}
          tappable
          onPress={() => select('lift', lift)}
        />
      )),
    [level, baseMap, liftColor, lineAlpha, select]
  );

  const pisteLines = useMemo(
    () =>
      pistes.map((piste) => {
        const style = pisteStyle(piste, level);
        return (
          <Polyline
            key={piste.id}
            coordinates={piste.coordinates}
            strokeColor={withAlpha(style.color, lineAlpha)}
            strokeWidth={style.width}
            lineDashPattern={style.dash}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
            tappable
            onPress={() => select('piste', pisteGroupOf(piste.id))}
          />
        );
      }),
    [level, lineAlpha, select]
  );

  // Sorte pister kan ikke ses på et mørkt satellitfoto, så dér får de en hvid
  // kant: den samme linje tegnet lidt bredere i hvid nedenunder.
  const blackPisteCasings = useMemo(
    () =>
      baseMap !== 'satellite'
        ? null
        : pistes
            .filter(
              (piste) =>
                pisteKind(piste) === 'downhill' &&
                ['advanced', 'expert', 'extreme'].includes(piste.difficulty)
            )
            .map((piste) => (
              <Polyline
                key={`casing-${piste.id}`}
                coordinates={piste.coordinates}
                strokeColor={colors.white}
                strokeWidth={PISTE_WIDTH[level] + 1.5}
                lineCap="round"
                lineJoin="round"
                zIndex={0}
              />
            )),
    [level, baseMap]
  );

  // Liftstationer som små ringe. Radius er i meter, så de følger zoom af sig selv.
  const stationCircles = useMemo(
    () =>
      liftStations.map((station) => (
        <Circle
          key={station.id}
          center={{ latitude: station.latitude, longitude: station.longitude }}
          radius={STATION_RADIUS[level]}
          fillColor={colors.white}
          strokeColor={LIFT_COLOR}
          strokeWidth={2}
          zIndex={3}
        />
      )),
    [level]
  );

  // Den valgte lift/pist: mørk kant, hvid kant og så linjen selv i sin egen
  // farve øverst - en rød pist bliver ved med at være rød, når den er valgt.
  const selectedLines = useMemo(() => {
    if (!selected || (selected.kind !== 'lift' && selected.kind !== 'piste')) return null;
    const parts =
      selected.kind === 'lift'
        ? [{ id: selected.item.id, coordinates: selected.item.coordinates, color: liftColor, width: LIFT_WIDTH[level] + 1.5 }]
        : selected.item.pistes.map((piste) => {
            const style = pisteStyle(piste, level);
            return { id: piste.id, coordinates: piste.coordinates, color: style.color, width: style.width + 1 };
          });
    return parts.flatMap((part) => [
      <Polyline
        key={`sel-a-${part.id}-${overlayEpoch}`}
        coordinates={part.coordinates}
        strokeColor={colors.deep}
        strokeWidth={part.width + 9}
        lineCap="round"
        lineJoin="round"
        zIndex={4}
      />,
      <Polyline
        key={`sel-b-${part.id}-${overlayEpoch}`}
        coordinates={part.coordinates}
        strokeColor={colors.white}
        strokeWidth={part.width + 5}
        lineCap="round"
        lineJoin="round"
        zIndex={5}
      />,
      <Polyline
        key={`sel-c-${part.id}-${overlayEpoch}`}
        coordinates={part.coordinates}
        strokeColor={part.color}
        strokeWidth={part.width}
        lineCap="round"
        lineJoin="round"
        zIndex={6}
      />,
    ]);
  }, [selected, level, liftColor, overlayEpoch]);

  // --- Markører ---------------------------------------------------------------
  // Steder: dem, filtrene viser, plus gemte steder (altid synlige, med hjerte).
  // Det valgte sted tegnes for sig selv længere nede, så det ligger øverst.
  const savedIds = useMemo(() => new Set(savedPlaces.map((place) => place.id)), [savedPlaces]);
  const selectedPlaceId = selected?.kind === 'place' ? selected.item.id : null;

  const placeMarkers = useMemo(() => {
    const compact = level === 'far';
    return allPlaces
      .filter((place) => place.id !== selectedPlaceId && (active[place.category] || savedIds.has(place.id)))
      .map((place) => {
        const meta = categoryMeta[place.category];
        const saved = savedIds.has(place.id);
        const color = saved ? colors.saved : meta.color;
        return (
          <Marker
            // `key` skifter med zoom-niveauet, fordi Android ellers ikke
            // tegner en markør om.
            key={`${place.id}-${compact ? 'dot' : 'full'}-${saved ? 's' : 'n'}`}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={saved ? 12 : 10}
            tracksViewChanges={false}
            onPress={() => select('place', place)}
          >
            {/* Den gennemsigtige ramme gør trykfladen større end selve prikken. */}
            <View style={compact ? styles.markerHitSmall : styles.markerHit}>
              {compact ? (
                <View style={[styles.placeDotSmall, { backgroundColor: color }]} />
              ) : (
                <View style={[styles.placeDot, { backgroundColor: color }]}>
                  <Ionicons name={saved ? 'heart' : meta.icon.replace('-outline', '')} size={14} color={colors.white} />
                </View>
              )}
            </View>
          </Marker>
        );
      });
  }, [active, level, savedIds, selectedPlaceId, select]);

  const toiletMarkers = useMemo(() => {
    if (!active.toilets) return null;
    const compact = level === 'far';
    return toilets.map((wc) => (
      <Marker
        key={`${wc.id}-${compact ? 'dot' : 'full'}`}
        coordinate={{ latitude: wc.latitude, longitude: wc.longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={11}
        tracksViewChanges={false}
        onPress={() => select('toilet', wc)}
      >
        <View style={compact ? styles.markerHitSmall : styles.markerHit}>
          {compact ? (
            <View style={[styles.placeDotSmall, styles.toiletDotSmall]} />
          ) : (
            <View style={styles.toiletMarker}>
              <Text style={styles.toiletMarkerText} maxFontSizeMultiplier={1.2}>
                WC
              </Text>
            </View>
          )}
        </View>
      </Marker>
    ));
  }, [active.toilets, level, select]);

  const friendMarkers = useMemo(
    () =>
      active.friends
        ? friends.map((friend) => (
            <Marker
              key={friend.id}
              coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={14}
              tracksViewChanges={false}
              onPress={() => select('friend', friend)}
            >
              <View style={styles.markerHit}>
                <View
                  style={[
                    styles.friendMarker,
                    { backgroundColor: friend.color, opacity: friend.online ? 1 : 0.6 },
                  ]}
                >
                  <Text style={styles.friendMarkerText} maxFontSizeMultiplier={1.2}>
                    {friend.initials}
                  </Text>
                </View>
              </View>
            </Marker>
          ))
        : null,
    [active.friends, select]
  );

  // Navneskilte: lifter altid, når man er zoomet ind; pister kun dem i udsnittet.
  const nameLabels = useMemo(() => {
    if (level === 'far') return null;
    const liftNameLabels = liftLabels
      .filter((label) => level === 'near' || label.main)
      .map(({ lift, coordinate, names }) => (
        <Marker
          key={`label-${lift.id}`}
          coordinate={coordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={8}
          tracksViewChanges={false}
          onPress={() => select('lift', lift)}
        >
          <Text style={styles.liftLabel} maxFontSizeMultiplier={1.2}>
            {names.join(' · ')}
          </Text>
        </Marker>
      ));
    const pisteNameLabels = (level === 'near' ? pisteLabels : [])
      .filter(({ coordinate }) => inRegion(coordinate, region))
      .slice(0, 30)
      .map(({ group, label, coordinate }) => (
        <Marker
          key={`piste-label-${group.id}`}
          coordinate={coordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={7}
          tracksViewChanges={false}
          onPress={() => select('piste', group)}
        >
          <View style={styles.pisteLabel}>
            <View style={[styles.pisteLabelDot, { backgroundColor: pisteStyle(group.pistes[0], 'near').color }]} />
            <Text style={styles.pisteLabelText} maxFontSizeMultiplier={1.2}>
              {label}
            </Text>
          </View>
        </Marker>
      ));
    return [...pisteNameLabels, ...liftNameLabels];
  }, [level, region, select]);

  // --- Info-kort ------------------------------------------------------------
  const routeTo = (destination) => navigation.navigate('Route', { destination });

  const renderSelectedCard = () => {
    if (!selected) return null;
    const { kind, item } = selected;
    const close = () => setSelected(null);
    if (kind === 'lift') {
      return (
        <MapCard icon="triangle-outline" title={item.name} subtitle={liftSubtitle(item)} onClose={close}>
          <CardButton
            primary
            icon="navigate"
            label="Route to lift"
            onPress={() => routeTo({ id: `lift-${item.id}`, name: `${item.name} lift`, ...liftBottom(item) })}
          />
        </MapCard>
      );
    }
    if (kind === 'piste') {
      return (
        <MapCard
          icon="ellipse"
          iconColor={pisteStyle(item.pistes[0], 'near').color}
          title={item.name || 'Unnamed piste'}
          subtitle={pisteSubtitle(item)}
          onClose={close}
        />
      );
    }
    if (kind === 'place') {
      const saved = isSaved(item.id);
      return (
        <MapCard
          icon={categoryMeta[placeCategory(item)]?.icon}
          title={item.name}
          subtitle={placeSubtitle(item)}
          onClose={close}
        >
          <CardButton primary icon="navigate" label="Route" onPress={() => routeTo(item)} />
          <CardButton label="Details" onPress={() => navigation.navigate('POIDetail', { poi: item })} />
          <TouchableOpacity
            style={styles.mapCardIconButton}
            onPress={() => toggleSave(item)}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved places' : 'Save place'}
            accessibilityState={{ selected: saved }}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? colors.saved : colors.primary} />
          </TouchableOpacity>
        </MapCard>
      );
    }
    if (kind === 'friend') {
      const away = location ? ` · ${formatDistance(distanceMeters(location, item))} away` : '';
      return (
        <MapCard
          icon="person-circle-outline"
          title={item.name}
          subtitle={`${item.status} · ${item.online ? 'online' : 'offline'}${away}`}
          onClose={close}
        >
          <CardButton
            primary
            icon="navigate"
            label={`Route to ${item.name}`}
            onPress={() => routeTo({ id: `friend-${item.id}`, name: item.name, latitude: item.latitude, longitude: item.longitude })}
          />
        </MapCard>
      );
    }
    // toilet
    const nearest = nearestLiftStation(item);
    const toiletAway =
      location && distanceMeters(location, item) < 30000
        ? `${formatDistance(distanceMeters(location, item))} from you`
        : null;
    return (
      <MapCard
        icon="water-outline"
        title="Public toilet"
        subtitle={[toiletAway, nearest ? `${formatDistance(nearest.meters)} from ${nearest.lift.name} lift` : null]
          .filter(Boolean)
          .join(' · ')}
        onClose={close}
      >
        <CardButton
          primary
          icon="navigate"
          label="Route"
          onPress={() => routeTo({ id: item.id, name: 'Public toilet', latitude: item.latitude, longitude: item.longitude })}
        />
      </MapCard>
    );
  };

  const selectedPoint =
    selected && ['place', 'friend', 'toilet'].includes(selected.kind) ? selected.item : null;
  const searching = found !== null;
  const filtersChanged = filterChips.some((chip) => active[chip.id] !== defaultActive[chip.id]);

  const showWholeArea = () => {
    setLegendOpen(false);
    moveTo(verbierRegion);
  };

  return (
    <View style={styles.mapScreen}>
      {isFocused && baseMap === 'satellite' ? <StatusBar style="light" /> : null}

      <View style={styles.mapContainer}>
        <MapView
          key={baseMap}
          ref={mapRef}
          style={styles.map}
          initialRegion={lastRegion.current}
          mapType={nativeMapType[baseMap]}
          showsUserLocation={permission === 'granted'}
          showsMyLocationButton={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
          showsTraffic={false}
          showsCompass
          toolbarEnabled={false}
          moveOnMarkerPress={false}
          minZoomLevel={10}
          maxZoomLevel={18}
          onMapReady={onMapReady}
          onPress={onMapPress}
          onRegionChangeComplete={onRegionChangeComplete}
        >
          {/* Rækkefølgen her er lagenes rækkefølge, nederst først. zIndex gør
              det samme på Android; på iOS er det rækkefølgen, der tæller. */}
          {baseMap === 'terrain' && (
            <UrlTile urlTemplate={snowTerrain} maximumZ={SNOW_MAX_ZOOM} tileSize={256} zIndex={-3} />
          )}
          {baseMap === 'terrain' && (
            <UrlTile urlTemplate={swissRelief} maximumZ={MAX_TILE_ZOOM} tileSize={256} zIndex={-2} />
          )}

          {/* Pister (farvet efter sværhedsgrad), lifter ovenpå, stationer øverst */}
          {blackPisteCasings}
          {pisteLines}
          {liftLines}
          {stationCircles}
          {selectedLines}

          {/* Aktiv rute fra rutefindingen - hvid kant under en tydelig farve */}
          {activeRoute && activeRoute.coordinates.length > 1 && (
            <React.Fragment key={`route-${overlayEpoch}`}>
              <Polyline
                coordinates={activeRoute.coordinates}
                strokeColor={colors.white}
                strokeWidth={11}
                lineCap="round"
                lineJoin="round"
                zIndex={7}
              />
              <Polyline
                coordinates={activeRoute.coordinates}
                strokeColor={colors.route}
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
                zIndex={8}
              />
            </React.Fragment>
          )}

          {/* Vores egne bynavne for skiområdets byer. På satellit er telefonens
              egne stednavne tydelige nok. */}
          {baseMap === 'terrain' &&
            towns.map((town) => (
              <Marker
                key={town.id}
                coordinate={{ latitude: town.latitude, longitude: town.longitude }}
                // Navnet står lige over byens punkt, så klyngen af markører
                // i byen ikke dækker det.
                anchor={{ x: 0.5, y: 1.9 }}
                zIndex={6}
                tracksViewChanges={false}
                onPress={onMapPress}
              >
                <Text style={styles.townLabel} maxFontSizeMultiplier={1.2}>
                  {town.name}
                </Text>
              </Marker>
            ))}

          {nameLabels}
          {placeMarkers}
          {toiletMarkers}
          {friendMarkers}

          {/* Det valgte sted/ven/toilet: større markør med ring, altid øverst */}
          {selectedPoint && (
            <Marker
              key={`selected-${selected.kind}-${selectedPoint.id}`}
              coordinate={{ latitude: selectedPoint.latitude, longitude: selectedPoint.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={20}
              onPress={() => select(selected.kind, selectedPoint)}
            >
              <View style={styles.focusRing}>
                {selected.kind === 'place' ? (
                  <View
                    style={[
                      styles.placeDot,
                      styles.placeDotSelected,
                      {
                        backgroundColor: isSaved(selectedPoint.id)
                          ? colors.saved
                          : categoryMeta[placeCategory(selectedPoint)]?.color || colors.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        isSaved(selectedPoint.id)
                          ? 'heart'
                          : (categoryMeta[placeCategory(selectedPoint)]?.icon || 'location-outline').replace('-outline', '')
                      }
                      size={17}
                      color={colors.white}
                    />
                  </View>
                ) : selected.kind === 'friend' ? (
                  <View style={[styles.friendMarker, { backgroundColor: selectedPoint.color }]}>
                    <Text style={styles.friendMarkerText} maxFontSizeMultiplier={1.2}>
                      {selectedPoint.initials}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.toiletMarker}>
                    <Text style={styles.toiletMarkerText} maxFontSizeMultiplier={1.2}>
                      WC
                    </Text>
                  </View>
                )}
              </View>
            </Marker>
          )}

          {/* Rutens start og mål */}
          {activeRoute && activeRoute.coordinates.length > 1 && (
            <Marker
              coordinate={activeRoute.coordinates[0]}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={21}
              tracksViewChanges={false}
            >
              <View style={styles.routeStartDot} />
            </Marker>
          )}
          {activeRoute && (
            <Marker
              coordinate={{
                latitude: activeRoute.destination.latitude,
                longitude: activeRoute.destination.longitude,
              }}
              pinColor={colors.route}
              zIndex={22}
            />
          )}
        </MapView>

        {/* Øverst: søgefelt, filtre og signaturforklaring oven på kortet */}
        <View style={[styles.mapTop, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.mapSearchBar}>
            <Ionicons name="search-outline" size={20} color={colors.textMuted} />
            <TextInput
              ref={searchInput}
              style={styles.searchInput}
              placeholder="Search lifts, pistes and places"
              placeholderTextColor={colors.textMuted}
              maxFontSizeMultiplier={1.3}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search the map"
            />
            {query.length > 0 || searchFocused ? (
              <TouchableOpacity
                onPress={closeSearch}
                style={styles.searchClear}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {searching ? (
            <View style={styles.mapSearchResults}>
              <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                {found.category ? (
                  <TouchableOpacity style={styles.mapSearchRow} onPress={() => showCategory(found.category)}>
                    <Ionicons name="map-outline" size={20} color={colors.primary} style={styles.mapSearchRowIcon} />
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.mapSearchRowTitle}>
                        Show all {(filterChips.find((chip) => chip.id === found.category)?.label || 'lifts').toLowerCase()} on
                        the map
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
                {found.results.map((result) => (
                  <TouchableOpacity
                    key={`${result.kind}-${result.id}`}
                    style={styles.mapSearchRow}
                    onPress={() => openResult(result)}
                  >
                    <Ionicons
                      name={
                        result.kind === 'lift'
                          ? 'triangle-outline'
                          : result.kind === 'piste'
                            ? 'trending-down-outline'
                            : categoryMeta[placeCategory(result.data)]?.icon || 'location-outline'
                      }
                      size={20}
                      color={colors.primary}
                      style={styles.mapSearchRowIcon}
                    />
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.mapSearchRowTitle} numberOfLines={1}>
                        {result.title}
                      </Text>
                      <Text style={styles.mapSearchRowSubtitle} numberOfLines={1}>
                        {result.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {found.total === 0 && !found.category ? (
                  <Text style={styles.mapSearchEmpty}>
                    No lifts, pistes or places match "{query.trim()}".
                  </Text>
                ) : null}
                {found.total > found.results.length ? (
                  <Text style={styles.mapSearchEmpty}>
                    Showing {found.results.length} of {found.total} - keep typing to narrow it down.
                  </Text>
                ) : null}
              </ScrollView>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.mapChipsRow}
                contentContainerStyle={styles.mapChipsContent}
                keyboardShouldPersistTaps="handled"
              >
                {filtersChanged ? (
                  <TouchableOpacity
                    style={[styles.chip, styles.chipFloating]}
                    onPress={() => setActive(defaultActive)}
                    accessibilityRole="button"
                    accessibilityLabel="Reset the filters"
                  >
                    <Ionicons name="refresh" size={16} color={colors.textDark} />
                    <Text style={styles.chipText} maxFontSizeMultiplier={1.3}>
                      Reset
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {filterChips.map((chip) => {
                  const on = active[chip.id];
                  return (
                    <TouchableOpacity
                      key={chip.id}
                      style={[styles.chip, styles.chipFloating, on && styles.chipActive]}
                      onPress={() => toggleFilter(chip.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${chip.label}, ${on ? 'shown' : 'hidden'}`}
                    >
                      <Ionicons name={chip.icon} size={16} color={on ? colors.white : colors.textDark} />
                      <Text style={[styles.chipText, on && styles.chipTextActive]} maxFontSizeMultiplier={1.3}>
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {legendOpen ? (
                <View style={styles.legendCard}>
                  {legendItems.map((item) => (
                    <View key={item.label} style={styles.legendItem}>
                      <View style={styles.legendSwatchWrap}>
                        {item.dashed ? (
                          <>
                            <View style={[styles.legendDash, { backgroundColor: item.color }]} />
                            <View style={[styles.legendDash, { backgroundColor: item.color }]} />
                            <View style={[styles.legendDash, { backgroundColor: item.color }]} />
                          </>
                        ) : (
                          <View
                            style={[
                              styles.legendSwatch,
                              { backgroundColor: item.color },
                              item.lift && styles.legendSwatchLift,
                            ]}
                          />
                        )}
                        {item.lift ? <View style={styles.legendStation} /> : null}
                      </View>
                      <Text style={styles.legendText}>{item.label}</Text>
                    </View>
                  ))}
                  <Text style={styles.legendFootnote}>
                    {lifts.length} lifts · {pisteKm} km of pistes · {allPlaces.length} places. Tap a
                    line or a marker for details.
                  </Text>
                  <TouchableOpacity
                    style={[styles.smallButton, { marginTop: 10, marginRight: 0 }]}
                    onPress={showWholeArea}
                    accessibilityRole="button"
                  >
                    <Text style={styles.smallButtonText}>Show the whole ski area</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Nederst: knapper til højre, info-kort under dem */}
        {!searching ? (
          <View style={styles.mapBottom} pointerEvents="box-none">
            <View style={styles.mapButtons} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.mapButton, legendOpen && styles.mapButtonActive]}
                onPress={() => setLegendOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ expanded: legendOpen }}
                accessibilityLabel="Map legend"
              >
                <Ionicons name="list" size={22} color={legendOpen ? colors.white : colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapButton, baseMap === 'satellite' && styles.mapButtonActive]}
                onPress={toggleBaseMap}
                accessibilityRole="button"
                accessibilityLabel={
                  baseMap === 'terrain' ? 'Switch to satellite map' : 'Switch to snow terrain map'
                }
              >
                <Ionicons
                  name="layers"
                  size={22}
                  color={baseMap === 'satellite' ? colors.white : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapButton}
                onPress={goToMyLocation}
                accessibilityRole="button"
                accessibilityState={{ busy: locating }}
                accessibilityLabel="Show my location"
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="locate" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {renderSelectedCard()}

            {activeRoute && (
              <MapCard
                icon="navigate"
                iconColor={colors.route}
                accent={colors.route}
                title={`To ${activeRoute.destination.name}`}
                subtitle={`${formatDuration(activeRoute.totalSeconds)} · ${formatDistance(activeRoute.totalMeters)} · from ${activeRoute.startLabel}`}
                onClose={clearRoute}
                closeLabel="End route"
              >
                <CardButton
                  primary
                  icon="list"
                  label="Steps"
                  onPress={() =>
                    navigation.navigate('Route', {
                      destination: activeRoute.destination,
                      start: activeRoute.start,
                    })
                  }
                />
                <CardButton
                  label="Show whole route"
                  onPress={() =>
                    moveTo(regionForCoordinates([...activeRoute.coordinates, activeRoute.destination]))
                  }
                />
              </MapCard>
            )}
          </View>
        ) : null}
      </View>

      {/* Kildeangivelse er et krav fra OpenStreetMap (ODbL), EOX og swisstopo.
          Den står under kortet, så info-kort og knapper aldrig dækker den;
          et tryk viser de fulde tekster og links. */}
      <TouchableOpacity
        onPress={showMapSources}
        accessibilityRole="link"
        accessibilityLabel="Show map sources"
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <Text style={styles.mapAttribution} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
          © OpenStreetMap · OpenSkiMap · Terrain © EOX · ©swisstopo · sources
        </Text>
      </TouchableOpacity>
    </View>
  );
}
