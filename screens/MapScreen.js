import React, { useMemo, useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker, Callout } from 'react-native-maps';
import { lifts, pistes, pisteColors, verbierRegion, towns } from '../data/verbierMap';
import { pois } from '../data/pois';
import { places } from '../data/places';
import { toilets } from '../data/toilets';
import { categoryMeta } from '../data/categoryMeta';
import { styles, colors } from '../styles/styles';

// Danske navne for sværhedsgrader og lift-typer - bruges i "tryk for navn"-boblerne.
const difficultyLabels = {
  novice: 'Grøn (begynder)',
  easy: 'Blå (let)',
  intermediate: 'Rød (mellem)',
  advanced: 'Sort (svær)',
  expert: 'Sort (ekspert)',
  extreme: 'Ekstrem',
  freeride: 'Off-piste',
  unknown: 'Ukendt sværhedsgrad',
};

const liftTypeLabels = {
  gondola: 'Gondol',
  chair_lift: 'Stolelift',
  cable_car: 'Kabelbane',
  mixed_lift: 'Kombi-lift',
  platter: 'Skitrække',
  drag_lift: 'Bøjletræk',
  magic_carpet: 'Magic carpet',
  rope_tow: 'Tovtræk',
  unknown: 'Lift',
};

// Filter-chips øverst på kortet. "toilets" er ikke en stedkategori fra
// places.js, men vises som sin egen chip, da toiletterne har deres egen kilde.
const filterChips = [
  { id: 'restaurant', label: 'Restaurants', icon: categoryMeta.restaurant.icon },
  { id: 'cafe', label: 'Cafés', icon: categoryMeta.cafe.icon },
  { id: 'apres_ski', label: 'Après-ski', icon: categoryMeta.apres_ski.icon },
  { id: 'hotel', label: 'Hotels', icon: categoryMeta.hotel.icon },
  { id: 'ski_rental', label: 'Ski rental', icon: categoryMeta.ski_rental.icon },
  { id: 'toilets', label: 'Toilets', icon: 'body-outline' },
];

// Default: restauranter/caféer vist med det samme, de øvrige (hoteller er
// langt de fleste - 200 stk) skal slås til manuelt for at holde kortet roligt.
const defaultActive = { restaurant: true, cafe: true, apres_ski: false, hotel: false, ski_rental: false, toilets: true };

// Rigtigt interaktivt kort over Verbier - lifter og pister er ægte geodata
// (se data/verbierMap.js). Restauranter/caféer/après-ski/hoteller/ski rental
// kommer fra data/places.js (363 rigtige steder, hentet fra OpenStreetMap),
// filtrérbare via chips øverst. Kortet bruger mapType="none" og en flad,
// altid-hvid "sne"-baggrund i stedet for satellitfoto, i stil med et rigtigt,
// illustreret pistekort. Tryk på en lift/pist for at se navn og sværhedsgrad.
export default function MapScreen({ navigation, route }) {
  const focusCategory = route?.params?.focusCategory;
  const [active, setActive] = useState(
    focusCategory ? { ...defaultActive, [focusCategory]: true } : defaultActive
  );

  const toggleFilter = (id) => setActive((prev) => ({ ...prev, [id]: !prev[id] }));

  const visLift = (lift) => {
    Alert.alert(lift.name, liftTypeLabels[lift.liftType] || 'Lift');
  };

  const visPiste = (piste) => {
    Alert.alert(
      piste.name || 'Unavngivet pist',
      difficultyLabels[piste.difficulty] || 'Ukendt sværhedsgrad'
    );
  };

  // Kuraterede pois.js-steder vises altid (uanset filter) som de store, blå
  // "featured" nåle; de rigtige OSM-steder fra places.js respekterer filtrene
  // og udelader kategorier, der allerede dækkes af en kurateret poi (navn-match).
  const curatedNames = useMemo(() => new Set(pois.map((p) => p.name)), []);
  const visiblePlaces = useMemo(
    () => places.filter((p) => active[p.category] && !curatedNames.has(p.name)),
    [active, curatedNames]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Verbier 🇨🇭</Text>
        <Text style={styles.screenHeaderSubtitle}>
          {lifts.length} lifter · {pistes.length} pister · {places.length} steder
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
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: '#444' }]} />
            <Text style={styles.legendText}>Lift</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: pisteColors.easy }]} />
            <Text style={styles.legendText}>Blå pist</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: pisteColors.intermediate }]} />
            <Text style={styles.legendText}>Rød pist</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: pisteColors.advanced }]} />
            <Text style={styles.legendText}>Sort pist</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: pisteColors.freeride }]} />
            <Text style={styles.legendText}>Off-piste</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={verbierRegion}
          mapType="none"
          showsUserLocation
          showsMyLocationButton
        >
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

          {/* Lifter tegnes som grå, stiplede linjer - tryk for navn */}
          {lifts.map((lift) => (
            <Polyline
              key={lift.id}
              coordinates={lift.coordinates}
              strokeColor="#444444"
              strokeWidth={3}
              lineDashPattern={[6, 4]}
              tappable
              onPress={() => visLift(lift)}
            />
          ))}

          {/* Pister farves efter rigtig sværhedsgrad fra OpenStreetMap - tryk for navn */}
          {pistes.map((piste) => (
            <Polyline
              key={piste.id}
              coordinates={piste.coordinates}
              strokeColor={pisteColors[piste.difficulty] || pisteColors.unknown}
              strokeWidth={piste.difficulty === 'unknown' ? 2 : 4}
              lineDashPattern={piste.difficulty === 'freeride' ? [4, 4] : undefined}
              tappable
              onPress={() => visPiste(piste)}
            />
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
                    {categoryMeta[poi.type]?.label} - tryk for detaljer
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
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: meta.color,
                    borderWidth: 2,
                    borderColor: '#fff',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 10 }}>{meta.emoji}</Text>
                </View>
                <Callout>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{place.name}</Text>
                    <Text style={styles.calloutSubtitle}>{meta.label} - tryk for detaljer</Text>
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
                <Text style={{ fontSize: 20 }}>🚻</Text>
                <Callout>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>Toilet</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
        </MapView>
      </View>
    </SafeAreaView>
  );
}
