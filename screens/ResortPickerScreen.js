import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useResort } from '../context/ResortContext';
import { searchSkiAreas, MAX_RESORT_RADIUS_M } from '../utils/resortData';
import { styles, colors } from '../styles/styles';

const SEARCH_DELAY_MS = 450;

// Vælg skiområde.
//
// Øverst ligger de områder, der virker med det samme: dem, der er indbygget
// i appen, og dem, brugeren tidligere har hentet. Søgefeltet finder alle
// andre skiområder i verden (OpenSkiMap). Et nyt område hentes fra
// OpenStreetMap første gang - det tager typisk et halvt til et helt minut -
// og gemmes derefter på telefonen.
//
// Når et område er valgt, bygger appen navigationen forfra (se App.js), så
// man lander på Explore i det nye område.
export default function ResortPickerScreen() {
  const { resort, bundledResorts, savedResorts, job, chooseResort, dismissJob, setPickerOpen, removeResort } =
    useResort();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = ingen søgning endnu
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const mounted = useRef(true);
  const latestSearch = useRef(0);

  // Fortæl ResortContext, at brugeren står her og venter: kun så skifter
  // appen område, når en hentning er færdig (se context/ResortContext.js).
  useEffect(() => {
    setPickerOpen(true);
    return () => {
      mounted.current = false;
      setPickerOpen(false);
    };
  }, [setPickerOpen]);

  // Søg, når brugeren har holdt en kort pause i tastningen.
  useEffect(() => {
    const q = query.trim();
    // Hver ændring får et nyt nummer, så et svar på en ældre søgning - også
    // en, der blev slettet igen - ikke overskriver det, der står nu.
    const ticket = ++latestSearch.current;
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      setSearchFailed(false);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchSkiAreas(q);
        if (!mounted.current || ticket !== latestSearch.current) return;
        setResults(found);
        setSearchFailed(false);
      } catch {
        if (!mounted.current || ticket !== latestSearch.current) return;
        setResults([]);
        setSearchFailed(true);
      }
      setSearching(false);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const readyIds = new Set([...bundledResorts, ...savedResorts].map((item) => item.id));
  const busy = job !== null && !job.errorCode;

  const choose = (item) => {
    if (busy || item.id === resort.id) return;
    chooseResort(item);
    // Lykkes det, bygges navigationen forfra, og denne skærm forsvinder.
  };

  const errorText = (failed) => {
    const name = failed.item.name;
    if (failed.errorCode === 'empty') return `OpenStreetMap has no lifts or pistes for ${name} yet.`;
    if (failed.errorCode === 'too_large') {
      return `${name} is too large to download in one go. Try one of the resorts inside it.`;
    }
    if (failed.errorCode === 'busy') {
      return 'The free elevation service has reached its limit for now. Try again in an hour - the resorts you already have still work.';
    }
    if (failed.errorCode === 'gone') return `${name} is no longer on this phone. Search for it to download it again.`;
    return 'The map servers did not answer. They are free and sometimes busy - try again in a minute.';
  };
  const canRetry = job && ['network', 'busy'].includes(job.errorCode) && Boolean(job.item.center);

  const row = (item, { subtitle, removable }) => {
    const current = item.id === resort.id;
    const ready = readyIds.has(item.id);
    const tooLarge = !ready && item.radiusMeters > MAX_RESORT_RADIUS_M;
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.rowMain, tooLarge && styles.dimmed]}
          onPress={() => choose(item)}
          disabled={busy || current || tooLarge}
          accessibilityRole="button"
          accessibilityState={{ selected: current, disabled: busy || tooLarge }}
          accessibilityLabel={`${item.name}, ${subtitle}`}
        >
          <View style={[styles.rowTile, current && { backgroundColor: colors.primary }]}>
            <Ionicons
              name={current ? 'checkmark' : ready ? 'location-outline' : 'cloud-download-outline'}
              size={20}
              color={current ? colors.white : colors.primary}
            />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSubtitle}>{tooLarge ? `${subtitle} · too large to download` : subtitle}</Text>
          </View>
        </TouchableOpacity>
        {removable && !current ? (
          <TouchableOpacity
            style={styles.rowAction}
            onPress={() => removeResort(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name} from this phone`}
          >
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const group = (items, describe, removable = false) => (
    <View style={styles.group}>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 ? <View style={styles.rowDivider} /> : null}
          {row(item, { subtitle: describe(item), removable })}
        </React.Fragment>
      ))}
    </View>
  );

  const areaText = (area) =>
    [
      area.country,
      area.pisteKm ? `${area.pisteKm} km of pistes` : null,
      `${area.liftCount} ${area.liftCount === 1 ? 'lift' : 'lifts'}`,
    ]
      .filter(Boolean)
      .join(' · ');

  // Hentede områder, der ikke også er indbygget.
  const downloaded = savedResorts.filter((item) => !bundledResorts.some((b) => b.id === item.id));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <StatusBar style="dark" />

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search any ski resort in the world"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search ski resorts"
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {query.length > 0 && !searching ? (
          <TouchableOpacity
            onPress={() => setQuery('')}
            style={styles.searchClear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {job ? (
        <View style={styles.card}>
          {job.errorCode ? (
            <>
              <Text style={styles.cardText}>{errorText(job)}</Text>
              <View style={{ flexDirection: 'row' }}>
                {canRetry ? (
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => chooseResort(job.item)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.smallButtonText}>Try again</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.smallButton} onPress={dismissJob} accessibilityRole="button">
                  <Text style={styles.smallButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.rowMain}>
              <ActivityIndicator color={colors.primary} style={{ marginRight: 14 }} />
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Getting {job.item.name}</Text>
                <Text style={styles.rowSubtitle}>{job.text}</Text>
              </View>
            </View>
          )}
        </View>
      ) : null}

      {results === null ? (
        <>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]} accessibilityRole="header">
            Ready to use
          </Text>
          {group(bundledResorts, (item) => `${item.country} · included in the app`)}
          {downloaded.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]} accessibilityRole="header">
                On this phone
              </Text>
              {group(downloaded, (item) => `${item.country} · ${item.liftCount} ${item.liftCount === 1 ? 'lift' : 'lifts'} · works offline`, true)}
            </>
          ) : null}
          <Text style={styles.footnote}>
            Any other ski resort is downloaded from OpenStreetMap the first time you choose it. That
            usually takes up to a minute, and after that it works without a connection. Search results
            come from OpenSkiMap.
          </Text>
        </>
      ) : results.length === 0 && !searching ? (
        <View style={styles.emptyState}>
          <Ionicons name={searchFailed ? 'cloud-offline-outline' : 'search-outline'} size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {searchFailed ? 'Could not search right now' : `No ski resort called "${query.trim()}"`}
          </Text>
          <Text style={styles.emptyText}>
            {searchFailed
              ? 'Check your connection and try again. The resorts you already have still work.'
              : 'Try the name of the resort or the ski area it belongs to.'}
          </Text>
        </View>
      ) : results.length > 0 ? (
        group(results, (area) => (readyIds.has(area.id) ? `${areaText(area)} · ready` : areaText(area)))
      ) : null}
    </ScrollView>
  );
}
