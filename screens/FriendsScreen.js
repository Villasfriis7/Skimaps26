import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { friends } from '../data/friends';
import { styles, colors } from '../styles/styles';

// Friends-fanen - mock-data, da appen ikke har login/realtids-positionsdeling
// endnu. Viser hvordan vennelisten og "del position"/"fælles rute" skal fungere.
export default function FriendsScreen() {
  const shareLocation = () => {
    Alert.alert('Del position', 'Dine venner kan nu se din position på kortet.');
  };

  const createGroupRoute = () => {
    Alert.alert('Create group route', 'Vælg venner, destination og mødested. Kommer i en senere version.');
  };

  const renderFriend = ({ item }) => (
    <View style={styles.friendRow}>
      <View>
        <View style={[styles.avatarCircle, { backgroundColor: item.color }]}>
          <Text style={styles.avatarText}>{item.initials}</Text>
        </View>
        {item.online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.friendTextWrap}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendStatus}>{item.status}</Text>
      </View>
      <View style={styles.friendAwayChip}>
        <Text style={styles.friendAwayText}>{item.minutesAway} min away</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Friends</Text>
        <Text style={styles.screenHeaderSubtitle}>
          {friends.filter((f) => f.online).length} af {friends.length} venner online
        </Text>
      </View>

      <TouchableOpacity style={styles.shareLocationButton} onPress={shareLocation}>
        <Ionicons name="navigate-outline" size={18} color={colors.white} />
        <Text style={styles.shareLocationText}>Share my location</Text>
      </TouchableOpacity>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <TouchableOpacity style={styles.button} onPress={createGroupRoute}>
            <Text style={styles.buttonText}>👥 Create group route</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}
