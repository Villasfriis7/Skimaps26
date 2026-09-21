import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { pois } from '../data/pois';
import { styles } from '../styles/styles';

// Viser liste over alle cafeer/restauranter. Tryk på et element for at se detaljer.
export default function POIListScreen({ navigation }) {
  const renderItem = ({ item }) => {
    const isCafe = item.type === 'cafe';
    return (
      <TouchableOpacity
        style={styles.listItem}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('POIDetail', { poi: item })}
      >
        <View
          style={[
            styles.listItemIconWrap,
            { backgroundColor: isCafe ? '#fdeed7' : '#fbe0d7' },
          ]}
        >
          <Text style={styles.listItemIcon}>{isCafe ? '☕' : '🍽️'}</Text>
        </View>
        <View style={styles.listItemTextWrap}>
          <Text style={styles.listItemTitle}>{item.name}</Text>
          <Text style={styles.listItemSubtitle}>
            {isCafe ? 'Café' : 'Restaurant'} · {item.walkTime}
          </Text>
        </View>
        <Text style={styles.listItemChevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Cafeer & restauranter</Text>
        <Text style={styles.screenHeaderSubtitle}>
          {pois.length} steder i Verbier skiområde
        </Text>
      </View>
      <FlatList
        data={pois}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
