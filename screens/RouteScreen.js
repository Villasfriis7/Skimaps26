import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../context/LocationContext';
import { useRoute } from '../context/RouteContext';
import { useResort } from '../context/ResortContext';
import { findRoute, isOnNetwork, skillLevels } from '../utils/routing';
import {
  liftTypeLabels,
  difficultyLabel,
  shortDifficulty,
  pisteColor,
  skillLabel,
  skillColor,
} from '../utils/pistes';
import { distanceMeters, formatDistance, formatDuration } from '../utils/geo';
import { styles, colors } from '../styles/styles';

// "Gondola · 1,532 → 2,200 m" - højderne skiller lifter med samme navn ad
// (der er fx to, der hedder Tournelle).
function liftDetails(lift, elevations) {
  const type = liftTypeLabels[lift.liftType] || liftTypeLabels.unknown;
  const [a, b] = elevations[lift.id] || [];
  if (a === undefined || Math.abs(a - b) < 10) return type;
  return `${type} · ${Math.min(a, b)} → ${Math.max(a, b)} m`;
}

// Sværeste pist på ruten - det, en nervøs skiløber vil vide først.
const DIFFICULTY_ORDER = ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'extreme', 'freeride'];
function hardestPiste(steps) {
  let hardest = null;
  for (const step of steps) {
    if (step.kind !== 'piste') continue;
    if (!hardest || DIFFICULTY_ORDER.indexOf(step.difficulty) > DIFFICULTY_ORDER.indexOf(hardest)) {
      hardest = step.difficulty;
    }
  }
  return hardest;
}

// Ét trin i ruten som tekst + ikon.
function describeStep(step, convention) {
  const length = formatDistance(step.meters);
  if (step.kind === 'lift') {
    return {
      // Gondoler og kabelbaner kan også tages ned - så skal der stå "down".
      icon: step.down ? 'arrow-down-circle' : 'arrow-up-circle',
      color: colors.primary,
      title: step.down ? `Ride ${step.name} down` : `Take ${step.name}`,
      subtitle: `${liftTypeLabels[step.liftType] || liftTypeLabels.unknown} · ${length}`,
    };
  }
  if (step.kind === 'piste') {
    return {
      icon: 'ellipse',
      color: pisteColor(step.difficulty, convention),
      title: step.name ? `Ski ${step.name}` : 'Ski an unnamed piste',
      subtitle: `${difficultyLabel(step.difficulty, convention)} · ${length}`,
    };
  }
  return {
    icon: 'walk',
    color: colors.textMuted,
    title: `Walk ${length}`,
    subtitle: 'On foot',
  };
}

