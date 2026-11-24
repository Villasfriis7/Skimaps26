import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { lifts, pisteColors, verbierRegion } from '../data/verbierMap';
import { useLocation } from '../context/LocationContext';
import { useRoute, getSkiGraph } from '../context/RouteContext';
import { findRoute, isOnNetwork, skillLevels } from '../utils/routing';
import { liftBottom } from '../utils/places';
import { liftTypeLabels, difficultyLabels } from '../utils/pistes';
import { distanceMeters, formatDistance, formatDuration } from '../utils/geo';
import { styles, colors } from '../styles/styles';

// Lifterne i alfabetisk rækkefølge til "start fra"-listen.
const sortedLifts = [...lifts].sort((a, b) => a.name.localeCompare(b.name));
// Médran er Verbiers hovedlift og derfor et fornuftigt startpunkt, når vi
// ikke kender brugerens position.
const defaultLift = lifts.find((lift) => lift.name.startsWith('Médran')) || lifts[0];

// Ét trin i ruten som tekst + ikon.
function describeStep(step) {
  if (step.kind === 'lift') {
    return {
      icon: 'arrow-up-circle',
      color: '#444444',
      title: `Take ${step.name}`,
      subtitle: liftTypeLabels[step.liftType] || liftTypeLabels.unknown,
    };
  }
  if (step.kind === 'piste') {
    return {
      icon: 'ellipse',
      color: pisteColors[step.difficulty] || pisteColors.unknown,
      title: step.name ? `Ski ${step.name}` : 'Ski an unnamed piste',
      subtitle: difficultyLabels[step.difficulty] || difficultyLabels.unknown,
    };
  }
  return {
    icon: 'walk',
    color: colors.textMuted,
    title: `Walk ${formatDistance(step.meters)}`,
    subtitle: 'On foot or skating - approximate distance',
  };
}

