import React from 'react';
import { View, Text, Alert } from 'react-native';
import MapView, { Polyline, Marker, Callout } from 'react-native-maps';
import { lifts, pistes, pisteColors, verbierRegion, towns } from '../data/verbierMap';
import { pois } from '../data/pois';
import { toilets } from '../data/toilets';
import { styles } from '../styles/styles';

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

// Rigtigt interaktivt kort over Verbier - lifter og pister er ægte geodata
// (se data/verbierMap.js), cafeer/restauranter kommer fra data/pois.js,
// toiletter fra data/toilets.js. Kortet bruger mapType="none" og en flad,
// altid-hvid "sne"-baggrund i stedet for satellitfoto, så bjerget aldrig
// viser bart terræn/græs - i stil med et rigtigt, illustreret pistekort.
// Da vi dropper Apple/Googles baggrundskort, tegner vi selv bynavnene.
// Tryk på en lift eller pist for at se dens navn og sværhedsgrad.
export default function MapScreen({ navigation }) {
  const visLift = (lift) => {
    Alert.alert(lift.name, liftTypeLabels[lift.liftType] || 'Lift');
  };

  const visPiste = (piste) => {
    Alert.alert(
      piste.name || 'Unavngivet pist',
      difficultyLabels[piste.difficulty] || 'Ukendt sværhedsgrad'
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Verbier</Text>
        <Text style={styles.screenHeaderSubtitle}>
          {lifts.length} lifter · {pistes.length} pister
        </Text>
      </View>

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
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1b4965' }]} />
            <Text style={styles.legendText}>Café/restaurant</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendText}>🚻 Toilet</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={verbierRegion}
          mapType="none"
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

          {/* Cafeer/restauranter som trykbare markører */}
          {pois.map((poi) => (
            <Marker
              key={poi.id}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              pinColor="#1b4965"
              onCalloutPress={() => navigation.navigate('POIDetail', { poi })}
            >
              <Callout>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle}>{poi.name}</Text>
                  <Text style={styles.calloutSubtitle}>
                    {poi.type === 'cafe' ? 'Café' : 'Restaurant'} - tryk for detaljer
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}

          {/* Offentlige toiletter - rigtige placeringer fra OpenStreetMap */}
          {toilets.map((wc) => (
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
    </View>
  );
}
