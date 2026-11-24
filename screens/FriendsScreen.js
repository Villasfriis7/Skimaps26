import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { friends } from '../data/friends';
import { useLocation } from '../context/LocationContext';
import { distanceMeters, formatDistance } from '../utils/geo';
import { styles, colors } from '../styles/styles';

// Friends-fanen - vennerne er mock-data, da appen ikke har login eller
// realtids-positionsdeling endnu. Det, der ER rigtigt: tryk på en ven for at
// se dem på kortet, og afstanden til hver ven beregnes ud fra din egen
// GPS-position. "Share my location" er kun en knap i denne demo, og det
// siger den selv - den lader ikke som om, noget bliver sendt.
export default function FriendsScreen({ navigation }) {
  const { location, requestLocation } = useLocation();
  const [sharing, setSharing] = useState(false);

  const toggleSharing = async () => {
    if (sharing) {
      setSharing(false);
      return;
    }
    const point = location || (await requestLocation());
    if (!point) {
      Alert.alert(
        'Location unavailable',
        'Allow location access for SkiMaps in your phone settings to share your position.'
      );
      return;
    }
    setSharing(true);
  };

  const createGroupRoute = () => {
    Alert.alert(
      'Create group route',
      'Pick friends, a destination and a meeting point. Coming in a later version.'
    );
  };

  const showOnMap = (friend) =>
    navigation.navigate('Map', { focusFriendId: friend.id, focusKey: Date.now() });

  const renderFriend = ({ item }) => (
    <TouchableOpacity style={styles.friendRow} onPress={() => showOnMap(item)}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatarCircle, { backgroundColor: item.color }]}>
          <Text style={styles.avatarText}>{item.initials}</Text>
        </View>
        {item.online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.friendTextWrap}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendStatus}>{item.status}</Text>
      </View>
      {location ? (
        <View style={styles.friendAwayChip}>
          <Text style={styles.friendAwayText}>
            {formatDistance(distanceMeters(location, item))} away
          </Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color="#c7d8e0" style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.tabScreen} edges={['top']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Friends</Text>
        <Text style={styles.screenHeaderSubtitle}>
          {friends.filter((f) => f.online).length} of {friends.length} online · tap a friend to see them on the map
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.shareLocationButton, sharing && styles.shareLocationButtonActive]}
        onPress={toggleSharing}
      >
        <Ionicons name={sharing ? 'navigate' : 'navigate-outline'} size={18} color={colors.white} />
        <Text style={styles.shareLocationText}>
          {sharing ? 'Sharing my location · tap to stop' : 'Share my location'}
        </Text>
      </TouchableOpacity>
      {sharing ? (
        <Text style={[styles.footnote, { marginTop: -10, marginBottom: 14 }]}>
          Demo: SkiMaps has no server yet, so your position stays on this phone.
        </Text>
      ) : null}

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        showsVerticalScrollIndicator={false}
        style={styles.listBleed}
        contentContainerStyle={styles.listBleedContent}
        ListFooterComponent={
          <TouchableOpacity style={styles.button} onPress={createGroupRoute}>
            <Ionicons name="people" size={18} color={colors.white} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Create group route</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}
