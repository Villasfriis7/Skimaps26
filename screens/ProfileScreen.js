import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { useRoute } from '../context/RouteContext';
import { skillLevels } from '../utils/routing';
import { styles, colors } from '../styles/styles';

// Profile-fanen - demo-profil, da der ikke er login/brugerdata-backend endnu,
// og det står på skærmen. Demo-profilen bruger en @example.com-adresse med
// vilje: repoet er offentligt, så der skal ikke stå en rigtig e-mail i koden.
//
// Det, der er rigtigt her: "Saved places" (AsyncStorage via
// SavedPlacesContext) og "Skiing level", som er det niveau, rutefindingen
// bruger og husker.
const demoProfile = {
  name: 'Villas Friis',
  email: 'villas@example.com',
};

const comingSoon = [
  { id: 'routes', label: 'My routes', icon: 'map-outline' },
  { id: 'offline', label: 'Offline maps', icon: 'cloud-download-outline' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' },
];

const initialsOf = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export default function ProfileScreen({ navigation }) {
  const { savedPlaces } = useSavedPlaces();
  const { skill, setSkill } = useRoute();

  return (
    <SafeAreaView style={styles.tabScreen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.listBleed}
        contentContainerStyle={styles.listBleedContent}
      >
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle} accessibilityRole="header">
            Profile
          </Text>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initialsOf(demoProfile.name)}</Text>
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.profileName}>{demoProfile.name}</Text>
            <Text style={styles.screenSubtitle}>{demoProfile.email}</Text>
            <View style={[styles.tag, { marginTop: 6 }]}>
              <Text style={styles.tagText}>Demo profile · sign-in comes later</Text>
            </View>
          </View>
        </View>

        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('SavedPlaces')}
            accessibilityRole="button"
          >
            <View style={styles.rowTile}>
              <Ionicons name="heart" size={20} color={colors.saved} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Saved places</Text>
            </View>
            <Text style={styles.rowValue}>
              {savedPlaces.length} {savedPlaces.length === 1 ? 'place' : 'places'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.rowChevron} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Skiing level</Text>
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
                  <Text style={[styles.chipText, { marginLeft: 0 }, on && styles.chipTextActive]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.routeHint}>
            The hardest piste a route may use. Routes never send you down anything harder.
          </Text>
        </View>

        <View style={[styles.group, styles.dimmed]}>
          {comingSoon.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <View style={styles.row}>
                <View style={styles.rowTile}>
                  <Ionicons name={item.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>{item.label}</Text>
                </View>
                <View style={[styles.tag, { alignSelf: 'center' }]}>
                  <Text style={styles.tagText}>Soon</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
