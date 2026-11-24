import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Circle, Marker, Callout, UrlTile } from 'react-native-maps';
import { lifts, pistes, pisteColors, verbierRegion, towns } from '../data/verbierMap';
import { elevations } from '../data/elevations';
import { pois } from '../data/pois';
import { toilets } from '../data/toilets';
import { friends } from '../data/friends';
import { categoryMeta } from '../data/categoryMeta';
import { useLocation } from '../context/LocationContext';
import { useRoute } from '../context/RouteContext';
import { allPlaces, osmPlaces, findPlace, placeCategory } from '../utils/places';
import { pisteKind, pisteDisplayName, pisteLabel, liftTypeLabels } from '../utils/pistes';
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
  { id: 'hotel', label: 'Hotels', icon: categoryMeta.hotel.icon },
  { id: 'ski_rental', label: 'Ski rental', icon: categoryMeta.ski_rental.icon },
  { id: 'toilets', label: 'Toilets', icon: 'body-outline' },
  { id: 'friends', label: 'Friends', icon: 'people-outline' },
];

const allOff = Object.fromEntries(filterChips.map((chip) => [chip.id, false]));

// Default: restauranter/caféer, toiletter og venner vist med det samme. De
// øvrige (hoteller er langt de fleste) slås til manuelt for at holde kortet roligt.
const defaultActive = { ...allOff, restaurant: true, cafe: true, toilets: true, friends: true };

// Kun rigtige alpine pister tæller med i overskriften - datasættet rummer
// også skitur-ruter og en kælkebane (se utils/pistes.js).
const downhillPisteCount = pistes.filter((piste) => pisteKind(piste) === 'downhill').length;

const LIFT_COLOR = '#2b3a42';
const LIFT_COLOR_ON_SATELLITE = '#ffffff'; // mørke lifter forsvinder på et satellitfoto