// Rutefinding via lifter og pister til ét sted (route.params.destination).
// Brugeren vælger startpunkt (egen GPS-position eller en liftstation) og den
// sværeste pist, de vil køre. Selve beregningen ligger i utils/routing.js;
// "Show on map" lægger ruten i RouteContext, så kortet kan tegne den.
//
// route.params.start ({ choice, liftId }) bruges, når skærmen åbnes fra
// kortets rutekort ("Steps"), så den viser samme rute som den, der er tegnet.
export default function RouteScreen({ navigation, route }) {
  const { destination, start } = route.params;
  const { location, locate } = useLocation();
  const { setActiveRoute, skill, setSkill } = useRoute();
  const { resort, model } = useResort();
  const { lifts, elevations, liftBottom, defaultLift, convention } = model;
  const graph = model.getGraph();
  // Lifterne i alfabetisk rækkefølge til "start fra"-listen.
  const sortedLifts = useMemo(() => [...lifts].sort((a, b) => a.name.localeCompare(b.name)), [lifts]);

  // Start: brugerens position, hvis den ligger i skiområdet - ellers en lift.
  // `startChoice` er null, indtil brugeren selv har valgt; så længe følger vi
  // automatisk positionen, også hvis GPS'en først svarer, efter skærmen er åbnet.
  const [startChoice, setStartChoice] = useState(start?.choice ?? null); // null | 'location' | 'lift'
  const locationUsable = location !== null && isOnNetwork(graph, location);
  const useMyLocation = locationUsable && startChoice !== 'lift';
  const [startLift, setStartLift] = useState(
    () => lifts.find((lift) => lift.id === start?.liftId) || defaultLift
  );
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');

  const startPoint = useMyLocation ? location : liftBottom(startLift);
  const startLabel = useMyLocation ? 'your location' : startLift.name;

  const result = useMemo(
    () => findRoute(graph, startPoint, destination, { skill, convention }),
    // startPoint er et nyt objekt ved hver rendering - sammenlign på tallene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, startPoint.latitude, startPoint.longitude, destination, skill, convention]
  );

  const destinationReachable = isOnNetwork(graph, destination);
  const skillIndex = skillLevels.findIndex((level) => level.id === skill);
  // Det næste niveau, der faktisk giver en rute (eller null, hvis intet gør).
  const harderLevel =
    result || !destinationReachable
      ? null
      : skillLevels
          .slice(skillIndex + 1)
          .find((level) => findRoute(graph, startPoint, destination, { skill: level.id, convention })) || null;
  const noRouteText =
    skill === 'none'
      ? `You can't get to ${destination.name} from ${startLabel} without skis - the way there includes a ski piste.`
      : harderLevel
        ? `There is no way to ${destination.name} from ${startLabel} on ${skillLabel(skill, convention).toLowerCase()} pistes or easier.`
        : `No route found to ${destination.name} from ${startLabel}. Try another starting point.`;

  const chooseMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    const { point, reason } = await locate();
    setLocating(false);
    if (reason === 'denied') {
      Alert.alert(
        'Location is switched off',
        'Allow location access for SkiMaps in your phone settings, or pick a lift station to start from.',
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
        'Your phone did not get a GPS position. Try again in a moment, or pick a lift station to start from.'
      );
      return;
    }
    if (!isOnNetwork(graph, point)) {
      const away = formatDistance(distanceMeters(point, model.region));
      Alert.alert(
        'You are not on the slopes',
        `You are about ${away} from ${resort.name}, so a ski route cannot start from your location. Pick a lift station instead.`
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
    setActiveRoute({
      ...result,
      destination,
      startLabel,
      skill,
      start: { choice: useMyLocation ? 'location' : 'lift', liftId: startLift.id },
    });
    navigation.popTo('MainTabs', {
      screen: 'Map',
      params: { showRoute: true, focusKey: Date.now() },
    });
  };

  const liftMatches = sortedLifts.filter((lift) =>
    lift.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const hardest = result ? hardestPiste(result.steps) : null;
  const liftCount = result ? result.steps.filter((step) => step.kind === 'lift').length : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <StatusBar style="dark" />

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>To</Text>
        <Text style={styles.routeDestination}>{destination.name}</Text>

        {destinationReachable ? (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>From</Text>
            <View style={styles.chipsWrap}>
              <TouchableOpacity
                style={[styles.chip, styles.chipOnCard, useMyLocation && styles.chipActive]}
                onPress={chooseMyLocation}
                accessibilityRole="button"
                accessibilityState={{ selected: useMyLocation, busy: locating }}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="locate" size={16} color={useMyLocation ? colors.white : colors.textDark} />
                )}
                <Text style={[styles.chipText, useMyLocation && styles.chipTextActive]}>
                  My location
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.chipOnCard, !useMyLocation && styles.chipActive, { flexShrink: 1 }]}
                onPress={() => setPicking((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ selected: !useMyLocation, expanded: picking }}
                accessibilityLabel={`Start from a lift station, ${startLift.name}`}
              >
                <Ionicons
                  name="triangle-outline"
                  size={16}
                  color={!useMyLocation ? colors.white : colors.textDark}
                />
                <Text
                  style={[styles.chipText, !useMyLocation && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {startLift.name} lift
                </Text>
                <Ionicons
                  name={picking ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={!useMyLocation ? colors.white : colors.textDark}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>
            {!useMyLocation && !picking ? (
              <Text style={styles.routeHint}>The route starts at the lift's bottom station.</Text>
            ) : null}

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
                {/* Fast højde med egen scroll, så 47 lifter ikke skubber resten
                    af skærmen flere skærmhøjder ned. */}
                <ScrollView
                  style={styles.routePickerList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {liftMatches.map((lift) => (
                    <TouchableOpacity
                      key={lift.id}
                      style={styles.routePickerRow}
                      onPress={() => chooseLift(lift)}
                    >
                      <Text style={styles.routePickerName}>{lift.name}</Text>
                      <Text style={styles.routePickerType}>{liftDetails(lift, elevations)}</Text>
                    </TouchableOpacity>
                  ))}
                  {liftMatches.length === 0 ? (
                    <Text style={[styles.mutedText, { paddingVertical: 12 }]}>
                      No lift matches "{query.trim()}".
                    </Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}

            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Hardest piste allowed</Text>
            <View style={styles.chipsWrap}>
              {skillLevels.map((level) => {
                const on = skill === level.id;
                return (
                  <TouchableOpacity
                    key={level.id}
                    style={[styles.chip, styles.chipOnCard, on && styles.chipActive]}
                    onPress={() => setSkill(level.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    {level.id === 'none' ? (
                      <Ionicons name="walk" size={16} color={on ? colors.white : colors.textDark} />
                    ) : (
                      <View
                        style={[
                          styles.skillDot,
                          { backgroundColor: skillColor(level.id, convention), borderColor: on ? colors.white : 'transparent' },
                        ]}
                      />
                    )}
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>
                      {skillLabel(level.id, convention)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}
      </View>

      {!destinationReachable ? (
        <View style={styles.card}>
          <Text style={styles.cardTextLast}>
            {destination.name} is too far from the lifts and pistes for a ski route. You can still
            find it on the map.
          </Text>
        </View>
      ) : !result ? (
        <View style={styles.card}>
          <Text style={harderLevel ? styles.cardText : styles.cardTextLast}>{noRouteText}</Text>
          {harderLevel ? (
            <TouchableOpacity style={styles.buttonSecondary} onPress={() => setSkill(harderLevel.id)}>
              <Text style={styles.buttonSecondaryText}>
                Show the route with {skillLabel(harderLevel.id, convention).toLowerCase()} pistes
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : result.steps.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTextLast}>
            You are already there - {destination.name} is right here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.routeSummary}>
            <Text style={styles.routeSummaryTime}>{formatDuration(result.totalSeconds)}</Text>
            <Text style={styles.routeSummaryMeta}>
              {formatDistance(result.totalMeters)}
              {liftCount ? ` · ${liftCount} ${liftCount === 1 ? 'lift' : 'lifts'}` : ''}
              {hardest ? ` · hardest piste: ${shortDifficulty(hardest, convention)}` : ''}
            </Text>
          </View>

          {/* Hovedhandlingen står over trinene, så man ikke skal scrolle forbi
              en lang rute for at finde den. */}
          <TouchableOpacity style={[styles.button, { marginBottom: 16 }]} onPress={showOnMap}>
            <Ionicons name="map-outline" size={18} color={colors.white} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Show on map</Text>
          </TouchableOpacity>

          {/* Trinene som en tidslinje i ét kort: ikonerne i en søjle med en
              streg imellem, så rækkefølgen kan læses med et blik. */}
          <View style={[styles.group, { paddingTop: 14 }]}>
            {result.steps.map((step, index) => {
              const info = describeStep(step, convention);
              const last = index === result.steps.length - 1;
              return (
                <View key={step.key} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={styles.stepIconWrap}>
                      <Ionicons name={info.icon} size={step.kind === 'piste' ? 18 : 24} color={info.color} />
                    </View>
                    <View style={[styles.stepConnector, last && styles.stepConnectorHidden]} />
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{info.title}</Text>
                    <Text style={styles.rowSubtitle}>{info.subtitle}</Text>
                  </View>
                  <Text style={styles.stepTime}>{formatDuration(step.seconds)}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.footnote}>
            Times and walking distances are estimates based on typical speeds. SkiMaps does not know
            whether a lift or piste is open today - check the resort's own status before you go.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