// Rutefinding via lifter og pister til ét sted (route.params.destination).
// Brugeren vælger startpunkt (egen GPS-position eller en liftstation) og den
// sværeste pist, de vil køre. Selve beregningen ligger i utils/routing.js;
// "Show on map" lægger ruten i RouteContext, så kortet kan tegne den.
export default function RouteScreen({ navigation, route }) {
  const { destination } = route.params;
  const { location, requestLocation } = useLocation();
  const { setActiveRoute } = useRoute();
  const graph = getSkiGraph();

  // Start: brugerens position, hvis den ligger i skiområdet - ellers en lift.
  // `startChoice` er null, indtil brugeren selv har valgt; så længe følger vi
  // automatisk positionen, også hvis GPS'en først svarer, efter skærmen er åbnet.
  const [startChoice, setStartChoice] = useState(null); // null | 'location' | 'lift'
  const locationUsable = location !== null && isOnNetwork(graph, location);
  const useMyLocation = locationUsable && startChoice !== 'lift';
  const [startLift, setStartLift] = useState(defaultLift);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [skill, setSkill] = useState('intermediate');

  const startPoint = useMyLocation ? location : liftBottom(startLift);
  const startLabel = useMyLocation ? 'your location' : startLift.name;

  const result = useMemo(
    () => findRoute(graph, startPoint, destination, { skill }),
    // startPoint er et nyt objekt ved hver rendering - sammenlign på tallene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, startPoint.latitude, startPoint.longitude, destination, skill]
  );

  const destinationReachable = isOnNetwork(graph, destination);

  const chooseMyLocation = async () => {
    const point = location || (await requestLocation());
    if (!point) {
      Alert.alert(
        'Location unavailable',
        'Allow location access for SkiMaps in your phone settings, or pick a lift station to start from.'
      );
      return;
    }
    if (!isOnNetwork(graph, point)) {
      const away = formatDistance(distanceMeters(point, verbierRegion));
      Alert.alert(
        'You are not on the slopes',
        `You are about ${away} from Verbier, so a ski route cannot start from your location. Pick a lift station instead.`
      );
      return;
    }
    setStartChoice('location');
    setPicking(false);
  };

  const chooseLift = (lift) => {
    setStartLift(lift);
    setStartChoice('lift');
    setPicking(false);
    setQuery('');
  };

  const showOnMap = () => {
    setActiveRoute({ ...result, destination, startLabel });
    navigation.popTo('MainTabs', {
      screen: 'Map',
      params: { showRoute: true, focusKey: Date.now() },
    });
  };

  const liftMatches = sortedLifts.filter((lift) =>
    lift.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar style="light" />

      <View style={styles.card}>
        <Text style={styles.routeFieldLabel}>From</Text>
        <View style={styles.routeChoiceRow}>
          <TouchableOpacity
            style={[styles.categoryChip, useMyLocation && styles.categoryChipActive]}
            onPress={chooseMyLocation}
          >
            <Ionicons name="locate" size={15} color={useMyLocation ? colors.white : colors.textDark} />
            <Text style={[styles.categoryChipText, useMyLocation && styles.categoryChipTextActive]}>
              My location
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.categoryChip, !useMyLocation && styles.categoryChipActive, { flexShrink: 1 }]}
            onPress={() => setPicking((open) => !open)}
          >
            <Ionicons
              name="triangle-outline"
              size={15}
              color={!useMyLocation ? colors.white : colors.textDark}
            />
            <Text
              style={[styles.categoryChipText, !useMyLocation && styles.categoryChipTextActive]}
              numberOfLines={1}
            >
              {startLift.name} lift
            </Text>
            <Ionicons
              name={picking ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={!useMyLocation ? colors.white : colors.textDark}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>

        {picking ? (
          <View style={styles.routePicker}>
            <TextInput
              style={styles.routePickerInput}
              placeholder="Search lift stations..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {liftMatches.map((lift) => (
              <TouchableOpacity
                key={lift.id}
                style={styles.routePickerRow}
                onPress={() => chooseLift(lift)}
              >
                <Text style={styles.routePickerName}>{lift.name}</Text>
                <Text style={styles.routePickerType}>
                  {liftTypeLabels[lift.liftType] || liftTypeLabels.unknown}
                </Text>
              </TouchableOpacity>
            ))}
            {liftMatches.length === 0 ? (
              <Text style={styles.mutedText}>No lift matches "{query}".</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.routeFieldLabel, { marginTop: 16 }]}>To</Text>
        <Text style={styles.routeDestination}>{destination.name}</Text>

        <Text style={[styles.routeFieldLabel, { marginTop: 16 }]}>Hardest piste I want to ski</Text>
        <View style={styles.routeChoiceRow}>
          {skillLevels.map((level) => {
            const on = skill === level.id;
            return (
              <TouchableOpacity
                key={level.id}
                style={[styles.categoryChip, on && styles.categoryChipActive]}
                onPress={() => setSkill(level.id)}
              >
                <View
                  style={[
                    styles.skillDot,
                    { backgroundColor: pisteColors[level.id], borderColor: on ? colors.white : 'transparent' },
                  ]}
                />
                <Text style={[styles.categoryChipText, on && styles.categoryChipTextActive]}>
                  {level.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {!destinationReachable ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>
            {destination.name} is too far from the lifts and pistes for a ski route.
          </Text>
        </View>
      ) : !result ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>
            No route found from {startLabel} with these settings. Try allowing harder pistes or
            another starting point.
          </Text>
        </View>
      ) : result.steps.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>You are already there - {destination.name} is right here.</Text>
        </View>
      ) : (
        <>
          <View style={styles.routeSummary}>
            <Text style={styles.routeSummaryTime}>{formatDuration(result.totalSeconds)}</Text>
            <Text style={styles.routeSummaryMeta}>
              {formatDistance(result.totalMeters)} · {result.steps.length}{' '}
              {result.steps.length === 1 ? 'step' : 'steps'}
            </Text>
          </View>

          {result.steps.map((step, index) => {
            const info = describeStep(step);
            return (
              <View key={step.key} style={styles.routeStep}>
                <Text style={styles.routeStepNumber}>{index + 1}</Text>
                <Ionicons name={info.icon} size={22} color={info.color} style={{ marginRight: 10 }} />
                <View style={styles.listItemTextWrap}>
                  <Text style={styles.routeStepTitle}>{info.title}</Text>
                  <Text style={styles.listItemSubtitle}>{info.subtitle}</Text>
                </View>
                <Text style={styles.routeStepTime}>{formatDuration(step.seconds)}</Text>
              </View>
            );
          })}

          <TouchableOpacity style={styles.button} onPress={showOnMap}>
            <Text style={styles.buttonText}>🗺️ Show on map</Text>
          </TouchableOpacity>

          <Text style={styles.footnote}>
            Times are estimates based on typical skiing and lift speeds. SkiMaps does not know
            whether a lift or piste is open today - check the resort's own status before you go.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
