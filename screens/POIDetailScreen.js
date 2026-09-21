import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { styles, colors } from '../styles/styles';

// Detaljeside for et enkelt sted - modtager stedet via route.params fra POIListScreen.
export default function POIDetailScreen({ route }) {
  const { poi } = route.params;
  const isCafe = poi.type === 'cafe';

  const visRute = () => {
    Alert.alert('Rute til ' + poi.name, poi.route);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View
          style={[
            styles.detailIconCircle,
            { backgroundColor: isCafe ? '#fdeed7' : '#fbe0d7' },
          ]}
        >
          <Text style={styles.detailIconEmoji}>{isCafe ? '☕' : '🍽️'}</Text>
        </View>

        <View
          style={[
            styles.badge,
            { backgroundColor: isCafe ? colors.cafe : colors.restaurant },
          ]}
        >
          <Text style={styles.badgeText}>{isCafe ? 'Café' : 'Restaurant'}</Text>
        </View>

        <Text style={[styles.subtitle, { textAlign: 'center' }]}>{poi.name}</Text>
        <Text style={styles.cardText}>{poi.description}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoRowIcon}>🚶</Text>
          <Text style={styles.infoRowText}>{poi.walkTime}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={visRute}>
        <Text style={styles.buttonText}>🧭 Vis rute</Text>
      </TouchableOpacity>
    </View>
  );
}
