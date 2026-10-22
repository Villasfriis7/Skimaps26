import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { styles, colors } from '../styles/styles';

// Profile-fanen - mock profil, da der ikke er login/brugerdata-backend endnu.
// "Saved places" er dog rigtig funktionalitet, hentet fra AsyncStorage via
// SavedPlacesContext (se context/SavedPlacesContext.js).
const otherMenuItems = [
  { id: 'routes', label: 'My routes', icon: 'map-outline', value: '4 routes' },
  { id: 'offline', label: 'Offline maps', icon: 'cloud-download-outline', value: 'Verbier' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', value: '' },
];

export default function ProfileScreen({ navigation }) {
  const { savedPlaces } = useSavedPlaces();
  const openMenuItem = (item) => Alert.alert(item.label, 'Kommer i en senere version.');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Profile</Text>
      </View>

      <View style={styles.profileHeaderRow}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>VF</Text>
        </View>
        <View>
          <Text style={styles.profileName}>Villas Friis</Text>
          <Text style={styles.profileEmail}>villas.friis@gmail.com</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>Ski days</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statNumber}>5</Text>
          <Text style={styles.statLabel}>Resorts</Text>
        </View>
        <View style={[styles.statTile, { borderRightWidth: 0 }]}>
          <Text style={styles.statNumber}>3</Text>
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
        <Text style={styles.profileMenuValue}>{savedPlaces.length} places</Text>
        <Ionicons name="chevron-forward" size={18} color="#c7d8e0" />
      </TouchableOpacity>

      {otherMenuItems.map((item) => (
        <TouchableOpacity key={item.id} style={styles.profileMenuItem} onPress={() => openMenuItem(item)}>
          <View style={styles.profileMenuIconWrap}>
            <Ionicons name={item.icon} size={20} color={colors.primary} />
          </View>
          <Text style={styles.profileMenuLabel}>{item.label}</Text>
          {item.value ? <Text style={styles.profileMenuValue}>{item.value}</Text> : null}
          <Ionicons name="chevron-forward" size={18} color="#c7d8e0" />
        </TouchableOpacity>
      ))}
    </ScrollView>
    </SafeAreaView>
  );
}
