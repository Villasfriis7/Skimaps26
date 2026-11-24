import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { friends } from '../data/friends';
import { styles, colors } from '../styles/styles';

// Profile-fanen - mock profil, da der ikke er login/brugerdata-backend endnu.
// Demo-profilen bruger en @example.com-adresse med vilje: repoet er
// offentligt, så der skal ikke stå en rigtig e-mail i koden.
// "Saved places" er rigtig funktionalitet, hentet fra AsyncStorage via
// SavedPlacesContext, og "Friends"-tallet tælles fra samme liste som
// Friends-fanen, så de to altid stemmer.
const demoProfile = {
  name: 'Villas Friis',
  email: 'villas@example.com',
  skiDays: 12,
  resorts: 5,
};

const otherMenuItems = [
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
  const openMenuItem = (item) => Alert.alert(item.label, 'Coming in a later version.');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenHeaderTitle}>Profile</Text>
        </View>

        <View style={styles.profileHeaderRow}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initialsOf(demoProfile.name)}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{demoProfile.name}</Text>
            <Text style={styles.profileEmail}>{demoProfile.email}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statNumber}>{demoProfile.skiDays}</Text>
            <Text style={styles.statLabel}>Ski days</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statNumber}>{demoProfile.resorts}</Text>
            <Text style={styles.statLabel}>Resorts</Text>
          </View>
          <View style={[styles.statTile, { borderRightWidth: 0 }]}>
            <Text style={styles.statNumber}>{friends.length}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.profileMenuItem}
          onPress={() => navigation.navigate('SavedPlaces')}
        >
          <View style={styles.profileMenuIconWrap}>
            <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.profileMenuLabel}>Saved places</Text>
          <Text style={styles.profileMenuValue}>
            {savedPlaces.length} {savedPlaces.length === 1 ? 'place' : 'places'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#c7d8e0" />
        </TouchableOpacity>

        {otherMenuItems.map((item) => (
          <TouchableOpacity key={item.id} style={styles.profileMenuItem} onPress={() => openMenuItem(item)}>
            <View style={styles.profileMenuIconWrap}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.profileMenuLabel}>{item.label}</Text>
            <Text style={styles.profileMenuValue}>Coming soon</Text>
            <Ionicons name="chevron-forward" size={18} color="#c7d8e0" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
