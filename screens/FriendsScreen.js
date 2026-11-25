import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { friends } from '../data/friends';
import { useLocation } from '../context/LocationContext';
import { distanceMeters, formatDistance } from '../utils/geo';
import { styles, colors } from '../styles/styles';

// Friends-fanen - vennerne er eksempeldata, da appen ikke har login eller
// realtids-positionsdeling endnu, og det står øverst på skærmen. Det, der ER
// rigtigt: tryk på en ven for at se dem på kortet (og få en rute derhen), og
// afstanden til hver ven beregnes ud fra din egen GPS-position.
// "Share my location" er kun en kontakt i denne demo, og det siger den selv -
// den lader ikke som om, noget bliver sendt.
export default function FriendsScreen({ navigation }) {
  const { location, locate } = useLocation();
  const [sharing, setSharing] = useState(false);

  const toggleSharing = async (next) => {
    if (!next) {
      setSharing(false);
      return;
    }
    setSharing(true);
    if (location) return;
    const { point, reason } = await locate();
    if (point) return;
    setSharing(false);
    if (reason === 'denied') {
      Alert.alert(
        'Location is switched off',
        'Allow location access for SkiMaps in your phone settings to share your position.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      Alert.alert('Could not find your position', 'Try again in a moment - it often helps to stand outside.');
    }
  };

  const showOnMap = (friend) =>
    navigation.navigate('Map', { focusFriendId: friend.id, focusKey: Date.now() });

  // Nærmeste ven først, når vi kender brugerens position.
  const sorted = location
    ? [...friends].sort((a, b) => distanceMeters(location, a) - distanceMeters(location, b))
    : friends;

  return (
    <SafeAreaView style={styles.tabScreen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.listBleed}
        contentContainerStyle={styles.listBleedContent}
      >
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle} accessibilityRole="header">
            Friends
          </Text>
          <Text style={styles.screenSubtitle}>
            Example friends - sign-in and live positions come in a later version
          </Text>
        </View>

        <View style={[styles.group, styles.row]}>
          <View style={styles.rowTile}>
            <Ionicons name={sharing ? 'navigate' : 'navigate-outline'} size={20} color={colors.primary} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Share my location</Text>
            <Text style={styles.rowSubtitle}>
              {sharing
                ? 'Demo: nothing is sent - your position stays on this phone'
                : 'Let friends see where you are on the mountain'}
            </Text>
          </View>
          <Switch
            value={sharing}
            onValueChange={toggleSharing}
            trackColor={{ true: colors.open, false: colors.border }}
            accessibilityLabel="Share my location"
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {friends.filter((f) => f.online).length} of {friends.length} online
          </Text>
        </View>
        <View style={styles.group}>
          {sorted.map((friend, index) => (
            <React.Fragment key={friend.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <TouchableOpacity
                style={styles.row}
                onPress={() => showOnMap(friend)}
                accessibilityRole="button"
                accessibilityLabel={`${friend.name}, ${friend.status}, ${friend.online ? 'online' : 'offline'}. Show on the map`}
              >
                <View style={styles.avatarWrap}>
                  <View style={[styles.avatar, { backgroundColor: friend.color }, !friend.online && styles.dimmed]}>
                    <Text style={styles.avatarText}>{friend.initials}</Text>
                  </View>
                  {friend.online ? <View style={styles.onlineDot} /> : null}
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>{friend.name}</Text>
                  <Text style={styles.rowSubtitle}>
                    {friend.status}
                    {friend.online ? '' : ' · offline'}
                  </Text>
                </View>
                {location ? (
                  <Text style={styles.rowValue}>{formatDistance(distanceMeters(location, friend))}</Text>
                ) : null}
                <Ionicons name="map-outline" size={18} color={colors.textMuted} style={styles.rowChevron} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.footnote}>Tap a friend to see them on the map and get a route to them.</Text>

        <View style={[styles.group, styles.row, styles.dimmed, { marginTop: 16 }]}>
          <View style={styles.rowTile}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Group route</Text>
            <Text style={styles.rowSubtitle}>Pick friends, a destination and a meeting point</Text>
          </View>
          <View style={[styles.tag, { alignSelf: 'center' }]}>
            <Text style={styles.tagText}>Soon</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