const legendItems = [
  { label: 'Lift', color: LIFT_COLOR },
  { label: 'Green', color: pisteColors.novice },
  { label: 'Blue', color: pisteColors.easy },
  { label: 'Red', color: pisteColors.intermediate },
  { label: 'Black', color: pisteColors.advanced },
  { label: 'Off-piste', color: pisteColors.freeride },
  { label: 'Ski tour', color: pisteColors.unknown },
  { label: 'Sled run', color: colors.sled },
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
//   4. swissTopo: swisstopos vinter-landkort, svagt ovenpå fra zoom 14, så
//      gader og stednavne anes (kun Schweiz). Kræver teksten "©swisstopo".
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
const swissTopo = `${SWISSTOPO}/ch.swisstopo.pixelkarte-farbe-winter/default/current/3857/{z}/{x}/{y}.jpeg`;
const MAX_TILE_ZOOM = 19;
const DETAIL_FROM_ZOOM = 14;

// Hvor tæt er der zoomet ind? Styrer stregtykkelse og hvor mange detaljer,
// der vises, så oversigten ikke drukner i streger og nåle.
//   far:  hele skiområdet    mid: et delområde    near: en by / en lift
function zoomLevelFor(region) {
  if (region.latitudeDelta > 0.08) return 'far';
  if (region.latitudeDelta > 0.03) return 'mid';
  return 'near';
}
const PISTE_WIDTH = { far: 2.5, mid: 3.5, near: 5 };
const LIFT_WIDTH = { far: 1.5, mid: 2, near: 3 };

// Midtpunktet på en linje - her står liftens navn, når man er zoomet ind.
function midpointOf(coordinates) {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return {
    latitude: (first.latitude + last.latitude) / 2,
    longitude: (first.longitude + last.longitude) / 2,
  };
}

// Alle liftstationer (begge ender af hver lift) - tegnes som små ringe.
const liftStations = lifts.flatMap((lift) => [
  { id: `${lift.id}-a`, ...lift.coordinates[0] },
  { id: `${lift.id}-b`, ...lift.coordinates[lift.coordinates.length - 1] },
]);

const regionAround = (point) => ({
  latitude: point.latitude,
  longitude: point.longitude,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
});

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

// Tekst til info-kortet nederst, når man trykker på en lift eller pist.
function describeLine(selected) {
  const { kind, item } = selected;
  const length = formatDistance(lineLengthMeters(item.coordinates));
  const [startElev, endElev] = elevations[item.id] || [];
  if (kind === 'lift') {
    const bottom = Math.min(startElev, endElev);
    const top = Math.max(startElev, endElev);
    const height = startElev !== undefined && top - bottom >= 10 ? ` · ${bottom} → ${top} m` : '';
    return {
      title: item.name,
      subtitle: `${liftTypeLabels[item.liftType] || liftTypeLabels.unknown} · ${length}${height}`,
    };
  }
  const drop = startElev !== undefined && startElev - endElev >= 10 ? ` · ↓ ${startElev - endElev} m` : '';
  return {
    title: pisteDisplayName(item) || 'Unnamed piste',
    subtitle: `${pisteLabel(item)} · ${length}${drop}`,
  };
}

// Rigtigt interaktivt kort over Verbier. Lifter og pister er ægte geodata
// (data/verbierMap.js), steder kommer fra OpenStreetMap (data/places.js) og
// filtreres med chips øverst. Baggrunden er telefonens terrænkort, i Schweiz
// med swisstopo ovenpå (se BAGGRUNDSKORT øverst). Stregtykkelse og detaljer
// følger zoom-niveauet. Tryk på
// en lift eller pist for at se navn, type og længde i kortet nederst.
//
// Andre skærme kan styre kortet via route.params (altid sammen med en ny
// `focusKey`, så samme genvej virker flere gange i træk):
//   { focusCategory }  vis kun én kategori ('lifts' = ingen steder)
//   { focusLiftId }    zoom til og markér en lift
//   { focusPlaceId }   zoom til og markér et sted
//   { focusFriendId }  zoom til og markér en ven
//   { showRoute }      zoom til den aktive rute fra RouteContext
export default function MapScreen({ navigation, route }) {
  const mapRef = useRef(null);
  const mapReady = useRef(false);
  const pendingRegion = useRef(null);
  const { permission, requestLocation } = useLocation();
  const { activeRoute, clearRoute } = useRoute();

  const [active, setActive] = useState(defaultActive);
  // Det, brugeren har trykket på / er sendt hen til: { kind, item }, hvor
  // kind er 'lift' | 'piste' | 'place' | 'friend'.
  const [selected, setSelected] = useState(null);
  const [level, setLevel] = useState(() => zoomLevelFor(verbierRegion));
  const [baseMap, setBaseMap] = useState('terrain'); // 'terrain' | 'satellite'

  // Kaldes, når brugeren er færdig med at panorere/zoome. setLevel med samme
  // værdi som før udløser ingen ny tegning, så det er billigt at kalde hver gang.
  const lastRegion = useRef(verbierRegion);
  const onRegionChangeComplete = (region) => {
    lastRegion.current = region;
    setLevel(zoomLevelFor(region));
  };

  // Skift mellem terrænkort og satellit. Kortet bygges forfra (key={baseMap}
  // på MapView) i det udsnit, man stod i: på iOS ender flise-lag, der tilføjes
  // efter de andre lag, ellers OVEN PÅ pister og lifter.
  const toggleBaseMap = () => {
    mapReady.current = false;
    setBaseMap((current) => (current === 'terrain' ? 'satellite' : 'terrain'));
  };

  const toggleFilter = (id) => setActive((prev) => ({ ...prev, [id]: !prev[id] }));

  // Flyt kortet - eller husk udsnittet, hvis kortet ikke er klar endnu (første
  // gang fanen åbnes via en genvej fra en anden skærm).
  const moveTo = useCallback((region) => {
    if (mapReady.current && mapRef.current) {
      mapRef.current.animateToRegion(region, 600);
    } else {
      pendingRegion.current = region;
    }
  }, []);

  const onMapReady = () => {
    mapReady.current = true;
    if (pendingRegion.current) {
      mapRef.current?.animateToRegion(pendingRegion.current, 0);
      pendingRegion.current = null;
    }
  };

  // Bed om lokationstilladelse, første gang kortet åbnes - uden den viser
  // hverken iOS eller Android den blå "her er du"-prik.
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Genveje fra andre skærme (se kommentaren over komponenten).
  const params = route.params;
  const focusKey = params?.focusKey;
  useEffect(() => {
    if (!focusKey) return;
    if (params.focusCategory) {
      const only = params.focusCategory === 'lifts' ? {} : { [params.focusCategory]: true };
      setActive({ ...allOff, ...only });
      setSelected(null);
      moveTo(verbierRegion);
    } else if (params.focusLiftId) {
      const lift = lifts.find((l) => l.id === params.focusLiftId);
      if (!lift) return;
      setSelected({ kind: 'lift', item: lift });
      moveTo(regionForCoordinates(lift.coordinates));
    } else if (params.focusPlaceId) {
      const place = findPlace(params.focusPlaceId);
      if (!place) return;
      setActive((prev) => ({ ...prev, [placeCategory(place)]: true }));
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
    const point = await requestLocation();
    if (!point) {
      Alert.alert(
        'Location unavailable',
        'Allow location access for SkiMaps in your phone settings to see where you are on the map.'
      );
      return;
    }
    const meters = distanceMeters(point, verbierRegion);
    if (meters > 30000) {
      Alert.alert(
        'You are not in Verbier',
        `You are about ${formatDistance(meters)} away. The map only covers the Verbier ski area.`
      );
      return;
    }
    moveTo(regionAround(point));
  };

  // Lifter og pister bygges kun forfra, når zoom-niveauet skifter (tre
  // niveauer) - ikke hver gang man trykker på en filter-chip.
  const liftLines = useMemo(
    () =>
      lifts.map((lift) => (
        <Polyline
          key={lift.id}
          coordinates={lift.coordinates}
          strokeColor={baseMap === 'satellite' ? LIFT_COLOR_ON_SATELLITE : LIFT_COLOR}
          strokeWidth={LIFT_WIDTH[level] + (baseMap === 'satellite' ? 0.5 : 0)}
          zIndex={2}
          tappable
          onPress={() => setSelected({ kind: 'lift', item: lift })}
        />
      )),
    [level, baseMap]
  );

  const pisteLines = useMemo(
    () =>
      pistes.map((piste) => {
        const style = pisteStyle(piste, level);
        return (
          <Polyline
            key={piste.id}
            coordinates={piste.coordinates}
            strokeColor={style.color}
            strokeWidth={style.width}
            lineDashPattern={style.dash}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
            tappable
            onPress={() => setSelected({ kind: 'piste', item: piste })}
          />
        );
      }),
    [level]
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
                strokeWidth={PISTE_WIDTH[level] + 2.5}
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
          radius={22}
          fillColor={colors.white}
          strokeColor={LIFT_COLOR}
          strokeWidth={2}
          zIndex={3}
        />
      )),
    []
  );

  // Kuraterede pois.js-steder vises altid som store nåle; OSM-stederne
  // respekterer filtrene. (utils/places.js sørger for, at et kurateret sted
  // ikke også optræder som OSM-sted.)
  const visiblePlaces = useMemo(
    () => osmPlaces.filter((place) => active[place.category]),
    [active]
  );

  const lineInfo =
    selected && (selected.kind === 'lift' || selected.kind === 'piste')
      ? describeLine(selected)
      : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Verbier 🇨🇭</Text>
        <Text style={styles.screenHeaderSubtitle}>
          {lifts.length} lifts · {downhillPisteCount} pistes · {allPlaces.length} places
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryChipsRow}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        {filterChips.map((chip) => {
          const on = active[chip.id];
          return (
            <TouchableOpacity
              key={chip.id}
              style={[styles.categoryChip, on && styles.categoryChipActive]}
              onPress={() => toggleFilter(chip.id)}
            >
              <Ionicons name={chip.icon} size={15} color={on ? colors.white : colors.textDark} />
              <Text style={[styles.categoryChipText, on && styles.categoryChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.legendStrip}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        {legendItems.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </ScrollView>

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
          showsCompass={false}
          toolbarEnabled={false}
          minZoomLevel={10}
          maxZoomLevel={18}
          onMapReady={onMapReady}
          onRegionChangeComplete={onRegionChangeComplete}
        >
          {/* Rækkefølgen her er lagenes rækkefølge, nederst først. zIndex gør
              det samme på Android; på iOS er det rækkefølgen, der tæller.
              (Et hvidt "snelag" oven på telefonens kort er prøvet og droppet:
              det gjorde terrænet for blegt og lagde sig over swisstopo.) */}
          {baseMap === 'terrain' && (
            <UrlTile
              urlTemplate={snowTerrain}
              maximumZ={SNOW_MAX_ZOOM}
              tileSize={256}
              zIndex={-3}
            />
          )}
          {baseMap === 'terrain' && (
            <UrlTile urlTemplate={swissRelief} maximumZ={MAX_TILE_ZOOM} tileSize={256} zIndex={-2} />
          )}
          {baseMap === 'terrain' && (
            <UrlTile
              urlTemplate={swissTopo}
              minimumZ={DETAIL_FROM_ZOOM}
              maximumZ={MAX_TILE_ZOOM}
              tileSize={256}
              opacity={0.3}
              zIndex={-1}
            />
          )}

          {/* Pister (farvet efter sværhedsgrad), lifter ovenpå, stationer øverst */}
          {blackPisteCasings}
          {pisteLines}
          {liftLines}
          {stationCircles}

          {/* Den valgte lift/pist fremhæves med en bred, lys kant */}
          {lineInfo && (
            <Polyline
              coordinates={selected.item.coordinates}
              strokeColor={colors.accent}
              strokeWidth={8}
              zIndex={5}
            />
          )}

          {/* Aktiv rute fra rutefindingen - hvid kant under en tydelig farve */}
          {activeRoute && activeRoute.coordinates.length > 1 && (
            <>
              <Polyline
                coordinates={activeRoute.coordinates}
                strokeColor={colors.white}
                strokeWidth={10}
                zIndex={6}
              />
              <Polyline
                coordinates={activeRoute.coordinates}
                strokeColor={colors.route}
                strokeWidth={5}
                zIndex={7}
              />
            </>
          )}

          {/* Vores egne bynavne for skiområdets byer. På satellit er telefonens
              egne stednavne tydelige nok. */}
          {baseMap === 'terrain' &&
            towns.map((town) => (
              <Marker
                key={town.id}
                coordinate={{ latitude: town.latitude, longitude: town.longitude }}
                // Navnet står lige under byens punkt, så nålene (der peger
                // opad fra deres punkt) ikke dækker det.
                anchor={{ x: 0.5, y: -0.4 }}
                zIndex={15}
                tracksViewChanges={false}
                tappable={false}
              >
                <Text style={styles.townLabel}>{town.name}</Text>
              </Marker>
            ))}

          {/* Liftnavne midt på liften, når man er zoomet helt ind */}
          {level === 'near' &&
            lifts.map((lift) => (
              <Marker
                key={`label-${lift.id}`}
                coordinate={midpointOf(lift.coordinates)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                tappable={false}
              >
                <Text style={styles.liftLabel}>{lift.name}</Text>
              </Marker>
            ))}

          {/* Kuraterede "featured" steder - altid synlige, store nåle */}
          {pois.map((poi) => (
            <Marker
              key={poi.id}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              pinColor={colors.primary}
              onCalloutPress={() => navigation.navigate('POIDetail', { poi })}
            >
              <Callout>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{poi.name}</Text>
                  <Text style={styles.calloutSubtitle}>
                    {categoryMeta[poi.category]?.label} · tap for details
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}

          {/* Rigtige OSM-steder, filtrérbare via chips øverst. Zoomet ud er de
              små farvede prikker; zoomet ind får de deres emoji. `key` skifter
              med, fordi Android ellers ikke tegner en markør om. */}
          {visiblePlaces.map((place) => {
            const meta = categoryMeta[place.category];
            const compact = level === 'far';
            return (
              <Marker
                key={`${place.id}-${compact ? 'dot' : 'full'}`}
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onCalloutPress={() => navigation.navigate('POIDetail', { poi: place })}
              >
                {compact ? (
                  <View style={[styles.placeDotSmall, { backgroundColor: meta.color }]} />
                ) : (
                  <View style={[styles.placeDot, { backgroundColor: meta.color }]}>
                    <Text style={styles.placeDotEmoji}>{meta.emoji}</Text>
                  </View>
                )}
                <Callout>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{place.name}</Text>
                    <Text style={styles.calloutSubtitle}>{meta.label} · tap for details</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}

          {/* Offentlige toiletter (OpenStreetMap) - en detalje, så først når man zoomer ind */}
          {active.toilets &&
            level !== 'far' &&
            toilets.map((wc) => (
              <Marker
                key={wc.id}
                coordinate={{ latitude: wc.latitude, longitude: wc.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <Text style={styles.toiletMarker}>🚻</Text>
                <Callout>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>Public toilet</Text>
                  </View>
                </Callout>
              </Marker>
            ))}

          {/* Venner (mock-data) - runde avatarer med forbogstav */}
          {active.friends &&
            friends.map((friend) => (
              <Marker
                key={friend.id}
                coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={() => setSelected({ kind: 'friend', item: friend })}
              >
                <View
                  style={[
                    styles.friendMarker,
                    { backgroundColor: friend.color, opacity: friend.online ? 1 : 0.55 },
                  ]}
                >
                  <Text style={styles.friendMarkerText}>{friend.initials}</Text>
                </View>
              </Marker>
            ))}

          {/* Ring om det sted/den ven, man er sendt hen til fra en anden skærm */}
          {selected && (selected.kind === 'place' || selected.kind === 'friend') && (
            <Marker
              key={`focus-${selected.item.id}`}
              coordinate={{ latitude: selected.item.latitude, longitude: selected.item.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={20}
              tappable={false}
            >
              <View style={styles.focusRing} />
            </Marker>
          )}

          {/* Rutens mål */}
          {activeRoute && (
            <Marker
              coordinate={{
                latitude: activeRoute.destination.latitude,
                longitude: activeRoute.destination.longitude,
              }}
              pinColor={colors.route}
              zIndex={21}
            />
          )}
        </MapView>

        <View style={styles.mapButtons}>
          <TouchableOpacity
            style={styles.mapButton}
            onPress={goToMyLocation}
            accessibilityLabel="Show my location"
          >
            <Ionicons name="locate" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapButton, baseMap === 'satellite' && styles.mapButtonActive]}
            onPress={toggleBaseMap}
            accessibilityLabel={
              baseMap === 'terrain' ? 'Switch to satellite map' : 'Switch to terrain map'
            }
          >
            <Ionicons
              name="layers"
              size={21}
              color={baseMap === 'satellite' ? colors.white : colors.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.mapCards} pointerEvents="box-none">
          {lineInfo && (
            <View style={styles.mapCard}>
              <View style={styles.mapCardText}>
                <Text style={styles.mapCardTitle}>{lineInfo.title}</Text>
                <Text style={styles.mapCardSubtitle}>{lineInfo.subtitle}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {selected?.kind === 'place' && (
            <View style={styles.mapCard}>
              <View style={styles.mapCardText}>
                <Text style={styles.mapCardTitle}>{selected.item.name}</Text>
                <Text style={styles.mapCardSubtitle}>
                  {categoryMeta[placeCategory(selected.item)]?.label}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.mapCardButton}
                onPress={() => navigation.navigate('POIDetail', { poi: selected.item })}
              >
                <Text style={styles.mapCardButtonText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {selected?.kind === 'friend' && (
            <View style={styles.mapCard}>
              <View style={styles.mapCardText}>
                <Text style={styles.mapCardTitle}>{selected.item.name}</Text>
                <Text style={styles.mapCardSubtitle}>
                  {selected.item.status} · {selected.item.online ? 'online' : 'offline'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {activeRoute && (
            <View style={[styles.mapCard, styles.mapCardRoute]}>
              <Ionicons name="navigate" size={20} color={colors.route} style={{ marginRight: 10 }} />
              <View style={styles.mapCardText}>
                <Text style={styles.mapCardTitle} numberOfLines={1}>
                  To {activeRoute.destination.name}
                </Text>
                <Text style={styles.mapCardSubtitle}>
                  {formatDuration(activeRoute.totalSeconds)} · {formatDistance(activeRoute.totalMeters)}{' '}
                  · from {activeRoute.startLabel}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.mapCardButton}
                onPress={() => navigation.navigate('Route', { destination: activeRoute.destination })}
              >
                <Text style={styles.mapCardButtonText}>Steps</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearRoute} hitSlop={10} accessibilityLabel="Clear route">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Kildeangivelse er et krav fra OpenStreetMap (ODbL), EOX og swisstopo.
          Den står under kortet, så info-kort og knapper aldrig dækker den;
          et tryk viser de fulde tekster og links. */}
      <TouchableOpacity onPress={showMapSources} accessibilityLabel="Show map sources">
        <Text style={styles.mapAttribution}>
          © OpenStreetMap contributors · OpenSkiMap · Terrain © EOX · ©swisstopo
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
