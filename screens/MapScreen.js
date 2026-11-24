import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Polygon, Marker, Callout, LocalTile } from 'react-native-maps';
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

const legendItems = [
  { label: 'Lift', color: '#444444' },
  { label: 'Green', color: pisteColors.novice },
  { label: 'Blue', color: pisteColors.easy },
  { label: 'Red', color: pisteColors.intermediate },
  { label: 'Black', color: pisteColors.advanced },
  { label: 'Off-piste', color: pisteColors.freeride },
  { label: 'Ski tour', color: pisteColors.unknown },
  { label: 'Sled run', color: colors.sled },
];

// Apple Maps (iOS) understøtter ikke mapType="none" - dér falder den tilbage
// til det almindelige Apple-kort. For at få samme flade "snekort" som på
// Android gør vi tre ting på iOS (afprøvet i simulatoren):
//   1. mapType="satellite": den eneste korttype uden Apples bynavne og veje.
//   2. <LocalTile> med en sti, der ikke findes: et tomt flise-lag, som får
//      MapKit til slet ikke at hente/tegne satellitbillederne.
//   3. En stor, ensfarvet <Polygon> ovenpå som selve "sneen".
const NO_TILES = '/skimaps-no-base-map/{z}/{x}/{y}.png';
const snowCover = [
  { latitude: 60, longitude: -15 },
  { latitude: 60, longitude: 30 },
  { latitude: 30, longitude: 30 },
  { latitude: 30, longitude: -15 },
];

const regionAround = (point) => ({
  latitude: point.latitude,
  longitude: point.longitude,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
});

function pisteStyle(piste) {
  const kind = pisteKind(piste);
  if (kind === 'sled') return { color: colors.sled, width: 3, dash: [6, 4] };
  if (kind !== 'downhill') return { color: pisteColors.unknown, width: 2, dash: [3, 5] };
  return {
    color: pisteColors[piste.difficulty] || pisteColors.unknown,
    width: 4,
    dash: piste.difficulty === 'freeride' ? [4, 4] : undefined,
  };
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
// filtreres med chips øverst. Kortet har ingen baggrundskort - kun en flad
// "sne"-baggrund i stil med et illustreret pistekort. Tryk på en lift eller
// pist for at se navn, type og længde i kortet nederst.
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

  // De faste lag (lifter og pister) bygges kun én gang. Ellers ville alle
  // ~350 linjer blive lavet forfra, hver gang man trykker på en filter-chip.
  const liftLines = useMemo(
    () =>
      lifts.map((lift) => (
        <Polyline
          key={lift.id}
          coordinates={lift.coordinates}
          strokeColor="#444444"
          strokeWidth={3}
          lineDashPattern={[6, 4]}
          tappable
          onPress={() => setSelected({ kind: 'lift', item: lift })}
        />
      )),
    []
  );

  const pisteLines = useMemo(
    () =>
      pistes.map((piste) => {
        const style = pisteStyle(piste);
        return (
          <Polyline
            key={piste.id}
            coordinates={piste.coordinates}
            strokeColor={style.color}
            strokeWidth={style.width}
            lineDashPattern={style.dash}
            tappable
            onPress={() => setSelected({ kind: 'piste', item: piste })}
          />
        );
      }),
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

      <View style={styles.legendCard}>
        <View style={styles.legendRow}>
          {legendItems.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={verbierRegion}
          mapType={Platform.OS === 'android' ? 'none' : 'satellite'}
          showsUserLocation={permission === 'granted'}
          showsMyLocationButton={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
          showsTraffic={false}
          showsCompass={false}
          toolbarEnabled={false}
          onMapReady={onMapReady}
        >
          {Platform.OS === 'ios' && <LocalTile pathTemplate={NO_TILES} tileSize={256} />}
          {Platform.OS === 'ios' && (
            <Polygon coordinates={snowCover} fillColor={colors.iceLight} strokeWidth={0} />
          )}

          {/* Lifter (grå, stiplede) og pister (farvet efter sværhedsgrad) */}
          {liftLines}
          {pisteLines}

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

          {/* Bynavne - vises som tekst, da baggrundskortet er slået fra */}
          {towns.map((town) => (
            <Marker
              key={town.id}
              coordinate={{ latitude: town.latitude, longitude: town.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <Text style={styles.townLabel}>{town.name}</Text>
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

          {/* Rigtige OSM-steder, filtrérbare via chips øverst */}
          {visiblePlaces.map((place) => {
            const meta = categoryMeta[place.category];
            return (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onCalloutPress={() => navigation.navigate('POIDetail', { poi: place })}
              >
                <View style={[styles.placeDot, { backgroundColor: meta.color }]}>
                  <Text style={styles.placeDotEmoji}>{meta.emoji}</Text>
                </View>
                <Callout>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{place.name}</Text>
                    <Text style={styles.calloutSubtitle}>{meta.label} · tap for details</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}

          {/* Offentlige toiletter - rigtige placeringer fra OpenStreetMap */}
          {active.toilets &&
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

        <TouchableOpacity
          style={styles.locateButton}
          onPress={goToMyLocation}
          accessibilityLabel="Show my location"
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>

        {/* OpenStreetMap-data kræver synlig kildeangivelse (ODbL-licensen) */}
        <Text style={styles.mapAttribution}>© OpenStreetMap contributors · OpenSkiMap</Text>

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
    </SafeAreaView>
  );
}
