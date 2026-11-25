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
import { liftTypeLabels, shortDifficulty, skillLabel, skillColor } from '../utils/pistes';
import { distanceMeters, formatDistance, formatDuration } from '../utils/geo';
import { describeStep } from '../utils/routeSteps';
import { easiestWay } from '../utils/reach';
import { openLink, walkingLink } from '../utils/links';
import { useBottomSpace } from '../utils/safeArea';
import { styles, colors } from '../styles/styles';

// "Gondola · 1,532 → 2,200 m" - højderne skiller lifter med samme navn ad
// (der er fx to, der hedder Tournelle).
function liftDetails(lift, elevations) {
  const type = liftTypeLabels[lift.liftType] || liftTypeLabels.unknown;
  const [a, b] = elevations[lift.id] || [];
  if (a === undefined || Math.abs(a - b) < 10) return type;
  return `${type} · ${Math.min(a, b)} → ${Math.max(a, b)} m`;
}

// Rutefinding via lifter og pister til ét sted (route.params.destination).
// Brugeren vælger startpunkt (egen GPS-position eller en liftstation) og den
// sværeste pist, de vil køre. Selve beregningen ligger i utils/routing.js;
// "Show on map" lægger ruten i RouteContext, så kortet kan tegne den.
//
// route.params.start ({ choice, liftId }) bruges, når skærmen åbnes fra
// kortets rutekort ("Steps"), så den viser samme rute som den, der er tegnet;
// route.params.level er det niveau, den rute blev regnet for.
export default function RouteScreen({ navigation, route }) {
  const bottomSpace = useBottomSpace();
  const { destination, start, level: givenLevel } = route.params;
  const { location, locate } = useLocation();
  const { setActiveRoute, skill: savedSkill, setSkill } = useRoute();
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

  // HVILKET NIVEAU REGNES RUTEN FOR?
  //  - Brugerens gemte niveau (`savedSkill`), når de har valgt et.
  //  - Har de aldrig valgt, gætter vi ikke: så vises den letteste vej, der
  //    findes (ofte "uden ski"), og en linje beder dem vælge.
  //  - `once` er et niveau, der kun gælder denne ene rute: når man fra en
  //    blindgyde trykker "Show the route with red pistes", eller når skærmen
  //    åbnes fra kortets rutekort. Det ændrer ikke det gemte niveau - ellers
  //    ville ét nysgerrigt tryk gøre alle senere ruter røde.
  const [once, setOnce] = useState(givenLevel && givenLevel !== savedSkill ? givenLevel : null);
  const firstTime = savedSkill === null && once === null;
  const easiest = useMemo(
    () => (firstTime ? easiestWay(model, startPoint, destination) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firstTime, model, startPoint.latitude, startPoint.longitude, destination]
  );
  const skill = once || savedSkill || easiest?.level.id || 'easy';
  const chooseSkill = (levelId) => {
    setOnce(null);
    setSkill(levelId);
  };

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

  const hardest = result ? result.hardest : null;
  const liftCount = result ? result.steps.filter((step) => step.kind === 'lift').length : 0;
  // Har man tilladt sort, og den hurtigste vej kun bruger rød, skal det stå
  // der - ellers ligner det, at knappen ikke virkede.
  const hardestLevel = hardest ? skillLevels.findIndex((level) => level.allowed.includes(hardest)) : -1;
  const easierThanAllowed =
    result && hardest && skillIndex >= 2 && hardestLevel !== -1 && hardestLevel < skillIndex
      ? `The fastest way has no ${skillLabel(skill, convention).toLowerCase()} ${skill === 'freeride' ? 'section' : 'piste'}.`
      : null;
  // En rute uden lifter og pister er en gåtur - og vores gåture er lige
  // streger. Så er telefonens kort-app bedre til selve vejen.
  const walkOnly = result ? result.steps.length > 0 && result.steps.every((step) => step.kind === 'walk') : false;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomSpace }]}
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
                    onPress={() => chooseSkill(level.id)}
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
            <Text style={styles.routeHint}>
              {firstTime
                ? 'This is the easiest way there. Choose the hardest piste you are happy to ski - SkiMaps remembers it for your next routes.'
                : once
                  ? savedSkill
                    ? `${skillLabel(once, convention)} is used for this route only. Your level is still ${skillLabel(savedSkill, convention)} - tap a level to change it.`
                    : `${skillLabel(once, convention)} is used for this route only. Tap a level to make it yours.`
                  : 'Routes never use anything harder. SkiMaps remembers your choice.'}
            </Text>
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
            <TouchableOpacity style={styles.buttonSecondary} onPress={() => setOnce(harderLevel.id)}>
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
            {easierThanAllowed ? <Text style={styles.routeSummaryMeta}>{easierThanAllowed}</Text> : null}
          </View>

          {/* Hovedhandlingen står over trinene, så man ikke skal scrolle forbi
              en lang rute for at finde den. */}
          <TouchableOpacity style={[styles.button, { marginBottom: 16 }]} onPress={showOnMap}>
            <Ionicons name="map-outline" size={18} color={colors.white} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Show on map</Text>
          </TouchableOpacity>
          {walkOnly ? (
            <TouchableOpacity
              style={[styles.buttonSecondary, { marginBottom: 16 }]}
              onPress={() => openLink(walkingLink(destination))}
              accessibilityRole="link"
            >
              <Ionicons name="walk-outline" size={18} color={colors.primary} style={styles.buttonIcon} />
              <Text style={styles.buttonSecondaryText}>Walking directions in Maps</Text>
            </TouchableOpacity>
          ) : null}

          {/* Trinene som en tidslinje i ét kort: ikonerne i en søjle med en
              streg imellem, så rækkefølgen kan læses med et blik. */}
          <View style={[styles.group, { paddingTop: 14 }]}>
            {result.steps.map((step, index) => {
              const info = describeStep(step, convention, elevations);
              const last = index === result.steps.length - 1;
              return (
                <View key={step.key} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={styles.stepIconWrap}>
                      <Ionicons
                        name={info.icon}
                        size={step.kind === 'piste' ? 18 : 24}
                        color={info.color || (step.kind === 'lift' ? colors.primary : colors.textMuted)}
                      />
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
            Times and walking distances are estimates based on typical speeds
            {liftCount ? ' - each lift includes about 4 minutes for the queue and getting on' : ''}. SkiMaps does not know
            whether a lift or piste is open today - check the resort's own status before you go.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
